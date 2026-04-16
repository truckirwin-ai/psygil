-- Migration 003: Unique index on documents(case_id, file_path)
--
-- Deduplicates any existing rows that share (case_id, file_path), keeping
-- the row with the highest document_id (the most recently inserted one).
-- Then adds a UNIQUE index so idempotent upserts work correctly.

DELETE FROM documents
WHERE document_id NOT IN (
  SELECT MAX(document_id)
  FROM documents
  GROUP BY case_id, file_path
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_case_path_unique
ON documents(case_id, file_path);
