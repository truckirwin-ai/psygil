/**
 * Incremental migrations applied via raw SQL on the better-sqlite3 handle.
 * Each migration runs inside a transaction and is tracked in a _migrations table.
 *
 * Convention: add new migrations to the MIGRATIONS array in order.
 * They are idempotent, already-applied migrations are skipped.
 */

import type Database from 'better-sqlite3'

interface Migration {
  readonly id: string
  readonly description: string
  readonly sql: string
}

// Stage + metadata for the 30 prototype cases
const PROTOTYPE_CASE_UPDATES = [
  { num:'2026-0147', stage:'gate_3', status:'in_progress', eval_type:'CST',        referral:'Court',     deadline:'2026-04-15', charges:'Assault 1st (F3), Criminal Mischief (M1)',       jurisdiction:'Denver District Court' },
  { num:'2026-0152', stage:'gate_1', status:'in_progress', eval_type:'Custody',    referral:'Attorney',  deadline:'2026-04-20', charges:null,                                              jurisdiction:'Arapahoe County' },
  { num:'2026-0158', stage:'gate_3', status:'in_progress', eval_type:'Risk',       referral:'Court',     deadline:'2026-04-01', charges:'Stalking (F5), Menacing (M1)',                    jurisdiction:'Jefferson County' },
  { num:'2026-0161', stage:'finalized', status:'completed', eval_type:'PTSD Dx',   referral:'Attorney',  deadline:'2026-04-10', charges:null,                                              jurisdiction:null },
  { num:'2026-0165', stage:'gate_1', status:'in_progress', eval_type:'ADHD Dx',    referral:'Physician', deadline:'2026-04-25', charges:null,                                              jurisdiction:null },
  { num:'2025-0989', stage:'finalized', status:'completed', eval_type:'Malingering',referral:'Court',    deadline:'2026-03-20', charges:'Fraud (F4)',                                      jurisdiction:'Adams County' },
  { num:'2025-0988', stage:'finalized', status:'completed', eval_type:'Fitness',   referral:'Court',     deadline:'2026-03-15', charges:'Theft (M1)',                                      jurisdiction:'Boulder County' },
  { num:'2025-0987', stage:'finalized', status:'completed', eval_type:'Capacity',  referral:'Attorney',  deadline:'2026-02-28', charges:null,                                              jurisdiction:'El Paso County' },
  { num:'2026-0170', stage:'gate_1', status:'intake',      eval_type:'CST',        referral:'Court',     deadline:'2026-05-01', charges:'Murder 2nd (F2)',                                 jurisdiction:'Denver District Court' },
  { num:'2026-0171', stage:'gate_2', status:'in_progress', eval_type:'CST',        referral:'Court',     deadline:'2026-04-28', charges:'Arson 1st (F3)',                                  jurisdiction:'Arapahoe County' },
  { num:'2026-0172', stage:'finalized', status:'completed', eval_type:'Risk',      referral:'Court',     deadline:'2026-03-15', charges:'Sexual Assault (F3)',                             jurisdiction:'Denver District Court' },
  { num:'2026-0173', stage:'gate_3', status:'in_progress', eval_type:'CST',        referral:'Court',     deadline:'2026-04-12', charges:'Robbery (F4), Assault 3rd (M1)',                  jurisdiction:'Adams County' },
  { num:'2026-0174', stage:'gate_2', status:'in_progress', eval_type:'Custody',    referral:'Court',     deadline:'2026-05-10', charges:null,                                              jurisdiction:'Jefferson County Family Court' },
  { num:'2026-0175', stage:'gate_3', status:'in_progress', eval_type:'PTSD Dx',    referral:'Attorney',  deadline:'2026-04-05', charges:null,                                              jurisdiction:null },
  { num:'2026-0176', stage:'finalized', status:'completed', eval_type:'Malingering',referral:'Insurance',deadline:'2026-03-28', charges:null,                                              jurisdiction:null },
  { num:'2026-0177', stage:'finalized', status:'completed', eval_type:'CST',       referral:'Court',     deadline:'2026-03-10', charges:'Assault 2nd (F4)',                                jurisdiction:'Denver District Court' },
  { num:'2026-0178', stage:'gate_3', status:'in_progress', eval_type:'Capacity',   referral:'Attorney',  deadline:'2026-04-18', charges:null,                                              jurisdiction:'Douglas County Probate' },
  { num:'2026-0179', stage:'gate_1', status:'in_progress', eval_type:'Risk',       referral:'Court',     deadline:'2026-05-05', charges:'Menacing (F5), Harassment (M3)',                  jurisdiction:'Denver District Court' },
  { num:'2026-0180', stage:'finalized', status:'completed', eval_type:'CST',       referral:'Court',     deadline:'2026-03-25', charges:'DUI (M1), Eluding (F5)',                          jurisdiction:'Adams County' },
  { num:'2026-0181', stage:'gate_3', status:'in_progress', eval_type:'Fitness',    referral:'Court',     deadline:'2026-04-08', charges:'Forgery (F5)',                                    jurisdiction:'Boulder County' },
  { num:'2026-0182', stage:'finalized', status:'completed', eval_type:'PTSD Dx',   referral:'Attorney',  deadline:'2026-03-22', charges:null,                                              jurisdiction:null },
  { num:'2026-0183', stage:'gate_1', status:'intake',      eval_type:'CST',        referral:'Court',     deadline:'2026-05-12', charges:'Assault 1st (F3), Kidnapping (F2)',               jurisdiction:'Denver District Court' },
  { num:'2026-0184', stage:'gate_3', status:'in_progress', eval_type:'Custody',    referral:'Court',     deadline:'2026-04-15', charges:null,                                              jurisdiction:'El Paso County Family Court' },
  { num:'2026-0185', stage:'finalized', status:'completed', eval_type:'Risk',      referral:'Court',     deadline:'2026-03-05', charges:'Domestic Violence (F4)',                          jurisdiction:'Arapahoe County' },
  { num:'2026-0186', stage:'finalized', status:'completed', eval_type:'ADHD Dx',   referral:'Physician', deadline:'2026-03-30', charges:null,                                              jurisdiction:null },
  { num:'2026-0187', stage:'gate_2', status:'in_progress', eval_type:'CST',        referral:'Court',     deadline:'2026-05-08', charges:'Criminal Mischief (F4), Trespass (M3)',           jurisdiction:'Jefferson County' },
  { num:'2026-0188', stage:'gate_3', status:'in_progress', eval_type:'Malingering',referral:'Court',     deadline:'2026-04-02', charges:'Theft (F4)',                                      jurisdiction:'Denver District Court' },
  { num:'2026-0189', stage:'gate_1', status:'intake',      eval_type:'Risk',       referral:'Court',     deadline:'2026-05-15', charges:'Harassment (M1), Stalking (M1)',                  jurisdiction:'Adams County' },
  { num:'2026-0190', stage:'finalized', status:'completed', eval_type:'Fitness',   referral:'Court',     deadline:'2026-03-18', charges:'DUI (M1)',                                        jurisdiction:'Weld County' },
  { num:'2026-0191', stage:'gate_3', status:'in_progress', eval_type:'CST',        referral:'Court',     deadline:'2026-04-08', charges:'Assault 2nd (F4), Resisting Arrest (M2)',         jurisdiction:'Denver District Court' },
] as const

