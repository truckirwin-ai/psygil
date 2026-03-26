/**
 * Singleton database connection for the Psygil main process.
 * Call initDb() once at app startup; use getDb() / getSqlite() everywhere else.
 */

import type Database from 'better-sqlite3'
import { initDatabase, type PsygilDatabase } from './index'
import { runMigrations } from './migrations'

interface DbHandle {
  readonly db: PsygilDatabase
  readonly sqlite: InstanceType<typeof Database>
}

let handle: DbHandle | null = null

/**
 * Initialize the encrypted database and run any pending migrations.
 * Safe to call multiple times — only the first call has effect.
 */
export async function initDb(): Promise<void> {
  if (handle !== null) return
  const result = await initDatabase()
  handle = result
  runMigrations(result.sqlite)
}

/** Get the Drizzle ORM instance. Throws if initDb() hasn't been called. */
export function getDb(): PsygilDatabase {
  if (handle === null) throw new Error('Database not initialized — call initDb() first')
  return handle.db
}

/** Get the raw better-sqlite3 handle. Throws if initDb() hasn't been called. */
export function getSqlite(): InstanceType<typeof Database> {
  if (handle === null) throw new Error('Database not initialized — call initDb() first')
  return handle.sqlite
}
