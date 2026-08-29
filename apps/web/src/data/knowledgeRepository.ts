import type {
  CollectionSummary,
  DashboardSnapshot,
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
}

function copyWorkspace(workspace: WorkspaceSummary): WorkspaceSummary {
  return { ...workspace };
}

function copyCollection(collection: CollectionSummary): CollectionSummary {
  return { ...collection };
}

function copyDocument(document: RecentDocument): RecentDocument {
  return { ...document };
}

export const fixtureKnowledgeRepository: KnowledgeRepository = {
  async getDashboard() {
    return {
      metrics: {
        workspaces: workspaceFixtures.length,
        collections: collectionFixtures.length,
        documents: documentFixtures.length,
        indexedDocuments: documentFixtures.filter(
          (document) => document.status === "indexed",
        ).length,
      },
      recentWorkspaces: [...workspaceFixtures]
        .sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )
        .map(copyWorkspace),
      recentDocuments: [...documentFixtures]
        .sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt),
        )
        .map(copyDocument),
    };
  },

  async getWorkspaces() {
    return workspaceFixtures.map(copyWorkspace);
  },

  async getWorkspace(id) {
    const workspace = workspaceFixtures.find((item) => item.id === id);
    return workspace ? copyWorkspace(workspace) : null;
  },

  async getCollections(workspaceId) {
    return collectionFixtures
      .filter((collection) => collection.workspaceId === workspaceId)
      .map(copyCollection);
  },

  async getCollection(workspaceId, collectionId) {
    const collection = collectionFixtures.find(
      (item) =>
        item.workspaceId === workspaceId && item.id === collectionId,
    );
    return collection ? copyCollection(collection) : null;
  },

  async getDocuments(workspaceId, collectionId) {
    return documentFixtures
      .filter(
        (document) =>
          document.workspaceId === workspaceId &&
          (!collectionId || document.collectionId === collectionId),
      )
      .map(copyDocument);
  },
};
