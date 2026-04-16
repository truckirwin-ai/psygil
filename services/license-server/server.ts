// =============================================================================
// Psygil License Server
// =============================================================================
//
// HTTP service implementing the contract consumed by:
//   app/src/main/setup/license.ts  validateRemote()
//
// Public endpoints:
//   POST /v1/licenses/validate  -- key validation (audit-logged)
//   GET  /health                -- uptime monitor
//   GET  /healthz               -- legacy alias
//
// Admin endpoints (gated by ADMIN_API_KEY header):
//   POST /v1/admin/licenses                    -- create a new key
//   POST /v1/admin/licenses/:key/revoke        -- revoke a key
//   GET  /v1/admin/licenses?customer_id=&tier= -- paginated list
//
// Static admin UI:
//   GET  /admin/                -- serves admin.html
//
// Every 200 response includes X-Psygil-Signature (HMAC-SHA256 of body).
//
// Storage is selected by DATABASE_URL env var:
//   Present  -> Postgres (production)
//   Absent   -> services/license-server/licenses.json (dev)
//
// Run with:
//   tsx services/license-server/server.ts
//
// Configuration via environment:
//   PSYGIL_LICENSE_SERVER_PORT  (default 8443)
//   PSYGIL_LICENSE_SERVER_HOST  (default 127.0.0.1)
//   PSYGIL_LICENSE_DB           (default ./services/license-server/licenses.json)
//   DATABASE_URL                (postgres connection string; omit for JSON dev mode)
//   SIGNING_SECRET              (HMAC key for X-Psygil-Signature; required in prod)
//   ADMIN_API_KEY               (bearer token for /v1/admin/* endpoints)
//
// HIPAA / privacy:
//   The server only ever sees the license key. No PHI crosses this boundary.
//   Keys are logged as first-5 ... last-5 chars only.
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { timingSafeEqual } from 'crypto'

import {
  loadLicense,
  saveLicense,
  revokeLicense,
  listLicenses,
  createCustomer,
  appendAuditEntry,
  type Tier,
  type License,
} from './db.js'
import { signResponse } from './sign.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ErrorCode = 'EXPIRED' | 'REJECTED'

interface LicenseRecord {
  readonly key: string
  readonly tier: Tier
  readonly seats: number
  readonly expiresAt: string | null
  readonly revoked: boolean
  readonly notes: string
}

interface ValidateRequest {
  readonly key: string
}

interface ValidateOk {
  readonly ok: true
  readonly tier: Tier
  readonly seats: number
  readonly expiresAt: string | null
}

interface ValidateError {
  readonly ok: false
  readonly errorCode: ErrorCode
  readonly errorMessage: string
}

type ValidateResponse = ValidateOk | ValidateError

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = Number.parseInt(process.env['PSYGIL_LICENSE_SERVER_PORT'] ?? '8443', 10)
const HOST = process.env['PSYGIL_LICENSE_SERVER_HOST'] ?? '127.0.0.1'
const SIGNING_SECRET = process.env['SIGNING_SECRET'] ?? 'dev-signing-secret-change-in-production'
const ADMIN_API_KEY = process.env['ADMIN_API_KEY'] ?? ''

function defaultDbPath(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    return join(here, 'licenses.json')
  } catch {
    return join(process.cwd(), 'services', 'license-server', 'licenses.json')
  }
}

const DB_PATH = process.env['PSYGIL_LICENSE_DB'] ?? defaultDbPath()

// ---------------------------------------------------------------------------
// Legacy JSON file helpers (used only when DATABASE_URL is absent)
// ---------------------------------------------------------------------------

interface Database {
  readonly licenses: readonly LicenseRecord[]
}

