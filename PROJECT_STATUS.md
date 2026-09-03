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

- shared cloud object storage for horizontally scaled API instances; the current durable adapter targets one persistent filesystem
- OCR for scanned or image-only PDFs; those files currently return the safe empty-document result
- generated AI answers or citations
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
- concrete PDF/TXT/Markdown/DOCX textual extraction behind the parser boundary
- one-based PDF page provenance and DOCX heading provenance where available
- safe malformed-binary and empty-document behavior; scanned or image-only PDFs require OCR and return empty
- membership-authorized document-byte upload with owner/admin/member write enforcement
- non-member resource isolation before request-body acceptance
- bounded raw-body parsing with MIME and metadata-size consistency checks
- server-generated object keys with path-traversal rejection
- duplicate-submission protection and immutable stored-byte snapshots
- durable filesystem put/get/delete behavior behind an injected `ObjectStore`, with the in-memory adapter retained for isolated tests
- restart-persistent bytes and content types, defensive read copies, exclusive immutable writes, and temporary-artifact cleanup
- symlink rejection at the configured storage root and every existing object-key component; deployments must keep that root writable only by the API operating-system account
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
- strict shared contracts for workspace, collection, and document retrieval scopes
- membership and scope authorization before embedding-provider calls
- query-time membership enforcement that prevents revocation races from returning chunks
- active-index and configured-embedding-model filtering
- top-k pgvector cosine ordering with stable tie-breaking
- citation-ready source metadata without claiming generated answers or citations
- normalized, content-free provider failures and explicit empty-result behavior
- an authenticated, identifier-validated synchronous HTTP indexing trigger composed only when ingestion is configured
- API-mode metadata creation, actual byte upload with the validated content type, indexing trigger, and durable document-state refresh
- API-mode failed-ingestion retry through real indexing rather than a metadata-only transition
- authenticated workspace-, collection-, and document-scoped semantic source search in the frontend
- explicit retrieval loading, empty, failure, source-passage, score, and document-navigation states
- fixture mode preserved as a local metadata simulation with deterministic mock search
- source chunks and similarity scores presented without generated-answer or citation claims
- 109 focused Day 4 tests, bringing the current local project total to 241 runnable automated tests
- all 241 runnable tests, lint, strict type-checking, production builds, dependency validation, and a zero-vulnerability production audit passing after the durable-storage hardening
- exact implementation-head GitHub Actions verification passed in [run #81](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/33779803133) at `45b69202dcb88d8a4a99ad208251efa89424ff46`
- all 225 runnable tests and complete quality gates passed on the binary-parser implementation head in [GitHub Actions run #77](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/33746802747) at `8065f0ddc5d5a61293438ab1070f2e801df1808a`

## Next milestone

Tasks 1–7 and the durable single-filesystem storage follow-up are complete. All 241 runnable tests and complete pgvector-enabled quality gates passed on the implementation head in [GitHub Actions run #81](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/33779803133) at `45b69202dcb88d8a4a99ad208251efa89424ff46`. API mode now supports real byte upload, restart-persistent filesystem storage, PDF/TXT/Markdown/DOCX textual extraction, a synchronous indexing trigger, durable metadata refresh/retry, and scoped semantic source search; PDF page and DOCX heading provenance are preserved where available, while scanned or image-only PDFs require OCR and return empty. Fixture mode remains local and mock. No live embedding-provider call is claimed. Retrieval returns source chunks and scores rather than generated AI answers or citations. Final clean-install acceptance, deferred-minor cleanup, documentation review, and merge remain.
