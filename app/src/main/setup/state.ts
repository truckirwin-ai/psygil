// =============================================================================
// Setup State Machine, tracks wizard progress across launches
// Source of truth: docs/engineering/17_Setup_Workflow_Spec.md §"Setup State Machine"
// =============================================================================
//
// Every setup decision is persisted so the wizard can resume if interrupted.
// State transitions are strictly linear, you cannot skip ahead, but you can
// re-enter a completed state to edit it (e.g. from Settings).
//
// HIPAA INVARIANT: No PHI is ever written to config.json. Only metadata about
// setup progress, storage location, practice identity, and non-secret
// preferences. All secrets (DB encryption key, API key, license token) live
// in the OS keychain via Electron safeStorage.
// =============================================================================

import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { app } from 'electron'

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export const SETUP_STATES = [
  'fresh',
  'sidecar_verified',
  'license_entered',
  'storage_ready',
  'profile_done',
  'ai_configured',
  'prefs_done',
  'clinical_done',
  'complete',
] as const

export type SetupState = (typeof SETUP_STATES)[number]

/**
 * Linear order of states. A given state implies all earlier states are done.
 * This lets callers ask "is state X at least as far as Y?" with indexOf.
 */
export function stateRank(state: SetupState): number {
  return SETUP_STATES.indexOf(state)
}

export function isAtLeast(current: SetupState, target: SetupState): boolean {
  return stateRank(current) >= stateRank(target)
}

export function nextState(current: SetupState): SetupState {
  const idx = stateRank(current)
  if (idx < 0 || idx >= SETUP_STATES.length - 1) return current
  return SETUP_STATES[idx + 1]!
}

// ---------------------------------------------------------------------------
// Config shape, written to {userData}/config.json during wizard
// After "storage_ready", a mirror is also written to {project_root}/.psygil/config.json
// ---------------------------------------------------------------------------

export type LicenseTier = 'trial' | 'solo' | 'practice' | 'enterprise'
export type StorageMode = 'local' | 'network' | 'cloud'
export type Theme = 'light' | 'medium' | 'dark'
export type FontSize = 'small' | 'medium' | 'large'
export type Specialty = 'forensic' | 'clinical' | 'neuro' | 'school' | 'other'

export interface LicenseInfo {
  readonly tier: LicenseTier
  readonly seats: number
  readonly expiresAt: string | null // ISO date, null for perpetual
  readonly activatedAt: string // ISO timestamp
}

export interface StorageInfo {
  readonly mode: StorageMode
  readonly projectRoot: string
  readonly createdAt: string // ISO timestamp
  readonly cloudSyncWarningAcknowledged: boolean
}

export interface PracticeInfo {
  readonly fullName: string
  readonly credentials: string
  readonly licenseNumber: string
  readonly licenseState: string
  readonly specialty: Specialty
  readonly practiceName: string | null
  readonly npi: string | null
  readonly practiceAddress: string | null
  readonly phone: string | null
  readonly logoRelPath: string | null // relative to projectRoot, e.g. ".psygil/assets/logo.png"
}

export interface AiConfig {
  readonly mode: 'passthrough' | 'byok'
  readonly provider: 'anthropic' | 'openai' | 'google' | null
  readonly model: string | null
  readonly configured: boolean // true if passthrough licensed OR BYOK key stored + UNID pipeline verified
  readonly verifiedAt: string | null // ISO timestamp of last successful verification
}

export interface AppearanceConfig {
  readonly theme: Theme
  readonly fontSize: FontSize
  readonly editorFont: 'system' | 'monospace'
  readonly sidebarDefault: 'expanded' | 'collapsed'
}

export interface ClinicalConfig {
  readonly evalTypes: readonly string[]
  readonly instruments: readonly string[]
}

