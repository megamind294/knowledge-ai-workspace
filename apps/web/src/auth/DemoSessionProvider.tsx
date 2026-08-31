import {
  type PropsWithChildren,
  useMemo,
  useState,
} from "react";
import {
  demoUser,
  DemoSessionContext,
  type DemoSessionValue,
  type DemoUser,
  SESSION_KEY,
} from "./demoSession";

function hasPersistedSession() {
  return window.localStorage.getItem(SESSION_KEY) === "active";
}

export function DemoSessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<DemoUser | null>(() =>
    hasPersistedSession() ? demoUser : null,
  );

  const value = useMemo<DemoSessionValue>(
    () => ({
      user,
      mode: "fixture",
      status: "ready",
      startDemo() {
        window.localStorage.setItem(SESSION_KEY, "active");
        setUser(demoUser);
      },
      endDemo() {
        window.localStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
      async login() { throw new Error("Email sign-in is unavailable in fixture mode"); },
      async register() { throw new Error("Registration is unavailable in fixture mode"); },
    }),
    [user],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}
