import {
  ConversationHistoryResponseSchema,
  ConversationListResponseSchema,
  ConversationResponseSchema,
  SendConversationMessageResponseSchema,
  type RetrievalResult,
} from "@knowledge-ai/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "../ai/embeddingProvider.js";
import type { GenerationProvider } from "../ai/generationProvider.js";
import { GroundedAnswerService } from "../answers/groundedAnswerService.js";
import { createApp } from "../app.js";
import { issueAccessToken } from "../auth/tokens.js";
import type { AuthorizedRetrievalRepository } from "../retrieval/retrievalRepository.js";
import type {
  AppendTurnInput,
  ConversationRecord,
  ConversationRepository,
  ConversationTurnRecord,
  CreateConversationInput,
} from "./postgresConversationRepository.js";

const secret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);
const ids = {
  member: "00000000-0000-4000-8000-000000000001",
  outsider: "00000000-0000-4000-8000-000000000002",
  workspace: "00000000-0000-4000-8000-000000000010",
  collection: "00000000-0000-4000-8000-000000000020",
  document: "00000000-0000-4000-8000-000000000030",
  conversation: "00000000-0000-4000-8000-000000000040",
  submission: "00000000-0000-4000-8000-000000000050",
  userMessage: "00000000-0000-4000-8000-000000000060",
  assistantMessage: "00000000-0000-4000-8000-000000000061",
  chunk: "00000000-0000-4000-8000-000000000070",
};
const vector = Array.from({ length: 1536 }, () => 1);

async function token(userId: string) {
  return issueAccessToken({
    user: { id: userId, email: `${userId}@example.com`, displayName: "User" },
    secret,
    now: new Date("2026-09-08T00:00:00Z"),
    ttlSeconds: 60 * 60 * 24 * 365,
  });
}

const conversation: ConversationRecord = {
  id: ids.conversation,
  workspaceId: ids.workspace,
  createdByUserId: ids.member,
  scope: { type: "collection", collectionId: ids.collection },
  title: "Annual leave",
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
};

class MemoryConversationRepository implements ConversationRepository {
  appended: AppendTurnInput | null = null;
  completedTurn: ConversationTurnRecord | null = null;
  reservationActive = false;

  async createConversation(userId: string, input: CreateConversationInput) {
    if (userId !== ids.member || input.workspaceId !== ids.workspace) {
      throw new Error("not authorized");
    }
    return { ...conversation, scope: input.scope, title: input.title };
  }

  async listConversations(userId: string, workspaceId: string) {
    return userId === ids.member && workspaceId === ids.workspace
      ? [conversation]
      : [];
  }

  async getConversation(userId: string, workspaceId: string, conversationId: string) {
    return userId === ids.member &&
      workspaceId === ids.workspace &&
      conversationId === ids.conversation
      ? conversation
      : null;
  }

  async getTurnBySubmission(userId: string) {
    return userId === ids.member ? this.completedTurn : null;
  }

  async reserveSubmission(userId: string) {
    if (userId !== ids.member) return null;
    if (this.completedTurn) return { state: "completed" as const, turn: this.completedTurn };
    if (this.reservationActive) return { state: "in_progress" as const };
    this.reservationActive = true;
    return { state: "reserved" as const, token: ids.submission };
  }

  async releaseSubmission() {
    this.reservationActive = false;
  }

  async appendTurn(_userId: string, input: AppendTurnInput) {
    this.appended = input;
    this.completedTurn ??= turn(input);
    this.reservationActive = false;
    return this.completedTurn;
  }

  async listMessages(userId: string, workspaceId: string, conversationId: string) {
    return userId === ids.member &&
      workspaceId === ids.workspace &&
      conversationId === ids.conversation
      ? { items: [turn(this.appended ?? emptyAppend()).userMessage], nextPosition: null }
      : null;
  }
}

function emptyAppend(): AppendTurnInput {
  return {
    workspaceId: ids.workspace,
    conversationId: ids.conversation,
    submissionId: ids.submission,
    userContent: "How much leave is available?",
    assistantContent: "Employees receive twenty days.",
    model: "test-generation",
    sources: [],
  };
}

