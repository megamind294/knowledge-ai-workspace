import { useContext } from "react";
import { KnowledgeRepositoryContext } from "./knowledgeRepositoryContext";

export function useKnowledgeRepository() {
  const repository = useContext(KnowledgeRepositoryContext);

  if (!repository) {
    throw new Error(
      "useKnowledgeRepository must be used within KnowledgeRepositoryProvider",
    );
  }

  return repository;
}
