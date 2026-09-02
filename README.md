# Keystone — AI Knowledge Workspace

Keystone is a portfolio-oriented knowledge workspace for organizing source documents and, in later milestones, asking grounded questions with citations. Days 1–3 provide a tested React application, Express API, PostgreSQL persistence, secure sessions, and an optional Google OAuth boundary. Day 4 ingestion and retrieval work is now underway.

## Day 1 capabilities

- Responsive authenticated application shell with desktop and mobile navigation
- Explicitly labelled local demo session with protected routes and sign-out
- Accessible login and registration screens with fixture and API modes
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

The page layer consumes an asynchronous `KnowledgeRepository` through a provider. It can use immutable typed fixtures or the Day 3 HTTP adapter without coupling pages to transport details. TanStack Query manages repository state, React Router owns direct URLs and browser navigation, and Tailwind provides the responsive visual system.

Key boundaries:

- `apps/web/src/domain` — shared frontend domain contracts
- `apps/web/src/api` — access-token-aware HTTP client and refresh retry
- `apps/web/src/data` — fixture/API repositories, provider, and query keys
- `apps/web/src/auth` — clearly labelled local demo-session boundary
- `apps/web/src/pages` — route-level dashboard, authentication, workspace, collection, document, and mock knowledge views
- `apps/web/src/components` — reusable navigation, layout, heading, and state components
- `apps/api/src` — environment validation, Express composition, request correlation, and server startup
- `apps/api/src/auth` — credential hashing, token issuance, refresh rotation, and interchangeable auth repositories
- `apps/api/src/ai` — provider-neutral embedding contracts and a validated OpenAI-compatible HTTP adapter
- `apps/api/src/ingestion` — parser-neutral normalization, deterministic chunking, parsing, authorized upload, and transactional indexing boundaries
- `apps/api/src/retrieval` — membership-scoped query authorization and pgvector similarity search
- `apps/api/src/storage` — provider-neutral object storage with an in-memory Day 4 development adapter
- `apps/api/migrations` — versioned PostgreSQL and pgvector schema migrations
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
| `GET /api/auth/capabilities` | Report whether Google OAuth is fully configured |
| `GET /api/auth/google/start` | Begin the state- and PKCE-protected Google flow |
| `GET /api/auth/google/callback` | Exchange a verified callback and create a Keystone session |
| `/api/workspaces/*` | Membership-authorized workspace, collection, and document metadata APIs |
| `POST /api/workspaces/:workspaceId/documents/:documentId/content` | Validate and retain authorized source bytes through the injected object store |
| `POST /api/workspaces/:workspaceId/retrieval` | Retrieve active source chunks within a validated workspace, collection, or document scope |

Routes below `/app` require the selected session provider: a local marker in explicit fixture mode or the authenticated API session in default API mode. Unknown entities render recoverable not-found states, while unknown application URLs use the global 404 page.

## Run locally

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer
- PostgreSQL 16 or newer with the pgvector extension available

```bash
npm ci
cp .env.example .env
```

Create the database named by `DATABASE_URL`, then export the API values from `.env` in your shell and start both processes:

```bash
# Terminal 1
set -a
. ./.env
set +a
npm run dev:api

# Terminal 2
set -a
. ./.env
set +a
npm run dev
```

Before starting, generate a private signing secret (for example, `openssl rand -base64 48`) and assign it to `ACCESS_TOKEN_SECRET`; the example intentionally leaves it blank so a known key cannot start the API. The API applies serialized, idempotent migrations before listening. Vite prints the web URL. `DATABASE_URL` and a 32-character-or-longer `ACCESS_TOKEN_SECRET` are required by the composed API runtime. `WEB_APP_URL` controls exact-origin credentialed CORS and the post-OAuth redirect; non-local production web and Google callback URLs must use HTTPS.

The web build uses API mode by default. Set `VITE_API_URL` when the API is hosted on another origin. To run the deliberately local, non-networked portfolio preview instead, set `VITE_DATA_MODE=fixture`; this is the only mode that exposes the demo-session control.