function loadDatabase(): Database {
  if (!existsSync(DB_PATH)) {
    const seed: Database = {
      licenses: [
        {
          key: 'PSGIL-SOLO1-ABCDE-12345-XYZ7Q',
          tier: 'solo',
          seats: 1,
          expiresAt: null,
          revoked: false,
          notes: 'Seed solo dev key',
        },
        {
          key: 'PSGIL-PRAC1-SEAT5-ABCDE-12345',
          tier: 'practice',
          seats: 5,
          expiresAt: null,
          revoked: false,
          notes: 'Seed practice dev key',
        },
        {
          key: 'PSGIL-ENTR1-ABCDE-12345-67890',
          tier: 'enterprise',
          seats: 25,
          expiresAt: null,
          revoked: false,
          notes: 'Seed enterprise dev key',
        },
        {
          key: 'PSGIL-SOLO2-EXPIR-EDKEY-00001',
          tier: 'solo',
          seats: 1,
          expiresAt: '2024-01-01T00:00:00Z',
          revoked: false,
          notes: 'Seed expired key for testing',
        },
        {
          key: 'PSGIL-SOLO3-REVOK-EDKEY-00002',
          tier: 'solo',
          seats: 1,
          expiresAt: null,
          revoked: true,
          notes: 'Seed revoked key for testing',
        },
      ],
    }
    writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8')
    return seed
  }
  try {
    const raw = readFileSync(DB_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Support both legacy format (array of LicenseRecord) and new format
    if (Array.isArray(parsed['licenses'])) {
      const first = parsed['licenses'][0] as Record<string, unknown> | undefined
      if (first !== undefined && 'revoked' in first) {
        return { licenses: parsed['licenses'] as LicenseRecord[] }
      }
    }
    return { licenses: [] }
  } catch (err) {
    process.stderr.write(`[license-server] Failed to read database: ${String(err)}\n`)
    return { licenses: [] }
  }
}

// ---------------------------------------------------------------------------
// Validation logic (operates on legacy LicenseRecord for JSON mode)
// ---------------------------------------------------------------------------

const KEY_REGEX = /^PSGIL-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/

export function validateKey(key: string, db: Database): ValidateResponse {
  const normalized = key.replace(/\s+/g, '').toUpperCase()
  if (!KEY_REGEX.test(normalized)) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License key format is invalid.',
    }
  }
  const record = db.licenses.find((l) => l.key === normalized)
  if (record === undefined) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License key not recognized.',
    }
  }
  if (record.revoked) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License has been revoked. Contact licenses@psygil.example.',
    }
  }
  if (record.expiresAt !== null) {
    const expires = Date.parse(record.expiresAt)
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return {
        ok: false,
        errorCode: 'EXPIRED',
        errorMessage: `License expired on ${record.expiresAt}.`,
      }
    }
  }
  return {
    ok: true,
    tier: record.tier,
    seats: record.seats,
    expiresAt: record.expiresAt,
  }
}

/**
 * Validate a key using the abstract db layer (Postgres or JSON).
 */
async function validateKeyFromDb(key: string): Promise<ValidateResponse> {
  const normalized = key.replace(/\s+/g, '').toUpperCase()
  if (!KEY_REGEX.test(normalized)) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License key format is invalid.',
    }
  }

  let license: License | null
  try {
    license = await loadLicense(normalized)
  } catch (err) {
    // DB unavailable: fall through to legacy JSON mode
    process.stderr.write(`[license-server] DB read failed, using legacy: ${String(err)}\n`)
    return validateKey(key, loadDatabase())
  }

  if (license === null) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License key not recognized.',
    }
  }
  if (license.revoked_at !== null) {
    return {
      ok: false,
      errorCode: 'REJECTED',
      errorMessage: 'License has been revoked. Contact licenses@psygil.example.',
    }
  }
  if (license.expires_at !== null) {
    const expires = Date.parse(license.expires_at)
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return {
        ok: false,
        errorCode: 'EXPIRED',
        errorMessage: `License expired on ${license.expires_at}.`,
      }
    }
  }
  return {
    ok: true,
    tier: license.tier,
    seats: license.seats,
    expiresAt: license.expires_at,
  }
}

// ---------------------------------------------------------------------------
// Admin auth helper
// ---------------------------------------------------------------------------

function checkAdminKey(req: IncomingMessage): boolean {
  if (ADMIN_API_KEY.length === 0) return false
  const header = req.headers['x-admin-api-key'] ?? req.headers['authorization']
  if (header === undefined) return false
  const provided = typeof header === 'string'
    ? header.replace(/^Bearer\s+/i, '')
    : header[0]?.replace(/^Bearer\s+/i, '') ?? ''
  if (provided.length === 0) return false
  try {
    const expected = Buffer.from(ADMIN_API_KEY)
    const actual = Buffer.from(provided)
    if (expected.length !== actual.length) return false
    return timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskKey(key: string): string {
  if (key.length < 12) return '<short>'
  return `${key.slice(0, 5)}...${key.slice(-5)}`
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    let totalBytes = 0
    const MAX_BYTES = 8 * 1024
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_BYTES) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      body += chunk.toString('utf-8')
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? 'unknown'
  if (Array.isArray(forwarded)) return forwarded[0]?.split(',')[0]?.trim() ?? 'unknown'
  return req.socket.remoteAddress ?? 'unknown'
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const sig = signResponse(body, SIGNING_SECRET)
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Psygil-Signature': sig,
  })
  res.end(payload)
}

function isValidateRequest(value: unknown): value is ValidateRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { key?: unknown }).key === 'string'
  )
}

