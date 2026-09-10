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
    errors: [
      { message: forbidden[0], stack: forbidden[2] },
      { message: "A11Y_CHECKPOINT_INVALID_LOGIN:color-contrast,label", location: { file: forbidden[1], line: 73, column: 11 } },
    ],
  });
  await reporter.onEnd({ status: "failed" });

  const diagnostics = `${lines.join("\n")}\n${await readFile(outputFile, "utf8")}`;
  for (const value of forbidden) assert.doesNotMatch(diagnostics, new RegExp(value));
  assert.match(diagnostics, /failed/);
  assert.match(diagnostics, /tests="1"/);
  assert.match(diagnostics, /failures="1"/);
  assert.match(diagnostics, /"line":73/);
  assert.match(diagnostics, /"column":11/);
  assert.match(diagnostics, /"checkpoint":"INVALID_LOGIN"/);
  assert.match(diagnostics, /"rules":\["color-contrast","label"\]/);
});

test("reports only the final attempt for one retried logical test", async () => {
  const forbidden = ["PRIVATE_TEST_ID", "PRIVATE_RETRY_TITLE", "PRIVATE_RETRY_ERROR", "PRIVATE_RETRY_STDOUT", "PRIVATE_RETRY_STDERR"];
  const directory = await mkdtemp(join(tmpdir(), "safe-reporter-retry-"));
  const outputFile = join(directory, "results.xml");
  const lines = [];
  const reporter = new PrivacySafeReporter({ outputFile, writeLine: (line) => lines.push(line) });
  const logicalTest = { id: forbidden[0], title: forbidden[1] };
  reporter.onBegin({}, { allTests: () => [logicalTest] });
  reporter.onTestEnd(logicalTest, {
    status: "failed",
    duration: 10,
    errors: [{ message: forbidden[2] }],
    stdout: [forbidden[3]],
    stderr: [forbidden[4]],
  });
  reporter.onTestEnd(logicalTest, { status: "passed", duration: 8 });
  await reporter.onEnd({ status: "passed" });

  const diagnostics = `${lines.join("\n")}\n${await readFile(outputFile, "utf8")}`;
  for (const value of forbidden) assert.doesNotMatch(diagnostics, new RegExp(value));
  assert.match(diagnostics, /tests="1"/);
  assert.match(diagnostics, /failures="0"/);
  assert.equal((diagnostics.match(/<testcase /g) ?? []).length, 1);
});
