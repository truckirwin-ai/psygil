/**
 * SQLCipher database connection factory.
 * Opens an AES-256 encrypted SQLite database via better-sqlite3-multiple-ciphers,
 * derives the encryption key from a passphrase using Argon2id,
 * and returns a type-safe Drizzle ORM instance.
 */

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
 * @returns { db, sqlite } — Drizzle instance and raw better-sqlite3 handle
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
 * In Electron: app.getPath('userData')/psygil.db
 * Outside Electron (scripts/tests): cwd/data/psygil.db
 */
export function getDefaultDbPath(): string {
  try {
    // Dynamic require so this module works outside Electron too
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron')
    return join(app.getPath('userData'), 'psygil.db')
  } catch {
    return join(process.cwd(), 'data', 'psygil.db')
  }
}
