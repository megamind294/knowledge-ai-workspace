import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { issueAccessToken } from "../auth/tokens.js";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { PostgresKnowledgeRepository } from "../knowledge/postgresKnowledgeRepository.js";
import { InMemoryObjectStore } from "../storage/inMemoryObjectStore.js";
import { createDocumentObjectKey } from "../storage/objectStore.js";
import { createPgMemPool } from "../testSupport/pgMem.js";

const secret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);
const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  viewer: "00000000-0000-4000-8000-000000000002",
  outsider: "00000000-0000-4000-8000-000000000003",
  workspace: "00000000-0000-4000-8000-000000000010",
  document: "00000000-0000-4000-8000-000000000030",
};

async function token(userId: string, email: string) {
  return issueAccessToken({
    user: { id: userId, email, displayName: email },
    secret,
    now: new Date("2026-09-02T00:00:00Z"),
    ttlSeconds: 60 * 60 * 24 * 365,
  });
}

describe.sequential("authorized document-byte upload", () => {
  let database: DatabasePool;
  let objectStore: InMemoryObjectStore;
  let ownerToken: string;
  let viewerToken: string;
  let outsiderToken: string;

  beforeEach(async () => {
    database = createPgMemPool();
    await runMigrations(database);
    await database.query(
      "INSERT INTO users (id,email,display_name) VALUES ($1,'owner@example.com','Owner'),($2,'viewer@example.com','Viewer'),($3,'outsider@example.com','Outsider')",
      [ids.owner, ids.viewer, ids.outsider],
    );
    await database.query(
      "INSERT INTO workspaces (id,owner_id,name,slug) VALUES ($1,$2,'Research','research')",
      [ids.workspace, ids.owner],
    );
    await database.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner'),($1,$3,'viewer')",
      [ids.workspace, ids.owner, ids.viewer],
    );
    await database.query(
      "INSERT INTO documents (id,workspace_id,original_filename,media_type,size_bytes,ingestion_state) VALUES ($1,$2,'notes.txt','text/plain',3,'uploaded')",
      [ids.document, ids.workspace],
    );
    objectStore = new InMemoryObjectStore();
    ownerToken = await token(ids.owner, "owner@example.com");
    viewerToken = await token(ids.viewer, "viewer@example.com");
    outsiderToken = await token(ids.outsider, "outsider@example.com");
  });

  afterEach(async () => database.end());

  function app(maxBytes = 10 * 1024 * 1024) {
    const repository = new PostgresKnowledgeRepository(database);
    return createApp({
      upload: { repository, objectStore, accessTokenSecret: secret, maxBytes },
    });
  }

  function auth(value: string) {
    return { Authorization: `Bearer ${value}` };
  }

  const path = `/api/workspaces/${ids.workspace}/documents/${ids.document}/content`;

  it("stores authenticated owner bytes under a server-generated key", async () => {
    const response = await request(app())
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abc"))
      .expect(201);

    expect(response.body).toEqual({
      upload: {
        documentId: ids.document,
        mediaType: "text/plain",
        sizeBytes: 3,
      },
    });
    await expect(
      objectStore.get(createDocumentObjectKey(ids.workspace, ids.document)),
    ).resolves.toMatchObject({ bytes: new Uint8Array([97, 98, 99]) });
  });

  it("requires authentication before accepting source bytes", async () => {
    await request(app())
      .post(path)
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abc"))
      .expect(401);
    await expect(
      objectStore.get(createDocumentObjectKey(ids.workspace, ids.document)),
    ).resolves.toBeNull();
  });

  it("keeps viewers read-only and hides documents from non-members", async () => {
    await request(app())
      .post(path)
      .set(auth(viewerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abc"))
      .expect(403);
    await request(app())
      .post(path)
      .set(auth(outsiderToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abc"))
      .expect(404);
  });

  it("rejects MIME and byte-count mismatches without storing content", async () => {
    await request(app())
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/markdown")
      .send(Buffer.from("abc"))
      .expect(400);
    await request(app())
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abcd"))
      .expect(400);
    await expect(
      objectStore.get(createDocumentObjectKey(ids.workspace, ids.document)),
    ).resolves.toBeNull();
  });

  it("rejects bodies above the configured limit with a content-free error", async () => {
    const response = await request(app(2))
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("private-source"))
      .expect(413);

    expect(response.body.error.code).toBe("BAD_REQUEST");
    expect(JSON.stringify(response.body)).not.toContain("private-source");
  });

  it("rejects duplicate submissions and preserves the original bytes", async () => {
    await request(app())
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("abc"))
      .expect(201);
    await request(app())
      .post(path)
      .set(auth(ownerToken))
      .set("Content-Type", "text/plain")
      .send(Buffer.from("xyz"))
      .expect(409);

    await expect(
      objectStore.get(createDocumentObjectKey(ids.workspace, ids.document)),
    ).resolves.toMatchObject({ bytes: new Uint8Array([97, 98, 99]) });
  });
});
