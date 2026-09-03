import {
  getDocument,
  VerbosityLevel,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractedSection } from "../chunking.js";

function pageText(items: readonly unknown[]): string {
  let text = "";

  for (const item of items) {
    if (typeof item !== "object" || item === null || !("str" in item)) continue;
    const textItem = item as { str: string; hasEOL: boolean };
    text += textItem.str;
    if (textItem.hasEOL) text += "\n";
  }

  return text;
}

export async function parsePdf(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    verbosity: VerbosityLevel.ERRORS,
  });
  let document: Awaited<typeof loadingTask.promise> | undefined;

  try {
    document = await loadingTask.promise;
    const sections: ExtractedSection[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      sections.push({ text: pageText(content.items), pageNumber });
    }

    return sections;
  } finally {
    if (document) {
      await document.destroy();
    } else {
      await loadingTask.destroy();
    }
  }
}
