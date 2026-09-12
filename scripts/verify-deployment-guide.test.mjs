import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readGuide() {
  try {
    return await readFile(resolve(root, "docs/DEPLOYMENT.md"), "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      assert.fail("docs/DEPLOYMENT.md must exist");
    }
    throw error;
  }
}

async function readStatus() {
  return readFile(resolve(root, "PROJECT_STATUS.md"), "utf8");
}

test("deployment guide covers the complete operator handoff", async () => {
  const guide = await readGuide();
  const requiredHeadings = [
    "## Supported deployment artifact",
    "## Managed demo path",
    "## Production reference architecture",
    "## Secrets and provider data flow",
    "## Networking and health probes",
    "## Migrations",
    "## Backup and restore",
    "## Monitoring and alerting",
    "## Release and rollback",
    "## Acceptance checklist",
    "## Known limitations",
  ];

  for (const heading of requiredHeadings) {
    assert.match(guide, new RegExp(`^${heading}$`, "m"), `missing ${heading}`);
  }

  assert.match(guide, /docker compose up --detach --wait/, "guide must document the verified startup command");
  assert.match(guide, /node scripts\/smoke-containers\.mjs/, "guide must document the runtime smoke check");
  assert.match(guide, /\/api\/health/, "guide must distinguish liveness");
  assert.match(guide, /\/api\/ready/, "guide must distinguish readiness");
  assert.match(guide, /database-data/, "guide must include the PostgreSQL volume");
  assert.match(guide, /document-data/, "guide must include the document volume");
  assert.match(guide, /pg_dump/, "guide must include a database backup procedure");
  assert.match(guide, /pg_restore/, "guide must include a database restore procedure");
  assert.match(guide, /immutable image digest/i, "guide must require immutable releases");
  assert.match(guide, /does not claim a live deployment/i, "guide must preserve the truthful deployment boundary");
  assert.match(guide, /normalized document chunks.*embedding provider/i, "guide must disclose indexing data egress");
  assert.match(guide, /KEYSTONE_PUBLIC_URL/, "guide must configure the public application origin");
  assert.match(guide, /Node\.js 20\.19/, "guide must list the smoke-test runtime prerequisite");
  assert.match(guide, /write-quiescence window/i, "guide must require coordinated persistence capture");
  assert.match(guide, /provider-specific telemetry is not currently emitted/i, "guide must distinguish desired provider metrics from implemented logs");
  assert.match(guide, /overwrites `X-Forwarded-Proto`/i, "guide must disclose the current proxy scheme boundary");
});

test("project status does not retain superseded Day 6 claims", async () => {
  const status = await readStatus();

  assert.doesNotMatch(status, /images have not yet been built or exercised/i);
  assert.doesNotMatch(status, /Task 4 container topology\/runtime smoke tests.*remain/i);
});
