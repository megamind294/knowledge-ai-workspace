import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./app/router";
import { ApiClient } from "./api/apiClient";
import { ApiSessionProvider } from "./auth/apiSession";
import { DemoSessionProvider } from "./auth/DemoSessionProvider";
import { KnowledgeRepositoryProvider } from "./data/KnowledgeRepositoryProvider";
import { createApiKnowledgeRepository } from "./data/apiKnowledgeRepository";
import { fixtureKnowledgeRepository } from "./data/knowledgeRepository";

const queryClient = new QueryClient();
const fixtureMode=import.meta.env.VITE_DATA_MODE === "fixture";
const apiClient=new ApiClient({baseUrl:import.meta.env.VITE_API_URL ?? ""});
const repository=fixtureMode?fixtureKnowledgeRepository:createApiKnowledgeRepository(apiClient);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <KnowledgeRepositoryProvider repository={repository}>
        {fixtureMode ? <DemoSessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DemoSessionProvider> : <ApiSessionProvider client={apiClient}><BrowserRouter><AppRoutes /></BrowserRouter></ApiSessionProvider>}
      </KnowledgeRepositoryProvider>
    </QueryClientProvider>
  );
}
