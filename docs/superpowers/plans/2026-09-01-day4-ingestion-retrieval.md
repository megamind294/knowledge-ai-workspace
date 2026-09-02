# Keystone Day 4 Ingestion and Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn authorized document metadata into safely parsed, deterministically chunked, embedded, pgvector-indexed content that can be retrieved only within an authenticated workspace scope.

**Architecture:** Keep parsing, storage, embeddings, indexing, and retrieval behind provider-neutral interfaces owned by `apps/api`. The ingestion service coordinates those boundaries and replaces a document's active chunks transactionally only after parsing and embedding succeed; retrieval applies membership authorization before every vector query.

**Tech Stack:** Node.js 20.19+, TypeScript 5.9, Express, Zod, PostgreSQL 16 with pgvector, Vitest, Supertest, PDF/DOCX parser adapters, and an OpenAI-compatible embedding adapter.

**Spec:** `docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`

**Progress:** Tasks 1, 3, and 4 are complete. Task 2 has strict TXT/Markdown extraction and a tested binary-adapter boundary; concrete PDF/DOCX library adapters remain unavailable until their dependencies can be installed.

## Global Constraints

- Supported formats remain PDF, plain text, Markdown, and DOCX with the existing 10 MiB limit.
- Document contents and embeddings are sensitive and must never appear in logs or error responses.
- Every ingestion and retrieval operation authorizes against server-side workspace membership.
- Re-indexing replaces the active chunk set without duplicate vectors.
- Provider failures leave the prior successful index intact and record only a safe failure summary.
- Citation-ready metadata must retain stable document, chunk ordinal, page, and section references.
- Day 4 does not generate conversational answers or claim citations; those remain Day 5.

---

### Task 1: Normalization and deterministic chunking core

**Files:**
- Create: `apps/api/src/ingestion/chunking.ts`
- Create: `apps/api/src/ingestion/chunking.test.ts`

**Interfaces:**
- Produces: `normalizeSections(sections)` and `chunkSections(sections, options)` with stable ordinals and retained page/section metadata.
- Consumes: parser-neutral `ExtractedSection` values.

- [x] **Step 1: Write failing tests for Unicode/line-ending normalization, paragraph preservation, empty content, stable ordinals, overlap, metadata retention, and invalid options**
- [x] **Step 2: Run `npm test --workspace @knowledge-ai/api -- --run src/ingestion/chunking.test.ts` and confirm the module is missing**
- [x] **Step 3: Implement normalization and word-window chunking without external dependencies**
- [x] **Step 4: Run focused tests and the complete API suite**
- [x] **Step 5: Commit `feat: add deterministic document chunking`**

### Task 2: Format-specific parsing adapters

**Files:**
- Create: `apps/api/src/ingestion/documentParser.ts`
- Create: `apps/api/src/ingestion/documentParser.test.ts`
- Create: `apps/api/src/ingestion/parsers/plainTextParser.ts`
- Create: `apps/api/src/ingestion/parsers/markdownParser.ts`
- Create: `apps/api/src/ingestion/parsers/pdfParser.ts`
- Create: `apps/api/src/ingestion/parsers/docxParser.ts`
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `DocumentParser.extract({ mediaType, bytes }) => Promise<ExtractedSection[]>`.
- Consumes: Task 1 section contracts and the existing document media-type contract.

**Current progress:** TXT and Markdown extraction, strict UTF-8 validation, heading/fence metadata handling, size/empty/media validation, binary adapter injection, and content-free parser failures are implemented. PDF/DOCX dependencies and concrete adapters are still pending, so this task is not marked complete.

- [ ] **Step 1: Add fixture-backed failing tests for valid extraction, malformed bytes, empty documents, page/heading metadata, and unsupported media types**
- [ ] **Step 2: Verify failures are caused by missing parser adapters**
- [ ] **Step 3: Implement strict UTF-8 text/Markdown extraction and isolated PDF/DOCX library adapters**
- [ ] **Step 4: Run parser, API, lint, type-check, and build gates**
- [ ] **Step 5: Commit `feat: parse supported document formats`**

### Task 3: Authorized object upload boundary

**Files:**
- Create: `apps/api/src/storage/objectStore.ts`
- Create: `apps/api/src/storage/inMemoryObjectStore.ts`
- Create: `apps/api/src/ingestion/uploadRouter.ts`
- Create: `apps/api/src/ingestion/uploadRouter.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/runtime.ts`

**Interfaces:**
- Produces: authenticated byte upload and an `ObjectStore` with put/get/delete operations keyed by server-generated paths.
- Consumes: existing membership authorization, size/media validation, and document metadata.

- [x] **Step 1: Write failing tests for authentication, membership, write roles, byte limits, MIME mismatch, duplicate submission, and content-free errors**
- [x] **Step 2: Verify failures are caused by the absent upload route and store**
- [x] **Step 3: Implement bounded raw-body validation and an injected object-store boundary**
- [x] **Step 4: Run focused integration and complete quality gates**
- [x] **Step 5: Commit `feat: add authorized document upload`**

### Task 4: pgvector chunk and indexing schema

**Files:**
- Create: `apps/api/migrations/002_day4_ingestion.sql`
- Modify: `apps/api/src/database/schema.test.ts`

**Interfaces:**
- Produces: `document_index_runs` and `document_chunks` with vector dimensions, ordinals, metadata, active-run uniqueness, and cascading deletion.
- Consumes: existing documents and migration ledger.

