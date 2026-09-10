import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("browser suite targets the built compose topology with a deterministic provider", async () => {
  const [compose, config, workflow, fixture, journey, reporter] = await Promise.all([
    read("compose.e2e.yaml"),
    read("playwright.config.ts"),
    read(".github/workflows/ci.yml"),
    read("scripts/deterministic-provider.mjs"),
    read("tests/e2e/keystone.spec.ts"),
    read("scripts/privacy-safe-playwright-reporter.mjs"),
  ]);

  assert.match(compose, /deterministic-provider:/);
  assert.match(compose, /network_mode: service:api/);
  assert.match(compose, /EMBEDDING_ENDPOINT: http:\/\/127\.0\.0\.1:8081\/v1\/embeddings/);
  assert.match(compose, /GENERATION_ENDPOINT: http:\/\/127\.0\.0\.1:8081\/v1\/chat\/completions/);
  assert.doesNotMatch(config, /webServer\s*:/, "Playwright must not start a development server");
  assert.match(config, /http:\/\/127\.0\.0\.1:8080/);
  assert.match(config, /privacy-safe-playwright-reporter\.mjs/);
  assert.doesNotMatch(config, /\["(?:line|junit|html)"/);
  assert.match(workflow, /docker compose -f compose\.yaml -f compose\.e2e\.yaml/);
  assert.match(workflow, /npx playwright test/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(fixture, /console\.log\([^)]*(body|authorization|content)/i);
  assert.match(journey, /getByRole\("link", \{ name: "Open retention-policy\.txt", exact: true \}\)/);
  assert.doesNotMatch(journey, /getByText\("retention-policy\.txt"\)/);
  assert.match(journey, /sources\)\.toContainText\("Company records must be retained for seven years\."\)/);
  assert.match(journey, /page\.unroute\("\*\*\/api\/workspaces"\)/);
  assert.doesNotMatch(reporter, /result\.(?:stdout|stderr)|test\.title/);
  assert.match(reporter, /\^A11Y_CHECKPOINT_/);
});
