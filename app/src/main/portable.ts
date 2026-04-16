/**
 * Portable-install detection and userData redirection.
 *
 * When Psygil finds a file or folder named `.psygil-portable` next to the
 * installed .app bundle (or the Windows install directory, or the Linux
 * install directory), the app stores all user data inside a sibling
 * folder named `Psygil-Data/` instead of the OS default.
 *
 * This turns any drag-drop location (including a USB stick or a
 * per-project folder) into a self-contained install. Cases, config,
 * Auth0 refresh token, API key, and workspace all live next to the app.
 *
 * Detection must run BEFORE app.whenReady() so every subsequent
 * app.getPath('userData') call returns the redirected path.
 */

import { app } from 'electron'
import { dirname, join, resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'

export interface PortableState {
  readonly isPortable: boolean
  readonly installDir: string | null
  readonly portableDataDir: string | null
}

let cached: PortableState | null = null

/**
 * Resolve the directory that contains the installed app (on macOS this
 * is the directory the user dropped Psygil.app into; on Windows and
 * Linux it is the install directory). In dev mode returns null.
 */
function resolveInstallDir(): string | null {
  if (!app.isPackaged) return null

  const execPath = process.execPath

  if (process.platform === 'darwin') {
    // execPath = /path/to/Psygil.app/Contents/MacOS/Psygil
    // .app bundle = /path/to/Psygil.app
    // install dir = /path/to
    const appBundle = resolve(execPath, '..', '..', '..')
    return dirname(appBundle)
  }

  // Windows: exec is in install dir (electron-builder NSIS default).
  // Linux: exec is alongside resources/ in install dir.
  return dirname(execPath)
}

/**
 * Detect the `.psygil-portable` marker and, if present, redirect
 * app.getPath('userData') to a sibling `Psygil-Data/` folder. Must be
 * called before app.whenReady() so every consumer of userData (database
 * connection, keychain, setup state, workspace config) picks up the
 * redirected path on first access.
 */
export function configurePortableMode(): PortableState {
  if (cached !== null) return cached

  const installDir = resolveInstallDir()
  if (installDir === null) {
    cached = { isPortable: false, installDir: null, portableDataDir: null }
    return cached
  }

  const marker = join(installDir, '.psygil-portable')
  if (!existsSync(marker)) {
    cached = { isPortable: false, installDir, portableDataDir: null }
    return cached
  }

  const portableDataDir = join(installDir, 'Psygil-Data')
  try {
    mkdirSync(portableDataDir, { recursive: true })
  } catch (e) {
    process.stderr.write(
      `[portable] Could not create ${portableDataDir}: ${(e as Error).message}. Falling back to OS default userData path.\n`,
    )
    cached = { isPortable: false, installDir, portableDataDir: null }
    return cached
  }

  app.setPath('userData', portableDataDir)

  // Expose for downstream diagnostics without coupling to this module.
  process.env.PSYGIL_PORTABLE = '1'
  process.env.PSYGIL_INSTALL_DIR = installDir
  process.env.PSYGIL_DATA_DIR = portableDataDir

  cached = { isPortable: true, installDir, portableDataDir }
  return cached
}

/**
 * Read-only accessor for diagnostics. Returns null if configurePortableMode
 * has not yet been called (should never happen in production).
 */
export function getPortableState(): PortableState | null {
  return cached
}
