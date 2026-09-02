CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

ALTER TABLE documents
  ADD CONSTRAINT documents_id_workspace_id_key UNIQUE (id, workspace_id);

CREATE TABLE document_index_runs (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('processing', 'active', 'failed', 'superseded')),
  embedding_model TEXT NOT NULL,
  embedding_dimensions INTEGER NOT NULL CHECK (embedding_dimensions = 1536),
  failure_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  UNIQUE (id, workspace_id, document_id),
  FOREIGN KEY (document_id, workspace_id)
    REFERENCES documents(id, workspace_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX document_index_runs_one_active_per_document_idx
  ON document_index_runs(document_id)
  WHERE status = 'active';

CREATE INDEX document_index_runs_workspace_id_idx
  ON document_index_runs(workspace_id);

CREATE INDEX document_index_runs_document_id_idx
  ON document_index_runs(document_id);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  index_run_id UUID NOT NULL,
  document_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
  word_count INTEGER NOT NULL CHECK (word_count > 0),
  page_number INTEGER CHECK (page_number > 0),
  section_heading TEXT,
  embedding public.vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (index_run_id, ordinal),
  FOREIGN KEY (index_run_id, workspace_id, document_id)
    REFERENCES document_index_runs(id, workspace_id, document_id)
    ON DELETE CASCADE
);

CREATE INDEX document_chunks_workspace_id_idx
  ON document_chunks(workspace_id);

CREATE INDEX document_chunks_document_id_idx
  ON document_chunks(document_id);

CREATE INDEX document_chunks_embedding_hnsw_idx
  ON document_chunks USING HNSW (embedding public.vector_cosine_ops);
