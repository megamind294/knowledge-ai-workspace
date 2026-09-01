import { createApp } from "./app.js";
import { AuthService } from "./auth/authService.js";
import { GoogleOAuthAdapter } from "./auth/googleOAuth.js";
import { PostgresAuthRepository } from "./auth/postgresAuthRepository.js";
import type { ApiConfig } from "./config.js";
import { runMigrations } from "./database/migrate.js";
import { createDatabasePool, type DatabasePool } from "./database/pool.js";
import { PostgresKnowledgeRepository } from "./knowledge/postgresKnowledgeRepository.js";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USER_INFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

interface RuntimeOptions {
  pool?: DatabasePool;
}

export async function createApiRuntime(
  config: ApiConfig,
  options: RuntimeOptions = {},
) {
  if (!config.databaseUrl || !config.accessTokenSecret) {
    throw new Error("DATABASE_URL and ACCESS_TOKEN_SECRET are required");
  }

  const pool = options.pool ?? createDatabasePool(config);
  await runMigrations(pool);

  const accessTokenSecret = new TextEncoder().encode(config.accessTokenSecret);
  const authService = new AuthService({
    repository: new PostgresAuthRepository(pool),
    accessTokenSecret,
  });
  const googleOAuth = new GoogleOAuthAdapter(
    config.googleOAuth
      ? {
          ...config.googleOAuth,
          authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
          tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
          userInfoEndpoint: GOOGLE_USER_INFO_ENDPOINT,
        }
      : null,
  );
  const webAppUrl = new URL(config.webAppUrl);

  return {
    app: createApp({
      auth: {
        service: authService,
        accessTokenSecret,
        secureCookies: config.nodeEnv === "production",
        googleOAuth: config.googleOAuth
          ? {
              adapter: googleOAuth,
              frontendRedirectUrl: new URL("/app", webAppUrl).toString(),
            }
          : undefined,
      },
      corsOrigin: webAppUrl.origin,
      knowledge: {
        repository: new PostgresKnowledgeRepository(pool),
        accessTokenSecret,
      },
    }),
    close: () => pool.end(),
    pool,
  };
}
