import { describe, expect, it } from "vitest";
import { chunkSections, normalizeSections } from "./chunking.js";

describe("document text normalization", () => {
  it("normalizes Unicode, line endings, horizontal whitespace, and repeated blank lines", () => {
    expect(
      normalizeSections([
        {
          text: "  Cafe\u0301  \r\n line\t one\r\n\r\n\r\n second  ",
          pageNumber: 2,
          sectionHeading: "  Getting   started ",
        },
      ]),
    ).toEqual([
      {
        text: "Café\nline one\n\nsecond",
        pageNumber: 2,
        sectionHeading: "Getting started",
      },
    ]);
  });

  it("drops sections that contain no searchable text", () => {
    expect(
      normalizeSections([
        { text: " \n\t\r\n ", pageNumber: 1 },
        { text: "Useful content", pageNumber: 2 },
      ]),
    ).toEqual([{ text: "Useful content", pageNumber: 2 }]);
  });
});

describe("deterministic document chunking", () => {
  it("creates stable overlapping word windows with retained source metadata", () => {
    expect(
      chunkSections(
        [
          {
            text: "one two three four five six seven eight nine",
            pageNumber: 4,
            sectionHeading: "Limits",
          },
        ],
        { maxWords: 5, overlapWords: 2 },
      ),
    ).toEqual([
      {
        ordinal: 0,
        text: "one two three four five",
        wordCount: 5,
        pageNumber: 4,
        sectionHeading: "Limits",
      },
      {
        ordinal: 1,
        text: "four five six seven eight",
        wordCount: 5,
        pageNumber: 4,
        sectionHeading: "Limits",
      },
      {
        ordinal: 2,
        text: "seven eight nine",
        wordCount: 3,
        pageNumber: 4,
        sectionHeading: "Limits",
      },
    ]);
  });

  it("does not merge source sections and assigns ordinals across them", () => {
    expect(
      chunkSections(
        [
          { text: "alpha beta gamma", sectionHeading: "Alpha" },
          { text: "delta epsilon zeta eta", pageNumber: 3 },
        ],
        { maxWords: 10, overlapWords: 2 },
      ),
    ).toEqual([
      {
        ordinal: 0,
        text: "alpha beta gamma",
        wordCount: 3,
        sectionHeading: "Alpha",
      },
      {
        ordinal: 1,
        text: "delta epsilon zeta eta",
        wordCount: 4,
        pageNumber: 3,
      },
    ]);
  });

  it.each([
    { maxWords: 0, overlapWords: 0 },
    { maxWords: 5, overlapWords: -1 },
    { maxWords: 5, overlapWords: 5 },
    { maxWords: 4.5, overlapWords: 1 },
  ])("rejects unsafe chunk options: %o", (options) => {
    expect(() => chunkSections([{ text: "content" }], options)).toThrow(
      RangeError,
    );
  });
});