export interface SetupConfig {
  readonly version: 1
  readonly setupState: SetupState
  readonly createdAt: string
  readonly updatedAt: string
  readonly license: LicenseInfo | null
  readonly storage: StorageInfo | null
  readonly practice: PracticeInfo | null
  readonly ai: AiConfig | null
  readonly appearance: AppearanceConfig | null
  readonly clinical: ClinicalConfig | null
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function freshConfig(): SetupConfig {
  const now = new Date().toISOString()
  return {
    version: 1,
    setupState: 'fresh',
    createdAt: now,
    updatedAt: now,
    license: null,
    storage: null,
    practice: null,
    ai: null,
    appearance: null,
    clinical: null,
  }
}

// ---------------------------------------------------------------------------
// Paths, userData config + project root mirror
// ---------------------------------------------------------------------------

/**
 * User-data config path, lives with the Electron app per-OS-user.
 * This is the FIRST location checked on launch.
 */
export function getUserDataConfigPath(): string {
  return join(app.getPath('userData'), 'psygil-setup.json')
}

/**
 * Project root mirror config path, written after storage is configured.
 * This lives inside {project_root}/.psygil/config.json so the setup state
 * travels with the workspace when moved or shared on a network drive.
 */
export function getProjectConfigPath(projectRoot: string): string {
  return join(projectRoot, '.psygil', 'config.json')
}

// ---------------------------------------------------------------------------
// Read / write, userData config
// ---------------------------------------------------------------------------

/**
 * Load config from userData. Returns a fresh config if file missing or corrupt.
 * Corruption is logged but does not throw, setup can always start over.
 */
export function loadConfig(): SetupConfig {
  const path = getUserDataConfigPath()
  if (!existsSync(path)) return freshConfig()
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SetupConfig>
    // Shallow merge with freshConfig to tolerate older shapes
    const base = freshConfig()
    return {
      ...base,
      ...parsed,
      version: 1,
      setupState: isValidState(parsed.setupState) ? parsed.setupState : 'fresh',
      createdAt: parsed.createdAt ?? base.createdAt,
      updatedAt: parsed.updatedAt ?? base.updatedAt,
    }
  } catch (err) {
    console.error('[setup/state] Failed to parse config, starting fresh:', err)
    return freshConfig()
  }
}

function isValidState(s: unknown): s is SetupState {
  return typeof s === 'string' && (SETUP_STATES as readonly string[]).includes(s)
}

/**
 * Persist config atomically to userData and (if storage configured) to the
 * project root mirror. Always updates the updatedAt timestamp.
 */
export function saveConfig(config: SetupConfig): void {
  const stamped: SetupConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  }
  const userDataPath = getUserDataConfigPath()
  ensureParentDir(userDataPath)
  writeAtomic(userDataPath, JSON.stringify(stamped, null, 2))

  if (stamped.storage !== null) {
    try {
      const mirror = getProjectConfigPath(stamped.storage.projectRoot)
      ensureParentDir(mirror)
      writeAtomic(mirror, JSON.stringify(stamped, null, 2))
    } catch (err) {
      // Mirror write is best-effort, userData config is the source of truth.
      // A missing mirror does not break setup.
      console.warn('[setup/state] Failed to write project mirror config:', err)
    }
  }
}

function ensureParentDir(filePath: string): void {
  const parent = join(filePath, '..')
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true })
}

function writeAtomic(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`
  writeFileSync(tmp, content, 'utf-8')
  // On Windows, renameSync over an existing file can fail. Use a defensive
  // approach: try rename, fall back to overwrite.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { renameSync } = require('fs') as typeof import('fs')
    renameSync(tmp, filePath)
  } catch {
    writeFileSync(filePath, content, 'utf-8')
  }
}

// ---------------------------------------------------------------------------
// Helpers for advancing state
// ---------------------------------------------------------------------------

/**
 * Mark a specific state as reached. Does NOT downgrade, if the current
 * state is already further than the target, the current state is preserved.
 * This makes it safe to re-enter completed steps during reconfiguration.
 */
export function advanceTo(config: SetupConfig, target: SetupState): SetupConfig {
  if (stateRank(config.setupState) >= stateRank(target)) return config
  return { ...config, setupState: target }
}

export function isSetupComplete(config: SetupConfig): boolean {
  return config.setupState === 'complete'
}
