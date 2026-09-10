import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

export const NODE_IMAGE = "node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3";
export const NGINX_IMAGE = "nginx:1.27.5-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10";

const requiredPaths = [
  "apps/api/Dockerfile",
  "apps/web/Dockerfile",
  "apps/web/nginx.conf",
  ".dockerignore",
  "apps/web/src/App.tsx",
];
const nestedBuildContextPaths = [
  "apps/api/.env.production",
  "apps/web/.data/uploads/document.pdf",
  "packages/contracts/node_modules/zod/index.js",
  "apps/web/dist/assets/index.js",
];

function assertion(condition, description) {
  if (!condition) throw new Error(`Container contract failed: ${description}`);
}

function lines(source) {
  return source.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function parseDockerfile(source) {
  const stages = [];
  let stage;

  for (const line of lines(source)) {
    if (line.startsWith("#")) continue;
    const from = line.match(/^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?$/i);
    if (from) {
      stage = { image: from[1], name: from[2] ?? `stage-${stages.length}`, instructions: [] };
      stages.push(stage);
      continue;
    }
    if (stage) stage.instructions.push(line);
  }
  return stages;
}

function stageBody(stage) {
  return stage.instructions.join("\n");
}

function finalUser(stage) {
  const users = stage.instructions.filter((instruction) => /^USER\s+/i.test(instruction));
  return users.at(-1)?.replace(/^USER\s+/i, "").trim();
}

function nginxDirectiveValues(source, directive) {
  const expression = new RegExp(`^\\s*${directive}\\s+([^;]+);`, "gm");
  return [...source.matchAll(expression)].map((match) => match[1].trim());
}

function globToExpression(pattern) {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else {
      expression += character.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`);
}

export function dockerIgnoreExcludes(source, path) {
  const pathParts = path.split("/");
  const candidates = pathParts.map((_, index) => pathParts.slice(0, index + 1).join("/"));
  let excluded = false;

  for (const line of lines(source)) {
    if (line.startsWith("#")) continue;
    const negated = line.startsWith("!");
    const pattern = negated ? line.slice(1) : line;
    const expression = globToExpression(pattern);
    if (candidates.some((candidate) => expression.test(candidate))) excluded = !negated;
  }
  return excluded;
}

function assertNoBroadCopy(stages, name) {
  for (const stage of stages) {
    assertion(
      !stage.instructions.some((instruction) => /^(COPY|ADD)\s+(?:--\S+\s+)*\.\s+/i.test(instruction)),
      `${name} does not copy the complete build context`,
    );
  }
}

function assertPinnedStages(stages, expectedImages, name) {
  assertion(stages.length === expectedImages.length, `${name} has the expected number of stages`);
  for (const [index, expectedImage] of expectedImages.entries()) {
    assertion(stages[index]?.image === expectedImage, `${name} stage ${index + 1} pins its exact official image digest`);
  }
}

export function verifyContainerContract(files) {
  const apiStages = parseDockerfile(files["apps/api/Dockerfile"]);
  const webStages = parseDockerfile(files["apps/web/Dockerfile"]);
  const nginx = files["apps/web/nginx.conf"];
  const dockerignore = files[".dockerignore"];
  const appSource = files["apps/web/src/App.tsx"];
  const apiRuntime = apiStages.at(-1);
  const webRuntime = webStages.at(-1);

  assertPinnedStages(apiStages, [NODE_IMAGE, NODE_IMAGE], "API Dockerfile");
  assertPinnedStages(webStages, [NODE_IMAGE, NGINX_IMAGE], "web Dockerfile");
  assertNoBroadCopy(apiStages, "API Dockerfile");
  assertNoBroadCopy(webStages, "web Dockerfile");

  assertion(finalUser(apiRuntime) === "node", "API effective runtime user is node");
  assertion(finalUser(webRuntime) === "nginx", "web effective runtime user is nginx");
  assertion(/npm ci\b/.test(stageBody(apiStages[0])), "API build stage uses lockfile-backed npm ci");
  assertion(/npm ci --omit=dev --workspace=@knowledge-ai\/api\b/.test(stageBody(apiRuntime)), "API runtime installs only the API production dependency closure");
  assertion(/COPY --from=build \/app\/packages\/contracts\/dist/.test(stageBody(apiRuntime)), "API runtime receives built shared contracts");
  assertion(/VOLUME \["\/var\/lib\/keystone\/objects"\]/.test(stageBody(apiRuntime)), "API declares persistent document storage");
  assertion(/OBJECT_STORAGE_DIRECTORY=\/var\/lib\/keystone\/objects/.test(stageBody(apiRuntime)), "API defaults document storage to its declared volume");
  assertion(/HEALTHCHECK .*\/api\/health/.test(stageBody(apiRuntime)), "API health check uses dependency-free liveness");
  assertion(/HEALTHCHECK .*\/?healthz/.test(stageBody(webRuntime)), "web runtime has a local health check");

  assertion(JSON.stringify(nginxDirectiveValues(nginx, "error_log")) === JSON.stringify(["/dev/null crit"]), "Nginx suppresses request-bearing error logs");
  assertion(JSON.stringify(nginxDirectiveValues(nginx, "access_log")) === JSON.stringify(["off"]), "Nginx disables request/referrer access logs");
  assertion(JSON.stringify(nginxDirectiveValues(nginx, "client_max_body_size")) === JSON.stringify(["10m"]), "Nginx accepts the API's 10 MiB upload limit");
  assertion(/try_files \$uri \$uri\/ \/index\.html;/.test(nginx), "SPA routes fall back to index.html");
  assertion(/location = \/api \{[\s\S]*proxy_pass http:\/\/api:4000\/api;/.test(nginx), "same-origin /api root proxies to the API");
  assertion(/location \^~ \/api\/ \{[\s\S]*proxy_pass http:\/\/api:4000;/.test(nginx), "same-origin /api paths proxy to the API");
  assertion(/add_header X-Content-Type-Options "nosniff" always;/.test(nginx), "web responses prevent MIME sniffing");
  assertion(/add_header X-Frame-Options "DENY" always;/.test(nginx), "web responses deny framing");
  assertion(/add_header Referrer-Policy "strict-origin-when-cross-origin" always;/.test(nginx), "web responses set a restrictive referrer policy");
  assertion(/add_header Content-Security-Policy /.test(nginx), "web responses define a content security policy");

  for (const path of nestedBuildContextPaths) {
    assertion(dockerIgnoreExcludes(dockerignore, path), `.dockerignore excludes nested ${path}`);
  }
  assertion(/VITE_API_URL \?\? ""/.test(appSource), "web preserves the same-origin API default");
}

export async function readContainerContractFiles(directory = root) {
  const files = {};
  for (const path of requiredPaths) {
    try {
      files[path] = await readFile(resolve(directory, path), "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        throw new Error(`Missing required container artifact: ${path}`);
      }
      throw error;
    }
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyContainerContract(await readContainerContractFiles());
  console.log("Container contract verified: static production-image requirements are present.");
}
