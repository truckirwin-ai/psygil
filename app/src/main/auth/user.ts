// User info and license check.
// Exposes user status and performs a simulated license validation.

import { getSession, getAccessToken } from './index'

// ---------------------------------------------------------------------------
// License check
// ---------------------------------------------------------------------------

export interface LicenseStatus {
  readonly is_active: boolean
  readonly license_type: 'trial' | 'professional' | 'enterprise' | 'none'
  readonly expires_at: string | null
}

/**
 * Simulate a license check based on user session state.
 * In production this would call a licensing API or check a local DB record.
 * For now, any authenticated user with an active session is treated as active.
 */
export function checkLicense(): LicenseStatus {
  const session = getSession()

  if (!session || !session.isActive) {
    return { is_active: false, license_type: 'none', expires_at: null }
  }

  // Stub: treat all authenticated users as active trial users
  return {
    is_active: true,
    license_type: 'trial',
    expires_at: session.expiresAt,
  }
}

// ---------------------------------------------------------------------------
// User info
// ---------------------------------------------------------------------------

export interface UserInfo {
  readonly user_id: string
  readonly user_name: string
  readonly email: string
  readonly roles: readonly string[]
  readonly license: LicenseStatus
}

export function getUserInfo(): UserInfo | null {
  const session = getSession()
  if (!session) return null

  return {
    user_id: session.userId,
    user_name: session.userName,
    email: session.email,
    roles: session.roles,
    license: checkLicense(),
  }
}

/**
 * Check if the current user has a valid access token.
 * Useful for gating API calls.
 */
export function hasValidToken(): boolean {
  return getAccessToken() !== null
}
