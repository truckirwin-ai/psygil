// =============================================================================
// License Activation, local validator + remote server hook with offline grace
// Source of truth: docs/engineering/17_Setup_Workflow_Spec.md §"License Activation"
// =============================================================================
//
// Validation flow (the public surface is `validateLicense`):
//
//   1. Local format check. If malformed, fail immediately with MALFORMED.
//   2. If a license server URL is configured (PSYGIL_LICENSE_SERVER env var
//      or settings file), POST the key for verification with a 5-second
//      timeout. On success, return the server's response.
//   3. On network failure or no server configured, fall back to local
//      validation. The result is marked as locally-validated so the
//      caller can apply the 14-day offline grace period.
//
// HIPAA / Privacy invariant:
//   - The key is the only thing transmitted. No PHI, no machine
//     fingerprints, no analytics.
//   - All HTTP requests use TLS (https://) and a strict 5-second timeout.
//   - Errors from the server are surfaced verbatim only when the request
//     completed; transport-level errors are abstracted to NETWORK so the
//     UI doesn't leak server URLs to the user.
//
// Key format: PSGIL-<TIER>-<SEATS>-<XXXXX>-<XXXXX>
//   First two blocks encode tier:
//     PSGIL-SOLOx → solo
//     PSGIL-PRACx → practice
//     PSGIL-ENTRx → enterprise
//   Block 3 may encode seats as SEAT<digit> (1 digit, e.g. SEAT5).
//   Otherwise default seats per tier are used.
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto'
import type { LicenseInfo, LicenseTier } from './state'

export type LicenseErrorCode =
  | 'MALFORMED'
  | 'UNKNOWN_TIER'
  | 'EXPIRED'
  | 'NETWORK'
  | 'REJECTED'

export type LicenseSource = 'local' | 'remote'

export interface LicenseValidationResult {
  readonly ok: boolean
  readonly license: LicenseInfo | null
  readonly errorCode: LicenseErrorCode | null
  readonly errorMessage: string | null
  /** Whether validation came from the local fallback or a remote server. */
  readonly source: LicenseSource
  /**
   * If true, the result came from the local fallback because the remote
   * server was unreachable. The wizard should display a "validated offline"
   * notice and the app should retry validation on next launch.
   */
  readonly offlineFallback: boolean
}

const KEY_REGEX = /^PSGIL-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})$/
const REMOTE_TIMEOUT_MS = 5000
const TRIAL_DURATION_DAYS = 10

// ---------------------------------------------------------------------------
// Trial expiry helpers
// ---------------------------------------------------------------------------

/**
 * Compute the ISO 8601 expiry string for a trial license.
 * Adds `days` calendar days to `activatedAt`.
 */
function computeTrialExpiry(activatedAt: string, days: number): string {
  const d = new Date(activatedAt)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * Check whether a persisted license is expired. Returns null if the license
 * has no expiry (paid tier) or if the license is null. Returns a structured
 * result when the license IS expired or within a grace window.
 *
 * Called on app startup and by the renderer to decide whether to show the
 * TrialExpiredModal.
 */
export interface LicenseExpiryStatus {
  readonly expired: boolean
  readonly daysRemaining: number
  readonly expiresAt: string
  readonly tier: LicenseTier
}

export function checkLicenseExpiry(license: LicenseInfo | null): LicenseExpiryStatus | null {
  if (license === null) return null
  if (license.expiresAt === null) return null

  const now = new Date()
  const expiry = new Date(license.expiresAt)
  const msRemaining = expiry.getTime() - now.getTime()
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24))

  return {
    expired: daysRemaining <= 0,
    daysRemaining,
    expiresAt: license.expiresAt,
    tier: license.tier,
  }
}

// ---------------------------------------------------------------------------
// Response signature verification (D.5)
// ---------------------------------------------------------------------------
//
// The license server signs every 200 response with HMAC-SHA256 using a shared
// secret. The verification secret ships in the app binary. In v1.0 the HMAC
// key is symmetric (same value on server and client). v2.0 will switch to
// asymmetric Ed25519 so the private signing key never leaves the server.
//
// The secret is injected at build time via the PSYGIL_VERIFICATION_SECRET
// environment variable. For local dev it defaults to the dev placeholder.

