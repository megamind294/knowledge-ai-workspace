import { createContext } from "react";

export const SESSION_KEY = "knowledge-ai.demo-session";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

export interface DemoSessionValue {
  user: DemoUser | null;
  startDemo(): void;
  endDemo(): void;
}

export const demoUser: DemoUser = {
  id: "demo-user",
  name: "Rinkle Sharma",
  email: "demo@keystone.local",
};

export const DemoSessionContext = createContext<DemoSessionValue | null>(null);
