import assert from "node:assert/strict";
import test from "node:test";
import { readContainerContractFiles, verifyContainerContract } from "./verify-container-contract.mjs";

const files = await readContainerContractFiles();

function mutated(path, replace, replacement) {
  return { ...files, [path]: files[path].replace(replace, replacement) };
}

test("current production-container artifacts satisfy the contract", () => {
  assert.doesNotThrow(() => verifyContainerContract(files));
});

test("rejects a root effective runtime user even when an earlier non-root user exists", () => {
  assert.throws(
    () => verifyContainerContract(mutated("apps/api/Dockerfile", 'CMD ["node", "apps/api/dist/server.js"]', 'USER root\nCMD ["node", "apps/api/dist/server.js"]')),
    /API effective runtime user is node/,
  );
});

test("rejects a production dependency install placed outside the API runtime stage", () => {
  assert.throws(
    () => verifyContainerContract(mutated("apps/api/Dockerfile", "RUN npm ci --omit=dev --workspace=@knowledge-ai/api && npm cache clean --force", "RUN npm ci && npm cache clean --force")),
    /API runtime installs only the API production dependency closure/,
  );
});

test("rejects an unpinned API runtime image", () => {
  assert.throws(
    () => verifyContainerContract(mutated("apps/api/Dockerfile", /^FROM node:20\.19\.5-bookworm-slim@sha256:[a-f0-9]+$/m, "FROM node:20.19.5-bookworm-slim")),
    /API Dockerfile stage 2 pins its exact official image digest/,
  );
});

test("rejects Nginx logging and upload-limit regressions", () => {
  assert.throws(
    () => verifyContainerContract(mutated("apps/web/nginx.conf", "error_log /dev/null crit;", "error_log /dev/stderr error;")),
    /Nginx suppresses request-bearing error logs/,
  );
  assert.throws(
    () => verifyContainerContract(mutated("apps/web/nginx.conf", "access_log off;", "access_log off;\n  access_log /dev/stdout combined;")),
    /Nginx disables request\/referrer access logs/,
  );
  assert.throws(
    () => verifyContainerContract(mutated("apps/web/nginx.conf", "client_max_body_size 10m;", "client_max_body_size 1m;")),
    /Nginx accepts the API's 10 MiB upload limit/,
  );
});

test("rejects an ignore file that permits nested environment secrets", () => {
  assert.throws(
    () => verifyContainerContract(mutated(".dockerignore", "**/.env.*\n", "")),
    /\.dockerignore excludes nested apps\/api\/.env\.production/,
  );
});
