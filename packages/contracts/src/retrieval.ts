import { z } from "zod";

export const RetrievalScopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("workspace") }).strict(),
  z
    .object({ type: z.literal("collection"), collectionId: z.uuid() })
    .strict(),
  z.object({ type: z.literal("document"), documentId: z.uuid() }).strict(),
]);

export const RetrievalRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(2_000),
    scope: RetrievalScopeSchema,
    topK: z.number().int().min(1).max(20).default(5),
  })
  .strict();

export const RetrievalResultSchema = z
  .object({
    chunkId: z.uuid(),
    documentId: z.uuid(),
    collectionId: z.uuid().nullable(),
    originalFilename: z.string().min(1),
    ordinal: z.number().int().nonnegative(),
    content: z.string().min(1),
    wordCount: z.number().int().positive(),
    pageNumber: z.number().int().positive().nullable(),
    sectionHeading: z.string().min(1).nullable(),
    score: z.number().finite().min(-1).max(1),
  })
  .strict();

export const RetrievalResponseSchema = z
  .object({ results: z.array(RetrievalResultSchema) })
  .strict();

export type RetrievalScope = z.infer<typeof RetrievalScopeSchema>;
export type RetrievalRequest = z.infer<typeof RetrievalRequestSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
export type RetrievalResponse = z.infer<typeof RetrievalResponseSchema>;
