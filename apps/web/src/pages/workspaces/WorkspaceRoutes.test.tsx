import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import type { KnowledgeRepository } from "../../data/knowledgeRepository";
import { fixtureKnowledgeRepository } from "../../data/knowledgeRepository";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function renderAuthenticatedRoute(
  initialEntry: string,
  repository: KnowledgeRepository = fixtureKnowledgeRepository,
) {
  window.localStorage.setItem(SESSION_KEY, "active");
  return renderAppRoutes([initialEntry], repository);
}

describe("workspace and collection routes", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("navigates from the workspace list to a repository-backed workspace", async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoute("/app/workspaces");

    await user.click(
      await screen.findByRole("link", { name: /product research/i }),
    );

    expect(
      await screen.findByRole("heading", { name: "Product research" }),
    ).toBeVisible();
    expect(screen.getByText("Market intelligence")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /all workspaces/i }),
    ).toHaveAttribute("href", "/app/workspaces");
  });

  it("creates a workspace and navigates to it in API mode", async () => {
    const user = userEvent.setup();
    const created = {
      id: "00000000-0000-4000-8000-000000000001",
      name: "Release evidence",
      description: "Deterministic browser sources",
      role: "owner" as const,
      collectionCount: 0,
      documentCount: 0,
      updatedAt: "2026-09-10T00:00:00.000Z",
    };
    const createWorkspace = vi.fn().mockResolvedValue(created);
    const repository = {
      ...fixtureKnowledgeRepository,
      mode: "api" as const,
      createWorkspace,
      async getWorkspace(id: string) {
        return id === created.id ? created : null;
      },
      async getCollections() {
        return [];
      },
    } satisfies KnowledgeRepository;
    renderAuthenticatedRoute("/app/workspaces", repository);

    await user.type(screen.getByLabelText("Workspace name"), "Release evidence");
    await user.type(screen.getByLabelText("Workspace slug"), "release-evidence");
    await user.type(
      screen.getByLabelText("Workspace description"),
      "Deterministic browser sources",
    );
    await user.click(screen.getByRole("button", { name: "Create workspace" }));

    expect(createWorkspace).toHaveBeenCalledWith({
      name: "Release evidence",
      slug: "release-evidence",
      description: "Deterministic browser sources",
    });
    expect(await screen.findByRole("heading", { name: "Release evidence" })).toBeVisible();
  });

  it("supports a direct nested collection URL with documents and breadcrumbs", async () => {
    renderAuthenticatedRoute(
      "/app/workspaces/product-research/collections/market-intelligence",
    );

    expect(
      await screen.findByRole("heading", { name: "Market intelligence" }),
    ).toBeVisible();
    expect(screen.getByText("European AI market outlook.pdf")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Product research" }),
    ).toHaveAttribute("href", "/app/workspaces/product-research");
  });

  it("shows an explicit empty state when a workspace has no collections", async () => {
    const repository = {
      ...fixtureKnowledgeRepository,
      async getCollections() {
        return [];
      },
    } as unknown as KnowledgeRepository;

    renderAuthenticatedRoute("/app/workspaces/product-research", repository);

    expect(
      await screen.findByRole("heading", { name: /no collections yet/i }),
    ).toBeVisible();
  });

  it("renders a recoverable state for an unknown workspace", async () => {
    renderAuthenticatedRoute("/app/workspaces/missing-workspace");

    expect(
      await screen.findByRole("heading", { name: /workspace not found/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /back to workspaces/i }),
    ).toHaveAttribute("href", "/app/workspaces");
  });

  it("rejects a collection that belongs to a different workspace", async () => {
    renderAuthenticatedRoute(
      "/app/workspaces/product-research/collections/onboarding",
    );

    expect(
      await screen.findByRole("heading", { name: /collection not found/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /back to workspaces/i }),
    ).toHaveAttribute("href", "/app/workspaces");
  });
});
