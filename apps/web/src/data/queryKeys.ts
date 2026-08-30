export const knowledgeQueryKeys = {
  dashboard: ["knowledge", "dashboard"] as const,
  workspaces: ["knowledge", "workspaces"] as const,
  workspace: (workspaceId: string) =>
    ["knowledge", "workspace", workspaceId] as const,
  collections: (workspaceId: string) =>
    ["knowledge", "workspace", workspaceId, "collections"] as const,
  collection: (workspaceId: string, collectionId: string) =>
    ["knowledge", "workspace", workspaceId, "collection", collectionId] as const,
  documents: ["knowledge", "documents"] as const,
  scopeDocuments: (workspaceId: string, collectionId: string) =>
    ["knowledge", "scope-documents", workspaceId, collectionId || "all"] as const,
  document: (documentId: string) =>
    ["knowledge", "document", documentId] as const,
};
