ALTER TABLE document_chunks
  ADD CONSTRAINT document_chunks_id_workspace_document_key
  UNIQUE (id, workspace_id, document_id);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('workspace', 'collection', 'document')),
  collection_id UUID,
  document_id UUID,
  title TEXT NOT NULL
    CHECK (LENGTH(TRIM(title)) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, workspace_id),
  FOREIGN KEY (collection_id, workspace_id)
    REFERENCES collections(id, workspace_id)
    ON DELETE CASCADE,
  FOREIGN KEY (document_id, workspace_id)
    REFERENCES documents(id, workspace_id)
    ON DELETE CASCADE,
  CHECK (
    (scope_type = 'workspace' AND collection_id IS NULL AND document_id IS NULL)
    OR
    (scope_type = 'collection' AND collection_id IS NOT NULL AND document_id IS NULL)
    OR
    (scope_type = 'document' AND collection_id IS NULL AND document_id IS NOT NULL)
  )
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  position INTEGER NOT NULL CHECK (position > 0),
  content TEXT NOT NULL
    CHECK (LENGTH(TRIM(content)) BETWEEN 1 AND 20000),
  model TEXT CHECK (model IS NULL OR LENGTH(TRIM(model)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (conversation_id, position),
  UNIQUE (id, workspace_id, conversation_id, role),
  FOREIGN KEY (conversation_id, workspace_id)
    REFERENCES conversations(id, workspace_id)
    ON DELETE CASCADE
);

CREATE TABLE message_sources (
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  message_role TEXT NOT NULL DEFAULT 'assistant'
    CHECK (message_role = 'assistant'),
  chunk_id UUID NOT NULL,
  document_id UUID NOT NULL,
  citation_ordinal INTEGER NOT NULL CHECK (citation_ordinal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, chunk_id),
  UNIQUE (message_id, citation_ordinal),
  FOREIGN KEY (message_id, workspace_id, conversation_id, message_role)
    REFERENCES conversation_messages(id, workspace_id, conversation_id, role)
    ON DELETE CASCADE,
  FOREIGN KEY (chunk_id, workspace_id, document_id)
    REFERENCES document_chunks(id, workspace_id, document_id)
    ON DELETE CASCADE
);

CREATE INDEX conversations_workspace_updated_idx
  ON conversations(workspace_id, updated_at DESC, id);

CREATE INDEX conversation_messages_conversation_position_idx
  ON conversation_messages(conversation_id, position);

CREATE INDEX message_sources_chunk_id_idx
  ON message_sources(chunk_id);
