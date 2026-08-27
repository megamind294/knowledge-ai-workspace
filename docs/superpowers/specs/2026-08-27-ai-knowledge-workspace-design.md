# AI Knowledge Workspace Design

**Date:** 2026-08-27  
**Status:** Approved  
**Repository:** `megamind294/knowledge-ai-workspace`

## 1. Product goal

Build a portfolio-ready AI knowledge workspace that lets a user organize source documents, index their content, and ask grounded questions with citations. The product should demonstrate polished React product work, secure full-stack boundaries, relational and vector data modeling, document-processing workflows, and production-minded testing and deployment.

Version 1 supports PDF, TXT, Markdown, and DOCX files. It starts as a personal workspace experience while preserving the ownership and membership boundaries needed for later collaboration.

## 2. Scope and roadmap

The project is delivered as six independently verifiable milestones:

1. **Day 1 — Product shell:** React/TypeScript application shell, authentication screens, dashboard, workspace list, collection views, responsive navigation, and representative mock data.
2. **Day 2 — Document experience:** document library, upload validation and progress, ingestion-state UI, document details, and mock search/chat flows.
3. **Day 3 — API and persistence:** Express REST API, PostgreSQL schema, email/password authentication, Google OAuth integration boundary, authorization, and durable workspace data.
4. **Day 4 — Ingestion and retrieval:** PDF/TXT/Markdown/DOCX parsing, normalization, chunking, embeddings, pgvector indexing, scoped semantic retrieval, retries, and idempotent re-indexing.
5. **Day 5 — Grounded chat:** provider-backed AI chat, workspace/collection/document scope, conversation history, citations mapped to stored chunks, and low-confidence behavior.
6. **Day 6 — Delivery:** broad automated coverage, end-to-end smoke tests, Docker, CI, managed-demo deployment documentation, Azure/AWS production architecture, accessibility, and final polish.

Each milestone must end with passing tests and a production build. Documentation must describe only behavior that exists on the merged default branch.

## 3. Architecture

The repository uses npm workspaces:

- `apps/web`: React, TypeScript, Vite, React Router, TanStack Query, and Tailwind CSS.
- `apps/api`: Node.js, Express, TypeScript, REST endpoints, authentication, ingestion, retrieval, and AI orchestration.
- `packages/contracts`: shared request/response schemas and domain types with no browser or server runtime dependencies.
- `docs`: product specifications, implementation plans, architecture decisions, and deployment guidance.

The frontend never talks directly to PostgreSQL, object storage, or an AI vendor. It communicates only with the API. The API owns authorization and invokes focused services for persistence, ingestion, retrieval, and AI generation.

Day 1 uses typed in-memory fixtures behind frontend repository interfaces. Later milestones replace those implementations with API-backed adapters without changing page components.

## 4. Product hierarchy and navigation

The core hierarchy is:

`User → Workspace → WorkspaceMember → Collection → Document → DocumentChunk`

Chat data is:

`Conversation → Message → MessageSource → DocumentChunk`

Primary routes:

- `/login` and `/register`
- `/app` dashboard
- `/app/workspaces`
- `/app/workspaces/:workspaceId`
- `/app/workspaces/:workspaceId/collections/:collectionId`
- `/app/documents/:documentId`
- `/app/conversations/:conversationId`
- `/app/settings`

Authenticated pages share a responsive shell with workspace navigation, global search entry, a primary action, account controls, and mobile navigation. Direct links and browser back/forward navigation must work.

## 5. Core data model

- **User:** identity, profile, password-auth state, Google-auth state, timestamps.
- **Workspace:** owner, name, slug, description, timestamps.
- **WorkspaceMember:** workspace, user, role (`owner | admin | member | viewer`), timestamps.
- **Collection:** workspace, name, description, timestamps.
- **Document:** workspace, optional collection, original filename, media type, size, storage key, ingestion state, failure reason, timestamps.
- **DocumentChunk:** document, ordinal, normalized text, page/section metadata, embedding vector, token count.
- **Conversation:** workspace, optional collection/document scope, title, timestamps.
- **Message:** conversation, role, content, model metadata, timestamps.
- **MessageSource:** message, chunk, relevance score, quoted span metadata.
- **AIProviderConfig:** workspace-safe provider selection and encrypted secret reference; raw secrets are never returned to the client.

All queries and mutations are scoped by the authenticated user's workspace membership. Client-side visibility is a usability layer, never the authorization boundary.

