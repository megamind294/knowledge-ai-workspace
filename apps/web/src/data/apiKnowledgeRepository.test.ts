import { createApiKnowledgeRepository } from "./apiKnowledgeRepository";

describe("API knowledge repository", () => {
  it("maps workspace, collection, document, and dashboard responses into the existing UI model", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/workspaces") return { workspaces: [{ id: "w1", name: "Research", slug: "research", description: "Sources", role: "owner", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }] };
      if (path === "/api/workspaces/w1") return { workspace: { id: "w1", name: "Research", slug: "research", description: "Sources", role: "owner", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } };
      if (path === "/api/workspaces/w1/collections") return { collections: [{ id: "c1", workspaceId: "w1", name: "Policies", description: "HR", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }] };
      if (path === "/api/workspaces/w1/collections/c1") return { collection: { id: "c1", workspaceId: "w1", name: "Policies", description: "HR", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } };
      if (path === "/api/workspaces/w1/documents") return { documents: [{ id: "d1", workspaceId: "w1", collectionId: "c1", originalFilename: "policy.pdf", mediaType: "application/pdf", sizeBytes: 1200, ingestionState: "indexed", failureReason: null, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }] };
      throw new Error(`Unexpected ${path}`);
    });
    const repository = createApiKnowledgeRepository({ request } as never);

    expect(await repository.getWorkspace("w1")).toMatchObject({ id: "w1", collectionCount: 1, documentCount: 1 });
    expect(await repository.getCollection("w1", "c1")).toMatchObject({ documentCount: 1, indexedDocumentCount: 1 });
    expect(await repository.getDocument("d1")).toMatchObject({ name: "policy.pdf", mediaType: "pdf", status: "indexed" });
    expect((await repository.getDashboard()).metrics).toEqual({ workspaces: 1, collections: 1, documents: 1, indexedDocuments: 1 });
  });

  it("maps metadata creation and retry to scoped API routes", async () => {
    const response = { document: { id: "d2", workspaceId: "w1", collectionId: null, originalFilename: "notes.txt", mediaType: "text/plain", sizeBytes: 20, ingestionState: "uploaded", failureReason: null, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } };
    const request = vi.fn(async (path:string, init?:RequestInit) => {
      if(path === "/api/workspaces/w1/documents" && init?.method === "POST") return response;
      if(path === "/api/workspaces/w1/documents") return {documents:[response.document]};
      if(path === "/api/workspaces") return {workspaces:[{id:"w1"}]};
      if(path === "/api/workspaces/w1/documents/d2/retry") return response;
      throw new Error(`Unexpected ${path}`);
    });
    const repository = createApiKnowledgeRepository({ request } as never);
    await repository.createDocument({ name: "notes.txt", mimeType: "text/plain", mediaType: "text", sizeBytes: 20, workspaceId: "w1", collectionId: null });
    await repository.retryDocument("d2");
    expect(request).toHaveBeenNthCalledWith(1, "/api/workspaces/w1/documents", expect.objectContaining({ method: "POST" }));
    expect(request).toHaveBeenCalledWith("/api/workspaces/w1/documents/d2/retry", expect.objectContaining({ method: "POST" }));
  });
});
