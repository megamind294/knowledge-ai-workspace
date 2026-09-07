import type { DocumentChunkDraft } from "./chunking.js";

export type IngestionRepositoryErrorCode =
  | "CONFLICT"
  | "FORBIDDEN"
  | "NOT_FOUND";

export class IngestionRepositoryError extends Error {
  constructor(
    public readonly code: IngestionRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IngestionRepositoryError";
  }
}

export interface IndexableDocument {
  id: string;
  workspaceId: string;
  mediaType: string;
}

export interface IndexRunInput {
  id: string;
  documentId: string;
  workspaceId: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface EmbeddedDocumentChunk extends DocumentChunkDraft {
  embedding: readonly number[];
}

export interface IngestionRepository {
  beginIndexing(
    userId: string,
    input: IndexRunInput,
  ): Promise<IndexableDocument>;
  appendChunks(
    runId: string,
    chunks: readonly EmbeddedDocumentChunk[],
  ): Promise<void>;
  activateIndex(runId: string): Promise<void>;
  failIndex(runId: string, safeReason: string): Promise<void>;
}
