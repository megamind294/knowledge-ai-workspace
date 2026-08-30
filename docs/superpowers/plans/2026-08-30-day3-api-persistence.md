# Keystone Day 3 API and Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Keystone's demo-only boundaries with a tested Express API, PostgreSQL-backed workspace data, secure email/password sessions, a Google OAuth adapter boundary, and an API-backed frontend repository.

**Architecture:** Add `packages/contracts` for runtime-validated HTTP contracts and `apps/api` for Express composition. Keep authentication, persistence, and route handlers behind focused interfaces so tests can use in-memory adapters while production uses PostgreSQL. The web app continues to consume `KnowledgeRepository`; Day 3 adds an HTTP implementation without coupling pages to transport details.

**Tech Stack:** Node.js 20.19+, TypeScript 5.9, Express, Zod, PostgreSQL via `pg`, bcryptjs, JOSE, Vitest, Supertest, React, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`

**Progress:** Task 1 is implemented on `feature/day3-api-foundation`; Tasks 2–8 remain.

## Global Constraints

- Password credentials are hashed; plaintext passwords are never persisted or logged.
- Access tokens are short-lived; refresh credentials are opaque, rotated, hashed at rest, and delivered in HTTP-only cookies.
- Every workspace resource endpoint authorizes against server-side membership data.
- Google sign-in is implemented behind an adapter and remains disabled unless complete server-side configuration is present.
- Document bytes, parsing, embeddings, vector retrieval, AI generation, and citations remain outside Day 3.
- Every HTTP error uses `{ error: { code, message, requestId, details? } }` and never exposes stack traces.

---

### Task 1: Shared contracts and Express foundation

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/eslint.config.js`
- Create: `packages/contracts/src/http.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/http.test.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/eslint.config.js`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/app.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `HealthResponseSchema`, `ApiErrorResponseSchema`, `ApiErrorCode`, `createApp()`, and `loadApiConfig()`.
- Consumes: no earlier Day 3 code.

- [ ] **Step 1: Write failing contract and API tests**

```ts
expect(HealthResponseSchema.parse(response.body)).toEqual({
  status: "ok",
  service: "knowledge-ai-api",
});
expect(ApiErrorResponseSchema.parse(missing.body).error.code).toBe("NOT_FOUND");
expect(missing.headers["x-request-id"]).toBe(missing.body.error.requestId);
```

- [ ] **Step 2: Run focused tests and confirm failures are caused by missing packages and exports**

Run: `npm test --workspace @knowledge-ai/contracts -- --run src/http.test.ts && npm test --workspace @knowledge-ai/api -- --run src/app.test.ts`

- [ ] **Step 3: Implement minimal shared schemas, configuration validation, health route, request IDs, normalized 404 handling, and test-safe app/server separation**

```ts
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("knowledge-ai-api"),
});

export function createApp() {
  const app = express();
  app.get("/api/health", (_request, response) =>
    response.json({ status: "ok", service: "knowledge-ai-api" }),
  );
  return app;
}
```

- [ ] **Step 4: Run contract/API tests, then root lint, type-check, tests, and builds**
- [ ] **Step 5: Commit `feat: establish shared API contracts`**

### Task 2: PostgreSQL schema and migration boundary

**Files:**
- Create: `apps/api/migrations/001_day3_core.sql`
- Create: `apps/api/src/database/pool.ts`
- Create: `apps/api/src/database/migrate.ts`
- Create: `apps/api/src/database/schema.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `loadApiConfig()` from Task 1.
- Produces: `DatabasePool`, `runMigrations(pool)`, and relational tables for users, external identities, refresh sessions, workspaces, members, collections, and document metadata.

- [ ] **Step 1: Add a failing PostgreSQL integration test that runs the migration twice and verifies tables, foreign keys, role checks, unique membership, and cascade behavior**
- [ ] **Step 2: Run the focused test against the CI-compatible PostgreSQL test URL and confirm the migration is absent**
- [ ] **Step 3: Add an idempotent migration ledger and parameterized `pg` pool boundary**
- [ ] **Step 4: Add a PostgreSQL service to CI and run the full root quality pipeline**
- [ ] **Step 5: Commit `feat: add PostgreSQL core schema`**

### Task 3: Secure credential and session services

**Files:**
- Create: `apps/api/src/auth/authTypes.ts`
- Create: `apps/api/src/auth/passwords.ts`
- Create: `apps/api/src/auth/tokens.ts`
- Create: `apps/api/src/auth/authService.ts`
- Create: `apps/api/src/auth/authService.test.ts`
- Create: `apps/api/src/auth/inMemoryAuthRepository.ts`
- Create: `apps/api/src/auth/postgresAuthRepository.ts`

**Interfaces:**
- Produces: `AuthRepository`, `AuthService.register()`, `login()`, `refresh()`, and `logout()` returning public users plus access-token/refresh-token pairs.
- Consumes: PostgreSQL pool and shared error codes.

- [ ] **Step 1: Write failing tests for normalized email uniqueness, password policy, bcrypt verification, invalid credentials, refresh rotation, replay rejection, expiry, and logout revocation**
- [ ] **Step 2: Verify the tests fail because the service is absent**
- [ ] **Step 3: Implement bcrypt password hashing, signed short-lived access tokens, random opaque refresh tokens, SHA-256 refresh hashes, and repository adapters**
- [ ] **Step 4: Run focused and full suites, including PostgreSQL repository parity tests**
- [ ] **Step 5: Commit `feat: add secure authentication sessions`**

### Task 4: Authentication HTTP API and authorization middleware

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/auth/authRouter.ts`
- Create: `apps/api/src/auth/requireAuth.ts`
- Create: `apps/api/src/auth/authRouter.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `GET /api/auth/me`, and `requireAuth` with typed `request.auth.userId`.
- Consumes: `AuthService` and shared request/response schemas.

- [ ] **Step 1: Write failing Supertest cases for registration/login, HTTP-only SameSite refresh cookies, access-token authentication, validation failures, rotation, and logout**
- [ ] **Step 2: Confirm failures are missing-route failures**
- [ ] **Step 3: Implement schema-validated handlers, cookie security by environment, bearer middleware, and normalized auth errors**
- [ ] **Step 4: Run focused and full quality gates**
- [ ] **Step 5: Commit `feat: expose secure authentication API`**

### Task 5: Authorized workspace persistence API

**Files:**
- Create: `packages/contracts/src/knowledge.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/knowledge/knowledgeRepository.ts`
- Create: `apps/api/src/knowledge/postgresKnowledgeRepository.ts`
- Create: `apps/api/src/knowledge/knowledgeRouter.ts`
- Create: `apps/api/src/knowledge/knowledgeRouter.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: authenticated list/detail/create endpoints for workspaces and collections plus list/detail/create/retry metadata endpoints for documents.
- Consumes: `requireAuth`, shared knowledge schemas, and PostgreSQL membership tables.

