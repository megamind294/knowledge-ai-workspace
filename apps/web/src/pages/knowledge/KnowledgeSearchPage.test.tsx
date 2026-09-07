import type { RetrievalResult } from "@knowledge-ai/contracts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import {
  createFixtureKnowledgeRepository,
  type KnowledgeRepository,
} from "../../data/knowledgeRepository";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function apiRepository(searchKnowledge: ReturnType<typeof vi.fn>) {
  return {
    ...createFixtureKnowledgeRepository(),
    mode: "api",
    searchKnowledge,
  } as unknown as KnowledgeRepository;
}

function renderSearch(repository: KnowledgeRepository) {
  window.localStorage.setItem(SESSION_KEY, "active");
  return renderAppRoutes(["/app/knowledge"], repository);
}

async function chooseScope(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("option", { name: "Product research" });
  await user.selectOptions(
    screen.getByRole("combobox", { name: /^workspace$/i }),
    "product-research",
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: /^collection$/i }),
    "market-intelligence",
  );
  await user.selectOptions(
    await screen.findByRole("combobox", { name: /^document$/i }),
    "competitor-notes",
  );
}

describe("API-backed semantic source search", () => {
  afterEach(() => window.localStorage.clear());

  it("performs authenticated document-scoped retrieval and links to its source", async () => {
    const result: RetrievalResult = {
      chunkId: "00000000-0000-4000-8000-000000000040",
      documentId: "competitor-notes",
      collectionId: "market-intelligence",
      originalFilename: "Competitor notes.md",
      ordinal: 2,
      content: "Enterprise controls and fast onboarding distinguish the leading products.",
      wordCount: 9,
      pageNumber: null,
      sectionHeading: "Positioning",
      score: 0.89,
    };
    const searchKnowledge = vi.fn().mockResolvedValue([result]);
    const user = userEvent.setup();
    renderSearch(apiRepository(searchKnowledge));

    expect(await screen.findByRole("heading", { name: /semantic source search/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /source search/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText(/retrieves matching indexed source passages/i)).toBeVisible();
    expect(screen.getByText(/does not generate an ai answer/i)).toBeVisible();
    await chooseScope(user);
    await user.type(
      screen.getByRole("textbox", { name: /search indexed sources/i }),
      "enterprise onboarding",
    );
    await user.click(screen.getByRole("button", { name: /^search sources$/i }));

    expect(searchKnowledge).toHaveBeenCalledWith("product-research", {
      query: "enterprise onboarding",
      scope: { type: "document", documentId: "competitor-notes" },
      topK: 5,
    });
    const matches = await screen.findByRole("region", {
      name: /semantic source matches/i,
    });
    expect(within(matches).getByText(result.content)).toBeVisible();
    expect(within(matches).getByText(/positioning/i)).toBeVisible();
    expect(
      within(matches).getByRole("link", { name: /open competitor notes.md/i }),
    ).toHaveAttribute("href", "/app/documents/competitor-notes");
    expect(within(matches).queryByText(/answer/i)).not.toBeInTheDocument();
  });

  it("shows a useful empty state for a successful search with no context", async () => {
    const user = userEvent.setup();
    renderSearch(apiRepository(vi.fn().mockResolvedValue([])));
    await screen.findByRole("option", { name: "Product research" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^workspace$/i }),
      "product-research",
    );
    await user.type(
      screen.getByRole("textbox", { name: /search indexed sources/i }),
      "missing policy",
    );
    await user.click(screen.getByRole("button", { name: /^search sources$/i }));

    expect(
      await screen.findByRole("heading", { name: /no matching indexed passages/i }),
    ).toBeVisible();
  });

  it("shows a recoverable failure when semantic retrieval is unavailable", async () => {
    const user = userEvent.setup();
    const searchKnowledge = vi.fn().mockRejectedValue(new Error("provider secret"));
    renderSearch(apiRepository(searchKnowledge));
    await screen.findByRole("option", { name: "Product research" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^workspace$/i }),
      "product-research",
    );
    await user.type(
      screen.getByRole("textbox", { name: /search indexed sources/i }),
      "retention",
    );
    await user.click(screen.getByRole("button", { name: /^search sources$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /source search is temporarily unavailable/i,
    );
    expect(screen.getByRole("button", { name: /try source search again/i })).toBeVisible();
    expect(screen.queryByText(/provider secret/i)).not.toBeInTheDocument();
  });
});
