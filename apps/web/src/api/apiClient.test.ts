import { ApiClient, ApiClientError } from "./apiClient";

describe("ApiClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("restores a session and retries one unauthorized request with the replacement token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: "one" } }), { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: "00000000-0000-4000-8000-000000000001", email: "rinkle@example.com", displayName: "Rinkle Sharma" }, accessToken: "replacement", refreshTokenExpiresAt: "2026-10-01T00:00:00.000Z" }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ workspaces: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "https://api.example.com" });

    await expect(client.request("/api/workspaces")).resolves.toEqual({ workspaces: [] });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.example.com/api/auth/refresh", expect.objectContaining({ credentials: "include", method: "POST" }));
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({ Authorization: "Bearer replacement" });
  });

  it("does not loop when refresh is unauthorized and exposes the normalized API error", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Authentication required", requestId: "one" } }), { status: 401, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Refresh session is invalid", requestId: "two" } }), { status: 401, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "" });

    await expect(client.request("/api/workspaces")).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Refresh session is invalid" } satisfies Partial<ApiClientError>);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("registers, logs in, restores, and logs out without persisting access tokens", async () => {
    const session = { user: { id: "00000000-0000-4000-8000-000000000001", email: "rinkle@example.com", displayName: "Rinkle Sharma" }, accessToken: "access", refreshTokenExpiresAt: "2026-10-01T00:00:00.000Z" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiClient({ baseUrl: "" });

    await client.register({ email: session.user.email, displayName: session.user.displayName, password: "Strong-password-42!" });
    await client.login({ email: session.user.email, password: "Strong-password-42!" });
    await client.restoreSession();
    await client.logout();
    expect(window.localStorage.length).toBe(0);
  });
});
