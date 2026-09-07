import { randomUUID } from "node:crypto";
import type { RetrievalScope } from "@knowledge-ai/contracts";
import type { QueryResultRow } from "pg";
import type {
  DatabasePool,
  DatabaseTransactionClient,
} from "../database/pool.js";

export type ConversationRepositoryErrorCode =
  | "NOT_FOUND"
  | "INVALID_SOURCE"
  | "CONFLICT"
  | "INVALID_INPUT"
  | "STORAGE";

export class ConversationRepositoryError extends Error {
  constructor(
    readonly code: ConversationRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConversationRepositoryError";
  }
}

export interface ConversationRecord {
  id: string;
  workspaceId: string;
  createdByUserId: string | null;
  scope: RetrievalScope;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageSourceRecord {
  chunkId: string;
  documentId: string;
  collectionId: string | null;
  citationOrdinal: number;
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  submissionId: string | null;
  role: "user" | "assistant";
  position: number;
  content: string;
  model: string | null;
  createdAt: string;
  sources: MessageSourceRecord[];
}

export interface ConversationTurnRecord {
  userMessage: ConversationMessageRecord;
  assistantMessage: ConversationMessageRecord;
}

export interface CreateConversationInput {
  workspaceId: string;
  scope: RetrievalScope;
  title: string;
}

export interface AppendTurnInput {
  workspaceId: string;
  conversationId: string;
  submissionId: string;
  userContent: string;
  assistantContent: string;
  model: string;
  sources: readonly MessageSourceRecord[];
}

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function scopeFromRow(row: QueryResultRow): RetrievalScope {
  if (row.scope_type === "collection") {
    return { type: "collection", collectionId: row.collection_id as string };
  }
  if (row.scope_type === "document") {
    return { type: "document", documentId: row.document_id as string };
  }
  return { type: "workspace" };
}

function conversationFromRow(row: QueryResultRow): ConversationRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
    scope: scopeFromRow(row),
    title: row.title as string,
    createdAt: iso(row.created_at as Date),
    updatedAt: iso(row.updated_at as Date),
  };
}

function messageFromRow(
  row: QueryResultRow,
  sources: readonly MessageSourceRecord[] = [],
): ConversationMessageRecord {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    submissionId: (row.submission_id as string | null) ?? null,
    role: row.role as "user" | "assistant",
    position: Number(row.position),
    content: row.content as string,
    model: (row.model as string | null) ?? null,
    createdAt: iso(row.created_at as Date),
    sources: [...sources],
  };
}

async function rollback(client: DatabaseTransactionClient) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction error.
  }
}

function scopeColumns(scope: RetrievalScope) {
  if (scope.type === "collection") {
    return {
      scopeType: "collection",
      scopeKey: scope.collectionId,
      collectionId: scope.collectionId,
      documentId: null,
    } as const;
  }
  if (scope.type === "document") {
    return {
      scopeType: "document",
      scopeKey: scope.documentId,
      collectionId: null,
      documentId: scope.documentId,
    } as const;
  }
  return {
    scopeType: "workspace",
    scopeKey: "workspace",
    collectionId: null,
    documentId: null,
  } as const;
}

function isConstraintError(error: unknown, code: string, phrase: string) {
  const candidate = error as { code?: string; data?: { error?: string } };
  return candidate.code === code || candidate.data?.error?.includes(phrase) === true;
}

function storageError() {
  return new ConversationRepositoryError("STORAGE", "Conversation storage failed");
}

function isMessageSourceConstraint(error: unknown) {
  const candidate = error as { code?: string; constraint?: string };
  return (
    ["23503", "23514"].includes(candidate.code ?? "") &&
    candidate.constraint?.startsWith("message_sources_") === true
  );
}

export class PostgresConversationRepository {
  constructor(
    private readonly pool: DatabasePool,
    private readonly createId = randomUUID,
  ) {}

  private async connect() {
    try {
      return await this.pool.connect();
    } catch {
      throw storageError();
    }
  }

