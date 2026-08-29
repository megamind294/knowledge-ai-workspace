# Project status

## Current milestone

**Day 2 — Document experience: in progress**

Day 1 was merged into `main` through [pull request #2](https://github.com/megamind294/knowledge-ai-workspace/pull/2). Day 2 development continues on `feature/day2-document-library`.

## Day 2 foundation completed

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
- 43 automated tests passing locally with lint, strict type-check, and build verification

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
- document upload, parsing, chunking, or object storage
- Express API, PostgreSQL, or pgvector
- embeddings, retrieval, AI chat, or citations
- production deployment

These are planned milestones, not hidden or partially implemented features.

## Remaining Day 2 work

1. accessible file-selection UX backed by the validated metadata contract
2. mock scoped search and chat surfaces, clearly labelled as non-AI fixtures
3. expanded component tests, final documentation, CI, and merge

The Day 3 API will later replace fixture-backed persistence through the existing repository boundary.
