import { randomUUID } from "node:crypto";
import type { OperationalLogger } from "./operationalLogger.js";

interface CreateApiLifecycleOptions {
  logger: OperationalLogger;
  closeServer: () => Promise<void>;
  closeRuntime: () => Promise<void>;
  createCorrelationId?: () => string;
}

export function createApiLifecycle(options: CreateApiLifecycleOptions) {
  const createCorrelationId = options.createCorrelationId ?? randomUUID;
  let shutdownPromise: Promise<void> | undefined;

  return {
    startup() {
      options.logger.emit({
        eventType: "api.startup",
        correlationId: createCorrelationId(),
      });
    },
    shutdown() {
      shutdownPromise ??= (async () => {
        options.logger.emit({
          eventType: "api.shutdown",
          correlationId: createCorrelationId(),
        });
        await options.closeServer();
        await options.closeRuntime();
      })();
      return shutdownPromise;
    },
  };
}
