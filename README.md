# Keystone — AI Knowledge Workspace

Keystone is a portfolio-oriented knowledge workspace for organizing source documents and building grounded question-answer workflows. Days 1–4 provide a tested React application, Express API, PostgreSQL persistence, secure sessions, optional Google OAuth, authenticated document ingestion, durable single-filesystem source storage, and pgvector-backed scoped retrieval. Day 5 now includes a provider-neutral, citation-safe grounded-generation core, authorized transactional conversation persistence, authenticated conversation APIs, an API-backed React conversation and citation experience, and deterministic groundedness evaluation.

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

The page layer consumes an asynchronous `KnowledgeRepository` through a provider. It can use immutable typed fixtures or the HTTP adapter without coupling pages to transport details. In API mode, the adapter creates document metadata, uploads the selected bytes, triggers indexing, refreshes durable document status, and performs scoped retrieval. Fixture mode retains its local metadata preview and deterministic mock search. TanStack Query manages repository state, React Router owns direct URLs and browser navigation, and Tailwind provides the responsive visual system.

Key boundaries:

- `apps/web/src/domain` — shared frontend domain contracts
- `apps/web/src/api` — access-token-aware HTTP client and refresh retry
- `apps/web/src/data` — fixture/API repositories, provider, and query keys
- `apps/web/src/auth` — clearly labelled local demo-session boundary
- `apps/web/src/pages` — route-level dashboard, authentication, workspace, collection, document, and fixture/API source-search views
- `apps/web/src/components` — reusable navigation, layout, heading, and state components
- `apps/api/src` — environment validation, Express composition, request correlation, and server startup
- `apps/api/src/auth` — credential hashing, token issuance, refresh rotation, and interchangeable auth repositories
- `apps/api/src/ai` — provider-neutral embedding and text-generation contracts with validated OpenAI-compatible HTTP adapters
- `apps/api/src/answers` — confidence filtering, bounded source context, and exact citation mapping for grounded answers
- `apps/api/src/ingestion` — parser-neutral normalization, deterministic chunking, parsing, authorized upload, and transactional indexing boundaries
- `apps/api/src/retrieval` — membership-scoped query authorization and pgvector similarity search
- `apps/api/src/storage` — provider-neutral object storage with a durable filesystem runtime adapter and an isolated in-memory test adapter
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
| `/app/documents` | Filterable document library with local metadata preview in fixture mode or byte upload and indexing in API mode |
| `/app/documents/:documentId` | Document metadata, ingestion state, and local/API retry controls |
| `/app/knowledge` | Deterministic mock search in fixture mode or scoped semantic source search in API mode |

The configurable API composition also exposes:

| API route | Purpose |
| --- | --- |
| `GET /api/health` | Return dependency-free process liveness for platform restart decisions |
| `GET /api/ready` | Return database-backed readiness for traffic routing, with bounded failure handling |
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
| `POST /api/workspaces/:workspaceId/documents/:documentId/index` | Authorize and synchronously trigger document indexing when ingestion is configured |
| `POST /api/workspaces/:workspaceId/retrieval` | Retrieve active source chunks within a validated workspace, collection, or document scope |
| `POST /api/workspaces/:workspaceId/conversations` | Create a membership-authorized workspace-, collection-, or document-scoped conversation |
| `GET /api/workspaces/:workspaceId/conversations` | List the caller's authorized conversations with a bounded result size |
| `GET /api/workspaces/:workspaceId/conversations/:conversationId` | Return one authorized conversation without revealing inaccessible records |
| `GET /api/workspaces/:workspaceId/conversations/:conversationId/messages` | Page through stable, ordered conversation history |
| `POST /api/workspaces/:workspaceId/conversations/:conversationId/messages` | Embed, retrieve, generate, validate citations, and atomically persist one grounded turn |

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

