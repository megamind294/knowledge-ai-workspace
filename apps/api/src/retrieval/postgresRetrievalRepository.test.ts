import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { PostgresRetrievalRepository } from "./postgresRetrievalRepository.js";

const TEST_SCHEMA = "keystone_retrieval_repository_test";
const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe.sequential : describe.skip;
const ids = {
  member: "20000000-0000-4000-8000-000000000001",
  outsider: "20000000-0000-4000-8000-000000000002",
  workspace: "20000000-0000-4000-8000-000000000010",
  otherWorkspace: "20000000-0000-4000-8000-000000000011",
  collection: "20000000-0000-4000-8000-000000000020",
  otherCollection: "20000000-0000-4000-8000-000000000021",
  foreignCollection: "20000000-0000-4000-8000-000000000022",
  document: "20000000-0000-4000-8000-000000000030",
  otherDocument: "20000000-0000-4000-8000-000000000031",
  foreignDocument: "20000000-0000-4000-8000-000000000032",
};

function embedding(first: number, second: number) {
  return [first, second, ...Array.from({ length: 1534 }, () => 0)];
}

function literal(values: readonly number[]) {
  return `[${values.join(",")}]`;
}

describePostgres("PostgresRetrievalRepository", () => {
  let pool: DatabasePool;
  let repository: PostgresRetrievalRepository;

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
    repository = new PostgresRetrievalRepository(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM workspaces");
    await pool.query("DELETE FROM users");
    await pool.query(
      `INSERT INTO users (id,email,display_name) VALUES
       ($1,'member@example.com','Member'),($2,'outsider@example.com','Outsider')`,
      [ids.member, ids.outsider],
    );
    await pool.query(
      `INSERT INTO workspaces (id,owner_id,name,slug) VALUES
       ($1,$3,'Member workspace','member-workspace'),
       ($2,$4,'Foreign workspace','foreign-workspace')`,
      [ids.workspace, ids.otherWorkspace, ids.member, ids.outsider],
    );
    await pool.query(
      `INSERT INTO workspace_members (workspace_id,user_id,role) VALUES
       ($1,$3,'owner'),($2,$4,'owner')`,
      [ids.workspace, ids.otherWorkspace, ids.member, ids.outsider],
    );
    await pool.query(
      `INSERT INTO collections (id,workspace_id,name) VALUES
       ($1,$4,'Policies'),($2,$4,'Benefits'),($3,$5,'Foreign')`,
      [
        ids.collection,
        ids.otherCollection,
        ids.foreignCollection,
        ids.workspace,
        ids.otherWorkspace,
      ],
    );
    await pool.query(
      `INSERT INTO documents
        (id,workspace_id,collection_id,original_filename,media_type,size_bytes,ingestion_state)
       VALUES
        ($1,$4,$6,'policy.md','text/markdown',100,'indexed'),
        ($2,$4,$7,'benefits.txt','text/plain',100,'indexed'),
        ($3,$5,$8,'foreign.txt','text/plain',100,'indexed')`,
      [
        ids.document,
        ids.otherDocument,
        ids.foreignDocument,
        ids.workspace,
        ids.otherWorkspace,
        ids.collection,
        ids.otherCollection,
        ids.foreignCollection,
      ],
    );
    await pool.query(
      `INSERT INTO document_index_runs
        (id,document_id,workspace_id,status,embedding_model,embedding_dimensions)
       VALUES
        ('20000000-0000-4000-8000-000000000040',$1,$4,'active','test',1536),
        ('20000000-0000-4000-8000-000000000041',$2,$4,'active','test',1536),
        ('20000000-0000-4000-8000-000000000042',$3,$5,'active','test',1536),
        ('20000000-0000-4000-8000-000000000043',$1,$4,'processing','test',1536)`,
      [ids.document, ids.otherDocument, ids.foreignDocument, ids.workspace, ids.otherWorkspace],
    );
    await pool.query(
      `INSERT INTO document_chunks
        (id,index_run_id,document_id,workspace_id,ordinal,content,word_count,page_number,section_heading,embedding)
       VALUES
        ('20000000-0000-4000-8000-000000000050','20000000-0000-4000-8000-000000000040',$1,$3,0,'Exact leave policy',3,2,'Leave',$4),
        ('20000000-0000-4000-8000-000000000051','20000000-0000-4000-8000-000000000040',$1,$3,1,'Orthogonal policy',2,NULL,NULL,$5),
        ('20000000-0000-4000-8000-000000000052','20000000-0000-4000-8000-000000000041',$2,$3,0,'Related benefits',2,NULL,'Benefits',$6),
        ('20000000-0000-4000-8000-000000000053','20000000-0000-4000-8000-000000000042',$7,$8,0,'Foreign exact content',3,NULL,NULL,$4),
        ('20000000-0000-4000-8000-000000000054','20000000-0000-4000-8000-000000000043',$1,$3,0,'Inactive exact content',3,NULL,NULL,$4)`,
      [
        ids.document,
        ids.otherDocument,
        ids.workspace,
        literal(embedding(1, 0)),
        literal(embedding(0, 1)),
        literal(embedding(1, 1)),
        ids.foreignDocument,
        ids.otherWorkspace,
      ],
    );
  });

  it("orders active workspace chunks by cosine similarity and applies topK", async () => {
    const results = await repository.search(
      ids.member,
      ids.workspace,
      embedding(1, 0),
      { type: "workspace" },
      2,
    );

    expect(results?.map((result) => result.content)).toEqual([
      "Exact leave policy",
      "Related benefits",
    ]);
    expect(results?.[0]).toMatchObject({
      originalFilename: "policy.md",
      pageNumber: 2,
      sectionHeading: "Leave",
      score: 1,
    });
    expect(results?.[1]?.score).toBeCloseTo(Math.SQRT1_2);
  });

  it("enforces collection and document scopes", async () => {
    const collection = await repository.search(
      ids.member,
      ids.workspace,
      embedding(1, 0),
      { type: "collection", collectionId: ids.otherCollection },
      5,
    );
    const document = await repository.search(
      ids.member,
      ids.workspace,
      embedding(1, 0),
      { type: "document", documentId: ids.document },
      5,
    );

    expect(collection?.map((result) => result.documentId)).toEqual([
      ids.otherDocument,
    ]);
    expect(document?.map((result) => result.content)).toEqual([
      "Exact leave policy",
      "Orthogonal policy",
    ]);
  });

  it("hides non-member and cross-workspace scopes", async () => {
    await expect(
      repository.search(
        ids.outsider,
        ids.workspace,
        embedding(1, 0),
        { type: "workspace" },
        5,
      ),
    ).resolves.toBeNull();
    await expect(
      repository.search(
        ids.member,
        ids.workspace,
        embedding(1, 0),
        { type: "collection", collectionId: ids.foreignCollection },
        5,
      ),
    ).resolves.toBeNull();
    await expect(
      repository.search(
        ids.member,
        ids.workspace,
        embedding(1, 0),
        { type: "document", documentId: ids.foreignDocument },
        5,
      ),
    ).resolves.toBeNull();
  });
});
