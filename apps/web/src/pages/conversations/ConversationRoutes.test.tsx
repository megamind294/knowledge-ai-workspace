import type {
  Conversation,
  ConversationHistoryResponse,
  SendConversationMessageResponse,
} from "@knowledge-ai/contracts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_KEY } from "../../auth/demoSession";
import {
  createFixtureKnowledgeRepository,
  type KnowledgeRepository,
} from "../../data/knowledgeRepository";
import { renderAppRoutes } from "../../test/renderAppRoutes";

const workspaceId = "00000000-0000-4000-8000-000000000010";
const conversationId = "00000000-0000-4000-8000-000000000020";
const conversation: Conversation = {
  id: conversationId,
  workspaceId,
  createdByUserId: "00000000-0000-4000-8000-000000000001",
  scope: { type: "workspace" },
  title: "Annual leave",
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
};

function repository(overrides: Partial<KnowledgeRepository> = {}): KnowledgeRepository {
  return {
    ...createFixtureKnowledgeRepository(),
    mode: "api",
    listConversations: vi.fn().mockResolvedValue([conversation]),
    createConversation: vi.fn().mockResolvedValue(conversation),
    getConversation: vi.fn().mockResolvedValue(conversation),
    getConversationHistory: vi.fn().mockResolvedValue({ messages: [], nextPosition: null }),
    sendConversationMessage: vi.fn(),
    ...overrides,
  } as KnowledgeRepository;
}

