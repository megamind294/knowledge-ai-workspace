import type {
  Conversation,
  ConversationHistoryResponse,
  ConversationListResponse,
  ConversationResponse,
  CreateConversationRequest,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
} from "@knowledge-ai/contracts";
import { ApiClientError, type ApiClient } from "../api/apiClient";

export function createApiConversationRepository(client: Pick<ApiClient, "request">) {
  return {
    async list(workspaceId: string): Promise<Conversation[]> {
      return (
        await client.request<ConversationListResponse>(
          `/api/workspaces/${workspaceId}/conversations?limit=20`,
        )
      ).conversations;
    },
    async create(
      workspaceId: string,
      request: CreateConversationRequest,
    ): Promise<Conversation> {
      return (
        await client.request<ConversationResponse>(
          `/api/workspaces/${workspaceId}/conversations`,
          { method: "POST", body: JSON.stringify(request) },
        )
      ).conversation;
    },
    async get(workspaceId: string, conversationId: string) {
      try {
        return (
          await client.request<ConversationResponse>(
            `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
          )
        ).conversation;
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "NOT_FOUND") return null;
        throw error;
      }
    },
    async history(
      workspaceId: string,
      conversationId: string,
      afterPosition?: number,
    ): Promise<ConversationHistoryResponse> {
      const pagination = afterPosition === undefined ? "" : `&afterPosition=${afterPosition}`;
      return client.request(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}/messages?limit=100${pagination}`,
      );
    },
    async send(
      workspaceId: string,
      conversationId: string,
      request: SendConversationMessageRequest,
    ): Promise<SendConversationMessageResponse> {
      return client.request(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
        { method: "POST", body: JSON.stringify(request) },
      );
    },
  };
}
