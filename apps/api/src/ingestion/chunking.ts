export interface ExtractedSection {
  text: string;
  pageNumber?: number;
  sectionHeading?: string;
}

export type NormalizedSection = ExtractedSection;

export interface ChunkOptions {
  maxWords: number;
  overlapWords: number;
}

export interface DocumentChunkDraft {
  ordinal: number;
  text: string;
  wordCount: number;
  pageNumber?: number;
  sectionHeading?: string;
}

function normalizeInline(value: string): string {
  return value.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function normalizeText(value: string): string {
  const lines = value
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/gu, " ").trim());

  const normalizedLines: string[] = [];
  for (const line of lines) {
    if (line || normalizedLines.at(-1) !== "") normalizedLines.push(line);
  }

  return normalizedLines.join("\n").trim();
}

export function normalizeSections(
  sections: readonly ExtractedSection[],
): NormalizedSection[] {
  return sections.flatMap((section) => {
    const text = normalizeText(section.text);
    if (!text) return [];

    const normalized: NormalizedSection = { text };
    if (section.pageNumber !== undefined) {
      normalized.pageNumber = section.pageNumber;
    }
    if (section.sectionHeading !== undefined) {
      const heading = normalizeInline(section.sectionHeading);
      if (heading) normalized.sectionHeading = heading;
    }
    return [normalized];
  });
}

function validateOptions(options: ChunkOptions): void {
  if (
    !Number.isInteger(options.maxWords) ||
    options.maxWords <= 0 ||
    !Number.isInteger(options.overlapWords) ||
    options.overlapWords < 0 ||
    options.overlapWords >= options.maxWords
  ) {
    throw new RangeError(
      "Chunk sizes must be integers with 0 <= overlapWords < maxWords",
    );
  }
}

export function chunkSections(
  sections: readonly ExtractedSection[],
  options: ChunkOptions,
): DocumentChunkDraft[] {
  validateOptions(options);

  const chunks: DocumentChunkDraft[] = [];
  const step = options.maxWords - options.overlapWords;

  for (const section of normalizeSections(sections)) {
    const words = section.text.split(/\s+/u);
    for (let start = 0; start < words.length; start += step) {
      const window = words.slice(start, start + options.maxWords);
      const chunk: DocumentChunkDraft = {
        ordinal: chunks.length,
        text: window.join(" "),
        wordCount: window.length,
      };
      if (section.pageNumber !== undefined) {
        chunk.pageNumber = section.pageNumber;
      }
      if (section.sectionHeading !== undefined) {
        chunk.sectionHeading = section.sectionHeading;
      }
      chunks.push(chunk);

      if (start + options.maxWords >= words.length) break;
    }
  }

  return chunks;
}
