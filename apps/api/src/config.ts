import { z } from "zod";

const ApiEnvironmentSchema = z.object({
  ACCESS_TOKEN_SECRET: z
    .string()
    .min(32)
    .refine((value) => !/^(replace-|change-me)/i.test(value))
    .optional(),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol))
    .optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
  WEB_APP_URL: z.url().default("http://localhost:5173"),
}).superRefine((value, context) => {
  const googleValues = [
    value.GOOGLE_OAUTH_CLIENT_ID,
    value.GOOGLE_OAUTH_CLIENT_SECRET,
    value.GOOGLE_OAUTH_REDIRECT_URI,
  ];
  const configured = googleValues.filter(Boolean).length;
  if (configured > 0 && configured < googleValues.length) {
    context.addIssue({
      code: "custom",
      message: "Google OAuth configuration must be complete",
    });
  }
  const webAppUrl = new URL(value.WEB_APP_URL);
  if (
    value.NODE_ENV === "production" &&
    webAppUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(webAppUrl.hostname)
  ) {
    context.addIssue({
      code: "custom",
      message: "Production web application URL must use HTTPS",
    });
  }
  if (value.NODE_ENV === "production" && value.GOOGLE_OAUTH_REDIRECT_URI) {
    const redirectUrl = new URL(value.GOOGLE_OAUTH_REDIRECT_URI);
    if (
      redirectUrl.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(redirectUrl.hostname)
    ) {
      context.addIssue({
        code: "custom",
        message: "Production Google OAuth callback must use HTTPS",
      });
    }
  }
});

interface GoogleOAuthEnvironment {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ApiConfig {
  accessTokenSecret: string | null;
  databaseUrl: string | null;
  googleOAuth: GoogleOAuthEnvironment | null;
  nodeEnv: "development" | "test" | "production";
  port: number;
  webAppUrl: string;
}

export function loadApiConfig(
  environment: Record<string, string | undefined> = process.env,
): ApiConfig {
  const result = ApiEnvironmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error("Invalid API configuration");
  }

  return {
    accessTokenSecret: result.data.ACCESS_TOKEN_SECRET ?? null,
    databaseUrl: result.data.DATABASE_URL ?? null,
    googleOAuth: result.data.GOOGLE_OAUTH_CLIENT_ID
      ? {
          clientId: result.data.GOOGLE_OAUTH_CLIENT_ID,
          clientSecret: result.data.GOOGLE_OAUTH_CLIENT_SECRET!,
          redirectUri: result.data.GOOGLE_OAUTH_REDIRECT_URI!,
        }
      : null,
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    webAppUrl: result.data.WEB_APP_URL,
  };
}
