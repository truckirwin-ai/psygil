import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import type {
  IpcResponse,
  CasesListParams,
  CasesListResult,
  CasesGetParams,
  CasesGetResult,
  CasesCreateParams,
  CasesCreateResult,
  CasesArchiveParams,
  CasesArchiveResult,
  IntakeSaveParams,
  IntakeGetParams,
  PatientIntakeRow,
  OnboardingSaveParams,
  OnboardingGetParams,
  PatientOnboardingRow,
  DbHealthResult,
  AuthLoginResult,
  AuthGetStatusResult,
  AuthLogoutResult,
  ConfigGetParams,
  ConfigGetResult,
  ConfigSetParams,
  ConfigSetResult,
  PiiDetectParams,
  PiiDetectResult,
  PiiBatchDetectParams,
  PiiBatchDetectResult,
  PiiRedactParams,
  PiiRedactResult,
  PiiRehydrateParams,
  PiiRehydrateResult,
  PiiDestroyParams,
  PiiDestroyResult,
  FolderNode,
  IngestFileParams,
  DocumentsGetParams,
  DocumentsListParams,
  DocumentsDeleteParams,
  DocumentRow,
  ApiKeyStoreParams,
  ApiKeyStoreResult,
  ApiKeyRetrieveResult,
  ApiKeyDeleteResult,
  ApiKeyHasResult,
  AiCompleteParams,
  AiCompleteResult,
  AiTestConnectionParams,
  AiTestConnectionResult,
} from '../../shared/types'
import { getAuthStatus } from '../auth'
import { performLogin } from '../auth/login'
import { performLogout } from '../auth/logout'
import { checkLicense } from '../auth/user'
import {
  loadWorkspacePath,
  saveWorkspacePath,
  createFolderStructure,
  watchWorkspace,
  syncWorkspaceToDB,
  getWorkspaceTree,
  getDefaultWorkspacePath
} from '../workspace'
import { detect, batchDetect, redact, rehydrate, destroyMap } from '../pii'
import {
  createCase,
  listCases,
  getCaseById,
  archiveCase,
  saveIntake,
  getIntake,
  saveOnboardingSection,
  getOnboardingSections,
} from '../cases'
import {
  ingestFile,
  getDocument,
  listDocuments,
  deleteDocument,
} from '../documents'
import {
  storeApiKey,
  retrieveApiKey,
  deleteApiKey,
  hasApiKey,
} from '../ai/key-storage'
import { registerAiHandlers } from '../ai/ai-handlers'
import { registerAgentHandlers } from '../agents'
import { registerPipelineHandlers } from '../pipeline/pipeline-handlers'

// ---------------------------------------------------------------------------
// Stub helper — returns a typed success envelope
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResponse<T> {
  return { status: 'success', data }
}

function fail(error_code: string, message: string): IpcResponse<never> {
  return { status: 'error', error_code, message }
}

// ---------------------------------------------------------------------------
// Cases handlers
// ---------------------------------------------------------------------------