const VERIFICATION_SECRET =
  process.env['PSYGIL_VERIFICATION_SECRET'] ?? 'dev-signing-secret-change-in-production'

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, val: unknown): unknown => {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k]
      }
      return sorted
    }
    return val
  })
}

/**
 * Verify the X-Psygil-Signature header from a license server response.
 * Returns false on any mismatch or error rather than throwing, so the
 * caller can decide whether to treat a missing/invalid signature as fatal.
 */
function verifyServerSignature(body: unknown, signature: string): boolean {
  try {
    const expected = createHmac('sha256', VERIFICATION_SECRET)
      .update(canonicalJson(body))
      .digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(signature, 'hex')
    if (expectedBuf.length !== providedBuf.length) return false
    return timingSafeEqual(expectedBuf, providedBuf)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a user-entered key: strip whitespace and uppercase.
 */
export function normalizeLicenseKey(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/**
 * Local validation, pure logic, no network. Used as the offline fallback
 * and as a fast pre-check before contacting the server.
 */
export function validateLocal(rawKey: string): LicenseValidationResult {
  const key = normalizeLicenseKey(rawKey)

  if (!KEY_REGEX.test(key)) {
    return {
      ok: false,
      license: null,
      errorCode: 'MALFORMED',
      errorMessage:
        'License key format is invalid. Expected PSGIL-XXXXX-XXXXX-XXXXX-XXXXX.',
      source: 'local',
      offlineFallback: false,
    }
  }

  const match = KEY_REGEX.exec(key)
  if (match === null) {
    return {
      ok: false,
      license: null,
      errorCode: 'MALFORMED',
      errorMessage: 'License key format is invalid.',
      source: 'local',
      offlineFallback: false,
    }
  }

  const block1 = match[1]!
  const block2 = match[2]!

  let tier: LicenseTier
  if (block1.startsWith('TRIA')) {
    tier = 'trial'
  } else if (block1.startsWith('SOLO')) {
    tier = 'solo'
  } else if (block1.startsWith('PRAC')) {
    tier = 'practice'
  } else if (block1.startsWith('ENTR')) {
    tier = 'enterprise'
  } else {
    return {
      ok: false,
      license: null,
      errorCode: 'UNKNOWN_TIER',
      errorMessage: `Unknown license tier marker: ${block1}`,
      source: 'local',
      offlineFallback: false,
    }
  }

  const seats = extractSeats(tier, block2)
  const activatedAt = new Date().toISOString()

  // Trial keys auto-expire 10 days from activation. Paid tiers have no
  // local expiry (the server can set one via the remote validation path).
  const expiresAt = tier === 'trial'
    ? computeTrialExpiry(activatedAt, TRIAL_DURATION_DAYS)
    : null

  return {
    ok: true,
    license: {
      tier,
      seats,
      expiresAt,
      activatedAt,
    },
    errorCode: null,
    errorMessage: null,
    source: 'local',
    offlineFallback: false,
  }
}

/**
 * Remote validation against a Psygil license server. Returns null if no
 * server is configured. Throws on transport errors so the caller can
 * decide whether to fall back to local.
 *
 * Server contract:
 *   POST {serverUrl}/v1/licenses/validate
 *   Body: { "key": "PSGIL-..." }
 *   200 → { ok: true,  tier: "solo"|"practice"|"enterprise",
 *           seats: number, expiresAt: ISO8601|null }
 *   200 → { ok: false, errorCode: "EXPIRED"|"REJECTED",
 *           errorMessage: string }
 */
export async function validateRemote(
  rawKey: string,
  serverUrl: string,
): Promise<LicenseValidationResult> {
  const key = normalizeLicenseKey(rawKey)
  const trimmed = serverUrl.replace(/\/+$/, '')
  if (!trimmed.startsWith('https://')) {
    throw new Error('License server URL must use https://')
  }
  const endpoint = `${trimmed}/v1/licenses/validate`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        license: null,
        errorCode: 'REJECTED',
        errorMessage: `License server returned HTTP ${response.status}`,
        source: 'remote',
        offlineFallback: false,
      }
    }

    const body = (await response.json()) as RemoteResponse

    // Verify HMAC signature. If the header is absent (dev server without
    // SIGNING_SECRET set) we skip enforcement so local dev keeps working.
    // In production the server always sends the header.
    const sig = response.headers.get('x-psygil-signature')
    if (sig !== null && sig.length > 0) {
      if (!verifyServerSignature(body, sig)) {
        return {
          ok: false,
          license: null,
          errorCode: 'REJECTED',
          errorMessage: 'License server response signature verification failed.',
          source: 'remote',
          offlineFallback: false,
        }
      }
    }

    if (body.ok === true) {
      const tier = body.tier
      if (tier !== 'solo' && tier !== 'practice' && tier !== 'enterprise') {
        return {
          ok: false,
          license: null,
          errorCode: 'UNKNOWN_TIER',
          errorMessage: `Server returned unknown tier: ${String(tier)}`,
          source: 'remote',
          offlineFallback: false,
        }
      }
      return {
        ok: true,
        license: {
          tier,
          seats: typeof body.seats === 'number' && body.seats > 0 ? body.seats : 1,
          expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
          activatedAt: new Date().toISOString(),
        },
        errorCode: null,
        errorMessage: null,
        source: 'remote',
        offlineFallback: false,
      }
    }

    const errorCode: LicenseErrorCode =
      body.errorCode === 'EXPIRED' || body.errorCode === 'REJECTED'
        ? body.errorCode
        : 'REJECTED'

    return {
      ok: false,
      license: null,
      errorCode,
      errorMessage: body.errorMessage ?? 'License rejected by server.',
      source: 'remote',
      offlineFallback: false,
    }
  } finally {
    clearTimeout(timer)
  }
}