- [ ] **Step 1: Write failing API tests proving owner/member access, viewer read-only behavior, cross-workspace denial, missing-resource handling, input validation, and deterministic document status transitions**
- [ ] **Step 2: Verify failures come from missing routes**
- [ ] **Step 3: Implement repository queries with membership predicates in every operation and transactionally create owner membership with each workspace**
- [ ] **Step 4: Run API integration and root quality suites**
- [ ] **Step 5: Commit `feat: add authorized workspace API`**

### Task 6: API-backed web authentication and repository adapter

**Files:**
- Create: `apps/web/src/api/apiClient.ts`
- Create: `apps/web/src/auth/apiSession.tsx`
- Create: `apps/web/src/data/apiKnowledgeRepository.ts`
- Create: `apps/web/src/data/apiKnowledgeRepository.test.ts`
- Modify: `apps/web/src/auth/DemoSessionProvider.tsx`
- Modify: `apps/web/src/pages/auth/LoginPage.tsx`
- Modify: `apps/web/src/pages/auth/RegisterPage.tsx`
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Produces: access-token-aware API client with one refresh retry, real email/password forms, and a `KnowledgeRepository` HTTP adapter.
- Consumes: Task 4 auth contracts and Task 5 knowledge contracts.

- [ ] **Step 1: Write failing frontend tests for login/register validation, session restoration, refresh retry, logout, API error display, and repository response mapping**
- [ ] **Step 2: Confirm failures are caused by the demo-only provider and missing adapter**
- [ ] **Step 3: Implement the API client and preserve an explicitly labelled fixture mode only when `VITE_DATA_MODE=fixture`**
- [ ] **Step 4: Run frontend and root quality gates**
- [ ] **Step 5: Commit `feat: connect web app to authenticated API`**

### Task 7: Google OAuth adapter boundary

**Files:**
- Create: `packages/contracts/src/oauth.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `apps/api/src/auth/googleOAuth.ts`
- Create: `apps/api/src/auth/googleOAuth.test.ts`
- Modify: `apps/api/src/auth/authRouter.ts`
- Modify: `apps/web/src/pages/auth/LoginPage.tsx`

**Interfaces:**
- Produces: server-controlled authorization start/callback flow with state verification and an `OAuthIdentity` mapped through `AuthService`.
- Consumes: configured Google issuer/client credentials and Task 3 session issuance.

- [ ] **Step 1: Write failing tests for disabled configuration, generated state, state mismatch, callback identity mapping, and provider errors without secret leakage**
- [ ] **Step 2: Verify failures are caused by the missing adapter**
- [ ] **Step 3: Implement the adapter and enable the web control only when API capability discovery reports Google configured**
- [ ] **Step 4: Run focused and complete quality gates**
- [ ] **Step 5: Commit `feat: add Google OAuth boundary`**

### Task 8: Day 3 acceptance and integration

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-08-30-day3-api-persistence.md`
- Create: `.env.example`

**Interfaces:**
- Consumes: all Day 3 deliverables.
- Produces: truthful setup, migration, authentication, API, limitation, and verification documentation.

- [ ] **Step 1: Document only merged behavior, required environment variables, local PostgreSQL setup, and the explicit Day 4/5 exclusions**
- [ ] **Step 2: Run clean install, lint, strict type-check, all tests, all builds, migration tests, and `git diff --check`**
- [ ] **Step 3: Review for secrets, permissive authorization, unsafe cookies, generated files, placeholders, and unsupported claims**
- [ ] **Step 4: Commit `docs: complete Day 3 API milestone`**
- [ ] **Step 5: Confirm GitHub Actions passes on the exact final head and merge the Day 3 pull request**

## Plan self-review

- Tasks cover the approved Day 3 API, relational persistence, email/password authentication, Google OAuth boundary, authorization, and frontend adapter.
- API contracts, names, and dependency direction are consistent across tasks.
- Every production behavior starts with a focused failing test.
- No task claims document-byte storage, parsing, pgvector retrieval, AI output, or citations before their planned milestones.