function registerCasesHandlers(): void {
  ipcMain.handle(
    'cases:list',
    (_event, _params?: CasesListParams): IpcResponse<CasesListResult> => {
      try {
        const cases = listCases()
        console.log('[cases:list] returning', cases.length, 'cases')
        return ok({ cases, total: cases.length })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to list cases'
        console.error('[cases:list] error:', message)
        return fail('CASES_LIST_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'cases:get',
    (_event, params: CasesGetParams): IpcResponse<CasesGetResult> => {
      try {
        const row = getCaseById(params.case_id)
        if (row === null) {
          return fail('CASE_NOT_FOUND', `Case ${params.case_id} not found`)
        }
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get case'
        return fail('CASES_GET_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'cases:create',
    (_event, params: CasesCreateParams): IpcResponse<CasesCreateResult> => {
      try {
        const row = createCase(params)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to create case'
        return fail('CASES_CREATE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'cases:archive',
    (_event, params: CasesArchiveParams): IpcResponse<CasesArchiveResult> => {
      try {
        const row = archiveCase(params.case_id)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to archive case'
        return fail('CASES_ARCHIVE_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Intake handlers
// ---------------------------------------------------------------------------

function registerIntakeHandlers(): void {
  ipcMain.handle(
    'intake:save',
    (_event, params: IntakeSaveParams): IpcResponse<PatientIntakeRow> => {
      try {
        const row = saveIntake(params.case_id, {
          ...params.data,
          referral_type: params.data.referral_type ?? 'self',
          referral_source: params.data.referral_source ?? null,
          eval_type: params.data.eval_type ?? null,
          presenting_complaint: params.data.presenting_complaint ?? null,
          jurisdiction: params.data.jurisdiction ?? null,
          charges: params.data.charges ?? null,
          attorney_name: params.data.attorney_name ?? null,
          report_deadline: params.data.report_deadline ?? null,
          status: params.data.status ?? 'draft',
        })
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save intake'
        return fail('INTAKE_SAVE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'intake:get',
    (_event, params: IntakeGetParams): IpcResponse<PatientIntakeRow | null> => {
      try {
        const row = getIntake(params.case_id)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get intake'
        return fail('INTAKE_GET_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Onboarding handlers
// ---------------------------------------------------------------------------

function registerOnboardingHandlers(): void {
  ipcMain.handle(
    'onboarding:save',
    (_event, params: OnboardingSaveParams): IpcResponse<PatientOnboardingRow> => {
      try {
        const row = saveOnboardingSection(params.case_id, params.section, params.data)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save onboarding section'
        return fail('ONBOARDING_SAVE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onboarding:get',
    (_event, params: OnboardingGetParams): IpcResponse<readonly PatientOnboardingRow[]> => {
      try {
        const rows = getOnboardingSections(params.case_id)
        return ok(rows)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get onboarding sections'
        return fail('ONBOARDING_GET_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Database handlers
// ---------------------------------------------------------------------------

function registerDbHandlers(): void {
  ipcMain.handle(
    'db:health',
    (): IpcResponse<DbHealthResult> =>
      ok({ connected: true, encrypted: true, version: '0.1.0' })
  )
}

// ---------------------------------------------------------------------------
// Auth handlers
// ---------------------------------------------------------------------------

function registerAuthHandlers(): void {
  ipcMain.handle(
    'auth:login',
    async (event): Promise<IpcResponse<AuthLoginResult>> => {
      try {
        const parentWindow = BrowserWindow.fromWebContents(event.sender)
        const result = await performLogin(parentWindow)

        if (!result.is_authenticated) {
          return fail('LOGIN_FAILED', 'Login failed')
        }

        const license = checkLicense()

        return ok({
          is_authenticated: true,
          user_id: result.user_id ?? '',
          user_name: result.user_name ?? '',
          user_email: result.user_email ?? '',
          is_active: license.is_active
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Login failed'
        return fail('LOGIN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'auth:getStatus',
    (): IpcResponse<AuthGetStatusResult> => ok(getAuthStatus())
  )

  ipcMain.handle(
    'auth:logout',
    (event): IpcResponse<AuthLogoutResult> => {
      try {
        const parentWindow = BrowserWindow.fromWebContents(event.sender)
        const result = performLogout(parentWindow)
        return ok(result)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Logout failed'
        return fail('LOGOUT_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Config handlers
// ---------------------------------------------------------------------------

function registerConfigHandlers(): void {
  ipcMain.handle(
    'config:get',
    (_event, _params: ConfigGetParams): IpcResponse<ConfigGetResult> =>
      ok({ config: {} })
  )

  ipcMain.handle(
    'config:set',
    (_event, _params: ConfigSetParams): IpcResponse<ConfigSetResult> =>
      ok({ updated_config: {} })
  )
}

// ---------------------------------------------------------------------------
// Workspace handlers
// ---------------------------------------------------------------------------

function registerWorkspaceHandlers(): void {
  ipcMain.handle(
    'workspace:getPath',
    (): IpcResponse<string | null> => ok(loadWorkspacePath())
  )

  ipcMain.handle(
    'workspace:setPath',
    (_event, path: string): IpcResponse<void> => {
      try {
        saveWorkspacePath(path)
        createFolderStructure(path)
        syncWorkspaceToDB(path)
        watchWorkspace(path)
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to set workspace path'
        return fail('WORKSPACE_SET_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'workspace:getTree',
    (): IpcResponse<readonly FolderNode[]> => {
      const wsPath = loadWorkspacePath()
      if (wsPath === null) {
        return fail('NO_WORKSPACE', 'No workspace path configured')
      }
      try {
        return ok(getWorkspaceTree(wsPath))
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to read workspace tree'
        return fail('TREE_READ_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'workspace:openInFinder',
    (_event, path: string): IpcResponse<void> => {
      shell.showItemInFolder(path)
      return ok(undefined)
    }
  )

  ipcMain.handle(
    'workspace:openNative',
    (_event, path: string): IpcResponse<void> => {
      void shell.openPath(path)
      return ok(undefined)
    }
  )

  ipcMain.handle(
    'workspace:pickFolder',
    async (event): Promise<IpcResponse<string | null>> => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(parentWindow!, {
        title: 'Choose Workspace Folder',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Choose',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return ok(null)
      }
      return ok(result.filePaths[0])
    }
  )

  ipcMain.handle(
    'workspace:getDefaultPath',
    (): IpcResponse<string> => ok(getDefaultWorkspacePath())
  )
}

// ---------------------------------------------------------------------------
// Document handlers
// ---------------------------------------------------------------------------

function registerDocumentHandlers(): void {
  ipcMain.handle(
    'documents:ingest',
    async (_event, params: IngestFileParams): Promise<IpcResponse<DocumentRow>> => {
      try {
        const row = await ingestFile(params.case_id, params.file_path, params.subfolder)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to ingest file'
        return fail('DOCUMENT_INGEST_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'documents:list',
    (_event, params: DocumentsListParams): IpcResponse<readonly DocumentRow[]> => {
      try {
        const rows = listDocuments(params.case_id)
        return ok(rows)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to list documents'
        return fail('DOCUMENTS_LIST_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'documents:get',
    (_event, params: DocumentsGetParams): IpcResponse<DocumentRow | null> => {
      try {
        const row = getDocument(params.document_id)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get document'
        return fail('DOCUMENTS_GET_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'documents:delete',
    (_event, params: DocumentsDeleteParams): IpcResponse<void> => {
      try {
        deleteDocument(params.document_id)
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to delete document'
        return fail('DOCUMENTS_DELETE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'documents:pickFile',
    async (event): Promise<IpcResponse<string | null>> => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(parentWindow!, {
        title: 'Select Document to Upload',
        properties: ['openFile'],
        filters: [
          { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'csv', 'rtf'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return ok(null)
      }
      return ok(result.filePaths[0])
    }
  )
}

// ---------------------------------------------------------------------------
// PII handlers
// ---------------------------------------------------------------------------

function registerPiiHandlers(): void {
  ipcMain.handle(
    'pii:detect',
    async (_event, params: PiiDetectParams): Promise<IpcResponse<PiiDetectResult>> => {
      try {
        const entities = await detect(params.text)
        return ok({ entities })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'PII detection failed'
        return fail('PII_DETECT_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'pii:batchDetect',
    async (_event, params: PiiBatchDetectParams): Promise<IpcResponse<PiiBatchDetectResult>> => {
      try {
        const results = await batchDetect(params.texts)
        return ok({ results })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'PII batch detection failed'
        return fail('PII_BATCH_DETECT_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'pii:redact',
    async (_event, params: PiiRedactParams): Promise<IpcResponse<PiiRedactResult>> => {
      try {
        const result = await redact(params.text, params.operationId, params.context)
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'PII redaction failed'
        return fail('PII_REDACT_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'pii:rehydrate',
    async (_event, params: PiiRehydrateParams): Promise<IpcResponse<PiiRehydrateResult>> => {
      try {
        const result = await rehydrate(params.text, params.operationId)
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'PII rehydration failed'
        return fail('PII_REHYDRATE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'pii:destroy',
    async (_event, params: PiiDestroyParams): Promise<IpcResponse<PiiDestroyResult>> => {
      try {
        const result = await destroyMap(params.operationId)
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'PII map destruction failed'
        return fail('PII_DESTROY_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Seed handler — inserts demo cases when DB is empty
// ---------------------------------------------------------------------------

function registerSeedHandlers(): void {
  ipcMain.handle(
    'seed:demoCases',
    (): IpcResponse<{ inserted: number }> => {
      try {
        const { seedDemoCases, createSeedTrigger } = require('../seed-demo-cases') as typeof import('../seed-demo-cases')
        createSeedTrigger()
        seedDemoCases()
        return ok({ inserted: 30 })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Seed failed'
        return fail('SEED_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// API Key handlers — secure storage using OS keychain
// ---------------------------------------------------------------------------

function registerApiKeyHandlers(): void {
  ipcMain.handle(
    'apiKey:store',
    (_event, params: ApiKeyStoreParams): IpcResponse<ApiKeyStoreResult> => {
      try {
        storeApiKey(params.key)
        return ok({ stored: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to store API key'
        return fail('API_KEY_STORE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'apiKey:retrieve',
    (): IpcResponse<ApiKeyRetrieveResult> => {
      try {
        const key = retrieveApiKey()
        return ok({ key })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to retrieve API key'
        return fail('API_KEY_RETRIEVE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'apiKey:delete',
    (): IpcResponse<ApiKeyDeleteResult> => {
      try {
        const deleted = deleteApiKey()
        return ok({ deleted })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to delete API key'
        return fail('API_KEY_DELETE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'apiKey:has',
    (): IpcResponse<ApiKeyHasResult> => {
      try {
        const hasKey = hasApiKey()
        return ok({ hasKey })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to check API key'
        return fail('API_KEY_HAS_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Public: register all IPC handlers
// ---------------------------------------------------------------------------

export function registerAllHandlers(): void {
  registerCasesHandlers()
  registerIntakeHandlers()
  registerOnboardingHandlers()
  registerDbHandlers()
  registerAuthHandlers()
  registerConfigHandlers()
  registerDocumentHandlers()
  registerPiiHandlers()
  registerWorkspaceHandlers()
  registerSeedHandlers()
  registerApiKeyHandlers()
  registerAiHandlers()
  registerAgentHandlers()
  registerPipelineHandlers()
}
