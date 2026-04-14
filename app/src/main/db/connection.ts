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
 * Safe to call multiple times, only the first call has effect.
 */
export async function initDb(): Promise<void> {
  if (handle !== null) return
  const result = await initDatabase()
  handle = result

  // Create base schema if tables don't exist yet (fresh DB)
  const tableCount = (result.sqlite
    .prepare("SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .get() as { n: number }).n

  if (tableCount === 0) {
    // Fresh database, run the full base migration script
    const { runBaseMigration } = await import('./migrate')
    runBaseMigration(result.sqlite)
  }

  // Run incremental migrations (003+)
  runMigrations(result.sqlite)

  // Always re-run POST_MIGRATION_SQL to ensure views/FTS/triggers exist.
  // This is safe because all statements use IF NOT EXISTS.
  // Required after migrations that drop and recreate tables (e.g. 007).
  try {
    const { ensureViewsAndTriggers } = await import('./migrate')
    ensureViewsAndTriggers(result.sqlite)
  } catch {
    // Non-fatal, views are convenience, not required for core functionality
    console.warn('[db] Failed to ensure views/triggers (non-fatal)')
  }
}

/** Get the Drizzle ORM instance. Throws if initDb() hasn't been called. */
export function getDb(): PsygilDatabase {
  if (handle === null) throw new Error('Database not initialized, call initDb() first')
  return handle.db
}

/** Get the raw better-sqlite3 handle. Throws if initDb() hasn't been called. */
export function getSqlite(): InstanceType<typeof Database> {
  if (handle === null) throw new Error('Database not initialized, call initDb() first')
  return handle.sqlite
}
