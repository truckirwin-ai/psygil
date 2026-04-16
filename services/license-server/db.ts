// =============================================================================
// db.ts, abstract storage layer for the Psygil license server
// =============================================================================
//
// Selects the backend at startup based on DATABASE_URL:
//   - Present: Postgres via `pg`. Three tables are auto-created on first use.
//   - Absent:  Falls back to the local licenses.json file (dev only).
//
// Tables (Postgres):
//   licenses(key, tier, seats, customer_id, issued_at, expires_at, revoked_at)
//   customers(id, email, name, created_at)
//   audit_log(id, license_key, ip, timestamp, result, error_code)
// =============================================================================

import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type Tier = 'solo' | 'practice' | 'enterprise'

export interface License {
  readonly key: string
  readonly tier: Tier
  readonly seats: number
  readonly customer_id: string | null
  readonly issued_at: string
  readonly expires_at: string | null
  /** ISO 8601 timestamp if revoked, null if active */
  readonly revoked_at: string | null
}

export interface Customer {
  readonly id: string
  readonly email: string
  readonly name: string
  readonly created_at: string
}

export interface AuditEntry {
  readonly id: string
  readonly license_key: string
  readonly ip: string
  readonly timestamp: string
  readonly result: 'ok' | 'fail'
  readonly error_code: string | null
}

export interface LicenseFilters {
  readonly customer_id?: string
  readonly tier?: Tier
  readonly page?: number
  readonly limit?: number
}

export interface PagedLicenses {
  readonly licenses: readonly License[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

// ---------------------------------------------------------------------------
// JSON file backend (dev fallback)
// ---------------------------------------------------------------------------

function defaultJsonPath(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    return join(here, 'licenses.json')
  } catch {
    return join(process.cwd(), 'services', 'license-server', 'licenses.json')
  }
}

interface JsonDatabase {
  licenses: License[]
  customers: Customer[]
  audit_log: AuditEntry[]
}

// Legacy format used by the original server.ts
interface LegacyRecord {
  readonly key: string
  readonly tier: Tier
  readonly seats: number
  readonly expiresAt: string | null
  readonly revoked: boolean
  readonly notes: string
}

interface LegacyDatabase {
  readonly licenses: readonly LegacyRecord[]
}

function loadJsonDb(path: string): JsonDatabase {
  if (!existsSync(path)) {
    const empty: JsonDatabase = { licenses: [], customers: [], audit_log: [] }
    writeFileSync(path, JSON.stringify(empty, null, 2), 'utf-8')
    return empty
  }
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>

    // Migrate from legacy format that only has LicenseRecord[]
    if (Array.isArray(parsed['licenses']) && parsed['licenses'].length > 0) {
      const first = parsed['licenses'][0] as Record<string, unknown>
      if ('revoked' in first && !('revoked_at' in first)) {
        const legacy = parsed as unknown as LegacyDatabase
        const migrated: JsonDatabase = {
          licenses: legacy.licenses.map(
            (r): License => ({
              key: r.key,
              tier: r.tier,
              seats: r.seats,
              customer_id: null,
              issued_at: new Date().toISOString(),
              expires_at: r.expiresAt ?? null,
              revoked_at: r.revoked ? new Date(0).toISOString() : null,
            }),
          ),
          customers: [],
          audit_log: [],
        }
        return migrated
      }
    }

    const db = parsed as unknown as JsonDatabase
    return {
      licenses: Array.isArray(db.licenses) ? db.licenses : [],
      customers: Array.isArray(db.customers) ? db.customers : [],
      audit_log: Array.isArray(db.audit_log) ? db.audit_log : [],
    }
  } catch (err) {
    process.stderr.write(`[license-server/db] Failed to parse JSON db: ${String(err)}\n`)
    return { licenses: [], customers: [], audit_log: [] }
  }
}

function saveJsonDb(path: string, db: JsonDatabase): void {
  try {
    writeFileSync(path, JSON.stringify(db, null, 2), 'utf-8')
  } catch (err) {
    process.stderr.write(`[license-server/db] Failed to write JSON db: ${String(err)}\n`)
  }
}

// ---------------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------------

let pgPool: import('pg').Pool | null = null

async function getPool(): Promise<import('pg').Pool> {
  if (pgPool !== null) return pgPool
  const { Pool } = await import('pg')
  pgPool = new Pool({ connectionString: process.env['DATABASE_URL'] })
  await initSchema(pgPool)
  return pgPool
}

