import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requiredPaths = ["compose.yaml", ".github/workflows/ci.yml", "scripts/smoke-containers.mjs"];
export const PGVECTOR_IMAGE = "pgvector/pgvector:0.8.6-pg16-bookworm@sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b";

function assertion(condition, description) {
  if (!condition) throw new Error(`Compose contract failed: ${description}`);
}

function serviceBlock(source, service, nextService) {
  const end = nextService ? `(?=^  ${nextService}:)` : "(?=^volumes:)";
  return source.match(new RegExp(`^  ${service}:[\\s\\S]*?${end}`, "m"))?.[0] ?? "";
}

export function verifyComposeContract(files) {
  const compose = files["compose.yaml"];
  const workflow = files[".github/workflows/ci.yml"];
  const smoke = files["scripts/smoke-containers.mjs"];
  const database = serviceBlock(compose, "database", "api");
  const api = serviceBlock(compose, "api", "web");
  const web = serviceBlock(compose, "web");

  assertion(database.includes(`image: ${PGVECTOR_IMAGE}`), "database pins the verified pgvector image digest");
  assertion(/database-data:\/var\/lib\/postgresql\/data/.test(database), "database mounts the named database-data volume");
  assertion(/pg_isready/.test(database), "database has a readiness health check");
  assertion(/dockerfile: apps\/api\/Dockerfile/.test(api), "API builds its production Dockerfile");
  assertion(/document-data:\/var\/lib\/keystone\/objects/.test(api), "API mounts the named document-data volume");
  assertion(/OBJECT_STORAGE_DIRECTORY: \/var\/lib\/keystone\/objects/.test(api), "API writes documents to the persistent mount");
  assertion(/\$\{KEYSTONE_ACCESS_TOKEN_SECRET:\?/.test(api), "access-token secret is required at runtime");
  assertion(/\$\{KEYSTONE_DATABASE_PASSWORD:\?/.test(compose), "database password is required at runtime");
  assertion((compose.match(/condition: service_healthy/g) ?? []).length === 2, "services wait for healthy dependencies");
  assertion(/dockerfile: apps\/web\/Dockerfile/.test(web), "web builds its production Dockerfile");
  assertion(/\$\{KEYSTONE_WEB_PORT:-8080\}:8080/.test(web), "web is the topology's configurable public entrypoint");
  assertion(/^  database-data:\s*$/m.test(compose) && /^  document-data:\s*$/m.test(compose), "both persistent named volumes are declared");

  assertion(/container-smoke:/.test(workflow), "CI has a dedicated container-smoke job");
  assertion(workflow.includes(`image: ${PGVECTOR_IMAGE}`), "test job uses the same verified pgvector image digest");
  assertion(/container-smoke:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15/.test(workflow), "container-smoke job has a bounded timeout");
  assertion(/docker compose build/.test(workflow), "CI builds the production images");
  assertion(/docker compose up --detach --wait/.test(workflow), "CI starts and waits for the real topology");
  assertion(/node scripts\/smoke-containers\.mjs/.test(workflow), "CI runs the container smoke assertions");
  assertion(/docker compose down --volumes/.test(workflow), "CI always removes smoke resources");
  assertion(/docker compose exec -T api/.test(workflow) && /docker compose exec -T web/.test(workflow), "CI verifies both runtime users");

  assertion(smoke.includes('"/api/health"'), "smoke test exercises API liveness");
  assertion(smoke.includes('"/api/ready"'), "smoke test exercises database readiness");
  assertion(smoke.includes('"/api/auth/register"'), "smoke test exercises registration");
  assertion(smoke.includes('"/api/auth/login"'), "smoke test exercises login");
  assertion(smoke.includes('"/api/auth/me"'), "smoke test exercises authenticated access");
  assertion(smoke.includes('"/app/workspaces/container-smoke"'), "smoke test exercises a deep SPA route");
  assertion(/const runId = randomUUID\(\);/.test(smoke) && /container-smoke\+\$\{runId\}@example\.com/.test(smoke), "smoke test creates a unique account per run");
  assertion(/signal: AbortSignal\.timeout\(requestTimeoutMs\),/.test(smoke), "smoke HTTP requests have a bounded timeout");
}

export async function readComposeContractFiles(directory = root) {
  const files = {};
  for (const path of requiredPaths) {
    try {
      files[path] = await readFile(resolve(directory, path), "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        throw new Error(`Missing required Compose artifact: ${path}`);
      }
      throw error;
    }
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyComposeContract(await readComposeContractFiles());
  console.log("Compose contract verified: topology and CI runtime-smoke requirements are present.");
}