const MIGRATIONS: readonly Migration[] = [
  {
    id: '003_case_folder_path',
    description: 'Add folder_path column to cases table',
    sql: `ALTER TABLE cases ADD COLUMN folder_path TEXT;`,
  },
  {
    id: '004_patient_intake',
    description: 'Create patient_intake table for referral/intake data',
    sql: `
      CREATE TABLE IF NOT EXISTS patient_intake (
        intake_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        referral_type TEXT NOT NULL DEFAULT 'court'
          CHECK (referral_type IN ('court', 'attorney', 'self', 'walk-in')),
        referral_source TEXT,
        eval_type TEXT,
        presenting_complaint TEXT,
        jurisdiction TEXT,
        charges TEXT,
        attorney_name TEXT,
        report_deadline TEXT,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'complete')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (case_id)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_intake_case_id ON patient_intake(case_id);
      CREATE INDEX IF NOT EXISTS idx_patient_intake_status ON patient_intake(status);

      CREATE TRIGGER IF NOT EXISTS tr_patient_intake_updated_at
      AFTER UPDATE ON patient_intake
      FOR EACH ROW
      BEGIN
        UPDATE patient_intake SET updated_at = datetime('now') WHERE intake_id = NEW.intake_id;
      END;
    `,
  },
  {
    id: '005_patient_onboarding',
    description: 'Create patient_onboarding table for section-based onboarding data',
    sql: `
      CREATE TABLE IF NOT EXISTS patient_onboarding (
        onboarding_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
        section TEXT NOT NULL
          CHECK (section IN (
            'contact', 'complaints', 'family', 'education',
            'health', 'mental', 'substance', 'legal', 'recent'
          )),
        content TEXT NOT NULL DEFAULT '{}',
        clinician_notes TEXT,
        verified INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'complete')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (case_id, section)
      );
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_case_id ON patient_onboarding(case_id);
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_section ON patient_onboarding(section);
      CREATE INDEX IF NOT EXISTS idx_patient_onboarding_status ON patient_onboarding(status);

      CREATE TRIGGER IF NOT EXISTS tr_patient_onboarding_updated_at
      AFTER UPDATE ON patient_onboarding
      FOR EACH ROW
      BEGIN
        UPDATE patient_onboarding SET updated_at = datetime('now') WHERE onboarding_id = NEW.onboarding_id;
      END;
    `,
  },
  {
    id: '006_update_prototype_case_stages',
    description: 'Update synced prototype cases with correct stages, eval types, and metadata',
    sql: 'SELECT 1', // placeholder, real logic runs in runMigrations below
  },
  {
    id: '007_six_stage_pipeline',
    description: 'Migrate workflow_current_stage from gate system to 6-stage pipeline',
    sql: 'SELECT 1', // placeholder, real logic runs in runMigrations below
  },
  {
    id: '008_expand_intake_referral_types',
    description: 'Add insurance and physician referral types to patient_intake',
    sql: 'SELECT 1', // placeholder, recreates table with expanded CHECK
  },
]

