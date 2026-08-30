import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("API configuration", () => {
  it("loads validated defaults", () => {
    expect(loadApiConfig({ NODE_ENV: "test" })).toEqual({
      databaseUrl: null,
      nodeEnv: "test",
      port: 4000,
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
});
