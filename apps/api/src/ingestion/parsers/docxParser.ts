import { DomUtils, parseDocument } from "htmlparser2";
import mammoth from "mammoth";
import type { ExtractedSection } from "../chunking.js";

const HEADING_TAG = /^h[1-6]$/u;
const CONTENT_TAGS = new Set([
  "blockquote",
  "li",
  "p",
  "pre",
  "table",
]);

export async function parseDocx(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const result = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  const document = parseDocument(result.value);
  const sections: ExtractedSection[] = [];
  let heading: string | undefined;
  let blocks: string[] = [];

  const flush = () => {
    const text = blocks.join("\n").trim() || heading || "";
    if (text) {
      sections.push(heading ? { text, sectionHeading: heading } : { text });
    }
    blocks = [];
  };

  const visit = (nodes: typeof document.children) => {
    for (const node of nodes) {
      if (!("name" in node) || !("children" in node)) continue;

      if (HEADING_TAG.test(node.name)) {
        flush();
        heading = DomUtils.textContent(node).trim();
        continue;
      }

      if (CONTENT_TAGS.has(node.name)) {
        blocks.push(DomUtils.innerText(node));
        continue;
      }

      visit(node.children);
    }
  };

  visit(document.children);
  flush();
  return sections;
}
