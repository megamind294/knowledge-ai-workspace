import assert from "node:assert/strict";
import test from "node:test";
import {
  readComposeContractFiles,
  verifyComposeContract,
} from "./verify-compose-contract.mjs";

const files = await readComposeContractFiles();

function mutated(path, replace, replacement) {
  return { ...files, [path]: files[path].replace(replace, replacement) };
}

test("current Compose and CI artifacts satisfy the runtime-smoke contract", () => {
  assert.doesNotThrow(() => verifyComposeContract(files));
});

test("rejects a topology without durable document storage", () => {
  assert.throws(
    () => verifyComposeContract(mutated("compose.yaml", "document-data:/var/lib/keystone/objects", "/tmp/objects:/var/lib/keystone/objects")),
    /API mounts the named document-data volume/,
  );
});

test("rejects startup ordering that ignores database readiness", () => {
  assert.throws(
    () => verifyComposeContract(mutated("compose.yaml", "condition: service_healthy", "condition: service_started")),
    /services wait for healthy dependencies/,
  );
});

test("rejects committed fallback secrets", () => {
  assert.throws(
    () => verifyComposeContract(mutated("compose.yaml", "${KEYSTONE_ACCESS_TOKEN_SECRET:?", "${KEYSTONE_ACCESS_TOKEN_SECRET:-committed-secret}")),
    /access-token secret is required at runtime/,
  );
});

test("rejects CI that skips real image builds", () => {
  assert.throws(
    () => verifyComposeContract(mutated(".github/workflows/ci.yml", "docker compose build", "docker compose config")),
    /CI builds the production images/,
  );
});

test("rejects smoke coverage that omits authentication", () => {
  assert.throws(
    () => verifyComposeContract(mutated("scripts/smoke-containers.mjs", '"/api/auth/login"', '"/api/auth/capabilities"')),
    /smoke test exercises login/,
  );
});

test("rejects smoke coverage that omits deep SPA routing", () => {
  assert.throws(
    () => verifyComposeContract(mutated("scripts/smoke-containers.mjs", '"/app/workspaces/container-smoke"', '"/"')),
    /smoke test exercises a deep SPA route/,
  );
});

test("rejects a mutable pgvector image reference", () => {
  assert.throws(
    () => verifyComposeContract(mutated("compose.yaml", /pgvector\/pgvector:0\.8\.6-pg16-bookworm@sha256:[a-f0-9]+/, "pgvector/pgvector:0.8.6-pg16-bookworm")),
    /database pins the verified pgvector image digest/,
  );
  assert.throws(
    () => verifyComposeContract(mutated(".github/workflows/ci.yml", /pgvector\/pgvector:0\.8\.6-pg16-bookworm@sha256:[a-f0-9]+/, "pgvector/pgvector:0.8.6-pg16-bookworm")),
    /test job uses the same verified pgvector image digest/,
  );
});

test("rejects a fixed smoke-test account that collides with preserved data", () => {
  assert.throws(
    () => verifyComposeContract(mutated("scripts/smoke-containers.mjs", "const runId = randomUUID();", 'const runId = "fixed";')),
    /smoke test creates a unique account per run/,
  );
});

test("rejects unbounded smoke HTTP requests", () => {
  assert.throws(
    () => verifyComposeContract(mutated("scripts/smoke-containers.mjs", "signal: AbortSignal.timeout(requestTimeoutMs),", "")),
    /smoke HTTP requests have a bounded timeout/,
  );
});

test("rejects an unbounded container-smoke job", () => {
  assert.throws(
    () => verifyComposeContract(mutated(".github/workflows/ci.yml", "    timeout-minutes: 15\n", "")),
    /container-smoke job has a bounded timeout/,
  );
});
