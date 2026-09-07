import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "../ai/embeddingProvider.js";
import { EmbeddingProviderError } from "../ai/embeddingProvider.js";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { InMemoryObjectStore } from "../storage/inMemoryObjectStore.js";
import { createDocumentObjectKey } from "../storage/objectStore.js";
import { createPgMemPool } from "../testSupport/pgMem.js";
import { DocumentParser } from "./documentParser.js";
import { IngestionService } from "./ingestionService.js";
import type {
  EmbeddedDocumentChunk,
  IndexRunInput,
  IngestionRepository,
} from "./ingestionRepository.js";
import { PostgresIngestionRepository } from "./postgresIngestionRepository.js";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  viewer: "00000000-0000-4000-8000-000000000002",
  workspace: "00000000-0000-4000-8000-000000000010",
  document: "00000000-0000-4000-8000-000000000030",
  previousRun: "00000000-0000-4000-8000-000000000040",
  firstRun: "00000000-0000-4000-8000-000000000041",
  secondRun: "00000000-0000-4000-8000-000000000042",
};

const embedding = (value: number) =>
  Array.from({ length: 1536 }, () => value);

class RecordingEmbeddingProvider implements EmbeddingProvider {
  readonly model = "test-embedding-model";
  readonly dimensions = 1536;
  readonly calls: string[][] = [];

  async embed(texts: readonly string[]) {
    this.calls.push([...texts]);
    return texts.map((_text, index) => embedding(index + 1));
  }
}

