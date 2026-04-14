#!/usr/bin/env node
/*
 * One-off cleanup: delete every case whose patient last name is "Thompson"
 * (case-insensitive).
 *
 * MUST be run via Electron's bundled Node so the native better-sqlite3
 * binding's ABI matches:
 *
 *   ELECTRON_RUN_AS_NODE=1 \
 *     ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron \
 *     scripts/delete-thompson.cjs [--dry-run]
 *
 * Plain CommonJS (no tsx, no TypeScript) so Electron's Node can require()
 * it directly.
 */

const Database = require('better-sqlite3-multiple-ciphers')
const argon2 = require('argon2')
const { existsSync } = require('fs')
const { join } = require('path')
const os = require('os')

const CANDIDATE_DB_PATHS = [
  join(os.homedir(), 'Library', 'Application Support', 'psygil-app', 'psygil.db'),
  join(os.homedir(), 'Library', 'Application Support', 'Psygil', 'psygil.db'),
]
const ELECTRON_DB_PATH = CANDIDATE_DB_PATHS.find((p) => existsSync(p)) || CANDIDATE_DB_PATHS[0]

const DEV_PASSPHRASE = 'psygil-dev-key-2026'
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')
const DRY_RUN = process.argv.includes('--dry-run')

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
]

async function main() {
  if (!existsSync(ELECTRON_DB_PATH)) {
    console.error(`[delete-thompson] DB not found at ${ELECTRON_DB_PATH}`)
    process.exit(1)
  }
  console.log(`[delete-thompson] DB: ${ELECTRON_DB_PATH}`)

  const keyBuffer = await argon2.hash(DEV_PASSPHRASE, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })
  const hexKey = keyBuffer.toString('hex')

  const sqlite = new Database(ELECTRON_DB_PATH)
  sqlite.pragma("cipher='sqlcipher'")
  sqlite.pragma(`key="x'${hexKey}'"`)

  const tableCount = sqlite
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .get().n
  console.log(`[delete-thompson] DB opened. ${tableCount} tables.`)

  const thompsonCases = sqlite
    .prepare(
      `SELECT case_id,
              examinee_first_name AS first_name,
              examinee_last_name  AS last_name
         FROM cases
        WHERE LOWER(examinee_last_name) = 'thompson'`,
    )
    .all()

  if (thompsonCases.length === 0) {
    console.log('[delete-thompson] No Thompson cases found. Nothing to do.')
    sqlite.close()
    return
  }

  console.log(`[delete-thompson] Found ${thompsonCases.length} Thompson case(s):`)
  for (const row of thompsonCases) {
    console.log(`  • case_id=${row.case_id}  ${row.first_name || '?'} ${row.last_name || '?'}`)
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
          .get(...caseIds)
        if (info.n > 0) {
          sqlite
            .prepare(`DELETE FROM ${table} WHERE case_id IN (${placeholders})`)
            .run(...caseIds)
          console.log(`  ✓ ${table}: deleted ${info.n} row(s)`)
        }
      } catch (err) {
        console.log(`  ⚠ ${table}: ${err.message}`)
      }
    }
    const result = sqlite
      .prepare(`DELETE FROM cases WHERE case_id IN (${placeholders})`)
      .run(...caseIds)
    console.log(`  ✓ cases: deleted ${result.changes} row(s)`)
  })
  tx()
  sqlite.pragma('foreign_keys = ON')

  const remaining = sqlite
    .prepare(
      `SELECT count(*) AS n FROM cases WHERE LOWER(examinee_last_name) = 'thompson'`,
    )
    .get().n
  console.log(`[delete-thompson] Remaining Thompson cases: ${remaining}`)

  sqlite.close()
  console.log('[delete-thompson] Done. Relaunch the app to verify.')
}

main().catch((err) => {
  console.error('[delete-thompson] ERROR:', err)
  process.exit(1)
})
