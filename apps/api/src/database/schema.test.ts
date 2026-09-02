import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import type { DatabasePool } from "./pool.js";
import { createPgMemPool } from "../testSupport/pgMem.js";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  member: "00000000-0000-4000-8000-000000000002",
  workspace: "00000000-0000-4000-8000-000000000010",
  workspaceTwo: "00000000-0000-4000-8000-000000000011",
  collection: "00000000-0000-4000-8000-000000000020",
  collectionTwo: "00000000-0000-4000-8000-000000000021",
  document: "00000000-0000-4000-8000-000000000030",
  documentTwo: "00000000-0000-4000-8000-000000000031",
  run: "00000000-0000-4000-8000-000000000040",
  runTwo: "00000000-0000-4000-8000-000000000041",
  chunk: "00000000-0000-4000-8000-000000000050",
};

const embedding = `[${Array.from({ length: 1536 }, () => "1").join(",")}]`;

const TEST_SCHEMA = "keystone_schema_test";

async function createPostgresTestPool(databaseUrl: string) {
  const admin = new Pool({ connectionString: databaseUrl });
  await admin.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
  await admin.query(`CREATE SCHEMA ${TEST_SCHEMA}`);
  await admin.end();
  return new Pool({
    connectionString: databaseUrl,
    options: `-c search_path=${TEST_SCHEMA},public`,
  });
}

