interface MockKnowledgeFixture {
  documentId: string;
  documentName: string;
  workspaceId: string;
  collectionId: string;
  summary: string;
  keywords: readonly string[];
}

export interface MockKnowledgeScope {
  workspaceId: string;
  collectionId: string | null;
  documentId: string | null;
}

export interface MockKnowledgeMatch {
  documentId: string;
  documentName: string;
  excerpt: string;
  sourceLabel: string;
}

export interface MockKnowledgeResult {
  answer: string;
  matches: MockKnowledgeMatch[];
}

const fixtures: readonly MockKnowledgeFixture[] = [
  {
    documentId: "europe-ai-market",
    documentName: "European AI market outlook.pdf",
    workspaceId: "product-research",
    collectionId: "market-intelligence",
    summary:
      "European AI adoption is accelerating as regulated industries invest in governed automation and measurable operational outcomes.",
    keywords: ["european", "ai", "market", "adoption", "regulation", "automation"],
  },
  {
    documentId: "competitor-notes",
    documentName: "Competitor notes.md",
    workspaceId: "product-research",
    collectionId: "market-intelligence",
    summary:
      "The fixture competitor matrix compares positioning, onboarding speed, enterprise controls, and pricing signals.",
    keywords: ["competitor", "positioning", "matrix", "pricing", "enterprise"],
  },
  {
    documentId: "interview-synthesis",
    documentName: "Interview synthesis.docx",
    workspaceId: "product-research",
    collectionId: "customer-insights",
    summary:
      "Customer interviews emphasize trustworthy answers, visible sources, and simple document organization.",
    keywords: ["customer", "interview", "trust", "sources", "organization"],
  },
  {
    documentId: "survey-export",
    documentName: "Survey export.txt",
    workspaceId: "product-research",
    collectionId: "customer-insights",
    summary:
      "Survey fixtures highlight demand for fast search, clear ingestion progress, and recoverable failures.",
    keywords: ["survey", "search", "ingestion", "progress", "failure"],
  },
  {
    documentId: "kickoff-guide",
    documentName: "Client kickoff guide.pdf",
    workspaceId: "client-delivery",
    collectionId: "onboarding",
    summary:
      "The kickoff fixture covers ownership, delivery milestones, communication cadence, and success criteria.",
    keywords: ["client", "kickoff", "delivery", "milestone", "communication"],
  },
  {
    documentId: "delivery-checklist",
    documentName: "Delivery checklist.md",
    workspaceId: "client-delivery",
    collectionId: "onboarding",
    summary:
      "The delivery checklist fixture tracks approvals, handover evidence, open risks, and follow-up actions.",
    keywords: ["delivery", "checklist", "approval", "handover", "risk"],
  },
];

function queryTerms(query: string) {
  return query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 1) ?? [];
}

export function runMockKnowledgeQuery(
  query: string,
  scope: MockKnowledgeScope,
): MockKnowledgeResult {
  const terms = queryTerms(query);
  const ranked = fixtures
    .filter(
      (fixture) =>
        fixture.workspaceId === scope.workspaceId &&
        (!scope.collectionId || fixture.collectionId === scope.collectionId) &&
        (!scope.documentId || fixture.documentId === scope.documentId),
    )
    .map((fixture) => {
      const searchable = [
        fixture.documentName,
        fixture.summary,
        ...fixture.keywords,
      ].join(" ").toLowerCase();
      const score = terms.filter((term) => searchable.includes(term)).length;
      return { fixture, score };
    })
    .filter((item) => item.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.fixture.documentName.localeCompare(right.fixture.documentName),
    )
    .slice(0, 3);

  const matches = ranked.map(({ fixture }, index) => ({
    documentId: fixture.documentId,
    documentName: fixture.documentName,
    excerpt: fixture.summary,
    sourceLabel: `Mock source ${index + 1} — not a citation`,
  }));

  return {
    answer:
      matches.length > 0
        ? `Local fixture summary: ${matches.map((match) => match.excerpt).join(" ")}`
        : "No mock fixture matches this query in the selected scope.",
    matches,
  };
}
