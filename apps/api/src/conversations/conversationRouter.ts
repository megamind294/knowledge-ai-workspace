import {
  CreateConversationRequestSchema,
  SendConversationMessageRequestSchema,
  type ApiErrorResponse,
  type ConversationHistoryResponse,
  type ConversationListResponse,
  type ConversationResponse,
  type SendConversationMessageResponse,
} from "@knowledge-ai/contracts";
import { Router, type Response } from "express";
import { z } from "zod";
import type { EmbeddingProvider } from "../ai/embeddingProvider.js";
import type { GroundedAnswerService } from "../answers/groundedAnswerService.js";
import { requireAuth } from "../auth/requireAuth.js";
import type { AuthorizedRetrievalRepository } from "../retrieval/retrievalRepository.js";
import {
  ConversationRepositoryError,
  type ConversationRepository,
  type ConversationTurnRecord,
} from "./postgresConversationRepository.js";

interface ConversationRouterOptions {
  repository: ConversationRepository;
  retrievalRepository: AuthorizedRetrievalRepository;
  embeddingProvider: EmbeddingProvider;
  answerService: Pick<GroundedAnswerService, "answer">;
  accessTokenSecret: Uint8Array;
}

const IdentifierSchema = z.uuid();
const ConversationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const MessageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  afterPosition: z.coerce.number().int().nonnegative().optional(),
}).strict();

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

function repositoryError(response: Response, cause: ConversationRepositoryError) {
  switch (cause.code) {
    case "NOT_FOUND":
      error(response, 404, "NOT_FOUND", "Conversation not found");
      return true;
    case "CONFLICT":
    case "INVALID_SOURCE":
      error(response, 409, "CONFLICT", "Conversation changed; please retry");
      return true;
    case "INVALID_INPUT":
      error(response, 400, "BAD_REQUEST", "Request validation failed");
      return true;
    default:
      return false;
  }
}

function validEmbedding(value: unknown, dimensions: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === dimensions &&
    value.every((item) => typeof item === "number" && Number.isFinite(item)) &&
    value.some((item) => item !== 0)
  );
}

function responseStatus(turn: ConversationTurnRecord) {
  return turn.assistantMessage.model === null ? "insufficient_context" : "answered";
}

class GroundedProviderUnavailableError extends Error {}

