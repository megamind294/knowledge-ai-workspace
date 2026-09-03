import { describe, expect, it } from "vitest";
import { IndexDocumentResponseSchema } from "./ingestion.js";

describe("document indexing HTTP contract", () => {
  it("accepts a completed index result", () => {
    const response = {
      index: {
        documentId: "00000000-0000-4000-8000-000000000030",
        runId: "00000000-0000-4000-8000-000000000040",
        chunkCount: 3,
      },
    };

    expect(IndexDocumentResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects incomplete or unbounded index results", () => {
    expect(
      IndexDocumentResponseSchema.safeParse({
        index: {
          documentId: "not-a-uuid",
          runId: "00000000-0000-4000-8000-000000000040",
          chunkCount: -1,
        },
      }).success,
    ).toBe(false);
  });
});
