import { describe, expect, it } from "vitest";
import { loadApiConfig } from "./config.js";

describe("API configuration", () => {
  it("loads validated defaults", () => {
    expect(loadApiConfig({ NODE_ENV: "test" })).toEqual({
      nodeEnv: "test",
      port: 4000,
    });
  });

  it("rejects an invalid port before the server starts", () => {
    expect(() => loadApiConfig({ NODE_ENV: "production", PORT: "70000" }))
      .toThrowError(/invalid api configuration/i);
  });
});
