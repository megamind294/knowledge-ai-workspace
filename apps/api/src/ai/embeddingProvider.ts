export type EmbeddingProviderErrorCode =
  | "INVALID_RESPONSE"
  | "PROVIDER_FAILURE";

export class EmbeddingProviderError extends Error {
  constructor(public readonly code: EmbeddingProviderErrorCode) {
    super(
      code === "INVALID_RESPONSE"
        ? "Embedding provider returned an invalid response"
        : "Embedding provider failed",
    );
    this.name = "EmbeddingProviderError";
  }
}

export interface EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: readonly string[]): Promise<number[][]>;
}
