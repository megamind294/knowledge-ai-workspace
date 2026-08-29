# Day 1 Product Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tested React/TypeScript SaaS shell with demo authentication, dashboard summaries, and direct-linkable workspace and collection views backed by typed fixture data.

**Architecture:** An npm workspace hosts `apps/web`. Page components consume an asynchronous `KnowledgeRepository` interface through TanStack Query so Day 3 can replace fixtures with an HTTP adapter. A small demo-session provider guards the application routes while explicitly avoiding production-auth claims.

**Tech Stack:** npm workspaces, React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, Vitest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-08-27-ai-knowledge-workspace-design.md`

## Global Constraints

- Day 1 implements no real authentication, uploads, parsing, database, vector search, or AI calls.
- All user-visible sample data comes from typed fixtures behind an asynchronous repository interface.
- Authenticated pages must support direct URLs and browser navigation.
- Loading, populated, empty, and not-found states are explicit.
- Demo-session behavior is labeled as a preview and never presented as production authentication.
- CI must run a clean install, lint, type checking, tests, and a production build.

---

### Task 1: Workspace, web application, and CI foundation

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/eslint.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/test/setup.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `lint`, `typecheck`, `test`, and `build`.
- Produces: Vite entry point for later routing tasks.

- [x] **Step 1: Create the workspace manifests and strict TypeScript configuration**

Use npm workspaces with the root scripts delegating to `@knowledge-ai/web`. Configure TypeScript with `strict: true`, `noUncheckedIndexedAccess: true`, and `noFallthroughCasesInSwitch: true`.

- [x] **Step 2: Add the minimal application entry point**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main>Knowledge AI Workspace</main>
  </React.StrictMode>,
);
```

- [x] **Step 3: Install dependencies and create the lockfile**

Run: `npm install`  
Expected: exit 0 and a root `package-lock.json` containing both workspace packages.

- [x] **Step 4: Verify the initial toolchain**

Run: `npm run typecheck && npm run lint && npm run build`  
Expected: all commands exit 0.

- [x] **Step 5: Add CI**

Configure Node 20 with `npm ci`, then run lint, type checking, tests with `--run`, and the production build on pushes and pull requests.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .github apps/web
git commit -m "chore: scaffold knowledge workspace web app"
```

### Task 2: Typed domain model and fixture repository

**Files:**
- Create: `apps/web/src/domain/knowledge.ts`
- Create: `apps/web/src/data/fixtures.ts`
- Create: `apps/web/src/data/knowledgeRepository.ts`
- Test: `apps/web/src/data/knowledgeRepository.test.ts`

**Interfaces:**
- Produces: `WorkspaceSummary`, `CollectionSummary`, `RecentDocument`, and `DashboardSnapshot`.
- Produces: `KnowledgeRepository.getDashboard(): Promise<DashboardSnapshot>`.
- Produces: `KnowledgeRepository.getWorkspace(id: string): Promise<WorkspaceSummary | null>`.
- Produces: `KnowledgeRepository.getCollection(workspaceId: string, collectionId: string): Promise<CollectionSummary | null>`.

- [x] **Step 1: Write failing repository tests**

```ts
it("returns dashboard totals derived from fixtures", async () => {
  const dashboard = await fixtureKnowledgeRepository.getDashboard();
  expect(dashboard.metrics.workspaces).toBe(dashboard.recentWorkspaces.length);
  expect(dashboard.metrics.documents).toBeGreaterThan(0);
});

it("does not return a collection from another workspace", async () => {
  await expect(
    fixtureKnowledgeRepository.getCollection("research", "onboarding"),
  ).resolves.toBeNull();
});
```

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/data/knowledgeRepository.test.ts`  
Expected: FAIL because the repository does not exist.

- [x] **Step 3: Implement immutable fixtures and the asynchronous repository**

Define branded string IDs only where they improve safety. Return copied arrays so callers cannot mutate fixture state. Derive all dashboard counts from the same workspace/document/collection fixtures used by detail queries.

- [x] **Step 4: Run repository tests**

