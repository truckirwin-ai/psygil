/**
 * Versioned forward-migration runner for Psygil.
 *
 * BUNDLING STRATEGY: approach (b) from the C.5 spec.
 * SQL files live in src/main/db/migrations/*.sql for human editing, but their
 * content is imported via migrations/manifest.ts which inlines each file as a
 * string. This is necessary because electron-vite bundles the main process into
 * a single asar file and cannot read loose .sql files from disk at runtime.
 *
 * PUBLIC API (unchanged from previous monolithic version):
 *   runBaseMigration(sqlite)    - run full versioned runner on a fresh db
 *   ensureViewsAndTriggers(sqlite) - re-apply idempotent post-migration SQL
 *
 * The runner also exports initDatabase for use as the standalone CLI entry
 * point (npx tsx src/main/db/migrate.ts).
 */

import { initDatabase, getDefaultDbPath } from './index'
import { MIGRATIONS, type MigrationEntry } from './migrations/manifest'
import type Database from 'better-sqlite3'

type SqliteHandle = InstanceType<typeof Database>

// =============================================================================
// schema_versions tracking table DDL
// =============================================================================

const SCHEMA_VERSIONS_DDL = `
CREATE TABLE IF NOT EXISTS schema_versions (
  version     INTEGER PRIMARY KEY,
  description TEXT    NOT NULL,
  applied_at  TEXT    NOT NULL
);
`

// =============================================================================
// Versioned runner
// =============================================================================

/**
 * Ensure the schema_versions tracking table exists.
 * This is the first thing the runner does on every init.
 */
function ensureSchemaVersionsTable(sqlite: SqliteHandle): void {
  sqlite.exec(SCHEMA_VERSIONS_DDL)
}

/**
 * Return the set of version numbers that have already been applied.
 */
function getAppliedVersions(sqlite: SqliteHandle): Set<number> {
  const rows = sqlite
    .prepare('SELECT version FROM schema_versions')
    .all() as Array<{ version: number }>
  return new Set(rows.map((r) => r.version))
}

/**
 * Run all pending migrations from the manifest in version order.
 * Each unapplied migration is wrapped in a transaction.
 * On failure, ROLLBACK is issued and the error is re-thrown with context.
 */
function runVersionedMigrations(sqlite: SqliteHandle): void {
  ensureSchemaVersionsTable(sqlite)
  const applied = getAppliedVersions(sqlite)

  const sorted = [...MIGRATIONS].sort((a, b) => a.version - b.version)

  for (const entry of sorted) {
    if (applied.has(entry.version)) continue
    applyMigration(sqlite, entry)
  }
}

/**
 * Apply a single migration inside a transaction.
 * Records the version in schema_versions on success.
 * Rolls back and throws on failure.
 */
