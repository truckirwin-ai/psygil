import { describe, it, expect, beforeEach } from 'vitest'
import { computeCodeChallenge, generateCodeVerifier } from '../../../src/main/auth/login'
import { parseCallbackUrl } from '../../../src/main/auth/callback'
import {
  getCurrentSession,
  setSession,
  clearSession,
  getCurrentUserId,
  resolveUserId,
  type AuthSession,
} from '../../../src/main/auth/session'

// ---------------------------------------------------------------------------
// computeCodeChallenge is deterministic
// ---------------------------------------------------------------------------

describe('computeCodeChallenge', () => {
  it('is deterministic for the same verifier', () => {
    const verifier = 'abc123'
    expect(computeCodeChallenge(verifier)).toBe(computeCodeChallenge(verifier))
  })

  it('produces a different challenge for a different verifier', () => {
    expect(computeCodeChallenge('aaaa')).not.toBe(computeCodeChallenge('bbbb'))
  })

  it('returns a base64url string (no +, /, =)', () => {
    const challenge = computeCodeChallenge(generateCodeVerifier())
    expect(challenge).not.toMatch(/[+/=]/)
    expect(challenge.length).toBeGreaterThan(20)
  })
})

// ---------------------------------------------------------------------------
// parseCallbackUrl
// ---------------------------------------------------------------------------

describe('parseCallbackUrl', () => {
  it('extracts code and state from a valid callback URL', () => {
    const url = 'psygil://callback?code=AUTH_CODE_123&state=STATE_XYZ'
    const result = parseCallbackUrl(url, 'STATE_XYZ')
    expect(result).not.toBeNull()
    expect(result?.code).toBe('AUTH_CODE_123')
    expect(result?.state).toBe('STATE_XYZ')
  })

  it('returns null when state does not match', () => {
    const url = 'psygil://callback?code=AUTH_CODE_123&state=WRONG_STATE'
    const result = parseCallbackUrl(url, 'EXPECTED_STATE')
    expect(result).toBeNull()
  })

  it('returns null when code is missing', () => {
    const url = 'psygil://callback?state=STATE_XYZ'
    const result = parseCallbackUrl(url, 'STATE_XYZ')
    expect(result).toBeNull()
  })

  it('returns null for a non-psygil URL', () => {
    const result = parseCallbackUrl('https://example.com/callback?code=X&state=Y', 'Y')
    expect(result).toBeNull()
  })

  it('returns null for a malformed URL string', () => {
    const result = parseCallbackUrl('not a url at all', 'STATE')
    expect(result).toBeNull()
  })

  it('returns null when hostname is not callback', () => {
    const url = 'psygil://auth?code=X&state=STATE'
    const result = parseCallbackUrl(url, 'STATE')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getCurrentUserId and resolveUserId
// ---------------------------------------------------------------------------

describe('getCurrentUserId', () => {
  beforeEach(() => {
    clearSession()
  })

  it('returns null when no session is set', () => {
    expect(getCurrentUserId()).toBeNull()
  })

  it('returns a number when session is set', () => {
    const session: AuthSession = {
      accessToken: 'at',
      refreshToken: null,
      idToken: 'it',
      userId: 'auth0|test-user',
      email: 'test@example.com',
      name: 'Test User',
      expiresAt: Date.now() + 3_600_000,
    }
    setSession(session)
    const id = getCurrentUserId()
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })
})

describe('resolveUserId', () => {
  it('creates a users row on first login if absent', () => {
    const id = resolveUserId('newuser@example.com', 'New User')
    expect(typeof id).toBe('number')
    expect(id).toBeGreaterThan(0)
  })

  it('returns the same id on repeated calls with the same email', () => {
    const email = 'stable@example.com'
    const id1 = resolveUserId(email, 'Stable User')
    const id2 = resolveUserId(email, 'Stable User')
    expect(id1).toBe(id2)
  })
})
