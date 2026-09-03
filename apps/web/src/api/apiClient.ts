import type { AuthCapabilitiesResponse, AuthSessionResponse, LoginRequest, PublicUser, RegisterRequest } from "@knowledge-ai/contracts";

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

interface ApiClientOptions { baseUrl: string; }

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<AuthSessionResponse> | null = null;
  constructor(private readonly options: ApiClientOptions) {}

  private async raw<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string,string> = { ...(init.headers as Record<string,string> | undefined) };
    const hasContentType = Object.keys(headers).some(
      (name) => name.toLowerCase() === "content-type",
    );
    if (init.body && !hasContentType) headers["Content-Type"] = "application/json";
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const response = await fetch(`${this.options.baseUrl}${path}`, { ...init, credentials: "include", headers });
    if (response.status === 204) return undefined as T;
    const body = await response.json() as {error?:{code:string;message:string}} | T;
    if (!response.ok) { const failure=body as {error?:{code:string;message:string}}; throw new ApiClientError(response.status,failure.error?.code ?? "HTTP_ERROR",failure.error?.message ?? "Request failed"); }
    return body as T;
  }

  async request<T=unknown>(path:string, init:RequestInit = {}):Promise<T> {
    try { return await this.raw<T>(path,init); }
    catch(error) { if (!(error instanceof ApiClientError) || error.status !== 401 || path === "/api/auth/refresh") throw error; await this.restoreSession(); return this.raw<T>(path,init); }
  }
  private accept(session:AuthSessionResponse) { this.accessToken=session.accessToken; return session; }
  async register(input:RegisterRequest) { return this.accept(await this.raw<AuthSessionResponse>("/api/auth/register",{method:"POST",body:JSON.stringify(input)})); }
  async login(input:LoginRequest) { return this.accept(await this.raw<AuthSessionResponse>("/api/auth/login",{method:"POST",body:JSON.stringify(input)})); }
  async restoreSession() {
    if (!this.refreshPromise) this.refreshPromise=this.raw<AuthSessionResponse>("/api/auth/refresh",{method:"POST"}).then(session=>this.accept(session)).finally(()=>{this.refreshPromise=null;});
    return this.refreshPromise;
  }
  async logout() { try { await this.raw<void>("/api/auth/logout",{method:"POST"}); } finally { this.accessToken=null; } }
  async currentUser():Promise<PublicUser> { const response=await this.request<{user:PublicUser}>("/api/auth/me"); return response.user; }
  async capabilities(){return this.raw<AuthCapabilitiesResponse>("/api/auth/capabilities");}
  googleOAuthStartUrl(){return `${this.options.baseUrl}/api/auth/google/start`;}
}
