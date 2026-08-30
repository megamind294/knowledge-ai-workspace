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
];

export async function runMigrations(pool: DatabasePool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const migration of migrations) {
    const applied = await pool.query(
      "SELECT name FROM schema_migrations WHERE name = $1",
      [migration.name],
    );
    if (applied.rowCount === 1) {
      continue;
    }

    const sql = await readFile(migration.fileUrl, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        migration.name,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
