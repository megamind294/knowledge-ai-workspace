import { fixtureKnowledgeRepository } from "./knowledgeRepository";

describe("fixtureKnowledgeRepository", () => {
  it("returns dashboard totals derived from the shared fixtures", async () => {
    const dashboard = await fixtureKnowledgeRepository.getDashboard();

    expect(dashboard.metrics.workspaces).toBe(
      dashboard.recentWorkspaces.length,
    );
    expect(dashboard.metrics.collections).toBe(
      dashboard.recentWorkspaces.reduce(
        (total, workspace) => total + workspace.collectionCount,
        0,
      ),
    );
    expect(dashboard.metrics.documents).toBeGreaterThan(0);
    expect(dashboard.metrics.indexedDocuments).toBeLessThanOrEqual(
      dashboard.metrics.documents,
    );
  });

  it("does not return a collection from another workspace", async () => {
    await expect(
      fixtureKnowledgeRepository.getCollection(
        "product-research",
        "onboarding",
      ),
    ).resolves.toBeNull();
  });

  it("returns null for unknown workspaces and collections", async () => {
    await expect(
      fixtureKnowledgeRepository.getWorkspace("missing-workspace"),
    ).resolves.toBeNull();
    await expect(
      fixtureKnowledgeRepository.getCollection(
        "product-research",
        "missing-collection",
      ),
    ).resolves.toBeNull();
  });

  it("returns fresh snapshots that cannot mutate fixture state", async () => {
    const first = await fixtureKnowledgeRepository.getDashboard();
    const originalName = first.recentWorkspaces[0]?.name;

    if (first.recentWorkspaces[0]) {
      first.recentWorkspaces[0].name = "Mutated by a consumer";
    }
    first.recentDocuments.splice(0);

    const second = await fixtureKnowledgeRepository.getDashboard();

    expect(second.recentWorkspaces[0]?.name).toBe(originalName);
    expect(second.recentDocuments.length).toBeGreaterThan(0);
  });
});
