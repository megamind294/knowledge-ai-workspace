# Keystone Day 2 Document Experience Implementation Plan

> **For Codex:** Execute this plan with `superpowers:executing-plans`. Use test-driven development for every behavioral change and commit after each green task.

**Goal:** Deliver a fixture-backed document library with validated upload previews, visible ingestion states, document details, retry behavior, and clearly labelled mock search/chat surfaces.

**Architecture:** Extend the existing `KnowledgeRepository` rather than adding page-owned state. A mutable in-memory Day 2 adapter will simulate upload and ingestion transitions while returning defensive copies. TanStack Query owns server-state synchronization; route pages consume only repository methods so Day 3 can replace the adapter with HTTP calls.

**Tech stack:** React, TypeScript, React Router, TanStack Query, Tailwind CSS, Vitest, Testing Library.

**Day 2 boundaries:** No file contents leave the browser, no parser runs, no object is stored, and no AI/provider call occurs. Upload, indexing, search, and chat behavior must be labelled as local simulation or mock data.

---

## Task 1: Define upload contracts and validation

**Files:**
- Modify: `apps/web/src/domain/knowledge.ts`
- Create: `apps/web/src/domain/documentUpload.ts`
- Test: `apps/web/src/domain/documentUpload.test.ts`

1. Write failing tests for accepting PDF, TXT, Markdown, and DOCX metadata; rejecting unsupported extensions/MIME types; rejecting empty and over-10-MiB files; and normalizing accepted metadata into a `DocumentUploadCandidate`.
2. Run `npm test --workspace @knowledge-ai/web -- --run src/domain/documentUpload.test.ts` and confirm failures are caused by the missing validator.
3. Add `DocumentDetail`, `DocumentUploadInput`, `DocumentUploadCandidate`, `DocumentUploadErrorCode`, and `DocumentUploadValidation` contracts. Implement a pure `validateDocumentUpload()` with explicit extension, MIME, and size rules.
4. Re-run the focused test, then the full suite.
5. Commit with `feat: define validated document upload contracts`.

## Task 2: Add document repository lifecycle operations

**Files:**
- Modify: `apps/web/src/data/fixtures.ts`
- Modify: `apps/web/src/data/knowledgeRepository.ts`
- Modify: `apps/web/src/data/knowledgeRepository.test.ts`

1. Write failing repository tests for `getDocument(id)`, `createDocument(candidate)`, and `retryDocument(id)`. Cover immutable results, deterministic local IDs, `uploaded` creation, failed-only retry to `processing`, missing documents, and preservation of workspace/collection scope.
2. Run the focused repository test and verify the new assertions fail because the methods are absent.
3. Replace direct fixture reads with private mutable snapshots inside a `createFixtureKnowledgeRepository()` factory. Implement the new methods and keep the exported default fixture repository for production composition.
4. Re-run repository tests and the full suite.
5. Commit with `feat: simulate document ingestion lifecycle`.

## Task 3: Build the document library and detail routes

**Files:**
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/components/AppNav.tsx`
- Modify: `apps/web/src/data/queryKeys.ts`
- Create: `apps/web/src/pages/documents/DocumentLibraryPage.tsx`
- Create: `apps/web/src/pages/documents/DocumentDetailPage.tsx`
- Create: `apps/web/src/pages/documents/DocumentStatusBadge.tsx`
- Test: `apps/web/src/pages/documents/DocumentRoutes.test.tsx`

1. Write failing route tests for `/app/documents` and `/app/documents/:documentId`, direct links, status filtering, loading, empty, failure, not-found, and failed-document retry.
2. Verify the tests fail because the routes and pages do not exist.
3. Add repository-backed pages, status badges, query keys, navigation, retry mutation, and invalidation. Keep every simulated action visibly labelled.
4. Re-run focused and full tests.
5. Commit with `feat: add document library and detail routes`.

## Task 4: Add validated local upload UX

**Files:**
- Create: `apps/web/src/pages/documents/DocumentUploadPanel.tsx`
- Modify: `apps/web/src/pages/documents/DocumentLibraryPage.tsx`
- Test: `apps/web/src/pages/documents/DocumentUploadPanel.test.tsx`

1. Write failing tests for accessible file selection, workspace/collection targeting, supported-format messaging, size/type errors, submission prevention, successful local creation, duplicate-click protection, and input reset.
2. Verify the focused tests fail for missing behavior.
3. Implement the form with native file metadata only. Submit the validated candidate through `createDocument`, invalidate relevant queries, and explicitly state that no bytes are uploaded in Day 2.
4. Re-run focused and full tests.
5. Commit with `feat: add validated local upload preview`.

## Task 5: Add honest mock search and chat surfaces

**Files:**
- Create: `apps/web/src/pages/knowledge/MockKnowledgePage.tsx`
- Create: `apps/web/src/pages/knowledge/mockKnowledge.ts`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/components/AppNav.tsx`
- Test: `apps/web/src/pages/knowledge/MockKnowledgePage.test.tsx`

1. Write failing tests for workspace/collection/document scope selection, fixture search results, mock answer rendering, source labels, empty queries, and an unmistakable “no AI call” notice.
2. Verify the tests fail because the mock surface is absent.
3. Implement deterministic fixture search and responses without network or provider code. Never present the result as generated AI output or a real citation.
4. Re-run focused and full tests.
5. Commit with `feat: preview scoped knowledge flows`.

## Task 6: Verify, document, and integrate Day 2

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_STATUS.md`
- Update: `docs/superpowers/plans/2026-08-29-day2-document-experience.md`

1. Update documentation with only implemented behavior and retain explicit mock/local limitations.
2. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build`.
3. Review the branch diff for secrets, placeholders, accidental generated files, accessibility regressions, and unsupported claims.
4. Push `feature/day2-document-library`, open a draft PR, and confirm GitHub Actions succeeds.
5. After all tasks and CI pass, use `superpowers:finishing-a-development-branch` to complete the milestone.

## Plan self-review

- The plan covers every approved Day 2 requirement: library, validation/progress, ingestion states, details, retry, and mock search/chat.
- Repository and page method names are consistent across tasks.
- Real parsing, storage, API, authentication, retrieval, citations, and AI remain outside Day 2.
- Every production behavior begins with a focused failing test.
