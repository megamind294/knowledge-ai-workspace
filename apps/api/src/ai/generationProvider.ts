export type GenerationProviderErrorCode =
  | "INVALID_RESPONSE"
  | "PROVIDER_FAILURE";

export class GenerationProviderError extends Error {
  constructor(public readonly code: GenerationProviderErrorCode) {
    super(
      code === "INVALID_RESPONSE"
        ? "Generation provider returned an invalid response"
        : "Generation provider failed",
    );
    this.name = "GenerationProviderError";
  }
}

export interface GenerationSource {
  id: string;
  content: string;
}

export interface GenerationInput {
  question: string;
  sources: readonly GenerationSource[];
}

export interface GeneratedAnswer {
  answer: string;
  citationIds: string[];
}

export interface GenerationProvider {
  readonly model: string;
  generate(input: GenerationInput): Promise<GeneratedAnswer>;
}
