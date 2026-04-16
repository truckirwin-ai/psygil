import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Inline re-implementation of signResponse / verifyResponse using Node crypto
// so we can test the algorithm without importing from the license server
// package (which lives outside the app/ tree and has its own package.json).
// The implementation here must exactly match services/license-server/sign.ts.
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from 'crypto'

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

function signResponse(body: unknown, secret: string): string {
  return createHmac('sha256', secret).update(canonicalJson(body)).digest('hex')
}

function verifyResponse(body: unknown, signature: string, secret: string): boolean {
  try {
    const expected = signResponse(body, secret)
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(signature, 'hex')
    if (expectedBuf.length !== providedBuf.length) return false
    return timingSafeEqual(expectedBuf, providedBuf)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SECRET = 'test-signing-secret-abc123'

describe('signResponse', () => {
  it('produces a 64-char hex string', () => {
    const sig = signResponse({ ok: true, tier: 'solo', seats: 1 }, SECRET)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    const body = { ok: true, tier: 'practice', seats: 5, expiresAt: null }
    const sig1 = signResponse(body, SECRET)
    const sig2 = signResponse(body, SECRET)
    expect(sig1).toBe(sig2)
  })

  it('produces the same signature regardless of object key insertion order', () => {
    const body1 = { ok: true, tier: 'solo', seats: 1 }
    const body2 = { seats: 1, tier: 'solo', ok: true }
    expect(signResponse(body1, SECRET)).toBe(signResponse(body2, SECRET))
  })

  it('produces different signatures for different bodies', () => {
    const sig1 = signResponse({ ok: true, tier: 'solo' }, SECRET)
    const sig2 = signResponse({ ok: true, tier: 'enterprise' }, SECRET)
    expect(sig1).not.toBe(sig2)
  })

  it('produces different signatures for different secrets', () => {
    const body = { ok: true }
    expect(signResponse(body, 'secret-a')).not.toBe(signResponse(body, 'secret-b'))
  })
})

describe('verifyResponse', () => {
  it('accepts a valid signature', () => {
    const body = { ok: true, tier: 'enterprise', seats: 25, expiresAt: '2030-01-01T00:00:00Z' }
    const sig = signResponse(body, SECRET)
    expect(verifyResponse(body, sig, SECRET)).toBe(true)
  })

  it('rejects a tampered body', () => {
    const body = { ok: true, tier: 'solo', seats: 1 }
    const sig = signResponse(body, SECRET)
    const tampered = { ok: true, tier: 'enterprise', seats: 25 }
    expect(verifyResponse(tampered, sig, SECRET)).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const body = { ok: false, errorCode: 'REJECTED' }
    const sig = signResponse(body, SECRET)
    expect(verifyResponse(body, sig, 'wrong-secret')).toBe(false)
  })

  it('rejects an empty signature string', () => {
    const body = { ok: true }
    expect(verifyResponse(body, '', SECRET)).toBe(false)
  })

  it('rejects a truncated signature', () => {
    const body = { ok: true }
    const sig = signResponse(body, SECRET).slice(0, 32)
    expect(verifyResponse(body, sig, SECRET)).toBe(false)
  })
})
