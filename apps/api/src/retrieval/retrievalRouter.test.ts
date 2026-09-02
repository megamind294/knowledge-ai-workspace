import request from "supertest";
import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "../ai/embeddingProvider.js";
import { EmbeddingProviderError } from "../ai/embeddingProvider.js";
import { createApp } from "../app.js";
import { issueAccessToken } from "../auth/tokens.js";
import type {
  RetrievalRepository,
  RetrievalScope,
} from "./retrievalRepository.js";

const secret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);
const ids = {
  member: "00000000-0000-4000-8000-000000000001",
  outsider: "00000000-0000-4000-8000-000000000002",
  workspace: "00000000-0000-4000-8000-000000000010",
  collection: "00000000-0000-4000-8000-000000000020",
  document: "00000000-0000-4000-8000-000000000030",
  chunk: "00000000-0000-4000-8000-000000000040",
};
const vector = Array.from({ length: 1536 }, () => 1);

async function token(userId: string) {
  return issueAccessToken({
    user: { id: userId, email: `${userId}@example.com`, displayName: "User" },
    secret,
    now: new Date("2026-09-03T00:00:00Z"),
    ttlSeconds: 60 * 60 * 24 * 365,
  });
}

class ScopeRepository implements RetrievalRepository {
  async canAccessScope(
    userId: string,
    workspaceId: string,
    scope: RetrievalScope,
  ) {
    return !(
      userId === ids.outsider ||
      workspaceId !== ids.workspace ||
      (scope.type === "collection" && scope.collectionId !== ids.collection) ||
      (scope.type === "document" && scope.documentId !== ids.document)
    );
  }

  async search(
    userId: string,
    workspaceId: string,
    _embedding: readonly number[],
    _embeddingModel: string,
    scope: RetrievalScope,
    _topK: number,
  ) {
    void _topK;
    void _embeddingModel;
    if (userId === ids.outsider || workspaceId !== ids.workspace) return null;
    if (
      (scope.type === "collection" && scope.collectionId !== ids.collection) ||
      (scope.type === "document" && scope.documentId !== ids.document)
    ) {
      return null;
    }
    return [
      {
        chunkId: ids.chunk,
        documentId: ids.document,
        collectionId: ids.collection,
        originalFilename: "policy.md",
        ordinal: 0,
        content: "Annual leave is twenty days.",
        wordCount: 5,
        pageNumber: null,
        sectionHeading: "Annual leave",
        score: 0.9,
      },
    ];
  }
}

const provider: EmbeddingProvider = {
  model: "test-model",
  dimensions: 1536,
  embed: async () => [vector],
};

function app(
  embeddingProvider: EmbeddingProvider = provider,
  repository: RetrievalRepository = new ScopeRepository(),
) {
  return createApp({
    retrieval: { repository, embeddingProvider, accessTokenSecret: secret },
  });
}

function auth(value: string) {
  return { Authorization: `Bearer ${value}` };
}

describe("scoped semantic retrieval API", () => {
  it.each([
    { type: "workspace" },
    { type: "collection", collectionId: ids.collection },
    { type: "document", documentId: ids.document },
  ])("returns citation-ready results for $type scope", async (scope) => {
    const response = await request(app())
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(auth(await token(ids.member)))
      .send({ query: "annual leave", scope, topK: 3 })
      .expect(200);

    expect(response.body).toEqual({
      results: [
        {
          chunkId: ids.chunk,
          documentId: ids.document,
          collectionId: ids.collection,
          originalFilename: "policy.md",
          ordinal: 0,
          content: "Annual leave is twenty days.",
          wordCount: 5,
          pageNumber: null,
          sectionHeading: "Annual leave",
          score: 0.9,
        },
      ],
    });
  });

  it("requires authentication and hides non-member workspaces", async () => {
    let embeddingCalls = 0;
    const countedProvider: EmbeddingProvider = {
      ...provider,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    await request(app(countedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .send({ query: "leave", scope: { type: "workspace" } })
      .expect(401);
    const response = await request(app(countedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(auth(await token(ids.outsider)))
      .send({ query: "leave", scope: { type: "workspace" } })
      .expect(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Retrieval scope not found",
        requestId: expect.any(String),
      },
    });
    expect(embeddingCalls).toBe(0);
  });

  it("rejects invalid limits and mismatched collection or document scopes", async () => {
    const authorization = auth(await token(ids.member));
    let embeddingCalls = 0;
    const countedProvider: EmbeddingProvider = {
      ...provider,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    await request(app(countedProvider))
      .post("/api/workspaces/not-a-uuid/retrieval")
      .set(authorization)
      .send({ query: "leave", scope: { type: "workspace" } })
      .expect(400);
    await request(app(countedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(authorization)
      .send({ query: "leave", scope: { type: "workspace" }, topK: 21 })
      .expect(400);
    await request(app(countedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(authorization)
      .send({
        query: "leave",
        scope: {
          type: "collection",
          collectionId: "00000000-0000-4000-8000-000000000099",
        },
      })
      .expect(404);
    await request(app(countedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(authorization)
      .send({
        query: "leave",
        scope: {
          type: "document",
          documentId: "00000000-0000-4000-8000-000000000099",
        },
      })
      .expect(404);
    expect(embeddingCalls).toBe(0);
  });

  it("returns an empty successful result when no indexed chunks match", async () => {
    const emptyRepository: RetrievalRepository = {
      canAccessScope: async () => true,
      search: async () => [],
    };
    await request(app(provider, emptyRepository))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(auth(await token(ids.member)))
      .send({ query: "unknown", scope: { type: "workspace" } })
      .expect(200, { results: [] });
  });

  it("normalizes provider failures without leaking upstream details", async () => {
    const failedProvider: EmbeddingProvider = {
      model: "test-model",
      dimensions: 1536,
      embed: async () => {
        throw new EmbeddingProviderError("PROVIDER_FAILURE");
      },
    };
    const response = await request(app(failedProvider))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(auth(await token(ids.member)))
      .send({ query: "leave", scope: { type: "workspace" } })
      .expect(503);

    expect(response.body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Search is temporarily unavailable",
    });
    expect(JSON.stringify(response.body)).not.toContain("provider");
  });

  it("rejects malformed provider vectors before querying storage", async () => {
    let searched = false;
    const repository: RetrievalRepository = {
      canAccessScope: async () => true,
      search: async () => {
        searched = true;
        return [];
      },
    };
    const malformedProvider: EmbeddingProvider = {
      model: "test-model",
      dimensions: 1536,
      embed: async () => [Array.from({ length: 1536 }, () => 0)],
    };

    await request(app(malformedProvider, repository))
      .post(`/api/workspaces/${ids.workspace}/retrieval`)
      .set(auth(await token(ids.member)))
      .send({ query: "leave", scope: { type: "workspace" } })
      .expect(503);

    expect(searched).toBe(false);
  });
});
