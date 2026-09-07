import { randomUUID } from "node:crypto";
import {
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "../ai/embeddingProvider.js";
import type { ObjectStore } from "../storage/objectStore.js";
import { createDocumentObjectKey } from "../storage/objectStore.js";
import { chunkSections, type ChunkOptions } from "./chunking.js";
import { DocumentParser, DocumentParserError } from "./documentParser.js";
import {
  IngestionRepositoryError,
  type EmbeddedDocumentChunk,
  type IngestionRepository,
} from "./ingestionRepository.js";

export type IngestionServiceErrorCode =
  | "CONFLICT"
  | "EMBEDDING_FAILED"
  | "FORBIDDEN"
  | "INVALID_EMBEDDING"
  | "NOT_FOUND"
  | "PARSING_FAILED"
  | "SOURCE_NOT_FOUND";

export class IngestionServiceError extends Error {
  constructor(
    public readonly code: IngestionServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IngestionServiceError";
  }
}

interface IngestionServiceOptions {
  repository: IngestionRepository;
  objectStore: ObjectStore;
  parser: DocumentParser;
  embeddingProvider: EmbeddingProvider;
  chunkOptions?: ChunkOptions;
  embeddingBatchSize?: number;
  createRunId?: () => string;
}

const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxWords: 300,
  overlapWords: 50,
};

function safeFailure(cause: unknown) {
  if (cause instanceof DocumentParserError) {
    return {
      code: "PARSING_FAILED" as const,
      message: "Document parsing failed",
      reason: "Document parsing failed",
    };
  }
  if (cause instanceof EmbeddingProviderError) {
    return {
      code: "EMBEDDING_FAILED" as const,
      message: "Document embedding failed",
      reason: "Embedding provider failed",
    };
  }
  if (cause instanceof IngestionServiceError) {
    return {
      code: cause.code,
      message: cause.message,
      reason:
        cause.code === "INVALID_EMBEDDING"
          ? "Embedding response was invalid"
          : cause.message,
    };
  }
  return {
    code: "PARSING_FAILED" as const,
    message: "Document ingestion failed",
    reason: "Document ingestion failed",
  };
}

export class IngestionService {
  private readonly chunkOptions: ChunkOptions;
  private readonly embeddingBatchSize: number;
  private readonly createRunId: () => string;

  constructor(private readonly options: IngestionServiceOptions) {
    this.chunkOptions = options.chunkOptions ?? DEFAULT_CHUNK_OPTIONS;
    this.embeddingBatchSize = options.embeddingBatchSize ?? 64;
    this.createRunId = options.createRunId ?? randomUUID;
    if (
      !Number.isInteger(this.embeddingBatchSize) ||
      this.embeddingBatchSize <= 0
    ) {
      throw new RangeError("embeddingBatchSize must be a positive integer");
    }
  }

  async indexDocument(userId: string, workspaceId: string, documentId: string) {
    const runId = this.createRunId();
    let document;
    try {
      document = await this.options.repository.beginIndexing(userId, {
        id: runId,
        documentId,
        workspaceId,
        embeddingModel: this.options.embeddingProvider.model,
        embeddingDimensions: this.options.embeddingProvider.dimensions,
      });
    } catch (cause) {
      if (cause instanceof IngestionRepositoryError) {
        throw new IngestionServiceError(cause.code, cause.message);
      }
      throw cause;
    }

    try {
      const stored = await this.options.objectStore.get(
        createDocumentObjectKey(document.workspaceId, document.id),
      );
      if (!stored) {
        throw new IngestionServiceError(
          "SOURCE_NOT_FOUND",
          "Document source is unavailable",
        );
      }
      const sections = await this.options.parser.extract({
        mediaType: document.mediaType,
        bytes: stored.bytes,
      });
      const drafts = chunkSections(sections, this.chunkOptions);
      let chunkCount = 0;

      for (let start = 0; start < drafts.length; start += this.embeddingBatchSize) {
        const batch = drafts.slice(start, start + this.embeddingBatchSize);
        const vectors = await this.options.embeddingProvider.embed(
          batch.map((chunk) => chunk.text),
        );
        if (
          vectors.length !== batch.length ||
          vectors.some(
            (vector) =>
              vector.length !== this.options.embeddingProvider.dimensions ||
              vector.some((component) => !Number.isFinite(component)) ||
              vector.every((component) => component === 0),
          )
        ) {
          throw new IngestionServiceError(
            "INVALID_EMBEDDING",
            "Embedding provider returned invalid vectors",
          );
        }
        const embedded: EmbeddedDocumentChunk[] = batch.map((chunk, index) => ({
            ...chunk,
            embedding: vectors[index]!,
          }));
        await this.options.repository.appendChunks(runId, embedded);
        chunkCount += embedded.length;
      }

      await this.options.repository.activateIndex(runId);
      return { documentId, runId, chunkCount };
    } catch (cause) {
      const failure = safeFailure(cause);
      try {
        await this.options.repository.failIndex(runId, failure.reason);
      } catch {
        // Preserve the stable service error; persistence recovery is best effort.
      }
      throw new IngestionServiceError(failure.code, failure.message);
    }
  }
}