## 6. Authentication and authorization

Version 1 supports email/password and Google login.

- Passwords are hashed with an established password-hashing library.
- Access tokens are short-lived; refresh credentials use secure, HTTP-only cookies.
- OAuth state and redirect validation are server controlled.
- Every workspace, collection, document, ingestion, conversation, and settings endpoint performs server-side authorization.
- Uploaded content, embeddings, prompts, and provider secrets are treated as sensitive data.
- Development fixtures and mock sessions must be explicitly labeled and never described as production authentication.

## 7. Document ingestion

Supported media types are PDF, plain text, Markdown, and DOCX. The flow is:

`uploaded → processing → indexed` or `failed`

Processing stages:

1. Validate extension, media type, and configured size limit.
2. Store the original object.
3. Extract text with a format-specific parser.
4. Normalize whitespace while retaining page/section metadata.
5. Split content into overlapping chunks with stable ordinals.
6. Generate embeddings through the provider abstraction.
7. persist chunks and vectors transactionally.
8. Mark the document indexed.

Re-indexing is idempotent: a new successful index replaces the previous active chunk set without duplicating vectors. Failures preserve a safe error summary and permit retry. Deleting a document removes its stored object and associated chunks/vectors.

## 8. Retrieval and AI generation

Chat may be scoped to an entire workspace, one collection, or one document.

The API embeds the question, applies the authorized scope, retrieves the most relevant chunks, rejects missing or low-confidence context, builds a bounded prompt, calls the configured provider, and stores the response plus exact source mappings.

The AI boundary exposes provider-neutral interfaces for embeddings and text generation. OpenAI is the first adapter; later providers can be added without changing retrieval or conversation services.

Every displayed citation resolves to a stored `MessageSource` and `DocumentChunk`. The UI must not invent citations. When reliable sources are unavailable, the response states that no supported answer was found.

## 9. Reliability and error handling

- Validate inputs at UI and API boundaries using shared schemas where appropriate.
- Expose stable machine-readable error codes and actionable user messages.
- Make upload and indexing state visible, including retry and failure states.
- Handle provider timeouts, rate limits, unavailable models, and partial ingestion safely.
- Prevent duplicate submissions with idempotency keys or server-side uniqueness where applicable.
- Keep destructive operations explicit and confirmed.
- Log correlation IDs and operational context without logging document contents, tokens, or secrets.

## 10. Testing and quality gates

- Unit tests: validators, parsers, chunking, permission rules, provider adapters, and view-model utilities.
- API integration tests: authentication, workspace authorization, upload metadata, ingestion transitions, retrieval scope, conversation persistence, and cascading deletion.
- Frontend tests: protected routes, responsive navigation behavior, dashboard states, upload flows, citations, and empty/error/recovery states.
- End-to-end smoke test: sign in → create/open workspace → upload document → index → ask question → receive grounded answer → open citation.
- CI: clean install, formatting/lint, type checking, tests, and production builds.

Day 1 specifically requires unit/component tests for the typed fixture repository, protected routing, dashboard summaries, workspace/collection navigation, empty states, and the responsive application shell.

## 11. Deployment

The demo path uses Vercel for the web app, Render or Railway for the API, managed PostgreSQL with pgvector, and S3-compatible object storage. Both applications are Dockerized.

Production documentation includes an Azure or AWS alternative with separated environments, managed secrets, private database networking, object storage, health checks, migrations, backups, monitoring, and rollback guidance.

## 12. Day 1 acceptance criteria

Day 1 is complete when:

- The npm workspace installs reproducibly.
- The React app provides login/register screens and a clearly labeled demo-session path.
- Authenticated routes render a responsive application shell.
- Dashboard metrics and recent items derive from typed fixture data rather than hard-coded JSX.
- Workspace and collection routes support direct links, loading, populated, empty, and not-found states.
- Navigation is keyboard accessible and usable at mobile and desktop widths.
- Tests cover the repository boundary and critical routing/view states.
- Lint, type checking, tests, and the production build pass in CI.
- README and project status truthfully identify Day 1 capabilities and remaining roadmap work.

## 13. Explicit non-goals for Day 1

Day 1 does not implement real authentication, file parsing, uploads, PostgreSQL, pgvector, real AI calls, or deployment. The UI may preview later product areas only when clearly presented as unavailable or mock-backed. These capabilities enter only in their designated milestones.