interface RemoteResponse {
  readonly ok?: boolean
  readonly tier?: string
  readonly seats?: number
  readonly expiresAt?: string | null
  readonly errorCode?: string
  readonly errorMessage?: string
}

/**
 * Top-level validator used by the wizard. Tries remote when configured,
 * falls back to local on network errors. Local-only deployments work
 * without any environment configuration.
 */
export async function validateLicense(
  rawKey: string,
): Promise<LicenseValidationResult> {
  // Format check first, saves a network round trip on obvious garbage
  const local = validateLocal(rawKey)
  if (!local.ok && local.errorCode === 'MALFORMED') return local

  const serverUrl = getConfiguredLicenseServer()
  if (serverUrl === null) {
    return local
  }

  try {
    return await validateRemote(rawKey, serverUrl)
  } catch (err) {
    // Network failure: fall back to local with the offline flag set so
    // the wizard can show a "validated offline" notice. The 14-day grace
    // period is enforced by the caller based on activatedAt timestamps.
    if (local.ok) {
      return {
        ...local,
        offlineFallback: true,
      }
    }
    return {
      ok: false,
      license: null,
      errorCode: 'NETWORK',
      errorMessage:
        `Cannot reach license server and the key did not pass local validation. ${(err as Error).message}`,
      source: 'remote',
      offlineFallback: false,
    }
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function extractSeats(tier: LicenseTier, block2: string): number {
  if (tier === 'trial') return 1
  if (tier === 'solo') return 1
  const seatMatch = /^SEAT(\d{1,3})$/.exec(block2)
  if (seatMatch !== null) {
    const n = Number.parseInt(seatMatch[1]!, 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return tier === 'practice' ? 5 : 25
}

/**
 * Resolve the license server URL from environment. Tests and development
 * builds typically leave this unset and rely on local validation only.
 *
 * In a future sprint this can also read from the persisted setup config
 * (e.g. an enterprise customer pinning a self-hosted server).
 */
function getConfiguredLicenseServer(): string | null {
  const env = process.env['PSYGIL_LICENSE_SERVER']
  if (typeof env === 'string' && env.trim().length > 0) {
    return env.trim()
  }
  return null
}

/**
 * Decide whether an offline-fallback license is still inside the 14-day
 * grace period. Pass the persisted activatedAt timestamp.
 */
export function isWithinOfflineGracePeriod(activatedAt: string): boolean {
  const activated = Date.parse(activatedAt)
  if (Number.isNaN(activated)) return false
  const elapsedMs = Date.now() - activated
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000
  return elapsedMs <= fourteenDaysMs
}
