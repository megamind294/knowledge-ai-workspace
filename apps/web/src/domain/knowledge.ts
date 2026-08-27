export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export type DocumentMediaType = "pdf" | "text" | "markdown" | "docx";

export type IngestionStatus =
  | "uploaded"
  | "processing"
  | "indexed"
  | "failed";

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string;
  role: WorkspaceRole;
  collectionCount: number;
  documentCount: number;
  updatedAt: string;
}

export interface CollectionSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  documentCount: number;
  indexedDocumentCount: number;
  updatedAt: string;
}

export interface RecentDocument {
  id: string;
  workspaceId: string;
  collectionId: string;
  name: string;
  mediaType: DocumentMediaType;
  status: IngestionStatus;
  sizeBytes: number;
  updatedAt: string;
}

export interface DashboardMetrics {
  workspaces: number;
  collections: number;
  documents: number;
  indexedDocuments: number;
}

export interface DashboardSnapshot {
  metrics: DashboardMetrics;
  recentWorkspaces: WorkspaceSummary[];
  recentDocuments: RecentDocument[];
}
