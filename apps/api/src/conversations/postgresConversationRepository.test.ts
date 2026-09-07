import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "../database/migrate.js";
import type { DatabasePool } from "../database/pool.js";
import { createPgMemPool } from "../testSupport/pgMem.js";
import {
  ConversationRepositoryError,
  PostgresConversationRepository,
} from "./postgresConversationRepository.js";

const ids = {
  owner: "10000000-0000-4000-8000-000000000001",
  outsider: "10000000-0000-4000-8000-000000000002",
  workspace: "10000000-0000-4000-8000-000000000010",
  collection: "10000000-0000-4000-8000-000000000020",
  document: "10000000-0000-4000-8000-000000000030",
  run: "10000000-0000-4000-8000-000000000040",
  chunk: "10000000-0000-4000-8000-000000000050",
  conversation: "10000000-0000-4000-8000-000000000060",
  submission: "10000000-0000-4000-8000-000000000070",
  userMessage: "10000000-0000-4000-8000-000000000080",
  assistantMessage: "10000000-0000-4000-8000-000000000081",
};

const embedding = `[${Array.from({ length: 1536 }, () => "1").join(",")}]`;

describe("PostgresConversationRepository", () => {
  let pool: DatabasePool;
  let generatedIds: string[];
  let repository: PostgresConversationRepository;

  beforeEach(async () => {
    pool = createPgMemPool();
    await runMigrations(pool);
    await pool.query(
      `INSERT INTO users (id,email,display_name)
       VALUES ($1,'owner@example.com','Owner'),($2,'outsider@example.com','Outsider')`,
      [ids.owner, ids.outsider],
    );
    await pool.query(
      "INSERT INTO workspaces (id,owner_id,name,slug) VALUES ($1,$2,'Research','research')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO workspace_members (workspace_id,user_id,role) VALUES ($1,$2,'owner')",
      [ids.workspace, ids.owner],
    );
    await pool.query(
      "INSERT INTO collections (id,workspace_id,name) VALUES ($1,$2,'Policies')",
      [ids.collection, ids.workspace],
    );
    await pool.query(
      `INSERT INTO documents
        (id,workspace_id,collection_id,original_filename,media_type,size_bytes,ingestion_state)
       VALUES ($1,$2,$3,'policy.txt','text/plain',20,'indexed')`,
      [ids.document, ids.workspace, ids.collection],
    );
    await pool.query(
      `INSERT INTO document_index_runs
        (id,document_id,workspace_id,status,embedding_model,embedding_dimensions)
       VALUES ($1,$2,$3,'active','test-embedding',1536)`,
      [ids.run, ids.document, ids.workspace],
    );
    await pool.query(
      `INSERT INTO document_chunks
        (id,index_run_id,document_id,workspace_id,ordinal,content,word_count,embedding)
       VALUES ($1,$2,$3,$4,0,'Grounded policy source',3,$5)`,
      [ids.chunk, ids.run, ids.document, ids.workspace, embedding],
    );
    generatedIds = [ids.conversation, ids.userMessage, ids.assistantMessage];
    repository = new PostgresConversationRepository(pool, () => generatedIds.shift()!);
  });

  afterEach(async () => {
    await pool.end();
  });

  it("creates a conversation only for a current workspace member", async () => {
    await expect(
      repository.createConversation(ids.outsider, {
        workspaceId: ids.workspace,
        scope: { type: "workspace" },
        title: "Private policy",
      }),
    ).rejects.toEqual(
      new ConversationRepositoryError("NOT_FOUND", "Conversation scope not found"),
    );

    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "collection", collectionId: ids.collection },
      title: "Policy review",
    });
    expect(conversation).toMatchObject({
      id: ids.conversation,
      workspaceId: ids.workspace,
      scope: { type: "collection", collectionId: ids.collection },
      title: "Policy review",
    });
  });

  it("atomically persists an ordered grounded turn and exact sources", async () => {
    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "workspace" },
      title: "Policy review",
    });
    const turn = await repository.appendTurn(ids.owner, {
      workspaceId: ids.workspace,
      conversationId: conversation.id,
      submissionId: ids.submission,
      userContent: "What is the policy?",
      assistantContent: "The policy is grounded [1].",
      model: "test-generation",
      sources: [
        {
          chunkId: ids.chunk,
          documentId: ids.document,
          collectionId: ids.collection,
          citationOrdinal: 0,
        },
      ],
    });

    expect(turn.userMessage).toMatchObject({ id: ids.userMessage, role: "user", position: 1 });
    expect(turn.assistantMessage).toMatchObject({
      id: ids.assistantMessage,
      role: "assistant",
      position: 2,
      sources: [{ chunkId: ids.chunk, citationOrdinal: 0 }],
    });
  });

  it("returns the original turn for an idempotent submission retry", async () => {
    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "workspace" },
      title: "Policy review",
    });
    const input = {
      workspaceId: ids.workspace,
      conversationId: conversation.id,
      submissionId: ids.submission,
      userContent: "What is the policy?",
      assistantContent: "Grounded answer.",
      model: "test-generation",
      sources: [],
    };
    const first = await repository.appendTurn(ids.owner, input);
    generatedIds.push(
      "10000000-0000-4000-8000-000000000082",
      "10000000-0000-4000-8000-000000000083",
    );
    const retried = await repository.appendTurn(ids.owner, {
      ...input,
      assistantContent: "This retry must not overwrite history.",
    });

    expect(retried).toEqual(first);
    const count = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM conversation_messages WHERE conversation_id=$1",
      [conversation.id],
    );
    expect(count.rows[0]?.count).toBe("2");
  });

  it("rolls back the entire turn when an exact source is invalid", async () => {
    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "workspace" },
      title: "Policy review",
    });
    await expect(
      repository.appendTurn(ids.owner, {
        workspaceId: ids.workspace,
        conversationId: conversation.id,
        submissionId: ids.submission,
        userContent: "Question",
        assistantContent: "Answer",
        model: "test-generation",
        sources: [
          {
            chunkId: "10000000-0000-4000-8000-000000000099",
            documentId: ids.document,
            collectionId: ids.collection,
            citationOrdinal: 0,
          },
        ],
      }),
    ).rejects.toEqual(
      new ConversationRepositoryError("INVALID_SOURCE", "Conversation source is invalid"),
    );
    const messages = await pool.query(
      "SELECT 1 FROM conversation_messages WHERE conversation_id=$1",
      [conversation.id],
    );
    expect(messages.rowCount).toBe(0);
  });

  it("rechecks membership inside the turn transaction", async () => {
    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "workspace" },
      title: "Policy review",
    });
    await pool.query(
      "DELETE FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",
      [ids.workspace, ids.owner],
    );
    await expect(
      repository.appendTurn(ids.owner, {
        workspaceId: ids.workspace,
        conversationId: conversation.id,
        submissionId: ids.submission,
        userContent: "Question",
        assistantContent: "Answer",
        model: "test-generation",
        sources: [],
      }),
    ).rejects.toEqual(
      new ConversationRepositoryError("NOT_FOUND", "Conversation not found"),
    );
  });

  it("paginates history by stable message position", async () => {
    const conversation = await repository.createConversation(ids.owner, {
      workspaceId: ids.workspace,
      scope: { type: "workspace" },
      title: "Policy review",
    });
    await repository.appendTurn(ids.owner, {
      workspaceId: ids.workspace,
      conversationId: conversation.id,
      submissionId: ids.submission,
      userContent: "Question one",
      assistantContent: "Answer one",
      model: "test-generation",
      sources: [],
    });
    generatedIds.push(
      "10000000-0000-4000-8000-000000000082",
      "10000000-0000-4000-8000-000000000083",
    );
    await repository.appendTurn(ids.owner, {
      workspaceId: ids.workspace,
      conversationId: conversation.id,
      submissionId: "10000000-0000-4000-8000-000000000071",
      userContent: "Question two",
      assistantContent: "Answer two",
      model: "test-generation",
      sources: [],
    });

    const first = await repository.listMessages(ids.owner, ids.workspace, conversation.id, {
      limit: 2,
    });
    const second = await repository.listMessages(ids.owner, ids.workspace, conversation.id, {
      limit: 2,
      afterPosition: first.nextPosition!,
    });
    expect(first.items.map((message) => message.position)).toEqual([1, 2]);
    expect(first.nextPosition).toBe(2);
    expect(second.items.map((message) => message.position)).toEqual([3, 4]);
    expect(second.nextPosition).toBeNull();
  });
});
