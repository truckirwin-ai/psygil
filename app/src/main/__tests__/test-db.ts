/**
 * In-memory test database setup for Psygil tests.
 * Uses sql.js (pure JavaScript SQLite) with a better-sqlite3 adapter.
 * Falls back to better-sqlite3 if available.
 */

let testDb: any = null
let sqlJs: any = null

/**
 * Initialize SQL.js asynchronously (done once during setup).
 */
async function initializeSqlJs(): Promise<void> {
  if (!sqlJs) {
    const mod = require('sql.js')
    sqlJs = await mod()
  }
}

/**
 * Get or create the in-memory test database with full schema applied.
 * WARNING: This is synchronous but sql.js requires async initialization.
 * The test setup file should call initializeTestDb() in a beforeAll hook instead.
 */
export function getTestDb(): any {
  if (!testDb) {
    testDb = createDatabase()
    createTestSchema(testDb)
  }
  return testDb
}

/**
 * Initialize the test database (call this in beforeAll hook).
 */
export async function initializeTestDb(): Promise<void> {
  await initializeSqlJs()
  if (!testDb) {
    testDb = createDatabase()
    createTestSchema(testDb)
  }
}

/**
 * Create a database instance - tries better-sqlite3 first, falls back to sql.js adapter.
 */
function createDatabase(): any {
  try {
    // Try to load the native better-sqlite3-multiple-ciphers
    const BetterSqlite3 = require('better-sqlite3-multiple-ciphers')
    console.log('[test-db] Using native better-sqlite3-multiple-ciphers')
    return new BetterSqlite3(':memory:')
  } catch (nativeErr) {
    // Fall back to sql.js with better-sqlite3 adapter
    if (!sqlJs) {
      throw new Error(
        'sql.js not initialized. Make sure to call initializeTestDb() in your test setup.'
      )
    }
    console.log('[test-db] Using sql.js with better-sqlite3 adapter')
    return createSqlJsAdapter(new sqlJs.Database())
  }
}

/**
 * Adapt sql.js API to look like better-sqlite3 for compatibility.
 */
function createSqlJsAdapter(sqlDatabase: any): any {
  let lastInsertId = 0

  return {
    prepare: (sql: string) => {
      return {
        run: function (...params: any[]) {
          try {
            const stmt = sqlDatabase.prepare(sql)
            stmt.bind(params)
            const hasResult = stmt.step()
            stmt.free()
            // Increment lastInsertId for each insert
            if (sql.toLowerCase().includes('insert')) {
              lastInsertId++
            }
            return { lastInsertRowid: lastInsertId, changes: 1 }
          } catch (err) {
            throw err
          }
        },
        get: function (...params: any[]) {
          try {
            const stmt = sqlDatabase.prepare(sql)
            stmt.bind(params)
            if (stmt.step()) {
              const result = stmt.getAsObject()
              stmt.free()
              return result
            }
            stmt.free()
            return null
          } catch (err) {
            return null
          }
        },
        all: function (...params: any[]) {
          try {
            const stmt = sqlDatabase.prepare(sql)
            stmt.bind(params)
            const results = []
            while (stmt.step()) {
              results.push(stmt.getAsObject())
            }
            stmt.free()
            return results
          } catch (err) {
            return []
          }
        },
      }
    },
    exec: (sql: string) => {
      try {
        // Split on ; and execute each statement
        const statements = sql.split(';').filter(s => s.trim().length > 0)
        for (const stmt of statements) {
          const trimmed = stmt.trim()
          // Skip PRAGMA statements for sql.js
          if (!trimmed.toLowerCase().startsWith('pragma')) {
            sqlDatabase.run(trimmed)
          }
        }
      } catch (err) {
        console.error('[test-db] exec error:', err)
      }
    },
    pragma: (statement: string) => {
      // Return mock pragma results (only table_info is used in tests)
      if (statement.toLowerCase().includes('table_info')) {
        const match = statement.match(/table_info\((\w+)\)/i)
        if (match) {
          // Return empty array - our tests don't depend on this
          return []
        }
      }
      return []
    },
    close: () => {
      try {
        sqlDatabase.close()
      } catch (err) {
        console.error('[test-db] close error:', err)
      }
    },
  }
}

/**
 * Reset the test database by deleting all data from all tables.
 */
export function resetTestDb(): void {
  if (!testDb) return

  testDb.exec('PRAGMA foreign_keys = OFF')

  const tables = testDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>

  for (const { name } of tables) {
    try {
      testDb.exec(`DELETE FROM ${name}`)
    } catch (err) {
      // Some tables may be views or virtual tables, skip them
    }
  }

  testDb.exec('PRAGMA foreign_keys = ON')
}

/**
 * Create the full Psygil schema in the test database.
 */