Run: `npm test -- --run src/data/knowledgeRepository.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/domain apps/web/src/data
git commit -m "feat: add typed knowledge fixture repository"
```

### Task 3: Demo session and protected application routing

**Files:**
- Create: `apps/web/src/auth/DemoSessionProvider.tsx`
- Create: `apps/web/src/auth/RequireSession.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/RouteErrorPage.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/app/router.test.tsx`

**Interfaces:**
- Produces: `useDemoSession(): { user: DemoUser | null; startDemo(): void; endDemo(): void }`.
- Produces: `RequireSession`, which redirects missing sessions to `/login` while preserving the requested location.
- Produces: browser routes defined in the design spec.

- [x] **Step 1: Write failing protected-route tests**

```tsx
it("redirects an unauthenticated app route to login", async () => {
  renderRouter(["/app"]);
  expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeVisible();
});

it("renders the dashboard for the persisted demo session", async () => {
  window.localStorage.setItem("knowledge-ai.demo-session", "active");
  renderRouter(["/app"]);
  expect(await screen.findByRole("heading", { name: /dashboard/i })).toBeVisible();
});
```

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/app/router.test.tsx`  
Expected: FAIL because session and routes are missing.

- [x] **Step 3: Implement session state and route guards**

Persist only a fixed demo-session marker. Use `replace` navigation for redirects and retain `location.state.from` for the post-login destination. Add route-level not-found and error pages.

- [x] **Step 4: Run routing tests**

Run: `npm test -- --run src/app/router.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/auth apps/web/src/app apps/web/src/main.tsx
git commit -m "feat: add demo session and protected routes"
```

### Task 4: Responsive application shell

**Files:**
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/AppNav.tsx`
- Create: `apps/web/src/components/BrandMark.tsx`
- Create: `apps/web/src/components/PageHeader.tsx`
- Test: `apps/web/src/components/AppShell.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `useDemoSession()`.
- Produces: `AppShell` with an `Outlet`, desktop sidebar, mobile header, skip link, account menu, and active-route navigation.

- [x] **Step 1: Write failing accessibility/navigation tests**

Assert that the shell has a skip link, labeled primary navigation, an active Dashboard link, a button that opens mobile navigation, and a sign-out action.

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/components/AppShell.test.tsx`  
Expected: FAIL because the shell is missing.

- [x] **Step 3: Implement the shell**

Use semantic `header`, `nav`, `main`, and button elements. Keep the mobile menu state local, close it on route change, and make focus states visible. Use a calm slate/indigo visual system with high-contrast surfaces and no placeholder gradients.

- [x] **Step 4: Run the shell tests**

Run: `npm test -- --run src/components/AppShell.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components apps/web/src/styles.css
git commit -m "feat: add responsive application shell"
```

### Task 5: Login and registration screens

**Files:**
- Create: `apps/web/src/pages/auth/LoginPage.tsx`
- Create: `apps/web/src/pages/auth/RegisterPage.tsx`
- Create: `apps/web/src/components/AuthLayout.tsx`
- Test: `apps/web/src/pages/auth/LoginPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: `useDemoSession().startDemo()`.
- Produces: accessible login/register forms and a clearly labeled `Explore demo workspace` action.

- [x] **Step 1: Write a failing demo-entry test**

Render `/login`, activate `Explore demo workspace`, and assert navigation to the preserved app destination. Verify that the page states the demo does not create a real account.

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/pages/auth/LoginPage.test.tsx`  
Expected: FAIL because the login page is missing.

- [x] **Step 3: Implement auth screens**

Provide semantic email/password fields and a Google button as disabled previews with honest `Coming in Day 3` text. Only the demo action establishes a session.

- [x] **Step 4: Run auth tests**

Run: `npm test -- --run src/pages/auth/LoginPage.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/pages/auth apps/web/src/components/AuthLayout.tsx apps/web/src/app/router.tsx
git commit -m "feat: add honest authentication preview"
```

### Task 6: Dashboard derived from repository data