export function createConversationRouter(options: ConversationRouterOptions) {
  const router = Router();
  const authenticate = requireAuth(options.accessTokenSecret);

  router.post(
    "/workspaces/:workspaceId/conversations",
    authenticate,
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const body = CreateConversationRequestSchema.safeParse(request.body);
      if (!workspaceId.success || !body.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }
      try {
        const conversation = await options.repository.createConversation(
          request.auth!.userId,
          { workspaceId: workspaceId.data, ...body.data },
        );
        response.status(201).json({ conversation } satisfies ConversationResponse);
      } catch (cause) {
        if (cause instanceof ConversationRepositoryError && repositoryError(response, cause)) {
          return;
        }
        next(cause);
      }
    },
  );

  router.get(
    "/workspaces/:workspaceId/conversations",
    authenticate,
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const query = ConversationListQuerySchema.safeParse(request.query);
      if (!workspaceId.success || !query.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }
      try {
        const conversations = await options.repository.listConversations(
          request.auth!.userId,
          workspaceId.data,
          query.data.limit,
        );
        response.json({ conversations } satisfies ConversationListResponse);
      } catch (cause) {
        if (cause instanceof ConversationRepositoryError && repositoryError(response, cause)) {
          return;
        }
        next(cause);
      }
    },
  );

  router.get(
    "/workspaces/:workspaceId/conversations/:conversationId",
    authenticate,
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const conversationId = IdentifierSchema.safeParse(request.params.conversationId);
      if (!workspaceId.success || !conversationId.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }
      try {
        const conversation = await options.repository.getConversation(
          request.auth!.userId,
          workspaceId.data,
          conversationId.data,
        );
        if (!conversation) {
          error(response, 404, "NOT_FOUND", "Conversation not found");
          return;
        }
        response.json({ conversation } satisfies ConversationResponse);
      } catch (cause) {
        next(cause);
      }
    },
  );

  router.get(
    "/workspaces/:workspaceId/conversations/:conversationId/messages",
    authenticate,
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const conversationId = IdentifierSchema.safeParse(request.params.conversationId);
      const query = MessageListQuerySchema.safeParse(request.query);
      if (!workspaceId.success || !conversationId.success || !query.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }
      try {
        const history = await options.repository.listMessages(
          request.auth!.userId,
          workspaceId.data,
          conversationId.data,
          query.data,
        );
        if (!history) {
          error(response, 404, "NOT_FOUND", "Conversation not found");
          return;
        }
        response.json({
          messages: history.items,
          nextPosition: history.nextPosition,
        } satisfies ConversationHistoryResponse);
      } catch (cause) {
        if (cause instanceof ConversationRepositoryError && repositoryError(response, cause)) {
          return;
        }
        next(cause);
      }
    },
  );

  router.post(
    "/workspaces/:workspaceId/conversations/:conversationId/messages",
    authenticate,
    async (request, response, next) => {
      const workspaceId = IdentifierSchema.safeParse(request.params.workspaceId);
      const conversationId = IdentifierSchema.safeParse(request.params.conversationId);
      const body = SendConversationMessageRequestSchema.safeParse(request.body);
      if (!workspaceId.success || !conversationId.success || !body.success) {
        error(response, 400, "BAD_REQUEST", "Request validation failed");
        return;
      }

      let conversation;
      try {
        conversation = await options.repository.getConversation(
          request.auth!.userId,
          workspaceId.data,
          conversationId.data,
        );
      } catch (cause) {
        next(cause);
        return;
      }
      if (!conversation) {
        error(response, 404, "NOT_FOUND", "Conversation not found");
        return;
      }

      let reservation;
      try {
        reservation = await options.repository.reserveSubmission(
          request.auth!.userId,
          workspaceId.data,
          conversationId.data,
          body.data.submissionId,
          body.data.question,
        );
      } catch (cause) {
        if (cause instanceof ConversationRepositoryError && repositoryError(response, cause)) {
          return;
        }
        next(cause);
        return;
      }
      if (!reservation) {
        error(response, 404, "NOT_FOUND", "Conversation not found");
        return;
      }
      if (reservation.state === "completed") {
        response.status(200).json({
          status: responseStatus(reservation.turn),
          turn: reservation.turn,
        } satisfies SendConversationMessageResponse);
        return;
      }
      if (reservation.state === "in_progress") {
        error(response, 409, "CONFLICT", "Submission is already in progress");
        return;
      }
      const reservationToken = reservation.token;
      const releaseReservation = async () => {
        try {
          await options.repository.releaseSubmission(reservationToken);
        } catch {
          // Preserve the primary safe response; the short lease permits recovery.
        }
      };

      let answer;
      try {
        answer = await options.retrievalRepository.withAuthorizedScope(
          request.auth!.userId,
          workspaceId.data,
          conversation.scope,
          async (search) => {
            let embedding: number[];
            try {
              const values = await options.embeddingProvider.embed([body.data.question]);
              const candidate = values.length === 1 ? values[0] : undefined;
              if (!validEmbedding(candidate, options.embeddingProvider.dimensions)) {
                throw new Error("Invalid embedding response");
              }
              embedding = candidate;
            } catch {
              throw new GroundedProviderUnavailableError();
            }
            const results = await search(
              embedding,
              options.embeddingProvider.model,
              body.data.topK,
            );
            try {
              return await options.answerService.answer(body.data.question, results);
            } catch {
              throw new GroundedProviderUnavailableError();
            }
          },
        );
      } catch (cause) {
        if (
          cause instanceof GroundedProviderUnavailableError
        ) {
          await releaseReservation();
          error(
            response,
            503,
            "INTERNAL_ERROR",
            "Grounded answers are temporarily unavailable",
          );
          return;
        }
        await releaseReservation();
        next(cause);
        return;
      }
      if (answer === null) {
        await releaseReservation();
        error(response, 404, "NOT_FOUND", "Conversation not found");
        return;
      }

      try {
        const turn = await options.repository.appendTurn(request.auth!.userId, {
          workspaceId: workspaceId.data,
          conversationId: conversationId.data,
          submissionId: body.data.submissionId,
          userContent: body.data.question,
          assistantContent: answer.answer,
          model: answer.model,
          sources: answer.citations.map((citation, citationOrdinal) => ({
            chunkId: citation.chunkId,
            documentId: citation.documentId,
            collectionId: citation.collectionId,
            citationOrdinal,
            score: citation.score,
          })),
          reservationToken,
        });
        response.status(201).json({
          status: responseStatus(turn),
          turn,
        } satisfies SendConversationMessageResponse);
      } catch (cause) {
        await releaseReservation();
        if (cause instanceof ConversationRepositoryError && repositoryError(response, cause)) {
          return;
        }
        next(cause);
      }
    },
  );

  return router;
}
