import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ApiConfig } from "./config.js";
import { createApiRuntime } from "./runtime.js";
import { createPgMemPool } from "./testSupport/pgMem.js";

const config: ApiConfig = {
  accessTokenSecret: "a-production-length-access-token-secret",
  databaseUrl: "postgresql://keystone:secret@localhost:5432/keystone",
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
