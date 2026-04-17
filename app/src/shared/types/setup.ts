// =============================================================================
// Setup IPC Types, shared between main (setup/*) and renderer (SetupWizard)
// =============================================================================
//
// Mirror of main/setup/state.ts and main/setup/storage-validation.ts, kept
// here so the renderer can import without pulling in Node-only code paths.
// =============================================================================

import type { IpcResponse } from './ipc'

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

export type LicenseTier = 'trial' | 'solo' | 'practice' | 'enterprise'
export type StorageMode = 'local' | 'network' | 'cloud'
export type Theme = 'light' | 'warm' | 'medium' | 'dark'
export type FontSize = 'small' | 'medium' | 'large'
export type Specialty = 'forensic' | 'clinical' | 'neuro' | 'school' | 'other'

export interface LicenseInfo {
  readonly tier: LicenseTier
  readonly seats: number
  readonly expiresAt: string | null
  readonly activatedAt: string
}

export interface StorageInfo {
  readonly mode: StorageMode
  readonly projectRoot: string
  readonly createdAt: string
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
  readonly logoRelPath: string | null
}

export interface AiConfig {
  readonly provider: 'anthropic' | 'openai' | null
  readonly model: string | null
  readonly configured: boolean
  readonly verifiedAt: string | null
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
// Storage validation
// ---------------------------------------------------------------------------

export type StorageWarningCode =
  | 'CLOUD_SYNC_FOLDER'
  | 'LOW_DISK_SPACE'
  | 'PATH_NOT_EMPTY'

export type StorageErrorCode =
  | 'INVALID_PATH'
  | 'PATH_TRAVERSAL'
  | 'SYSTEM_DIRECTORY'
  | 'NOT_ABSOLUTE'
  | 'PARENT_MISSING'
  | 'NOT_WRITABLE'
  | 'NOT_A_DIRECTORY'

export interface StorageValidationResult {
  readonly ok: boolean
  readonly normalizedPath: string
  readonly errors: readonly { code: StorageErrorCode; message: string }[]
  readonly warnings: readonly { code: StorageWarningCode; message: string }[]
}

// ---------------------------------------------------------------------------
// License validation
// ---------------------------------------------------------------------------

export type LicenseErrorCode =
  | 'MALFORMED'
  | 'UNKNOWN_TIER'
  | 'EXPIRED'
  | 'NETWORK'
  | 'REJECTED'

export type LicenseSource = 'local' | 'remote'

export interface LicenseValidationResult {
  readonly ok: boolean
  readonly license: LicenseInfo | null
  readonly errorCode: LicenseErrorCode | null
  readonly errorMessage: string | null
  readonly source: LicenseSource
  readonly offlineFallback: boolean
}

// ---------------------------------------------------------------------------
// Template provisioning
// ---------------------------------------------------------------------------

export interface ProvisionTemplateResult {
  readonly id: string
  readonly evalType: string
  readonly docxPath: string
  readonly txtPath: string
  readonly bytesWritten: number
  readonly skipped: boolean
  readonly skipReason: string | null
}

export interface SeedWorkspaceResult {
  readonly category: 'writing-samples' | 'documents' | 'testing' | 'forms'
  readonly filename: string
  readonly path: string
  readonly bytesWritten: number
  readonly skipped: boolean
  readonly skipReason: string | null
}

export interface WorkspaceSeedSummary {
  readonly written: number
  readonly skipped: number
  readonly failed: number
  readonly byCategory: Record<string, number>
}

// ---------------------------------------------------------------------------
// Preload API surface for the renderer
// ---------------------------------------------------------------------------

export interface SetupApi {
  readonly getConfig: () => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly reset: () => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly advance: (
    params: { targetState: SetupState },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly validateLicense: (
    params: { key: string },
  ) => Promise<IpcResponse<LicenseValidationResult>>
  readonly saveLicense: (
    params: { license: LicenseInfo },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly validateStoragePath: (
    params: { path: string },
  ) => Promise<IpcResponse<StorageValidationResult>>
  readonly pickStorageFolder: () => Promise<IpcResponse<{ path: string | null }>>
  readonly getDefaultStoragePath: () => Promise<IpcResponse<{ path: string }>>
  readonly provisionStorage: (
    params: { path: string; cloudSyncWarningAcknowledged: boolean },
  ) => Promise<IpcResponse<{ config: SetupConfig; created: readonly string[] }>>
  readonly savePractice: (
    params: { practice: PracticeInfo },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly saveAi: (
    params: { ai: AiConfig },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly saveAppearance: (
    params: { appearance: AppearanceConfig },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly saveClinical: (
    params: { clinical: ClinicalConfig },
  ) => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly provisionTemplates: (
    params?: { overwrite?: boolean },
  ) => Promise<
    IpcResponse<{
      results: readonly ProvisionTemplateResult[]
      workspaceResults: readonly SeedWorkspaceResult[]
      workspaceSummary: WorkspaceSeedSummary
    }>
  >
  readonly getSupportedEvalTypes: () => Promise<
    IpcResponse<{
      evalTypes: readonly string[]
      templates: readonly { id: string; evalType: string; title: string }[]
    }>
  >
  readonly complete: () => Promise<IpcResponse<{ config: SetupConfig }>>
  readonly checkLicenseExpiry: () => Promise<
    IpcResponse<{
      expiry: {
        readonly expired: boolean
        readonly daysRemaining: number
        readonly expiresAt: string
        readonly tier: LicenseTier
      } | null
    }>
  >
}
