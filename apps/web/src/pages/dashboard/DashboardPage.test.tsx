import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { DashboardSnapshot } from "../../domain/knowledge";
import {
  KnowledgeRepositoryProvider,
} from "../../data/KnowledgeRepositoryProvider";
import type { KnowledgeRepository } from "../../data/knowledgeRepository";
import { fixtureKnowledgeRepository } from "../../data/knowledgeRepository";
import { DashboardPage } from "./DashboardPage";

const emptyDashboard: DashboardSnapshot = {
  metrics: {
    workspaces: 0,
    collections: 0,
    documents: 0,
    indexedDocuments: 0,
  },
  recentWorkspaces: [],
  recentDocuments: [],
};

function createRepository(
  getDashboard: KnowledgeRepository["getDashboard"],
): KnowledgeRepository {
  return {
    ...fixtureKnowledgeRepository,
    getDashboard,
  };
}

function renderDashboard(repository: KnowledgeRepository) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <KnowledgeRepositoryProvider repository={repository}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </KnowledgeRepositoryProvider>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("shows a loading state while the repository request is pending", () => {
    renderDashboard(createRepository(() => new Promise(() => undefined)));

    expect(screen.getByRole("status")).toHaveTextContent(/loading dashboard/i);
  });

  it("renders repository metrics and recent knowledge", async () => {
    renderDashboard(fixtureKnowledgeRepository);

    expect(await screen.findByText("2", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("3", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("6", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("4", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("Product research")).toBeVisible();
    expect(screen.getByText("European AI market outlook.pdf")).toBeVisible();
  });

  it("offers a clear first action when the repository is empty", async () => {
    renderDashboard(createRepository(async () => emptyDashboard));

    expect(
      await screen.findByRole("heading", { name: /build your first workspace/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /explore workspaces/i }),
    ).toHaveAttribute("href", "/app/workspaces");
  });

  it("recovers from a repository failure when retry succeeds", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const repository = createRepository(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("Repository unavailable");
      }
      return emptyDashboard;
    });

    renderDashboard(repository);

    await user.click(
      await screen.findByRole("button", { name: /retry dashboard/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /build your first workspace/i }),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });
});
