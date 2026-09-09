import { describe, expect, it } from "vitest";
import { groundedAnswerEvaluationFixtures, runGroundedAnswerEvaluationFixture } from "./groundedAnswerEvaluation.js";

describe("deterministic grounded-answer evaluation", () => {
  it.each(groundedAnswerEvaluationFixtures)("$id matches its groundedness expectation", async (fixture) => {
    const result = await runGroundedAnswerEvaluationFixture(fixture);

    expect(result).toMatchObject({
      id: fixture.id,
      providerCalls: fixture.expectedProviderCalls,
      status: fixture.expectedStatus,
      errorCode: fixture.expectedErrorCode,
      findings: fixture.expectedFindings,
    });
    expect(result.citedChunkIds).toEqual(fixture.expectedCitedChunkIds);
    expect(result.suppliedSourceContents).toEqual(fixture.expectedSuppliedSourceContents);
  });

  it("exercises the OpenAI-compatible prompt boundary with source text only in user data", async () => {
    const fixture = groundedAnswerEvaluationFixtures.find((candidate) => candidate.id === "prompt-injection-source")!;
    const result = await runGroundedAnswerEvaluationFixture(fixture);

    expect(result.providerMessageRoles).toEqual(["system", "user"]);
    expect(result.systemPrompt).toContain("untrusted source data");
    expect(result.systemPrompt).not.toContain("Ignore all previous instructions");
    expect(result.suppliedSourceContents[0]).toContain("Ignore all previous instructions");
    expect(result.answer).not.toContain("secret");
  });

  it("detects the valid-citation unsupported-answer negative control", async () => {
    const fixture = groundedAnswerEvaluationFixtures.find((candidate) => candidate.id === "unsupported-claim-negative-control")!;
    const result = await runGroundedAnswerEvaluationFixture(fixture);

    expect(result.status).toBe("answered");
    expect(result.citedChunkIds).toEqual(["00000000-0000-4000-8000-000000000106"]);
    expect(result.findings).toEqual(["UNSUPPORTED_ANSWER"]);
  });

  it("requires conflicting evidence to retain both exact citations", async () => {
    const fixture = groundedAnswerEvaluationFixtures.find((candidate) => candidate.id === "conflicting-context")!;
    const result = await runGroundedAnswerEvaluationFixture(fixture);

    expect(result.answer).toContain("conflict");
    expect(result.citedChunkIds).toEqual([
      "00000000-0000-4000-8000-000000000102",
      "00000000-0000-4000-8000-000000000103",
    ]);
  });
});
