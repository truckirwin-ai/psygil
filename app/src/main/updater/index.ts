/**
 * Psygil Auto-Updater
 *
 * Uses Ed25519 signature verification for secure updates.
 * Update artifacts are signed during CI/CD build and verified
 * on the client before installation.
 *
 * Flow:
 * 1. scheduleBackgroundChecks() called from main/index.ts after app.whenReady()
 * 2. Initial check fires after 30s; recurring every 4h
 * 3. checkForUpdates(manual) compares manifest version to current via semver
 * 4. If newer: emits updater:updateAvailable to the renderer
 * 5. downloadAndInstall() downloads, verifies SHA-256 + Ed25519, spawns installer
 * 6. App quits to complete the install
 *
 * CI key injection contract:
 *   The ED25519_PUBLIC_KEY constant in manifest.ts contains a placeholder string
 *   "MCow...PLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000=". The
 *   .github/workflows/app-release.yml build job replaces this with the real
 *   PEM-encoded Ed25519 public key via a sed step before tsc compiles. The
 *   private key (ED25519_PRIVATE_KEY) lives only in GitHub Actions secrets.
 */

import { createHash, createVerify } from 'crypto'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { fetchUpdateManifest, type UpdateManifest } from './manifest'

// Ed25519 public key, embedded in the app binary.
// The private key is kept in CI secrets only.
// Generate with: openssl genpkey -algorithm Ed25519 -out private.pem
//                openssl pkey -in private.pem -pubout -out public.pem
//
// TODO(CI): This constant is replaced at build time via sed in
// .github/workflows/app-release.yml. Do not edit the placeholder below.
const ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000=
-----END PUBLIC KEY-----`

// Update server URL, set via environment or defaults
const UPDATE_SERVER_URL = process.env['PSYGIL_UPDATE_URL'] ?? 'https://updates.psygil.com'

const CHECK_DELAY_MS = 30_000 // 30 seconds after launch
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export interface UpdateAvailableResult {
  readonly version: string
  readonly releaseNotes: string
  readonly downloadSize: number
}

let checkTimer: ReturnType<typeof setInterval> | null = null

// ---------------------------------------------------------------------------
// Semver comparison
// ---------------------------------------------------------------------------

/**
 * Returns true if candidate is strictly newer than current.
 * Only handles standard MAJOR.MINOR.PATCH semver (pre-release tags ignored).
 */
export function isNewerVersion(current: string, candidate: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const parts = v.split('-')[0]?.split('.').map(Number) ?? []
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
  }
  const [cMaj, cMin, cPat] = parse(current)
  const [nMaj, nMin, nPat] = parse(candidate)
  if (nMaj !== cMaj) return nMaj > cMaj
  if (nMin !== cMin) return nMin > cMin
  return nPat > cPat
}

// ---------------------------------------------------------------------------
// Ed25519 verification (kept from original scaffolding)
// ---------------------------------------------------------------------------

/**
 * Verify an Ed25519 signature against a hash.
 */
function verifySignature(hash: string, signature: string): boolean {
  try {
    const isValid = createVerify('ed25519')
      .update(hash)
      .verify(ED25519_PUBLIC_KEY, Buffer.from(signature, 'base64'))
    return isValid
  } catch (err) {
    process.stderr.write(`[updater] Signature verification failed: ${(err as Error).message}\n`)
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

// ---------------------------------------------------------------------------
// Background check scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule background update checks. Call this from main/index.ts after
 * app.whenReady(). Initial check fires after 30s; recurring every 4h.
 */
export function scheduleBackgroundChecks(): void {
  setTimeout(() => {
    checkForUpdates(false).catch((err: unknown) => {
      process.stderr.write(`[updater] Background check error: ${String(err)}\n`)
    })
  }, CHECK_DELAY_MS)

  checkTimer = setInterval(() => {
    checkForUpdates(false).catch((err: unknown) => {
      process.stderr.write(`[updater] Periodic check error: ${String(err)}\n`)
    })
  }, CHECK_INTERVAL_MS)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check for updates. Returns update info if a newer version is available,
 * null otherwise. When manual is true the result should always be surfaced
 * to the user (even "already up to date").
 */
export async function checkForUpdates(
  manual: boolean,
): Promise<UpdateAvailableResult | null> {
  try {
    const channel: 'stable' | 'beta' = 'stable'
    const manifest = await fetchUpdateManifest(channel)
    if (manifest === null) return null

    const currentVersion = getAppVersion()
    if (!isNewerVersion(currentVersion, manifest.version)) {
      return null
    }

    const result: UpdateAvailableResult = {
      version: manifest.version,
      releaseNotes: manifest.releaseNotes ?? '',
      downloadSize: 0, // populated below if we can HEAD the installer
    }

    // Try to get the download size without downloading
    try {
      const headRes = await fetch(manifest.installerUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      })
      const contentLength = headRes.headers.get('content-length')
      if (contentLength !== null) {
        return { ...result, downloadSize: parseInt(contentLength, 10) }
      }
    } catch {
      // Non-fatal, size stays 0
    }

    // Emit event to renderer so UpdateModal can display
    if (!manual) {
      try {
        const { BrowserWindow } = await import('electron')
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          win.webContents.send('updater:updateAvailable', result)
        }
      } catch {
        // Non-fatal if no windows are open yet
      }
    }

    return result
  } catch (err) {
    process.stderr.write(`[updater] checkForUpdates failed: ${String(err)}\n`)
    return null
  }
}

/**
 * Download the installer for the given version, verify SHA-256 and Ed25519,
 * spawn the platform-specific installer, and quit the app.
 *
 * Progress events are emitted as updater:downloadProgress to the renderer.
 */
export async function downloadAndInstall(version: string): Promise<void> {
  const manifest = await fetchUpdateManifest('stable')
  if (manifest === null || manifest.version !== version) {
    throw new Error(`Manifest for version ${version} not available`)
  }

  const { app } = await import('electron')
  const { join } = await import('path')
  const ext = process.platform === 'darwin' ? '.dmg' : process.platform === 'win32' ? '.exe' : '.AppImage'
  const downloadPath = join(app.getPath('temp'), `psygil-update-${version}${ext}`)

  // Emit progress events
  function emitProgress(percent: number, bytesDownloaded: number, totalBytes: number): void {
    try {
      const electron = require('electron') as typeof import('electron')
      const windows = electron.BrowserWindow.getAllWindows()
      for (const win of windows) {
        win.webContents.send('updater:downloadProgress', { percent, bytesDownloaded, totalBytes })
      }
    } catch {
      // Non-fatal
    }
  }

  const res = await fetch(manifest.installerUrl, {
    signal: AbortSignal.timeout(10 * 60 * 1000),
  })
  if (!res.ok || res.body === null) {
    throw new Error(`Download failed: HTTP ${res.status}`)
  }

  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10)
  let bytesDownloaded = 0
  const chunks: Buffer[] = []

  const reader = res.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = Buffer.from(value)
    chunks.push(chunk)
    bytesDownloaded += chunk.length
    const percent = contentLength > 0 ? Math.round((bytesDownloaded / contentLength) * 100) : 0
    emitProgress(percent, bytesDownloaded, contentLength)
  }

  const buffer = Buffer.concat(chunks)
  writeFileSync(downloadPath, buffer)

  // Verify SHA-256
  const computedHash = hashFile(downloadPath)
  if (computedHash !== manifest.installerSha256) {
    unlinkSync(downloadPath)
    throw new Error('SECURITY: Download SHA-256 mismatch, rejecting update')
  }

  // Verify Ed25519 signature
  if (!verifySignature(computedHash, manifest.ed25519Signature)) {
    unlinkSync(downloadPath)
    throw new Error('SECURITY: Update Ed25519 signature verification FAILED, rejecting')
  }

  // Spawn installer and quit
  const { spawn } = await import('child_process')
  if (process.platform === 'darwin') {
    spawn('open', [downloadPath], { detached: true, stdio: 'ignore' }).unref()
  } else if (process.platform === 'win32') {
    spawn(downloadPath, ['/S'], { detached: true, stdio: 'ignore' }).unref()
  } else {
    spawn('sh', ['-c', `chmod +x "${downloadPath}" && "${downloadPath}"`], {
      detached: true,
      stdio: 'ignore',
    }).unref()
  }

  app.quit()
}

/**
 * Check for updates from the update server.
 * Legacy API preserved for backwards compatibility with existing IPC handlers.
 */
export async function checkForUpdatesLegacy(): Promise<{
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
      return { available: false }
    }

    const manifest = (await res.json()) as LegacyUpdateManifest
    const currentVersion = getAppVersion()

    if (!isNewerVersion(currentVersion, manifest.version)) {
      return { available: false }
    }

    const platformKey = `${platform}-${arch}`
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform]

    if (!platformInfo) {
      return { available: false }
    }

    if (!verifySignature(platformInfo.sha256, platformInfo.signature)) {
      process.stderr.write('[updater] SECURITY: Update signature verification FAILED, rejecting update\n')
      return { available: false }
    }

    return {
      available: true,
      version: manifest.version,
      releaseNotes: manifest.releaseNotes,
    }
  } catch (err) {
    process.stderr.write(`[updater] Legacy check failed: ${(err as Error).message}\n`)
    return { available: false }
  }
}

interface LegacyUpdateManifest {
  version: string
  releaseDate: string
  releaseNotes?: string
  platforms: Record<string, {
    url: string
    sha256: string
    signature: string
    size: number
  }>
}

/**
 * Download and verify an update file. Legacy API.
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
    const manifest = (await res.json()) as LegacyUpdateManifest
    const platformKey = `${platform}-${process.arch}`
    const platformInfo = manifest.platforms[platformKey] ?? manifest.platforms[platform]

    if (!platformInfo) return null

    const { app } = await import('electron')
    const { join } = await import('path')
    const downloadPath = join(app.getPath('temp'), `psygil-update-${version}`)

    const dlRes = await fetch(platformInfo.url, {
      signal: AbortSignal.timeout(5 * 60 * 1000),
    })

    if (!dlRes.ok) return null

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    writeFileSync(downloadPath, buffer)

    const computedHash = hashFile(downloadPath)
    if (computedHash !== platformInfo.sha256) {
      process.stderr.write('[updater] SECURITY: Download hash mismatch, rejecting\n')
      unlinkSync(downloadPath)
      return null
    }

    if (!verifySignature(computedHash, platformInfo.signature)) {
      process.stderr.write('[updater] SECURITY: Download signature verification FAILED, rejecting\n')
      unlinkSync(downloadPath)
      return null
    }

    return downloadPath
  } catch (err) {
    process.stderr.write(`[updater] Download failed: ${(err as Error).message}\n`)
    return null
  }
}

/**
 * Start periodic update checks. Legacy API; prefer scheduleBackgroundChecks().
 */
export function startUpdateChecker(): void {
  scheduleBackgroundChecks()
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
    return (require('../../package.json') as { version: string }).version
  } catch {
    return '0.0.0'
  }
}
