import type {
  ApiErrorResponse,
  IndexDocumentResponse,
} from "@knowledge-ai/contracts";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/requireAuth.js";
import {
  IngestionServiceError,
  type IngestionService,
} from "./ingestionService.js";

interface IndexingRouterOptions {
  service: Pick<IngestionService, "indexDocument">;
  accessTokenSecret: Uint8Array;
}

const IdentifierSchema = z.uuid();

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

function serviceError(response: Response, cause: IngestionServiceError) {
  switch (cause.code) {
    case "NOT_FOUND":
      error(response, 404, "NOT_FOUND", "Document not found");
      return;
    case "FORBIDDEN":
      error(response, 403, "FORBIDDEN", "This workspace role is read-only");
      return;
    case "CONFLICT":
      error(response, 409, "CONFLICT", "Document indexing is already in progress");
      return;
    case "SOURCE_NOT_FOUND":
      error(response, 409, "CONFLICT", "Document source is unavailable");
      return;
    case "PARSING_FAILED":
      error(response, 422, "BAD_REQUEST", "Document could not be indexed");
      return;
    case "EMBEDDING_FAILED":
    case "INVALID_EMBEDDING":
      error(
        response,
        503,
        "INTERNAL_ERROR",
        "Document indexing is temporarily unavailable",
      );
  }
}

export function createIndexingRouter(options: IndexingRouterOptions) {
  const router = Router();

  router.post(
    "/workspaces/:workspaceId/documents/:documentId/index",
    requireAuth(options.accessTokenSecret),
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const documentId = IdentifierSchema.safeParse(request.params.documentId);
      if (!workspaceId.success || !documentId.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }

      try {
        const result = await options.service.indexDocument(
          request.auth!.userId,
          workspaceId.data,
          documentId.data,
        );
        response.json({ index: result } satisfies IndexDocumentResponse);
      } catch (cause) {
        if (cause instanceof IngestionServiceError) {
          serviceError(response, cause);
          return;
        }
        next(cause);
      }
    },
  );

  return router;
}
