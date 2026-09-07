import { randomUUID } from "node:crypto";
import type { ApiErrorResponse, HealthResponse } from "@knowledge-ai/contracts";
import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";
import { createAuthRouter } from "./auth/authRouter.js";
import type { AuthService } from "./auth/authService.js";
import type { GoogleOAuthAdapter } from "./auth/googleOAuth.js";
import { createUploadRouter } from "./ingestion/uploadRouter.js";
import { createIndexingRouter } from "./ingestion/indexingRouter.js";
import type { IngestionService } from "./ingestion/ingestionService.js";
import { createKnowledgeRouter } from "./knowledge/knowledgeRouter.js";
import type { KnowledgeRepository } from "./knowledge/knowledgeRepository.js";
import type { ObjectStore } from "./storage/objectStore.js";
import type { EmbeddingProvider } from "./ai/embeddingProvider.js";
import { createRetrievalRouter } from "./retrieval/retrievalRouter.js";
import type { RetrievalRepository } from "./retrieval/retrievalRepository.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function resolveRequestId(value: string | undefined) {
  return value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

interface CreateAppOptions {
  corsOrigin?: string;
  auth?: {
    service: AuthService;
    accessTokenSecret: Uint8Array;
    secureCookies: boolean;
    googleOAuth?: {adapter:GoogleOAuthAdapter;frontendRedirectUrl:string};
  };
  knowledge?: {
    repository: KnowledgeRepository;
    accessTokenSecret: Uint8Array;
  };
  upload?: {
    repository: KnowledgeRepository;
    objectStore: ObjectStore;
    accessTokenSecret: Uint8Array;
    maxBytes?: number;
  };
  indexing?: {
    service: Pick<IngestionService, "indexDocument">;
    accessTokenSecret: Uint8Array;
  };
  retrieval?: {
    repository: RetrievalRepository;
    embeddingProvider: EmbeddingProvider;
    accessTokenSecret: Uint8Array;
  };
  registerRoutes?: (app: Express) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
  const corsOrigin = options.corsOrigin;
  if (corsOrigin) {
    app.use((request, response, next) => {
      if (request.header("origin") === corsOrigin) {
        response.setHeader("access-control-allow-origin", corsOrigin);
        response.setHeader("access-control-allow-credentials", "true");
        response.setHeader("vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        response.setHeader("access-control-allow-headers", "authorization, content-type");
        response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
        response.status(204).send();
        return;
      }
      next();
    });
  }
  app.use(express.json({ limit: "1mb" }));
  app.use((request, response, next) => {
    const requestId = resolveRequestId(request.header("x-request-id"));
    response.locals.requestId = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });

  app.get("/api/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "knowledge-ai-api",
    };
    response.json(body);
  });

  if (options.auth) {
    app.use("/api/auth", createAuthRouter(options.auth));
  }
  if (options.upload) {
    app.use("/api", createUploadRouter(options.upload));
  }
  if (options.indexing) {
    app.use("/api", createIndexingRouter(options.indexing));
  }
  if (options.knowledge) {
    app.use("/api", createKnowledgeRouter(options.knowledge));
  }
  if (options.retrieval) {
    app.use("/api", createRetrievalRouter(options.retrieval));
  }

  options.registerRoutes?.(app);

  app.use((_request, response) => {
    const body: ApiErrorResponse = {
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: response.locals.requestId as string,
      },
    };
    response.status(404).json(body);
  });

  const handleError: ErrorRequestHandler = (_error, _request, response, next) => {
    void next;
    const body: ApiErrorResponse = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: (response.locals.requestId as string | undefined) ?? randomUUID(),
      },
    };
    response.status(500).json(body);
  };
  app.use(handleError);

  return app;
}
