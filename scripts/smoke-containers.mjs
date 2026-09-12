import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = new URL(process.env.KEYSTONE_SMOKE_BASE_URL ?? "http://127.0.0.1:8080");
const requestTimeoutMs = Number(process.env.KEYSTONE_SMOKE_REQUEST_TIMEOUT_MS ?? 10_000);
assert.ok(
  Number.isInteger(requestTimeoutMs) && requestTimeoutMs >= 1_000 && requestTimeoutMs <= 60_000,
  "KEYSTONE_SMOKE_REQUEST_TIMEOUT_MS must be an integer from 1000 through 60000",
);
const runId = randomUUID();
const password = "Container-smoke-password-42!";
const credentials = {
  email: `container-smoke+${runId}@example.com`,
  displayName: "Container Smoke",
  password,
};

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const body = await response.text();
  return { response, body };
}

function json(body, description) {
  try {
    return JSON.parse(body);
  } catch {
    assert.fail(`${description} returned invalid JSON`);
  }
}

const webHealth = await request("/healthz");
assert.equal(webHealth.response.status, 200, "web health endpoint is available");
assert.equal(webHealth.body, "ok\n", "web health endpoint has the expected body");

const apiHealth = await request("/api/health");
assert.equal(apiHealth.response.status, 200, "API liveness is available through the web proxy");
assert.deepEqual(json(apiHealth.body, "API liveness"), {
  status: "ok",
  service: "knowledge-ai-api",
});

const readiness = await request("/api/ready");
assert.equal(readiness.response.status, 200, "API readiness confirms PostgreSQL availability");
assert.deepEqual(json(readiness.body, "API readiness"), {
  status: "ready",
  service: "knowledge-ai-api",
  checks: { database: "ok" },
});
assert.equal(readiness.response.headers.get("cache-control"), "no-store");

const register = await request("/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(credentials),
});
assert.equal(register.response.status, 201, "registration succeeds through the built web/API topology");
const registration = json(register.body, "registration");
assert.equal(registration.user.email, credentials.email);
assert.equal(typeof registration.accessToken, "string");
assert.ok(registration.accessToken.length > 0);
assert.match(register.response.headers.get("set-cookie") ?? "", /keystone_refresh=/);

const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: credentials.email, password }),
});
assert.equal(login.response.status, 200, "login succeeds through the built web/API topology");
const session = json(login.body, "login");
assert.equal(session.user.id, registration.user.id);
assert.ok(session.accessToken.length > 0);

const currentUser = await request("/api/auth/me", {
  headers: { authorization: `Bearer ${session.accessToken}` },
});
assert.equal(currentUser.response.status, 200, "issued access token authenticates a protected request");
assert.equal(json(currentUser.body, "current user").user.id, registration.user.id);

const deepRoute = await request("/app/workspaces/container-smoke");
assert.equal(deepRoute.response.status, 200, "deep SPA route falls back to the built application");
assert.match(deepRoute.response.headers.get("content-type") ?? "", /^text\/html/);
assert.match(deepRoute.body, /<title>Keystone AI Workspace<\/title>/);
assert.match(deepRoute.body, /<div id="root"><\/div>/);

console.log("Container smoke passed: web health, API liveness/readiness, authentication, and deep SPA routing.");
