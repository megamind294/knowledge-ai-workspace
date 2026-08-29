import type {
  DocumentMediaType,
  DocumentUploadError,
  DocumentUploadInput,
  DocumentUploadValidation,
} from "./knowledge";

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const formats: Record<
  string,
  { mediaType: DocumentMediaType; mimeTypes: readonly string[] }
> = {
  pdf: { mediaType: "pdf", mimeTypes: ["application/pdf"] },
  txt: { mediaType: "text", mimeTypes: ["text/plain"] },
  md: {
    mediaType: "markdown",
    mimeTypes: ["text/markdown", "text/plain"],
  },
  docx: {
    mediaType: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
};

function getExtension(name: string) {
  const separator = name.lastIndexOf(".");
  return separator >= 0 ? name.slice(separator + 1).toLowerCase() : "";
}

export function validateDocumentUpload(
  input: DocumentUploadInput,
): DocumentUploadValidation {
  const errors: DocumentUploadError[] = [];
  const format = formats[getExtension(input.name)];

  if (!format) {
    errors.push({
      code: "unsupported-format",
      message: "Choose a PDF, TXT, Markdown, or DOCX file.",
    });
  } else if (!format.mimeTypes.includes(input.mimeType.toLowerCase())) {
    errors.push({
      code: "media-type-mismatch",
      message: "The selected file type does not match its extension.",
    });
  }

  if (input.sizeBytes <= 0) {
    errors.push({ code: "empty-file", message: "The selected file is empty." });
  } else if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    errors.push({
      code: "file-too-large",
      message: "Choose a file no larger than 10 MiB.",
    });
  }

  if (!input.workspaceId.trim()) {
    errors.push({
      code: "workspace-required",
      message: "Choose a workspace for this document.",
    });
  }

  if (errors.length > 0 || !format) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    candidate: {
      name: input.name.trim(),
      mediaType: format.mediaType,
      mimeType: input.mimeType.toLowerCase(),
      sizeBytes: input.sizeBytes,
      workspaceId: input.workspaceId.trim(),
      collectionId: input.collectionId?.trim() || null,
    },
  };
}
