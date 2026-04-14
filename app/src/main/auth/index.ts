// Auth module, session state manager.
// Holds in-memory auth state in the main process and exposes it to other modules.

import { safeStorage } from 'electron'
import type { AuthGetStatusResult } from '../../shared/types'

// ---------------------------------------------------------------------------
// Token storage keys (stored encrypted via safeStorage)
// ---------------------------------------------------------------------------

const TOKEN_KEYS = {
  ID_TOKEN: 'psygil_id_token',
  ACCESS_TOKEN: 'psygil_access_token',
  REFRESH_TOKEN: 'psygil_refresh_token',
} as const

// ---------------------------------------------------------------------------
// In-memory session state
// ---------------------------------------------------------------------------

interface AuthSession {
  userId: string
  userName: string
  email: string
  roles: readonly string[]
  isActive: boolean
  expiresAt: string
}

let currentSession: AuthSession | null = null

// ---------------------------------------------------------------------------
// Token persistence via safeStorage
// ---------------------------------------------------------------------------

function encryptAndStore(key: string, value: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available, cannot store tokens securely')
  }
  const encrypted = safeStorage.encryptString(value)
  // Store in memory map, in production this would go to a keychain-backed store.
  // For now, we use a simple Map as a buffer (tokens survive in memory only for
  // the current session; safeStorage encrypts the bytes but we need a file to persist).
  tokenStore.set(key, encrypted)
}

function decryptAndRetrieve(key: string): string | null {
  const encrypted = tokenStore.get(key)
  if (!encrypted) return null
  return safeStorage.decryptString(encrypted)
}

// In-memory encrypted token buffer
const tokenStore = new Map<string, Buffer>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setTokens(tokens: {
  readonly idToken: string
  readonly accessToken: string
  readonly refreshToken?: string
}): void {
  encryptAndStore(TOKEN_KEYS.ID_TOKEN, tokens.idToken)
  encryptAndStore(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken)
  if (tokens.refreshToken) {
    encryptAndStore(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken)
  }
}

export function getAccessToken(): string | null {
  return decryptAndRetrieve(TOKEN_KEYS.ACCESS_TOKEN)
}

export function getIdToken(): string | null {
  return decryptAndRetrieve(TOKEN_KEYS.ID_TOKEN)
}

export function getRefreshToken(): string | null {
  return decryptAndRetrieve(TOKEN_KEYS.REFRESH_TOKEN)
}

export function clearTokens(): void {
  tokenStore.clear()
}

export function setSession(session: AuthSession): void {
  currentSession = session
}

export function getSession(): AuthSession | null {
  return currentSession
}

export function clearSession(): void {
  currentSession = null
  clearTokens()
}

export function getAuthStatus(): AuthGetStatusResult {
  if (!currentSession) {
    return { is_authenticated: false, session_expired: false }
  }

  const expired = new Date(currentSession.expiresAt) < new Date()
  if (expired) {
    return { is_authenticated: false, session_expired: true }
  }

  return {
    is_authenticated: true,
    user_id: currentSession.userId,
    user_name: currentSession.userName,
    user_email: currentSession.email,
    is_active: currentSession.isActive,
    roles: currentSession.roles,
    session_expires_at: currentSession.expiresAt,
  }
}

export { TOKEN_KEYS }
