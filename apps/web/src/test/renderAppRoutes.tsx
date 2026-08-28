import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../app/router";
import { DemoSessionProvider } from "../auth/DemoSessionProvider";
import { KnowledgeRepositoryProvider } from "../data/KnowledgeRepositoryProvider";

export function renderAppRoutes(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <KnowledgeRepositoryProvider>
        <DemoSessionProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <AppRoutes />
          </MemoryRouter>
        </DemoSessionProvider>
      </KnowledgeRepositoryProvider>
    </QueryClientProvider>,
  );
}
