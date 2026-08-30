import { z } from "zod";

const ApiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
});

export interface ApiConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
}

export function loadApiConfig(
  environment: Record<string, string | undefined> = process.env,
): ApiConfig {
  const result = ApiEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("Invalid API configuration");
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
  };
}
