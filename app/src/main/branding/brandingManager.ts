/**
 * Branding manager for Psygil white-label support.
 *
 * Stores practice branding (name, logo, colors, tagline) as a JSON file at:
 *   app.getPath('userData')/psygil-branding.json
 *
 * Logo files are copied to:
 *   app.getPath('userData')/branding/logo.<ext>
 *
 * ASSUMPTION: Storing branding in userData JSON rather than practice_config DB table,
 * because practice_config is designed for multi-practice RBAC with practice_id PK.
 * A JSON file is isolated, simpler, and consistent with how style profiles are stored.
 * Impact if wrong: minimal — branding.json can be trivially migrated to DB later.
 */

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PracticeBranding {
  practiceName: string
  logoPath?: string      // absolute path to stored logo file
  logoData?: string      // base64-encoded logo (for embedding in exports)
  primaryColor: string   // hex color, e.g. '#2E75B6'
  tagline?: string
  showAttribution: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function getBrandingFilePath(): string {
  return path.join(app.getPath('userData'), 'psygil-branding.json')
}

function getBrandingLogoDir(): string {
  return path.join(app.getPath('userData'), 'branding')
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns Psygil default branding values.
 */
export function getDefaultBranding(): PracticeBranding {
  return {
    practiceName: '',
    logoPath: undefined,
    logoData: undefined,
    primaryColor: '#4f46e5',
    tagline: undefined,
    showAttribution: true,
  }
}

/**
 * Load saved branding from disk. Falls back to defaults if file doesn't exist or is invalid.
 */
export async function getBranding(): Promise<PracticeBranding> {
  const filePath = getBrandingFilePath()
  try {
    if (!fs.existsSync(filePath)) {
      return getDefaultBranding()
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PracticeBranding>

    // Merge with defaults to handle missing keys from older versions
    const defaults = getDefaultBranding()
    const branding: PracticeBranding = {
      practiceName: parsed.practiceName ?? defaults.practiceName,
      logoPath: parsed.logoPath ?? defaults.logoPath,
      logoData: parsed.logoData ?? defaults.logoData,
      primaryColor: parsed.primaryColor ?? defaults.primaryColor,
      tagline: parsed.tagline ?? defaults.tagline,
      showAttribution: parsed.showAttribution ?? defaults.showAttribution,
    }

    // Re-read logo data if logoPath exists but logoData is stale/missing
    if (branding.logoPath && fs.existsSync(branding.logoPath) && !branding.logoData) {
      try {
        const logoBuffer = fs.readFileSync(branding.logoPath)
        branding.logoData = logoBuffer.toString('base64')
      } catch {
        // Non-fatal — logo data stays undefined
      }
    }

    return branding
  } catch (e) {
    console.error('[brandingManager] Failed to read branding file:', e)
    return getDefaultBranding()
  }
}

/**
 * Save branding config to disk.
 */
export async function saveBranding(branding: PracticeBranding): Promise<void> {
  const filePath = getBrandingFilePath()
  try {
    const json = JSON.stringify(branding, null, 2)
    fs.writeFileSync(filePath, json, 'utf-8')
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save branding'
    console.error('[brandingManager] Save failed:', message)
    throw new Error(message)
  }
}

/**
 * Copy a logo image from sourcePath into the managed branding directory.
 * Reads it as base64 and updates the branding JSON.
 * Returns the stored absolute path.
 */
export async function saveLogo(sourcePath: string): Promise<string> {
  const logoDir = getBrandingLogoDir()

  // Ensure branding directory exists
  if (!fs.existsSync(logoDir)) {
    fs.mkdirSync(logoDir, { recursive: true })
  }

  const ext = path.extname(sourcePath).toLowerCase() || '.png'
  const destPath = path.join(logoDir, `logo${ext}`)

  try {
    // Copy logo file
    fs.copyFileSync(sourcePath, destPath)

    // Read as base64 for embedding
    const logoBuffer = fs.readFileSync(destPath)
    const logoData = logoBuffer.toString('base64')

    // Update branding JSON with new logo info
    const current = await getBranding()
    current.logoPath = destPath
    current.logoData = logoData
    await saveBranding(current)

    return destPath
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to save logo'
    console.error('[brandingManager] Logo save failed:', message)
    throw new Error(message)
  }
}
