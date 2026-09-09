import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  ReadinessResponseSchema,
} from "@knowledge-ai/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

describe("API application", () => {
  it("returns a contract-valid health response", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);

    expect(HealthResponseSchema.parse(response.body)).toEqual({
      status: "ok",
      service: "knowledge-ai-api",
    });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("preserves a caller request ID", async () => {
    const response = await request(createApp())
      .get("/api/health")
      .set("x-request-id", "client-request-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("client-request-123");
  });

  it("emits an allow-listed request completion event", async () => {
    const events: unknown[] = [];
    const app = createApp({
      operationalLogger: { emit: (event) => events.push(event) },
      createOperationalCorrelationId: () => "operational-123",
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(135),
    });

    const response = await request(app)
      .post("/api/private/missing?token=query-secret")
      .set("x-request-id", "sk-example-secret-token")
      .set("authorization", "Bearer header-secret")
      .send({
        credential: "body-secret",
        sourceText: "private document source text",
        prompt: "private provider prompt",
        providerResponse: "private provider response body",
      })
      .expect(404);

    expect(response.headers["x-request-id"]).toBe("sk-example-secret-token");

    expect(events).toEqual([
      {
        eventType: "api.request.completed",
        correlationId: "operational-123",
        method: "POST",
        statusCode: 404,
        durationMs: 35,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("secret");
    expect(JSON.stringify(events)).not.toContain("private document source text");
    expect(JSON.stringify(events)).not.toContain("private provider prompt");
    expect(JSON.stringify(events)).not.toContain("private provider response body");
  });

  it("instruments preflight and rejected JSON requests before CORS and parsing", async () => {
    const events: unknown[] = [];
    const operationalIds = ["preflight-operation", "malformed-operation", "large-operation"];
    const app = createApp({
      corsOrigin: "https://web.example.com",
      operationalLogger: { emit: (event) => events.push(event) },
      createOperationalCorrelationId: () => operationalIds.shift()!,
      now: () => 100,
    });

    const preflight = await request(app)
      .options("/api/auth/login")
      .set("origin", "https://web.example.com")
      .set("access-control-request-method", "POST")
      .expect(204);
    const malformed = await request(app)
      .post("/api/health")
      .set("x-request-id", "client-malformed-id")
      .set("content-type", "application/json")
      .send("{")
      .expect(500);
    const oversized = await request(app)
      .post("/api/health")
      .set("x-request-id", "client-oversized-id")
      .set("content-type", "application/json")
      .send({ payload: "x".repeat(1024 * 1024) })
      .expect(500);

    expect(preflight.headers["x-request-id"]).toEqual(expect.any(String));
    expect(malformed.headers["x-request-id"]).toBe("client-malformed-id");
    expect(oversized.headers["x-request-id"]).toBe("client-oversized-id");
    expect(events).toEqual([
      {
        eventType: "api.request.completed",
        correlationId: "preflight-operation",
        method: "OPTIONS",
        statusCode: 204,
        durationMs: 0,
      },
      {
        eventType: "api.request.completed",
        correlationId: "malformed-operation",
        method: "POST",
        statusCode: 500,
        durationMs: 0,
      },
      {
        eventType: "api.request.completed",
        correlationId: "large-operation",
        method: "POST",
        statusCode: 500,
        durationMs: 0,
      },
    ]);
  });

  it("returns ready only after the dependency probe succeeds", async () => {
    const response = await request(
      createApp({ readiness: { check: async () => undefined } }),
    )
      .get("/api/ready")
      .expect(200);

    expect(ReadinessResponseSchema.parse(response.body)).toEqual({
      status: "ready",
      service: "knowledge-ai-api",
      checks: { database: "ok" },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns unavailable without leaking the readiness failure", async () => {
    const response = await request(
      createApp({
        readiness: {
          check: async () => {
            throw new Error("postgresql://admin:secret@database/private");
          },
        },
      }),
    )
      .get("/api/ready")
      .expect(503);

    expect(ReadinessResponseSchema.parse(response.body)).toEqual({
      status: "unavailable",
      service: "knowledge-ai-api",
      checks: { database: "unavailable" },
    });
    expect(JSON.stringify(response.body)).not.toContain("secret");
  });

  it("emits readiness transitions only when the ready state changes", async () => {
    const events: unknown[] = [];
    const check = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new Error("postgresql://admin:readiness-secret@database/private"),
      );
    const app = createApp({
      readiness: { check },
      operationalLogger: { emit: (event) => events.push(event) },
      createOperationalCorrelationId: vi
        .fn()
        .mockReturnValueOnce("ready-operation-1")
        .mockReturnValueOnce("ready-operation-2")
        .mockReturnValueOnce("ready-operation-3"),
    });

    await request(app).get("/api/ready").set("x-request-id", "ready-1").expect(200);
    await request(app).get("/api/ready").set("x-request-id", "ready-2").expect(200);
    await request(app).get("/api/ready").set("x-request-id", "ready-3").expect(503);

    expect(events.filter((event) =>
      (event as { eventType?: string }).eventType === "api.readiness.transition",
    )).toEqual([
      {
        eventType: "api.readiness.transition",
        correlationId: "ready-operation-1",
        readiness: "ready",
      },
      {
        eventType: "api.readiness.transition",
        correlationId: "ready-operation-3",
        readiness: "unavailable",
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("readiness-secret");
  });

  it("returns a normalized error without leaking route details", async () => {
    const response = await request(createApp())
      .get("/api/private/missing?token=secret")
      .expect(404);
    const parsed = ApiErrorResponseSchema.parse(response.body);

    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.message).toBe("Route not found");
    expect(parsed.error.requestId).toBe(response.headers["x-request-id"]);
    expect(JSON.stringify(parsed)).not.toContain("secret");
  });

  it("normalizes unexpected errors without exposing their message", async () => {
    const app = createApp({
      registerRoutes(application) {
        application.get("/api/fail", () => {
          throw new Error("database password leaked");
        });
      },
    });

    const response = await request(app).get("/api/fail").expect(500);
    const parsed = ApiErrorResponseSchema.parse(response.body);

    expect(parsed.error.code).toBe("INTERNAL_ERROR");
    expect(parsed.error.message).toBe("Internal server error");
    expect(JSON.stringify(parsed)).not.toContain("password leaked");
  });

  it("permits credentialed requests only from the configured web origin", async () => {
    const app = createApp({ corsOrigin: "https://web.example.com" });

    const allowed = await request(app)
      .options("/api/auth/login")
      .set("origin", "https://web.example.com")
      .set("access-control-request-method", "POST")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://web.example.com",
    );
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const rejected = await request(app)
      .get("/api/health")
      .set("origin", "https://attacker.example.com")
      .expect(200);
    expect(rejected.headers).not.toHaveProperty("access-control-allow-origin");
  });
});
