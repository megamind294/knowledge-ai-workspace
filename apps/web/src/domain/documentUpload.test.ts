import { validateDocumentUpload } from "./documentUpload";

const baseInput = {
  name: "Research brief.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2_048,
  workspaceId: "product-research",
  collectionId: "market-intelligence",
};

describe("validateDocumentUpload", () => {
  it.each([
    ["report.pdf", "application/pdf", "pdf"],
    ["notes.txt", "text/plain", "text"],
    ["readme.md", "text/markdown", "markdown"],
    ["readme.md", "text/plain", "markdown"],
    [
      "brief.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "docx",
    ],
  ] as const)(
    "accepts supported metadata for %s",
    (name, mimeType, expectedMediaType) => {
      const result = validateDocumentUpload({
        ...baseInput,
        name,
        mimeType,
      });

      expect(result).toEqual({
        ok: true,
        candidate: {
          name,
          mediaType: expectedMediaType,
          mimeType,
          sizeBytes: 2_048,
          workspaceId: "product-research",
          collectionId: "market-intelligence",
        },
      });
    },
  );

  it("rejects a supported extension with the wrong media type", () => {
    expect(
      validateDocumentUpload({
        ...baseInput,
        mimeType: "application/x-msdownload",
      }),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "media-type-mismatch",
          message: "The selected file type does not match its extension.",
        },
      ],
    });
  });

  it("rejects unsupported file extensions", () => {
    expect(
      validateDocumentUpload({
        ...baseInput,
        name: "archive.zip",
        mimeType: "application/zip",
      }),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "unsupported-format",
          message: "Choose a PDF, TXT, Markdown, or DOCX file.",
        },
      ],
    });
  });

  it.each([
    [0, "empty-file", "The selected file is empty."],
    [
      10 * 1024 * 1024 + 1,
      "file-too-large",
      "Choose a file no larger than 10 MiB.",
    ],
  ] as const)("rejects invalid file size %i", (sizeBytes, code, message) => {
    expect(
      validateDocumentUpload({ ...baseInput, sizeBytes }),
    ).toEqual({ ok: false, errors: [{ code, message }] });
  });

  it("requires a workspace target", () => {
    expect(
      validateDocumentUpload({ ...baseInput, workspaceId: "  " }),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "workspace-required",
          message: "Choose a workspace for this document.",
        },
      ],
    });
  });
});
