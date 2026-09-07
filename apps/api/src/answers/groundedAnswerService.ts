import type { RetrievalResult } from "@knowledge-ai/contracts";
import type {
  GenerationProvider,
  GenerationSource,
} from "../ai/generationProvider.js";

export type GroundedAnswerStatus = "answered" | "insufficient_context";

export interface GroundedAnswer {
  status: GroundedAnswerStatus;
  answer: string;
  model: string | null;
  citations: RetrievalResult[];
}

export type GroundedAnswerServiceErrorCode =
  | "INVALID_PROVIDER_RESPONSE"
  | "INVALID_CITATIONS";

export class GroundedAnswerServiceError extends Error {
  constructor(public readonly code: GroundedAnswerServiceErrorCode) {
    super(
      code === "INVALID_CITATIONS"
        ? "Generation provider returned invalid citations"
        : "Generation provider returned an invalid answer",
    );
    this.name = "GroundedAnswerServiceError";
  }
}

interface GroundedAnswerServiceOptions {
  provider: GenerationProvider;
  minimumSimilarity?: number;
  maxSources?: number;
  maxContextCharacters?: number;
}

interface PreparedSource {
  prompt: GenerationSource;
  result: RetrievalResult;
}

const INSUFFICIENT_CONTEXT =
  "I couldn't find reliable source material to answer that question.";

export class GroundedAnswerService {
  private readonly minimumSimilarity: number;
  private readonly maxSources: number;
  private readonly maxContextCharacters: number;

  constructor(private readonly options: GroundedAnswerServiceOptions) {
    this.minimumSimilarity = options.minimumSimilarity ?? 0.7;
    this.maxSources = options.maxSources ?? 8;
    this.maxContextCharacters = options.maxContextCharacters ?? 24_000;
    if (
      !Number.isFinite(this.minimumSimilarity) ||
      this.minimumSimilarity < -1 ||
      this.minimumSimilarity > 1
    ) {
      throw new RangeError("minimumSimilarity must be between -1 and 1");
    }
    if (!Number.isInteger(this.maxSources) || this.maxSources <= 0) {
      throw new RangeError("maxSources must be a positive integer");
    }
    if (
      !Number.isInteger(this.maxContextCharacters) ||
      this.maxContextCharacters <= 0
    ) {
      throw new RangeError("maxContextCharacters must be a positive integer");
    }
  }

  private prepare(results: readonly RetrievalResult[]) {
    const prepared: PreparedSource[] = [];
    const seenChunkIds = new Set<string>();
    let remaining = this.maxContextCharacters;
    for (const result of results) {
      if (
        result.score < this.minimumSimilarity ||
        seenChunkIds.has(result.chunkId) ||
        prepared.length >= this.maxSources ||
        remaining === 0
      ) {
        continue;
      }
      const content = result.content.slice(0, remaining);
      if (!content) continue;
      const id = `source-${prepared.length + 1}`;
      prepared.push({ prompt: { id, content }, result });
      seenChunkIds.add(result.chunkId);
      remaining -= content.length;
    }
    return prepared;
  }

  async answer(
    question: string,
    results: readonly RetrievalResult[],
  ): Promise<GroundedAnswer> {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) throw new RangeError("question must not be empty");

    const prepared = this.prepare(results);
    if (prepared.length === 0) {
      return {
        status: "insufficient_context",
        answer: INSUFFICIENT_CONTEXT,
        model: null,
        citations: [],
      };
    }

    const generatedValue: unknown = await this.options.provider.generate({
      question: normalizedQuestion,
      sources: prepared.map((source) => source.prompt),
    });
    if (!generatedValue || typeof generatedValue !== "object") {
      throw new GroundedAnswerServiceError("INVALID_PROVIDER_RESPONSE");
    }
    const candidate = generatedValue as Record<string, unknown>;
    const answer = typeof candidate.answer === "string" ? candidate.answer.trim() : "";
    if (
      !answer ||
      answer.length > 12_000 ||
      !Array.isArray(candidate.citationIds) ||
      candidate.citationIds.length === 0 ||
      !candidate.citationIds.every((id) => typeof id === "string")
    ) {
      throw new GroundedAnswerServiceError("INVALID_PROVIDER_RESPONSE");
    }
    const citationIds = candidate.citationIds as string[];
    const byId = new Map(prepared.map((source) => [source.prompt.id, source.result]));
    const citations: RetrievalResult[] = [];
    const seenChunkIds = new Set<string>();
    for (const id of citationIds) {
      const source = byId.get(id);
      if (!source) throw new GroundedAnswerServiceError("INVALID_CITATIONS");
      if (!seenChunkIds.has(source.chunkId)) {
        citations.push(source);
        seenChunkIds.add(source.chunkId);
      }
    }
    if (citations.length === 0) {
      throw new GroundedAnswerServiceError("INVALID_CITATIONS");
    }

    return {
      status: "answered",
      answer,
      model: this.options.provider.model,
      citations,
    };
  }
}
