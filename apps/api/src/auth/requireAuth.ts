import type { ApiErrorResponse } from "@knowledge-ai/contracts";
import type { RequestHandler } from "express";
import { verifyAccessToken, type AccessTokenClaims } from "./tokens.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AccessTokenClaims;
  }
}

function unauthorized(requestId: string): ApiErrorResponse {
  return {
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required",
      requestId,
    },
  };
}

export function requireAuth(accessTokenSecret: Uint8Array): RequestHandler {
  return async (request, response, next) => {
    const authorization = request.header("authorization");
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!match?.[1]) {
      response.status(401).json(unauthorized(response.locals.requestId as string));
      return;
    }

    try {
      request.auth = await verifyAccessToken(match[1], accessTokenSecret);
      next();
    } catch {
      response.status(401).json(unauthorized(response.locals.requestId as string));
    }
  };
}
