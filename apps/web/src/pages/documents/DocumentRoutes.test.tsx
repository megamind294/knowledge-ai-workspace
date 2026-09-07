import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import type { KnowledgeRepository } from "../../data/knowledgeRepository";
import { createFixtureKnowledgeRepository } from "../../data/knowledgeRepository";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function renderAuthenticatedRoute(
  initialEntry: string,
  repository: KnowledgeRepository = createFixtureKnowledgeRepository(),
) {
  window.localStorage.setItem(SESSION_KEY, "active");
  return renderAppRoutes([initialEntry], repository);
}

describe("document library and detail routes", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders a direct document-library URL with detail links", async () => {
    renderAuthenticatedRoute("/app/documents");

    expect(
      await screen.findByRole("heading", { name: "Document library" }),
    ).toBeVisible();
    expect(
      await screen.findByText("European AI market outlook.pdf"),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /open european ai market outlook/i }),
    ).toHaveAttribute("href", "/app/documents/europe-ai-market");
    expect(screen.getByRole("link", { name: "Documents" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("filters the library by ingestion status", async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoute("/app/documents");

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /ingestion status/i }),
      "failed",
    );

    expect(screen.getByText("Delivery checklist.md")).toBeVisible();
    expect(
      screen.queryByText("European AI market outlook.pdf"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1 document shown/i)).toBeVisible();
  });

  it("shows explicit loading, empty, and failure states", async () => {
    const pendingRepository = {
      ...createFixtureKnowledgeRepository(),
      getWorkspaces: () => new Promise<never>(() => undefined),
    } satisfies KnowledgeRepository;
    const pending = renderAuthenticatedRoute(
      "/app/documents",
      pendingRepository,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading document library/i,
    );
    pending.unmount();

    const emptyRepository = {
      ...createFixtureKnowledgeRepository(),
      async getWorkspaces() {
        return [];
      },
    } satisfies KnowledgeRepository;
    const empty = renderAuthenticatedRoute("/app/documents", emptyRepository);
    expect(
      await screen.findByRole("heading", { name: /no documents yet/i }),
    ).toBeVisible();
    empty.unmount();

    const failedRepository = {
      ...createFixtureKnowledgeRepository(),
      async getWorkspaces() {
        throw new Error("Repository unavailable");
      },
    } satisfies KnowledgeRepository;
    renderAuthenticatedRoute("/app/documents", failedRepository);
    expect(
      await screen.findByRole("heading", { name: /document library unavailable/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /retry document library/i }),
    ).toBeVisible();
  });

  it("renders direct document details and retries a failed local simulation", async () => {
    const user = userEvent.setup();
    renderAuthenticatedRoute("/app/documents/delivery-checklist");

    expect(
      await screen.findByRole("heading", { name: "Delivery checklist.md" }),
    ).toBeVisible();
    expect(screen.getByText("Failed", { selector: "span" })).toBeVisible();
    expect(
      screen.getByText(/text extraction could not be completed/i),
    ).toBeVisible();
    expect(screen.getByText(/local ingestion simulation/i)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /retry simulated ingestion/i }),
    );

    expect(
      await screen.findByText("Processing", { selector: "span" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /retry simulated ingestion/i }),
    ).not.toBeInTheDocument();
  });

  it("uses real indexing for API-mode retry and refreshes the durable result", async () => {
    const user = userEvent.setup();
    const baseRepository = createFixtureKnowledgeRepository();
    const retryDocument = vi.fn(async (id: string) => {
      const document = await baseRepository.getDocument(id);
      return document ? { ...document, status: "indexed" as const, failureReason: null } : null;
    });
    const repository = {
      ...baseRepository,
      mode: "api",
      retryDocument,
    } as unknown as KnowledgeRepository;
    renderAuthenticatedRoute("/app/documents/delivery-checklist", repository);

    expect(await screen.findByText("Failed", { selector: "span" })).toBeVisible();
    expect(screen.getByText(/durable ingestion state/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^retry ingestion$/i }));

    expect(retryDocument).toHaveBeenCalledWith("delivery-checklist");
    expect(await screen.findByText("Indexed", { selector: "span" })).toBeVisible();
    expect(screen.queryByText(/local ingestion simulation/i)).not.toBeInTheDocument();
  });

  it("renders a recoverable state for an unknown document", async () => {
    renderAuthenticatedRoute("/app/documents/missing-document");

    expect(
      await screen.findByRole("heading", { name: /document not found/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /back to document library/i }),
    ).toHaveAttribute("href", "/app/documents");
  });
});
