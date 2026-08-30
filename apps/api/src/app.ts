import { randomUUID } from "node:crypto";
import type { ApiErrorResponse, HealthResponse } from "@knowledge-ai/contracts";
import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

function resolveRequestId(value: string | undefined) {
  return value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}

interface CreateAppOptions {
  registerRoutes?: (app: Express) => void;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  app.disable("x-powered-by");
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
