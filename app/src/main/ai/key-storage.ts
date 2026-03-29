/**
 * Psygil API Key Storage
 *
 * Manages secure storage of Claude API key using Electron safeStorage.
 * Keys are encrypted using the OS keychain (macOS Keychain, Windows DPAPI, Linux Secret Service).
 *
 * Spec reference: docs/engineering/02_ipc_api_contracts.md (Boundary 3)
 */

import { safeStorage, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// Encrypted API key file stored in app userData directory
const getKeyPath = (): string => {
  return path.join(app.getPath('userData'), 'psygil-api-key.enc')
}

/**
 * Check if encryption is available on this platform.
 * safeStorage requires OS-level credential storage (macOS Keychain, Windows DPAPI, Linux Secret Service).
 */
function checkEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Encryption not available: OS credential storage unavailable. ' +
      'API keys cannot be stored securely on this system.'
    )
  }
}

/**
 * Store API key securely using Electron's safeStorage.
 * The key is encrypted using the OS keychain (macOS) or equivalent.
 * Encrypted buffer is written to {userData}/psygil-api-key.enc
 *
 * @param key - The API key to store
 * @throws Error if encryption is not available or write fails
 */
export function storeApiKey(key: string): void {
  checkEncryptionAvailable()

  if (!key || key.trim().length === 0) {
    throw new Error('API key cannot be empty')
  }

  const encrypted = safeStorage.encryptString(key)
  const keyPath = getKeyPath()

  try {
    fs.writeFileSync(keyPath, encrypted, { mode: 0o600 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to write key file'
    throw new Error(`Failed to store API key: ${message}`)
  }
}

/**
 * Retrieve stored API key from encrypted storage.
 * Returns null if no key is stored.
 *
 * @returns The decrypted API key, or null if not stored
 * @throws Error if encryption is not available or decryption fails
 */
export function retrieveApiKey(): string | null {
  checkEncryptionAvailable()

  const keyPath = getKeyPath()

  if (!fs.existsSync(keyPath)) {
    return null
  }

  try {
    const encrypted = fs.readFileSync(keyPath)
    const decrypted = safeStorage.decryptString(encrypted)
    return decrypted
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to decrypt key'
    throw new Error(`Failed to retrieve API key: ${message}`)
  }
}

/**
 * Check if an API key is currently stored.
 *
 * @returns true if a key file exists, false otherwise
 */
export function hasApiKey(): boolean {
  const keyPath = getKeyPath()
  return fs.existsSync(keyPath)
}

/**
 * Delete the stored API key file.
 *
 * @returns true if deletion succeeded, false if no key was stored
 * @throws Error if deletion fails
 */
export function deleteApiKey(): boolean {
  const keyPath = getKeyPath()

  if (!fs.existsSync(keyPath)) {
    return false
  }

  try {
    fs.unlinkSync(keyPath)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete key file'
    throw new Error(`Failed to delete API key: ${message}`)
  }
}