function serveStaticHtml(res: ServerResponse, filePath: string): void {
  try {
    const content = readFileSync(filePath, 'utf-8')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  }
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

function generateKey(tier: Tier, seats: number): string {
  const prefix =
    tier === 'solo' ? 'SOLO1' : tier === 'practice' ? `SEAT${Math.min(seats, 9)}` : 'ENTR1'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  function rand5(): string {
    return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }
  return `PSGIL-${prefix}-${rand5()}-${rand5()}-${rand5()}`
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

export function createLicenseServer(
  getDatabase: () => Database = loadDatabase,
): ReturnType<typeof createServer> {
  return createServer(async (req, res) => {
    const url = req.url ?? ''
    const method = req.method ?? 'GET'

    // ---- Health checks -------------------------------------------------------
    if (method === 'GET' && (url === '/health' || url === '/healthz')) {
      const body = { status: 'ok', version: '1.0.0' }
      sendJson(res, 200, body)
      return
    }

    // ---- Admin UI ------------------------------------------------------------
    if (method === 'GET' && (url === '/admin/' || url === '/admin')) {
      const htmlPath = join(dirname(fileURLToPath(import.meta.url)), 'admin.html')
      serveStaticHtml(res, htmlPath)
      return
    }

    // ---- Public: validate ----------------------------------------------------
    if (method === 'POST' && url === '/v1/licenses/validate') {
      const ip = getClientIp(req)
      let keyForAudit = 'unknown'
      try {
        const body = await readJsonBody(req)
        if (!isValidateRequest(body)) {
          sendJson(res, 400, { error: 'Body must be { "key": string }' })
          return
        }
        keyForAudit = body.key
        const result = await validateKeyFromDb(body.key)
        // Audit log (fire-and-forget, do not block response)
        appendAuditEntry({
          license_key: body.key.replace(/\s+/g, '').toUpperCase(),
          ip,
          result: result.ok ? 'ok' : 'fail',
          error_code: result.ok ? null : result.errorCode,
        }).catch((err: unknown) => {
          process.stderr.write(`[license-server] audit log failed: ${String(err)}\n`)
        })
        process.stderr.write(
          `[license-server] validate ${maskKey(body.key)} ip=${ip} => ${
            result.ok ? `ok ${result.tier}/${result.seats}` : `fail ${result.errorCode}`
          }\n`,
        )
        sendJson(res, 200, result)
        return
      } catch (err) {
        appendAuditEntry({
          license_key: keyForAudit,
          ip,
          result: 'fail',
          error_code: 'REQUEST_ERROR',
        }).catch(() => undefined)
        sendJson(res, 400, { error: (err as Error).message })
        return
      }
    }

    // ---- Admin: create license -----------------------------------------------
    if (method === 'POST' && url === '/v1/admin/licenses') {
      if (!checkAdminKey(req)) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }
      try {
        const body = await readJsonBody(req)
        const b = body as Record<string, unknown>
        const tier = b['tier'] as Tier | undefined
        if (tier !== 'solo' && tier !== 'practice' && tier !== 'enterprise') {
          sendJson(res, 400, { error: 'tier must be solo|practice|enterprise' })
          return
        }
        const seats = typeof b['seats'] === 'number' ? b['seats'] : tier === 'solo' ? 1 : tier === 'practice' ? 5 : 25
        const customerId = typeof b['customer_id'] === 'string' ? b['customer_id'] : null
        const expiresAt = typeof b['expires_at'] === 'string' ? b['expires_at'] : null
        const key = generateKey(tier, seats)
        const license: License = {
          key,
          tier,
          seats,
          customer_id: customerId,
          issued_at: new Date().toISOString(),
          expires_at: expiresAt,
          revoked_at: null,
        }
        await saveLicense(license)
        sendJson(res, 200, { ok: true, license })
        return
      } catch (err) {
        sendJson(res, 400, { error: (err as Error).message })
        return
      }
    }

    // ---- Admin: revoke license -----------------------------------------------
    const revokeMatch = /^\/v1\/admin\/licenses\/([^/]+)\/revoke$/.exec(url)
    if (method === 'POST' && revokeMatch !== null) {
      if (!checkAdminKey(req)) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }
      const key = decodeURIComponent(revokeMatch[1] ?? '')
      try {
        const revoked = await revokeLicense(key)
        if (!revoked) {
          sendJson(res, 404, { error: 'License not found or already revoked' })
          return
        }
        sendJson(res, 200, { ok: true, key })
        return
      } catch (err) {
        sendJson(res, 500, { error: (err as Error).message })
        return
      }
    }

    // ---- Admin: list licenses ------------------------------------------------
    if (method === 'GET' && url.startsWith('/v1/admin/licenses')) {
      if (!checkAdminKey(req)) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }
      try {
        const qs = new URL(url, 'http://localhost').searchParams
        const tier = qs.get('tier') as Tier | null
        const customerId = qs.get('customer_id')
        const page = parseInt(qs.get('page') ?? '1', 10)
        const limit = parseInt(qs.get('limit') ?? '20', 10)
        const result = await listLicenses({
          tier: tier ?? undefined,
          customer_id: customerId ?? undefined,
          page,
          limit,
        })
        sendJson(res, 200, result)
        return
      } catch (err) {
        sendJson(res, 500, { error: (err as Error).message })
        return
      }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const server = createLicenseServer()
  server.listen(PORT, HOST, () => {
    process.stderr.write(`Psygil license server listening on http://${HOST}:${PORT}\n`)
    process.stderr.write(`Database: ${process.env['DATABASE_URL'] ? 'Postgres' : DB_PATH}\n`)
  })
}

const isDirectInvocation =
  typeof require !== 'undefined'
    ? require.main === module
    : (() => {
        try {
          return import.meta.url === `file://${process.argv[1]}`
        } catch {
          return false
        }
      })()

if (isDirectInvocation) {
  main()
}
