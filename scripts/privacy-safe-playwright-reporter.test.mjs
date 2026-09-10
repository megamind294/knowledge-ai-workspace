import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import PrivacySafeReporter from "./privacy-safe-playwright-reporter.mjs";

test("emits only structural console and JUnit diagnostics", async () => {
  const forbidden = ["PRIVATE_SOURCE_SENTENCE", "PRIVATE_USER_PROMPT", "PRIVATE_PROVIDER_RESPONSE"];
  const directory = await mkdtemp(join(tmpdir(), "safe-reporter-"));
  const outputFile = join(directory, "results.xml");
  const lines = [];
  const reporter = new PrivacySafeReporter({ outputFile, writeLine: (line) => lines.push(line) });
  reporter.onBegin({}, { allTests: () => [{ id: "test-id" }] });
  reporter.onTestEnd({ id: "test-id", title: forbidden[1] }, {
    status: "failed",
    duration: 17,
    errors: [{ message: forbidden[0], stack: forbidden[2] }],
  });
  await reporter.onEnd({ status: "failed" });

  const diagnostics = `${lines.join("\n")}\n${await readFile(outputFile, "utf8")}`;
  for (const value of forbidden) assert.doesNotMatch(diagnostics, new RegExp(value));
  assert.match(diagnostics, /failed/);
  assert.match(diagnostics, /tests="1"/);
  assert.match(diagnostics, /failures="1"/);
});
