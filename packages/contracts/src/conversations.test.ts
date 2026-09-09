import { describe, expect, it } from "vitest";
import {
  ConversationHistoryResponseSchema,
  ConversationListResponseSchema,
  ConversationResponseSchema,
  CreateConversationRequestSchema,
  SendConversationMessageRequestSchema,
  SendConversationMessageResponseSchema,
} from "./conversations.js";

const ids = {
  workspace: "00000000-0000-4000-8000-000000000010",
  collection: "00000000-0000-4000-8000-000000000020",
  conversation: "00000000-0000-4000-8000-000000000030",
  submission: "00000000-0000-4000-8000-000000000040",
  userMessage: "00000000-0000-4000-8000-000000000050",
  assistantMessage: "00000000-0000-4000-8000-000000000051",
  chunk: "00000000-0000-4000-8000-000000000060",
  document: "00000000-0000-4000-8000-000000000070",
};

const conversation = {
  id: ids.conversation,
  workspaceId: ids.workspace,
  createdByUserId: null,
  scope: { type: "collection", collectionId: ids.collection },
  title: "Annual leave",
  createdAt: "2026-09-08T00:00:00.000Z",
  updatedAt: "2026-09-08T00:01:00.000Z",
};

const userMessage = {
  id: ids.userMessage,
  conversationId: ids.conversation,
  submissionId: ids.submission,
  role: "user",
  position: 1,
  content: "How much leave is available?",
  model: null,
  createdAt: "2026-09-08T00:01:00.000Z",
  sources: [],
};

const assistantMessage = {
  ...userMessage,
  id: ids.assistantMessage,
  role: "assistant",
  position: 2,
  content: "Employees receive twenty days.",
  model: "test-generation",
  sources: [
    {
      chunkId: ids.chunk,
      documentId: ids.document,
      collectionId: ids.collection,
      citationOrdinal: 0,
      originalFilename: "policy.md",
      ordinal: 4,
      content: "Employees receive twenty days of annual leave.",
      wordCount: 7,
      pageNumber: null,
      sectionHeading: "Annual leave",
      score: 0.91,
    },
  ],
};

describe("conversation API contracts", () => {
  it("validates conversation creation and bounded message requests", () => {
    expect(
      CreateConversationRequestSchema.parse({
        scope: { type: "collection", collectionId: ids.collection },
        title: "  Annual leave  ",
      }),
    ).toEqual({
      scope: { type: "collection", collectionId: ids.collection },
      title: "Annual leave",
    });
    expect(
      SendConversationMessageRequestSchema.parse({
        submissionId: ids.submission,
        question: "  How much leave is available?  ",
      }),
    ).toEqual({
      submissionId: ids.submission,
      question: "How much leave is available?",
      topK: 5,
    });
    expect(() =>
      SendConversationMessageRequestSchema.parse({
        submissionId: ids.submission,
        question: " ",
      }),
    ).toThrow();
  });

  it("validates conversation, list, history, and grounded-turn responses", () => {
    expect(ConversationResponseSchema.parse({ conversation })).toEqual({ conversation });
    expect(
      ConversationListResponseSchema.parse({ conversations: [conversation] }),
    ).toEqual({ conversations: [conversation] });
    expect(
      ConversationHistoryResponseSchema.parse({
        messages: [userMessage, assistantMessage],
        nextPosition: null,
      }),
    ).toMatchObject({ messages: [{ role: "user" }, { role: "assistant" }] });
    expect(
      SendConversationMessageResponseSchema.parse({
        status: "answered",
        turn: { userMessage, assistantMessage },
      }),
    ).toMatchObject({ status: "answered", turn: { assistantMessage } });
  });

  it("rejects invented roles, sources, and unbounded fields", () => {
    expect(() =>
      ConversationHistoryResponseSchema.parse({
        messages: [{ ...assistantMessage, role: "system" }],
        nextPosition: null,
      }),
    ).toThrow();
    expect(() =>
      SendConversationMessageResponseSchema.parse({
        status: "answered",
        turn: {
          userMessage,
          assistantMessage: {
            ...assistantMessage,
            sources: [{ chunkId: ids.chunk, citationOrdinal: 0 }],
          },
        },
      }),
    ).toThrow();
  });
});
