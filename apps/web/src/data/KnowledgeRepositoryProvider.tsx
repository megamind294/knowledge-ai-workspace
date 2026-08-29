import type { PropsWithChildren } from "react";
import { fixtureKnowledgeRepository, type KnowledgeRepository } from "./knowledgeRepository";
import { KnowledgeRepositoryContext } from "./knowledgeRepositoryContext";

interface KnowledgeRepositoryProviderProps extends PropsWithChildren {
  repository?: KnowledgeRepository;
}

export function KnowledgeRepositoryProvider({
  children,
  repository = fixtureKnowledgeRepository,
}: KnowledgeRepositoryProviderProps) {
  return (
    <KnowledgeRepositoryContext.Provider value={repository}>
      {children}
    </KnowledgeRepositoryContext.Provider>
  );
}