function turn(input: AppendTurnInput): ConversationTurnRecord {
  const createdAt = "2026-09-08T00:01:00.000Z";
  return {
    userMessage: {
      id: ids.userMessage,
      conversationId: ids.conversation,
      submissionId: input.submissionId,
      role: "user",
      position: 1,
      content: input.userContent,
      model: null,
      createdAt,
      sources: [],
    },
    assistantMessage: {
      id: ids.assistantMessage,
      conversationId: ids.conversation,
      submissionId: input.submissionId,
      role: "assistant",
      position: 2,
      content: input.assistantContent,
      model: input.model,
      createdAt,
      sources: input.sources.map((source) => ({
        ...source,
        originalFilename: "policy.md",
        ordinal: 0,
        content: "Employees receive twenty days of annual leave.",
        wordCount: 7,
        pageNumber: null,
        sectionHeading: "Annual leave",
      })),
    },
  };
}

const retrievalResult: RetrievalResult = {
  chunkId: ids.chunk,
  documentId: ids.document,
  collectionId: ids.collection,
  originalFilename: "policy.md",
  ordinal: 0,
  content: "Employees receive twenty days of annual leave.",
  wordCount: 7,
  pageNumber: null,
  sectionHeading: "Annual leave",
  score: 0.91,
};

function createTestApp(options: {
  conversations?: MemoryConversationRepository;
  retrieval?: AuthorizedRetrievalRepository;
  embedding?: EmbeddingProvider;
  generation?: GenerationProvider;
} = {}) {
  const conversations = options.conversations ?? new MemoryConversationRepository();
  const embeddingProvider = options.embedding ?? {
    model: "test-embedding",
    dimensions: 1536,
    embed: async () => [vector],
  };
  const retrievalRepository = options.retrieval ?? {
    canAccessScope: async () => true,
    withAuthorizedScope: async (_userId, _workspaceId, _scope, operation) =>
      operation(async () => [retrievalResult]),
    search: async () => [retrievalResult],
  };
  const generationProvider = options.generation ?? {
    model: "test-generation",
    generate: async () => ({
      answer: "Employees receive twenty days.",
      citationIds: ["source-1"],
    }),
  };
  return {
    conversations,
    app: createApp({
      conversations: {
        repository: conversations,
        retrievalRepository,
        embeddingProvider,
        answerService: new GroundedAnswerService({ provider: generationProvider }),
        accessTokenSecret: secret,
      },
    }),
  };
}

function auth(value: string) {
  return { Authorization: `Bearer ${value}` };
}

