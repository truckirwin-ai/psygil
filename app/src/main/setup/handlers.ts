// =============================================================================
// Setup IPC Handlers, exposed to the renderer for the SetupWizard UI
// Source of truth: docs/engineering/17_Setup_Workflow_Spec.md
// =============================================================================
//
// All handlers return the standard IpcResponse envelope used elsewhere in the
// app. None of these handlers accept PHI; the wizard only collects practice
// identity, storage path, license key, and non-secret preferences.
//
// Secrets handled elsewhere:
//   - API key      → ai/key-storage.ts + apiKey:* channels
//   - DB encrypt key → db/connection.ts
//   - License token → (future) stored via safeStorage
// =============================================================================

import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { ok, fail } from '../../shared/types'
import type { IpcResponse } from '../../shared/types'
import {
  loadConfig,
  saveConfig,
  advanceTo,
  freshConfig,
  type SetupConfig,
  type SetupState,
  type PracticeInfo,
  type StorageInfo,
  type AppearanceConfig,
  type ClinicalConfig,
  type AiConfig,
  type LicenseInfo,
} from './state'
import { validateStoragePath, provisionProjectRoot } from './storage-validation'
import type { StorageValidationResult } from './storage-validation'
import { validateLicense } from './license'
import type { LicenseValidationResult } from './license'
import { provisionTemplates, provisionAllTemplates } from './templates/generator'
import type { ProvisionTemplateResult } from './templates/generator'
import { REPORT_TEMPLATES, SUPPORTED_EVAL_TYPES } from './templates/registry'
import {
  seedWorkspaceContent,
  summarizeSeedResults,
  type SeedWorkspaceResult,
} from './workspace-content/seeder'

// ---------------------------------------------------------------------------
// Channel names, centralized so preload can import and typecheck
// ---------------------------------------------------------------------------

