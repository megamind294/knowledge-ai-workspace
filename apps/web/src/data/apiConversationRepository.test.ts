import type {
  Conversation,
  ConversationHistoryResponse,
} from "@knowledge-ai/contracts";
import { ApiClientError } from "../api/apiClient";
import { createApiConversationRepository } from "./apiConversationRepository";

const workspaceId = "00000000-0000-4000-8000-000000000010";
const conversationId = "00000000-0000-4000-8000-000000000020";
const conversation: Conversation = {
  id: conversationId,
  workspaceId,
  createdByUserId: "00000000-0000-4000-8000-000000000001",
  scope: { type: "workspace" },
  title: "Policy",
  createdAt: "2026-09-09T00:00:00.000Z",
  updatedAt: "2026-09-09T00:00:00.000Z",
};

describe("API conversation repository", () => {
  it("uses authenticated conversation lifecycle endpoints", async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/messages") && init?.method === "POST") {
        return { status: "insufficient_context", turn: {} };
      }
      if (path.includes("/messages")) return { messages: [], nextPosition: null };
      if (path.endsWith(`/${conversationId}`)) return { conversation };
      if (init?.method === "POST") return { conversation };
      return { conversations: [conversation] };
    });
    const repository = createApiConversationRepository({ request } as never);

    await expect(repository.list(workspaceId)).resolves.toEqual([conversation]);
    await expect(
      repository.create(workspaceId, { scope: { type: "workspace" }, title: "Policy" }),
    ).resolves.toEqual(conversation);
    await expect(repository.get(workspaceId, conversationId)).resolves.toEqual(conversation);
    await expect(repository.history(workspaceId, conversationId)).resolves.toEqual({
      messages: [],
      nextPosition: null,
    } satisfies ConversationHistoryResponse);
    await repository.history(workspaceId, conversationId, 42);
    await repository.send(workspaceId, conversationId, {
      submissionId: "00000000-0000-4000-8000-000000000030",
      question: "What is the policy?",
      topK: 5,
    });

    expect(request).toHaveBeenCalledWith(`/api/workspaces/${workspaceId}/conversations?limit=20`);
    expect(request).toHaveBeenCalledWith(`/api/workspaces/${workspaceId}/conversations`, {
      method: "POST",
      body: JSON.stringify({ scope: { type: "workspace" }, title: "Policy" }),
    });
    expect(request).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenCalledWith(
      `/api/workspaces/${workspaceId}/conversations/${conversationId}/messages?limit=100&afterPosition=42`,
    );
  });

  it("maps missing conversations to null", async () => {
    const request = vi.fn().mockRejectedValue(
      new ApiClientError(404, "NOT_FOUND", "Conversation not found"),
    );
    const repository = createApiConversationRepository({ request } as never);
    await expect(repository.get(workspaceId, conversationId)).resolves.toBeNull();
  });
});
