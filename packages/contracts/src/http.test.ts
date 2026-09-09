import { describe, expect, it } from "vitest";
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  ReadinessResponseSchema,
} from "./http.js";

describe("HTTP contracts", () => {
  it("accepts the exact health response", () => {
    expect(
      HealthResponseSchema.parse({
        status: "ok",
        service: "knowledge-ai-api",
      }),
    ).toEqual({ status: "ok", service: "knowledge-ai-api" });
    expect(() =>
      HealthResponseSchema.parse({ status: "healthy", service: "api" }),
    ).toThrow();
  });

  it("accepts a stable API error envelope", () => {
    expect(
      ApiErrorResponseSchema.parse({
        error: {
          code: "NOT_FOUND",
          message: "Route not found",
          requestId: "request-123",
        },
      }),
    ).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: "request-123",
      },
    });
  });

  it("accepts only the exact ready and unavailable responses", () => {
    expect(
      ReadinessResponseSchema.parse({
        status: "ready",
        service: "knowledge-ai-api",
        checks: { database: "ok" },
      }),
    ).toEqual({
      status: "ready",
      service: "knowledge-ai-api",
      checks: { database: "ok" },
    });
    expect(
      ReadinessResponseSchema.parse({
        status: "unavailable",
        service: "knowledge-ai-api",
        checks: { database: "unavailable" },
      }),
    ).toEqual({
      status: "unavailable",
      service: "knowledge-ai-api",
      checks: { database: "unavailable" },
    });
    expect(() =>
      ReadinessResponseSchema.parse({
        status: "ready",
        service: "knowledge-ai-api",
        checks: { database: "unavailable" },
      }),
    ).toThrow();
  });
});
