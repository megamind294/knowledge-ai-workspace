import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import type {
  DatabasePool,
  DatabaseTransactionClient,
} from "../database/pool.js";
import {
  IngestionRepositoryError,
  type EmbeddedDocumentChunk,
  type IndexableDocument,
  type IndexRunInput,
  type IngestionRepository,
} from "./ingestionRepository.js";

const writableRoles = new Set(["owner", "admin", "member"]);

function indexableDocument(row: QueryResultRow): IndexableDocument {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    mediaType: row.media_type as string,
  };
}

function vectorLiteral(values: readonly number[]) {
  return `[${values.join(",")}]`;
}

async function rollback(client: DatabaseTransactionClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}

export class PostgresIngestionRepository implements IngestionRepository {
  constructor(
    private readonly pool: DatabasePool,
    private readonly createId = randomUUID,
  ) {}

  async beginIndexing(userId: string, input: IndexRunInput) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT d.id,d.workspace_id,d.media_type,m.role
         FROM documents d
         JOIN workspace_members m ON m.workspace_id=d.workspace_id
         WHERE d.id=$1 AND d.workspace_id=$2 AND m.user_id=$3`,
        [input.documentId, input.workspaceId, userId],
      );
      const row = result.rows[0];
      if (!row) {
        throw new IngestionRepositoryError("NOT_FOUND", "Document not found");
      }
      if (!writableRoles.has(row.role as string)) {
        throw new IngestionRepositoryError(
          "FORBIDDEN",
          "This workspace role is read-only",
        );
      }
      await client.query(
        `INSERT INTO document_index_runs
          (id,document_id,workspace_id,status,embedding_model,embedding_dimensions)
         VALUES ($1,$2,$3,'processing',$4,$5)`,
        [
          input.id,
          input.documentId,
          input.workspaceId,
          input.embeddingModel,
          input.embeddingDimensions,
        ],
      );
      await client.query(
        `UPDATE documents
         SET ingestion_state='processing',failure_reason=NULL,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND workspace_id=$2`,
        [input.documentId, input.workspaceId],
      );
      await client.query("COMMIT");
      return indexableDocument(row);
    } catch (error) {
      await rollback(client);
      if ((error as { code?: string }).code === "23505") {
        throw new IngestionRepositoryError(
          "CONFLICT",
          "Index run already exists",
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async appendChunks(
    runId: string,
    chunks: readonly EmbeddedDocumentChunk[],
  ) {
    if (chunks.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const run = await client.query<{
        document_id: string;
        workspace_id: string;
      }>(
        `SELECT document_id,workspace_id FROM document_index_runs
         WHERE id=$1 AND status='processing'`,
        [runId],
      );
      const current = run.rows[0];
      if (!current) {
        throw new IngestionRepositoryError(
          "CONFLICT",
          "Index run is not processing",
        );
      }
      const values: unknown[] = [];
      const rows = chunks.map((chunk, index) => {
        const offset = index * 10;
        values.push(
          this.createId(),
          runId,
          current.document_id,
          current.workspace_id,
          chunk.ordinal,
          chunk.text,
          chunk.wordCount,
          chunk.pageNumber ?? null,
          chunk.sectionHeading ?? null,
          vectorLiteral(chunk.embedding),
        );
        return `(${Array.from({ length: 10 }, (_, parameter) => `$${offset + parameter + 1}`).join(",")})`;
      });
      await client.query(
        `INSERT INTO document_chunks
          (id,index_run_id,document_id,workspace_id,ordinal,content,word_count,page_number,section_heading,embedding)
         VALUES ${rows.join(",")}`,
        values,
      );
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async activateIndex(runId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const run = await client.query<{
        document_id: string;
        workspace_id: string;
      }>(
        `SELECT document_id,workspace_id FROM document_index_runs
         WHERE id=$1 AND status='processing'`,
        [runId],
      );
      const current = run.rows[0];
      if (!current) {
        throw new IngestionRepositoryError(
          "CONFLICT",
          "Index run is not processing",
        );
      }
      await client.query(
        "SELECT id FROM documents WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
        [current.document_id, current.workspace_id],
      );
      const staged = await client.query(
        "SELECT 1 FROM document_chunks WHERE index_run_id=$1 LIMIT 1",
        [runId],
      );
      if (!staged.rowCount) {
        throw new IngestionRepositoryError(
          "CONFLICT",
          "Index run has no staged chunks",
        );
      }
      await client.query(
        `UPDATE document_index_runs SET status='superseded'
         WHERE document_id=$1 AND status='active'`,
        [current.document_id],
      );
      await client.query(
        `UPDATE document_index_runs
         SET status='active',completed_at=CURRENT_TIMESTAMP,failure_reason=NULL
         WHERE id=$1`,
        [runId],
      );
      await client.query(
        `UPDATE documents
         SET ingestion_state='indexed',failure_reason=NULL,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1 AND workspace_id=$2`,
        [current.document_id, current.workspace_id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async failIndex(runId: string, safeReason: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<{
        document_id: string;
        workspace_id: string;
      }>(
        `SELECT document_id,workspace_id FROM document_index_runs
         WHERE id=$1 AND status='processing'`,
        [runId],
      );
      const current = selected.rows[0];
      if (current) {
        await client.query(
          "SELECT id FROM documents WHERE id=$1 AND workspace_id=$2 FOR UPDATE",
          [current.document_id, current.workspace_id],
        );
        const run = await client.query(
          `UPDATE document_index_runs
           SET status='failed',failure_reason=$2,completed_at=CURRENT_TIMESTAMP
           WHERE id=$1 AND status='processing'`,
          [runId, safeReason],
        );
        if (!run.rowCount) {
          await client.query("COMMIT");
          return;
        }
        await client.query("DELETE FROM document_chunks WHERE index_run_id=$1", [
          runId,
        ]);
        const active = await client.query(
          `SELECT 1 FROM document_index_runs
           WHERE document_id=$1 AND status='active' LIMIT 1`,
          [current.document_id],
        );
        await client.query(
          `UPDATE documents
           SET ingestion_state=$3,failure_reason=$4,updated_at=CURRENT_TIMESTAMP
           WHERE id=$1 AND workspace_id=$2`,
          [
            current.document_id,
            current.workspace_id,
            active.rowCount ? "indexed" : "failed",
            active.rowCount ? null : safeReason,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