function applyMigration(sqlite: SqliteHandle, entry: MigrationEntry): void {
  const appliedAt = new Date().toISOString()
  try {
    const tx = sqlite.transaction(() => {
      sqlite.exec(entry.sql)
      sqlite
        .prepare(
          'INSERT INTO schema_versions (version, description, applied_at) VALUES (?, ?, ?)',
        )
        .run(entry.version, entry.description, appliedAt)
    })
    tx()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Migration ${entry.version} ("${entry.description}") failed and was rolled back: ${message}`,
    )
  }
}

// =============================================================================
// Post-migration SQL (views, FTS, triggers)
// This block is intentionally NOT part of 001-initial.sql so it can be
// re-applied after migrations that drop and recreate tables (e.g. 007).
// All statements use IF NOT EXISTS so repeated calls are safe.
// =============================================================================

const POST_MIGRATION_SQL = `
-- ============================================================================
-- FTS5 VIRTUAL TABLES
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    document_id UNINDEXED,
    original_filename,
    indexed_content,
    content=documents,
    content_rowid=document_id
);

CREATE VIRTUAL TABLE IF NOT EXISTS writer_drafts_fts USING fts5(
    draft_id UNINDEXED,
    section_name,
    section_content,
    content=writer_drafts,
    content_rowid=draft_id
);

CREATE VIRTUAL TABLE IF NOT EXISTS audit_log_fts USING fts5(
    audit_log_id UNINDEXED,
    action_type,
    details,
    content=audit_log,
    content_rowid=audit_log_id
);

CREATE VIRTUAL TABLE IF NOT EXISTS case_notes_fts USING fts5(
    case_note_id UNINDEXED,
    note_content,
    content=case_notes,
    content_rowid=case_note_id
);

-- ============================================================================
-- VIEWS, Base schema (doc 01)
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_active_cases AS
SELECT
    c.case_id,
    c.case_number,
    c.primary_clinician_user_id,
    u.full_name AS clinician_name,
    c.examinee_first_name,
    c.examinee_last_name,
    c.workflow_current_stage,
    c.case_status,
    COUNT(DISTINCT s.session_id) AS session_count,
    COUNT(DISTINCT d.document_id) AS document_count,
    c.created_at,
    c.last_modified
FROM cases c
LEFT JOIN users u ON c.primary_clinician_user_id = u.user_id
LEFT JOIN sessions s ON c.case_id = s.case_id
LEFT JOIN documents d ON c.case_id = d.case_id
WHERE c.case_status IN ('intake', 'in_progress')
GROUP BY c.case_id;

CREATE VIEW IF NOT EXISTS v_case_progress AS
SELECT
    c.case_id,
    c.case_number,
    c.workflow_current_stage,
    COUNT(DISTINCT r.report_id) AS report_count,
    MAX(CASE WHEN r.status = 'finalized' THEN r.finalized_at END) AS last_finalization_date
FROM cases c
LEFT JOIN reports r ON c.case_id = r.case_id
GROUP BY c.case_id;

CREATE VIEW IF NOT EXISTS v_diagnostic_queue AS
SELECT
    c.case_id,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    c.primary_clinician_user_id,
    u.full_name AS clinician_name,
    COUNT(DISTINCT t.test_admin_id) AS test_count,
    COUNT(DISTINCT d.document_id) AS document_count,
    c.created_at
FROM cases c
LEFT JOIN users u ON c.primary_clinician_user_id = u.user_id
LEFT JOIN test_administrations t ON c.case_id = t.case_id
LEFT JOIN documents d ON c.case_id = d.case_id
WHERE c.workflow_current_stage = 'diagnostics'
GROUP BY c.case_id;

CREATE VIEW IF NOT EXISTS v_finalization_queue AS
SELECT
    r.report_id,
    r.case_id,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    r.report_version,
    r.status,
    r.created_at,
    u_gen.full_name AS generated_by,
    COUNT(DISTINCT rev.revision_id) AS revision_count
FROM reports r
LEFT JOIN cases c ON r.case_id = c.case_id
LEFT JOIN users u_gen ON r.generated_by_user_id = u_gen.user_id
LEFT JOIN report_revisions rev ON r.report_id = rev.report_id
WHERE r.status IN ('in_review', 'revisions_needed')
GROUP BY r.report_id
ORDER BY r.created_at ASC;

-- ============================================================================
-- VIEWS, Addendum (doc 01a)
-- ============================================================================

CREATE VIEW IF NOT EXISTS v_user_case_assignments AS
SELECT
    ca.assignment_id,
    ca.case_id,
    ca.user_id,
    u.full_name AS user_name,
    u.role AS user_role,
    ca.role_in_case,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    c.case_status,
    ca.assigned_at
FROM case_assignments ca
LEFT JOIN users u ON ca.user_id = u.user_id
LEFT JOIN cases c ON ca.case_id = c.case_id
WHERE ca.completed_at IS NULL
ORDER BY ca.assigned_at DESC;

CREATE VIEW IF NOT EXISTS v_active_file_locks AS
SELECT
    fl.lock_id,
    fl.document_id,
    d.original_filename,
    d.case_id,
    c.case_number,
    fl.locked_by_user_id,
    u.full_name AS locked_by_user,
    fl.lock_type,
    fl.acquired_at,
    fl.expires_at,
    CASE
        WHEN fl.expires_at < CURRENT_DATE THEN 'expired'
        ELSE 'active'
    END AS lock_status
FROM file_locks fl
LEFT JOIN documents d ON fl.document_id = d.document_id
LEFT JOIN cases c ON d.case_id = c.case_id
LEFT JOIN users u ON fl.locked_by_user_id = u.user_id
WHERE fl.released_at IS NULL;

CREATE VIEW IF NOT EXISTS v_case_sync_status AS
SELECT
    c.case_id,
    c.case_number,
    c.practice_id,
    pc.practice_name,
    pc.storage_mode,
    COUNT(d.document_id) AS total_documents,
    SUM(CASE WHEN d.sync_status = 'synced' THEN 1 ELSE 0 END) AS synced_documents,
    SUM(CASE WHEN d.sync_status = 'pending_upload' THEN 1 ELSE 0 END) AS pending_uploads,
    SUM(CASE WHEN d.sync_status = 'pending_download' THEN 1 ELSE 0 END) AS pending_downloads,
    SUM(CASE WHEN d.sync_status = 'conflict' THEN 1 ELSE 0 END) AS conflicted_documents,
    sm.sync_status AS case_manifest_status,
    sm.last_sync_date
FROM cases c
LEFT JOIN practice_config pc ON c.practice_id = pc.practice_id
LEFT JOIN documents d ON c.case_id = d.case_id
LEFT JOIN sync_manifest sm ON c.case_id = sm.case_id
GROUP BY c.case_id;

-- ============================================================================
-- TRIGGERS, Base schema
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS tr_cases_update_last_modified
AFTER UPDATE ON cases
FOR EACH ROW
BEGIN
    UPDATE cases SET last_modified = CURRENT_DATE WHERE case_id = NEW.case_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_diagnosis_audit
AFTER INSERT ON diagnoses
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details, related_entity_type, related_entity_id)
    VALUES (
        NEW.case_id,
        'diagnosis_selected',
        NEW.clinician_user_id,
        'Diagnosis: ' || NEW.diagnosis_id || ' selected with confidence: ' || NEW.confidence_level,
        'diagnosis',
        NEW.diagnosis_record_id
    );
