import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ApiConfig } from "./config.js";
import { IngestionService } from "./ingestion/ingestionService.js";
import { createApiRuntime } from "./runtime.js";
import { createPgMemPool } from "./testSupport/pgMem.js";

const config: ApiConfig = {
  accessTokenSecret: "a-production-length-access-token-secret",
  databaseUrl: "postgresql://keystone:secret@localhost:5432/keystone",
  embedding: null,
  googleOAuth: null,
  nodeEnv: "test",
  port: 4000,
  webAppUrl: "https://web.example.com",
};

describe("production API runtime", () => {
  it("migrates PostgreSQL and composes authenticated application routes", async () => {
    const runtime = await createApiRuntime(config, { pool: createPgMemPool() });

    const registration = await request(runtime.app)
      .post("/api/auth/register")
      .send({
        displayName: "Rinkle Sharma",
        email: "rinkle@example.com",
        password: "Strong-password-42!",
      })
      .expect(201);
    const workspace = await request(runtime.app)
      .post("/api/workspaces")
      .set("authorization", `Bearer ${registration.body.accessToken}`)
      .send({ name: "Portfolio", slug: "portfolio", description: "CV projects" })
      .expect(201);

    expect(workspace.body.workspace).toMatchObject({
      name: "Portfolio",
      role: "owner",
    });
    await request(runtime.app)
      .get("/api/auth/capabilities")
      .expect(200, { googleOAuth: false });
    expect(runtime.ingestionService).toBeNull();
    await request(runtime.app)
      .post(`/api/workspaces/${workspace.body.workspace.id}/retrieval`)
      .set("authorization", `Bearer ${registration.body.accessToken}`)
      .send({ query: "portfolio", scope: { type: "workspace" } })
      .expect(404);

    await runtime.close();
  });

  it("composes the ingestion service only when embeddings are configured", async () => {
    const runtime = await createApiRuntime(
      {
        ...config,
        embedding: {
          apiKey: "private-embedding-key",
          dimensions: 1536,
          endpoint: "http://127.0.0.1:1/v1/embeddings",
          model: "text-embedding-3-small",
          timeoutMs: 15000,
        },
      },
      { pool: createPgMemPool() },
    );

    expect(runtime.ingestionService).toBeInstanceOf(IngestionService);
    const registration = await request(runtime.app)
      .post("/api/auth/register")
      .send({
        displayName: "Rinkle Sharma",
        email: "retrieval@example.com",
        password: "Strong-password-42!",
      })
      .expect(201);
    const workspace = await request(runtime.app)
      .post("/api/workspaces")
      .set("authorization", `Bearer ${registration.body.accessToken}`)
      .send({ name: "Retrieval", slug: "retrieval", description: "Search" })
      .expect(201);
    await request(runtime.app)
      .post(`/api/workspaces/${workspace.body.workspace.id}/retrieval`)
      .set("authorization", `Bearer ${registration.body.accessToken}`)
      .send({ query: "portfolio", scope: { type: "workspace" } })
      .expect(503);
    await runtime.close();
  });

  it("refuses to compose without durable storage and token configuration", async () => {
    await expect(
      createApiRuntime(
        { ...config, accessTokenSecret: null, databaseUrl: null },
        { pool: createPgMemPool() },
      ),
    ).rejects.toThrowError(/database_url and access_token_secret are required/i);
  });
});
