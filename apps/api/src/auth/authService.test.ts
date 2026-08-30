import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { AuthError, AuthService } from "./authService.js";
import { InMemoryAuthRepository } from "./inMemoryAuthRepository.js";
import { createPasswordService } from "./passwords.js";
import { hashRefreshToken } from "./tokens.js";

const accessTokenSecret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);

function createHarness() {
  let now = new Date("2026-08-31T00:00:00.000Z");
  let sequence = 0;
  const repository = new InMemoryAuthRepository();
  const service = new AuthService({
    repository,
    passwordService: createPasswordService({ rounds: 4 }),
    accessTokenSecret,
    accessTokenTtlSeconds: 300,
    refreshTokenTtlMs: 60_000,
    now: () => now,
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });

  return {
    repository,
    service,
    advance(milliseconds: number) {
      now = new Date(now.getTime() + milliseconds);
    },
  };
}

const registration = {
  email: "  Rinkle@Example.COM ",
  displayName: "Rinkle Sharma",
  password: "Strong-password-42!",
};

describe("AuthService", () => {
  it("normalizes email, hashes the password, and issues a short-lived access token", async () => {
    const { repository, service } = createHarness();

    const result = await service.register(registration);
    const stored = await repository.findUserByEmail("rinkle@example.com");
    const storedSession = await repository.findRefreshSessionByHash(
      hashRefreshToken(result.refreshToken),
    );
    const verified = await jwtVerify(result.accessToken, accessTokenSecret);

    expect(result.user).toEqual({
      id: expect.any(String),
      email: "rinkle@example.com",
      displayName: "Rinkle Sharma",
    });
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain(registration.password);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(storedSession?.tokenHash).toBe(hashRefreshToken(result.refreshToken));
    await expect(repository.findRefreshSessionByHash(result.refreshToken)).resolves.toBeNull();
    expect(verified.payload.sub).toBe(result.user.id);
    expect(verified.payload.email).toBe("rinkle@example.com");
    expect((verified.payload.exp ?? 0) - (verified.payload.iat ?? 0)).toBe(300);
  });

  it("rejects weak passwords and normalized duplicate emails", async () => {
    const { service } = createHarness();

    await expect(
      service.register({ ...registration, password: "password" }),
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD" });

    await service.register(registration);
    await expect(
      service.register({ ...registration, email: "RINKLE@example.com" }),
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });
  });

  it("authenticates valid credentials without revealing which credential failed", async () => {
    const { service } = createHarness();
    await service.register(registration);

    await expect(
      service.login({ email: "rinkle@example.com", password: registration.password }),
    ).resolves.toMatchObject({ user: { email: "rinkle@example.com" } });
    await expect(
      service.login({ email: "missing@example.com", password: registration.password }),
    ).rejects.toEqual(new AuthError("INVALID_CREDENTIALS"));
    await expect(
      service.login({ email: registration.email, password: "Wrong-password-42!" }),
    ).rejects.toEqual(new AuthError("INVALID_CREDENTIALS"));
  });

  it("rotates refresh credentials and contains replay by revoking the token family", async () => {
    const { service } = createHarness();
    const registered = await service.register(registration);

    const rotated = await service.refresh(registered.refreshToken);
    expect(rotated.refreshToken).not.toBe(registered.refreshToken);

    await expect(service.refresh(registered.refreshToken)).rejects.toMatchObject({
      code: "REFRESH_REPLAYED",
    });
    await expect(service.refresh(rotated.refreshToken)).rejects.toMatchObject({
      code: "REFRESH_REPLAYED",
    });
  });

  it("rejects expired refresh credentials", async () => {
    const { advance, service } = createHarness();
    const registered = await service.register(registration);
    advance(60_001);

    await expect(service.refresh(registered.refreshToken)).rejects.toMatchObject({
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("revokes a refresh credential on logout without accepting unknown tokens", async () => {
    const { service } = createHarness();
    const registered = await service.register(registration);

    await expect(service.logout(registered.refreshToken)).resolves.toBe(true);
    await expect(service.logout(registered.refreshToken)).resolves.toBe(false);
    await expect(service.refresh(registered.refreshToken)).rejects.toMatchObject({
      code: "REFRESH_REPLAYED",
    });
  });
});
