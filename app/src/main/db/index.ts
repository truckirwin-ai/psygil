/**
 * SQLCipher database connection factory.
 * Opens an AES-256 encrypted SQLite database via better-sqlite3-multiple-ciphers,
 * derives the encryption key from a passphrase using Argon2id,
 * and returns a type-safe Drizzle ORM instance.
 */

// Imported by canonical name `better-sqlite3` so drizzle's adapter resolves
// the same module instance. The postinstall script (electron-rebuild-clean.js)
// installs a shim package at node_modules/better-sqlite3 that re-exports the
// SQLCipher fork `better-sqlite3-multiple-ciphers`. The shim is a real
// directory (not a symlink) so it survives electron-builder asar packaging.
import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import argon2 from 'argon2'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import * as schema from './schema'

export type PsygilDatabase = BetterSQLite3Database<typeof schema>

const DEV_PASSPHRASE = 'psygil-dev-key-2026'

// Fixed salt for dev key derivation. Production should use per-instance salts.
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')

/**
 * Derive a 32-byte (256-bit) encryption key from a passphrase using Argon2id.
 * Returns the key as a hex string (64 chars) for SQLCipher's raw key pragma.
 */
export async function deriveKey(passphrase: string): Promise<string> {
  const keyBuffer = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })
  return (keyBuffer as Buffer).toString('hex')
}

/**
 * Open an encrypted SQLCipher database and return a Drizzle ORM instance.
 *
 * @param dbPath - Absolute path to the .db file
 * @param hexKey - 64-char hex string (256-bit key) from deriveKey()
 * @returns { db, sqlite }, Drizzle instance and raw better-sqlite3 handle
 */
export function openDatabase(
  dbPath: string,
  hexKey: string,
): { db: PsygilDatabase; sqlite: InstanceType<typeof Database> } {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(dbPath)

  // Select SQLCipher cipher and set encryption key (raw hex format)
  sqlite.pragma("cipher='sqlcipher'")
  sqlite.pragma(`key="x'${hexKey}'"`)

  // Enable foreign key enforcement
  sqlite.pragma('foreign_keys = ON')

  // WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL')

  const db = drizzle(sqlite, { schema })

  return { db, sqlite }
}

/**
 * High-level: open the database with Argon2id key derivation from passphrase.
 */
export async function initDatabase(
  passphrase: string = DEV_PASSPHRASE,
  dbPath: string = getDefaultDbPath(),
): Promise<{ db: PsygilDatabase; sqlite: InstanceType<typeof Database> }> {
  const hexKey = await deriveKey(passphrase)
  return openDatabase(dbPath, hexKey)
}

/**
 * Get the default database path.
 *
 * Resolution order:
 *   1. If a setup config exists at userData/psygil-setup.json AND it has
 *      a configured storage.projectRoot, use {projectRoot}/.psygil/psygil.db
 *      (this is the doc 17 / doc 16 spec, the database lives inside
 *       the workspace so it travels with the case files).
 *   2. Otherwise, fall back to userData/psygil.db (legacy + first-launch
 *      before the wizard runs).
 *   3. Outside Electron (scripts/tests): cwd/data/psygil.db
 *
 * The renderer's setup:reset path also clears the legacy DB so users
 * who switch project roots get a clean slate.
 */
export function getDefaultDbPath(): string {
  try {
    // Dynamic require so this module works outside Electron too
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron')
    const userData: string = app.getPath('userData')

    // Try to read the setup config to find the configured project root.
    // We do this with a direct file read to avoid importing setup/state.ts
    // (which would create a cycle: db/index.ts → setup → db/connection → db/index.ts).
    const setupConfigPath = join(userData, 'psygil-setup.json')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs')
    if (fs.existsSync(setupConfigPath)) {
      try {
        const raw = fs.readFileSync(setupConfigPath, 'utf-8')
        const parsed = JSON.parse(raw) as {
          storage?: { projectRoot?: string } | null
        }
        const projectRoot = parsed.storage?.projectRoot
        if (typeof projectRoot === 'string' && projectRoot.length > 0) {
          return join(projectRoot, '.psygil', 'psygil.db')
        }
      } catch {
        // Fall through to legacy path
      }
    }
    return join(userData, 'psygil.db')
  } catch {
    return join(process.cwd(), 'data', 'psygil.db')
  }
}
