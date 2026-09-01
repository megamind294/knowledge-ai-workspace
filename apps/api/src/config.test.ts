import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("API configuration", () => {
  it("loads validated defaults", () => {
    expect(loadApiConfig({ NODE_ENV: "test" })).toEqual({
      accessTokenSecret: null,
      databaseUrl: null,
      googleOAuth: null,
      nodeEnv: "test",
      port: 4000,
      webAppUrl: "http://localhost:5173",
    });
  });

  it("accepts a PostgreSQL connection URL", () => {
    expect(
      loadApiConfig({
        DATABASE_URL: "postgresql://keystone:secret@localhost:5432/keystone",
        NODE_ENV: "test",
      }).databaseUrl,
    ).toBe("postgresql://keystone:secret@localhost:5432/keystone");
  });

  it("rejects an invalid port before the server starts", () => {
    expect(() => loadApiConfig({ NODE_ENV: "production", PORT: "70000" }))
      .toThrowError(/invalid api configuration/i);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      loadApiConfig({ NODE_ENV: "test", DATABASE_URL: "https://example.com" }),
    ).toThrowError(/invalid api configuration/i);
  });

  it("accepts complete Google OAuth configuration", () => {
    expect(
      loadApiConfig({
        NODE_ENV: "production",
        GOOGLE_OAUTH_CLIENT_ID: "google-client",
        GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
        GOOGLE_OAUTH_REDIRECT_URI: "https://api.example.com/api/auth/google/callback",
      }).googleOAuth,
    ).toEqual({
      clientId: "google-client",
      clientSecret: "google-secret",
      redirectUri: "https://api.example.com/api/auth/google/callback",
    });
  });

  it("rejects partial Google OAuth configuration", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        GOOGLE_OAUTH_CLIENT_ID: "google-client",
      }),
    ).toThrowError(/invalid api configuration/i);
  });

  it("rejects insecure public web origins in production", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        WEB_APP_URL: "http://portfolio.example.com",
      }),
    ).toThrowError(/invalid api configuration/i);
  });

  it("rejects insecure public Google callbacks in production", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        GOOGLE_OAUTH_CLIENT_ID: "google-client",
        GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
        GOOGLE_OAUTH_REDIRECT_URI: "http://api.example.com/api/auth/google/callback",
      }),
    ).toThrowError(/invalid api configuration/i);
  });

  it("rejects the documented signing-secret placeholder", () => {
    expect(() =>
      loadApiConfig({
        NODE_ENV: "production",
        ACCESS_TOKEN_SECRET: "replace-with-at-least-32-random-characters",
      }),
    ).toThrowError(/invalid api configuration/i);
  });
});
