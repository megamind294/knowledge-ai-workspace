import {
  RetrievalRequestSchema,
  type ApiErrorResponse,
  type RetrievalResponse,
} from "@knowledge-ai/contracts";
import { Router } from "express";
import { z } from "zod";
import type { EmbeddingProvider } from "../ai/embeddingProvider.js";
import { requireAuth } from "../auth/requireAuth.js";
import type { RetrievalRepository } from "./retrievalRepository.js";

interface RetrievalRouterOptions {
  repository: RetrievalRepository;
  embeddingProvider: EmbeddingProvider;
  accessTokenSecret: Uint8Array;
}

const WorkspaceIdSchema = z.uuid();

function errorBody(
  response: { locals: Record<string, unknown> },
  code: ApiErrorResponse["error"]["code"],
  message: string,
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      requestId: response.locals.requestId as string,
    },
  };
}

function isValidEmbedding(value: unknown, dimensions: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === dimensions &&
    value.every((item) => typeof item === "number" && Number.isFinite(item)) &&
    value.some((item) => item !== 0)
  );
}

export function createRetrievalRouter(options: RetrievalRouterOptions) {
  const router = Router();
  const authenticate = requireAuth(options.accessTokenSecret);

  router.post(
    "/workspaces/:workspaceId/retrieval",
    authenticate,
    async (request, response, next) => {
      const parsed = RetrievalRequestSchema.safeParse(request.body);
      const workspaceId = WorkspaceIdSchema.safeParse(request.params.workspaceId);
      if (!parsed.success || !workspaceId.success) {
        response
          .status(400)
          .json(errorBody(response, "BAD_REQUEST", "Request validation failed"));
        return;
      }

      try {
        const allowed = await options.repository.canAccessScope(
          request.auth!.userId,
          workspaceId.data,
          parsed.data.scope,
        );
        if (!allowed) {
          response
            .status(404)
            .json(
              errorBody(response, "NOT_FOUND", "Retrieval scope not found"),
            );
          return;
        }
      } catch (error) {
        next(error);
        return;
      }

      let embedding: number[];
      try {
        const embeddings = await options.embeddingProvider.embed([parsed.data.query]);
        const candidate = embeddings.length === 1 ? embeddings[0] : undefined;
        if (!isValidEmbedding(candidate, options.embeddingProvider.dimensions)) {
          throw new Error("Invalid embedding response");
        }
        embedding = candidate;
      } catch {
        response
          .status(503)
          .json(
            errorBody(
              response,
              "INTERNAL_ERROR",
              "Search is temporarily unavailable",
            ),
          );
        return;
      }

      try {
        const results = await options.repository.search(
          request.auth!.userId,
          workspaceId.data,
          embedding,
          options.embeddingProvider.model,
          parsed.data.scope,
          parsed.data.topK,
        );
        if (results === null) {
          response
            .status(404)
            .json(
              errorBody(response, "NOT_FOUND", "Retrieval scope not found"),
            );
          return;
        }
        const body: RetrievalResponse = { results };
        response.json(body);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
