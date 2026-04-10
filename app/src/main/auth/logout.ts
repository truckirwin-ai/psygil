// Auth0 logout, clears local tokens/session and optionally redirects to
// Auth0's /v2/logout endpoint to clear the SSO session.

import { BrowserWindow } from 'electron'
import { loadAuth0Config } from './auth0-config'
import { clearSession } from './index'

export interface LogoutResult {
  readonly logged_out_at: string
}

export function performLogout(parentWindow: BrowserWindow | null): LogoutResult {
  // Clear all local state and encrypted tokens
  clearSession()

  const loggedOutAt = new Date().toISOString()

  // Optionally hit Auth0's logout endpoint to clear SSO cookie
  try {
    const config = loadAuth0Config()
    const logoutUrl = new URL(`https://${config.domain}/v2/logout`)
    logoutUrl.searchParams.set('client_id', config.clientId)
    logoutUrl.searchParams.set('returnTo', config.logoutUrl)

    // Fire-and-forget: open invisible window to hit the logout endpoint
    const logoutWindow = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      parent: parentWindow ?? undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    void logoutWindow.loadURL(logoutUrl.toString())

    // Close after a short delay, we don't need the response
    setTimeout(() => {
      if (!logoutWindow.isDestroyed()) {
        logoutWindow.close()
      }
    }, 3000)
  } catch {
    // Non-fatal: local state is already cleared
  }

  return { logged_out_at: loggedOutAt }
}