describe.sequential("document ingestion service", () => {
  let pool: DatabasePool;
  let objectStore: InMemoryObjectStore;
  let generatedId = 100;

  beforeEach(async () => {
    pool = createPgMemPool();
    await runMigrations(pool);
    await pool.query(
      "INSERT INTO users (id,email,display_name) VALUES ($1,'owner@example.com','Owner'),($2,'viewer@example.com','Viewer')",
      [ids.owner, ids.viewer],
    );
    await pool.query(
      "INSERT INTO workspaces (id,owner_id,name,slug) VALUES ($1,$2,'Research','research')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'viewer')",
      [ids.workspace, ids.owner, ids.viewer],
    );
    await pool.query(
      "INSERT INTO documents (id,workspace_id,original_filename,media_type,size_bytes,ingestion_state) VALUES ($1,$2,'notes.txt','text/plain',27,'uploaded')",
      [ids.document, ids.workspace],
    );
    objectStore = new InMemoryObjectStore();
    await objectStore.put({
      key: createDocumentObjectKey(ids.workspace, ids.document),
      bytes: new TextEncoder().encode("one two three four five six"),
      contentType: "text/plain",
    });
  });

  afterEach(async () => pool.end());

  function service(
    provider: EmbeddingProvider,
    runIds: string[] = [ids.firstRun],
  ) {
    return new IngestionService({
      repository: new PostgresIngestionRepository(
        pool,
        () =>
          `00000000-0000-4000-8000-${String(++generatedId).padStart(12, "0")}`,
      ),
      objectStore,
      parser: new DocumentParser(),
      embeddingProvider: provider,
      chunkOptions: { maxWords: 3, overlapWords: 1 },
      embeddingBatchSize: 2,
      createRunId: () => runIds.shift()!,
    });
  }

  it("parses, chunks, batches, embeds, and atomically activates an index", async () => {
    const provider = new RecordingEmbeddingProvider();

    await expect(
      service(provider).indexDocument(ids.owner, ids.workspace, ids.document),
    ).resolves.toEqual({
      documentId: ids.document,
      runId: ids.firstRun,
      chunkCount: 3,
    });

    expect(provider.calls).toEqual([
      ["one two three", "three four five"],
      ["five six"],
    ]);
    const document = await pool.query(
      "SELECT ingestion_state, failure_reason FROM documents WHERE id=$1",
      [ids.document],
    );
    expect(document.rows).toEqual([
      { ingestion_state: "indexed", failure_reason: null },
    ]);
    const chunks = await pool.query(
      "SELECT ordinal,content,word_count FROM document_chunks ORDER BY ordinal",
    );
    expect(chunks.rows).toEqual([
      { ordinal: 0, content: "one two three", word_count: 3 },
      { ordinal: 1, content: "three four five", word_count: 3 },
      { ordinal: 2, content: "five six", word_count: 2 },
    ]);
  });

  it("records a safe provider failure while preserving the prior active index", async () => {
    await pool.query(
      "UPDATE documents SET ingestion_state='indexed' WHERE id=$1",
      [ids.document],
    );
    await pool.query(
      "INSERT INTO document_index_runs (id,document_id,workspace_id,status,embedding_model,embedding_dimensions) VALUES ($1,$2,$3,'active','old-model',1536)",
      [ids.previousRun, ids.document, ids.workspace],
    );
    await pool.query(
      "INSERT INTO document_chunks (id,index_run_id,document_id,workspace_id,ordinal,content,word_count,embedding) VALUES ('00000000-0000-4000-8000-000000000099',$1,$2,$3,0,'old content',2,$4)",
      [ids.previousRun, ids.document, ids.workspace, `[${embedding(1).join(",")}]`],
    );
    let providerCalls = 0;
    const provider: EmbeddingProvider = {
      model: "test-embedding-model",
      dimensions: 1536,
      embed: async (texts) => {
        providerCalls += 1;
        if (providerCalls === 2) {
          throw new EmbeddingProviderError("PROVIDER_FAILURE");
        }
        return texts.map(() => embedding(1));
      },
    };

    await expect(
      service(provider).indexDocument(ids.owner, ids.workspace, ids.document),
    ).rejects.toMatchObject({
      code: "EMBEDDING_FAILED",
      message: "Document embedding failed",
    });

    const runs = await pool.query(
      "SELECT id,status,failure_reason FROM document_index_runs ORDER BY id",
    );
    expect(runs.rows).toEqual([
      { id: ids.previousRun, status: "active", failure_reason: null },
      {
        id: ids.firstRun,
        status: "failed",
        failure_reason: "Embedding provider failed",
      },
    ]);
    const document = await pool.query(
      "SELECT ingestion_state,failure_reason FROM documents WHERE id=$1",
      [ids.document],
    );
    expect(document.rows).toEqual([
      { ingestion_state: "indexed", failure_reason: null },
    ]);
    const chunks = await pool.query(
      "SELECT index_run_id,content FROM document_chunks ORDER BY index_run_id",
    );
    expect(chunks.rows).toEqual([
      { index_run_id: ids.previousRun, content: "old content" },
    ]);
  });

  it("re-indexes without leaving duplicate active vectors", async () => {
    const provider = new RecordingEmbeddingProvider();
    const ingestion = service(provider, [ids.firstRun, ids.secondRun]);

    await ingestion.indexDocument(ids.owner, ids.workspace, ids.document);
    await ingestion.indexDocument(ids.owner, ids.workspace, ids.document);

    const runs = await pool.query(
      "SELECT id,status FROM document_index_runs ORDER BY id",
    );
    expect(runs.rows).toEqual([
      { id: ids.firstRun, status: "superseded" },
      { id: ids.secondRun, status: "active" },
    ]);
    const activeChunks = await pool.query(
      "SELECT COUNT(*)::integer AS count FROM document_chunks c JOIN document_index_runs r ON r.id=c.index_run_id WHERE r.status='active'",
    );
    expect(activeChunks.rows).toEqual([{ count: 3 }]);
  });

  it("rejects read-only members before creating an index run", async () => {
    await expect(
      service(new RecordingEmbeddingProvider()).indexDocument(
        ids.viewer,
        ids.workspace,
        ids.document,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const runs = await pool.query("SELECT id FROM document_index_runs");
    expect(runs.rowCount).toBe(0);
  });

  it("fails safely when a provider returns the wrong vector dimensions", async () => {
    const provider: EmbeddingProvider = {
      model: "test-embedding-model",
      dimensions: 1536,
      embed: async (texts) => texts.map(() => [1, 2, 3]),
    };

    await expect(
      service(provider).indexDocument(ids.owner, ids.workspace, ids.document),
    ).rejects.toMatchObject({
      code: "INVALID_EMBEDDING",
      message: "Embedding provider returned invalid vectors",
    });
    const result = await pool.query(
      "SELECT status,failure_reason FROM document_index_runs",
    );
    expect(result.rows).toEqual([
      { status: "failed", failure_reason: "Embedding response was invalid" },
    ]);
  });

  it("fails safely when a provider returns a zero vector", async () => {
    const provider: EmbeddingProvider = {
      model: "test-embedding-model",
      dimensions: 1536,
      embed: async (texts) => texts.map(() => embedding(0)),
    };

    await expect(
      service(provider).indexDocument(ids.owner, ids.workspace, ids.document),
    ).rejects.toMatchObject({ code: "INVALID_EMBEDDING" });
    const result = await pool.query(
      "SELECT status,failure_reason FROM document_index_runs",
    );
    expect(result.rows).toEqual([
      { status: "failed", failure_reason: "Embedding response was invalid" },
    ]);
  });

  it("stages each embedded batch before requesting the next batch", async () => {
    const events: string[] = [];
    const repository: IngestionRepository = {
      beginIndexing: async (_userId: string, input: IndexRunInput) => ({
        id: input.documentId,
        workspaceId: input.workspaceId,
        mediaType: "text/plain",
      }),
      appendChunks: async (_runId: string, chunks: readonly EmbeddedDocumentChunk[]) => {
        events.push(`append:${chunks.length}`);
      },
      activateIndex: async () => {
        events.push("activate");
      },
      failIndex: async () => undefined,
    };
    let call = 0;
    const provider: EmbeddingProvider = {
      model: "test-embedding-model",
      dimensions: 1536,
      embed: async (texts) => {
        call += 1;
        events.push(`embed:${texts.length}`);
        if (call === 2 && events.at(-2) !== "append:2") {
          throw new Error("the previous batch was retained instead of staged");
        }
        return texts.map(() => embedding(1));
      },
    };
    const ingestion = new IngestionService({
      repository,
      objectStore,
      parser: new DocumentParser(),
      embeddingProvider: provider,
      chunkOptions: { maxWords: 3, overlapWords: 1 },
      embeddingBatchSize: 2,
      createRunId: () => ids.firstRun,
    });

    await expect(
      ingestion.indexDocument(ids.owner, ids.workspace, ids.document),
    ).resolves.toMatchObject({ chunkCount: 3 });
    expect(events).toEqual(["embed:2", "append:2", "embed:1", "append:1", "activate"]);
  });

  it("keeps the normalized ingestion error when failure persistence also fails", async () => {
    const repository: IngestionRepository = {
      beginIndexing: async (_userId: string, input: IndexRunInput) => ({
        id: input.documentId,
        workspaceId: input.workspaceId,
        mediaType: "text/plain",
      }),
      appendChunks: async () => undefined,
      activateIndex: async () => undefined,
      failIndex: async () => {
        throw new Error("database unavailable");
      },
    };
    const provider: EmbeddingProvider = {
      model: "test-embedding-model",
      dimensions: 1536,
      embed: async () => {
        throw new EmbeddingProviderError("PROVIDER_FAILURE");
      },
    };
    const ingestion = new IngestionService({
      repository,
      objectStore,
      parser: new DocumentParser(),
      embeddingProvider: provider,
      createRunId: () => ids.firstRun,
    });

    await expect(
      ingestion.indexDocument(ids.owner, ids.workspace, ids.document),
    ).rejects.toMatchObject({
      code: "EMBEDDING_FAILED",
      message: "Document embedding failed",
    });
  });
});
