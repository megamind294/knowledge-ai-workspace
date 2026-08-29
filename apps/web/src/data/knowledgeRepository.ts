import type {
  CollectionSummary,
  DashboardSnapshot,
  DocumentDetail,
  DocumentUploadCandidate,
  RecentDocument,
  WorkspaceSummary,
} from "../domain/knowledge";
import {
  collectionFixtures,
  documentFixtures,
  workspaceFixtures,
} from "./fixtures";

export interface KnowledgeRepository {
  getDashboard(): Promise<DashboardSnapshot>;
  getWorkspaces(): Promise<WorkspaceSummary[]>;
  getWorkspace(id: string): Promise<WorkspaceSummary | null>;
  getCollections(workspaceId: string): Promise<CollectionSummary[]>;
  getCollection(
    workspaceId: string,
    collectionId: string,
  ): Promise<CollectionSummary | null>;
  getDocuments(
    workspaceId: string,
    collectionId?: string,
  ): Promise<RecentDocument[]>;
  getDocument(id: string): Promise<DocumentDetail | null>;
  createDocument(
    candidate: DocumentUploadCandidate,
  ): Promise<DocumentDetail>;
  retryDocument(id: string): Promise<DocumentDetail | null>;
}

interface FixtureRepositoryOptions {
  now?: () => Date;
}

function copyWorkspace(workspace: WorkspaceSummary): WorkspaceSummary {
  return { ...workspace };
}

function copyCollection(collection: CollectionSummary): CollectionSummary {
  return { ...collection };
}

function copyDocument(document: DocumentDetail): DocumentDetail {
  return { ...document };
}

function initialDocumentDetails(): DocumentDetail[] {
  return documentFixtures.map((document) => ({
    ...document,
    createdAt: document.updatedAt,
    failureReason:
      document.status === "failed"
        ? "Text extraction could not be completed."
        : null,
  }));
}

export function createFixtureKnowledgeRepository(
  options: FixtureRepositoryOptions = {},
): KnowledgeRepository {
  const now = options.now ?? (() => new Date());
  const workspaces = workspaceFixtures.map(copyWorkspace);
  const collections = collectionFixtures.map(copyCollection);
  const documents = initialDocumentDetails();
  let nextDocumentId = 1;

  return {
    async getDashboard() {
      return {
        metrics: {
          workspaces: workspaces.length,
          collections: collections.length,
          documents: documents.length,
          indexedDocuments: documents.filter(
            (document) => document.status === "indexed",
          ).length,
        },
        recentWorkspaces: [...workspaces]
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          )
          .map(copyWorkspace),
        recentDocuments: [...documents]
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          )
          .map(copyDocument),
      };
    },

    async getWorkspaces() {
      return workspaces.map(copyWorkspace);
    },

    async getWorkspace(id) {
      const workspace = workspaces.find((item) => item.id === id);
      return workspace ? copyWorkspace(workspace) : null;
    },

    async getCollections(workspaceId) {
      return collections
        .filter((collection) => collection.workspaceId === workspaceId)
        .map(copyCollection);
    },

    async getCollection(workspaceId, collectionId) {
      const collection = collections.find(
        (item) =>
          item.workspaceId === workspaceId && item.id === collectionId,
      );
      return collection ? copyCollection(collection) : null;
    },

    async getDocuments(workspaceId, collectionId) {
      return documents
        .filter(
          (document) =>
            document.workspaceId === workspaceId &&
            (!collectionId || document.collectionId === collectionId),
        )
        .map(copyDocument);
    },

    async getDocument(id) {
      const document = documents.find((item) => item.id === id);
      return document ? copyDocument(document) : null;
    },

    async createDocument(candidate) {
      const timestamp = now().toISOString();
      const document: DocumentDetail = {
        id: `local-document-${nextDocumentId}`,
        workspaceId: candidate.workspaceId,
        collectionId: candidate.collectionId,
        name: candidate.name,
        mediaType: candidate.mediaType,
        status: "uploaded",
        sizeBytes: candidate.sizeBytes,
        failureReason: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      nextDocumentId += 1;
      documents.push(document);

      const workspace = workspaces.find(
        (item) => item.id === candidate.workspaceId,
      );
      if (workspace) {
        workspace.documentCount += 1;
        workspace.updatedAt = timestamp;
      }

      const collection = collections.find(
        (item) =>
          item.workspaceId === candidate.workspaceId &&
          item.id === candidate.collectionId,
      );
      if (collection) {
        collection.documentCount += 1;
        collection.updatedAt = timestamp;
      }

      return copyDocument(document);
    },

    async retryDocument(id) {
      const document = documents.find((item) => item.id === id);
      if (!document) {
        return null;
      }

      if (document.status === "failed") {
        document.status = "processing";
        document.failureReason = null;
        document.updatedAt = now().toISOString();
      }

      return copyDocument(document);
    },
  };
}

export const fixtureKnowledgeRepository =
  createFixtureKnowledgeRepository();
