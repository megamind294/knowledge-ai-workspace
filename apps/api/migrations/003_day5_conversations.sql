ALTER TABLE document_chunks
  ADD CONSTRAINT document_chunks_id_workspace_document_key
  UNIQUE (id, workspace_id, document_id);

ALTER TABLE documents
  ADD CONSTRAINT documents_id_workspace_collection_key
  UNIQUE (id, workspace_id, collection_id);

CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('workspace', 'collection', 'document')),
  collection_id UUID,
  document_id UUID,
  scope_key TEXT NOT NULL,
  title TEXT NOT NULL
    CHECK (LENGTH(TRIM(title)) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id, workspace_id),
  UNIQUE (id, workspace_id, scope_type, scope_key),
  FOREIGN KEY (collection_id, workspace_id)
    REFERENCES collections(id, workspace_id)
    ON DELETE CASCADE,
  FOREIGN KEY (document_id, workspace_id)
    REFERENCES documents(id, workspace_id)
    ON DELETE CASCADE,
  CHECK (
    (scope_type = 'workspace' AND collection_id IS NULL AND document_id IS NULL AND scope_key = 'workspace')
    OR
    (scope_type = 'collection' AND collection_id IS NOT NULL AND document_id IS NULL AND scope_key = collection_id::TEXT)
    OR
    (scope_type = 'document' AND collection_id IS NULL AND document_id IS NOT NULL AND scope_key = document_id::TEXT)
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
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  message_role TEXT NOT NULL DEFAULT 'assistant'
    CHECK (message_role = 'assistant'),
  chunk_id UUID NOT NULL,
  document_id UUID NOT NULL,
  source_collection_id UUID,
  citation_ordinal INTEGER NOT NULL CHECK (citation_ordinal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, chunk_id),
  UNIQUE (message_id, citation_ordinal),
  FOREIGN KEY (message_id, workspace_id, conversation_id, message_role)
    REFERENCES conversation_messages(id, workspace_id, conversation_id, role)
    ON DELETE CASCADE,
  FOREIGN KEY (conversation_id, workspace_id, scope_type, scope_key)
    REFERENCES conversations(id, workspace_id, scope_type, scope_key)
    ON DELETE CASCADE,
  FOREIGN KEY (chunk_id, workspace_id, document_id)
    REFERENCES document_chunks(id, workspace_id, document_id)
    ON DELETE CASCADE,
  FOREIGN KEY (document_id, workspace_id, source_collection_id)
    REFERENCES documents(id, workspace_id, collection_id)
    ON DELETE CASCADE,
  CHECK (
    (scope_type = 'workspace' AND scope_key = 'workspace')
    OR
    (scope_type = 'collection' AND source_collection_id IS NOT NULL AND scope_key = source_collection_id::TEXT)
    OR
    (scope_type = 'document' AND scope_key = document_id::TEXT)
  )
);

-- pg-mem-ignore-start: pg-mem does not implement PostgreSQL trigger functions.
CREATE FUNCTION reject_message_source_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'message source mappings are immutable';
END;
$$;

CREATE TRIGGER message_sources_are_immutable
  BEFORE UPDATE ON message_sources
  FOR EACH ROW
  EXECUTE FUNCTION reject_message_source_update();
-- pg-mem-ignore-end

CREATE INDEX conversations_workspace_updated_idx
  ON conversations(workspace_id, updated_at DESC, id);

CREATE INDEX conversations_created_by_user_id_idx
  ON conversations(created_by_user_id);

CREATE INDEX conversations_collection_id_idx
  ON conversations(collection_id);

CREATE INDEX conversations_document_id_idx
  ON conversations(document_id);

CREATE INDEX message_sources_chunk_id_idx
  ON message_sources(chunk_id);
