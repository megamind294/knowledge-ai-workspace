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

export class GroundedAnswerServiceError extends Error {
  readonly code = "INVALID_CITATIONS";

  constructor() {
    super("Generation provider returned invalid citations");
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
    let remaining = this.maxContextCharacters;
    for (const result of results) {
      if (
        result.score < this.minimumSimilarity ||
        prepared.length >= this.maxSources ||
        remaining === 0
      ) {
        continue;
      }
      const content = result.content.slice(0, remaining);
      if (!content) continue;
      const id = `source-${prepared.length + 1}`;
      prepared.push({ prompt: { id, content }, result });
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

    const generated = await this.options.provider.generate({
      question: normalizedQuestion,
      sources: prepared.map((source) => source.prompt),
    });
    const byId = new Map(prepared.map((source) => [source.prompt.id, source.result]));
    const citations: RetrievalResult[] = [];
    const seen = new Set<string>();
    for (const id of generated.citationIds) {
      const source = byId.get(id);
      if (!source) throw new GroundedAnswerServiceError();
      if (!seen.has(id)) {
        citations.push(source);
        seen.add(id);
      }
    }
    if (citations.length === 0) throw new GroundedAnswerServiceError();

    return {
      status: "answered",
      answer: generated.answer,
      model: this.options.provider.model,
      citations,
    };
  }
}
