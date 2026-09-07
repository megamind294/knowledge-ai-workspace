import {
  EmbeddingProviderError,
  type EmbeddingProvider,
} from "./embeddingProvider.js";

export { EmbeddingProviderError } from "./embeddingProvider.js";

export interface OpenAiEmbeddingConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  dimensions: number;
  timeoutMs?: number;
}

interface EmbeddingItem {
  index: number;
  embedding: number[];
}

function isEmbeddingItem(
  value: unknown,
  dimensions: number,
): value is EmbeddingItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    Number.isInteger(item.index) &&
    Array.isArray(item.embedding) &&
    item.embedding.length === dimensions &&
    item.embedding.every(
      (component) => typeof component === "number" && Number.isFinite(component),
    ) &&
    item.embedding.some((component) => component !== 0)
  );
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: OpenAiEmbeddingConfig,
    private readonly request: typeof fetch = fetch,
  ) {
    this.model = config.model;
    this.dimensions = config.dimensions;
    this.timeoutMs = config.timeoutMs ?? 15_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive integer");
    }
  }

  async embed(texts: readonly string[]) {
    if (texts.length === 0) return [];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    let body: unknown;
    try {
      try {
        response = await this.request(this.config.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            input: texts,
            model: this.model,
            dimensions: this.dimensions,
          }),
          signal: controller.signal,
        });
      } catch {
        throw new EmbeddingProviderError("PROVIDER_FAILURE");
      }

      if (!response.ok) {
        throw new EmbeddingProviderError("PROVIDER_FAILURE");
      }

      try {
        body = await response.json();
      } catch {
        throw new EmbeddingProviderError(
          controller.signal.aborted ? "PROVIDER_FAILURE" : "INVALID_RESPONSE",
        );
      }
    } finally {
      clearTimeout(timeout);
    }
    const data =
      body && typeof body === "object"
        ? (body as Record<string, unknown>).data
        : undefined;
    if (
      !Array.isArray(data) ||
      data.length !== texts.length ||
      !data.every((item) => isEmbeddingItem(item, this.dimensions))
    ) {
      throw new EmbeddingProviderError("INVALID_RESPONSE");
    }

    const ordered = [...data].sort((left, right) => left.index - right.index);
    if (ordered.some((item, index) => item.index !== index)) {
      throw new EmbeddingProviderError("INVALID_RESPONSE");
    }
    return ordered.map((item) => [...item.embedding]);
  }
}