  async createConversation(userId: string, input: CreateConversationInput) {
    const client = await this.connect();
    try {
      await client.query("BEGIN");
      const membership = await client.query(
        `SELECT 1 FROM workspace_members
         WHERE workspace_id=$1 AND user_id=$2
         FOR SHARE`,
        [input.workspaceId, userId],
      );
      if (!membership.rowCount) {
        throw new ConversationRepositoryError(
          "NOT_FOUND",
          "Conversation scope not found",
        );
      }
      const columns = scopeColumns(input.scope);
      if (input.scope.type === "collection") {
        const collection = await client.query(
          `SELECT 1 FROM collections
           WHERE id=$1 AND workspace_id=$2
           FOR SHARE`,
          [input.scope.collectionId, input.workspaceId],
        );
        if (!collection.rowCount) {
          throw new ConversationRepositoryError(
            "NOT_FOUND",
            "Conversation scope not found",
          );
        }
      } else if (input.scope.type === "document") {
        const document = await client.query(
          `SELECT 1 FROM documents
           WHERE id=$1 AND workspace_id=$2
           FOR SHARE`,
          [input.scope.documentId, input.workspaceId],
        );
        if (!document.rowCount) {
          throw new ConversationRepositoryError(
            "NOT_FOUND",
            "Conversation scope not found",
          );
        }
      }
      const result = await client.query(
        `INSERT INTO conversations
          (id,workspace_id,created_by_user_id,scope_type,scope_key,collection_id,document_id,title)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          this.createId(),
          input.workspaceId,
          userId,
          columns.scopeType,
          columns.scopeKey,
          columns.collectionId,
          columns.documentId,
          input.title,
        ],
      );
      await client.query("COMMIT");
      return conversationFromRow(result.rows[0]!);
    } catch (error) {
      await rollback(client);
      if (error instanceof ConversationRepositoryError) throw error;
      throw storageError();
    } finally {
      client.release();
    }
  }

  private async sourcesForMessage(
    queryable: Pick<DatabasePool, "query"> | Pick<DatabaseTransactionClient, "query">,
    messageId: string,
  ) {
    const result = await queryable.query(
      `SELECT chunk_id,document_id,source_collection_id,citation_ordinal
       FROM message_sources
       WHERE message_id=$1
       ORDER BY citation_ordinal`,
      [messageId],
    );
    return result.rows.map((row) => ({
      chunkId: row.chunk_id as string,
      documentId: row.document_id as string,
      collectionId: (row.source_collection_id as string | null) ?? null,
      citationOrdinal: Number(row.citation_ordinal),
    }));
  }

  private async existingTurn(
    client: DatabaseTransactionClient,
    conversationId: string,
    submissionId: string,
  ) {
    const result = await client.query(
      `SELECT * FROM conversation_messages
       WHERE conversation_id=$1 AND submission_id=$2
       ORDER BY position`,
      [conversationId, submissionId],
    );
    if (result.rows.length !== 2) return null;
    const userRow = result.rows.find((row) => row.role === "user");
    const assistantRow = result.rows.find((row) => row.role === "assistant");
    if (!userRow || !assistantRow) return null;
    const sources = await this.sourcesForMessage(client, assistantRow.id as string);
    return {
      userMessage: messageFromRow(userRow),
      assistantMessage: messageFromRow(assistantRow, sources),
    };
  }

  async appendTurn(userId: string, input: AppendTurnInput) {
    const client = await this.connect();
    try {
      await client.query("BEGIN");
      const conversation = await client.query(
        `SELECT c.* FROM conversations c
         JOIN workspace_members m ON m.workspace_id=c.workspace_id
         WHERE c.id=$1 AND c.workspace_id=$2 AND m.user_id=$3
         FOR UPDATE`,
        [input.conversationId, input.workspaceId, userId],
      );
      const current = conversation.rows[0];
      if (!current) {
        throw new ConversationRepositoryError("NOT_FOUND", "Conversation not found");
      }

      const existing = await this.existingTurn(
        client,
        input.conversationId,
        input.submissionId,
      );
      if (existing) {
        await client.query("COMMIT");
        return existing;
      }

      for (const source of input.sources) {
        const validSource = await client.query(
          `SELECT 1 FROM document_chunks c
           JOIN documents d
             ON d.id=c.document_id AND d.workspace_id=c.workspace_id
           WHERE c.id=$1 AND c.document_id=$2 AND c.workspace_id=$3
             AND (d.collection_id=$4 OR (d.collection_id IS NULL AND $4::uuid IS NULL))
             AND (
               $5='workspace'
               OR ($5='collection' AND d.collection_id::text=$6)
               OR ($5='document' AND d.id::text=$6)
             )`,
          [
            source.chunkId,
            source.documentId,
            input.workspaceId,
            source.collectionId,
            current.scope_type,
            current.scope_key,
          ],
        );
        if (!validSource.rowCount) {
          throw new ConversationRepositoryError(
            "INVALID_SOURCE",
            "Conversation source is invalid",
          );
        }
      }

      const positionResult = await client.query<{ last_position: number }>(
        `SELECT COALESCE(MAX(position),0) AS last_position
         FROM conversation_messages WHERE conversation_id=$1`,
        [input.conversationId],
      );
      const firstPosition = Number(positionResult.rows[0]?.last_position ?? 0) + 1;
      const userMessageId = this.createId();
      const assistantMessageId = this.createId();
      const messages = await client.query(
        `INSERT INTO conversation_messages
          (id,conversation_id,workspace_id,submission_id,role,position,content,model)
         VALUES ($1,$3,$4,$5,'user',$6,$7,NULL),
                ($2,$3,$4,$5,'assistant',$8,$9,$10)
         RETURNING *`,
        [
          userMessageId,
          assistantMessageId,
          input.conversationId,
          input.workspaceId,
          input.submissionId,
          firstPosition,
          input.userContent,
          firstPosition + 1,
          input.assistantContent,
          input.model,
        ],
      );
      for (const source of input.sources) {
        await client.query(
          `INSERT INTO message_sources
            (message_id,conversation_id,workspace_id,scope_type,scope_key,message_role,
             chunk_id,document_id,source_collection_id,citation_ordinal)
           VALUES ($1,$2,$3,$4,$5,'assistant',$6,$7,$8,$9)`,
          [
            assistantMessageId,
            input.conversationId,
            input.workspaceId,
            current.scope_type,
            current.scope_key,
            source.chunkId,
            source.documentId,
            source.collectionId,
            source.citationOrdinal,
          ],
        );
      }
      await client.query(
        "UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=$1",
        [input.conversationId],
      );
      await client.query("COMMIT");
      const userRow = messages.rows.find((row) => row.role === "user")!;
      const assistantRow = messages.rows.find((row) => row.role === "assistant")!;
      return {
        userMessage: messageFromRow(userRow),
        assistantMessage: messageFromRow(assistantRow, input.sources),
      };
    } catch (error) {
      await rollback(client);
      if (!(error instanceof ConversationRepositoryError) && isMessageSourceConstraint(error)) {
        throw new ConversationRepositoryError(
          "INVALID_SOURCE",
          "Conversation source is invalid",
        );
      }
      if (
        !(error instanceof ConversationRepositoryError) &&
        isConstraintError(error, "23505", "duplicate key")
      ) {
        throw new ConversationRepositoryError("CONFLICT", "Conversation write conflicted");
      }
      if (error instanceof ConversationRepositoryError) throw error;
      throw storageError();
    } finally {
      client.release();
    }
  }

  async listMessages(
    userId: string,
    workspaceId: string,
    conversationId: string,
    options: { limit: number; afterPosition?: number },
  ) {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      options.limit > 100 ||
      (options.afterPosition !== undefined &&
        (!Number.isInteger(options.afterPosition) || options.afterPosition < 0))
    ) {
      throw new ConversationRepositoryError(
        "INVALID_INPUT",
        "Conversation pagination is invalid",
      );
    }
    const client = await this.connect();
    try {
      await client.query("BEGIN");
      const access = await client.query(
        `SELECT 1 FROM conversations c
         JOIN workspace_members m ON m.workspace_id=c.workspace_id
         WHERE c.id=$1 AND c.workspace_id=$2 AND m.user_id=$3
         FOR SHARE`,
        [conversationId, workspaceId, userId],
      );
      if (!access.rowCount) {
        await client.query("COMMIT");
        return null;
      }
      const result = await client.query(
        `SELECT * FROM conversation_messages
         WHERE conversation_id=$1 AND workspace_id=$2 AND position>$3
         ORDER BY position
         LIMIT $4`,
        [conversationId, workspaceId, options.afterPosition ?? 0, options.limit + 1],
      );
      const hasNext = result.rows.length > options.limit;
      const rows = result.rows.slice(0, options.limit);
      const items = await Promise.all(
        rows.map(async (row) =>
          messageFromRow(
            row,
            row.role === "assistant"
              ? await this.sourcesForMessage(client, row.id as string)
              : [],
          ),
        ),
      );
      await client.query("COMMIT");
      return {
        items,
        nextPosition: hasNext ? items.at(-1)!.position : null,
      };
    } catch (error) {
      await rollback(client);
      if (error instanceof ConversationRepositoryError) throw error;
      throw storageError();
    } finally {
      client.release();
    }
  }
}
