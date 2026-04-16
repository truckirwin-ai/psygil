// Auth0 PKCE login flow for Electron.
// Opens Auth0-hosted login in the system browser, captures the callback
// via the psygil:// deep-link protocol, exchanges the auth code for tokens,
// and stores them securely using Electron safeStorage.
//
// Design:
//   startLogin()      - generate PKCE params, open browser, return immediately
//   refreshSession()  - attempt silent re-auth with stored refresh token
//   logout()          - clear local session + keychain
//   consumePendingState() - called by callback.ts once the callback arrives

import { shell, BrowserWindow } from 'electron'
import { randomBytes, createHash } from 'node:crypto'
import { loadAuth0Config } from './auth0-config'
import { setSession, clearSession } from './session'
import { storeRefreshToken, retrieveRefreshToken, clearRefreshToken } from '../keychain/session'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32))
}

export function computeCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier).digest()
  return base64UrlEncode(hash)
}

// ---------------------------------------------------------------------------
// Pending state map (state -> { codeVerifier })
// Keyed by the opaque `state` param so callback.ts can look up the verifier.
// ---------------------------------------------------------------------------

export interface TokenExchangeParams {
  readonly code: string
  readonly codeVerifier: string
}

interface PendingEntry {
  readonly codeVerifier: string
  readonly createdAt: number
}

const pendingStates = new Map<string, PendingEntry>()
const PENDING_TTL_MS = 10 * 60 * 1_000 // 10 minutes

/** Called by callback.ts. Returns and removes the entry, or null if unknown. */
export function consumePendingState(state: string): PendingEntry | null {
  const entry = pendingStates.get(state)
  if (!entry) return null
  pendingStates.delete(state)
  // Expire stale entries
  if (Date.now() - entry.createdAt > PENDING_TTL_MS) return null
  return entry
}

// ---------------------------------------------------------------------------
// startLogin
// ---------------------------------------------------------------------------

/**
 * Begin the PKCE login flow. Opens the Auth0 authorize URL in the system
 * browser and returns immediately. The callback arrives via the psygil://
 * deep-link handler in callback.ts.
 *
 * TODO: requires AUTH0_DOMAIN and AUTH0_CLIENT_ID env vars to be set.
 * The Psygil Auth0 tenant configuration is a separate CEO work stream.
 */
export async function startLogin(): Promise<{ launched: boolean }> {
  const config = loadAuth0Config()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = computeCodeChallenge(codeVerifier)
  const state = base64UrlEncode(randomBytes(16))

  pendingStates.set(state, { codeVerifier, createdAt: Date.now() })

  const authUrl = new URL(`https://${config.domain}/authorize`)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.callbackUrl)
  authUrl.searchParams.set('scope', config.scopes)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  if (config.audience) {
    authUrl.searchParams.set('audience', config.audience)
  }

  await shell.openExternal(authUrl.toString())
  return { launched: true }
}

// ---------------------------------------------------------------------------
// refreshSession
// ---------------------------------------------------------------------------

interface TokenResponse {
  readonly access_token: string
  readonly id_token: string
  readonly refresh_token?: string
  readonly expires_in: number
  readonly token_type: string
}

interface JwtPayload {
  readonly sub: string
  readonly name?: string
  readonly email?: string
  readonly exp?: number
  readonly [key: string]: unknown
}

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) throw new Error('Invalid JWT')
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as JwtPayload
}

/**
 * Try to restore a session using the persisted refresh token.
 * Called on app start. If the token is absent or expired, clears state and
 * requires re-login.
 */
export async function refreshSession(): Promise<boolean> {
  const stored = await retrieveRefreshToken()
  if (!stored) return false

  const config = loadAuth0Config()

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    refresh_token: stored,
  })

  if (config.audience) {
    body.set('audience', config.audience)
  }

  let tokens: TokenResponse
  try {
    const response = await fetch(`https://${config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      // Refresh token revoked or expired
      clearSession()
      await clearRefreshToken()
      return false
    }

    tokens = (await response.json()) as TokenResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[auth/login] refreshSession fetch error: ${msg}\n`)
    return false
  }

  const payload = decodeJwtPayload(tokens.id_token)
  const expiresAt = Date.now() + tokens.expires_in * 1_000

  setSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? stored,
    idToken: tokens.id_token,
    userId: payload.sub,
    email: payload.email ?? '',
    name: payload.name ?? payload.email ?? '',
    expiresAt,
  })

  // Rotate refresh token if Auth0 returned a new one
  if (tokens.refresh_token && tokens.refresh_token !== stored) {
    await storeRefreshToken(tokens.refresh_token)
  }

  // Notify renderer
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('auth:session-changed', {
        authenticated: true,
        userId: payload.sub,
        email: payload.email ?? '',
        name: payload.name ?? payload.email ?? '',
      })
    } catch {
      // Non-fatal
    }
  }

  return true
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

/**
 * Clear all local auth state and notify renderer.
 * Optionally hit Auth0 /v2/logout to clear SSO cookie (fire-and-forget).
 */
export async function logout(): Promise<void> {
  clearSession()
  await clearRefreshToken()

  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send('auth:session-changed', { authenticated: false })
    } catch {
      // Non-fatal
    }
  }

  // Best-effort: hit Auth0 logout endpoint to clear SSO session
  try {
    const config = loadAuth0Config()
    const logoutUrl = new URL(`https://${config.domain}/v2/logout`)
    logoutUrl.searchParams.set('client_id', config.clientId)
    logoutUrl.searchParams.set('returnTo', config.logoutUrl)
    await shell.openExternal(logoutUrl.toString())
  } catch {
    // Non-fatal; local state already cleared
  }
}

// ---------------------------------------------------------------------------
// Legacy: performLogin kept for backwards compat with existing auth:login handler
// until Phase B.2 migrates it to the new startLogin flow.
// ---------------------------------------------------------------------------

export { generateCodeVerifier as _generateCodeVerifier, computeCodeChallenge as _computeCodeChallenge }
