import assert from "node:assert/strict";
import test from "node:test";

import { createGroundedAnswer } from "./deterministic-provider.mjs";

test("derives the answer from the supplied question and supporting source content", () => {
  assert.deepEqual(createGroundedAnswer({
    question: "How long must company records be retained?",
    sources: [{ id: "source-7", content: "Retention Policy\nCompany records must be retained for seven years." }],
  }), {
    answer: "The supplied source states that company records must be retained for seven years.",
    citationIds: ["source-7"],
  });
});

test("rejects a source id without supporting content and an unrelated question", () => {
  assert.throws(() => createGroundedAnswer({
    question: "How long must company records be retained?",
    sources: [{ id: "source-7", content: "A heading without the retention rule." }],
  }), /supporting source required/);
  assert.throws(() => createGroundedAnswer({
    question: "What is the office address?",
    sources: [{ id: "source-7", content: "Company records must be retained for seven years." }],
  }), /supported question required/);
});
