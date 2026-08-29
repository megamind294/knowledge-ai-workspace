import type {
  CollectionSummary,
  RecentDocument,
  WorkspaceSummary,
} from "../domain/knowledge";

export const workspaceFixtures = [
  {
    id: "product-research",
    name: "Product research",
    description:
      "Market reports, customer interviews, and competitive intelligence.",
    role: "owner",
    collectionCount: 2,
    documentCount: 4,
    updatedAt: "2026-08-27T09:30:00.000Z",
  },
  {
    id: "client-delivery",
    name: "Client delivery",
    description:
      "Onboarding guides and delivery playbooks for active engagements.",
    role: "admin",
    collectionCount: 1,
    documentCount: 2,
    updatedAt: "2026-08-26T15:20:00.000Z",
  },
] satisfies ReadonlyArray<WorkspaceSummary>;

export const collectionFixtures = [
  {
    id: "market-intelligence",
    workspaceId: "product-research",
    name: "Market intelligence",
    description: "Industry research and competitor analysis.",
    documentCount: 2,
    indexedDocumentCount: 2,
    updatedAt: "2026-08-27T09:30:00.000Z",
  },
  {
    id: "customer-insights",
    workspaceId: "product-research",
    name: "Customer insights",
    description: "Interview notes, surveys, and product feedback.",
    documentCount: 2,
    indexedDocumentCount: 1,
    updatedAt: "2026-08-27T08:10:00.000Z",
  },
  {
    id: "onboarding",
    workspaceId: "client-delivery",
    name: "Onboarding",
    description: "Reusable kickoff and delivery documentation.",
    documentCount: 2,
    indexedDocumentCount: 1,
    updatedAt: "2026-08-26T15:20:00.000Z",
  },
] satisfies ReadonlyArray<CollectionSummary>;

export const documentFixtures = [
  {
    id: "europe-ai-market",
    workspaceId: "product-research",
    collectionId: "market-intelligence",
    name: "European AI market outlook.pdf",
    mediaType: "pdf",
    status: "indexed",
    sizeBytes: 2_480_128,
    updatedAt: "2026-08-27T09:30:00.000Z",
  },
  {
    id: "competitor-notes",
    workspaceId: "product-research",
    collectionId: "market-intelligence",
    name: "Competitor notes.md",
    mediaType: "markdown",
    status: "indexed",
    sizeBytes: 48_312,
    updatedAt: "2026-08-27T09:05:00.000Z",
  },
  {
    id: "interview-synthesis",
    workspaceId: "product-research",
    collectionId: "customer-insights",
    name: "Interview synthesis.docx",
    mediaType: "docx",
    status: "indexed",
    sizeBytes: 318_450,
    updatedAt: "2026-08-27T08:10:00.000Z",
  },
  {
    id: "survey-export",
    workspaceId: "product-research",
    collectionId: "customer-insights",
    name: "Survey export.txt",
    mediaType: "text",
    status: "processing",
    sizeBytes: 92_804,
    updatedAt: "2026-08-27T08:02:00.000Z",
  },
  {
    id: "kickoff-guide",
    workspaceId: "client-delivery",
    collectionId: "onboarding",
    name: "Client kickoff guide.pdf",
    mediaType: "pdf",
    status: "indexed",
    sizeBytes: 1_204_991,
    updatedAt: "2026-08-26T15:20:00.000Z",
  },
  {
    id: "delivery-checklist",
    workspaceId: "client-delivery",
    collectionId: "onboarding",
    name: "Delivery checklist.md",
    mediaType: "markdown",
    status: "uploaded",
    sizeBytes: 21_620,
    updatedAt: "2026-08-26T14:45:00.000Z",
  },
] satisfies ReadonlyArray<RecentDocument>;
