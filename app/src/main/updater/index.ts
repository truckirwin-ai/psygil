/**
 * Psygil Auto-Updater
 *
 * Uses Ed25519 signature verification for secure updates.
 * Update artifacts are signed during CI/CD build and verified
 * on the client before installation.
 *
 * Flow:
 * 1. On app launch (after 30s delay), check for updates
 * 2. Download update if available
 * 3. Verify Ed25519 signature against embedded public key
 * 4. Prompt user to install
 * 5. Restart app after installation
 */

import { createHash, createVerify } from 'crypto'
import { readFileSync } from 'fs'

// Ed25519 public key — embedded in the app binary.
// The private key is kept in CI secrets only.
// Generate with: openssl genpkey -algorithm Ed25519 -out private.pem
//                openssl pkey -in private.pem -pubout -out public.pem
const ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000=
-----END PUBLIC KEY-----`

// Update server URL — set via environment or defaults
const UPDATE_SERVER_URL = process.env.PSYGIL_UPDATE_URL || 'https://updates.psygil.com'

const CHECK_DELAY_MS = 30_000 // 30 seconds after launch
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

interface UpdateManifest {
  version: string
  releaseDate: string
  releaseNotes?: string
  platforms: Record<string, {
    url: string
    sha256: string
    signature: string  // Ed25519 signature of the sha256 hash
    size: number
  }>
}

let checkTimer: ReturnType<typeof setInterval> | null = null

/**
 * Verify an Ed25519 signature against a hash.
 */
function verifySignature(hash: string, signature: string): boolean {
  try {
    const isValid = createVerify('ed25519').update(hash).verify(ED25519_PUBLIC_KEY, Buffer.from(signature, 'base64'))
    return isValid
  } catch (err) {
    console.error('[updater] Signature verification failed:', (err as Error).message)
    return false
  }
}

/**
 * Compute SHA-256 hash of a file.
 */
function hashFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Check for updates from the update server.
 */
export async function checkForUpdates(): Promise<{
  available: boolean
  version?: string
  releaseNotes?: string
}> {
  try {
    const platform = process.platform === 'darwin' ? 'mac'
      : process.platform === 'win32' ? 'win'
        : 'linux'
    const arch = process.arch

    const res = await fetch(`${UPDATE_SERVER_URL}/latest.json`, {
      headers: { 'User-Agent': `Psygil/${getAppVersion()}` },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.log('[updater] No update available (HTTP', res.status, ')')
      return { available: false }
    }

    const manifest: UpdateManifest = await res.json() as UpdateManifest
    const currentVersion = getAppVersion()

    if (manifest.version === currentVersion) {
      return { available: false }
    }

    const platformKey = `${platform}-${arch}`
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform]

    if (!platformInfo) {
      console.log(`[updater] No update for platform ${platformKey}`)
      return { available: false }
    }

    // Verify the signature of the manifest's SHA-256 hash
    if (!verifySignature(platformInfo.sha256, platformInfo.signature)) {
      console.error('[updater] SECURITY: Update signature verification FAILED — rejecting update')
      return { available: false }
    }

    console.log(`[updater] Update available: ${currentVersion} → ${manifest.version}`)
    return {
      available: true,
      version: manifest.version,
      releaseNotes: manifest.releaseNotes,
    }
  } catch (err) {
    console.error('[updater] Check failed:', (err as Error).message)
    return { available: false }
  }
}

/**
 * Download and verify an update file.
 * Returns the path to the verified download, or null if verification fails.
 */
export async function downloadUpdate(version: string): Promise<string | null> {
  try {
    const platform = process.platform === 'darwin' ? 'mac'
      : process.platform === 'win32' ? 'win'
        : 'linux'

    const res = await fetch(`${UPDATE_SERVER_URL}/latest.json`, {
      signal: AbortSignal.timeout(10_000),
    })
    const manifest: UpdateManifest = await res.json() as UpdateManifest
    const platformKey = `${platform}-${process.arch}`
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform]

    if (!platformInfo) return null

    // Download the update binary
    const { app } = await import('electron')
    const downloadPath = require('path').join(app.getPath('temp'), `psygil-update-${version}`)

    const dlRes = await fetch(platformInfo.url, {
      signal: AbortSignal.timeout(5 * 60 * 1000), // 5 min timeout
    })

    if (!dlRes.ok) return null

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    const { writeFileSync } = await import('fs')
    writeFileSync(downloadPath, buffer)

    // Verify SHA-256 hash
    const computedHash = hashFile(downloadPath)
    if (computedHash !== platformInfo.sha256) {
      console.error('[updater] SECURITY: Download hash mismatch — rejecting')
      const { unlinkSync } = await import('fs')
      unlinkSync(downloadPath)
      return null
    }

    // Verify Ed25519 signature
    if (!verifySignature(computedHash, platformInfo.signature)) {
      console.error('[updater] SECURITY: Download signature verification FAILED — rejecting')
      const { unlinkSync } = await import('fs')
      unlinkSync(downloadPath)
      return null
    }

    console.log('[updater] Download verified:', downloadPath)
    return downloadPath
  } catch (err) {
    console.error('[updater] Download failed:', (err as Error).message)
    return null
  }
}

/**
 * Start periodic update checks.
 */
export function startUpdateChecker(): void {
  // Initial check after delay
  setTimeout(() => {
    void checkForUpdates()
  }, CHECK_DELAY_MS)

  // Periodic checks
  checkTimer = setInterval(() => {
    void checkForUpdates()
  }, CHECK_INTERVAL_MS)
}

/**
 * Stop periodic update checks.
 */
export function stopUpdateChecker(): void {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}

/**
 * Get the current app version.
 */
export function getAppVersion(): string {
  try {
    return require('../../package.json').version as string
  } catch {
    return '0.0.0'
  }
}