describe("conversation routes", () => {
  beforeEach(() => window.localStorage.setItem(SESSION_KEY, "active"));
  afterEach(() => window.localStorage.clear());

  it("creates a workspace-scoped conversation and opens it", async () => {
    const user = userEvent.setup();
    const createConversation = vi.fn().mockResolvedValue(conversation);
    renderAppRoutes(["/app/conversations"], repository({ createConversation }));

    await screen.findByRole("option", { name: "Product research" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^workspace$/i }),
      "product-research",
    );
    await user.type(screen.getByRole("textbox", { name: /conversation title/i }), "Annual leave");
    await user.click(screen.getByRole("button", { name: /create conversation/i }));

    expect(createConversation).toHaveBeenCalledWith("product-research", {
      title: "Annual leave",
      scope: { type: "workspace" },
    });
    expect(await screen.findByRole("heading", { name: "Annual leave" })).toBeVisible();
  });

  it("sends a question and renders an exact accessible source citation", async () => {
    const response = {
      status: "answered",
      turn: {
        userMessage: {
          id: "00000000-0000-4000-8000-000000000031",
          conversationId,
          submissionId: "00000000-0000-4000-8000-000000000030",
          role: "user",
          position: 1,
          content: "How much leave?",
          model: null,
          createdAt: "2026-09-09T00:01:00.000Z",
          sources: [],
        },
        assistantMessage: {
          id: "00000000-0000-4000-8000-000000000032",
          conversationId,
          submissionId: "00000000-0000-4000-8000-000000000030",
          role: "assistant",
          position: 2,
          content: "Employees receive twenty days.",
          model: "test-generation",
          createdAt: "2026-09-09T00:01:01.000Z",
          sources: [{
            chunkId: "00000000-0000-4000-8000-000000000040",
            documentId: "competitor-notes",
            collectionId: null,
            citationOrdinal: 0,
            originalFilename: "policy.md",
            ordinal: 2,
            content: "Employees receive twenty days of annual leave.",
            wordCount: 7,
            pageNumber: null,
            sectionHeading: "Annual leave",
            score: 0.91,
          }],
        },
      },
    } satisfies SendConversationMessageResponse;
    const sendConversationMessage = vi.fn().mockResolvedValue(response);
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ sendConversationMessage }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: /ask a question/i }), "How much leave?");
    await user.click(screen.getByRole("button", { name: /send question/i }));

    expect(await screen.findByText("Employees receive twenty days.")).toBeVisible();
    const sources = screen.getByRole("region", { name: /sources for answer/i });
    expect(within(sources).getByText("Annual leave")).toBeVisible();
    expect(within(sources).getByRole("link", { name: /open policy.md/i })).toHaveAttribute(
      "href",
      "/app/documents/competitor-notes",
    );
    expect(sendConversationMessage).toHaveBeenCalledWith(
      workspaceId,
      conversationId,
      expect.objectContaining({ question: "How much leave?", topK: 5 }),
    );
  });

  it("loads every available history page without duplicating messages", async () => {
    const firstMessage = {
      id: "00000000-0000-4000-8000-000000000031",
      conversationId,
      submissionId: "00000000-0000-4000-8000-000000000030",
      role: "user" as const,
      position: 1,
      content: "First question",
      model: null,
      createdAt: "2026-09-09T00:01:00.000Z",
      sources: [],
    };
    const secondMessage = {
      ...firstMessage,
      id: "00000000-0000-4000-8000-000000000032",
      role: "assistant" as const,
      position: 2,
      content: "Second answer",
      model: "test-generation",
    };
    const getConversationHistory = vi
      .fn()
      .mockResolvedValueOnce({ messages: [firstMessage], nextPosition: 1 })
      .mockResolvedValueOnce({ messages: [firstMessage, secondMessage], nextPosition: null });
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ getConversationHistory }),
    );
    const user = userEvent.setup();

    expect(await screen.findByText("First question")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /load more messages/i }));

    expect(await screen.findByText("Second answer")).toBeVisible();
    expect(screen.getAllByText("First question")).toHaveLength(1);
    expect(getConversationHistory).toHaveBeenLastCalledWith(workspaceId, conversationId, 1);
  });

  it("preserves a new draft while the previous answer is being generated", async () => {
    let resolveSend: (response: SendConversationMessageResponse) => void = () => undefined;
    const sendConversationMessage = vi.fn().mockReturnValue(
      new Promise<SendConversationMessageResponse>((resolve) => {
        resolveSend = resolve;
      }),
    );
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ sendConversationMessage }),
    );
    const user = userEvent.setup();
    const textbox = await screen.findByRole("textbox", { name: /ask a question/i });

    await user.type(textbox, "First question");
    await user.click(screen.getByRole("button", { name: /send question/i }));
    await user.type(textbox, "Next draft");
    resolveSend({
      status: "insufficient_context",
      turn: {
        userMessage: {
          id: "00000000-0000-4000-8000-000000000031",
          conversationId,
          submissionId: "00000000-0000-4000-8000-000000000030",
          role: "user",
          position: 1,
          content: "First question",
          model: null,
          createdAt: "2026-09-09T00:01:00.000Z",
          sources: [],
        },
        assistantMessage: {
          id: "00000000-0000-4000-8000-000000000032",
          conversationId,
          submissionId: "00000000-0000-4000-8000-000000000030",
          role: "assistant",
          position: 2,
          content: "I do not have enough context.",
          model: null,
          createdAt: "2026-09-09T00:01:01.000Z",
          sources: [],
        },
      },
    });

    expect(await screen.findByText("I do not have enough context.")).toBeVisible();
    expect(textbox).toHaveValue("Next draft");
  });

  it("deduplicates a submitted turn already returned by history", async () => {
    const submittedTurn = {
      userMessage: {
        id: "00000000-0000-4000-8000-000000000031",
        conversationId,
        submissionId: "00000000-0000-4000-8000-000000000030",
        role: "user" as const,
        position: 1,
        content: "What changed?",
        model: null,
        createdAt: "2026-09-09T00:01:00.000Z",
        sources: [],
      },
      assistantMessage: {
        id: "00000000-0000-4000-8000-000000000032",
        conversationId,
        submissionId: "00000000-0000-4000-8000-000000000030",
        role: "assistant" as const,
        position: 2,
        content: "The policy changed.",
        model: "test-generation",
        createdAt: "2026-09-09T00:01:01.000Z",
        sources: [],
      },
    };
    const sendConversationMessage = vi.fn().mockResolvedValue({
      status: "answered",
      turn: submittedTurn,
    } satisfies SendConversationMessageResponse);
    const getConversationHistory = vi.fn().mockResolvedValue({
      messages: [submittedTurn.userMessage, submittedTurn.assistantMessage],
      nextPosition: null,
    });
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ getConversationHistory, sendConversationMessage }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: /ask a question/i }), "What changed?");
    await user.click(screen.getByRole("button", { name: /send question/i }));

    expect(await screen.findAllByText("The policy changed.")).toHaveLength(1);
    expect(screen.getAllByText("What changed?")).toHaveLength(1);
  });

  it("shows recoverable scope-loading failures and prevents ambiguous creation", async () => {
    const getWorkspaces = vi
      .fn()
      .mockRejectedValueOnce(new Error("private workspace failure"))
      .mockResolvedValueOnce([{ id: "product-research", name: "Product research" }]);
    renderAppRoutes(["/app/conversations"], repository({ getWorkspaces }));
    const user = userEvent.setup();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/workspaces are unavailable/i);
    expect(alert).not.toHaveTextContent(/private workspace failure/i);
    expect(screen.getByRole("combobox", { name: /^workspace$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /create conversation/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /retry workspaces/i }));
    expect(await screen.findByRole("option", { name: "Product research" })).toBeVisible();
  });

  it("blocks broader-scope creation when collection or document scopes fail to load", async () => {
    const getCollections = vi.fn().mockRejectedValue(new Error("private collection failure"));
    renderAppRoutes(["/app/conversations"], repository({ getCollections }));
    const user = userEvent.setup();

    await screen.findByRole("option", { name: "Product research" });
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^workspace$/i }),
      "product-research",
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/conversation scopes are unavailable/i);
    expect(alert).not.toHaveTextContent(/private collection failure/i);
    expect(screen.getByRole("combobox", { name: /collection scope/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /create conversation/i })).toBeDisabled();
  });

  it("shows a recoverable history failure without leaking details", async () => {
    const getConversationHistory = vi
      .fn()
      .mockRejectedValueOnce(new Error("database secret"))
      .mockResolvedValue({ messages: [], nextPosition: null } satisfies ConversationHistoryResponse);
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ getConversationHistory }),
    );
    const user = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent(/history is unavailable/i);
    expect(screen.queryByText(/database secret/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry history/i }));
    expect(await screen.findByText(/no messages yet/i)).toBeVisible();
  });

  it("offers a safe retry when answer generation fails", async () => {
    const sendConversationMessage = vi.fn().mockRejectedValue(new Error("provider secret"));
    renderAppRoutes(
      [`/app/conversations/${workspaceId}/${conversationId}`],
      repository({ sendConversationMessage }),
    );
    const user = userEvent.setup();

    await user.type(await screen.findByRole("textbox", { name: /ask a question/i }), "What changed?");
    await user.click(screen.getByRole("button", { name: /send question/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be answered/i);
    expect(screen.queryByText(/provider secret/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry question/i }));
    expect(sendConversationMessage).toHaveBeenCalledTimes(2);
    expect(sendConversationMessage.mock.calls[1]?.[2].submissionId).toBe(
      sendConversationMessage.mock.calls[0]?.[2].submissionId,
    );
  });

  it("keeps fixture mode explicitly non-AI", async () => {
    renderAppRoutes(["/app/conversations"], createFixtureKnowledgeRepository());
    expect(await screen.findByRole("heading", { name: /grounded conversations require api mode/i })).toBeVisible();
    expect(screen.getByText(/no ai provider call is made/i)).toBeVisible();
  });
});
