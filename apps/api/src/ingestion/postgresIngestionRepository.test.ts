import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { PostgresIngestionRepository } from "./postgresIngestionRepository.js";

const TEST_SCHEMA = "keystone_ingestion_repository_test";
const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  workspace: "10000000-0000-4000-8000-000000000010",
  document: "10000000-0000-4000-8000-000000000020",
  oldRun: "10000000-0000-4000-8000-000000000030",
  firstRun: "10000000-0000-4000-8000-000000000031",
  secondRun: "10000000-0000-4000-8000-000000000032",
};

const vector = `[${Array.from({ length: 1536 }, () => "1").join(",")}]`;
const chunk = {
  ordinal: 0,
  text: "bounded staged content",
  wordCount: 3,
  embedding: Array.from({ length: 1536 }, () => 1),
};

describePostgres("PostgresIngestionRepository transactions", () => {
  let pool: DatabasePool;
  let generatedId = 100;

  beforeAll(async () => {
    const admin = new Pool({ connectionString: databaseUrl });
    await admin.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
    await admin.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
    await admin.end();
    pool = new Pool({
      connectionString: databaseUrl,
      options: `-c search_path=${TEST_SCHEMA},public`,
    });
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function resetDocument() {
    await pool.query("DELETE FROM workspaces");
    await pool.query("DELETE FROM users");
    await pool.query(
      "INSERT INTO users (id,email,display_name) VALUES ($1,'owner@example.com','Owner')",
      [ids.owner],
    );
    await pool.query(
      "INSERT INTO workspaces (id,owner_id,name,slug) VALUES ($1,$2,'Research','research')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO documents (id,workspace_id,original_filename,media_type,size_bytes,ingestion_state) VALUES ($1,$2,'notes.txt','text/plain',10,'uploaded')",
      [ids.document, ids.workspace],
    );
  }

  function repository() {
    return new PostgresIngestionRepository(
      pool,
      () =>
        `10000000-0000-4000-8000-${String(++generatedId).padStart(12, "0")}`,
    );
  }

  async function beginAndStage(
    ingestion: PostgresIngestionRepository,
    runId: string,
  ) {
    await ingestion.beginIndexing(ids.owner, {
      id: runId,
      documentId: ids.document,
      workspaceId: ids.workspace,
      embeddingModel: "test-model",
      embeddingDimensions: 1536,
    });
    await ingestion.appendChunks(runId, [chunk]);
  }

  it("rolls back a failed activation and preserves the prior active index", async () => {
    await resetDocument();
    await pool.query(
      "UPDATE documents SET ingestion_state='indexed' WHERE id=$1",
      [ids.document],
    );
    await pool.query(
      "INSERT INTO document_index_runs (id,document_id,workspace_id,status,embedding_model,embedding_dimensions) VALUES ($1,$2,$3,'active','old-model',1536)",
      [ids.oldRun, ids.document, ids.workspace],
    );
    await pool.query(
      "INSERT INTO document_chunks (id,index_run_id,document_id,workspace_id,ordinal,content,word_count,embedding) VALUES ('10000000-0000-4000-8000-000000000099',$1,$2,$3,0,'old content',2,$4)",
      [ids.oldRun, ids.document, ids.workspace, vector],
    );
    const ingestion = repository();
    await beginAndStage(ingestion, ids.firstRun);

    await pool.query(`
      CREATE FUNCTION reject_target_activation() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = '${ids.firstRun}'::uuid AND NEW.status = 'active' THEN
          RAISE EXCEPTION 'forced activation failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_target_activation
      BEFORE UPDATE ON document_index_runs
      FOR EACH ROW EXECUTE FUNCTION reject_target_activation();
    `);

    await expect(ingestion.activateIndex(ids.firstRun)).rejects.toThrow(
      "forced activation failure",
    );
    await pool.query("DROP TRIGGER reject_target_activation ON document_index_runs");
    await pool.query("DROP FUNCTION reject_target_activation()");

    const afterRollback = await pool.query(
      "SELECT id,status FROM document_index_runs ORDER BY id",
    );
    expect(afterRollback.rows).toEqual([
      { id: ids.oldRun, status: "active" },
      { id: ids.firstRun, status: "processing" },
    ]);

    await ingestion.failIndex(ids.firstRun, "Activation failed");
    const [runs, chunks, document] = await Promise.all([
      pool.query("SELECT id,status FROM document_index_runs ORDER BY id"),
      pool.query("SELECT index_run_id FROM document_chunks ORDER BY index_run_id"),
      pool.query("SELECT ingestion_state,failure_reason FROM documents WHERE id=$1", [
        ids.document,
      ]),
    ]);
    expect(runs.rows).toEqual([
      { id: ids.oldRun, status: "active" },
      { id: ids.firstRun, status: "failed" },
    ]);
    expect(chunks.rows).toEqual([{ index_run_id: ids.oldRun }]);
    expect(document.rows).toEqual([
      { ingestion_state: "indexed", failure_reason: null },
    ]);
  });

  it("serializes overlapping activations for one document", async () => {
    await resetDocument();
    const first = repository();
    const second = repository();
    await beginAndStage(first, ids.firstRun);
    await beginAndStage(second, ids.secondRun);

    await expect(
      Promise.all([
        first.activateIndex(ids.firstRun),
        second.activateIndex(ids.secondRun),
      ]),
    ).resolves.toEqual([undefined, undefined]);

    const runs = await pool.query(
      "SELECT id,status FROM document_index_runs ORDER BY id",
    );
    expect(runs.rows.filter((run) => run.status === "active")).toHaveLength(1);
    expect(runs.rows.filter((run) => run.status === "superseded")).toHaveLength(1);
  });

  it("does not let a concurrent failure overwrite a successful activation", async () => {
    await resetDocument();
    const successful = repository();
    const failed = repository();
    await beginAndStage(successful, ids.firstRun);
    await beginAndStage(failed, ids.secondRun);
    await pool.query(`
      CREATE FUNCTION delay_target_activation() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = '${ids.firstRun}'::uuid AND NEW.status = 'active' THEN
          PERFORM pg_sleep(0.25);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER delay_target_activation
      BEFORE UPDATE ON document_index_runs
      FOR EACH ROW EXECUTE FUNCTION delay_target_activation();
    `);

    const activation = successful.activateIndex(ids.firstRun);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const failure = failed.failIndex(ids.secondRun, "Embedding provider failed");
    await Promise.all([activation, failure]);
    await pool.query("DROP TRIGGER delay_target_activation ON document_index_runs");
    await pool.query("DROP FUNCTION delay_target_activation()");

    const [runs, document] = await Promise.all([
      pool.query("SELECT id,status FROM document_index_runs ORDER BY id"),
      pool.query("SELECT ingestion_state,failure_reason FROM documents WHERE id=$1", [
        ids.document,
      ]),
    ]);
    expect(runs.rows).toEqual([
      { id: ids.firstRun, status: "active" },
      { id: ids.secondRun, status: "failed" },
    ]);
    expect(document.rows).toEqual([
      { ingestion_state: "indexed", failure_reason: null },
    ]);
  });
});
