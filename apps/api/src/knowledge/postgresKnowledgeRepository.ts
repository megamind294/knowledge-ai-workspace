import { randomUUID } from "node:crypto";
import type { Collection, CreateCollectionRequest, CreateDocumentRequest, CreateWorkspaceRequest, KnowledgeDocument, Workspace } from "@knowledge-ai/contracts";
import type { QueryResultRow } from "pg";
import type { DatabasePool, DatabaseTransactionClient } from "../database/pool.js";
import { KnowledgeRepositoryError, type KnowledgeRepository } from "./knowledgeRepository.js";

type Queryable = Pick<DatabasePool, "query"> | Pick<DatabaseTransactionClient, "query">;
const writableRoles = ["owner", "admin", "member"];
function iso(value: Date | string) { return new Date(value).toISOString(); }
function workspace(row: QueryResultRow): Workspace { return { id: row.id as string, name: row.name as string, slug: row.slug as string, description: row.description as string, role: row.role as Workspace["role"], createdAt: iso(row.created_at as Date), updatedAt: iso(row.updated_at as Date) }; }
function collection(row: QueryResultRow): Collection { return { id: row.id as string, workspaceId: row.workspace_id as string, name: row.name as string, description: row.description as string, createdAt: iso(row.created_at as Date), updatedAt: iso(row.updated_at as Date) }; }
function document(row: QueryResultRow): KnowledgeDocument { return { id: row.id as string, workspaceId: row.workspace_id as string, collectionId: row.collection_id as string | null, originalFilename: row.original_filename as string, mediaType: row.media_type as KnowledgeDocument["mediaType"], sizeBytes: Number(row.size_bytes), ingestionState: row.ingestion_state as KnowledgeDocument["ingestionState"], failureReason: row.failure_reason as string | null, createdAt: iso(row.created_at as Date), updatedAt: iso(row.updated_at as Date) }; }

export class PostgresKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly pool: DatabasePool, private readonly createId = randomUUID) {}
  async role(queryable: Queryable, userId: string, workspaceId: string) {
    const result = await queryable.query<{role: Workspace["role"]}>("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2", [workspaceId, userId]);
    return result.rows[0]?.role ?? null;
  }
  async requireWrite(queryable: Queryable, userId: string, workspaceId: string) {
    const role = await this.role(queryable, userId, workspaceId);
    if (!role) throw new KnowledgeRepositoryError("NOT_FOUND", "Workspace not found");
    if (!writableRoles.includes(role)) throw new KnowledgeRepositoryError("FORBIDDEN", "This workspace role is read-only");
  }
  async listWorkspaces(userId: string) { const r = await this.pool.query("SELECT w.*, m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 ORDER BY w.created_at, w.id", [userId]); return r.rows.map(workspace); }
  async createWorkspace(userId: string, input: CreateWorkspaceRequest) {
    const client = await this.pool.connect();
    try { await client.query("BEGIN"); const id = this.createId(); const r = await client.query("INSERT INTO workspaces (id,owner_id,name,slug,description) VALUES ($1,$2,$3,$4,$5) RETURNING *, 'owner' AS role", [id,userId,input.name,input.slug,input.description]); await client.query("INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner')",[id,userId]); await client.query("COMMIT"); return workspace(r.rows[0]!); }
    catch (error) { await client.query("ROLLBACK"); if ((error as {code?:string}).code === "23505") throw new KnowledgeRepositoryError("CONFLICT", "Workspace slug already exists"); throw error; } finally { client.release(); }
  }
  async getWorkspace(userId:string, workspaceId:string) { const r=await this.pool.query("SELECT w.*,m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2",[workspaceId,userId]); return r.rows[0] ? workspace(r.rows[0]) : null; }
  async listCollections(userId:string, workspaceId:string) { if (!(await this.role(this.pool,userId,workspaceId))) return null; const r=await this.pool.query("SELECT c.* FROM collections c JOIN workspace_members m ON m.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND m.user_id=$2 ORDER BY c.created_at,c.id",[workspaceId,userId]); return r.rows.map(collection); }
  async createCollection(userId:string, workspaceId:string, input:CreateCollectionRequest) { await this.requireWrite(this.pool,userId,workspaceId); try { const r=await this.pool.query("INSERT INTO collections (id,workspace_id,name,description) VALUES ($1,$2,$3,$4) RETURNING *",[this.createId(),workspaceId,input.name,input.description]); return collection(r.rows[0]!); } catch(error) { if ((error as {code?:string}).code === "23505") throw new KnowledgeRepositoryError("CONFLICT","Collection name already exists"); throw error; } }
  async getCollection(userId:string, workspaceId:string, collectionId:string) { const r=await this.pool.query("SELECT c.* FROM collections c JOIN workspace_members m ON m.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND c.id=$2 AND m.user_id=$3",[workspaceId,collectionId,userId]); return r.rows[0] ? collection(r.rows[0]) : null; }
  async listDocuments(userId:string, workspaceId:string) { if (!(await this.role(this.pool,userId,workspaceId))) return null; const r=await this.pool.query("SELECT d.* FROM documents d JOIN workspace_members m ON m.workspace_id=d.workspace_id WHERE d.workspace_id=$1 AND m.user_id=$2 ORDER BY d.created_at,d.id",[workspaceId,userId]); return r.rows.map(document); }
  async createDocument(userId:string, workspaceId:string, input:CreateDocumentRequest) { await this.requireWrite(this.pool,userId,workspaceId); if(input.collectionId && !(await this.getCollection(userId,workspaceId,input.collectionId))) throw new KnowledgeRepositoryError("NOT_FOUND","Collection not found"); const r=await this.pool.query("INSERT INTO documents (id,workspace_id,collection_id,original_filename,media_type,size_bytes,ingestion_state) VALUES ($1,$2,$3,$4,$5,$6,'uploaded') RETURNING *",[this.createId(),workspaceId,input.collectionId,input.originalFilename,input.mediaType,input.sizeBytes]); return document(r.rows[0]!); }
  async getDocument(userId:string, workspaceId:string, documentId:string) { const r=await this.pool.query("SELECT d.* FROM documents d JOIN workspace_members m ON m.workspace_id=d.workspace_id WHERE d.workspace_id=$1 AND d.id=$2 AND m.user_id=$3",[workspaceId,documentId,userId]); return r.rows[0] ? document(r.rows[0]) : null; }
  async retryDocument(userId:string, workspaceId:string, documentId:string) { await this.requireWrite(this.pool,userId,workspaceId); const r=await this.pool.query("UPDATE documents SET ingestion_state='processing',failure_reason=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND workspace_id=$2 AND ingestion_state='failed' RETURNING *",[documentId,workspaceId]); if(r.rows[0]) return document(r.rows[0]); const existing=await this.getDocument(userId,workspaceId,documentId); if(!existing) throw new KnowledgeRepositoryError("NOT_FOUND","Document not found"); throw new KnowledgeRepositoryError("CONFLICT","Only failed documents can be retried"); }
}
