// =============================================================================
// Psygil License Server, reference implementation
// =============================================================================
//
// A minimal HTTP service that implements the contract consumed by
// app/src/main/setup/license.ts validateRemote().
//
// Endpoint:
//   POST /v1/licenses/validate
//   Body: { "key": "PSGIL-XXXXX-XXXXX-XXXXX-XXXXX" }
//
//   200 → { ok: true,  tier: "solo"|"practice"|"enterprise",
//                       seats: number,
//                       expiresAt: ISO8601 | null }
//   200 → { ok: false, errorCode: "EXPIRED"|"REJECTED",
//                       errorMessage: string }
//   4xx → request was malformed (no body)
//
// Health check:
//   GET /healthz → 200 "ok"
//
// Run with:
//   tsx services/license-server/server.ts
//
// Configuration via environment:
//   PSYGIL_LICENSE_SERVER_PORT  (default 8443)
//   PSYGIL_LICENSE_SERVER_HOST  (default 127.0.0.1)
//   PSYGIL_LICENSE_DB           (default ./services/license-server/licenses.json)
//
// Storage:
//   A simple JSON file. Each entry has the key, tier, seats, expiresAt,
//   revoked flag, and notes. The file is read on every request, fine for
//   the MVP, easy to replace with a real database later.
//
// Production hardening (NOT in this MVP):
//   - Real TLS termination (use a reverse proxy or fastify with HTTPS)
//   - Rate limiting per IP
//   - Audit log
//   - Replication
//   - HMAC-signed responses to prevent local fakery
//
// HIPAA / privacy:
//   - The server only ever sees the license key. No PHI ever crosses.
//   - We do not log the key in plaintext (only first 5 + last 5 chars).
// =============================================================================

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tier = 'solo' | 'practice' | 'enterprise'
type ErrorCode = 'EXPIRED' | 'REJECTED'

interface LicenseRecord {
  readonly key: string
  readonly tier: Tier
  readonly seats: number
  /** ISO 8601 or null for perpetual */
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

function defaultDbPath(): string {
  // Resolve to a path next to this file regardless of CWD
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    return join(here, 'licenses.json')
  } catch {
    // CommonJS fallback
    return join(process.cwd(), 'services', 'license-server', 'licenses.json')
  }
}

const DB_PATH = process.env['PSYGIL_LICENSE_DB'] ?? defaultDbPath()

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

interface Database {
  readonly licenses: readonly LicenseRecord[]
}

function loadDatabase(): Database {
  if (!existsSync(DB_PATH)) {
    // Seed with a couple of dev keys so the server is useful out of the box
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
    return JSON.parse(raw) as Database
  } catch (err) {
    console.error('[license-server] Failed to read database:', err)
    return { licenses: [] }
  }
}

// ---------------------------------------------------------------------------
// Validation logic
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
    const MAX_BYTES = 8 * 1024 // 8 KB cap; license keys are tiny
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

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
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

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

export function createLicenseServer(
  getDatabase: () => Database = loadDatabase,
): ReturnType<typeof createServer> {
  return createServer(async (req, res) => {
    const url = req.url ?? ''

    if (req.method === 'GET' && url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (req.method === 'POST' && url === '/v1/licenses/validate') {
      try {
        const body = await readJsonBody(req)
        if (!isValidateRequest(body)) {
          sendJson(res, 400, { error: 'Body must be { "key": string }' })
          return
        }
        const result = validateKey(body.key, getDatabase())
        console.log(
          `[license-server] validate ${maskKey(body.key)} → ${
            result.ok ? `ok ${result.tier}/${result.seats}` : `fail ${result.errorCode}`
          }`,
        )
        sendJson(res, 200, result)
        return
      } catch (err) {
        sendJson(res, 400, { error: (err as Error).message })
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
    console.log(`Psygil license server listening on http://${HOST}:${PORT}`)
    console.log(`Database: ${DB_PATH}`)
  })
}

// Run only if invoked directly (works for both tsx and compiled use)
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
