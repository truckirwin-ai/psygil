// In-memory session store for Auth0 PKCE flow.
// Provides current-user identity to the main process.
// Refresh token persistence is handled by src/main/keychain/session.ts.

import { getSqlite } from '../db/connection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthSession {
  readonly accessToken: string
  readonly refreshToken: string | null
  readonly idToken: string
  readonly userId: string
  readonly email: string
  readonly name: string
  readonly expiresAt: number // Unix timestamp in milliseconds
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let currentSession: AuthSession | null = null

// ---------------------------------------------------------------------------
// Session accessors
// ---------------------------------------------------------------------------

export function getCurrentSession(): AuthSession | null {
  return currentSession
}

export function setSession(s: AuthSession): void {
  currentSession = s
}

export function clearSession(): void {
  currentSession = null
}

export function isAuthenticated(): boolean {
  if (currentSession === null) return false
  return currentSession.expiresAt > Date.now()
}

// ---------------------------------------------------------------------------
// DB user resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the local DB users.user_id for the currently authenticated user.
 * Inserts a new row on first login if the email has no record.
 * Returns null if no session is active.
 *
 * Design note: all 17 hardcoded user_id=1 sites stay unchanged until Phase B.2.
 * This function is the future source of truth.
 */
export function getCurrentUserId(): number | null {
  if (currentSession === null) return null
  return resolveUserId(currentSession.email, currentSession.name)
}

/**
 * Resolve or create a users row for the given email.
 * Exported separately so tests can call it directly.
 */
export function resolveUserId(email: string, displayName: string): number {
  const sqlite = getSqlite()

  // Check for existing row first
  const existing = sqlite
    .prepare('SELECT user_id FROM users WHERE email = ?')
    .get(email) as { user_id: number } | null | undefined

  if (existing != null && existing.user_id != null) {
    return existing.user_id
  }

  // Insert on first login
  const result = sqlite
    .prepare(
      `INSERT INTO users (email, full_name, role, is_active, created_at)
       VALUES (?, ?, 'psychologist', 1, date('now'))`
    )
    .run(email, displayName || email)

  return result.lastInsertRowid as number
}
