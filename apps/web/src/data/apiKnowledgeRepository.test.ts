import type { RetrievalResult } from "@knowledge-ai/contracts";
import { ApiClientError } from "../api/apiClient";
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

  it("creates metadata, uploads the actual bytes, indexes, and refreshes durable state", async () => {
    const uploaded = { document: { id: "d2", workspaceId: "w1", collectionId: null, originalFilename: "notes.txt", mediaType: "text/plain", sizeBytes: 5, ingestionState: "uploaded", failureReason: null, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" } };
    const indexed = { document: { ...uploaded.document, ingestionState: "indexed" } };
    const request = vi.fn(async (path:string, init?:RequestInit) => {
      if(path === "/api/workspaces/w1/documents" && init?.method === "POST") return uploaded;
      if(path === "/api/workspaces/w1/documents/d2/content") return { upload: {} };
      if(path === "/api/workspaces/w1/documents/d2/index") return { index: {} };
      if(path === "/api/workspaces/w1/documents/d2") return indexed;
      throw new Error(`Unexpected ${path}`);
    });
    const repository = createApiKnowledgeRepository({ request } as never);
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const progress = vi.fn();

    await expect(repository.ingestDocument(
      { name: "notes.txt", mimeType: "text/plain", mediaType: "text", sizeBytes: 5, workspaceId: "w1", collectionId: null },
      file,
      progress,
    )).resolves.toMatchObject({ id: "d2", status: "indexed" });

    expect(request).toHaveBeenNthCalledWith(1, "/api/workspaces/w1/documents", expect.objectContaining({ method: "POST" }));
    expect(request).toHaveBeenNthCalledWith(2, "/api/workspaces/w1/documents/d2/content", expect.objectContaining({
      method: "POST",
      body: file,
      headers: { "Content-Type": "text/plain" },
    }));
    expect(request).toHaveBeenNthCalledWith(3, "/api/workspaces/w1/documents/d2/index", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(4, "/api/workspaces/w1/documents/d2");
    expect(progress.mock.calls.map(([stage]) => stage)).toEqual([
      "metadata",
      "upload",
      "index",
      "refresh",
    ]);
  });

  it("refreshes a durable failed state after indexing fails and retries by indexing", async () => {
    const failed = { document: { id: "d2", workspaceId: "w1", collectionId: null, originalFilename: "notes.txt", mediaType: "text/plain", sizeBytes: 5, ingestionState: "failed", failureReason: "Document parsing failed", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:01.000Z" } };
    const request = vi.fn(async (path:string, init?:RequestInit) => {
      if(path === "/api/workspaces") return {workspaces:[{id:"w1"}]};
      if(path === "/api/workspaces/w1/documents" && !init) return {documents:[failed.document]};
      if(path === "/api/workspaces/w1/documents/d2/index") throw new ApiClientError(422, "BAD_REQUEST", "Document could not be indexed");
      if(path === "/api/workspaces/w1/documents/d2") return failed;
      throw new Error(`Unexpected ${path}`);
    });
    const repository = createApiKnowledgeRepository({ request } as never);

    await expect(repository.retryDocument("d2")).resolves.toMatchObject({
      status: "failed",
      failureReason: "Document parsing failed",
    });
    expect(request).toHaveBeenCalledWith(
      "/api/workspaces/w1/documents/d2/index",
      { method: "POST" },
    );
    expect(request).not.toHaveBeenCalledWith(
      expect.stringContaining("/retry"),
      expect.anything(),
    );
  });

  it("performs scoped semantic source retrieval through the authenticated API client", async () => {
    const result: RetrievalResult = {
      chunkId: "00000000-0000-4000-8000-000000000040",
      documentId: "00000000-0000-4000-8000-000000000030",
      collectionId: null,
      originalFilename: "notes.txt",
      ordinal: 0,
      content: "Retention is seven years.",
      wordCount: 4,
      pageNumber: null,
      sectionHeading: "Retention",
      score: 0.9,
    };
    const request = vi.fn().mockResolvedValue({ results: [result] });
    const repository = createApiKnowledgeRepository({ request } as never);

    await expect(repository.searchKnowledge("w1", {
      query: "retention",
      scope: { type: "collection", collectionId: "c1" },
      topK: 5,
    })).resolves.toEqual([result]);
    expect(request).toHaveBeenCalledWith("/api/workspaces/w1/retrieval", {
      method: "POST",
      body: JSON.stringify({
        query: "retention",
        scope: { type: "collection", collectionId: "c1" },
        topK: 5,
      }),
    });
  });
});
