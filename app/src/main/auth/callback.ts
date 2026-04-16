// Deep-link callback handler for Auth0 PKCE flow.
// Registers open-url (macOS/Linux) and second-instance (Windows) listeners.
// Parses psygil://callback?code=...&state=... and completes the token exchange.
//
// Call registerCallbackHandler() once from app.whenReady(), after
// startLogin() is wired up so the pending-state map is populated.

import { app, BrowserWindow } from 'electron'
import { loadAuth0Config } from './auth0-config'
import { setSession, clearSession } from './session'
import { storeRefreshToken, clearRefreshToken } from '../keychain/session'
import { consumePendingState, TokenExchangeParams } from './login'

// ---------------------------------------------------------------------------
// Rate-limit guard: ignore duplicate callbacks within 5 seconds
// ---------------------------------------------------------------------------

let lastCallbackAt = 0
const CALLBACK_DEBOUNCE_MS = 5_000

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

export interface ParsedCallback {
  readonly code: string
  readonly state: string
}

/**
 * Parse a psygil://callback URL.
 * Returns null if the URL is not a valid callback or state does not match.
 */
export function parseCallbackUrl(
  rawUrl: string,
  expectedState: string
): ParsedCallback | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsed.protocol !== 'psygil:') return null
  if (parsed.hostname !== 'callback') return null

  const code = parsed.searchParams.get('code')
  const state = parsed.searchParams.get('state')

  if (!code || !state) return null
  if (state !== expectedState) return null

  return { code, state }
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

interface TokenResponse {
  readonly access_token: string
  readonly id_token: string
  readonly refresh_token?: string
  readonly expires_in: number
  readonly token_type: string
}

async function exchangeCode(params: TokenExchangeParams): Promise<TokenResponse> {
  const config = loadAuth0Config()

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: config.callbackUrl,
  })

  if (config.audience) {
    body.set('audience', config.audience)
  }

  const response = await fetch(`https://${config.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Token exchange failed (${response.status}): ${detail}`)
  }

  return (await response.json()) as TokenResponse
}

// ---------------------------------------------------------------------------
// JWT payload decoder (no signature verification; Auth0 already validated)
// ---------------------------------------------------------------------------

interface IdTokenPayload {
  readonly sub: string
  readonly name?: string
  readonly email?: string
  readonly exp?: number
  readonly [key: string]: unknown
}

function decodeJwtPayload(token: string): IdTokenPayload {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid JWT format')
  }
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as IdTokenPayload
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

async function handleCallbackUrl(rawUrl: string): Promise<void> {
  // Rate-limit: ignore if a callback was processed recently
  const now = Date.now()
  if (now - lastCallbackAt < CALLBACK_DEBOUNCE_MS) {
    process.stderr.write('[auth/callback] duplicate callback ignored (rate-limit)\n')
    return
  }

  if (!rawUrl.startsWith('psygil://callback')) return

  // Extract state from URL before consuming pending state
  let stateFromUrl: string | null = null
  try {
    stateFromUrl = new URL(rawUrl).searchParams.get('state')
  } catch {
    process.stderr.write('[auth/callback] malformed callback URL\n')
    return
  }

  if (!stateFromUrl) {
    process.stderr.write('[auth/callback] state missing from callback URL\n')
    return
  }

  const pending = consumePendingState(stateFromUrl)
  if (!pending) {
    process.stderr.write('[auth/callback] unknown or expired state parameter\n')
    return
  }

  const parsed = parseCallbackUrl(rawUrl, stateFromUrl)
  if (!parsed) {
    process.stderr.write('[auth/callback] callback URL parse failed or state mismatch\n')
    return
  }

  lastCallbackAt = now

  try {
    const tokens = await exchangeCode({
      code: parsed.code,
      codeVerifier: pending.codeVerifier,
    })

    const payload = decodeJwtPayload(tokens.id_token)
    const expiresAt = Date.now() + tokens.expires_in * 1_000

    setSession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      idToken: tokens.id_token,
      userId: payload.sub,
      email: payload.email ?? '',
      name: payload.name ?? payload.email ?? '',
      expiresAt,
    })

    if (tokens.refresh_token) {
      await storeRefreshToken(tokens.refresh_token)
    }

    // Broadcast to all renderer windows
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('auth:session-changed', {
          authenticated: true,
          userId: payload.sub,
          email: payload.email ?? '',
          name: payload.name ?? payload.email ?? '',
        })
      } catch {
        // Non-fatal; window may be closing
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`[auth/callback] token exchange error: ${msg}\n`)
    clearSession()
    await clearRefreshToken()
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register deep-link handlers. Call once inside app.whenReady().
 *
 * macOS / Linux: app.on('open-url')
 * Windows: second-instance argv parsing is handled by startLogin() returning
 * early and forwarding the URL here via the second-instance event. Register
 * here so the logic is co-located.
 */
export function registerCallbackHandler(): void {
  // macOS and Linux: OS emits open-url when psygil:// is invoked
  app.on('open-url', (event, url) => {
    event.preventDefault()
    void handleCallbackUrl(url)
  })

  // Windows: second instance is launched with the callback URL in argv
  app.on('second-instance', (_event, argv) => {
    const callbackArg = argv.find((a) => a.startsWith('psygil://callback'))
    if (callbackArg) {
      void handleCallbackUrl(callbackArg)
    }
    // Bring existing window to front
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0 && wins[0]) {
      const win = wins[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}
