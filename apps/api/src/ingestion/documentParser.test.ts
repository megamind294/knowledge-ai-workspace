import { describe, expect, it } from "vitest";
import {
  DocumentParser,
  DocumentParserError,
  type BinaryDocumentParser,
} from "./documentParser.js";

const bytes = (value: string) => new TextEncoder().encode(value);

async function expectParserError(
  operation: Promise<unknown>,
  code: DocumentParserError["code"],
) {
  await expect(operation).rejects.toMatchObject({ code });
}

describe("DocumentParser", () => {
  it("strictly decodes and normalizes plain UTF-8 text", async () => {
    await expect(
      new DocumentParser().extract({
        mediaType: "text/plain",
        bytes: bytes("  Cafe\u0301\r\n\r\n  policy\ttext  "),
      }),
    ).resolves.toEqual([{ text: "Café\n\npolicy text" }]);
  });

  it("rejects malformed UTF-8 instead of silently replacing bytes", async () => {
    await expectParserError(
      new DocumentParser().extract({
        mediaType: "text/plain",
        bytes: new Uint8Array([0xc3, 0x28]),
      }),
      "INVALID_ENCODING",
    );
  });

  it("extracts Markdown sections while ignoring headings inside fences", async () => {
    await expect(
      new DocumentParser().extract({
        mediaType: "text/markdown",
        bytes: bytes(
          "Preface\n\n# First section\nAlpha\n\n```md\n# code heading\n```\n\n## Second section ##\nBeta",
        ),
      }),
    ).resolves.toEqual([
      { text: "Preface" },
      {
        text: "Alpha\n\n```md\n# code heading\n```",
        sectionHeading: "First section",
      },
      { text: "Beta", sectionHeading: "Second section" },
    ]);
  });

  it("preserves a literal trailing hash in a Markdown heading", async () => {
    await expect(
      new DocumentParser().extract({
        mediaType: "text/markdown",
        bytes: bytes("# C#\nLanguage guide"),
      }),
    ).resolves.toEqual([
      { text: "Language guide", sectionHeading: "C#" },
    ]);
  });

  it("rejects documents without searchable content", async () => {
    await expectParserError(
      new DocumentParser().extract({
        mediaType: "text/markdown",
        bytes: bytes(" \n\t\n "),
      }),
      "EMPTY_DOCUMENT",
    );
  });

  it("normalizes sections returned by an injected binary adapter", async () => {
    const pdf: BinaryDocumentParser = async () => [
      { text: "  Page\t one  ", pageNumber: 1, sectionHeading: " Summary " },
      { text: "Page two", pageNumber: 2 },
    ];

    await expect(
      new DocumentParser({ pdf }).extract({
        mediaType: "application/pdf",
        bytes: new Uint8Array([1, 2, 3]),
      }),
    ).resolves.toEqual([
      { text: "Page one", pageNumber: 1, sectionHeading: "Summary" },
      { text: "Page two", pageNumber: 2 },
    ]);
  });

  it("converts binary parser failures into content-free errors", async () => {
    const docx: BinaryDocumentParser = async () => {
      throw new Error("private document text and provider details");
    };

    const operation = new DocumentParser({ docx }).extract({
      mediaType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: new Uint8Array([1, 2, 3]),
    });

    await expectParserError(operation, "PARSER_FAILED");
    await expect(operation).rejects.not.toThrow(/private document|provider/i);
  });

  it("reports unavailable binary formats without pretending to parse them", async () => {
    await expectParserError(
      new DocumentParser().extract({
        mediaType: "application/pdf",
        bytes: new Uint8Array([1, 2, 3]),
      }),
      "PARSER_UNAVAILABLE",
    );
  });

  it("rejects unsupported media types", async () => {
    await expectParserError(
      new DocumentParser().extract({
        mediaType: "text/html",
        bytes: bytes("<p>content</p>"),
      }),
      "UNSUPPORTED_MEDIA_TYPE",
    );
  });

  it("rejects content above the configured byte limit before parsing", async () => {
    await expectParserError(
      new DocumentParser({}, 4).extract({
        mediaType: "text/plain",
        bytes: bytes("12345"),
      }),
      "DOCUMENT_TOO_LARGE",
    );
  });
});
