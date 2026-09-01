import {
  normalizeSections,
  type ExtractedSection,
  type NormalizedSection,
} from "./chunking.js";
import { parseMarkdown } from "./parsers/markdownParser.js";
import {
  InvalidDocumentEncodingError,
  parsePlainText,
} from "./parsers/plainTextParser.js";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocumentParserErrorCode =
  | "DOCUMENT_TOO_LARGE"
  | "EMPTY_DOCUMENT"
  | "INVALID_ENCODING"
  | "PARSER_FAILED"
  | "PARSER_UNAVAILABLE"
  | "UNSUPPORTED_MEDIA_TYPE";

export class DocumentParserError extends Error {
  constructor(
    public readonly code: DocumentParserErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type BinaryDocumentParser = (
  bytes: Uint8Array,
) => Promise<ExtractedSection[]>;

export interface BinaryDocumentParsers {
  pdf?: BinaryDocumentParser;
  docx?: BinaryDocumentParser;
}

export interface ParseDocumentInput {
  mediaType: string;
  bytes: Uint8Array;
}

export class DocumentParser {
  constructor(
    private readonly binaryParsers: BinaryDocumentParsers = {},
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
      throw new RangeError("maxBytes must be a positive integer");
    }
  }

  async extract(input: ParseDocumentInput): Promise<NormalizedSection[]> {
    if (input.bytes.byteLength > this.maxBytes) {
      throw new DocumentParserError(
        "DOCUMENT_TOO_LARGE",
        "Document exceeds the configured size limit",
      );
    }

    let extracted: ExtractedSection[];
    try {
      extracted = await this.extractByMediaType(input);
    } catch (error) {
      if (error instanceof DocumentParserError) throw error;
      if (error instanceof InvalidDocumentEncodingError) {
        throw new DocumentParserError(
          "INVALID_ENCODING",
          "Text document is not valid UTF-8",
        );
      }
      throw new DocumentParserError(
        "PARSER_FAILED",
        "Document content could not be parsed",
      );
    }

    const normalized = normalizeSections(extracted);
    if (normalized.length === 0) {
      throw new DocumentParserError(
        "EMPTY_DOCUMENT",
        "Document does not contain searchable text",
      );
    }
    return normalized;
  }

  private async extractByMediaType(
    input: ParseDocumentInput,
  ): Promise<ExtractedSection[]> {
    if (input.mediaType === "text/plain") {
      return parsePlainText(input.bytes);
    }
    if (input.mediaType === "text/markdown") {
      return parseMarkdown(input.bytes);
    }
    if (input.mediaType === "application/pdf") {
      return this.extractBinary(this.binaryParsers.pdf, input.bytes, "PDF");
    }
    if (input.mediaType === DOCX_MEDIA_TYPE) {
      return this.extractBinary(this.binaryParsers.docx, input.bytes, "DOCX");
    }
    throw new DocumentParserError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Document media type is not supported",
    );
  }

  private async extractBinary(
    parser: BinaryDocumentParser | undefined,
    bytes: Uint8Array,
    format: "PDF" | "DOCX",
  ): Promise<ExtractedSection[]> {
    if (!parser) {
      throw new DocumentParserError(
        "PARSER_UNAVAILABLE",
        `${format} parsing is not configured`,
      );
    }
    return parser(bytes);
  }
}
