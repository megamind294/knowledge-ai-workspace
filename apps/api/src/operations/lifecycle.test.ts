import { describe, expect, it, vi } from "vitest";
import { createApiLifecycle } from "./lifecycle.js";

describe("API lifecycle logging", () => {
  it("emits correlated startup and shutdown events around graceful shutdown", async () => {
    const emit = vi.fn();
    const closeServer = vi.fn().mockResolvedValue(undefined);
    const closeRuntime = vi.fn().mockResolvedValue(undefined);
    const lifecycle = createApiLifecycle({
      logger: { emit },
      closeServer,
      closeRuntime,
      createCorrelationId: vi
        .fn()
        .mockReturnValueOnce("startup-123")
        .mockReturnValueOnce("shutdown-456"),
    });

    lifecycle.startup();
    await Promise.all([lifecycle.shutdown(), lifecycle.shutdown()]);

    expect(emit).toHaveBeenCalledWith({
      eventType: "api.startup",
      correlationId: "startup-123",
    });
    expect(emit).toHaveBeenCalledWith({
      eventType: "api.shutdown",
      correlationId: "shutdown-456",
    });
    expect(closeServer).toHaveBeenCalledOnce();
    expect(closeRuntime).toHaveBeenCalledOnce();
  });
});