Before starting, generate a private signing secret (for example, `openssl rand -base64 48`) and assign it to `ACCESS_TOKEN_SECRET`; the example intentionally leaves it blank so a known key cannot start the API. The API applies serialized, idempotent migrations before listening. Vite prints the web URL. `DATABASE_URL` and a 32-character-or-longer `ACCESS_TOKEN_SECRET` are required by the composed API runtime. `OBJECT_STORAGE_DIRECTORY` selects the filesystem root for document bytes and defaults to the ignored `.data/objects` directory. Production deployments must mount that directory on persistent storage, back it up with the database, and restrict write access to the API's operating-system account. The adapter rejects symlinks at the configured root and beneath it, but portable Node.js filesystem operations cannot eliminate a symlink-swap race when an untrusted process can modify the root concurrently. The adapter is durable across process restarts on one filesystem but is not shared object storage for horizontally scaled API instances. `WEB_APP_URL` controls exact-origin credentialed CORS and the post-OAuth redirect; non-local production web and Google callback URLs must use HTTPS.

The web build uses API mode by default. Set `VITE_API_URL` when the API is hosted on another origin. To run the deliberately local, non-networked portfolio preview instead, set `VITE_DATA_MODE=fixture`; this is the only mode that exposes the demo-session control.

Google OAuth remains disabled unless `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `GOOGLE_OAUTH_REDIRECT_URI` are all present. Configure the callback URI in Google to match exactly. The client control is enabled only after API capability discovery confirms complete configuration.

Document indexing and semantic retrieval remain disabled unless `EMBEDDING_API_KEY` is present. When configured, the runtime exposes the synchronous indexing trigger and scoped retrieval route. The optional `EMBEDDING_ENDPOINT`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, and `EMBEDDING_TIMEOUT_MS` values default to the OpenAI-compatible endpoint, `text-embedding-3-small`, the schema's required 1,536 dimensions, and a 15-second request timeout. Retrieval compares only active indexes produced by the configured model. Public production endpoints must use HTTPS. No provider credential is committed, and no live embedding-provider call is claimed.

Grounded conversation routes require both `EMBEDDING_API_KEY` and `GENERATION_API_KEY`. The optional generation endpoint, model, and timeout default to the OpenAI-compatible chat-completions endpoint, `gpt-4.1-mini`, and 30 seconds. Public production endpoints must use HTTPS. The API authorizes the conversation before embedding, holds scope authorization through retrieval and generation, validates provider citations against retrieved stored chunks, and persists each user/assistant turn atomically. Short-lived database reservations prevent concurrent retries from duplicating provider work; completed retries return their stored turn. Missing or low-confidence context is persisted as a deterministic insufficient-context answer without calling the generation provider.

Provider-backed chat sends the user's question to the configured embedding endpoint. When retrieval meets the default `0.7` similarity threshold, it sends the question plus at most eight retrieved source passages, bounded to 24,000 source characters in aggregate, to the configured generation endpoint. Those passages can contain private workspace document text. Operators must therefore choose providers whose privacy, regional-processing, logging, and retention terms are acceptable for their data, configure HTTPS endpoints, and avoid enabling provider-backed chat for content that must not leave the service. Keystone does not control or erase copies retained by an external provider.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run evaluate:grounded:fixtures
npm run build
```

With PostgreSQL 16 plus pgvector available through `TEST_DATABASE_URL`, run `npm run evaluate:grounded` for the full grounded-answer acceptance suite. The command deliberately fails when that database is absent so authorization-lock cases cannot be silently skipped; CI runs it explicitly.

