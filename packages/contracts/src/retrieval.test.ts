import { describe, expect, it } from "vitest";
import {
  RetrievalRequestSchema,
  RetrievalResponseSchema,
} from "./retrieval.js";

const collectionId = "00000000-0000-4000-8000-000000000020";
const documentId = "00000000-0000-4000-8000-000000000030";

describe("retrieval HTTP contracts", () => {
  it.each([
    { type: "workspace" },
    { type: "collection", collectionId },
    { type: "document", documentId },
  ])("accepts a bounded $type search scope", (scope) => {
    expect(
      RetrievalRequestSchema.parse({ query: "  retention policy  ", scope }),
    ).toEqual({ query: "retention policy", scope, topK: 5 });
  });

  it.each([
    { query: "", scope: { type: "workspace" } },
    { query: "policy", scope: { type: "workspace" }, topK: 0 },
    { query: "policy", scope: { type: "workspace" }, topK: 21 },
    { query: "policy", scope: { type: "collection" } },
    { query: "policy", scope: { type: "document", documentId }, extra: true },
  ])("rejects an unsafe or ambiguous retrieval request", (value) => {
    expect(RetrievalRequestSchema.safeParse(value).success).toBe(false);
  });

  it("accepts citation-ready results with cosine similarity scores", () => {
    const response = {
      results: [
        {
          chunkId: "00000000-0000-4000-8000-000000000040",
          documentId,
          collectionId,
          originalFilename: "policy.md",
          ordinal: 2,
          content: "Employees receive twenty days of annual leave.",
          wordCount: 7,
          pageNumber: null,
          sectionHeading: "Annual leave",
          score: 0.875,
        },
      ],
    };

    expect(RetrievalResponseSchema.parse(response)).toEqual(response);
  });
});
