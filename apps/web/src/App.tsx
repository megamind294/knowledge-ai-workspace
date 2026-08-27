import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/router";
import { DemoSessionProvider } from "./auth/DemoSessionProvider";

export function App() {
  return (
    <DemoSessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </DemoSessionProvider>
  );
}
