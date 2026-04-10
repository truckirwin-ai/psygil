/**
 * Database migration script for Psygil.
 *
 * Strategy: Use Drizzle to create the 24 base tables from schema.ts,
 * then apply raw SQL for FTS5 virtual tables, views, triggers, and
 * CHECK constraints that Drizzle cannot express.
 *
 * Usage: npx tsx src/main/db/migrate.ts
 */

import { initDatabase, getDefaultDbPath } from './index'

/**
 * Raw SQL that Drizzle cannot generate:
 * - FTS5 virtual tables (documents, writer_drafts, audit_log, case_notes)
 * - Views (v_active_cases, v_case_progress, v_diagnostic_queue, v_finalization_queue, addendum views)
 * - Triggers (auto-update timestamps, audit trail logging)
 */
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
    COALESCE(g1.review_status, 'pending') AS gate_1_status,
    COALESCE(g2.review_status, 'pending') AS gate_2_status,
    COALESCE(g3.review_status, 'pending') AS gate_3_status,
    COUNT(DISTINCT r.report_id) AS report_count,
    MAX(CASE WHEN r.status = 'finalized' THEN r.finalized_at END) AS last_finalization_date
FROM cases c
LEFT JOIN gate_reviews g1 ON c.case_id = g1.case_id AND g1.gate_number = 1
LEFT JOIN gate_reviews g2 ON c.case_id = g2.case_id AND g2.gate_number = 2
LEFT JOIN gate_reviews g3 ON c.case_id = g3.case_id AND g3.gate_number = 3
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
    g2.review_status,
    g2.reviewer_user_id,
    c.created_at
FROM cases c
LEFT JOIN users u ON c.primary_clinician_user_id = u.user_id
LEFT JOIN test_administrations t ON c.case_id = t.case_id
LEFT JOIN documents d ON c.case_id = d.case_id
LEFT JOIN gate_reviews g2 ON c.case_id = g2.case_id AND g2.gate_number = 2
WHERE c.workflow_current_stage = 'gate_2'
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

