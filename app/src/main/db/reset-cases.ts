/**
 * RESET SCRIPT, Delete ALL cases and associated data from Psygil DB + filesystem.
 *
 * Usage: cd app && npx tsx src/main/db/reset-cases.ts
 *
 * This script:
 * 1. Connects to the SQLCipher database at ~/Library/Application Support/Psygil/psygil.db
 * 2. Deletes all rows from case-related tables
 * 3. Removes all case folders from the workspace directory
 *
 * ⚠️  DESTRUCTIVE, no undo. For development/testing only.
 */

import Database from 'better-sqlite3-multiple-ciphers'
import argon2 from 'argon2'
import { readdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

// ── Paths ──────────────────────────────────────────────────────────────
// macOS Electron userData path (where the app actually stores the DB)
const ELECTRON_DB_PATH = join(
  os.homedir(),
  'Library',
  'Application Support',
  'Psygil',
  'psygil.db',
)

// Config file (may contain custom workspace path)
const CONFIG_PATH = join(
  os.homedir(),
  'Library',
  'Application Support',
  'Psygil',
  'config.json',
)

// Known workspace paths
const WORKSPACE_PATHS = [
  join(os.homedir(), 'Documents', 'Psygil Cases'),
  join(os.homedir(), 'Documents', 'Psygil Cases (Demo)'),
]

// All tables that hold case-related data (order matters for FK constraints)
const CASE_TABLES = [
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
  'cases',
]

const DEV_PASSPHRASE = 'psygil-dev-key-2026'
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')

async function main() {
  // --- 0. Derive encryption key ---
  console.log('[reset] Deriving encryption key...')
  const keyBuffer = await argon2.hash(DEV_PASSPHRASE, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })
  const hexKey = (keyBuffer as Buffer).toString('hex')

  // --- 1. Open the database directly ---
  const dbPath = existsSync(ELECTRON_DB_PATH)
    ? ELECTRON_DB_PATH
    : join(process.cwd(), 'data', 'psygil.db')

  console.log(`[reset] Opening database: ${dbPath}`)
  if (!existsSync(dbPath)) {
    console.error('[reset] Database file not found!')
    process.exit(1)
  }

  const sqlite = new Database(dbPath)
  sqlite.pragma("cipher='sqlcipher'")
  sqlite.pragma(`key="x'${hexKey}'"`)

  // Verify we can read it
  const tableCount = (
    sqlite
      .prepare(
        "SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { n: number }
  ).n
  console.log(`[reset] Database opened. ${tableCount} tables found.`)

  // --- 2. Clear all case-related tables ---
  console.log('\n[reset] Clearing database tables...')
  sqlite.pragma('foreign_keys = OFF')

  for (const table of CASE_TABLES) {
    try {
      const info = sqlite.prepare(`SELECT count(*) as n FROM ${table}`).get() as { n: number }
      sqlite.prepare(`DELETE FROM ${table}`).run()
      console.log(`  ✓ ${table}: deleted ${info.n} rows`)
    } catch (err: any) {
      console.log(`  ⚠ ${table}: ${err.message}`)
    }
  }

  sqlite.pragma('foreign_keys = ON')

  // --- 3. Remove case folders from workspace ---
  console.log('\n[reset] Cleaning workspace folders...')

  // Check config.json for custom workspace path
  if (existsSync(CONFIG_PATH)) {
    try {
      const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      if (config.workspacePath && !WORKSPACE_PATHS.includes(config.workspacePath)) {
        WORKSPACE_PATHS.push(config.workspacePath)
        console.log(`  [config] Custom workspace: ${config.workspacePath}`)
      }
    } catch {
      // ignore parse errors
    }
  }

  for (const wsPath of WORKSPACE_PATHS) {
    if (!existsSync(wsPath)) {
      console.log(`  - ${wsPath} (not found, skipping)`)
      continue
    }

    const entries = readdirSync(wsPath, { withFileTypes: true })
    let removed = 0
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      // Skip workspace-level folders (_Inbox, _Templates, etc.)
      if (entry.name.startsWith('_')) continue

      const fullPath = join(wsPath, entry.name)
      rmSync(fullPath, { recursive: true, force: true })
      console.log(`  ✓ Removed: ${entry.name}`)
      removed++
    }
    console.log(`  [${wsPath}] Removed ${removed} case folders`)
  }

  sqlite.close()
  console.log('\n[reset] Done. All cases deleted. Relaunch the app to verify.\n')
}

main().catch((err) => {
  console.error('[reset] Error:', err)
  process.exit(1)
})
