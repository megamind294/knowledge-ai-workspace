import { useContext } from "react";
import { DemoSessionContext } from "./demoSession";

export function useDemoSession() {
  const session = useContext(DemoSessionContext);

  if (!session) {
    throw new Error("useDemoSession must be used within DemoSessionProvider");
  }

  return session;
}
