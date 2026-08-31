import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ApiClient } from "../api/apiClient";
import { AppRoutes } from "../app/router";
import { KnowledgeRepositoryProvider } from "../data/KnowledgeRepositoryProvider";
import { fixtureKnowledgeRepository } from "../data/knowledgeRepository";
import { ApiSessionProvider } from "./apiSession";

const session={user:{id:"00000000-0000-4000-8000-000000000001",email:"rinkle@example.com",displayName:"Rinkle Sharma"},accessToken:"access",refreshTokenExpiresAt:"2026-10-01T00:00:00.000Z"};
function renderApi(entry:string,overrides:Partial<ApiClient>={}){
  const client={restoreSession:vi.fn().mockRejectedValue(new Error("no session")),login:vi.fn(),register:vi.fn(),logout:vi.fn(),...overrides} as unknown as ApiClient;
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><KnowledgeRepositoryProvider repository={fixtureKnowledgeRepository}><ApiSessionProvider client={client}><MemoryRouter initialEntries={[entry]}><AppRoutes/></MemoryRouter></ApiSessionProvider></KnowledgeRepositoryProvider></QueryClientProvider>);
  return client;
}

describe("API session UI",()=>{
  it("restores an HTTP-only cookie session before rendering protected routes",async()=>{
    renderApi("/app",{restoreSession:vi.fn().mockResolvedValue(session)});
    expect(screen.getByRole("status")).toHaveTextContent(/restoring secure session/i);
    expect(await screen.findByRole("heading",{name:/dashboard/i})).toBeVisible();
    expect(screen.getByText(/authenticated api session/i)).toBeVisible();
  });

  it("submits real credentials and displays normalized API failures",async()=>{
    const login=vi.fn().mockRejectedValue(new Error("Invalid email or password"));
    renderApi("/login",{login}); await waitFor(()=>expect(screen.getByRole("button",{name:/sign in/i})).toBeEnabled());
    const user=userEvent.setup();await user.type(screen.getByLabelText(/email address/i),"rinkle@example.com");await user.type(screen.getByLabelText(/^password$/i),"wrong");await user.click(screen.getByRole("button",{name:/sign in/i}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(login).toHaveBeenCalledWith({email:"rinkle@example.com",password:"wrong"});
  });

  it("exposes browser validation for registration and creates an authenticated session",async()=>{
    const register=vi.fn().mockResolvedValue(session);renderApi("/register",{register});await waitFor(()=>expect(screen.getByRole("button",{name:/create account/i})).toBeEnabled());
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute("minlength","12");
    const user=userEvent.setup();await user.type(screen.getByLabelText(/full name/i),"Rinkle Sharma");await user.type(screen.getByLabelText(/email address/i),"rinkle@example.com");await user.type(screen.getByLabelText(/^password$/i),"Strong-password-42!");await user.click(screen.getByRole("button",{name:/create account/i}));
    expect(register).toHaveBeenCalledWith({displayName:"Rinkle Sharma",email:"rinkle@example.com",password:"Strong-password-42!"});
    expect(await screen.findByRole("heading",{name:/dashboard/i})).toBeVisible();
  });
});
