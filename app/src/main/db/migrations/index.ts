/**
 * Incremental migrations applied via raw SQL on the better-sqlite3 handle.
 * Each migration runs inside a transaction and is tracked in a _migrations table.
 *
 * Convention: add new migrations to the MIGRATIONS array in order.
 * They are idempotent — already-applied migrations are skipped.
 */

import type Database from 'better-sqlite3'

interface Migration {
  readonly id: string
  readonly description: string
  readonly sql: string
}

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

    console.log(`[migrations] Applying: ${migration.id} — ${migration.description}`)
    const tx = sqlite.transaction(() => {
      sqlite.exec(migration.sql)
      sqlite.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(
        migration.id,
        migration.description,
      )
    })
    tx()
    console.log(`[migrations] Applied: ${migration.id}`)
  }
}
