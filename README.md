# Keystone — AI Knowledge Workspace

Keystone is a portfolio-oriented knowledge workspace for organizing source documents and, in later milestones, asking grounded questions with citations. The repository contains the completed Day 1 product shell and Day 2 document experience; Day 3 API development is underway.

## Day 1 capabilities

- Responsive authenticated application shell with desktop and mobile navigation
- Explicitly labelled local demo session with protected routes and sign-out
- Accessible login and registration previews for the Day 3 authentication milestone
- Typed workspace, collection, document, and ingestion-status contracts
- Asynchronous fixture repository behind a replaceable `KnowledgeRepository` interface
- Dashboard metrics and recent items derived from repository data
- Direct-linkable workspace, workspace-detail, and nested collection views
- Breadcrumb navigation and workspace-scoped collection validation
- Loading, populated, empty, failure, retry, and not-found states
- Automated linting, strict type checking, component tests, and production builds in CI

## Day 2 capabilities

- Direct-linkable document library and document detail views
- Accessible filtering across uploaded, processing, indexed, and failed ingestion states
- Validated PDF, TXT, Markdown, and DOCX metadata selection with a 10 MiB limit
- Workspace and collection targeting with extension/MIME consistency checks
- Local fixture document creation, failed-document retry, and synchronized dashboard counts
- Explicit loading, empty, filtered-empty, failure, retry, and not-found states
- Deterministic workspace-, collection-, and document-scoped mock knowledge search
- Mock answer and source labels that are explicitly identified as non-AI and non-citations

## Architecture

This npm workspace currently hosts:

- `apps/web` — the React and TypeScript product experience
- `apps/api` — the Express and TypeScript HTTP service foundation
- `packages/contracts` — runtime-validated request, response, and error contracts

The page layer consumes an asynchronous `KnowledgeRepository` through a provider. Day 1 uses immutable typed fixtures; Day 3 will introduce an HTTP adapter without coupling pages to transport details. TanStack Query manages repository state, React Router owns direct URLs and browser navigation, and Tailwind provides the responsive visual system.

Key boundaries:

- `apps/web/src/domain` — shared frontend domain contracts
- `apps/web/src/data` — fixture repository, provider, and query keys
- `apps/web/src/auth` — clearly labelled local demo-session boundary
- `apps/web/src/pages` — route-level dashboard, authentication, workspace, collection, document, and mock knowledge views
- `apps/web/src/components` — reusable navigation, layout, heading, and state components
- `apps/api/src` — environment validation, Express composition, request correlation, and server startup
- `apps/api/src/auth` — credential hashing, token issuance, refresh rotation, and interchangeable auth repositories
- `apps/api/migrations` — versioned PostgreSQL schema migrations
- `packages/contracts/src` — transport-neutral Zod schemas and inferred TypeScript types

The approved architecture and milestone plan are in [`docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`](docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md) and [`docs/superpowers/plans/2026-08-27-day1-product-shell.md`](docs/superpowers/plans/2026-08-27-day1-product-shell.md).

## Implemented routes

| Route | Purpose |
| --- | --- |
| `/` | Product introduction |
| `/login` | Login and local-demo preview |
| `/register` | Registration preview |
| `/app` | Repository-backed dashboard |
| `/app/workspaces` | Workspace directory |
| `/app/workspaces/:workspaceId` | Workspace collections |
| `/app/workspaces/:workspaceId/collections/:collectionId` | Collection documents |
| `/app/documents` | Filterable document library and local metadata preview |
| `/app/documents/:documentId` | Document metadata, ingestion state, and retry controls |
| `/app/knowledge` | Deterministic scoped mock search and answer preview |

The configurable API composition also exposes:

| API route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Validate registration, create credentials, and start a session |
| `POST /api/auth/login` | Authenticate without revealing which credential failed |
| `POST /api/auth/refresh` | Atomically rotate the HTTP-only refresh credential |
| `POST /api/auth/logout` | Revoke and clear the refresh credential |
| `GET /api/auth/me` | Return the current public user for a valid bearer token |

Routes below `/app` require the local demo session. Unknown entities render recoverable not-found states, while unknown application URLs use the global 404 page.

## Run locally

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer

```bash
npm ci
npm run dev
```

Vite will print the local development URL.

Run the current API foundation separately with:

```bash
npm run dev:api
```

It exposes `GET /api/health` on port `4000` by default. `PORT`, `NODE_ENV`, and an optional PostgreSQL `DATABASE_URL` are validated before startup. The Day 3 database boundary includes an idempotent migration runner and relational schema for users, external identities, refresh sessions, workspaces, memberships, collections, and document metadata. Express composition can now mount authenticated PostgreSQL-backed workspace, collection, and document routes; the default server startup remains intentionally unwired until the Day 3 integration task.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Verification covers the fixture repository, protected routing, authentication preview, responsive shell, dashboards, workspace/collection/document navigation, metadata validation, ingestion simulation, retry behavior, scoped mock search, API contracts, HTTP error handling, migration idempotency, relational constraints, password hashing, signed bearer tokens, refresh-cookie rotation/replay handling, membership authorization, cross-workspace isolation, and recovery states. GitHub Actions runs a clean install and every command above against a real PostgreSQL 16 service for feature branches and pull requests; local tests use a PostgreSQL-compatible in-memory adapter when `TEST_DATABASE_URL` is absent.

## Honest limitations

The backend now has configurable authentication and database-backed knowledge routes, but the default server startup and frontend are not connected to them yet. The app does **not** yet provide live account screens, Google OAuth, file transfer, parsing, durable file storage, vector search, AI calls, citations, or deployment. The new document API persists metadata only. Email/password and Google controls in the web app remain disabled previews. The demo session stores only a fixed marker in browser LocalStorage. File selection reads metadata only; no file bytes leave the browser. Frontend document lifecycle and knowledge results remain deterministic fixtures that reset on reload.

## Roadmap

1. **Day 1 — complete:** React/TypeScript shell, demo auth boundary, dashboard, workspaces, collections, tests, and CI
2. **Day 2 — complete:** document library, validated local metadata preview, simulated ingestion states, retry flows, and scoped mock knowledge search
3. **Day 3:** Express API, PostgreSQL, email/password authentication, Google OAuth boundary, and durable persistence
4. **Day 4:** parsing, chunking, provider embeddings, pgvector storage, and scoped retrieval
5. **Day 5:** grounded chat, citations, conversation history, and low-confidence behavior
6. **Day 6:** end-to-end coverage, Docker, deployment, operations documentation, and final polish

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current handoff state.
