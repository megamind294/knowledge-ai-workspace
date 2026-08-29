import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/router";
import { DemoSessionProvider } from "./auth/DemoSessionProvider";
import { KnowledgeRepositoryProvider } from "./data/KnowledgeRepositoryProvider";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KnowledgeRepositoryProvider>
        <DemoSessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DemoSessionProvider>
      </KnowledgeRepositoryProvider>
    </QueryClientProvider>
  );
}