export const SETUP_CHANNELS = {
  GET_CONFIG: 'setup:getConfig',
  RESET: 'setup:reset',
  ADVANCE: 'setup:advance',
  VALIDATE_LICENSE: 'setup:validateLicense',
  SAVE_LICENSE: 'setup:saveLicense',
  VALIDATE_STORAGE_PATH: 'setup:validateStoragePath',
  PICK_STORAGE_FOLDER: 'setup:pickStorageFolder',
  DEFAULT_STORAGE_PATH: 'setup:getDefaultStoragePath',
  PROVISION_STORAGE: 'setup:provisionStorage',
  SAVE_PRACTICE: 'setup:savePractice',
  SAVE_APPEARANCE: 'setup:saveAppearance',
  SAVE_CLINICAL: 'setup:saveClinical',
  PROVISION_TEMPLATES: 'setup:provisionTemplates',
  SAVE_AI: 'setup:saveAi',
  GET_SUPPORTED_EVAL_TYPES: 'setup:getSupportedEvalTypes',
  COMPLETE: 'setup:complete',
} as const

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerSetupHandlers(): void {
  // -- Read / reset / advance ------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.GET_CONFIG,
    (): IpcResponse<{ config: SetupConfig }> => {
      try {
        return ok({ config: loadConfig() })
      } catch (err) {
        return fail('SETUP_LOAD_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.RESET,
    (): IpcResponse<{ config: SetupConfig }> => {
      try {
        const fresh = freshConfig()
        saveConfig(fresh)
        return ok({ config: fresh })
      } catch (err) {
        return fail('SETUP_RESET_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.ADVANCE,
    (
      _event,
      params: { targetState: SetupState },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        const next = advanceTo(current, params.targetState)
        saveConfig(next)
        return ok({ config: next })
      } catch (err) {
        return fail('SETUP_ADVANCE_FAILED', (err as Error).message)
      }
    },
  )

  // -- License ---------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.VALIDATE_LICENSE,
    async (
      _event,
      params: { key: string },
    ): Promise<IpcResponse<LicenseValidationResult>> => {
      try {
        const result = await validateLicense(params.key)
        return ok(result)
      } catch (err) {
        return fail('LICENSE_VALIDATE_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.SAVE_LICENSE,
    (
      _event,
      params: { license: LicenseInfo },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        const updated: SetupConfig = advanceTo(
          { ...current, license: params.license },
          'license_entered',
        )
        saveConfig(updated)
        return ok({ config: updated })
      } catch (err) {
        return fail('LICENSE_SAVE_FAILED', (err as Error).message)
      }
    },
  )

  // -- Storage ---------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.VALIDATE_STORAGE_PATH,
    (_event, params: { path: string }): IpcResponse<StorageValidationResult> => {
      try {
        return ok(validateStoragePath(params.path))
      } catch (err) {
        return fail('STORAGE_VALIDATE_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.DEFAULT_STORAGE_PATH,
    (): IpcResponse<{ path: string }> => {
      return ok({ path: getDefaultStoragePath() })
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.PICK_STORAGE_FOLDER,
    async (): Promise<IpcResponse<{ path: string | null }>> => {
      try {
        const parent = BrowserWindow.getFocusedWindow() ?? undefined
        const res = await dialog.showOpenDialog(parent ?? new BrowserWindow({ show: false }), {
          title: 'Choose a folder for Psygil case files',
          properties: ['openDirectory', 'createDirectory'],
          defaultPath: getDefaultStoragePath(),
        })
        if (res.canceled || res.filePaths.length === 0) {
          return ok({ path: null })
        }
        return ok({ path: res.filePaths[0]! })
      } catch (err) {
        return fail('PICK_FOLDER_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.PROVISION_STORAGE,
    (
      _event,
      params: { path: string; cloudSyncWarningAcknowledged: boolean },
    ): IpcResponse<{ config: SetupConfig; created: readonly string[] }> => {
      try {
        const validation = validateStoragePath(params.path)
        if (!validation.ok) {
          return fail(
            'STORAGE_INVALID',
            validation.errors.map((e) => e.message).join('; '),
          )
        }
        // Cloud sync warning gate: user must acknowledge
        const hasCloudWarning = validation.warnings.find(
          (w) => w.code === 'CLOUD_SYNC_FOLDER',
        )
        if (hasCloudWarning !== undefined && !params.cloudSyncWarningAcknowledged) {
          return fail(
            'CLOUD_SYNC_UNACKNOWLEDGED',
            hasCloudWarning.message,
          )
        }

        const created = provisionProjectRoot(validation.normalizedPath)

        const current = loadConfig()
        const storage: StorageInfo = {
          mode: 'local',
          projectRoot: validation.normalizedPath,
          createdAt: new Date().toISOString(),
          cloudSyncWarningAcknowledged: hasCloudWarning !== undefined,
        }
        const updated = advanceTo(
          { ...current, storage },
          'storage_ready',
        )
        saveConfig(updated)
        return ok({ config: updated, created })
      } catch (err) {
        return fail('STORAGE_PROVISION_FAILED', (err as Error).message)
      }
    },
  )

  // -- Practice profile ------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.SAVE_PRACTICE,
    (
      _event,
      params: { practice: PracticeInfo },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const errs = validatePracticeInfo(params.practice)
        if (errs.length > 0) {
          return fail('PRACTICE_INVALID', errs.join('; '))
        }
        const current = loadConfig()
        const updated = advanceTo(
          { ...current, practice: params.practice },
          'profile_done',
        )
        saveConfig(updated)
        return ok({ config: updated })
      } catch (err) {
        return fail('PRACTICE_SAVE_FAILED', (err as Error).message)
      }
    },
  )

  // -- AI --------------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.SAVE_AI,
    (
      _event,
      params: { ai: AiConfig },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        const updated = advanceTo(
          { ...current, ai: params.ai },
          'ai_configured',
        )
        saveConfig(updated)
        return ok({ config: updated })
      } catch (err) {
        return fail('AI_SAVE_FAILED', (err as Error).message)
      }
    },
  )

  // -- Appearance ------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.SAVE_APPEARANCE,
    (
      _event,
      params: { appearance: AppearanceConfig },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        const updated = advanceTo(
          { ...current, appearance: params.appearance },
          'prefs_done',
        )
        saveConfig(updated)
        return ok({ config: updated })
      } catch (err) {
        return fail('APPEARANCE_SAVE_FAILED', (err as Error).message)
      }
    },
  )

  // -- Clinical + template provisioning -------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.SAVE_CLINICAL,
    (
      _event,
      params: { clinical: ClinicalConfig },
    ): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        const updated = advanceTo(
          { ...current, clinical: params.clinical },
          'clinical_done',
        )
        saveConfig(updated)
        return ok({ config: updated })
      } catch (err) {
        return fail('CLINICAL_SAVE_FAILED', (err as Error).message)
      }
    },
  )

  ipcMain.handle(
    SETUP_CHANNELS.PROVISION_TEMPLATES,
    async (
      _event,
      params: { overwrite?: boolean } | undefined,
    ): Promise<
      IpcResponse<{
        results: readonly ProvisionTemplateResult[]
        workspaceResults: readonly SeedWorkspaceResult[]
        workspaceSummary: {
          written: number
          skipped: number
          failed: number
          byCategory: Record<string, number>
        }
      }>
    > => {
      try {
        const config = loadConfig()
        if (config.storage === null) {
          return fail('NO_STORAGE', 'Storage must be configured before provisioning templates.')
        }
        if (config.practice === null) {
          return fail('NO_PRACTICE', 'Practice information must be saved before provisioning templates.')
        }
        const selected = config.clinical?.evalTypes ?? SUPPORTED_EVAL_TYPES

        // 1. Write the 7 report templates into /Workspace/Templates/
        const results = await provisionTemplates({
          projectRoot: config.storage.projectRoot,
          practice: config.practice,
          selectedEvalTypes: selected,
          overwrite: params?.overwrite === true,
        })

        // 2. Seed the rest of /Workspace/ (Writing Samples, Documents,
        //    Testing, Forms) so the clinician has a fully-featured first run.
        let workspaceResults: readonly SeedWorkspaceResult[] = []
        let workspaceSummary = {
          written: 0,
          skipped: 0,
          failed: 0,
          byCategory: {} as Record<string, number>,
        }
        try {
          workspaceResults = await seedWorkspaceContent({
            projectRoot: config.storage.projectRoot,
            practice: config.practice,
            overwrite: params?.overwrite === true,
          })
          workspaceSummary = summarizeSeedResults(workspaceResults)
        } catch (seedErr) {
          // Non-fatal: templates are still provisioned; the clinician can
          // retry workspace seeding later from Settings if we add that path.
          console.error('[setup] Workspace content seeding failed:', seedErr)
        }

        return ok({ results, workspaceResults, workspaceSummary })
      } catch (err) {
        return fail('TEMPLATE_PROVISION_FAILED', (err as Error).message)
      }
    },
  )

  // -- Registry --------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.GET_SUPPORTED_EVAL_TYPES,
    (): IpcResponse<{
      evalTypes: readonly string[]
      templates: readonly { id: string; evalType: string; title: string }[]
    }> => {
      return ok({
        evalTypes: [...SUPPORTED_EVAL_TYPES],
        templates: REPORT_TEMPLATES.map((t) => ({
          id: t.id,
          evalType: t.evalType,
          title: t.title,
        })),
      })
    },
  )

  // -- Complete --------------------------------------------------------------

  ipcMain.handle(
    SETUP_CHANNELS.COMPLETE,
    (): IpcResponse<{ config: SetupConfig }> => {
      try {
        const current = loadConfig()
        // Guard: must have the three minimum-viable steps done. AI,
        // appearance preferences, and clinical preferences are optional
        // at first-run and get configured post-setup via Settings. The
        // FirstRunModal contract only collects name, license, storage.
        const required: SetupState[] = [
          'license_entered',
          'storage_ready',
          'profile_done',
        ]
        for (const s of required) {
          // Using state.ts helpers would introduce a cycle; check by name
          // via loadConfig's state rank:
          const currentIdx = current.setupState
          if (rank(currentIdx) < rank(s)) {
            return fail(
              'SETUP_INCOMPLETE',
              `Cannot complete setup: current state is '${current.setupState}', missing '${s}'.`,
            )
          }
        }
        const updated = advanceTo(current, 'complete')
        saveConfig(updated)

        // The DB was opened from the OLD path during this launch (or from
        // userData on a fresh install). To pick up the new {projectRoot}/
        // .psygil/psygil.db location, we need the process to restart.
        //
        // In packaged mode we use app.relaunch() + app.exit(0), clean.
        //
        // In dev mode that's catastrophic: the renderer is served by Vite
        // which is owned by the parent `npm run dev` process, and exiting
        // Electron kills that whole chain. The relaunched Electron then
        // has no Vite server to load from → blank window.
        //
        // So in dev we log instructions and leave the DB alone; the user
        // can Cmd+R the renderer and will see the old data until they
        // manually restart `npm run dev`. Tell them clearly.
        if (app.isPackaged) {
          setTimeout(() => {
            try {
              app.relaunch()
              app.exit(0)
            } catch (err) {
              console.error('[setup] Failed to relaunch after complete:', err)
            }
          }, 400)
        }

        return ok({ config: updated })
      } catch (err) {
        return fail('SETUP_COMPLETE_FAILED', (err as Error).message)
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function getDefaultStoragePath(): string {
  // ~/Documents/Psygil, with Electron's userData fallback on exotic setups
  try {
    const docs = app.getPath('documents')
    return join(docs, 'Psygil')
  } catch {
    return join(homedir(), 'Documents', 'Psygil')
  }
}

function validatePracticeInfo(p: PracticeInfo): string[] {
  // Only the name and specialty are required at first-run. credentials,
  // licenseNumber, and licenseState are collected post-first-run via
  // Settings > Practice (or surfaced inline on the report signature block
  // when the user publishes a report). Keeping those empty is a valid
  // intermediate state so the minimum viable first-run flow stays short.
  const errors: string[] = []
  if (typeof p.fullName !== 'string' || p.fullName.trim().length === 0) {
    errors.push('Full name is required')
  }
  const validSpecialties = ['forensic', 'clinical', 'neuro', 'school', 'other']
  if (!validSpecialties.includes(p.specialty)) {
    errors.push(`Specialty must be one of: ${validSpecialties.join(', ')}`)
  }
  return errors
}

// Local rank function to avoid importing from state.ts inside the handler
// closure (keeps this file self-contained for tests).
function rank(state: SetupState): number {
  const order: SetupState[] = [
    'fresh',
    'sidecar_verified',
    'license_entered',
    'storage_ready',
    'profile_done',
    'ai_configured',
    'prefs_done',
    'clinical_done',
    'complete',
  ]
  return order.indexOf(state)
}
