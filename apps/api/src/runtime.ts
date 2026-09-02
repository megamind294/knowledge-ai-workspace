import { createApp } from "./app.js";
import { OpenAiEmbeddingProvider } from "./ai/openAiEmbeddingProvider.js";
import { AuthService } from "./auth/authService.js";
import { GoogleOAuthAdapter } from "./auth/googleOAuth.js";
import { PostgresAuthRepository } from "./auth/postgresAuthRepository.js";
import type { ApiConfig } from "./config.js";
import { runMigrations } from "./database/migrate.js";
import { createDatabasePool, type DatabasePool } from "./database/pool.js";
import { DocumentParser } from "./ingestion/documentParser.js";
import { IngestionService } from "./ingestion/ingestionService.js";
import { PostgresIngestionRepository } from "./ingestion/postgresIngestionRepository.js";
import { PostgresKnowledgeRepository } from "./knowledge/postgresKnowledgeRepository.js";
import { PostgresRetrievalRepository } from "./retrieval/postgresRetrievalRepository.js";
import { InMemoryObjectStore } from "./storage/inMemoryObjectStore.js";

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
  const knowledgeRepository = new PostgresKnowledgeRepository(pool);
  const objectStore = new InMemoryObjectStore();
  const embeddingProvider = config.embedding
    ? new OpenAiEmbeddingProvider(config.embedding)
    : null;
  const ingestionService = embeddingProvider
    ? new IngestionService({
        repository: new PostgresIngestionRepository(pool),
        objectStore,
        parser: new DocumentParser(),
        embeddingProvider,
      })
    : null;

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
        repository: knowledgeRepository,
        accessTokenSecret,
      },
      upload: {
        repository: knowledgeRepository,
        objectStore,
        accessTokenSecret,
      },
      retrieval: embeddingProvider
        ? {
            repository: new PostgresRetrievalRepository(pool),
            embeddingProvider,
            accessTokenSecret,
          }
        : undefined,
    }),
    close: () => pool.end(),
    ingestionService,
    pool,
  };
}
