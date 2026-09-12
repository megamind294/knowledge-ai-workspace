# Keystone Day 6 Delivery Implementation Plan

> **For agentic workers:** execute one task at a time, test-first, and require fresh verification before publishing or merging.

**Goal:** Make Keystone reproducibly deployable and operable while preserving its security, authorization, citation, and data-handling boundaries.

**Architecture:** Keep liveness independent from dependencies and expose a separate bounded readiness probe for orchestrators. Package the API and web application as non-root production containers, exercise the real container topology in CI, then add browser-level smoke and accessibility coverage. Document one managed demo path and one production cloud architecture without claiming an unperformed deployment.

**Tech Stack:** Node.js 20.19+, TypeScript 5.9, Express, PostgreSQL 16 with pgvector, React, Vite, Docker, Nginx, GitHub Actions, and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`

**Progress:** Day 6 Tasks 1–5 are complete on the draft delivery branch. Tasks 1–3 provide operational probes, privacy-bounded logging, and hardened non-root production images. Task 4 adds a health-ordered Compose topology with persistent database and document volumes plus real container-runtime smoke coverage. Task 5 adds deterministic Chromium acceptance for credential sign-in, workspace creation, real byte upload and indexing, grounded answers, citation navigation, recovery behavior, and critical-state accessibility. Task 6 now includes an executable deployment/operations runbook and an automated documentation contract. The local repository suite has 367 runnable tests with nine PostgreSQL/pgvector cases skipped without their database. All 374 pre-runbook repository tests, the grounded-answer fixture suite, production builds, real container smoke, and two browser journeys passed on commit `776d1792ea32feb66dbca25acc98d5abbe9510ef` in [GitHub Actions run #178](https://github.com/megamind294/knowledge-ai-workspace/actions/runs/34690174737). No production deployment or live-provider quality claim is made.

## Global constraints

- Health, readiness, logs, and container errors must not expose credentials, source text, prompts, provider responses, or database details.
- `/api/health` remains a dependency-free liveness signal; `/api/ready` represents current ability to serve database-backed traffic.
- Production containers run as non-root users and retain document bytes only on an explicitly mounted persistent volume.
- Container and browser smoke tests exercise built artifacts, not development servers.
- Deployment documentation distinguishes implemented artifacts from infrastructure that has not been provisioned.
- Every production behavior begins with an observable failing test or failing verification script.

### Task 1: Operational liveness and readiness

**Files:**
- Modify: `packages/contracts/src/http.ts`
- Modify: `packages/contracts/src/http.test.ts`
- Create: `apps/api/src/operations/readiness.ts`
- Create: `apps/api/src/operations/readiness.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/runtime.test.ts`

- [x] Add strict ready/unavailable response contracts.
- [x] Add a timeout-bounded database readiness probe.
- [x] Return `200` only when the database probe succeeds and `503` on failure without leaking the cause.
- [x] Compose readiness through the production runtime while retaining dependency-free liveness.
- [x] Run focused and repository-wide quality gates, review, commit, publish, and require exact-head CI.

### Task 2: Structured operational logging

- [x] Emit structured startup, shutdown, request-completion, and readiness-transition events with correlation IDs.
- [x] Verify that URLs, query strings, credentials, source text, prompts, and provider bodies never enter operational logs.

### Task 3: Production containers

- [x] Add reproducible non-root API and web images with production-only runtime dependencies.
- [x] Serve the SPA with history fallback, security headers, same-origin API proxying, and container health checks.

Task 3's static container contracts pass locally and in GitHub Actions. Docker and Podman were unavailable locally and the current CI job does not yet build images, so the images have not been built or exercised. Task 4 owns the container topology and runtime smoke coverage.

### Task 4: Container topology and CI smoke

- [x] Add a local Compose topology for web, API, pgvector PostgreSQL, and persistent document storage.
- [x] Build images and exercise health, readiness, authentication, and SPA routing through built containers in CI.

### Task 5: Browser smoke and accessibility

- [x] Add deterministic end-to-end coverage for sign-in, workspace creation, upload, indexing, grounded answer, and citation navigation.
- [x] Add automated accessibility checks for critical authenticated and recovery flows.

### Task 6: Deployment guidance and final acceptance

- [x] Document the managed demo path, Azure/AWS production architecture, secrets, networking, storage, migrations, backup/restore, monitoring, rollback, and provider data flow.
- [ ] Complete clean-install acceptance, container and browser smoke tests, independent review, exact-head CI, final polish, and merge.

## Plan self-review

- Each task produces independently testable behavior and preserves the existing provider-neutral boundaries.
- The plan does not claim a live deployment, live provider quality, OCR, or horizontally shared storage before those capabilities exist.
- Readiness is intentionally narrower than full downstream-provider availability so transient AI-provider issues do not remove authentication and document-management traffic from service.
