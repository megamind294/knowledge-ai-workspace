import {
  Pool,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import type { ApiConfig } from "../config.js";

export interface DatabaseTransactionClient {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
}

export interface DatabasePool {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<DatabaseTransactionClient>;
  end(): Promise<void>;
}

export function createDatabasePool(config: ApiConfig): DatabasePool {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for PostgreSQL access");
  }

  return new Pool({ connectionString: config.databaseUrl });
}
