import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { AuthService } from "./authService.js";
import { GoogleOAuthAdapter } from "./googleOAuth.js";
import { InMemoryAuthRepository } from "./inMemoryAuthRepository.js";
import { createPasswordService } from "./passwords.js";

const secret=new TextEncoder().encode("test-only-secret-that-is-at-least-thirty-two-bytes");
const config={clientId:"client",clientSecret:"secret",redirectUri:"https://api.example.com/api/auth/google/callback",authorizationEndpoint:"https://accounts.google.test/auth",tokenEndpoint:"https://accounts.google.test/token",userInfoEndpoint:"https://accounts.google.test/userinfo"};
function service(){let sequence=0;return new AuthService({repository:new InMemoryAuthRepository(),passwordService:createPasswordService({rounds:4}),accessTokenSecret:secret,createId:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,"0")}`});}
function cookies(response:request.Response){const values=response.headers["set-cookie"];return (Array.isArray(values)?values:[values]).filter(Boolean).map(value=>String(value).split(";",1)[0]).join("; ");}

describe("Google OAuth HTTP boundary",()=>{
  it("reports disabled capability and refuses authorization start",async()=>{
    const app=createApp({auth:{service:service(),accessTokenSecret:secret,secureCookies:false}});
    await request(app).get("/api/auth/capabilities").expect(200,{googleOAuth:false});
    await request(app).get("/api/auth/google/start").expect(404);
  });

  it("sets server-controlled state and verifier cookies before redirecting",async()=>{
    const adapter=new GoogleOAuthAdapter(config,{createState:()=>"state-123",createVerifier:()=>"verifier-123"});
    const app=createApp({auth:{service:service(),accessTokenSecret:secret,secureCookies:false,googleOAuth:{adapter,frontendRedirectUrl:"https://web.example.com/app"}}});
    const response=await request(app).get("/api/auth/google/start").expect(302);
    expect(response.headers.location).toContain("state=state-123");
    expect(response.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("keystone_oauth_state=state-123"),expect.stringContaining("keystone_oauth_verifier=verifier-123")]));
  });

  it("maps the callback identity into a Keystone session and redirects without exposing tokens",async()=>{
    const providerFetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:"provider-token"}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({sub:"google-123",email:"rinkle@example.com",email_verified:true,name:"Rinkle Sharma"}),{status:200}));
    const adapter=new GoogleOAuthAdapter(config,{fetch:providerFetch,createState:()=>"state-123",createVerifier:()=>"verifier-123"});
    const app=createApp({auth:{service:service(),accessTokenSecret:secret,secureCookies:true,googleOAuth:{adapter,frontendRedirectUrl:"https://web.example.com/app"}}});
    const start=await request(app).get("/api/auth/google/start").expect(302);
    const callback=await request(app).get("/api/auth/google/callback?code=code-123&state=state-123").set("Cookie",cookies(start)).expect(302);
    expect(callback.headers.location).toBe("https://web.example.com/app");
    expect(callback.headers.location).not.toContain("token");
    expect(callback.headers["set-cookie"]).toEqual(expect.arrayContaining([expect.stringContaining("keystone_refresh="),expect.stringContaining("HttpOnly"),expect.stringContaining("Secure")]));
  });

  it("rejects mismatched state and normalizes provider failure",async()=>{
    const providerFetch=vi.fn().mockResolvedValue(new Response("secret provider details",{status:500}));
    const adapter=new GoogleOAuthAdapter(config,{fetch:providerFetch,createState:()=>"state-123",createVerifier:()=>"verifier-123"});
    const app=createApp({auth:{service:service(),accessTokenSecret:secret,secureCookies:false,googleOAuth:{adapter,frontendRedirectUrl:"/app"}}});
    const start=await request(app).get("/api/auth/google/start");
    const mismatch=await request(app).get("/api/auth/google/callback?code=code&state=wrong").set("Cookie",cookies(start)).expect(400);
    expect(mismatch.body.error.code).toBe("BAD_REQUEST");expect(providerFetch).not.toHaveBeenCalled();
    const failure=await request(app).get("/api/auth/google/callback?code=code&state=state-123").set("Cookie",cookies(start)).expect(502);
    expect(failure.body.error.message).toBe("Google authentication failed");expect(JSON.stringify(failure.body)).not.toContain("secret provider details");
  });
});
