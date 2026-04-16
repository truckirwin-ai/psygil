-- Migration: 002-audit-hash-chain
-- Adds tamper-evident columns to audit_log and installs immutability triggers.
-- prev_hash is nullable so existing rows pass without backfill.
-- row_hash is nullable for the same reason; new rows will always have it set.

ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
ALTER TABLE audit_log ADD COLUMN row_hash TEXT;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable');
END;

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable');
END;
