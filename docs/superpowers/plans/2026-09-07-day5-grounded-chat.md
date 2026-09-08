# Keystone Day 5 Grounded Chat Implementation Plan

> **For agentic workers:** implement each task test-first and require fresh verification before publishing or merging.

**Goal:** Turn authorized semantic retrieval into durable, source-grounded conversations whose displayed citations resolve to stored document chunks.

**Architecture:** Keep text generation behind a provider-neutral API boundary. A grounded-answer service filters authorized retrieval results by confidence, builds a bounded prompt from untrusted source text, validates every provider citation against the supplied chunk allow-list, and returns exact source metadata. Conversation repositories persist user and assistant messages plus immutable chunk mappings; HTTP and React layers consume shared contracts without inventing citations.

**Tech Stack:** Node.js 20.19+, TypeScript 5.9, Express, Zod, PostgreSQL 16 with pgvector, React, TanStack Query, Vitest, and Supertest.

**Spec:** `docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`

**Progress:** Tasks 1–4 are complete locally. The provider-neutral generation core, scope-bound persistence, authenticated conversation API, and production runtime composition pass lint, strict type-checking, 306 locally runnable tests, production builds, dependency validation, and a zero-vulnerability audit. Nine PostgreSQL/pgvector tests await exact-head CI after publication. No live provider call, frontend conversation UI, or displayed generated answer is claimed.

## Global constraints

- Every query is authorized at workspace, collection, or document scope before embedding or generation provider calls.
- Retrieved document text is untrusted data, never instructions, and prompt construction is bounded.
- A displayed citation must resolve to an exact retrieved and stored chunk; unknown provider references fail closed.
- Missing or low-confidence context returns a stable insufficient-context result without calling text generation.
- Provider errors and persisted failure metadata never expose source text, prompts, credentials, or upstream response bodies.
- The first provider adapter is OpenAI-compatible, while services depend only on provider-neutral interfaces.
- No live provider credentials, calls, or model-quality claims are required for automated acceptance.

---

### Task 1: Grounded generation core

**Files:**
- Create: `apps/api/src/ai/generationProvider.ts`
- Create: `apps/api/src/ai/openAiGenerationProvider.ts`
- Create: `apps/api/src/ai/openAiGenerationProvider.test.ts`
- Create: `apps/api/src/answers/groundedAnswerService.ts`
- Create: `apps/api/src/answers/groundedAnswerService.test.ts`

**Interfaces:**
- Produces: a provider-neutral structured generation boundary and citation-safe grounded answer service.
- Consumes: already-authorized `RetrievalResult` values from Day 4.

- [x] Write failing tests for structured response parsing, request and body timeouts, safe provider failures, bounded prompts, citation allow-listing, low-confidence refusal, and exact source mapping.
- [x] Confirm failures are caused by the missing Day 5 modules.
- [x] Implement the smallest provider adapter and service that satisfy the tests.
- [x] Run focused tests and complete repository quality gates.
- [x] Commit and publish `feat: add grounded answer generation core`.

### Task 2: Conversation and citation schema

- [x] Add conversations, messages, and message-source mappings with workspace-scoped foreign keys and cascading deletion.
- [x] Test immutable source mappings, message ordering, scope isolation, re-index retention, and lifecycle behavior against PostgreSQL.

### Task 3: Authorized conversation repository

- [x] Add transactional conversation creation, message persistence, history pagination, and idempotent submission semantics.
- [x] Re-check membership within write transactions and normalize storage failures.

### Task 4: Grounded chat API and runtime composition

- [x] Add shared request/response contracts and authenticated create/list/get/message endpoints.
- [x] Compose embedding, retrieval, generation, persistence, and exact citation mapping in the production runtime.

### Task 5: React conversation and citation experience

- [ ] Add conversation routes, scope selection, history, loading/failure/retry states, and accessible citation details linked to stored sources.
- [ ] Keep fixture mode explicit and separate from provider-backed API claims.

### Task 6: Evaluation and low-confidence acceptance

- [ ] Add deterministic groundedness fixtures covering supported answers, conflicting context, prompt injection, unsupported claims, empty retrieval, and low similarity.
- [ ] Verify provider failures, authorization races, and citation integrity end to end.

### Task 7: Day 5 acceptance and documentation

- [ ] Document implemented behavior, provider configuration, data handling, operational limits, and reproducible setup.
- [ ] Require clean install, lint, strict type-checking, all tests, production builds, PostgreSQL/pgvector CI, dependency audit, independent review, and exact-head CI before merge.

## Plan self-review

- The approved Day 5 scope maps to grounded generation, citations, durable history, authorized APIs, frontend conversations, and low-confidence evaluation.
- Provider, retrieval, persistence, HTTP, and frontend responsibilities remain independently testable.
- Citation integrity is enforced server-side from stored chunk identity rather than model-authored labels.
- Day 6 deployment and observability work remains outside this milestone.
