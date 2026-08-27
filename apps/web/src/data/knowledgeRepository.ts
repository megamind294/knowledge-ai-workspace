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
  getWorkspace(id: string): Promise<WorkspaceSummary | null>;
  getCollection(
    workspaceId: string,
    collectionId: string,
  ): Promise<CollectionSummary | null>;
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

  async getWorkspace(id) {
    const workspace = workspaceFixtures.find((item) => item.id === id);
    return workspace ? copyWorkspace(workspace) : null;
  },

  async getCollection(workspaceId, collectionId) {
    const collection = collectionFixtures.find(
      (item) =>
        item.workspaceId === workspaceId && item.id === collectionId,
    );
    return collection ? copyCollection(collection) : null;
  },
};
