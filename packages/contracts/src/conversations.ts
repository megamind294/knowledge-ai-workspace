import { z } from "zod";
import { RetrievalScopeSchema } from "./retrieval.js";

export const ConversationSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    createdByUserId: z.uuid().nullable(),
    scope: RetrievalScopeSchema,
    title: z.string().trim().min(1).max(200),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const ConversationMessageSourceSchema = z
  .object({
    chunkId: z.uuid(),
    documentId: z.uuid(),
    collectionId: z.uuid().nullable(),
    citationOrdinal: z.number().int().nonnegative(),
    originalFilename: z.string().min(1),
    ordinal: z.number().int().nonnegative(),
    content: z.string().min(1),
    wordCount: z.number().int().positive(),
    pageNumber: z.number().int().positive().nullable(),
    sectionHeading: z.string().min(1).nullable(),
    score: z.number().finite().min(-1).max(1).nullable(),
  })
  .strict();

export const ConversationMessageSchema = z
  .object({
    id: z.uuid(),
    conversationId: z.uuid(),
    submissionId: z.uuid().nullable(),
    role: z.enum(["user", "assistant"]),
    position: z.number().int().positive(),
    content: z.string().trim().min(1).max(20_000),
    model: z.string().trim().min(1).nullable(),
    createdAt: z.iso.datetime(),
    sources: z.array(ConversationMessageSourceSchema),
  })
  .strict();

export const ConversationTurnSchema = z
  .object({
    userMessage: ConversationMessageSchema,
    assistantMessage: ConversationMessageSchema,
  })
  .strict();

export const CreateConversationRequestSchema = z
  .object({
    scope: RetrievalScopeSchema,
    title: z.string().trim().min(1).max(200),
  })
  .strict();

export const SendConversationMessageRequestSchema = z
  .object({
    submissionId: z.uuid(),
    question: z.string().trim().min(1).max(2_000),
    topK: z.number().int().min(1).max(20).default(5),
  })
  .strict();

export const ConversationResponseSchema = z
  .object({ conversation: ConversationSchema })
  .strict();

export const ConversationListResponseSchema = z
  .object({ conversations: z.array(ConversationSchema) })
  .strict();

export const ConversationHistoryResponseSchema = z
  .object({
    messages: z.array(ConversationMessageSchema),
    nextPosition: z.number().int().positive().nullable(),
  })
  .strict();

export const SendConversationMessageResponseSchema = z
  .object({
    status: z.enum(["answered", "insufficient_context"]),
    turn: ConversationTurnSchema,
  })
  .strict();

export type Conversation = z.infer<typeof ConversationSchema>;
export type ConversationMessageSource = z.infer<
  typeof ConversationMessageSourceSchema
>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type CreateConversationRequest = z.infer<
  typeof CreateConversationRequestSchema
>;
export type SendConversationMessageRequest = z.infer<
  typeof SendConversationMessageRequestSchema
>;
export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export type ConversationListResponse = z.infer<
  typeof ConversationListResponseSchema
>;
export type ConversationHistoryResponse = z.infer<
  typeof ConversationHistoryResponseSchema
>;
export type SendConversationMessageResponse = z.infer<
  typeof SendConversationMessageResponseSchema
>;
