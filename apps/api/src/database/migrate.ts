import { readFile } from "node:fs/promises";
import type { DatabasePool } from "./pool.js";

interface Migration {
  name: string;
  fileUrl: URL;
}

const migrations: readonly Migration[] = [
  {
    name: "001_day3_core.sql",
    fileUrl: new URL("../../migrations/001_day3_core.sql", import.meta.url),
  },
  {
    name: "002_day4_ingestion.sql",
    fileUrl: new URL("../../migrations/002_day4_ingestion.sql", import.meta.url),
  },
];

let migrationQueue = Promise.resolve();

async function applyMigrations(pool: DatabasePool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(493827156)");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query(
        "SELECT name FROM schema_migrations WHERE name = $1",
        [migration.name],
      );
      if (applied.rowCount === 1) {
        continue;
      }

      const sql = await readFile(migration.fileUrl, "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        migration.name,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(pool: DatabasePool) {
  const previous = migrationQueue;
  let releaseQueue!: () => void;
  migrationQueue = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  await previous;
  try {
    await applyMigrations(pool);
  } finally {
    releaseQueue();
  }
}
