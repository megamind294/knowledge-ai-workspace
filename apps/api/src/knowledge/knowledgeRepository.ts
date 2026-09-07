import type { Collection, CreateCollectionRequest, CreateDocumentRequest, CreateWorkspaceRequest, KnowledgeDocument, Workspace } from "@knowledge-ai/contracts";

export type KnowledgeErrorCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT";
export class KnowledgeRepositoryError extends Error {
  constructor(public readonly code: KnowledgeErrorCode, message: string) { super(message); }
}

export interface KnowledgeRepository {
  listWorkspaces(userId: string): Promise<Workspace[]>;
  createWorkspace(userId: string, input: CreateWorkspaceRequest): Promise<Workspace>;
  getWorkspace(userId: string, workspaceId: string): Promise<Workspace | null>;
  listCollections(userId: string, workspaceId: string): Promise<Collection[] | null>;
  createCollection(userId: string, workspaceId: string, input: CreateCollectionRequest): Promise<Collection>;
  getCollection(userId: string, workspaceId: string, collectionId: string): Promise<Collection | null>;
  listDocuments(userId: string, workspaceId: string): Promise<KnowledgeDocument[] | null>;
  createDocument(userId: string, workspaceId: string, input: CreateDocumentRequest): Promise<KnowledgeDocument>;
  getDocument(userId: string, workspaceId: string, documentId: string): Promise<KnowledgeDocument | null>;
  authorizeDocumentUpload(userId: string, workspaceId: string, documentId: string): Promise<KnowledgeDocument>;
  retryDocument(userId: string, workspaceId: string, documentId: string): Promise<KnowledgeDocument>;
}