END;

CREATE TRIGGER IF NOT EXISTS tr_report_finalization_audit
AFTER UPDATE ON reports
FOR EACH ROW
WHEN NEW.status = 'finalized' AND OLD.status != 'finalized'
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details, related_entity_type, related_entity_id)
    VALUES (
        NEW.case_id,
        'report_finalized',
        NEW.finalized_by_user_id,
        'Report version ' || NEW.report_version || ' finalized with integrity hash: ' || NEW.integrity_hash,
        'report',
        NEW.report_id
    );
END;

-- ============================================================================
-- TRIGGERS, Addendum
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS tr_practice_config_update_timestamp
AFTER UPDATE ON practice_config
FOR EACH ROW
BEGIN
    UPDATE practice_config
    SET updated_at = CURRENT_DATE
    WHERE practice_id = NEW.practice_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_sync_manifest_update_timestamp
AFTER UPDATE ON sync_manifest
FOR EACH ROW
BEGIN
    UPDATE sync_manifest
    SET updated_at = CURRENT_DATE
    WHERE manifest_id = NEW.manifest_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_file_locks_cleanup
AFTER INSERT ON file_locks
FOR EACH ROW
WHEN NEW.expires_at < CURRENT_DATE
BEGIN
    DELETE FROM file_locks
    WHERE lock_id = NEW.lock_id
    AND released_at IS NULL
    AND expires_at < CURRENT_DATE;
END;

-- ============================================================================
-- AGENT_RESULTS, shared by all 4 AI agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES cases(case_id),
    agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'psychometrician', 'diagnostician', 'writer', 'editor')),
    operation_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(case_id, agent_type, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_results_case
    ON agent_results(case_id, agent_type);
`

// =============================================================================
// Public API (preserved from prior version for callers in connection.ts)
// =============================================================================

/**
 * Run the full versioned migration runner on a database handle.
 * Applies all entries from migrations/manifest.ts that have not yet been
 * recorded in schema_versions, then re-applies idempotent post-migration SQL.
 *
 * Called by connection.ts on every app startup (fresh and existing databases).
 */
export function runBaseMigration(sqlite: SqliteHandle): void {
  runVersionedMigrations(sqlite)
  sqlite.exec(POST_MIGRATION_SQL)
}

/**
 * Re-apply views, FTS tables, and triggers. Safe to call repeatedly because
 * all statements use IF NOT EXISTS.
 * Called after incremental migrations that drop and recreate tables (e.g. 007).
 */
export function ensureViewsAndTriggers(sqlite: SqliteHandle): void {
  sqlite.exec(POST_MIGRATION_SQL)
}

// =============================================================================
// Standalone CLI entry point
// Usage: npx tsx src/main/db/migrate.ts
// =============================================================================

async function main(): Promise<void> {
  const dbPath = getDefaultDbPath()
  const { sqlite } = await initDatabase(undefined, dbPath)
  runBaseMigration(sqlite)
  sqlite.close()
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[migrate] FATAL: ${message}\n`)
  process.exit(1)
})