function createTestSchema(db: InstanceType<typeof import('better-sqlite3')>): void {
  db.exec(`
    -- 1. Practice Config
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
      updated_at TEXT DEFAULT (date('now'))
    );

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
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );

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
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );

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

    -- 9. Cases (6-stage pipeline)
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
      workflow_current_stage TEXT DEFAULT 'onboarding'
        CHECK (workflow_current_stage IN ('onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete')),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      last_modified TEXT DEFAULT (date('now')),
      completed_at TEXT,
      notes TEXT,
      folder_path TEXT,
      deleted_at TEXT,
      practice_id INTEGER REFERENCES practice_config(practice_id)
    );

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
      UNIQUE (case_id, session_number)
    );

    -- 11. Documents
    CREATE TABLE IF NOT EXISTS documents (
      document_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(session_id) ON DELETE SET NULL,
      document_type TEXT NOT NULL
        CHECK (document_type IN ('referral', 'pdf', 'docx', 'transcript_vtt', 'audio', 'score_report', 'test_score_report', 'test_battery', 'standardized_test', 'interview_notes', 'behavioral_observation', 'medical_record', 'other')),
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

    -- 15. Diagnoses
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

    -- 16. Agent Runs
    CREATE TABLE IF NOT EXISTS agent_runs (
      agent_run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      agent_type TEXT NOT NULL
        CHECK (agent_type IN ('diagnostician', 'writer', 'validator', 'ingestor', 'editor')),
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

    -- 17. Agent Results (new table for tracking agent execution results)
    CREATE TABLE IF NOT EXISTS agent_results (
      result_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      agent_run_id INTEGER REFERENCES agent_runs(agent_run_id) ON DELETE CASCADE,
      agent_type TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL DEFAULT (date('now'))
    );

    -- 18. Evidence Maps
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

    -- 19. Writer Drafts
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

    -- 20. Reports
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

    -- 21. Report Revisions
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

    -- 22. Audit Log
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      action_type TEXT NOT NULL,
      actor_user_id INTEGER NOT NULL REFERENCES users(user_id),
      action_date TEXT NOT NULL DEFAULT (date('now')),
      details TEXT,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      granularity TEXT DEFAULT 'decision_record_only'
        CHECK (granularity IN ('decision_record_only', 'full_detail'))
    );

    -- 23. Peer Consultations
    CREATE TABLE IF NOT EXISTS peer_consultations (
      consultation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      initiating_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      consulting_clinician_user_id INTEGER NOT NULL REFERENCES users(user_id),
      consultation_date TEXT NOT NULL DEFAULT (date('now')),
      consultation_topic TEXT,
      consultation_notes TEXT,
      consultation_response TEXT,
      response_date TEXT
    );

    -- 24. Patient Intake
    CREATE TABLE IF NOT EXISTS patient_intake (
      intake_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL UNIQUE REFERENCES cases(case_id) ON DELETE CASCADE,
      referral_type TEXT DEFAULT 'court',
      referral_source TEXT,
      eval_type TEXT,
      presenting_complaint TEXT,
      jurisdiction TEXT,
      charges TEXT,
      attorney_name TEXT,
      report_deadline TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      updated_at TEXT NOT NULL DEFAULT (date('now'))
    );

    -- 25. Patient Onboarding
    CREATE TABLE IF NOT EXISTS patient_onboarding (
      onboarding_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      section TEXT NOT NULL,
      content TEXT NOT NULL,
      clinician_notes TEXT,
      verified INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
      created_at TEXT NOT NULL DEFAULT (date('now')),
      updated_at TEXT NOT NULL DEFAULT (date('now')),
      UNIQUE (case_id, section)
    );

    -- 26. Data Confirmation
    CREATE TABLE IF NOT EXISTS data_confirmation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('unreviewed', 'confirmed', 'corrected', 'flagged')),
      notes TEXT DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, category_id)
    );

    -- 27. Diagnostic Decisions
    CREATE TABLE IF NOT EXISTS diagnostic_decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
      diagnosis_key TEXT NOT NULL,
      icd_code TEXT NOT NULL DEFAULT '',
      diagnosis_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('render', 'rule_out', 'defer')),
      clinician_notes TEXT NOT NULL DEFAULT '',
      decided_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, diagnosis_key)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_cases_primary_clinician_user_id ON cases(primary_clinician_user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_case_status ON cases(case_status);
    CREATE INDEX IF NOT EXISTS idx_cases_workflow_current_stage ON cases(workflow_current_stage);
    CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_case_id ON audit_log(case_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_case_id ON agent_runs(case_id);
    CREATE INDEX IF NOT EXISTS idx_agent_results_case_id ON agent_results(case_id);
    CREATE INDEX IF NOT EXISTS idx_data_confirmation_case_id ON data_confirmation(case_id);
    CREATE INDEX IF NOT EXISTS idx_diagnostic_decisions_case_id ON diagnostic_decisions(case_id);
  `)
}
