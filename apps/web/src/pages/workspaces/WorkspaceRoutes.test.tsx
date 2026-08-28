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
