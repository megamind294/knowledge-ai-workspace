import type { RetrievalResult } from "@knowledge-ai/contracts";
import { describe, expect, it } from "vitest";
import type { GenerationProvider } from "../ai/generationProvider.js";
import { GroundedAnswerService } from "./groundedAnswerService.js";

const source = (overrides: Partial<RetrievalResult> = {}): RetrievalResult => ({
  chunkId: "00000000-0000-4000-8000-000000000040",
  documentId: "00000000-0000-4000-8000-000000000030",
  collectionId: "00000000-0000-4000-8000-000000000020",
  originalFilename: "policy.md",
  ordinal: 2,
  content: "Employees receive twenty days of annual leave.",
  wordCount: 7,
  pageNumber: null,
  sectionHeading: "Annual leave",
  score: 0.91,
  ...overrides,
});

describe("GroundedAnswerService", () => {
  it("maps provider citations back to exact retrieved source metadata", async () => {
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async ({ sources }) => ({
        answer: "Employees receive twenty days of annual leave.",
        citationIds: [sources[0]!.id],
      }),
    };
    const service = new GroundedAnswerService({ provider });

    await expect(
      service.answer("How much annual leave is provided?", [source()]),
    ).resolves.toEqual({
      status: "answered",
      answer: "Employees receive twenty days of annual leave.",
      model: "test-chat-model",
      citations: [source()],
    });
  });

  it("deduplicates citations in first-mention order", async () => {
    const second = source({
      chunkId: "00000000-0000-4000-8000-000000000041",
      ordinal: 3,
      content: "Unused leave may be carried over with approval.",
    });
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async ({ sources }) => ({
        answer: "Twenty days are provided and carry-over needs approval.",
        citationIds: [sources[1]!.id, sources[0]!.id, sources[1]!.id],
      }),
    };

    const result = await new GroundedAnswerService({ provider }).answer(
      "What is the leave policy?",
      [source(), second],
    );
    expect(result.citations.map((item) => item.chunkId)).toEqual([
      second.chunkId,
      source().chunkId,
    ]);
  });

  it("deduplicates repeated retrieval rows by stored chunk identity", async () => {
    let suppliedSourceCount = 0;
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async ({ sources }) => {
        suppliedSourceCount = sources.length;
        return { answer: "Grounded.", citationIds: [sources[0]!.id] };
      },
    };

    const result = await new GroundedAnswerService({ provider }).answer(
      "Question",
      [source(), source({ content: "Duplicate database row." })],
    );

    expect(suppliedSourceCount).toBe(1);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.content).toBe(source().content);
  });

  it.each([
    { results: [] },
    { results: [source({ score: 0.69 })] },
    { results: [source({ score: -0.2 })] },
  ])("returns insufficient context without calling generation %#", async ({ results }) => {
    let calls = 0;
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async () => {
        calls += 1;
        throw new Error("must not be called");
      },
    };

    await expect(
      new GroundedAnswerService({ provider }).answer("Unknown question", results),
    ).resolves.toEqual({
      status: "insufficient_context",
      answer: "I couldn't find reliable source material to answer that question.",
      model: null,
      citations: [],
    });
    expect(calls).toBe(0);
  });

  it("bounds and numbers the source context sent to generation", async () => {
    let captured: Parameters<GenerationProvider["generate"]>[0] | undefined;
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async (input) => {
        captured = input;
        return { answer: "Grounded.", citationIds: [input.sources[0]!.id] };
      },
    };
    const results = Array.from({ length: 8 }, (_, index) =>
      source({
        chunkId: `00000000-0000-4000-8000-${String(40 + index).padStart(12, "0")}`,
        ordinal: index,
        content: "x".repeat(5_000),
      }),
    );

    await new GroundedAnswerService({
      provider,
      maxSources: 4,
      maxContextCharacters: 6_000,
    }).answer("Bound this context", results);

    expect(captured!.sources).toHaveLength(2);
    expect(captured!.sources.map((item) => item.id)).toEqual([
      "source-1",
      "source-2",
    ]);
    expect(captured!.sources.reduce((total, item) => total + item.content.length, 0)).toBe(
      6_000,
    );
  });

  it("fails closed when a provider returns an unknown citation id", async () => {
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async () => ({
        answer: "Unsupported answer",
        citationIds: ["source-99"],
      }),
    };

    await expect(
      new GroundedAnswerService({ provider }).answer("Question", [source()]),
    ).rejects.toMatchObject({ code: "INVALID_CITATIONS" });
  });

  it.each([
    { answer: "", citationIds: ["source-1"] },
    { answer: "x".repeat(12_001), citationIds: ["source-1"] },
    { answer: "Grounded", citationIds: [] },
    { answer: "Grounded", citationIds: null },
  ])("runtime-validates every provider implementation %#", async (generated) => {
    const provider: GenerationProvider = {
      model: "test-chat-model",
      generate: async () => generated as never,
    };

    await expect(
      new GroundedAnswerService({ provider }).answer("Question", [source()]),
    ).rejects.toMatchObject({ code: "INVALID_PROVIDER_RESPONSE" });
  });
});