**Files:**
- Create: `apps/web/src/data/KnowledgeRepositoryProvider.tsx`
- Create: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Create: `apps/web/src/pages/dashboard/MetricCard.tsx`
- Create: `apps/web/src/pages/dashboard/RecentWorkspaceList.tsx`
- Create: `apps/web/src/pages/dashboard/RecentDocumentList.tsx`
- Test: `apps/web/src/pages/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: `KnowledgeRepository.getDashboard()`.
- Produces: `useKnowledgeRepository()`.
- Produces: dashboard loading, populated, empty, and failure views through TanStack Query.

- [x] **Step 1: Write failing dashboard-state tests**

Test one deferred promise for loading, one populated repository for metrics/recent lists, one empty repository for the first-workspace call to action, and one rejecting repository for retry UI.

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/pages/dashboard/DashboardPage.test.tsx`  
Expected: FAIL because the page/provider is missing.

- [x] **Step 3: Implement the repository provider and dashboard**

Keep query keys in a focused module and format dates with `Intl.DateTimeFormat`. All metric values must come from `DashboardSnapshot.metrics`.

- [x] **Step 4: Run dashboard tests**

Run: `npm test -- --run src/pages/dashboard/DashboardPage.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/data apps/web/src/pages/dashboard apps/web/src/main.tsx apps/web/src/app/router.tsx
git commit -m "feat: build repository-backed dashboard"
```

### Task 7: Workspace and collection navigation

**Files:**
- Create: `apps/web/src/pages/workspaces/WorkspaceListPage.tsx`
- Create: `apps/web/src/pages/workspaces/WorkspacePage.tsx`
- Create: `apps/web/src/pages/collections/CollectionPage.tsx`
- Create: `apps/web/src/components/StatePanel.tsx`
- Test: `apps/web/src/pages/workspaces/WorkspaceRoutes.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Interfaces:**
- Consumes: repository workspace and collection queries.
- Produces: direct-linkable workspace and collection pages with breadcrumbs.
- Produces: reusable `StatePanel` for empty, not-found, and recoverable error states.

- [x] **Step 1: Write failing route-state tests**

Cover a valid workspace, valid nested collection, empty collection list, unknown workspace, collection/workspace mismatch, and browser navigation between list and detail routes.

- [x] **Step 2: Run the focused test**

Run: `npm test -- --run src/pages/workspaces/WorkspaceRoutes.test.tsx`  
Expected: FAIL because the pages are missing.

- [x] **Step 3: Implement workspace and collection pages**

Render collection and document summaries from repository results. Link every card with React Router. A missing entity renders a clear not-found state with a safe route back to the workspace list.

- [x] **Step 4: Run route-state tests**

Run: `npm test -- --run src/pages/workspaces/WorkspaceRoutes.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/pages/workspaces apps/web/src/pages/collections apps/web/src/components/StatePanel.tsx apps/web/src/app/router.tsx
git commit -m "feat: add workspace and collection views"
```

### Task 8: Day 1 documentation and verification

**Files:**
- Create: `README.md`
- Create: `PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-08-27-day1-product-shell.md`

**Interfaces:**
- Consumes: all Day 1 deliverables.
- Produces: truthful setup, testing, architecture, limitations, and roadmap documentation.

- [x] **Step 1: Run the complete verification suite**

Run: `npm ci && npm run lint && npm run typecheck && npm test -- --run && npm run build`  
Expected: every command exits 0 with no failed tests.

- [x] **Step 2: Check acceptance criteria**

Confirm each Day 1 criterion in the design spec against a route, component, test, CI step, or documentation section. Record any gap as incomplete; do not re-label it complete.

- [x] **Step 3: Write documentation**

Document Node 20+, installation, scripts, demo-session limitations, the repository adapter boundary, implemented routes, tests, and the remaining Day 2–6 roadmap.

- [x] **Step 4: Commit**

```bash
git add README.md PROJECT_STATUS.md docs/superpowers/plans/2026-08-27-day1-product-shell.md
git commit -m "docs: record knowledge workspace Day 1 status"
```

- [x] **Step 5: Push and verify CI**

Push the Day 1 branch, open a pull request to `main`, and wait for CI. Merge only when the PR head is unchanged, all required steps pass, and documentation matches the verified result.
