import type { RetrievalResult, RetrievalScope } from "@knowledge-ai/contracts";

export type { RetrievalScope };

export interface RetrievalRepository {
  canAccessScope(
    userId: string,
    workspaceId: string,
    scope: RetrievalScope,
  ): Promise<boolean>;
  search(
    userId: string,
    workspaceId: string,
    embedding: readonly number[],
    embeddingModel: string,
    scope: RetrievalScope,
    topK: number,
  ): Promise<RetrievalResult[] | null>;
}

export interface AuthorizedRetrievalRepository extends RetrievalRepository {
  withAuthorizedScope<T>(
    userId: string,
    workspaceId: string,
    scope: RetrievalScope,
    operation: (
      search: (
        embedding: readonly number[],
        embeddingModel: string,
        topK: number,
      ) => Promise<RetrievalResult[]>,
    ) => Promise<T>,
  ): Promise<T | null>;
}
