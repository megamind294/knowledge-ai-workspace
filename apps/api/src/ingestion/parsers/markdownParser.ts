import type { ExtractedSection } from "../chunking.js";
import { decodeStrictUtf8 } from "./plainTextParser.js";

interface Fence {
  character: "`" | "~";
  length: number;
}

function fenceAt(line: string): Fence | null {
  const match = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);
  if (!match?.[1]) return null;
  return {
    character: match[1][0] as Fence["character"],
    length: match[1].length,
  };
}

function closesFence(line: string, fence: Fence): boolean {
  const trimmed = line.trimStart();
  const marker = trimmed.match(/^(`+|~+)/u)?.[1];
  return (
    marker !== undefined &&
    marker[0] === fence.character &&
    marker.length >= fence.length
  );
}

export function parseMarkdown(bytes: Uint8Array): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  let heading: string | undefined;
  let lines: string[] = [];
  let fence: Fence | null = null;

  const flush = () => {
    const body = lines.join("\n").trim();
    const text = body || heading || "";
    if (text) {
      sections.push(heading ? { text, sectionHeading: heading } : { text });
    }
    lines = [];
  };

  for (const line of decodeStrictUtf8(bytes).split(/\r\n?|\n/u)) {
    if (fence) {
      lines.push(line);
      if (closesFence(line, fence)) fence = null;
      continue;
    }

    const openingFence = fenceAt(line);
    if (openingFence) {
      fence = openingFence;
      lines.push(line);
      continue;
    }

    const headingMatch = /^\s{0,3}#{1,6}\s+(.+?)\s*$/u.exec(line);
    if (headingMatch?.[1]) {
      flush();
      heading = headingMatch[1].replace(/\s+#+\s*$/u, "").trim();
      continue;
    }

    lines.push(line);
  }

  flush();
  return sections;
}
