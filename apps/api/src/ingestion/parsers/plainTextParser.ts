import type { ExtractedSection } from "../chunking.js";

export class InvalidDocumentEncodingError extends Error {
  constructor() {
    super("Document bytes are not valid UTF-8 text");
  }
}

export function decodeStrictUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/u, "");
  } catch {
    throw new InvalidDocumentEncodingError();
  }
}

export function parsePlainText(bytes: Uint8Array): ExtractedSection[] {
  return [{ text: decodeStrictUtf8(bytes) }];
}
