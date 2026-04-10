/**
 * One-off cleanup: delete every case whose patient last name is "Thompson"
 * (case-insensitive). The user has already removed the corresponding folders
 * from the workspace; this script catches up the SQLCipher database.
 *
 * Usage:
 *   cd app && npx tsx src/main/db/delete-thompson.ts
 *
 * Safe to re-run. Logs every row it deletes. Honors --dry-run.
 */

import Database from 'better-sqlite3-multiple-ciphers'
import argon2 from 'argon2'
import { existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

// Electron's userData dir is named after the package.json `name` field,
// which is "psygil-app", not "Psygil". This caused the older
// reset-cases.ts script to look in the wrong place. Probe both for safety.
const CANDIDATE_DB_PATHS = [
  join(os.homedir(), 'Library', 'Application Support', 'psygil-app', 'psygil.db'),
  join(os.homedir(), 'Library', 'Application Support', 'Psygil', 'psygil.db'),
]
const ELECTRON_DB_PATH = CANDIDATE_DB_PATHS.find((p) => existsSync(p)) ?? CANDIDATE_DB_PATHS[0]

const DEV_PASSPHRASE = 'psygil-dev-key-2026'
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')

const DRY_RUN = process.argv.includes('--dry-run')

// Tables that reference case_id, in dependency order (children first).
// Anything not in this list is left alone.
const CHILD_TABLES = [
  'audit_log',
  'report_revisions',
  'reports',
  'writer_drafts',
  'diagnoses',
  'gate_reviews',
  'agent_runs',
  'test_administrations',
  'documents',
  'sessions',
  'patient_onboarding',
  'patient_intake',
] as const

interface CaseRow {
  case_id: number
  patient_first_name: string | null
  patient_last_name: string | null
}

async function main(): Promise<void> {
  if (!existsSync(ELECTRON_DB_PATH)) {
    console.error(`[delete-thompson] DB not found at ${ELECTRON_DB_PATH}`)
    process.exit(1)
  }

  console.log('[delete-thompson] deriving encryption key...')
  const keyBuffer = (await argon2.hash(DEV_PASSPHRASE, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })) as Buffer
  const hexKey = keyBuffer.toString('hex')

  const sqlite = new Database(ELECTRON_DB_PATH)
  sqlite.pragma("cipher='sqlcipher'")
  sqlite.pragma(`key="x'${hexKey}'"`)

  // Sanity check we can read the schema.
  const tableCount = (
    sqlite
      .prepare(
        "SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { n: number }
  ).n
  console.log(`[delete-thompson] DB opened. ${tableCount} tables.`)

  // Find Thompson cases via patient_intake (cases table doesn't carry the
  // patient name directly in this schema). LIKE is case-insensitive on
  // SQLite by default for ASCII.
  const thompsonCases = sqlite
    .prepare(
      `SELECT c.case_id,
              pi.first_name AS patient_first_name,
              pi.last_name  AS patient_last_name
         FROM cases c
    LEFT JOIN patient_intake pi ON pi.case_id = c.case_id
        WHERE LOWER(pi.last_name) = 'thompson'`,
    )
    .all() as CaseRow[]

  if (thompsonCases.length === 0) {
    console.log('[delete-thompson] No Thompson cases found. Nothing to do.')
    sqlite.close()
    return
  }

  console.log(`[delete-thompson] Found ${thompsonCases.length} Thompson case(s):`)
  for (const row of thompsonCases) {
    console.log(`  • case_id=${row.case_id}  ${row.patient_first_name ?? '?'} ${row.patient_last_name ?? '?'}`)
  }

  if (DRY_RUN) {
    console.log('[delete-thompson] --dry-run set; no changes made.')
    sqlite.close()
    return
  }

  const caseIds = thompsonCases.map((r) => r.case_id)
  const placeholders = caseIds.map(() => '?').join(',')

  sqlite.pragma('foreign_keys = OFF')
  const tx = sqlite.transaction(() => {
    for (const table of CHILD_TABLES) {
      try {
        const info = sqlite
          .prepare(`SELECT count(*) AS n FROM ${table} WHERE case_id IN (${placeholders})`)
          .get(...caseIds) as { n: number }
        if (info.n > 0) {
          sqlite
            .prepare(`DELETE FROM ${table} WHERE case_id IN (${placeholders})`)
            .run(...caseIds)
          console.log(`  ✓ ${table}: deleted ${info.n} row(s)`)
        }
      } catch (err) {
        console.log(`  ⚠ ${table}: ${(err as Error).message}`)
      }
    }
    const casesDeleted = sqlite
      .prepare(`DELETE FROM cases WHERE case_id IN (${placeholders})`)
      .run(...caseIds)
    console.log(`  ✓ cases: deleted ${casesDeleted.changes} row(s)`)
  })
  tx()
  sqlite.pragma('foreign_keys = ON')

  // Verify
  const remaining = sqlite
    .prepare(
      `SELECT count(*) AS n
         FROM cases c
         JOIN patient_intake pi ON pi.case_id = c.case_id
        WHERE LOWER(pi.last_name) = 'thompson'`,
    )
    .get() as { n: number }
  console.log(`[delete-thompson] Remaining Thompson cases: ${remaining.n}`)

  sqlite.close()
  console.log('[delete-thompson] Done. Relaunch the app to verify the UI is clean.')
}

main().catch((err) => {
  console.error('[delete-thompson] ERROR:', err)
  process.exit(1)
})
