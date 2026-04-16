// Refresh token persistence via Electron safeStorage.
// Mirrors the pattern in src/main/ai/key-storage.ts exactly.

import { safeStorage, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

function getRefreshTokenPath(): string {
  return path.join(app.getPath('userData'), 'auth', 'refresh.bin')
}

function ensureAuthDir(): void {
  const dir = path.dirname(getRefreshTokenPath())
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  }
}

/**
 * Encrypt and persist the Auth0 refresh token to disk.
 * Uses the same safeStorage approach as the API key store.
 */
export async function storeRefreshToken(token: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption unavailable: refresh token cannot be stored securely')
  }
  if (!token || token.trim().length === 0) {
    throw new Error('Refresh token cannot be empty')
  }
  ensureAuthDir()
  const encrypted = safeStorage.encryptString(token)
  try {
    fs.writeFileSync(getRefreshTokenPath(), encrypted, { mode: 0o600 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'write failed'
    throw new Error(`Failed to store refresh token: ${msg}`)
  }
}

/**
 * Read and decrypt the stored refresh token.
 * Returns null if no file exists or decryption fails.
 */
export async function retrieveRefreshToken(): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) {
    return null
  }
  const tokenPath = getRefreshTokenPath()
  if (!fs.existsSync(tokenPath)) {
    return null
  }
  try {
    const encrypted = fs.readFileSync(tokenPath)
    return safeStorage.decryptString(encrypted)
  } catch {
    return null
  }
}

/**
 * Delete the stored refresh token file.
 */
export async function clearRefreshToken(): Promise<void> {
  const tokenPath = getRefreshTokenPath()
  if (!fs.existsSync(tokenPath)) {
    return
  }
  try {
    fs.unlinkSync(tokenPath)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unlink failed'
    process.stderr.write(`[keychain/session] clearRefreshToken: ${msg}\n`)
  }
}
