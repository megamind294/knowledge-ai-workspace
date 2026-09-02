# Project status

## Current milestone

**Day 4 — document ingestion and retrieval: in progress**

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

## Explicitly not implemented in the current Day 4 slice

- durable object storage or externally triggered ingestion processing
- concrete PDF and DOCX parser adapters
- scoped pgvector retrieval, AI chat, or citations
- production deployment

These are planned milestones, not hidden or partially implemented features.

## Day 2 verification

- clean `npm ci`
- lint and strict type-check passed
- 54 automated tests passed
- production build passed
- GitHub Actions run #28 passed on the merged pull-request head

## Day 3 completed scope

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
- production runtime composition with startup migrations and graceful pool shutdown
- exact-origin credentialed CORS and HTTPS enforcement for public production origins
- complete-or-disabled Google environment validation
- a reproducible environment template without committed credentials
- 125 automated tests across all three workspaces

## Day 3 verification

- clean `npm ci`
- lint and strict type-check passed across all workspaces
- 125 automated tests passed
- API, contracts, and web production builds passed
- production dependency audit reported zero vulnerabilities
- final security review found no unresolved critical or important issues

## Day 4 completed scope

- parser-neutral extracted-section, normalized-section, and chunk-draft contracts
- Unicode NFC and line-ending normalization
- horizontal-whitespace cleanup with paragraph boundary preservation
- deterministic overlapping word windows with stable global ordinals
- page-number and section-heading provenance retained on every chunk draft
- explicit rejection of invalid chunk-size and overlap options
- strict UTF-8 decoding that rejects malformed text instead of inserting replacement characters
- plain-text extraction and Markdown section extraction with heading provenance
- fenced Markdown handling that prevents code headings from splitting source sections
- binary-parser injection boundaries with normalized output and content-free failures
- explicit unavailable-parser behavior for PDF and DOCX until their libraries are installed
- membership-authorized document-byte upload with owner/admin/member write enforcement
- non-member resource isolation before request-body acceptance
- bounded raw-body parsing with MIME and metadata-size consistency checks
- server-generated object keys with path-traversal rejection
- duplicate-submission protection and immutable stored-byte snapshots
- process-local in-memory put/get/delete behavior behind an injected `ObjectStore`
- content-free upload and storage error responses
- a pgvector-enabled migration with document index-run and chunk relations
- one-active-run enforcement, fixed vector dimensions, stable chunk ordinals, and workspace-scoped foreign keys
- cascading chunk cleanup and an HNSW cosine-distance index prepared for scoped retrieval
- transactional active-index replacement coverage
- lint, strict type-check, all tests, and all production builds passing locally
- real pgvector-enabled PostgreSQL 16 verification passing in GitHub Actions
- provider-neutral embedding contracts and an OpenAI-compatible HTTP adapter
- validated embedding counts, dimensions, finite values, non-zero cosine vectors, and response ordering
- normalized provider failures without upstream response-body or credential leakage
- configurable embedding endpoint, model, timeout, and fixed 1,536-dimension schema contract
- bounded embedding batches staged incrementally before a short activation transaction
- membership authorization before index-run creation
- safe failed-run recording, staged-chunk cleanup, and preservation of a prior active index
- document-locked activation and failure recovery with rollback and concurrency coverage on PostgreSQL
- 58 focused Day 4 tests, bringing the CI project total to 187 automated tests

## Next milestone

Tasks 1, 3, 4, and 5 are complete, including all 187 tests on pgvector-enabled PostgreSQL 16 in [GitHub Actions run #64](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/33658892635). Task 3's authorized upload boundary uses an explicitly non-durable in-memory adapter. Task 2 still needs concrete PDF/DOCX dependencies; durable storage, an ingestion HTTP trigger, scoped semantic retrieval, and frontend integration remain.
