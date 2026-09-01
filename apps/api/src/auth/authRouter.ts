import {
  LoginRequestSchema,
  RegisterRequestSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
  type AuthSessionResponse,
  type CurrentUserResponse,
  type AuthCapabilitiesResponse,
} from "@knowledge-ai/contracts";
import { Router, type NextFunction, type Request, type Response } from "express";
import { AuthError, type AuthResult, type AuthService } from "./authService.js";
import { requireAuth } from "./requireAuth.js";
import { GoogleOAuthError, type GoogleOAuthAdapter } from "./googleOAuth.js";

const REFRESH_COOKIE = "keystone_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

interface AuthRouterOptions {
  service: AuthService;
  accessTokenSecret: Uint8Array;
  secureCookies: boolean;
  googleOAuth?: {adapter:GoogleOAuthAdapter;frontendRedirectUrl:string};
}
const OAUTH_STATE_COOKIE="keystone_oauth_state"; const OAUTH_VERIFIER_COOKIE="keystone_oauth_verifier"; const OAUTH_COOKIE_PATH="/api/auth/google";

function sendError(
  response: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
) {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      requestId: response.locals.requestId as string,
    },
  };
  response.status(status).json(body);
}

function sessionBody(result: AuthResult): AuthSessionResponse {
  return {
    user: result.user,
    accessToken: result.accessToken,
    refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
  };
}

function setRefreshCookie(
  response: Response,
  result: AuthResult,
  secure: boolean,
) {
  response.cookie(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: REFRESH_COOKIE_PATH,
    expires: result.refreshTokenExpiresAt,
  });
}

function clearRefreshCookie(response: Response, secure: boolean) {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: REFRESH_COOKIE_PATH,
  });
}

function readRefreshCookie(request: Request) {
  return readCookie(request,REFRESH_COOKIE);
}
function readCookie(request:Request,name:string){
  const header = request.header("cookie");
  if (!header) return null;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function handleAuthError(error: unknown, response: Response, next: NextFunction) {
  if (!(error instanceof AuthError)) {
    next(error);
    return;
  }
  switch (error.code) {
    case "WEAK_PASSWORD":
      sendError(response, 400, "BAD_REQUEST", "Password does not meet requirements");
      return;
    case "EMAIL_IN_USE":
      sendError(response, 409, "CONFLICT", "An account already uses this email");
      return;
    case "INVALID_CREDENTIALS":
      sendError(response, 401, "UNAUTHORIZED", "Invalid email or password");
      return;
    case "INVALID_REFRESH_TOKEN":
    case "REFRESH_REPLAYED":
      sendError(response, 401, "UNAUTHORIZED", "Refresh session is invalid");
  }
}

export function createAuthRouter(options: AuthRouterOptions) {
  const router = Router();

  router.get("/capabilities",(_request,response)=>{const body:AuthCapabilitiesResponse={googleOAuth:options.googleOAuth?.adapter.enabled===true};response.json(body);});
  router.get("/google/start",(_request,response)=>{if(!options.googleOAuth?.adapter.enabled){sendError(response,404,"NOT_FOUND","Google authentication is not configured");return;}const start=options.googleOAuth.adapter.createAuthorization();const cookie={httpOnly:true,sameSite:"lax" as const,secure:options.secureCookies,path:OAUTH_COOKIE_PATH,maxAge:10*60*1000};response.cookie(OAUTH_STATE_COOKIE,start.state,cookie);response.cookie(OAUTH_VERIFIER_COOKIE,start.verifier,cookie);response.redirect(start.url);});
  router.get("/google/callback",async(request,response,next)=>{if(!options.googleOAuth?.adapter.enabled){sendError(response,404,"NOT_FOUND","Google authentication is not configured");return;}const code=typeof request.query.code==="string"?request.query.code:null;const state=typeof request.query.state==="string"?request.query.state:null;const expectedState=readCookie(request,OAUTH_STATE_COOKIE);const verifier=readCookie(request,OAUTH_VERIFIER_COOKIE);if(!code||!state||!expectedState||!verifier){sendError(response,400,"BAD_REQUEST","Google authentication state is invalid");return;}try{const identity=await options.googleOAuth.adapter.exchange({code,state,expectedState,verifier});const result=await options.service.loginWithOAuth(identity);setRefreshCookie(response,result,options.secureCookies);response.clearCookie(OAUTH_STATE_COOKIE,{path:OAUTH_COOKIE_PATH});response.clearCookie(OAUTH_VERIFIER_COOKIE,{path:OAUTH_COOKIE_PATH});response.redirect(options.googleOAuth.frontendRedirectUrl);}catch(error){if(error instanceof GoogleOAuthError){sendError(response,error.code==="INVALID_STATE"?400:502,error.code==="INVALID_STATE"?"BAD_REQUEST":"INTERNAL_ERROR",error.message);return;}handleAuthError(error,response,next);}});

  router.post("/register", async (request, response, next) => {
    const parsed = RegisterRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, "BAD_REQUEST", "Invalid registration request");
      return;
    }
    try {
      const result = await options.service.register(parsed.data);
      setRefreshCookie(response, result, options.secureCookies);
      response.status(201).json(sessionBody(result));
    } catch (error) {
      handleAuthError(error, response, next);
    }
  });

  router.post("/login", async (request, response, next) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(response, 400, "BAD_REQUEST", "Invalid login request");
      return;
    }
    try {
      const result = await options.service.login(parsed.data);
      setRefreshCookie(response, result, options.secureCookies);
      response.json(sessionBody(result));
    } catch (error) {
      handleAuthError(error, response, next);
    }
  });

  router.post("/refresh", async (request, response, next) => {
    const refreshToken = readRefreshCookie(request);
    if (!refreshToken) {
      sendError(response, 401, "UNAUTHORIZED", "Refresh session is invalid");
      return;
    }
    try {
      const result = await options.service.refresh(refreshToken);
      setRefreshCookie(response, result, options.secureCookies);
      response.json(sessionBody(result));
    } catch (error) {
      clearRefreshCookie(response, options.secureCookies);
      handleAuthError(error, response, next);
    }
  });

  router.post("/logout", async (request, response, next) => {
    const refreshToken = readRefreshCookie(request);
    try {
      if (refreshToken) await options.service.logout(refreshToken);
      clearRefreshCookie(response, options.secureCookies);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAuth(options.accessTokenSecret), async (request, response, next) => {
    try {
      const user = await options.service.getPublicUser(request.auth!.userId);
      const body: CurrentUserResponse = { user };
      response.json(body);
    } catch (error) {
      handleAuthError(error, response, next);
    }
  });

  return router;
}
