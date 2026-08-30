import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import { createFixtureKnowledgeRepository } from "../../data/knowledgeRepository";
import { renderAppRoutes } from "../../test/renderAppRoutes";

function renderKnowledgePreview() {
  window.localStorage.setItem(SESSION_KEY, "active");
  return renderAppRoutes(
    ["/app/knowledge"],
    createFixtureKnowledgeRepository(),
  );
}

async function selectWorkspace(
  user: ReturnType<typeof userEvent.setup>,
  workspaceId = "product-research",
) {
  const optionName =
    workspaceId === "product-research" ? "Product research" : "Client delivery";
  await screen.findByRole("option", { name: optionName });
  await user.selectOptions(
    screen.getByRole("combobox", { name: /^workspace$/i }),
    workspaceId,
  );
}

describe("honest mock knowledge preview", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders a direct protected route with an unmistakable no-AI notice", async () => {
    renderKnowledgePreview();

    expect(
      await screen.findByRole("heading", { name: /mock knowledge preview/i }),
    ).toBeVisible();
    expect(
      screen.getByText(/no ai, embedding, retrieval, or network call is made/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /knowledge preview/i }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("cascades workspace, collection, and document scope choices", async () => {
    const user = userEvent.setup();
    renderKnowledgePreview();
    await selectWorkspace(user);

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^collection$/i }),
      "market-intelligence",
    );

    const document = await screen.findByRole("combobox", {
      name: /^document$/i,
    });
    expect(
      screen.getByRole("option", { name: "European AI market outlook.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Competitor notes.md" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Survey export.txt" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(document, "europe-ai-market");
    expect(document).toHaveValue("europe-ai-market");
  });

  it("prevents an empty mock query", async () => {
    const user = userEvent.setup();
    renderKnowledgePreview();
    await selectWorkspace(user);

    await user.click(screen.getByRole("button", { name: /run mock search/i }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/enter a question or search phrase/i);
    expect(
      screen.queryByRole("heading", { name: /mock answer preview/i }),
    ).not.toBeInTheDocument();
  });

  it("renders deterministic fixture matches, a mock answer, and non-citation source labels", async () => {
    const user = userEvent.setup();
    renderKnowledgePreview();
    await selectWorkspace(user);
    await user.type(
      screen.getByRole("textbox", { name: /question or search phrase/i }),
      "European AI market adoption",
    );

    await user.click(screen.getByRole("button", { name: /run mock search/i }));

    expect(
      await screen.findByRole("heading", { name: /mock answer preview/i }),
    ).toBeVisible();
    const answer = screen.getByRole("region", { name: /mock answer preview/i });
    expect(within(answer).getByText(/local fixture summary/i)).toBeVisible();
    expect(
      within(answer).getByText("European AI market outlook.pdf"),
    ).toBeVisible();
    expect(
      within(answer).getByText(/mock source 1 — not a citation/i),
    ).toBeVisible();
    expect(
      within(answer).getByText(
        /deterministic fixture response — not ai-generated/i,
      ),
    ).toBeVisible();
  });

  it("respects document scope and reports when that fixture has no match", async () => {
    const user = userEvent.setup();
    renderKnowledgePreview();
    await selectWorkspace(user);
    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^collection$/i }),
      "market-intelligence",
    );
    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^document$/i }),
      "europe-ai-market",
    );
    await user.type(
      screen.getByRole("textbox", { name: /question or search phrase/i }),
      "competitor positioning matrix",
    );

    await user.click(screen.getByRole("button", { name: /run mock search/i }));

    expect(
      await screen.findByText(
        /no mock fixture matches this query in the selected scope/i,
      ),
    ).toBeVisible();
    const answer = screen.getByRole("region", { name: /mock answer preview/i });
    expect(
      within(answer).queryByText("Competitor notes.md"),
    ).not.toBeInTheDocument();
  });
});
