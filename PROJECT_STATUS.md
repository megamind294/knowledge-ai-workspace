# Project status

## Current milestone

**Day 6 — deployment, operations, observability, and end-to-end hardening ready to start**

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
- lint, strict type-check, all 246 runnable tests, and all production builds passing locally; 7 PostgreSQL integration tests run in CI
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
- 114 focused Day 4 tests, bringing the current local project total to 246 runnable automated tests
- clean-install acceptance, all 246 runnable tests, lint, strict type-checking, production builds, dependency validation, and a zero-vulnerability production audit passing
- exact final implementation-head GitHub Actions verification passed in [run #85](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34111536239) at `56acbe74ed3ab0b96c65ae9f8704c062ae4995cf`
- all 225 runnable tests and complete quality gates passed on the binary-parser implementation head in [GitHub Actions run #77](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/33746802747) at `8065f0ddc5d5a61293438ab1070f2e801df1808a`

## Day 5 completed scope

- a complete seven-task grounded-chat implementation plan
- provider-neutral structured text-generation contracts
- an OpenAI-compatible generation adapter with one deadline spanning request and response-body parsing
- strict response-envelope, JSON, answer, and citation validation
- normalized provider failures without upstream payload, credential, or source-content leakage
- prompts that explicitly treat retrieved chunks as untrusted data rather than instructions
- server-side citation allow-listing against supplied source identifiers
- configurable cosine-similarity rejection with no generation call for missing or low-confidence context
- bounded source count and aggregate source characters
- deterministic source identifiers and exact mapping back to retrieved chunk metadata
- provider-neutral runtime validation for non-empty, bounded answers and well-formed citation lists
- duplicate citation and retrieval-row removal by stored chunk identity
- provider response schemas with unique, source-count-bounded citation identifiers
- PostgreSQL conversations and ordered user/assistant messages with workspace-consistent collection and document scopes
- exact assistant-message-to-chunk source mappings constrained to the conversation scope
- database-triggered source-mapping immutability with stable historical citations across document re-indexing
- cascading conversation cleanup for deleted workspaces, collections, and documents, with deleted authors safely set to null
- supporting foreign-key and conversation-history indexes for lifecycle and pagination paths
- transactional, membership-authorized conversation creation with collection and document scope validation
- atomic ordered user/assistant turn persistence with exact source revalidation inside the write transaction
- idempotent submission retries and conversation-row serialization for concurrent turn writers
- bounded, stable-position history pagination with authorization held through the complete read transaction
- PostgreSQL authorization-revocation and concurrent-submission coverage, plus normalized connection, query, and constraint failures
- shared runtime-validated contracts for conversation creation, listing, history, and message turns
- authenticated create, list, get, history, and message endpoints with bounded input and pagination validation
- conversation authorization before embedding plus retrieval-time scope reauthorization before generation
- runtime composition of OpenAI-compatible embedding and generation providers, pgvector retrieval, citation-safe answering, and atomic conversation persistence
- deterministic insufficient-context turn persistence without a generation-provider call
- short-lived atomic submission reservations that prevent concurrent retries from duplicating provider calls
- leased-transaction retrieval that holds membership and scope authorization through source generation without nested pool acquisition
- normalized provider failures and inaccessible-conversation responses without upstream or cross-workspace leakage
- direct-linkable authenticated conversation list and detail routes in the React application
- workspace-, collection-, and document-scoped conversation creation with scope metadata loading gates
- paginated conversation history with stable position ordering, message-ID deduplication, and recoverable load-more failures
- grounded-answer and insufficient-context presentation with exact stored passages, page/section provenance, and source navigation
- idempotent answer retry controls that preserve the original submission identifier
- route-isolated sent-message state and preservation of a newly typed draft during an in-flight answer
- explicit workspace, collection, document, conversation, history, and generation loading/failure/retry states without internal-error leakage
- explicit fixture-mode separation that makes no AI-provider claim or call
- 62 focused Day 5 tests, bringing the local runnable total to 306 and the full CI total to 315 tests
- clean install, lint, strict type-checking, all 315 tests against PostgreSQL 16 + pgvector, production builds, dependency validation, and zero-vulnerability audit passing in [GitHub Actions run #115](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34252235457) at implementation commit `10a5680bc7b644c0ae9d5b5568812d406e3ffede`
- independent review completed with all important and minor findings resolved before handoff
- 74 focused Day 5 tests, bringing the current local runnable total to 318; the nine PostgreSQL/pgvector-only cases will run in CI
- lint, strict type-checking, all 318 locally runnable tests, production builds, dependency validation, and a zero-vulnerability production audit passing on the reviewed Task 5 tree
- independent Task 5 frontend review completed with no unresolved critical or important findings
- all 327 tests, including nine PostgreSQL/pgvector cases, and the complete quality workflow passing in [GitHub Actions run #119](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34287837062) at implementation commit `a002946e1805e10e5594880b015dc474b10d1260`
- a typed deterministic grounded-answer evaluation corpus covering supported answers, conflicting evidence, prompt-injection source text, unsupported claims, empty retrieval, and low similarity
- a portable `npm run evaluate:grounded:fixtures` check for the production OpenAI-compatible prompt boundary
- a full `npm run evaluate:grounded` acceptance command that requires PostgreSQL, covers transaction and authorization locks, and fails instead of silently skipping without `TEST_DATABASE_URL`
- an explicit valid-citation unsupported-answer negative control that the deterministic benchmark flags, documenting that citation allow-listing alone is not semantic entailment
- API-level generation-failure recovery that verifies safe errors, no partial persistence, and retryable submission release
- safe API mapping plus repository-level transactional citation revalidation that fails closed without exposing cross-scope source details or partially persisting a turn
- 85 focused Day 5 tests, bringing the current local runnable total to 329; the nine PostgreSQL/pgvector-only cases will run in CI
- all 338 tests, including the required PostgreSQL/pgvector grounded-answer acceptance command, passing in [GitHub Actions run #123](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34310958194) at implementation commit `d009b37480ecc6f1cda910f04d9c44f51013df52`
- independent Task 6 review completed with no unresolved critical or important findings
- explicit documentation that provider-backed chat sends the question to the embedding endpoint and can send up to eight retrieved passages / 24,000 source characters to the generation endpoint
- fresh clean-install acceptance passing lint, strict type-checking, all 329 locally runnable tests, groundedness fixtures, production builds, dependency validation, and a zero-vulnerability production audit
- final independent Day 5 review completed with its provider data-flow disclosure finding resolved before merge
- the independently reviewed final documentation tree passing exact-head [GitHub Actions run #127](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34340967297) at commit `4c99bf0144d05fc35020ea07dd911461bbb5506d`

## Next milestone

Day 5 was merged into `main` through [pull request #8](https://github.com/megamind294/knowledge-ai-workspace/pull/8) as `2be317ce5e4ef0e56558520d452353ca1348d611`. The React experience consumes the authenticated conversation API only in API mode; provider-backed routes are composed only when both embedding and generation providers are configured. The deterministic corpus checks system boundaries and detects a controlled unsupported-answer failure; it does not claim live-provider quality or general semantic-groundedness enforcement. Day 6 will add deployment, operations, observability, and end-to-end hardening.
