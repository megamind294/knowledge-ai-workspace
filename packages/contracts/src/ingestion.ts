import { z } from "zod";

export const IndexDocumentResponseSchema = z
  .object({
    index: z
      .object({
        documentId: z.uuid(),
        runId: z.uuid(),
        chunkCount: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type IndexDocumentResponse = z.infer<
  typeof IndexDocumentResponseSchema
>;
