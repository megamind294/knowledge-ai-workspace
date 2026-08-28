import { createContext } from "react";
import type { KnowledgeRepository } from "./knowledgeRepository";

export const KnowledgeRepositoryContext = createContext<
  KnowledgeRepository | undefined
>(undefined);
