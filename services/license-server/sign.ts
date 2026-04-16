// =============================================================================
// sign.ts, HMAC-SHA256 response signing for the Psygil license server
// =============================================================================
//
// Every 200 response from the license server includes a header:
//   X-Psygil-Signature: <hex>
//
// The signature is HMAC-SHA256 over the canonical JSON of the body using
// a shared secret (SIGNING_SECRET env var on the server, mirrored in the
// app binary as VERIFICATION_SECRET). In v1.0 the symmetric key is an
// acceptable trade-off; v2.0 will switch to asymmetric Ed25519.
//
// Only Node.js built-in `crypto` is used, no extra dependencies.
// =============================================================================

import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Produce a canonical JSON string: keys sorted, no extra whitespace.
 * Sorting ensures that two objects with the same entries but different
 * insertion order produce the same signature.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, sortedReplacer)
}

function sortedReplacer(_key: string, val: unknown): unknown {
  if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(val as Record<string, unknown>).sort()) {
      sorted[k] = (val as Record<string, unknown>)[k]
    }
    return sorted
  }
  return val
}

/**
 * Sign a response body with HMAC-SHA256.
 * Returns the hex-encoded digest.
 */
export function signResponse(body: unknown, secret: string): string {
  const payload = canonicalJson(body)
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Verify that a response body matches the provided signature.
 * Uses timing-safe comparison to prevent timing-based secret extraction.
 * Returns false on any mismatch or error rather than throwing.
 */
export function verifyResponse(body: unknown, signature: string, secret: string): boolean {
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
