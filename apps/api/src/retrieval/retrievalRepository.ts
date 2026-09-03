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