async function initSchema(pool: import('pg').Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS licenses (
      key         TEXT PRIMARY KEY,
      tier        TEXT NOT NULL,
      seats       INTEGER NOT NULL DEFAULT 1,
      customer_id TEXT REFERENCES customers(id),
      issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at  TIMESTAMPTZ,
      revoked_at  TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id          TEXT PRIMARY KEY,
      license_key TEXT NOT NULL,
      ip          TEXT NOT NULL,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
      result      TEXT NOT NULL,
      error_code  TEXT
    );
  `)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function isPostgres(): boolean {
  return typeof process.env['DATABASE_URL'] === 'string' && process.env['DATABASE_URL'].length > 0
}

export async function loadLicense(key: string): Promise<License | null> {
  if (isPostgres()) {
    const pool = await getPool()
    const result = await pool.query<License>(
      'SELECT key, tier, seats, customer_id, issued_at::text, expires_at::text, revoked_at::text FROM licenses WHERE key = $1',
      [key],
    )
    return result.rows[0] ?? null
  }
  const db = loadJsonDb(defaultJsonPath())
  return db.licenses.find((l) => l.key === key) ?? null
}

export async function saveLicense(license: License): Promise<void> {
  if (isPostgres()) {
    const pool = await getPool()
    await pool.query(
      `INSERT INTO licenses (key, tier, seats, customer_id, issued_at, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz)
       ON CONFLICT (key) DO UPDATE
         SET tier = EXCLUDED.tier,
             seats = EXCLUDED.seats,
             customer_id = EXCLUDED.customer_id,
             expires_at = EXCLUDED.expires_at,
             revoked_at = EXCLUDED.revoked_at`,
      [
        license.key,
        license.tier,
        license.seats,
        license.customer_id,
        license.issued_at,
        license.expires_at,
        license.revoked_at,
      ],
    )
    return
  }
  const path = defaultJsonPath()
  const db = loadJsonDb(path)
  const idx = db.licenses.findIndex((l) => l.key === license.key)
  const updated =
    idx >= 0
      ? db.licenses.map((l, i) => (i === idx ? license : l))
      : [...db.licenses, license]
  saveJsonDb(path, { ...db, licenses: updated })
}

export async function revokeLicense(key: string): Promise<boolean> {
  const revokedAt = new Date().toISOString()
  if (isPostgres()) {
    const pool = await getPool()
    const result = await pool.query(
      'UPDATE licenses SET revoked_at = $1::timestamptz WHERE key = $2 AND revoked_at IS NULL',
      [revokedAt, key],
    )
    return (result.rowCount ?? 0) > 0
  }
  const path = defaultJsonPath()
  const db = loadJsonDb(path)
  let found = false
  const updated = db.licenses.map((l) => {
    if (l.key === key && l.revoked_at === null) {
      found = true
      return { ...l, revoked_at: revokedAt }
    }
    return l
  })
  if (found) saveJsonDb(path, { ...db, licenses: updated })
  return found
}

export async function listLicenses(filters: LicenseFilters): Promise<PagedLicenses> {
  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20))
  const offset = (page - 1) * limit

  if (isPostgres()) {
    const pool = await getPool()
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (filters.customer_id !== undefined) {
      conditions.push(`customer_id = $${paramIdx}`)
      params.push(filters.customer_id)
      paramIdx++
    }
    if (filters.tier !== undefined) {
      conditions.push(`tier = $${paramIdx}`)
      params.push(filters.tier)
      paramIdx++
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM licenses ${where}`,
      params,
    )
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10)

    params.push(limit, offset)
    const rows = await pool.query<License>(
      `SELECT key, tier, seats, customer_id, issued_at::text, expires_at::text, revoked_at::text
       FROM licenses ${where} ORDER BY issued_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params,
    )

    return { licenses: rows.rows, total, page, limit }
  }

  const db = loadJsonDb(defaultJsonPath())
  let licenses = db.licenses as License[]
  if (filters.customer_id !== undefined) {
    licenses = licenses.filter((l) => l.customer_id === filters.customer_id)
  }
  if (filters.tier !== undefined) {
    licenses = licenses.filter((l) => l.tier === filters.tier)
  }
  const total = licenses.length
  const paged = licenses.slice(offset, offset + limit)
  return { licenses: paged, total, page, limit }
}

export async function createCustomer(
  email: string,
  name: string,
): Promise<Customer> {
  const customer: Customer = {
    id: randomUUID(),
    email,
    name,
    created_at: new Date().toISOString(),
  }

  if (isPostgres()) {
    const pool = await getPool()
    await pool.query(
      'INSERT INTO customers (id, email, name, created_at) VALUES ($1, $2, $3, $4::timestamptz)',
      [customer.id, customer.email, customer.name, customer.created_at],
    )
    return customer
  }

  const path = defaultJsonPath()
  const db = loadJsonDb(path)
  saveJsonDb(path, { ...db, customers: [...db.customers, customer] })
  return customer
}

export async function appendAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const full: AuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  }

  if (isPostgres()) {
    const pool = await getPool()
    await pool.query(
      'INSERT INTO audit_log (id, license_key, ip, timestamp, result, error_code) VALUES ($1, $2, $3, $4::timestamptz, $5, $6)',
      [full.id, full.license_key, full.ip, full.timestamp, full.result, full.error_code],
    )
    return
  }

  const path = defaultJsonPath()
  const db = loadJsonDb(path)
  saveJsonDb(path, { ...db, audit_log: [...db.audit_log, full] })
}
