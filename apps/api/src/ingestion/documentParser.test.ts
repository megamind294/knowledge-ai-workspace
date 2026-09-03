import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DocumentParser,
  DocumentParserError,
  type BinaryDocumentParser,
} from "./documentParser.js";

const bytes = (value: string) => new TextEncoder().encode(value);
const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url));

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

  it("extracts and normalizes PDF text as page-aware sections", async () => {
    await expect(
      new DocumentParser().extract({
        mediaType: "application/pdf",
        bytes: await fixture("binary-document.pdf"),
      }),
    ).resolves.toEqual([
      {
        text: "Quarterly Review\nCafé policy overview",
        pageNumber: 1,
      },
      { text: "Next Steps\nShip the follow-up.", pageNumber: 2 },
    ]);
  });

  it("extracts and normalizes DOCX sections under their document headings", async () => {
    await expect(
      new DocumentParser().extract({
        mediaType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: await fixture("binary-document.docx"),
      }),
    ).resolves.toEqual([
      { text: "Café policy overview", sectionHeading: "Quarterly Review" },
      { text: "Ship the follow-up.", sectionHeading: "Next Steps" },
    ]);
  });

  it.each([
    ["PDF", "application/pdf"],
    [
      "DOCX",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  ])("turns malformed %s bytes into a content-free parser failure", async (_, mediaType) => {
    const operation = new DocumentParser().extract({
      mediaType,
      bytes: bytes("private source text in malformed bytes"),
    });

    await expectParserError(operation, "PARSER_FAILED");
    await expect(operation).rejects.not.toThrow(/private source|pdfjs|mammoth/i);
  });

  it.each([
    ["PDF", "application/pdf", "empty-document.pdf"],
    [
      "DOCX",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "empty-document.docx",
    ],
  ])("rejects a valid empty %s document", async (_, mediaType, filename) => {
    await expectParserError(
      new DocumentParser().extract({
        mediaType,
        bytes: await fixture(filename),
      }),
      "EMPTY_DOCUMENT",
    );
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