Google OAuth remains disabled unless `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` are all present. Configure the callback URI in Google to match exactly. The client control is enabled only after API capability discovery confirms complete configuration.

Document embedding and semantic retrieval remain disabled unless `EMBEDDING_API_KEY` is present. The optional `EMBEDDING_ENDPOINT`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, and `EMBEDDING_TIMEOUT_MS` values default to the OpenAI-compatible endpoint, `text-embedding-3-small`, the schema's required 1,536 dimensions, and a 15-second request timeout. Retrieval compares only active indexes produced by the configured model. Public production endpoints must use HTTPS. No provider credential is committed, and the indexing service is not exposed through an HTTP route yet.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Verification covers fixture and API repositories, protected routing, session restoration, real credential forms, refresh retry, logout, responsive shell, dashboards, workspace/collection/document navigation, metadata validation, ingestion simulation, strict TXT/Markdown extraction, Markdown heading and fence handling, content-free parser errors, deterministic text normalization and chunk windows, authorized byte uploads, read-only and non-member isolation, byte/MIME limits, duplicate protection, immutable object snapshots, embedding request/response validation, zero-vector rejection, bounded request-and-body timeouts, safe provider failures, streamed batch staging, atomic index activation and replacement, prior-index preservation, activation rollback, overlapping activation serialization, concurrent failure recovery, workspace/collection/document semantic scopes, authorization before embedding and inside vector queries, active-index and embedding-model filtering, top-k cosine ordering, retry behavior, scoped mock search, API contracts, HTTP error handling, migration idempotency, relational and vector-dimension constraints, active-index uniqueness, scoped chunk references, cascading deletion, password hashing, signed bearer tokens, refresh-cookie rotation/replay handling, Google OAuth state and PKCE handling, provider-failure normalization, external-identity persistence, membership authorization, cross-workspace isolation, and recovery states. GitHub Actions runs a clean install and every command above against a pgvector-enabled PostgreSQL 16 service for feature branches and pull requests; local tests use a PostgreSQL-compatible in-memory adapter when `TEST_DATABASE_URL` is absent.

## Honest limitations

Day 4 can accept membership-authorized document bytes, internally index supported stored text, and retrieve active source chunks within authenticated workspace, collection, or document scopes through a configured embedding provider. The composed runtime still uses the injected in-memory object-store adapter, so bytes are process-local and lost on restart; this is not durable production storage. The ingestion service is an internal boundary only—no HTTP route or frontend workflow triggers it yet—and concrete PDF/DOCX libraries are not installed. No embedding credential or live provider call is claimed. Retrieval returns source chunks and similarity scores; it does **not** generate AI answers or citations. The application does not yet persist conversations or provide a deployment. Google OAuth code is complete but no live provider credentials are committed or claimed. Fixture mode stores only a fixed marker in browser LocalStorage; API mode keeps access tokens in memory and relies on the HTTP-only refresh cookie.

## Roadmap

1. **Day 1 — complete:** React/TypeScript shell, demo auth boundary, dashboard, workspaces, collections, tests, and CI
2. **Day 2 — complete:** document library, validated local metadata preview, simulated ingestion states, retry flows, and scoped mock knowledge search
3. **Day 3 — complete:** Express API, PostgreSQL, email/password authentication, optional Google OAuth boundary, authorized metadata persistence, and frontend API integration
4. **Day 4 — in progress:** normalization/chunking, TXT/Markdown parsing, authorized process-local byte storage, pgvector schema, provider-neutral transactional indexing, and scoped semantic retrieval, followed by PDF/DOCX adapters, durable storage, ingestion triggers, and frontend integration
5. **Day 5:** grounded chat, citations, conversation history, and low-confidence behavior
6. **Day 6:** end-to-end coverage, Docker, deployment, operations documentation, and final polish

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current handoff state.
