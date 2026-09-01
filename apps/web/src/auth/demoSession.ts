import { createContext } from "react";

export const SESSION_KEY = "knowledge-ai.demo-session";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

export interface DemoSessionValue {
  user: DemoUser | null;
  mode: "fixture" | "api";
  status: "restoring" | "ready";
  googleOAuthEnabled:boolean;
  googleOAuthStartUrl:string|null;
  startDemo(): void;
  login(input: {email:string;password:string}): Promise<void>;
  register(input: {displayName:string;email:string;password:string}): Promise<void>;
  endDemo(): void | Promise<void>;
}

export const demoUser: DemoUser = {
  id: "demo-user",
  name: "Rinkle Sharma",
  email: "demo@keystone.local",
};

export const DemoSessionContext = createContext<DemoSessionValue | null>(null);
