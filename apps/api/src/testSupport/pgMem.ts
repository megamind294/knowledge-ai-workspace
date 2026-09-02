import { DataType, newDb } from "pg-mem";
import type { DatabasePool } from "../database/pool.js";

const VECTOR_DIMENSIONS = 1536;

function isEmbeddingVector(value: string) {
  if (!/^\[[\d.,\s-]+\]$/u.test(value)) return false;
  return value.slice(1, -1).split(",").length === VECTOR_DIMENSIONS;
}

export function createPgMemPool(): DatabasePool {
  const database = newDb({ noAstCoverageCheck: true });

  database.registerExtension("vector", (schema) => {
    schema.registerEquivalentType({
      name: "vector",
      equivalentTo: DataType.text,
      isValid: isEmbeddingVector,
    });
  });
  database.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer],
    returns: DataType.integer,
    implementation: () => 1,
  });
  database.public.registerFunction({
    name: "trim",
    args: [DataType.text],
    returns: DataType.text,
    implementation: (value: string) => value.trim(),
  });
  database.public.registerFunction({
    name: "length",
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (value: string) => value.length,
  });

  return new (database.adapters.createPg().Pool)() as DatabasePool;
}
