# Keystone — AI Knowledge Workspace

Keystone is a portfolio-oriented knowledge workspace for organizing source documents and, in later milestones, asking grounded questions with citations. The repository currently contains the completed Day 1 React and TypeScript product shell.

## Day 1 capabilities

- Responsive authenticated application shell with desktop and mobile navigation
- Explicitly labelled local demo session with protected routes and sign-out
- Accessible login and registration previews for the Day 3 authentication milestone
- Typed workspace, collection, document, and ingestion-status contracts
- Asynchronous fixture repository behind a replaceable `KnowledgeRepository` interface
- Dashboard metrics and recent items derived from repository data
- Direct-linkable workspace, workspace-detail, and nested collection views
- Breadcrumb navigation and workspace-scoped collection validation
- Loading, populated, empty, failure, retry, and not-found states
- Automated linting, strict type checking, component tests, and production builds in CI

## Architecture

This npm workspace currently hosts the frontend in `apps/web`.

The page layer consumes an asynchronous `KnowledgeRepository` through a provider. Day 1 uses immutable typed fixtures; Day 3 will introduce an HTTP adapter without coupling pages to transport details. TanStack Query manages repository state, React Router owns direct URLs and browser navigation, and Tailwind provides the responsive visual system.

Key boundaries:

- `apps/web/src/domain` — shared frontend domain contracts
- `apps/web/src/data` — fixture repository, provider, and query keys
- `apps/web/src/auth` — clearly labelled local demo-session boundary
- `apps/web/src/pages` — route-level dashboard, authentication, workspace, and collection views
- `apps/web/src/components` — reusable navigation, layout, heading, and state components

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

Routes below `/app` require the local demo session. Unknown entities render recoverable not-found states, while unknown application URLs use the global 404 page.

## Run locally

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer

```bash
npm ci
npm run dev
```

Vite will print the local development URL.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

Day 1 verification covers the fixture repository, protected routing, authentication preview, responsive shell, dashboard states, direct workspace/collection navigation, empty states, and scoped not-found behavior. GitHub Actions runs a clean install and every command above for feature branches and pull requests.

## Honest limitations

Day 1 is frontend-only. It does **not** provide real authentication, accounts, uploads, parsing, a database, vector search, AI calls, or deployment. Email/password and Google controls are disabled previews. The demo session stores only a fixed marker in browser LocalStorage, and all knowledge data resets to typed fixtures on reload.

## Roadmap

1. **Day 1 — complete:** React/TypeScript shell, demo auth boundary, dashboard, workspaces, collections, tests, and CI
2. **Day 2:** document library, upload experience, ingestion states, and mock search/chat flows
3. **Day 3:** Express API, PostgreSQL, email/password authentication, Google OAuth boundary, and durable persistence
4. **Day 4:** parsing, chunking, provider embeddings, pgvector storage, and scoped retrieval
5. **Day 5:** grounded chat, citations, conversation history, and low-confidence behavior
6. **Day 6:** end-to-end coverage, Docker, deployment, operations documentation, and final polish

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the current handoff state.
