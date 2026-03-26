// Auth0 PKCE login flow for Electron.
// Opens an Auth0-hosted login page in a BrowserWindow, captures the callback
// via the psygil:// custom protocol, exchanges the auth code for tokens, and
// stores them securely using Electron's safeStorage.

import { BrowserWindow } from 'electron'
import { randomBytes, createHash } from 'node:crypto'
import type { AuthLoginResult } from '../../shared/types'
import { loadAuth0Config } from './auth0-config'
import { setTokens, setSession } from './index'

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32))
}

function generateCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier).digest()
  return base64UrlEncode(hash)
}

// ---------------------------------------------------------------------------
// JWT payload decoder (no verification — Auth0 already validated)
// ---------------------------------------------------------------------------

interface IdTokenPayload {
  readonly sub: string
  readonly name?: string
  readonly email?: string
  readonly exp?: number
  readonly [key: string]: unknown
}

function decodeIdTokenPayload(idToken: string): IdTokenPayload {
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }
  const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8')
  return JSON.parse(payload) as IdTokenPayload
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

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const config = loadAuth0Config()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    code_verifier: codeVerifier,
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
    const errorBody = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`)
  }

  return (await response.json()) as TokenResponse
}

// ---------------------------------------------------------------------------
// Login flow
// ---------------------------------------------------------------------------

export async function performLogin(parentWindow: BrowserWindow | null): Promise<AuthLoginResult> {
  const config = loadAuth0Config()
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = base64UrlEncode(randomBytes(16))

  // Build the authorization URL
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

  return new Promise<AuthLoginResult>((resolve) => {
    const authWindow = new BrowserWindow({
      width: 480,
      height: 640,
      parent: parentWindow ?? undefined,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    authWindow.once('ready-to-show', () => authWindow.show())

    // Handle the custom protocol callback
    const handleCallback = async (url: string): Promise<void> => {
      try {
        const callbackUrl = new URL(url)
        const returnedState = callbackUrl.searchParams.get('state')
        const code = callbackUrl.searchParams.get('code')
        const error = callbackUrl.searchParams.get('error')

        const notAuthenticated: AuthLoginResult = {
          is_authenticated: false,
          user_id: '',
          user_name: '',
          user_email: '',
          is_active: false,
        }

        if (error) {
          resolve(notAuthenticated)
          authWindow.close()
          return
        }

        if (returnedState !== state) {
          resolve(notAuthenticated)
          authWindow.close()
          return
        }

        if (!code) {
          resolve(notAuthenticated)
          authWindow.close()
          return
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier)

        // Store tokens securely
        setTokens({
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })

        // Decode ID token to extract user info
        const payload = decodeIdTokenPayload(tokens.id_token)

        // Build session
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        setSession({
          userId: payload.sub,
          userName: payload.name ?? payload.email ?? 'Unknown',
          email: payload.email ?? '',
          roles: (payload['https://psygil.com/roles'] as string[] | undefined) ?? ['clinician'],
          isActive: true,
          expiresAt,
        })

        resolve({
          is_authenticated: true,
          user_id: payload.sub,
          user_name: payload.name ?? payload.email ?? 'Unknown',
          user_email: payload.email ?? '',
          is_active: true,
        })
      } catch (err) {
        resolve({
          is_authenticated: false,
          user_id: '',
          user_name: '',
          user_email: '',
          is_active: false,
        })
      } finally {
        if (!authWindow.isDestroyed()) {
          authWindow.close()
        }
      }
    }

    // Listen for navigation to our callback URL
    authWindow.webContents.on('will-navigate', (_event, url) => {
      if (url.startsWith('psygil://')) {
        void handleCallback(url)
      }
    })

    // Also handle redirects (some Auth0 configs redirect differently)
    authWindow.webContents.on('will-redirect', (_event, url) => {
      if (url.startsWith('psygil://')) {
        void handleCallback(url)
      }
    })

    // If user closes the window without completing login
    authWindow.on('closed', () => {
      resolve({
        is_authenticated: false,
        user_id: '',
        user_name: '',
        user_email: '',
        is_active: false,
      })
    })

    // Load the Auth0 login page
    void authWindow.loadURL(authUrl.toString())
  })
}