describe.sequential("PostgreSQL schema", () => {
  let pool: DatabasePool;

  beforeEach(async () => {
    if (process.env.TEST_DATABASE_URL) {
      pool = await createPostgresTestPool(process.env.TEST_DATABASE_URL);
    } else {
      pool = createPgMemPool();
    }
  });

  afterEach(async () => {
    await pool.end();
  });

  it("applies core and ingestion migrations exactly once", async () => {
    await runMigrations(pool);
    await runMigrations(pool);

    const result = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    expect(result.rows).toEqual([
      { name: "001_day3_core.sql" },
      { name: "002_day4_ingestion.sql" },
    ]);
  });

  it("serializes concurrent startup migration attempts", async () => {
    await Promise.all([runMigrations(pool), runMigrations(pool)]);

    const result = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    expect(result.rows).toEqual([
      { name: "001_day3_core.sql" },
      { name: "002_day4_ingestion.sql" },
    ]);
  });

  it("enforces membership roles and unique workspace membership", async () => {
    await runMigrations(pool);
    await pool.query(
      "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3), ($4, $5, $6)",
      [ids.owner, "owner@example.com", "Owner", ids.member, "member@example.com", "Member"],
    );
    await pool.query(
      "INSERT INTO workspaces (id, owner_id, name, slug) VALUES ($1, $2, $3, $4)",
      [ids.workspace, ids.owner, "Research", "research"],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
      [ids.workspace, ids.owner, "owner"],
    );

    await expect(
      pool.query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
        [ids.workspace, ids.member, "superuser"],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)",
        [ids.workspace, ids.owner, "admin"],
      ),
    ).rejects.toThrow();
  });

  it("cascades workspace-owned collections, documents, and memberships", async () => {
    await runMigrations(pool);
    await pool.query(
      "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)",
      [ids.owner, "owner@example.com", "Owner"],
    );
    await pool.query(
      "INSERT INTO workspaces (id, owner_id, name, slug) VALUES ($1, $2, $3, $4)",
      [ids.workspace, ids.owner, "Research", "research"],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO collections (id, workspace_id, name) VALUES ($1, $2, $3)",
      [ids.collection, ids.workspace, "Market intelligence"],
    );
    await pool.query(
      `INSERT INTO documents
        (id, workspace_id, collection_id, original_filename, media_type, size_bytes, ingestion_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        ids.document,
        ids.workspace,
        ids.collection,
        "market.pdf",
        "application/pdf",
        1024,
        "uploaded",
      ],
    );

    await pool.query("DELETE FROM workspaces WHERE id = $1", [ids.workspace]);

    const [members, collections, documents] = await Promise.all([
      pool.query("SELECT 1 FROM workspace_members"),
      pool.query("SELECT 1 FROM collections"),
      pool.query("SELECT 1 FROM documents"),
    ]);
    expect(members.rowCount).toBe(0);
    expect(collections.rowCount).toBe(0);
    expect(documents.rowCount).toBe(0);
  });

  it("prevents a document from referencing another workspace's collection", async () => {
    await runMigrations(pool);
    await pool.query(
      "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)",
      [ids.owner, "owner@example.com", "Owner"],
    );
    await pool.query(
      `INSERT INTO workspaces (id, owner_id, name, slug)
       VALUES ($1, $3, 'One', 'one'), ($2, $3, 'Two', 'two')`,
      [ids.workspace, ids.workspaceTwo, ids.owner],
    );
    await pool.query(
      "INSERT INTO collections (id, workspace_id, name) VALUES ($1, $2, $3)",
      [ids.collectionTwo, ids.workspaceTwo, "Second workspace"],
    );

    await expect(
      pool.query(
        `INSERT INTO documents
          (id, workspace_id, collection_id, original_filename, media_type, size_bytes, ingestion_state)
         VALUES ($1, $2, $3, 'cross-scope.txt', 'text/plain', 10, 'uploaded')`,
        [ids.document, ids.workspace, ids.collectionTwo],
      ),
    ).rejects.toThrow();
  });

  async function seedIndexableDocuments() {
    await pool.query(
      "INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)",
      [ids.owner, "owner@example.com", "Owner"],
    );
    await pool.query(
      `INSERT INTO workspaces (id, owner_id, name, slug)
       VALUES ($1, $3, 'One', 'one'), ($2, $3, 'Two', 'two')`,
      [ids.workspace, ids.workspaceTwo, ids.owner],
    );
    await pool.query(
      `INSERT INTO documents
        (id, workspace_id, original_filename, media_type, size_bytes, ingestion_state)
       VALUES ($1, $2, 'one.txt', 'text/plain', 10, 'uploaded'),
              ($3, $4, 'two.txt', 'text/plain', 10, 'uploaded')`,
      [ids.document, ids.workspace, ids.documentTwo, ids.workspaceTwo],
    );
  }

  async function insertRun(
    id: string,
    documentId: string,
    workspaceId: string,
    status: "processing" | "active" | "failed" | "superseded",
  ) {
    return pool.query(
      `INSERT INTO document_index_runs
        (id, document_id, workspace_id, status, embedding_model, embedding_dimensions)
       VALUES ($1, $2, $3, $4, 'text-embedding-3-small', 1536)`,
      [id, documentId, workspaceId, status],
    );
  }

  it("installs pgvector-backed ingestion relations", async () => {
    await runMigrations(pool);

    if (process.env.TEST_DATABASE_URL) {
      const extension = await pool.query<{ extname: string }>(
        "SELECT extname FROM pg_extension WHERE extname = 'vector'",
      );
      expect(extension.rows).toEqual([{ extname: "vector" }]);
    }

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name IN ('document_index_runs', 'document_chunks')
       ORDER BY table_name`,
      [process.env.TEST_DATABASE_URL ? TEST_SCHEMA : "public"],
    );
    expect(tables.rows).toEqual([
      { table_name: "document_chunks" },
      { table_name: "document_index_runs" },
    ]);
  });

  it("permits only one active index run per document", async () => {
    await runMigrations(pool);
    await seedIndexableDocuments();
    await insertRun(ids.run, ids.document, ids.workspace, "active");

    await expect(
      insertRun(ids.runTwo, ids.document, ids.workspace, "active"),
    ).rejects.toThrow();
    await expect(
      insertRun(ids.runTwo, ids.document, ids.workspace, "processing"),
    ).resolves.toBeDefined();
  });

  it("rejects cross-workspace index runs and chunk references", async () => {
    await runMigrations(pool);
    await seedIndexableDocuments();

    await expect(
      insertRun(ids.run, ids.document, ids.workspaceTwo, "processing"),
    ).rejects.toThrow();
    await insertRun(ids.run, ids.document, ids.workspace, "processing");
    await expect(
      pool.query(
        `INSERT INTO document_chunks
          (id, index_run_id, document_id, workspace_id, ordinal, content, word_count, embedding)
         VALUES ($1, $2, $3, $4, 0, 'valid source', 2, $5)`,
        [ids.chunk, ids.run, ids.document, ids.workspace, embedding],
      ),
    ).resolves.toBeDefined();
    await expect(
      pool.query(
        `INSERT INTO document_chunks
          (id, index_run_id, document_id, workspace_id, ordinal, content, word_count, embedding)
         VALUES ($1, $2, $3, $4, 0, 'private source', 2, $5)`,
        [ids.runTwo, ids.run, ids.documentTwo, ids.workspaceTwo, embedding],
      ),
    ).rejects.toThrow();
  });

  it("enforces chunk ordinals and vector dimensions, then cascades active data", async () => {
    await runMigrations(pool);
    await seedIndexableDocuments();
    await insertRun(ids.run, ids.document, ids.workspace, "active");
    await pool.query(
      `INSERT INTO document_chunks
        (id, index_run_id, document_id, workspace_id, ordinal, content, word_count, page_number, embedding)
       VALUES ($1, $2, $3, $4, 0, 'searchable content', 2, 1, $5)`,
      [ids.chunk, ids.run, ids.document, ids.workspace, embedding],
    );

    await expect(
      pool.query(
        `INSERT INTO document_chunks
          (id, index_run_id, document_id, workspace_id, ordinal, content, word_count, embedding)
         VALUES ($1, $2, $3, $4, 0, 'duplicate ordinal', 2, $5)`,
        [ids.runTwo, ids.run, ids.document, ids.workspace, embedding],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `INSERT INTO document_chunks
          (id, index_run_id, document_id, workspace_id, ordinal, content, word_count, embedding)
         VALUES ($1, $2, $3, $4, 1, 'wrong vector', 2, '[0,0,0]')`,
        [ids.runTwo, ids.run, ids.document, ids.workspace],
      ),
    ).rejects.toThrow();

    await pool.query("DELETE FROM documents WHERE id = $1", [ids.document]);
    const [runs, chunks] = await Promise.all([
      pool.query("SELECT 1 FROM document_index_runs"),
      pool.query("SELECT 1 FROM document_chunks"),
    ]);
    expect(runs.rowCount).toBe(0);
    expect(chunks.rowCount).toBe(0);
  });

  it("supports transactional replacement of an active index", async () => {
    await runMigrations(pool);
    await seedIndexableDocuments();
    await insertRun(ids.run, ids.document, ids.workspace, "active");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE document_index_runs SET status = 'superseded' WHERE id = $1",
        [ids.run],
      );
      await client.query(
        `INSERT INTO document_index_runs
          (id, document_id, workspace_id, status, embedding_model, embedding_dimensions)
         VALUES ($1, $2, $3, 'active', 'text-embedding-3-small', 1536)`,
        [ids.runTwo, ids.document, ids.workspace],
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const active = await pool.query<{ id: string }>(
      "SELECT id FROM document_index_runs WHERE document_id = $1 AND status = 'active'",
      [ids.document],
    );
    expect(active.rows).toEqual([{ id: ids.runTwo }]);
  });
});
