import { describe, expect, it } from "vitest";
import {
  AuthSessionResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from "./auth.js";

describe("authentication HTTP contracts", () => {
  it("accepts strong registration input and rejects unexpected fields", () => {
    expect(
      RegisterRequestSchema.parse({
        email: "rinkle@example.com",
        displayName: "Rinkle Sharma",
        password: "Strong-password-42!",
      }),
    ).toMatchObject({ email: "rinkle@example.com" });
    expect(() =>
      RegisterRequestSchema.parse({
        email: "rinkle@example.com",
        displayName: "Rinkle Sharma",
        password: "Strong-password-42!",
        role: "admin",
      }),
    ).toThrow();
  });

  it("keeps refresh credentials out of the public session response", () => {
    const parsed = AuthSessionResponseSchema.parse({
      user: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "rinkle@example.com",
        displayName: "Rinkle Sharma",
      },
      accessToken: "signed-access-token",
      refreshTokenExpiresAt: "2026-09-30T00:00:00.000Z",
    });

    expect(parsed).not.toHaveProperty("refreshToken");
    expect(() => LoginRequestSchema.parse({ email: "not-an-email", password: "x" }))
      .toThrow();
  });
});
