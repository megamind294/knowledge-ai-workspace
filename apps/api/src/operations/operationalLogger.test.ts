import { describe, expect, it, vi } from "vitest";
import { createConsoleOperationalLogger } from "./operationalLogger.js";

describe("console operational logger", () => {
  it("projects request completion events onto the runtime allow-list", () => {
    const write = vi.fn();
    const logger = createConsoleOperationalLogger(write);
    const event = {
      eventType: "api.request.completed" as const,
      correlationId: "operation-123",
      method: "POST",
      statusCode: 201,
      durationMs: 42,
      credential: "private-credential",
      sourceText: "private source text",
      prompt: "private prompt",
      providerResponse: "private provider response",
    };

    logger.emit(event);

    expect(write).toHaveBeenCalledWith(JSON.stringify({
      eventType: "api.request.completed",
      correlationId: "operation-123",
      method: "POST",
      statusCode: 201,
      durationMs: 42,
    }));
  });
});