/**
 * Run all pending migrations. Creates the _migrations tracking table if needed.
 * Each migration runs in its own transaction for safety.
 */
export function runMigrations(sqlite: InstanceType<typeof Database>): void {
  // Ensure tracking table exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    (sqlite.prepare('SELECT id FROM _migrations').all() as Array<{ id: string }>)
      .map((r) => r.id)
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue

    console.log(`[migrations] Applying: ${migration.id}, ${migration.description}`)
    const tx = sqlite.transaction(() => {
      if (migration.id === '007_six_stage_pipeline') {
        // SQLite doesn't support ALTER COLUMN, so we recreate the table with updated CHECK.
        // NOTE: We cannot UPDATE the old table first because the old CHECK constraint
        // rejects the new stage names. Instead we map values inline during INSERT.

        // Step 0: Drop ALL views that reference the cases table.
        // POST_MIGRATION_SQL in migrate.ts will recreate them after migrations complete.
        sqlite.exec(`
          DROP VIEW IF EXISTS v_active_cases;
          DROP VIEW IF EXISTS v_case_progress;
          DROP VIEW IF EXISTS v_diagnostic_queue;
          DROP VIEW IF EXISTS v_finalization_queue;
          DROP VIEW IF EXISTS v_user_case_assignments;
          DROP VIEW IF EXISTS v_active_file_locks;
          DROP VIEW IF EXISTS v_case_sync_status;
        `)

        // Step 1: Get current column list
        const cols = (sqlite.pragma('table_info(cases)') as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>)
        const colNames = cols.map(c => c.name)

        // Clean up any leftover from a previously failed attempt
        try { sqlite.exec('DROP TABLE IF EXISTS cases_new;') } catch { /* ignore */ }

        // Step 2: Create new table with 6-stage CHECK constraint
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS cases_new (
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
        `)

        // Step 3: Copy data with inline stage mapping (old CHECK → new CHECK)
        const newCols = (sqlite.pragma('table_info(cases_new)') as Array<{ name: string }>).map(c => c.name)
        const sharedCols = colNames.filter(c => newCols.includes(c))

        // Build SELECT list: map workflow_current_stage inline, pass other columns through
        const selectExprs = sharedCols.map(col => {
          if (col === 'workflow_current_stage') {
            return `CASE workflow_current_stage
              WHEN 'gate_1' THEN 'onboarding'
              WHEN 'gate_2' THEN 'interview'
              WHEN 'gate_3' THEN 'review'
              WHEN 'finalized' THEN 'complete'
              ELSE COALESCE(workflow_current_stage, 'onboarding')
            END AS workflow_current_stage`
          }
          return col
        })

        const insertCols = sharedCols.join(', ')
        const selectList = selectExprs.join(', ')

        sqlite.exec(`INSERT INTO cases_new (${insertCols}) SELECT ${selectList} FROM cases;`)
        sqlite.exec(`DROP TABLE cases;`)
        sqlite.exec(`ALTER TABLE cases_new RENAME TO cases;`)

        // Recreate indexes
        sqlite.exec(`
          CREATE INDEX IF NOT EXISTS idx_cases_primary_clinician_user_id ON cases(primary_clinician_user_id);
          CREATE INDEX IF NOT EXISTS idx_cases_case_status ON cases(case_status);
          CREATE INDEX IF NOT EXISTS idx_cases_workflow_current_stage ON cases(workflow_current_stage);
          CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
          CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
        `)

        // Step 4: Ensure data_confirmation table exists (was previously created at
        // runtime by ensureTable() but the seeder needs it during DB init)
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS data_confirmation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id INTEGER NOT NULL REFERENCES cases(case_id),
            category_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('unreviewed', 'confirmed', 'corrected', 'flagged')),
            notes TEXT DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(case_id, category_id)
          );
          CREATE INDEX IF NOT EXISTS idx_data_confirmation_case_id ON data_confirmation(case_id);
        `)

        console.log('[migrations] Migrated workflow_current_stage to 6-stage pipeline')
      } else if (migration.id === '006_update_prototype_case_stages') {
        // Update each prototype case with correct stage, eval_type, referral_source, and charges
        const cols = (sqlite.pragma('table_info(cases)') as Array<{ name: string }>).map((c) => c.name)
        const hasCharges = cols.includes('charges')
        const hasJurisdiction = cols.includes('jurisdiction')
        const hasEvalType = cols.includes('evaluation_type')

        for (const c of PROTOTYPE_CASE_UPDATES) {
          let sql = `UPDATE cases SET workflow_current_stage = ?, case_status = ?, referral_source = ?`
          const params: (string | null)[] = [c.stage, c.status, c.referral]

          if (hasEvalType) { sql += `, evaluation_type = ?`; params.push(c.eval_type) }
          if (hasCharges)  { sql += `, charges = ?`;          params.push(c.charges ?? null) }
          if (hasJurisdiction) { sql += `, jurisdiction = ?`; params.push(c.jurisdiction ?? null) }

          sql += ` WHERE case_number = ?`
          params.push(c.num)
          sqlite.prepare(sql).run(...params)
        }
      } else if (migration.id === '008_expand_intake_referral_types') {
        // Recreate patient_intake with expanded referral_type CHECK
        // to include 'insurance' and 'physician'
        const intakeCols = (sqlite.pragma('table_info(patient_intake)') as Array<{ name: string }>).map(c => c.name)
        if (intakeCols.length > 0) {
          try { sqlite.exec('DROP TABLE IF EXISTS patient_intake_new;') } catch { /* ignore */ }
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS patient_intake_new (
              intake_id INTEGER PRIMARY KEY AUTOINCREMENT,
              case_id INTEGER NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
              referral_type TEXT NOT NULL DEFAULT 'court'
                CHECK (referral_type IN ('court', 'attorney', 'self', 'walk-in', 'insurance', 'physician')),
              referral_source TEXT,
              eval_type TEXT,
              presenting_complaint TEXT,
              jurisdiction TEXT,
              charges TEXT,
              attorney_name TEXT,
              report_deadline TEXT,
              status TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'complete')),
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE (case_id)
            );
            INSERT INTO patient_intake_new SELECT * FROM patient_intake;
            DROP TABLE patient_intake;
            ALTER TABLE patient_intake_new RENAME TO patient_intake;
            CREATE INDEX IF NOT EXISTS idx_patient_intake_case_id ON patient_intake(case_id);
            CREATE INDEX IF NOT EXISTS idx_patient_intake_status ON patient_intake(status);
          `)
          console.log('[migrations] Expanded patient_intake referral types')
        }
      } else {
        sqlite.exec(migration.sql)
      }
      sqlite.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(
        migration.id,
        migration.description,
      )
    })
    tx()
    console.log(`[migrations] Applied: ${migration.id}`)
  }
}
