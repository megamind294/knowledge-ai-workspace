import { describe, expect, it, vi } from "vitest";
import { createDatabaseReadinessProbe } from "./readiness.js";

describe("database readiness probe", () => {
  it("checks the database with a bounded validation query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ready: 1 }] });
    const probe = createDatabaseReadinessProbe({ query }, { timeoutMs: 50 });

    await expect(probe.check()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith({
      query_timeout: 50,
      text: "SELECT 1 AS ready",
    });
  });

  it("normalizes database failures", async () => {
    const probe = createDatabaseReadinessProbe(
      {
        query: vi
          .fn()
          .mockRejectedValue(new Error("postgresql://admin:secret@database/private")),
      },
      { timeoutMs: 50 },
    );

    await expect(probe.check()).rejects.toThrow("Readiness check failed");
  });

  it("recovers after the driver terminates a timed-out query", async () => {
    const abandonedWork = new Promise(() => undefined);
    const query = vi
      .fn()
      .mockImplementationOnce(
        (_text: string, queryTimeout: number) =>
          Promise.race([
            abandonedWork,
            new Promise((_resolve, reject) => {
              setTimeout(() => reject(new Error("Query read timeout")), queryTimeout);
            }),
          ]),
      )
      .mockResolvedValueOnce({ rows: [{ ready: 1 }] });
    const probe = createDatabaseReadinessProbe({ query }, { timeoutMs: 5 });

    await expect(probe.check()).rejects.toThrow("Readiness check failed");
    await expect(probe.check()).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight database query across overlapping probes", async () => {
    let releaseQuery!: () => void;
    const query = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseQuery = resolve;
        }),
    );
    const probe = createDatabaseReadinessProbe({ query }, { timeoutMs: 50 });

    const first = probe.check();
    const second = probe.check();
    expect(query).toHaveBeenCalledTimes(1);
    releaseQuery();

    await expect(Promise.all([first, second])).resolves.toEqual([
      undefined,
      undefined,
    ]);
  });
});
