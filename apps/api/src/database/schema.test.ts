import { newDb } from "pg-mem";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate.js";
import type { DatabasePool } from "./pool.js";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  member: "00000000-0000-4000-8000-000000000002",
  workspace: "00000000-0000-4000-8000-000000000010",
  workspaceTwo: "00000000-0000-4000-8000-000000000011",
  collection: "00000000-0000-4000-8000-000000000020",
  collectionTwo: "00000000-0000-4000-8000-000000000021",
  document: "00000000-0000-4000-8000-000000000030",
};

function createMemoryPool(): DatabasePool {
  const database = newDb({ noAstCoverageCheck: true });
  const adapter = database.adapters.createPg();
  return new adapter.Pool() as DatabasePool;
}

async function resetPostgres(pool: DatabasePool) {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

describe.sequential("Day 3 PostgreSQL schema", () => {
  let pool: DatabasePool;

  beforeEach(async () => {
    if (process.env.TEST_DATABASE_URL) {
      pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      await resetPostgres(pool);
    } else {
      pool = createMemoryPool();
    }
  });

  afterEach(async () => {
    await pool.end();
  });

  it("applies the core migration exactly once", async () => {
    await runMigrations(pool);
    await runMigrations(pool);

    const result = await pool.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name",
    );
    expect(result.rows).toEqual([{ name: "001_day3_core.sql" }]);
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
});
