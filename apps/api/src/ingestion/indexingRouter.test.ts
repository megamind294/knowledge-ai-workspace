import { IndexDocumentResponseSchema } from "@knowledge-ai/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { issueAccessToken } from "../auth/tokens.js";
import { IngestionServiceError } from "./ingestionService.js";

const secret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);
const ids = {
  user: "00000000-0000-4000-8000-000000000001",
  workspace: "00000000-0000-4000-8000-000000000010",
  document: "00000000-0000-4000-8000-000000000030",
  run: "00000000-0000-4000-8000-000000000040",
};

async function token() {
  return issueAccessToken({
    user: { id: ids.user, email: "owner@example.com", displayName: "Owner" },
    secret,
    now: new Date("2026-09-02T00:00:00Z"),
    ttlSeconds: 60 * 60 * 24 * 365,
  });
}

function path(workspaceId = ids.workspace, documentId = ids.document) {
  return `/api/workspaces/${workspaceId}/documents/${documentId}/index`;
}

describe("authenticated document indexing trigger", () => {
  it("authenticates and validates identifiers before indexing", async () => {
    const indexDocument = vi.fn();
    const app = createApp({
      indexing: { service: { indexDocument }, accessTokenSecret: secret },
    });

    await request(app).post(path()).expect(401);
    expect(indexDocument).not.toHaveBeenCalled();

    await request(app)
      .post(path("not-a-uuid"))
      .set("authorization", `Bearer ${await token()}`)
      .expect(400);
    expect(indexDocument).not.toHaveBeenCalled();
  });

  it("returns a contract-valid completed index result", async () => {
    const indexDocument = vi.fn().mockResolvedValue({
      documentId: ids.document,
      runId: ids.run,
      chunkCount: 3,
    });
    const app = createApp({
      indexing: { service: { indexDocument }, accessTokenSecret: secret },
    });

    const response = await request(app)
      .post(path())
      .set("authorization", `Bearer ${await token()}`)
      .expect(200);

    expect(IndexDocumentResponseSchema.parse(response.body)).toEqual({
      index: {
        documentId: ids.document,
        runId: ids.run,
        chunkCount: 3,
      },
    });
    expect(indexDocument).toHaveBeenCalledWith(
      ids.user,
      ids.workspace,
      ids.document,
    );
  });

  it.each([
    ["NOT_FOUND", 404, "NOT_FOUND", "Document not found"],
    ["FORBIDDEN", 403, "FORBIDDEN", "This workspace role is read-only"],
    ["CONFLICT", 409, "CONFLICT", "Document indexing is already in progress"],
    ["SOURCE_NOT_FOUND", 409, "CONFLICT", "Document source is unavailable"],
    ["PARSING_FAILED", 422, "BAD_REQUEST", "Document could not be indexed"],
    ["EMBEDDING_FAILED", 503, "INTERNAL_ERROR", "Document indexing is temporarily unavailable"],
    ["INVALID_EMBEDDING", 503, "INTERNAL_ERROR", "Document indexing is temporarily unavailable"],
  ] as const)(
    "maps %s without exposing provider or document content",
    async (serviceCode, status, code, message) => {
      const indexDocument = vi
        .fn()
        .mockRejectedValue(
          new IngestionServiceError(serviceCode, "private source/provider detail"),
        );
      const app = createApp({
        indexing: { service: { indexDocument }, accessTokenSecret: secret },
      });

      const response = await request(app)
        .post(path())
        .set("authorization", `Bearer ${await token()}`)
        .expect(status);

      expect(response.body.error).toMatchObject({ code, message });
      expect(JSON.stringify(response.body)).not.toContain("private");
      expect(JSON.stringify(response.body)).not.toContain("provider detail");
    },
  );
});
