import type { DocumentUploadCandidate } from "../domain/knowledge";
import {
  createFixtureKnowledgeRepository,
  fixtureKnowledgeRepository,
} from "./knowledgeRepository";

const uploadCandidate: DocumentUploadCandidate = {
  name: "Quarterly research.pdf",
  mediaType: "pdf",
  mimeType: "application/pdf",
  sizeBytes: 4_096,
  workspaceId: "product-research",
  collectionId: "market-intelligence",
};

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

  it("returns an immutable document detail snapshot", async () => {
    const repository = createFixtureKnowledgeRepository();
    const first = await repository.getDocument("europe-ai-market");

    expect(first).toMatchObject({
      id: "europe-ai-market",
      status: "indexed",
      failureReason: null,
    });

    if (first) {
      first.name = "Changed outside the repository";
      first.status = "failed";
    }

    await expect(
      repository.getDocument("europe-ai-market"),
    ).resolves.toMatchObject({
      name: "European AI market outlook.pdf",
      status: "indexed",
    });
  });

  it("creates an uploaded document and updates scoped totals", async () => {
    const repository = createFixtureKnowledgeRepository({
      now: () => new Date("2026-08-29T10:00:00.000Z"),
    });
    const before = await repository.getDashboard();

    const created = await repository.createDocument(uploadCandidate);
    const dashboard = await repository.getDashboard();
    const workspace = await repository.getWorkspace("product-research");
    const collection = await repository.getCollection(
      "product-research",
      "market-intelligence",
    );

    expect(created).toEqual({
      id: "local-document-1",
      workspaceId: "product-research",
      collectionId: "market-intelligence",
      name: "Quarterly research.pdf",
      mediaType: "pdf",
      status: "uploaded",
      sizeBytes: 4_096,
      failureReason: null,
      createdAt: "2026-08-29T10:00:00.000Z",
      updatedAt: "2026-08-29T10:00:00.000Z",
    });
    expect(dashboard.metrics.documents).toBe(before.metrics.documents + 1);
    expect(workspace?.documentCount).toBe(5);
    expect(collection?.documentCount).toBe(3);
    await expect(
      repository.getDocuments("product-research", "market-intelligence"),
    ).resolves.toContainEqual(created);
  });

  it("uses deterministic unique IDs for local documents", async () => {
    const repository = createFixtureKnowledgeRepository();

    const first = await repository.createDocument(uploadCandidate);
    const second = await repository.createDocument({
      ...uploadCandidate,
      name: "Follow-up research.pdf",
    });

    expect(first.id).toBe("local-document-1");
    expect(second.id).toBe("local-document-2");
  });

  it("retries only failed documents and clears their safe error", async () => {
    const repository = createFixtureKnowledgeRepository({
      now: () => new Date("2026-08-29T10:30:00.000Z"),
    });

    const retried = await repository.retryDocument("delivery-checklist");
    const unchanged = await repository.retryDocument("europe-ai-market");

    expect(retried).toMatchObject({
      status: "processing",
      failureReason: null,
      updatedAt: "2026-08-29T10:30:00.000Z",
    });
    expect(unchanged).toMatchObject({ status: "indexed" });
    await expect(
      repository.getDocument("delivery-checklist"),
    ).resolves.toMatchObject({ status: "processing", failureReason: null });
  });

  it("returns null when retrying an unknown document", async () => {
    const repository = createFixtureKnowledgeRepository();

    await expect(
      repository.retryDocument("missing-document"),
    ).resolves.toBeNull();
  });
});
