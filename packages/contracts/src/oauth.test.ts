import { describe, expect, it } from "vitest";
import {
  AuthCapabilitiesResponseSchema,
  OAuthIdentitySchema,
} from "./oauth.js";

describe("OAuth contracts", () => {
  it("accepts only strict authentication capability responses", () => {
    expect(AuthCapabilitiesResponseSchema.parse({ googleOAuth: true })).toEqual({
      googleOAuth: true,
    });
    expect(() =>
      AuthCapabilitiesResponseSchema.parse({ googleOAuth: true, secret: "leak" }),
    ).toThrow();
  });

  it("normalizes a verified Google identity shape", () => {
    expect(
      OAuthIdentitySchema.parse({
        provider: "google",
        subject: "google-user-123",
        email: "rinkle@example.com",
        displayName: "Rinkle Sharma",
      }),
    ).toMatchObject({ provider: "google", subject: "google-user-123" });
  });
});
