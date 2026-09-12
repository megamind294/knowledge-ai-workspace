interface ReadinessDatabase {
  query(config: { query_timeout: number; text: string }): Promise<unknown>;
}

interface ReadinessOptions {
  timeoutMs?: number;
}

export interface ReadinessProbe {
  check(): Promise<void>;
}

export function createDatabaseReadinessProbe(
  database: ReadinessDatabase,
  options: ReadinessOptions = {},
): ReadinessProbe {
  const timeoutMs = options.timeoutMs ?? 2_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error("Readiness timeout must be a positive integer");
  }

  let inFlight: Promise<void> | null = null;

  function checkDatabase() {
    if (!inFlight) {
      const query = database
        .query({
          query_timeout: timeoutMs,
          text: "SELECT 1 AS ready",
        })
        .then(() => undefined);
      const tracked = query.finally(() => {
        if (inFlight === tracked) inFlight = null;
      });
      inFlight = tracked;
    }
    return inFlight;
  }

  return {
    async check() {
      try {
        await checkDatabase();
      } catch {
        throw new Error("Readiness check failed");
      }
    },
  };
}
