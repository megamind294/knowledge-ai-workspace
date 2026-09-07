import type {
  Collection,
  KnowledgeDocument,
  RetrievalRequest,
  RetrievalResponse,
  Workspace,
} from "@knowledge-ai/contracts";
import { ApiClientError, type ApiClient } from "../api/apiClient";
import type {
  CollectionSummary,
  DocumentDetail,
  DocumentMediaType,
  DocumentUploadCandidate,
  IngestionProgressStage,
  WorkspaceSummary,
} from "../domain/knowledge";
import type { KnowledgeRepository } from "./knowledgeRepository";

const mediaToUi: Record<KnowledgeDocument["mediaType"], DocumentMediaType> = {
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

function doc(value: KnowledgeDocument): DocumentDetail {
  return {
    id: value.id,
    workspaceId: value.workspaceId,
    collectionId: value.collectionId,
    name: value.originalFilename,
    mediaType: mediaToUi[value.mediaType],
    status: value.ingestionState,
    sizeBytes: value.sizeBytes,
    failureReason: value.failureReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function missing(error: unknown) {
  return error instanceof ApiClientError && error.code === "NOT_FOUND";
}

export function createApiKnowledgeRepository(
  client: Pick<ApiClient, "request">,
): KnowledgeRepository {
  async function workspaces() {
    return (
      await client.request<{ workspaces: Workspace[] }>("/api/workspaces")
    ).workspaces;
  }

  async function collections(workspaceId: string) {
    return (
      await client.request<{ collections: Collection[] }>(
        `/api/workspaces/${workspaceId}/collections`,
      )
    ).collections;
  }

  async function documents(workspaceId: string) {
    return (
      await client.request<{ documents: KnowledgeDocument[] }>(
        `/api/workspaces/${workspaceId}/documents`,
      )
    ).documents;
  }

  async function document(workspaceId: string, documentId: string) {
    return (
      await client.request<{ document: KnowledgeDocument }>(
        `/api/workspaces/${workspaceId}/documents/${documentId}`,
      )
    ).document;
  }

  async function workspaceSummary(value: Workspace): Promise<WorkspaceSummary> {
    const [workspaceCollections, workspaceDocuments] = await Promise.all([
      collections(value.id),
      documents(value.id),
    ]);
    return {
      id: value.id,
      name: value.name,
      description: value.description,
      role: value.role,
      collectionCount: workspaceCollections.length,
      documentCount: workspaceDocuments.length,
      updatedAt: value.updatedAt,
    };
  }

  async function collectionSummary(
    value: Collection,
  ): Promise<CollectionSummary> {
    const collectionDocuments = (await documents(value.workspaceId)).filter(
      (item) => item.collectionId === value.id,
    );
    return {
      id: value.id,
      workspaceId: value.workspaceId,
      name: value.name,
      description: value.description,
      documentCount: collectionDocuments.length,
      indexedDocumentCount: collectionDocuments.filter(
        (item) => item.ingestionState === "indexed",
      ).length,
      updatedAt: value.updatedAt,
    };
  }

  async function allDocuments() {
    const workspaceList = await workspaces();
    return (
      await Promise.all(workspaceList.map((item) => documents(item.id)))
    ).flat();
  }

  async function createDocument(candidate: DocumentUploadCandidate) {
    const response = await client.request<{ document: KnowledgeDocument }>(
      `/api/workspaces/${candidate.workspaceId}/documents`,
      {
        method: "POST",
        body: JSON.stringify({
          collectionId: candidate.collectionId,
          originalFilename: candidate.name,
          mediaType: candidate.mimeType,
          sizeBytes: candidate.sizeBytes,
        }),
      },
    );
    return response.document;
  }

  async function indexAndRefresh(workspaceId: string, documentId: string) {
    try {
      await client.request(
        `/api/workspaces/${workspaceId}/documents/${documentId}/index`,
        { method: "POST" },
      );
    } catch (indexError) {
      const durable = await document(workspaceId, documentId);
      if (durable.ingestionState === "failed") return doc(durable);
      throw indexError;
    }
    return doc(await document(workspaceId, documentId));
  }

  return {
    mode: "api",

    async getDashboard() {
      const workspaceList = await workspaces();
      const [summaries, all, allCollections] = await Promise.all([
        Promise.all(workspaceList.map(workspaceSummary)),
        Promise.all(workspaceList.map((item) => documents(item.id))).then(
          (values) => values.flat(),
        ),
        Promise.all(workspaceList.map((item) => collections(item.id))).then(
          (values) => values.flat(),
        ),
      ]);
      return {
        metrics: {
          workspaces: workspaceList.length,
          collections: allCollections.length,
          documents: all.length,
          indexedDocuments: all.filter(
            (item) => item.ingestionState === "indexed",
          ).length,
        },
        recentWorkspaces: summaries.sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        ),
        recentDocuments: all
          .map(doc)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      };
    },

    async getWorkspaces() {
      return Promise.all((await workspaces()).map(workspaceSummary));
    },

    async getWorkspace(id) {
      try {
        const value = (
          await client.request<{ workspace: Workspace }>(
            `/api/workspaces/${id}`,
          )
        ).workspace;
        return workspaceSummary(value);
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },

    async getCollections(workspaceId) {
      return Promise.all(
        (await collections(workspaceId)).map(collectionSummary),
      );
    },

    async getCollection(workspaceId, collectionId) {
      try {
        const value = (
          await client.request<{ collection: Collection }>(
            `/api/workspaces/${workspaceId}/collections/${collectionId}`,
          )
        ).collection;
        return collectionSummary(value);
      } catch (error) {
        if (missing(error)) return null;
        throw error;
      }
    },

    async getDocuments(workspaceId, collectionId) {
      return (await documents(workspaceId))
        .filter((item) => !collectionId || item.collectionId === collectionId)
        .map(doc);
    },

    async getDocument(id) {
      for (const value of await allDocuments()) {
        if (value.id === id) return doc(value);
      }
      return null;
    },

    async createDocument(candidate) {
      return doc(await createDocument(candidate));
    },

    async ingestDocument(candidate, file, onProgress) {
      const progress = (stage: IngestionProgressStage) => onProgress?.(stage);
      progress("metadata");
      const created = await createDocument(candidate);
      progress("upload");
      await client.request(
        `/api/workspaces/${created.workspaceId}/documents/${created.id}/content`,
        {
          method: "POST",
          body: file,
          headers: { "Content-Type": created.mediaType },
        },
      );
      progress("index");
      try {
        await client.request(
          `/api/workspaces/${created.workspaceId}/documents/${created.id}/index`,
          { method: "POST" },
        );
      } catch (indexError) {
        progress("refresh");
        const durable = await document(created.workspaceId, created.id);
        if (durable.ingestionState === "failed") return doc(durable);
        throw indexError;
      }
      progress("refresh");
      return doc(await document(created.workspaceId, created.id));
    },

    async retryDocument(id) {
      for (const value of await allDocuments()) {
        if (value.id === id) return indexAndRefresh(value.workspaceId, id);
      }
      return null;
    },

    async searchKnowledge(workspaceId, request: RetrievalRequest) {
      const response = await client.request<RetrievalResponse>(
        `/api/workspaces/${workspaceId}/retrieval`,
        { method: "POST", body: JSON.stringify(request) },
      );
      return response.results;
    },
  };
}
