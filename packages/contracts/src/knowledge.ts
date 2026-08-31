import { z } from "zod";

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export const IngestionStateSchema = z.enum(["uploaded", "processing", "indexed", "failed"]);
export const DocumentMediaTypeSchema = z.enum([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const WorkspaceSchema = z.object({
  id: z.uuid(), name: z.string(), slug: z.string(), description: z.string(),
  role: WorkspaceRoleSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();
export const CollectionSchema = z.object({
  id: z.uuid(), workspaceId: z.uuid(), name: z.string(), description: z.string(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();
export const DocumentSchema = z.object({
  id: z.uuid(), workspaceId: z.uuid(), collectionId: z.uuid().nullable(),
  originalFilename: z.string(), mediaType: DocumentMediaTypeSchema, sizeBytes: z.number().int().nonnegative(),
  ingestionState: IngestionStateSchema, failureReason: z.string().nullable(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).strict();

export const CreateWorkspaceRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(500).default(""),
}).strict();
export const CreateCollectionRequestSchema = z.object({
  name: z.string().trim().min(1).max(100), description: z.string().trim().max(500).default(""),
}).strict();
export const CreateDocumentRequestSchema = z.object({
  collectionId: z.uuid().nullable().default(null), originalFilename: z.string().trim().min(1).max(255),
  mediaType: DocumentMediaTypeSchema, sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
}).strict();

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type KnowledgeDocument = z.infer<typeof DocumentSchema>;
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;
export type CreateCollectionRequest = z.infer<typeof CreateCollectionRequestSchema>;
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;
