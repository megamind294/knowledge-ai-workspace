export type OperationalEvent =
  | {
      eventType: "api.startup";
      correlationId: string;
    }
  | {
      eventType: "api.shutdown";
      correlationId: string;
    }
  | {
      eventType: "api.request.completed";
      correlationId: string;
      method: string;
      statusCode: number;
      durationMs: number;
    }
  | {
      eventType: "api.readiness.transition";
      correlationId: string;
      readiness: "ready" | "unavailable";
    };

export interface OperationalLogger {
  emit(event: OperationalEvent): void;
}

function projectOperationalEvent(event: OperationalEvent): OperationalEvent {
  switch (event.eventType) {
    case "api.startup":
    case "api.shutdown":
      return {
        eventType: event.eventType,
        correlationId: event.correlationId,
      };
    case "api.request.completed":
      return {
        eventType: event.eventType,
        correlationId: event.correlationId,
        method: event.method,
        statusCode: event.statusCode,
        durationMs: event.durationMs,
      };
    case "api.readiness.transition":
      return {
        eventType: event.eventType,
        correlationId: event.correlationId,
        readiness: event.readiness,
      };
  }
}

export function createConsoleOperationalLogger(
  write: (message: string) => void = console.log,
): OperationalLogger {
  return {
    emit(event) {
      write(JSON.stringify(projectOperationalEvent(event)));
    },
  };
}
