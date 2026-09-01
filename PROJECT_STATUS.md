# Project status

## Current milestone

**Day 3 — API, authentication, and persistence: in progress**

Day 1 was merged into `main` through [pull request #2](https://github.com/megamind294/knowledge-ai-workspace/pull/2). Day 2 was merged through [pull request #4](https://github.com/megamind294/knowledge-ai-workspace/pull/4) after clean local acceptance and GitHub Actions verification.

## Day 2 completed scope

- pure validation for PDF, TXT, Markdown, and DOCX metadata
- extension/MIME consistency checks and a 10 MiB local-preview limit
- explicit empty-file, unsupported-format, size, and workspace errors
- isolated mutable fixture repository factory with defensive snapshots
- document detail lookup and deterministic local document creation
- simulated `uploaded` creation and failed-to-processing retry transitions
- repository-backed workspace, collection, dashboard, and ingestion-count updates
- direct-linkable document library and document detail routes
- ingestion-status filtering with accessible status labels
- explicit loading, empty, failure, filter-empty, and not-found states
- failed-document retry controls with query-cache synchronization
- accessible native file selection with workspace-scoped collection targeting
- inline metadata validation for supported format, MIME, size, and workspace rules
- duplicate-submission protection, successful form reset, and library refresh
- explicit local-only messaging before and after preview creation
- direct-linkable mock knowledge preview with workspace, collection, and document scopes
- deterministic local fixture matching, answer summaries, and source labels
- empty-query handling and document-scope enforcement
- explicit non-AI, non-network, and non-citation messaging
- 54 automated tests passing locally with lint, strict type-check, and build verification

No file bytes are uploaded, parsed, stored, embedded, or sent to an AI provider by this foundation.

## Day 1 verified scope

- npm workspace with reproducible lockfile and Node 20 CI
- responsive desktop/mobile shell and keyboard-accessible navigation
- explicitly labelled local demo session and protected application routes
- honest login and registration previews
- typed, asynchronous fixture repository with immutable consumer snapshots
- repository-backed dashboard and complete UI state handling
- direct workspace and nested collection routes with breadcrumbs
- workspace-scoped collection lookup and recoverable not-found behavior
- 23 automated tests covering repository and critical view/routing contracts
- clean lint, strict type-check, test, and production-build commands

## Explicitly not implemented

- real authentication or account creation
- real document upload, parsing, chunking, or object storage
- database-backed application routes or durable application data
- pgvector
- embeddings, retrieval, AI chat, or citations
- production deployment

These are planned milestones, not hidden or partially implemented features.

## Day 2 verification

- clean `npm ci`
- lint and strict type-check passed
- 54 automated tests passed
- production build passed
- GitHub Actions run #28 passed on the merged pull-request head

## Next milestone

Day 3 now includes:

- a new `apps/api` Express and TypeScript workspace
- runtime-validated shared HTTP contracts in `packages/contracts`
- validated API environment configuration
- a contract-backed `/api/health` endpoint
- caller-preserving or generated request IDs
- normalized 404 and internal-error envelopes without route, query, or exception leakage
- test-safe separation between Express app composition and server startup
- root quality commands covering contracts, API, and web workspaces
- an idempotent, transactional PostgreSQL migration ledger
- relational tables for users, Google identities, refresh sessions, workspaces, memberships, collections, and document metadata
- database constraints for membership roles, unique membership, ownership cascades, and workspace-scoped collection references
- a validated `DATABASE_URL` and `pg` connection-pool boundary
- local migration coverage through an in-memory PostgreSQL adapter and real PostgreSQL 16 verification in CI
- normalized email registration and bcrypt password hashing
- short-lived HS256 access tokens with subject, email, issued-at, and expiry claims
- opaque random refresh credentials stored only as SHA-256 hashes
- atomic refresh rotation, replay-family containment, expiry rejection, and logout revocation
- interchangeable in-memory and PostgreSQL authentication repositories with parity coverage
- strict shared registration, login, public-user, and session response contracts
- configurable register, login, refresh, logout, and current-user HTTP routes
- scoped HTTP-only SameSite refresh cookies with production `Secure` mode
- bearer authentication middleware with signature and expiry verification
- normalized validation, conflict, and unauthorized responses without password or token leakage
- shared runtime contracts for workspace, collection, and document metadata
- membership-authorized workspace, collection, and document list/detail/create routes
- transactional workspace creation with automatic owner membership
- viewer read-only enforcement and non-member resource isolation
- deterministic failed-document retry transitions with conflict protection
- access-token-aware browser API client with one refresh-cookie retry
- real email/password login and registration forms in API mode
- secure session restoration and logout without browser token persistence
- an HTTP `KnowledgeRepository` adapter mapping API contracts into the existing UI domain
- explicitly configured fixture fallback through `VITE_DATA_MODE=fixture`
- a server-controlled Google OAuth adapter with state validation and PKCE
- verified Google-profile mapping into existing or newly created Keystone accounts
- transient HTTP-only OAuth cookies and refresh-session issuance without browser token exposure
- public capability discovery that enables the web Google control only when the API adapter is configured
- normalized provider failures that do not expose response bodies or client secrets
- in-memory and PostgreSQL external-identity parity coverage
- 116 automated tests passing locally across all three workspaces

Next: compose the production server from validated environment configuration, PostgreSQL repositories, authentication services, and API routes. Final Day 3 acceptance, documentation, and merge remain planned work.
