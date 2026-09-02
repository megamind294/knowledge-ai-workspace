import type { RetrievalResult, RetrievalScope } from "@knowledge-ai/contracts";
import type { QueryResultRow } from "pg";
import type { DatabasePool } from "../database/pool.js";
import type { RetrievalRepository } from "./retrievalRepository.js";

function vectorLiteral(values: readonly number[]) {
  return `[${values.join(",")}]`;
}

function resultFromRow(row: QueryResultRow): RetrievalResult {
  const score = Number(row.score);
  return {
    chunkId: row.chunk_id as string,
    documentId: row.document_id as string,
    collectionId: (row.collection_id as string | null) ?? null,
    originalFilename: row.original_filename as string,
    ordinal: row.ordinal as number,
    content: row.content as string,
    wordCount: row.word_count as number,
    pageNumber: (row.page_number as number | null) ?? null,
    sectionHeading: (row.section_heading as string | null) ?? null,
    score: Math.max(-1, Math.min(1, score)),
  };
}

export class PostgresRetrievalRepository implements RetrievalRepository {
  constructor(private readonly pool: DatabasePool) {}

  async canAccessScope(
    userId: string,
    workspaceId: string,
    scope: RetrievalScope,
  ) {
    const membership = await this.pool.query(
      `SELECT 1 FROM workspace_members
       WHERE workspace_id=$1 AND user_id=$2`,
      [workspaceId, userId],
    );
    if (!membership.rowCount) return false;

    if (scope.type === "collection") {
      const collection = await this.pool.query(
        "SELECT 1 FROM collections WHERE id=$1 AND workspace_id=$2",
        [scope.collectionId, workspaceId],
      );
      return Boolean(collection.rowCount);
    }
    if (scope.type === "document") {
      const document = await this.pool.query(
        "SELECT 1 FROM documents WHERE id=$1 AND workspace_id=$2",
        [scope.documentId, workspaceId],
      );
      return Boolean(document.rowCount);
    }
    return true;
  }

  async search(
    userId: string,
    workspaceId: string,
    embedding: readonly number[],
    scope: RetrievalScope,
    topK: number,
  ) {
    if (!(await this.canAccessScope(userId, workspaceId, scope))) return null;

    const values: unknown[] = [workspaceId, vectorLiteral(embedding), topK];
    let scopeClause = "";
    if (scope.type === "collection") {
      values.push(scope.collectionId);
      scopeClause = "AND d.collection_id=$4";
    } else if (scope.type === "document") {
      values.push(scope.documentId);
      scopeClause = "AND d.id=$4";
    }

    const rows = await this.pool.query(
      `SELECT c.id AS chunk_id,c.document_id,d.collection_id,
              d.original_filename,c.ordinal,c.content,c.word_count,
              c.page_number,c.section_heading,
              1 - (c.embedding <=> $2::public.vector) AS score
       FROM document_chunks c
       JOIN document_index_runs r
         ON r.id=c.index_run_id AND r.status='active'
       JOIN documents d
         ON d.id=c.document_id AND d.workspace_id=c.workspace_id
       WHERE c.workspace_id=$1
       ${scopeClause}
       ORDER BY c.embedding <=> $2::public.vector,c.id
       LIMIT $3`,
      values,
    );
    return rows.rows.map(resultFromRow);
  }
}