Verification covers fixture and API repositories, protected routing, session restoration, real credential forms, refresh retry, logout, responsive shell, dashboards, workspace/collection/document navigation, metadata validation, ingestion simulation, PDF/TXT/Markdown/DOCX textual extraction, PDF page and DOCX heading provenance, Markdown heading and fence handling, empty and malformed binary documents, content-free parser errors, deterministic text normalization and chunk windows, authorized byte uploads, authenticated indexing triggers, read-only and non-member isolation, byte/MIME limits, duplicate protection, immutable object snapshots, restart-persistent filesystem reads, content-type persistence, exclusive concurrent writes, temporary-artifact cleanup, symlinked-path rejection, embedding and generation request/response validation, zero-vector rejection, bounded request-and-body timeouts, safe provider failures, streamed batch staging, atomic index activation and replacement, prior-index preservation, activation rollback, overlapping activation serialization, concurrent failure recovery, workspace/collection/document semantic scopes, authorization before embedding and inside vector queries, active-index and embedding-model filtering, top-k cosine ordering, low-confidence generation refusal, bounded untrusted source prompts, citation allow-listing, provider-neutral answer validation, stored-chunk deduplication, exact retrieved-source mapping, ordered and paginated conversation history, immutable scope-bound chunk citations, citation retention across re-indexing, conversation lifecycle cascades, transactional conversation creation and turn persistence, submission idempotency, authorization-revocation locking, exact source revalidation, authenticated conversation lifecycle and message routes, runtime provider composition, API-backed conversation creation, history, answer retries, exact citation presentation, route-state isolation, scope-loading safeguards, deterministic supported/conflicting/injected/unsupported/empty/low-similarity evaluation through the production provider boundary, provider-failure recovery, transactional citation rejection, normalized storage failures, API-mode ingestion refresh/retry, scoped semantic source navigation, fixture-mode mock search, API contracts, HTTP error handling, migration idempotency, relational and vector-dimension constraints, active-index uniqueness, scoped chunk references, cascading deletion, password hashing, signed bearer tokens, refresh-cookie rotation/replay handling, Google OAuth state and PKCE handling, external-identity persistence, membership authorization, cross-workspace isolation, and recovery states. The Task 6 tree passes 329 locally runnable tests and all 338 tests, including required PostgreSQL/pgvector acceptance, in [GitHub Actions run #123](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34310958194) at implementation commit `d009b37480ecc6f1cda910f04d9c44f51013df52`. The deterministic negative control flags an unsupported answer with a valid citation, so this suite does not claim general semantic entailment enforcement or live-model quality.

## Honest limitations

In API mode, Day 4 creates document metadata, uploads the actual selected bytes with the validated media type, textually extracts PDF, TXT, Markdown, and DOCX sources, synchronously triggers indexing, refreshes durable ingestion metadata, and retries failed ingestion through the same indexing path. PDF page provenance and DOCX heading provenance are preserved where the source format exposes them. Scanned or image-only PDFs require OCR, which is not implemented, and therefore return the safe empty-document result. Source bytes survive API process restarts when `OBJECT_STORAGE_DIRECTORY` is retained; multi-instance deployments still require a shared object-store implementation. Day 5's generation core, schema, repository, authenticated HTTP API, runtime composition, and React conversation interface are implemented. No provider credential, live provider call, or model-quality claim is made. Fixture mode remains a local metadata simulation with deterministic mock answers and non-citation labels; grounded conversations explicitly require API mode. The project does not provide a deployment. Google OAuth code is complete but no live provider credentials are committed or claimed. API mode keeps access tokens in memory and relies on the HTTP-only refresh cookie.

## Roadmap

1. **Day 1 — complete:** React/TypeScript shell, demo auth boundary, dashboard, workspaces, collections, tests, and CI
2. **Day 2 — complete:** document library, validated local metadata preview, simulated ingestion states, retry flows, and scoped mock knowledge search
3. **Day 3 — complete:** Express API, PostgreSQL, email/password authentication, optional Google OAuth boundary, authorized metadata persistence, and frontend API integration
4. **Day 4 — complete:** normalization/chunking, PDF/TXT/Markdown/DOCX textual extraction, authorized durable filesystem byte storage, pgvector schema, provider-neutral transactional indexing, authenticated indexing/retry UI, and scoped semantic source search
5. **Day 5 — complete:** provider-neutral grounded generation, server-validated citations, conversation history, low-confidence behavior, explicit external-provider data-flow documentation, and deterministic groundedness evaluation
6. **Day 6 — in progress:** CI-verified operational readiness and structured observability, followed by production containers, end-to-end coverage, deployment guidance, and final polish

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current handoff state.
