ALTER TABLE message_sources
  ADD COLUMN relevance_score DOUBLE PRECISION;

-- pg-mem-ignore-start: pg-mem cannot add a check constraint to an existing table.
ALTER TABLE message_sources
  ADD CONSTRAINT message_sources_relevance_score_check
  CHECK (relevance_score IS NULL OR relevance_score BETWEEN -1 AND 1);
-- pg-mem-ignore-end

CREATE TABLE conversation_submission_reservations (
  conversation_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  submission_id UUID NOT NULL,
  question_hash TEXT NOT NULL CHECK (LENGTH(question_hash) = 64),
  reservation_token UUID NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, submission_id),
  UNIQUE (reservation_token),
  FOREIGN KEY (conversation_id, workspace_id)
    REFERENCES conversations(id, workspace_id)
    ON DELETE CASCADE
);