CREATE TRIGGER IF NOT EXISTS tr_gate_review_audit
AFTER UPDATE ON gate_reviews
FOR EACH ROW
WHEN NEW.review_status = 'completed' AND OLD.review_status != 'completed'
BEGIN
    INSERT INTO audit_log (case_id, action_type, actor_user_id, details)
    VALUES (
        NEW.case_id,
        'gate_completed',
        NEW.reviewer_user_id,
        'Gate ' || NEW.gate_number || ' completed with status: ' || NEW.review_status
    );
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
-- AGENT_RESULTS, shared by all 4 AI agents (ingestor, diagnostician, writer, editor)
-- Created globally so any agent can write/read results without each having
-- to recreate the table on first run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL REFERENCES cases(case_id),
    agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
    operation_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(case_id, agent_type, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_results_case
    ON agent_results(case_id, agent_type);
`;

async function main(): Promise<void> {
  const dbPath = getDefaultDbPath()
  console.log(`[migrate] Opening database at: ${dbPath}`)

  const { sqlite } = await initDatabase(undefined, dbPath)

  // Step 1: Create tables directly from schema if they don't exist
  const tableCount = sqlite
    .prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%'")
    .get() as { cnt: number }

  if (tableCount.cnt === 0) {
    console.log('[migrate] No tables found, creating schema from raw SQL...')
    createTablesFromSchema(sqlite)
    console.log('[migrate] Base tables created')
  } else {
    console.log(`[migrate] Found ${tableCount.cnt} existing tables`)
  }

  // Step 3: Apply FTS5, views, triggers via raw SQL
  console.log('[migrate] Applying FTS5 virtual tables, views, and triggers...')
  sqlite.exec(POST_MIGRATION_SQL)
  console.log('[migrate] Post-migration SQL applied')

  // Verify
  const allTables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as Array<{ name: string }>
  console.log(`[migrate] Total tables: ${allTables.length}`)
  allTables.forEach((t) => console.log(`  - ${t.name}`))

  const allViews = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")
    .all() as Array<{ name: string }>
  console.log(`[migrate] Total views: ${allViews.length}`)
  allViews.forEach((v) => console.log(`  - ${v.name}`))

  const allTriggers = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name")
    .all() as Array<{ name: string }>
  console.log(`[migrate] Total triggers: ${allTriggers.length}`)
  allTriggers.forEach((t) => console.log(`  - ${t.name}`))

  sqlite.close()
  console.log('[migrate] Done.')
}

/**
 * Create all 24 tables from raw SQL when no Drizzle migration files exist.
 * This is the bootstrap path for fresh databases.
 */
function createTablesFromSchema(sqlite: ReturnType<typeof import('better-sqlite3')>): void {
  sqlite.exec(`
    -- 1. Practice Config (must come before users due to FK)
    CREATE TABLE IF NOT EXISTS practice_config (
      practice_id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_name TEXT NOT NULL UNIQUE,
      storage_mode TEXT NOT NULL DEFAULT 'local_only'
        CHECK (storage_mode IN ('local_only', 'shared_drive', 'cloud_o365', 'cloud_gdrive')),
      storage_path TEXT,
      cloud_tenant_id TEXT,
      cloud_site_id TEXT,
      cloud_drive_id TEXT,
      gdrive_shared_drive_id TEXT,
      auto_sync_interval_minutes INTEGER,
      enable_version_history INTEGER DEFAULT 1,
      max_local_cache_mb INTEGER DEFAULT 5000,
      admin_email TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      updated_at TEXT DEFAULT (date('now')),
      CONSTRAINT valid_storage_path_if_shared
        CHECK (storage_mode != 'shared_drive' OR storage_path IS NOT NULL),
      CONSTRAINT valid_cloud_tenant_if_o365
        CHECK (storage_mode != 'cloud_o365' OR cloud_tenant_id IS NOT NULL),
      CONSTRAINT valid_gdrive_id_if_gdrive
        CHECK (storage_mode != 'cloud_gdrive' OR gdrive_shared_drive_id IS NOT NULL)
    );
    CREATE INDEX IF NOT EXISTS idx_practice_config_storage_mode ON practice_config(storage_mode);
    CREATE INDEX IF NOT EXISTS idx_practice_config_practice_name ON practice_config(practice_name);

    -- 2. Users
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('psychologist', 'psychometrist', 'admin', 'receptionist')),
      specializations TEXT,
      credentials TEXT,
      license_number TEXT,
      state_licensed TEXT,
      organization TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      last_login TEXT,
      deleted_at TEXT,
      practice_id INTEGER REFERENCES practice_config(practice_id)
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
    CREATE INDEX IF NOT EXISTS idx_users_practice_id ON users(practice_id);

    -- 3. Diagnosis Catalog
    CREATE TABLE IF NOT EXISTS diagnosis_catalog (
      diagnosis_id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      dsm5tr_code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      is_builtin INTEGER NOT NULL DEFAULT 1,
      created_by_user_id INTEGER REFERENCES users(user_id),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      CONSTRAINT valid_diagnosis_code CHECK (LENGTH(code) > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_diagnosis_catalog_code ON diagnosis_catalog(code);
    CREATE INDEX IF NOT EXISTS idx_diagnosis_catalog_dsm5tr_code ON diagnosis_catalog(dsm5tr_code);
    CREATE INDEX IF NOT EXISTS idx_diagnosis_catalog_is_builtin ON diagnosis_catalog(is_builtin);

    -- 4. Instrument Library
    CREATE TABLE IF NOT EXISTS instrument_library (
      instrument_id INTEGER PRIMARY KEY AUTOINCREMENT,
      abbreviation TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      description TEXT,
      what_it_measures TEXT,
      publisher TEXT,
      publication_year INTEGER,
      scoring_method TEXT,
      time_to_administer_minutes INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      CONSTRAINT valid_abbreviation CHECK (LENGTH(abbreviation) > 0),
      CONSTRAINT valid_full_name CHECK (LENGTH(full_name) > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_instrument_library_abbreviation ON instrument_library(abbreviation);
    CREATE INDEX IF NOT EXISTS idx_instrument_library_is_active ON instrument_library(is_active);

    -- 5. Diagnosis-Instrument Mappings
    CREATE TABLE IF NOT EXISTS diagnosis_instrument_mappings (
      mapping_id INTEGER PRIMARY KEY AUTOINCREMENT,
      diagnosis_id INTEGER NOT NULL REFERENCES diagnosis_catalog(diagnosis_id) ON DELETE CASCADE,
      instrument_id INTEGER NOT NULL REFERENCES instrument_library(instrument_id) ON DELETE CASCADE,
      relevance_score REAL DEFAULT 1.0,
      is_primary INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE (diagnosis_id, instrument_id)
    );
    CREATE INDEX IF NOT EXISTS idx_diagnosis_instrument_mappings_diagnosis_id ON diagnosis_instrument_mappings(diagnosis_id);
    CREATE INDEX IF NOT EXISTS idx_diagnosis_instrument_mappings_instrument_id ON diagnosis_instrument_mappings(instrument_id);

    -- 6. Practice Profiles
    CREATE TABLE IF NOT EXISTS practice_profiles (
      profile_id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_name TEXT NOT NULL UNIQUE,
      profile_type TEXT NOT NULL CHECK (profile_type IN ('forensic_criminal', 'forensic_civil', 'clinical_general', 'neuropsych')),
      description TEXT,
      default_diagnoses TEXT,
      default_instruments TEXT,
      standard_sections TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_practice_profiles_profile_type ON practice_profiles(profile_type);
    CREATE INDEX IF NOT EXISTS idx_practice_profiles_is_active ON practice_profiles(is_active);

    -- 7. Report Templates
    CREATE TABLE IF NOT EXISTS report_templates (
      template_id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name TEXT NOT NULL,
      evaluation_type TEXT NOT NULL,
      template_content TEXT,
      sections TEXT,
      jurisdiction TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_report_templates_evaluation_type ON report_templates(evaluation_type);
    CREATE INDEX IF NOT EXISTS idx_report_templates_jurisdiction ON report_templates(jurisdiction);
    CREATE INDEX IF NOT EXISTS idx_report_templates_is_active ON report_templates(is_active);

    -- 8. Style Rules
    CREATE TABLE IF NOT EXISTS style_rules (
      rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT NOT NULL UNIQUE,
      rule_content TEXT NOT NULL,
      category TEXT,
      guardrails TEXT,
      examples TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      updated_at TEXT DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_style_rules_category ON style_rules(category);

    -- 9. Cases
    CREATE TABLE IF NOT EXISTS cases (
      case_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT NOT NULL UNIQUE,
      primary_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      examinee_first_name TEXT NOT NULL,
      examinee_last_name TEXT NOT NULL,
      examinee_dob TEXT,
      examinee_gender TEXT,
      cultural_context TEXT,
      linguistic_context TEXT,
      evaluation_type TEXT,
      practice_profile_id INTEGER REFERENCES practice_profiles(profile_id),
      referral_source TEXT,
      evaluation_questions TEXT,
      case_status TEXT NOT NULL DEFAULT 'intake'
        CHECK (case_status IN ('intake', 'in_progress', 'completed', 'archived')),
      workflow_current_stage TEXT DEFAULT 'gate_1'
        CHECK (workflow_current_stage IN ('gate_1', 'gate_2', 'gate_3', 'finalized')),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      last_modified TEXT DEFAULT (date('now')),
      completed_at TEXT,
      notes TEXT,
      practice_id INTEGER REFERENCES practice_config(practice_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cases_primary_clinician_user_id ON cases(primary_clinician_user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_case_status ON cases(case_status);
    CREATE INDEX IF NOT EXISTS idx_cases_workflow_current_stage ON cases(workflow_current_stage);
    CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
    CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
    CREATE INDEX IF NOT EXISTS idx_cases_practice_id ON cases(practice_id);

    -- 10. Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      session_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      session_number INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      psychometrist_user_id INTEGER REFERENCES users(user_id),
      duration_minutes INTEGER,
      session_notes TEXT,
      behavioral_observations TEXT,
      rapport_quality TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE (case_id, session_number),
      CONSTRAINT valid_duration CHECK (duration_minutes IS NULL OR duration_minutes > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_case_id ON sessions(case_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_session_date ON sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_clinician_user_id ON sessions(clinician_user_id);

    -- 11. Documents
    CREATE TABLE IF NOT EXISTS documents (
      document_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(session_id) ON DELETE SET NULL,
      document_type TEXT NOT NULL
        CHECK (document_type IN ('referral', 'pdf', 'docx', 'transcript_vtt', 'audio', 'score_report', 'medical_record', 'other')),
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER,
      mime_type TEXT,
      uploaded_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      upload_date TEXT NOT NULL DEFAULT (date('now')),
      description TEXT,
      indexed_content TEXT,
      remote_path TEXT,
      remote_version TEXT,
      sync_status TEXT DEFAULT 'local_only'
        CHECK (sync_status IN ('local_only', 'synced', 'pending_upload', 'pending_download', 'conflict')),
      last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_documents_session_id ON documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
    CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date);
    CREATE INDEX IF NOT EXISTS idx_documents_sync_status ON documents(sync_status);
    CREATE INDEX IF NOT EXISTS idx_documents_last_synced_at ON documents(last_synced_at);

    -- 12. Test Administrations
    CREATE TABLE IF NOT EXISTS test_administrations (
      test_admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(session_id) ON DELETE SET NULL,
      instrument_id INTEGER NOT NULL REFERENCES instrument_library(instrument_id),
      administration_date TEXT NOT NULL,
      administered_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      score_report_document_id INTEGER REFERENCES documents(document_id) ON DELETE SET NULL,
      raw_score REAL,
      standard_score REAL,
      percentile INTEGER,
      scaled_score REAL,
      t_score REAL,
      confidence_interval_lower REAL,
      confidence_interval_upper REAL,
      interpretation TEXT,
      notes TEXT,
      data_entry_method TEXT
        CHECK (data_entry_method IN ('manual', 'qglobal_import', 'pariconnect_import', 'pdf_extraction')),
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_test_administrations_case_id ON test_administrations(case_id);
    CREATE INDEX IF NOT EXISTS idx_test_administrations_instrument_id ON test_administrations(instrument_id);
    CREATE INDEX IF NOT EXISTS idx_test_administrations_administration_date ON test_administrations(administration_date);

    -- 13. Gate Reviews
    CREATE TABLE IF NOT EXISTS gate_reviews (
      gate_review_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      gate_number INTEGER NOT NULL CHECK (gate_number IN (1, 2, 3)),
      gate_purpose TEXT NOT NULL,
      reviewer_user_id INTEGER NOT NULL REFERENCES users(user_id),
      review_date TEXT NOT NULL DEFAULT (date('now')),
      review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (review_status IN ('pending', 'in_progress', 'completed', 'requires_revision')),
      notes TEXT,
      UNIQUE (case_id, gate_number)
    );
    CREATE INDEX IF NOT EXISTS idx_gate_reviews_case_id ON gate_reviews(case_id);
    CREATE INDEX IF NOT EXISTS idx_gate_reviews_gate_number ON gate_reviews(gate_number);
    CREATE INDEX IF NOT EXISTS idx_gate_reviews_review_status ON gate_reviews(review_status);

    -- 14. Gate Decisions
    CREATE TABLE IF NOT EXISTS gate_decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      gate_review_id INTEGER NOT NULL REFERENCES gate_reviews(gate_review_id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      decision_type TEXT NOT NULL
        CHECK (decision_type IN ('data_confirmed', 'diagnosis_selected', 'diagnosis_ruled_out', 'attestation', 'other')),
      subject_entity_type TEXT,
      subject_entity_id INTEGER,
      actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
      decision_rationale TEXT,
      decision_date TEXT NOT NULL DEFAULT (date('now')),
      is_final INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_gate_review_id ON gate_decisions(gate_review_id);
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_case_id ON gate_decisions(case_id);
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_decision_type ON gate_decisions(decision_type);
    CREATE INDEX IF NOT EXISTS idx_gate_decisions_actor_user_id ON gate_decisions(actor_user_id);

    -- 15. Diagnoses (CLINICIAN-SELECTED ONLY)
    CREATE TABLE IF NOT EXISTS diagnoses (
      diagnosis_record_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      diagnosis_id INTEGER NOT NULL REFERENCES diagnosis_catalog(diagnosis_id),
      selected_at_gate_2 INTEGER DEFAULT 1,
      clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      confidence_level TEXT CHECK (confidence_level IN ('high', 'moderate', 'low')),
      supporting_evidence TEXT,
      selection_date TEXT NOT NULL DEFAULT (date('now')),
      is_primary_diagnosis INTEGER DEFAULT 0,
      rule_out_rationale TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_diagnoses_case_id ON diagnoses(case_id);
    CREATE INDEX IF NOT EXISTS idx_diagnoses_diagnosis_id ON diagnoses(diagnosis_id);
    CREATE INDEX IF NOT EXISTS idx_diagnoses_clinician_user_id ON diagnoses(clinician_user_id);
    CREATE INDEX IF NOT EXISTS idx_diagnoses_selected_at_gate_2 ON diagnoses(selected_at_gate_2);

    -- 16. Agent Runs
    CREATE TABLE IF NOT EXISTS agent_runs (
      agent_run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      agent_type TEXT NOT NULL
        CHECK (agent_type IN ('diagnostician', 'writer', 'validator')),
      agent_version TEXT,
      input_hash TEXT,
      input_summary TEXT,
      output_hash TEXT,
      output_summary TEXT,
      duration_seconds REAL,
      status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'partial_success', 'failed', 'error')),
      error_message TEXT,
      invoked_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      started_at TEXT NOT NULL DEFAULT (date('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_runs_case_id ON agent_runs(case_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_type ON agent_runs(agent_type);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at);

    -- 17. Evidence Maps
    CREATE TABLE IF NOT EXISTS evidence_maps (
      evidence_map_id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_run_id INTEGER NOT NULL REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      diagnosis_id INTEGER NOT NULL REFERENCES diagnosis_catalog(diagnosis_id),
      criterion_name TEXT NOT NULL,
      criterion_description TEXT,
      supporting_evidence TEXT,
      contradicting_evidence TEXT,
      evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'moderate', 'weak', 'absent')),
      confidence_score REAL,
      source_documents TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_maps_agent_run_id ON evidence_maps(agent_run_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_maps_case_id ON evidence_maps(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_maps_diagnosis_id ON evidence_maps(diagnosis_id);

    -- 18. Writer Drafts
    CREATE TABLE IF NOT EXISTS writer_drafts (
      draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_run_id INTEGER NOT NULL REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      section_name TEXT NOT NULL,
      section_content TEXT NOT NULL,
      content_type TEXT NOT NULL
        CHECK (content_type IN ('fully_generated', 'draft_requiring_revision')),
      revision_status TEXT DEFAULT 'pending'
        CHECK (revision_status IN ('pending', 'reviewed', 'approved', 'revised')),
      reviewer_user_id INTEGER REFERENCES users(user_id),
      review_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now')),
      reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_writer_drafts_agent_run_id ON writer_drafts(agent_run_id);
    CREATE INDEX IF NOT EXISTS idx_writer_drafts_case_id ON writer_drafts(case_id);
    CREATE INDEX IF NOT EXISTS idx_writer_drafts_content_type ON writer_drafts(content_type);
    CREATE INDEX IF NOT EXISTS idx_writer_drafts_revision_status ON writer_drafts(revision_status);

    -- 19. Reports
    CREATE TABLE IF NOT EXISTS reports (
      report_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      report_version INTEGER NOT NULL DEFAULT 1,
      template_id INTEGER REFERENCES report_templates(template_id) ON DELETE SET NULL,
      generated_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      last_modified TEXT DEFAULT (date('now')),
      finalized_by_user_id INTEGER REFERENCES users(user_id),
      finalized_at TEXT,
      is_locked INTEGER DEFAULT 0,
      integrity_hash TEXT,
      sealed_pdf_path TEXT,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'in_review', 'revisions_needed', 'approved', 'finalized'))
    );
    CREATE INDEX IF NOT EXISTS idx_reports_case_id ON reports(case_id);
    CREATE INDEX IF NOT EXISTS idx_reports_report_version ON reports(report_version);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
    CREATE INDEX IF NOT EXISTS idx_reports_is_locked ON reports(is_locked);

    -- 20. Report Revisions
    CREATE TABLE IF NOT EXISTS report_revisions (
      revision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      changed_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      revision_date TEXT NOT NULL DEFAULT (date('now')),
      change_summary TEXT,
      previous_integrity_hash TEXT,
      new_integrity_hash TEXT,
      UNIQUE (report_id, revision_number)
    );
    CREATE INDEX IF NOT EXISTS idx_report_revisions_report_id ON report_revisions(report_id);
    CREATE INDEX IF NOT EXISTS idx_report_revisions_changed_by_user_id ON report_revisions(changed_by_user_id);

    -- 21. Audit Log
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      action_type TEXT NOT NULL
        CHECK (action_type IN (
          'case_created', 'case_modified', 'session_added', 'document_uploaded',
          'test_score_entered', 'diagnosis_selected', 'gate_completed',
          'agent_invoked', 'report_generated', 'report_finalized',
          'attestation_signed', 'audit_export'
        )),
      actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
      action_date TEXT NOT NULL DEFAULT (date('now')),
      details TEXT,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      granularity TEXT DEFAULT 'decision_record_only'
        CHECK (granularity IN ('decision_record_only', 'full_detail'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON audit_log(case_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action_date ON audit_log(action_date);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id ON audit_log(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);

    -- 22. Peer Consultations
    CREATE TABLE IF NOT EXISTS peer_consultations (
      consultation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      initiating_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      consulting_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      consultation_date TEXT NOT NULL DEFAULT (date('now')),
      consultation_topic TEXT,
      consultation_notes TEXT,
      consultation_response TEXT,
      response_date TEXT,
      CONSTRAINT different_clinicians CHECK (initiating_clinician_user_id != consulting_clinician_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_peer_consultations_case_id ON peer_consultations(case_id);
    CREATE INDEX IF NOT EXISTS idx_peer_consultations_initiating_clinician_user_id ON peer_consultations(initiating_clinician_user_id);
    CREATE INDEX IF NOT EXISTS idx_peer_consultations_consulting_clinician_user_id ON peer_consultations(consulting_clinician_user_id);

    -- 23. Referral Sources
    CREATE TABLE IF NOT EXISTS referral_sources (
      referral_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      referral_document_id INTEGER REFERENCES documents(document_id) ON DELETE SET NULL,
      referral_source_name TEXT NOT NULL,
      referral_source_type TEXT
        CHECK (referral_source_type IN ('attorney', 'court', 'medical', 'insurance', 'self_referred', 'other')),
      referral_date TEXT,
      evaluation_questions TEXT,
      specific_concerns TEXT,
      requesting_party TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_referral_sources_case_id ON referral_sources(case_id);
    CREATE INDEX IF NOT EXISTS idx_referral_sources_referral_source_type ON referral_sources(referral_source_type);

    -- 24. Backup Metadata
    CREATE TABLE IF NOT EXISTS backup_metadata (
      backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
      backup_date TEXT NOT NULL DEFAULT (date('now')),
      backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'export')),
      backup_path TEXT NOT NULL,
      case_count INTEGER,
      file_size_bytes INTEGER,
      integrity_hash TEXT,
      created_by_user_id INTEGER REFERENCES users(user_id),
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_backup_metadata_backup_date ON backup_metadata(backup_date);
    CREATE INDEX IF NOT EXISTS idx_backup_metadata_backup_type ON backup_metadata(backup_type);

    -- 25. Case Notes
    CREATE TABLE IF NOT EXISTS case_notes (
      case_note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(session_id) ON DELETE SET NULL,
      created_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      note_content TEXT NOT NULL,
      note_type TEXT
        CHECK (note_type IN ('clinical', 'administrative', 'diagnostic_reasoning', 'test_interpretation')),
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_notes_session_id ON case_notes(session_id);
    CREATE INDEX IF NOT EXISTS idx_case_notes_created_at ON case_notes(created_at);

    -- 26. Document Permissions (Addendum)
    CREATE TABLE IF NOT EXISTS document_permissions (
      permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      permission_level TEXT NOT NULL DEFAULT 'read'
        CHECK (permission_level IN ('read', 'write', 'admin')),
      granted_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      granted_at TEXT NOT NULL DEFAULT (date('now')),
      revoked_at TEXT,
      UNIQUE (document_id, user_id),
      CONSTRAINT valid_grantor CHECK (granted_by_user_id != user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_document_permissions_document_id ON document_permissions(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id ON document_permissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_document_permissions_permission_level ON document_permissions(permission_level);

    -- 27. File Locks (Addendum)
    CREATE TABLE IF NOT EXISTS file_locks (
      lock_id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE UNIQUE,
      locked_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      lock_type TEXT NOT NULL DEFAULT 'exclusive'
        CHECK (lock_type IN ('exclusive', 'shared')),
      acquired_at TEXT NOT NULL DEFAULT (date('now')),
      expires_at TEXT NOT NULL,
      released_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_file_locks_document_id ON file_locks(document_id);
    CREATE INDEX IF NOT EXISTS idx_file_locks_locked_by_user_id ON file_locks(locked_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_file_locks_expires_at ON file_locks(expires_at);

    -- 28. Sync Manifest (Addendum)
    CREATE TABLE IF NOT EXISTS sync_manifest (
      manifest_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE UNIQUE,
      last_sync_date TEXT,
      manifest_json TEXT,
      sync_direction TEXT NOT NULL DEFAULT 'bidirectional'
        CHECK (sync_direction IN ('upload', 'download', 'bidirectional')),
      sync_status TEXT NOT NULL DEFAULT 'synced'
        CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
      error_message TEXT,
      updated_at TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sync_manifest_case_id ON sync_manifest(case_id);
    CREATE INDEX IF NOT EXISTS idx_sync_manifest_sync_status ON sync_manifest(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_manifest_updated_at ON sync_manifest(updated_at);

    -- 29. Case Assignments (Addendum)
    CREATE TABLE IF NOT EXISTS case_assignments (
      assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      role_in_case TEXT NOT NULL
        CHECK (role_in_case IN ('primary_clinician', 'reviewing_clinician', 'psychometrist', 'receptionist')),
      assigned_by_user_id INTEGER NOT NULL REFERENCES users(user_id),
      assigned_at TEXT NOT NULL DEFAULT (date('now')),
      completed_at TEXT,
      UNIQUE (case_id, user_id, role_in_case)
    );
    CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id ON case_assignments(case_id);
    CREATE INDEX IF NOT EXISTS idx_case_assignments_user_id ON case_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_case_assignments_role_in_case ON case_assignments(role_in_case);
  `)
}

/**
 * Exported for use by connection.ts on app startup.
 * Creates base schema + FTS/views/triggers on a fresh database.
 */
export function runBaseMigration(sqlite: ReturnType<typeof import('better-sqlite3')>): void {
  createTablesFromSchema(sqlite)
  sqlite.exec(POST_MIGRATION_SQL)
}

/**
 * Re-apply views, FTS tables, and triggers. Safe to call repeatedly
 * because all statements use IF NOT EXISTS / IF NOT EXISTS patterns.
 * Called after incremental migrations to restore views that may have
 * been dropped during table recreation (e.g. migration 007).
 */
export function ensureViewsAndTriggers(sqlite: ReturnType<typeof import('better-sqlite3')>): void {
  sqlite.exec(POST_MIGRATION_SQL)
}

main().catch((err) => {
  console.error('[migrate] FATAL:', err)
  process.exit(1)
})
