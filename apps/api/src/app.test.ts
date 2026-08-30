import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
} from "@knowledge-ai/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
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
});
