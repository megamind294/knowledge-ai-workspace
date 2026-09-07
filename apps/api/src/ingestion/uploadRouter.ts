import type {
  ApiErrorResponse,
  KnowledgeDocument,
} from "@knowledge-ai/contracts";
import express, {
  Router,
  type ErrorRequestHandler,
  type Response,
} from "express";
import { requireAuth } from "../auth/requireAuth.js";
import {
  KnowledgeRepositoryError,
  type KnowledgeRepository,
} from "../knowledge/knowledgeRepository.js";
import type { ObjectStore } from "../storage/objectStore.js";
import {
  createDocumentObjectKey,
  ObjectStoreError,
} from "../storage/objectStore.js";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

interface UploadRouterOptions {
  repository: KnowledgeRepository;
  objectStore: ObjectStore;
  accessTokenSecret: Uint8Array;
  maxBytes?: number;
}

function error(
  response: Response,
  status: number,
  code: ApiErrorResponse["error"]["code"],
  message: string,
) {
  response.status(status).json({
    error: {
      code,
      message,
      requestId: response.locals.requestId as string,
    },
  } satisfies ApiErrorResponse);
}

function repositoryError(response: Response, cause: KnowledgeRepositoryError) {
  const status =
    cause.code === "NOT_FOUND" ? 404 : cause.code === "FORBIDDEN" ? 403 : 409;
  error(response, status, cause.code, cause.message);
}

function mediaType(value: string | undefined) {
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function createUploadRouter(options: UploadRouterOptions) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive integer");
  }

  const router = Router();
  router.use(requireAuth(options.accessTokenSecret));

  router.post(
    "/workspaces/:workspaceId/documents/:documentId/content",
    async (request, response, next) => {
      try {
        response.locals.uploadDocument =
          await options.repository.authorizeDocumentUpload(
            request.auth!.userId,
            request.params.workspaceId!,
            request.params.documentId!,
          );
        next();
      } catch (cause) {
        if (cause instanceof KnowledgeRepositoryError) {
          repositoryError(response, cause);
          return;
        }
        next(cause);
      }
    },
    express.raw({ limit: maxBytes, type: () => true }),
    async (request, response, next) => {
      const document = response.locals.uploadDocument as KnowledgeDocument;
      const bytes = request.body as Buffer;

      if (mediaType(request.header("content-type")) !== document.mediaType) {
        error(response, 400, "BAD_REQUEST", "Content type does not match document metadata");
        return;
      }
      if (!Buffer.isBuffer(bytes) || bytes.byteLength !== document.sizeBytes) {
        error(response, 400, "BAD_REQUEST", "Content length does not match document metadata");
        return;
      }

      try {
        await options.objectStore.put({
          key: createDocumentObjectKey(document.workspaceId, document.id),
          bytes,
          contentType: document.mediaType,
        });
        response.status(201).json({
          upload: {
            documentId: document.id,
            mediaType: document.mediaType,
            sizeBytes: bytes.byteLength,
          },
        });
      } catch (cause) {
        if (cause instanceof ObjectStoreError && cause.code === "ALREADY_EXISTS") {
          error(response, 409, "CONFLICT", "Document content already exists");
          return;
        }
        next(cause);
      }
    },
  );

  const handleRawBodyError: ErrorRequestHandler = (
    cause,
    _request,
    response,
    next,
  ) => {
    if ((cause as { type?: string }).type === "entity.too.large") {
      error(response, 413, "BAD_REQUEST", "Document exceeds the configured size limit");
      return;
    }
    next(cause);
  };
  router.use(handleRawBodyError);
  return router;
}