- [x] **Step 1: Write failing PostgreSQL tests for pgvector availability, uniqueness, scope integrity, atomic replacement, and cascades**
- [x] **Step 2: Verify failures are caused by missing Day 4 relations**
- [x] **Step 3: Add the idempotent migration and indexes required for scoped vector search**
- [x] **Step 4: Run local compatibility tests and real PostgreSQL CI**
- [x] **Step 5: Commit `feat: add pgvector ingestion schema`**

### Task 5: Embedding provider and idempotent ingestion service

**Files:**
- Create: `apps/api/src/ai/embeddingProvider.ts`
- Create: `apps/api/src/ai/openAiEmbeddingProvider.ts`
- Create: `apps/api/src/ingestion/ingestionRepository.ts`
- Create: `apps/api/src/ingestion/postgresIngestionRepository.ts`
- Create: `apps/api/src/ingestion/ingestionService.ts`
- Create: `apps/api/src/ingestion/ingestionService.test.ts`
- Modify: `apps/api/src/config.ts`
- Modify: `apps/api/src/runtime.ts`

**Interfaces:**
- Produces: `EmbeddingProvider.embed(texts)` and `IngestionService.indexDocument(userId, workspaceId, documentId)`.
- Consumes: Tasks 1–4 parsing, chunking, object storage, and database boundaries.

- [ ] **Step 1: Write failing tests for lifecycle transitions, batching, retryable provider failures, safe errors, old-index preservation, and idempotent replacement**
- [ ] **Step 2: Confirm failures are caused by missing service/provider boundaries**
- [ ] **Step 3: Implement provider-neutral batching and transactional activation of successful index runs**
- [ ] **Step 4: Run service, PostgreSQL, configuration, and complete quality suites**
- [ ] **Step 5: Commit `feat: index documents with provider embeddings`**

### Task 6: Membership-scoped semantic retrieval API

**Files:**
- Create: `apps/api/src/retrieval/retrievalRepository.ts`
- Create: `apps/api/src/retrieval/postgresRetrievalRepository.ts`
- Create: `apps/api/src/retrieval/retrievalRouter.ts`
- Create: `apps/api/src/retrieval/retrievalRouter.test.ts`
- Create: `packages/contracts/src/retrieval.ts`
- Create: `packages/contracts/src/retrieval.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: workspace-, collection-, and document-scoped top-k retrieval returning stored chunk metadata and scores.
- Consumes: authenticated identity, embedding provider, active chunks, and membership predicates.

- [ ] **Step 1: Write failing contract and API tests for all scopes, non-members, mismatched scope IDs, top-k limits, empty results, and score ordering**
- [ ] **Step 2: Verify failures are caused by missing contracts and route**
- [ ] **Step 3: Implement authorized query embedding and pgvector similarity search**
- [ ] **Step 4: Run contract, API, PostgreSQL, and root gates**
- [ ] **Step 5: Commit `feat: add scoped semantic retrieval`**

### Task 7: Real ingestion and search frontend states

**Files:**
- Modify: `apps/web/src/data/apiKnowledgeRepository.ts`
- Modify: `apps/web/src/pages/documents/DocumentUploadPanel.tsx`
- Modify: `apps/web/src/pages/documents/DocumentRoutes.test.tsx`
- Modify: `apps/web/src/pages/knowledge/MockKnowledgePage.tsx`
- Create: `apps/web/src/pages/knowledge/KnowledgeSearchPage.test.tsx`

**Interfaces:**
- Produces: byte upload progress, durable ingestion status/retry, and API-backed scoped source retrieval explicitly labelled as search rather than AI chat.
- Consumes: Tasks 3, 5, and 6 HTTP APIs.

- [ ] **Step 1: Write failing frontend tests for upload, processing, indexed/failed states, retry, scoped search, empty context, and source navigation**
- [ ] **Step 2: Confirm failures are caused by metadata-only upload and mock search**
- [ ] **Step 3: Connect existing views to Day 4 APIs while retaining explicit fixture mode**
- [ ] **Step 4: Run frontend accessibility, root quality, and production-build gates**
- [ ] **Step 5: Commit `feat: connect ingestion and semantic search UI`**

### Task 8: Day 4 acceptance and documentation

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/plans/2026-09-01-day4-ingestion-retrieval.md`

**Interfaces:**
- Consumes: all Day 4 deliverables.
- Produces: reproducible setup, provider, migration, data-sensitivity, limitation, and verification documentation.

- [ ] **Step 1: Document only implemented behavior, operational requirements, provider configuration, and Day 5 exclusions**
- [ ] **Step 2: Run clean install, lint, strict type-check, all tests, all builds, real PostgreSQL/pgvector integration, audit, and `git diff --check`**
- [ ] **Step 3: Review for secret leakage, authorization gaps, unsafe uploads, duplicate vectors, generated files, placeholders, and unsupported claims**
- [ ] **Step 4: Commit `docs: complete Day 4 ingestion milestone`**
- [ ] **Step 5: Require exact-head GitHub Actions success and merge the Day 4 pull request**

## Plan self-review

- All approved Day 4 stages map to a task: supported parsing, normalization/chunking, object storage, embeddings, pgvector indexing, retries, idempotent re-indexing, and scoped retrieval.
- Provider, parser, storage, indexing, and retrieval interfaces have one direction of dependency and no frontend coupling.
- Every production behavior begins with an observable failing test.
- Day 5 chat, answer generation, conversation history, and citation claims remain explicitly excluded.
