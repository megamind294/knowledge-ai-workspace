import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const HealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: z.literal("knowledge-ai-api"),
  })
  .strict();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

const ReadinessResponseBaseSchema = z.object({
  service: z.literal("knowledge-ai-api"),
});

export const ReadinessResponseSchema = z.discriminatedUnion("status", [
  ReadinessResponseBaseSchema.extend({
    status: z.literal("ready"),
    checks: z.object({ database: z.literal("ok") }).strict(),
  }).strict(),
  ReadinessResponseBaseSchema.extend({
    status: z.literal("unavailable"),
    checks: z.object({ database: z.literal("unavailable") }).strict(),
  }).strict(),
]);

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().min(1),
        requestId: z.string().min(1),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
