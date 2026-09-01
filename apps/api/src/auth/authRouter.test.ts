import { AuthSessionResponseSchema, PublicUserSchema } from "@knowledge-ai/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { AuthService } from "./authService.js";
import { InMemoryAuthRepository } from "./inMemoryAuthRepository.js";
import { createPasswordService } from "./passwords.js";

const secret = new TextEncoder().encode(
  "test-only-secret-that-is-at-least-thirty-two-bytes",
);
const credentials = {
  email: "rinkle@example.com",
  displayName: "Rinkle Sharma",
  password: "Strong-password-42!",
};

function createTestApp(secureCookies = false) {
  let sequence = 0;
  const service = new AuthService({
    repository: new InMemoryAuthRepository(),
    passwordService: createPasswordService({ rounds: 4 }),
    accessTokenSecret: secret,
    createId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  });
  return createApp({
    auth: { service, accessTokenSecret: secret, secureCookies },
  });
}

function cookieFrom(response: request.Response) {
  const values = response.headers["set-cookie"];
  const value = Array.isArray(values) ? values[0] : values;
  if (!value) throw new Error("Expected refresh cookie");
  return value;
}

describe("authentication HTTP API", () => {
  it("registers a user, returns a contract-valid session, and sets a scoped HTTP-only cookie", async () => {
    const response = await request(createTestApp())
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    const parsed = AuthSessionResponseSchema.parse(response.body);
    const cookie = cookieFrom(response);

    expect(parsed.user.email).toBe(credentials.email);
    expect(response.body).not.toHaveProperty("refreshToken");
    expect(cookie).toContain("keystone_refresh=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).not.toContain("Secure");
  });

  it("uses secure refresh cookies in production composition", async () => {
    const response = await request(createTestApp(true))
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);

    expect(cookieFrom(response)).toContain("Secure");
  });

  it("normalizes validation and duplicate-registration failures without leaking passwords", async () => {
    const app = createTestApp();
    const invalid = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, password: "weak" })
      .expect(400);
    await request(app).post("/api/auth/register").send(credentials).expect(201);
    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({ ...credentials, email: "RINKLE@example.com" })
      .expect(409);

    expect(invalid.body.error.code).toBe("BAD_REQUEST");
    expect(duplicate.body.error.code).toBe("CONFLICT");
    expect(JSON.stringify([invalid.body, duplicate.body])).not.toContain(credentials.password);
  });

  it("returns the same unauthorized response for unknown users and wrong passwords", async () => {
    const app = createTestApp();
    await request(app).post("/api/auth/register").send(credentials).expect(201);

    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "unknown@example.com", password: credentials.password })
      .expect(401);
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "Wrong-password-42!" })
      .expect(401);

    expect(unknown.body.error.code).toBe(wrong.body.error.code);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
    expect(unknown.body.error.message).toBe("Invalid email or password");
  });

  it("logs in with valid credentials and replaces the refresh cookie", async () => {
    const app = createTestApp();
    const registered = await request(app)
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    const loggedIn = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password })
      .expect(200);

    expect(AuthSessionResponseSchema.parse(loggedIn.body).user.email).toBe(
      credentials.email,
    );
    expect(cookieFrom(loggedIn)).not.toBe(cookieFrom(registered));
  });

  it("rotates refresh credentials and rejects reuse of the previous cookie", async () => {
    const app = createTestApp();
    const registered = await request(app)
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    const original = cookieFrom(registered).split(";", 1)[0]!;
    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", original)
      .expect(200);
    const replacement = cookieFrom(refreshed).split(";", 1)[0]!;

    expect(replacement).not.toBe(original);
    await request(app).post("/api/auth/refresh").set("Cookie", original).expect(401);
  });

  it("rejects refresh requests without the HTTP-only cookie", async () => {
    const response = await request(createTestApp())
      .post("/api/auth/refresh")
      .expect(401);

    expect(response.body.error).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Refresh session is invalid",
    });
  });

  it("clears and revokes refresh credentials on logout", async () => {
    const app = createTestApp();
    const registered = await request(app)
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    const cookie = cookieFrom(registered).split(";", 1)[0]!;
    const loggedOut = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .expect(204);

    expect(cookieFrom(loggedOut)).toMatch(/keystone_refresh=;/);
    await request(app).post("/api/auth/refresh").set("Cookie", cookie).expect(401);
  });

  it("protects /me with bearer verification and returns the public user", async () => {
    const app = createTestApp();
    const registered = await request(app)
      .post("/api/auth/register")
      .send(credentials)
      .expect(201);
    const accessToken = AuthSessionResponseSchema.parse(registered.body).accessToken;

    await request(app).get("/api/auth/me").expect(401);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token")
      .expect(401);
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(PublicUserSchema.parse(me.body.user)).toMatchObject({
      email: credentials.email,
    });
  });
});
