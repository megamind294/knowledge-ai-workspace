import { GoogleOAuthAdapter } from "./googleOAuth.js";
import { describe, expect, it, vi } from "vitest";

const config={clientId:"client-id",clientSecret:"client-secret",redirectUri:"https://api.example.com/api/auth/google/callback",authorizationEndpoint:"https://accounts.google.com/o/oauth2/v2/auth",tokenEndpoint:"https://oauth2.googleapis.com/token",userInfoEndpoint:"https://openidconnect.googleapis.com/v1/userinfo"};

describe("Google OAuth adapter",()=>{
  it("reports disabled configuration and refuses to start",()=>{
    const adapter=new GoogleOAuthAdapter(null);
    expect(adapter.enabled).toBe(false);
    expect(()=>adapter.createAuthorization()).toThrowError(expect.objectContaining({code:"DISABLED"}));
  });

  it("creates an authorization URL with generated state and PKCE",()=>{
    const adapter=new GoogleOAuthAdapter(config,{createState:()=>"state-123",createVerifier:()=>"verifier-123"});
    const start=adapter.createAuthorization(); const url=new URL(start.url);
    expect(start).toMatchObject({state:"state-123",verifier:"verifier-123"});
    expect(url.searchParams.get("client_id")).toBe(config.clientId);
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).not.toBe("verifier-123");
  });

  it("rejects state mismatch before contacting the provider",async()=>{
    const providerFetch=vi.fn(); const adapter=new GoogleOAuthAdapter(config,{fetch:providerFetch});
    await expect(adapter.exchange({code:"code",state:"received",expectedState:"expected",verifier:"verifier"})).rejects.toMatchObject({code:"INVALID_STATE"});
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("exchanges the code and maps a verified Google profile",async()=>{
    const providerFetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token:"google-access",token_type:"Bearer"}),{status:200,headers:{"content-type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({sub:"google-123",email:"RINKLE@example.com",email_verified:true,name:"Rinkle Sharma"}),{status:200,headers:{"content-type":"application/json"}}));
    const adapter=new GoogleOAuthAdapter(config,{fetch:providerFetch});
    await expect(adapter.exchange({code:"code",state:"state",expectedState:"state",verifier:"verifier"})).resolves.toEqual({provider:"google",subject:"google-123",email:"rinkle@example.com",displayName:"Rinkle Sharma"});
    expect(String(providerFetch.mock.calls[0]?.[1]?.body)).toContain("client_secret=client-secret");
    expect(providerFetch.mock.calls[1]?.[1]?.headers).toMatchObject({Authorization:"Bearer google-access"});
  });

  it("normalizes provider failures without leaking client secrets or response details",async()=>{
    const adapter=new GoogleOAuthAdapter(config,{fetch:vi.fn().mockResolvedValue(new Response("client-secret leaked",{status:500}))});
    const error=await adapter.exchange({code:"code",state:"state",expectedState:"state",verifier:"verifier"}).catch(value=>value);
    expect(error).toMatchObject({code:"PROVIDER_FAILURE",message:"Google authentication failed"});
    expect(JSON.stringify(error)).not.toContain(config.clientSecret);
  });
});