describe("grounded conversation API", () => {
  it("creates, lists, gets, and paginates authorized conversations", async () => {
    const authorization = auth(await token(ids.member));
    const { app } = createTestApp();

    const created = await request(app)
      .post(`/api/workspaces/${ids.workspace}/conversations`)
      .set(authorization)
      .send({
        scope: { type: "collection", collectionId: ids.collection },
        title: "Annual leave",
      })
      .expect(201);
    ConversationResponseSchema.parse(created.body);

    const listed = await request(app)
      .get(`/api/workspaces/${ids.workspace}/conversations?limit=20`)
      .set(authorization)
      .expect(200);
    ConversationListResponseSchema.parse(listed.body);

    const fetched = await request(app)
      .get(`/api/workspaces/${ids.workspace}/conversations/${ids.conversation}`)
      .set(authorization)
      .expect(200);
    ConversationResponseSchema.parse(fetched.body);

    const history = await request(app)
      .get(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages?limit=20`,
      )
      .set(authorization)
      .expect(200);
    ConversationHistoryResponseSchema.parse(history.body);
  });

  it("embeds, retrieves, generates, and atomically persists exact citations", async () => {
    const { app, conversations } = createTestApp();
    const response = await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(auth(await token(ids.member)))
      .send({
        submissionId: ids.submission,
        question: "How much leave is available?",
        topK: 4,
      })
      .expect(201);

    expect(SendConversationMessageResponseSchema.parse(response.body)).toMatchObject({
      status: "answered",
      turn: { assistantMessage: { content: "Employees receive twenty days." } },
    });
    expect(conversations.appended).toMatchObject({
      workspaceId: ids.workspace,
      conversationId: ids.conversation,
      submissionId: ids.submission,
      userContent: "How much leave is available?",
      model: "test-generation",
      sources: [
        {
          chunkId: ids.chunk,
          documentId: ids.document,
          collectionId: ids.collection,
          citationOrdinal: 0,
          score: 0.91,
        },
      ],
    });
  });

  it("returns an existing submission without repeating provider calls", async () => {
    let embeddingCalls = 0;
    const embedding: EmbeddingProvider = {
      model: "test-embedding",
      dimensions: 1536,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    const { app } = createTestApp({ embedding });
    const path = `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`;
    const body = { submissionId: ids.submission, question: "Policy?" };
    const authorization = auth(await token(ids.member));

    const first = await request(app).post(path).set(authorization).send(body).expect(201);
    const second = await request(app).post(path).set(authorization).send(body).expect(200);

    expect(second.body).toEqual(first.body);
    expect(embeddingCalls).toBe(1);
  });

  it("rejects an in-progress duplicate before provider work", async () => {
    let embeddingCalls = 0;
    const conversations = new MemoryConversationRepository();
    conversations.reservationActive = true;
    const embedding: EmbeddingProvider = {
      model: "test-embedding",
      dimensions: 1536,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    const { app } = createTestApp({ conversations, embedding });

    await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(auth(await token(ids.member)))
      .send({ submissionId: ids.submission, question: "Policy?" })
      .expect(409);

    expect(embeddingCalls).toBe(0);
  });

  it("requires authentication and hides conversations before provider calls", async () => {
    let embeddingCalls = 0;
    const embedding: EmbeddingProvider = {
      model: "test-embedding",
      dimensions: 1536,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    const { app } = createTestApp({ embedding });

    await request(app)
      .get(`/api/workspaces/${ids.workspace}/conversations`)
      .expect(401);
    await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(auth(await token(ids.outsider)))
      .send({ submissionId: ids.submission, question: "Private policy?" })
      .expect(404);
    expect(embeddingCalls).toBe(0);
  });

  it("persists the deterministic insufficient-context response without generation", async () => {
    let generationCalls = 0;
    const generation: GenerationProvider = {
      model: "test-generation",
      generate: async () => {
        generationCalls += 1;
        return { answer: "unsupported", citationIds: ["source-1"] };
      },
    };
    const retrieval: AuthorizedRetrievalRepository = {
      canAccessScope: async () => true,
      withAuthorizedScope: async (_userId, _workspaceId, _scope, operation) =>
        operation(async () => []),
      search: async () => [],
    };
    const { app, conversations } = createTestApp({ retrieval, generation });

    const response = await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(auth(await token(ids.member)))
      .send({ submissionId: ids.submission, question: "Unknown policy?" })
      .expect(201);

    expect(response.body.status).toBe("insufficient_context");
    expect(conversations.appended).toMatchObject({ model: null, sources: [] });
    expect(generationCalls).toBe(0);
  });

  it("stops before generation and persistence when scope access is revoked during retrieval", async () => {
    let embeddingCalls = 0;
    let generationCalls = 0;
    const embedding: EmbeddingProvider = {
      model: "test-embedding",
      dimensions: 1536,
      embed: async () => {
        embeddingCalls += 1;
        return [vector];
      },
    };
    const generation: GenerationProvider = {
      model: "test-generation",
      generate: async () => {
        generationCalls += 1;
        return { answer: "Private answer", citationIds: ["source-1"] };
      },
    };
    const retrieval: AuthorizedRetrievalRepository = {
      canAccessScope: async () => true,
      withAuthorizedScope: async () => null,
      search: async () => null,
    };
    const { app, conversations } = createTestApp({ retrieval, embedding, generation });

    await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(auth(await token(ids.member)))
      .send({ submissionId: ids.submission, question: "Private policy?" })
      .expect(404);

    expect(embeddingCalls).toBe(0);
    expect(generationCalls).toBe(0);
    expect(conversations.appended).toBeNull();
  });

  it("rejects malformed inputs and normalizes provider failures", async () => {
    const authorization = auth(await token(ids.member));
    const failedEmbedding: EmbeddingProvider = {
      model: "test-embedding",
      dimensions: 1536,
      embed: async () => {
        throw new Error("upstream secret response");
      },
    };
    const { app } = createTestApp({ embedding: failedEmbedding });

    await request(app)
      .post("/api/workspaces/not-a-uuid/conversations")
      .set(authorization)
      .send({ scope: { type: "workspace" }, title: "Chat" })
      .expect(400);
    await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(authorization)
      .send({ submissionId: "not-a-uuid", question: " " })
      .expect(400);
    const failed = await request(app)
      .post(
        `/api/workspaces/${ids.workspace}/conversations/${ids.conversation}/messages`,
      )
      .set(authorization)
      .send({ submissionId: ids.submission, question: "Policy?" })
      .expect(503);
    expect(JSON.stringify(failed.body)).not.toContain("upstream secret");
  });
});
