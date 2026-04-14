import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron'
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
  CasesUpdateParams,
  CasesUpdateResult,
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
  getDefaultWorkspacePath,
  getMalformedFolders,
  scaffoldCaseSubfolders,
} from '../workspace'
import { detect, batchDetect, redact, rehydrate, destroyMap } from '../pii'
import {
  createCase,
  updateCase,
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
import { writeCaseDoc, syncAllCaseDocs } from '../documents/case-docs-writer'
import {
  storeApiKey,
  retrieveApiKey,
  deleteApiKey,
  hasApiKey,
} from '../ai/key-storage'
import { registerAiHandlers } from '../ai/ai-handlers'
import { registerAgentHandlers } from '../agents'
import { registerPipelineHandlers } from '../pipeline/pipeline-handlers'
import { registerDecisionHandlers } from '../decisions/decision-handlers'
import { registerScoreHandlers } from '../scores/score-handlers'
import { registerWhisperHandlers } from '../whisper'
import { registerTestHarnessHandlers } from '../test-harness/harness-handlers'
import { saveDataConfirmation, getDataConfirmation } from '../data-confirmation'
import {
  startDocumentServer,
  stopDocumentServer,
  getDocumentServerStatus,
  getDocumentServerUrl,
  generateJwtToken,
  getSecureEditorConfig,
} from '../onlyoffice'
import { generateReportDocx } from '../onlyoffice/docx-generator'
import { getLatestWriterResult } from '../agents/writer'
import { getLatestEditorResult } from '../agents/editor'
import {
  submitAttestation,
  verifyIntegrity,
  getReportStatus,
} from '../reports'
import { logAuditEntry, getAuditTrail, exportAuditTrail } from '../audit'
import { prepareTestimonyPackage } from '../testimony'
import { seedResources } from '../seed-resources'
import { registerSetupHandlers } from '../setup/handlers'
import { REPORT_TEMPLATES as BUILTIN_REPORT_TEMPLATES } from '../setup/templates/registry'
import { spawnSidecar } from '../sidecar'
import { getSqlite } from '../db/connection'
import { seedDiagnosisCatalog } from '../db/seed-catalog'
import {
  getBranding,
  saveBranding,
  saveLogo as saveBrandingLogo,
  type PracticeBranding,
} from '../branding/brandingManager'

// ---------------------------------------------------------------------------
// Stub helper, returns a typed success envelope
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

  ipcMain.handle(
    'cases:update',
    (_event, params: CasesUpdateParams): IpcResponse<CasesUpdateResult> => {
      try {
        const row = updateCase(params)
        return ok(row)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to update case'
        return fail('CASES_UPDATE_FAILED', message)
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
        // Fire-and-forget: regenerate intake + referral docs on disk
        void writeCaseDoc(params.case_id, 'intake').catch(e => console.error('[case-docs] intake write failed:', e))
        void writeCaseDoc(params.case_id, 'referral').catch(e => console.error('[case-docs] referral write failed:', e))
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
        // Fire-and-forget: regenerate the corresponding document on disk
        const sectionToTab: Record<string, 'intake' | 'referral' | 'testing' | 'interview' | 'diagnostics'> = {
          contact: 'intake', complaints: 'intake', family: 'intake', education: 'intake',
          health: 'intake', mental: 'intake', substance: 'intake', recent: 'intake',
          legal: 'referral', referral_notes: 'referral',
          testing_notes: 'testing',
          interview_notes: 'interview',
          diagnostic_notes: 'diagnostics', documents_notes: 'intake',
        }
        const tab = sectionToTab[params.section]
        if (tab) {
          void writeCaseDoc(params.case_id, tab).catch(e => console.error(`[case-docs] ${tab} write failed:`, e))
        }
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

  // Return folders that don't match case naming pattern or lack subfolders
  ipcMain.handle(
    'workspace:getMalformed',
    (): IpcResponse<readonly { name: string; path: string; reason: string }[]> => {
      return ok(getMalformedFolders())
    }
  )

  // Scaffold standard subfolders in a case folder
  ipcMain.handle(
    'workspace:scaffold',
    (_event, folderPath: string): IpcResponse<string[]> => {
      try {
        const created = scaffoldCaseSubfolders(folderPath)
        return ok(created)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to scaffold subfolders'
        return fail('SCAFFOLD_FAILED', message)
      }
    }
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

  ipcMain.handle(
    'documents:pickFiles',
    async (event): Promise<IpcResponse<any>> => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const result = await dialog.showOpenDialog(parentWindow!, {
        title: 'Select Documents to Upload',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'csv', 'rtf'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return ok({ filePaths: [] })
      }
      return ok({ filePaths: result.filePaths })
    }
  )

  ipcMain.handle(
    'documents:pickFilesFrom',
    async (event, params: { defaultPath?: string; title?: string; extensions?: string[] }): Promise<IpcResponse<any>> => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const defaultDir = params.defaultPath === '$DOWNLOADS'
        ? app.getPath('downloads')
        : params.defaultPath ?? undefined

      const exts = params.extensions ?? ['pdf', 'docx', 'doc', 'txt', 'csv', 'rtf', 'vtt', 'json']
      const result = await dialog.showOpenDialog(parentWindow!, {
        title: params.title ?? 'Select Files to Upload',
        defaultPath: defaultDir,
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Documents', extensions: exts },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (result.canceled || result.filePaths.length === 0) {
        return ok({ filePaths: [] })
      }
      return ok({ filePaths: result.filePaths })
    }
  )

  // Sync all case documents to disk (manual trigger or auto after batch saves)
  ipcMain.handle(
    'documents:syncToDisk',
    async (_event, params: { case_id: number }): Promise<IpcResponse<{ files: string[]; errors: string[] }>> => {
      try {
        const result = await syncAllCaseDocs(params.case_id)
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to sync documents to disk'
        return fail('DOCUMENTS_SYNC_FAILED', message)
      }
    }
  )

  // Write a single tab's document to disk
  ipcMain.handle(
    'documents:writeTabDoc',
    async (_event, params: { case_id: number; tab: 'intake' | 'referral' | 'testing' | 'interview' | 'diagnostics' }): Promise<IpcResponse<string | null>> => {
      try {
        const filePath = await writeCaseDoc(params.case_id, params.tab)
        return ok(filePath)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to write tab document'
        return fail('DOCUMENT_WRITE_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// PII handlers
// ---------------------------------------------------------------------------

function registerPiiHandlers(): void {
  // Spawn the Python PII sidecar at startup so the renderer can call
  // pii:detect immediately. Mirrors how registerWhisperHandlers spawns
  // the transcribe sidecar. Failure is non-fatal: the IPC handlers will
  // surface a clear error if the renderer tries to use them before the
  // sidecar is ready, instead of silently freezing.
  spawnSidecar()
    .then((info) => {
      void info
    })
    .catch((err: Error) => {
      console.warn(
        `[PII] Sidecar not available: ${err.message}\n` +
          '      The PII pipeline will fail until the sidecar starts.\n' +
          '      Requires Python 3.10+ with presidio-analyzer + spacy + en_core_web_lg.\n' +
          '      See sidecar/BUILD.md for details.',
      )
    })

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
// Seed handler, inserts demo cases when DB is empty
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
// API Key handlers, secure storage using OS keychain
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
// Data Confirmation handlers
// ---------------------------------------------------------------------------

function registerDataConfirmationHandlers(): void {
  ipcMain.handle(
    'data-confirmation:save',
    (
      _event,
      params: { caseId: number; categoryId: string; status: string; notes: string }
    ): IpcResponse<{ status: string }> => {
      try {
        saveDataConfirmation(params.caseId, params.categoryId, params.status, params.notes)
        return ok({ status: 'success' })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save data confirmation'
        return fail('DATA_CONFIRMATION_SAVE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'data-confirmation:get',
    (
      _event,
      params: { caseId: number }
    ): IpcResponse<{ data: Array<{ category_id: string; status: string; notes: string }> }> => {
      try {
        const rows = getDataConfirmation(params.caseId)
        const data = rows.map((row) => ({
          category_id: row.category_id,
          status: row.status,
          notes: row.notes,
        }))
        return ok({ data })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get data confirmation'
        return fail('DATA_CONFIRMATION_GET_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Updater handlers
// ---------------------------------------------------------------------------

function registerUpdaterHandlers(): void {
  ipcMain.handle(
    'updater:check',
    async (): Promise<IpcResponse<{
      available: boolean
      version?: string
      releaseNotes?: string
    }>> => {
      try {
        const { checkForUpdates } = await import('../updater')
        const result = await checkForUpdates()
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to check for updates'
        console.error('[updater:check] error:', message)
        return fail('UPDATER_CHECK_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'updater:download',
    async (_event, params: { version: string }): Promise<IpcResponse<{ filePath: string | null }>> => {
      try {
        const { downloadUpdate } = await import('../updater')
        const filePath = await downloadUpdate(params.version)
        return ok({ filePath })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to download update'
        console.error('[updater:download] error:', message)
        return fail('UPDATER_DOWNLOAD_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'updater:getVersion',
    (): IpcResponse<string> => {
      try {
        const { getAppVersion } = require('../updater')
        return ok(getAppVersion())
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get app version'
        return fail('UPDATER_GET_VERSION_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// OnlyOffice handlers
// ---------------------------------------------------------------------------

function registerOnlyOfficeHandlers(): void {
  ipcMain.handle(
    'onlyoffice:start',
    async (): Promise<IpcResponse<{ port: number; jwtSecret: string }>> => {
      try {
        const result = await startDocumentServer()
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to start Document Server'
        console.error('[onlyoffice:start] error:', message)
        return fail('ONLYOFFICE_START_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:stop',
    async (): Promise<IpcResponse<void>> => {
      try {
        await stopDocumentServer()
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to stop Document Server'
        console.error('[onlyoffice:stop] error:', message)
        return fail('ONLYOFFICE_STOP_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:status',
    async (): Promise<IpcResponse<{ running: boolean; port: number | null; healthy: boolean }>> => {
      try {
        const status = await getDocumentServerStatus()
        return ok(status)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get Document Server status'
        return fail('ONLYOFFICE_STATUS_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:getUrl',
    async (): Promise<IpcResponse<string | null>> => {
      try {
        const url = await getDocumentServerUrl()
        return ok(url)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get Document Server URL'
        return fail('ONLYOFFICE_URL_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:generateToken',
    async (_event, params: { payload: Record<string, unknown> }): Promise<IpcResponse<string>> => {
      try {
        const token = generateJwtToken(params.payload)
        return ok(token)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to generate JWT token'
        return fail('ONLYOFFICE_TOKEN_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:generateDocx',
    async (_event, params: { caseId: number }): Promise<IpcResponse<{ filePath: string; version: number }>> => {
      try {
        // Load writer output
        const writerOutput = getLatestWriterResult(params.caseId)
        if (!writerOutput) {
          return fail('NO_WRITER_OUTPUT', 'No writer output found. Run Writer Agent first.')
        }

        // Load editor output (optional)
        const editorOutput = getLatestEditorResult(params.caseId)

        // Generate docx
        const result = await generateReportDocx(params.caseId, writerOutput, editorOutput)
        return ok(result)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to generate DOCX'
        console.error('[onlyoffice:generateDocx] error:', message)
        return fail('ONLYOFFICE_DOCX_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'onlyoffice:openDocument',
    async (
      _event,
      params: { caseId: number; filePath?: string; readOnly?: boolean }
    ): Promise<
      IpcResponse<{
        documentUrl: string
        jwtToken: string
        callbackUrl?: string
      }>
    > => {
      try {
        const serverUrl = await getDocumentServerUrl()
        if (!serverUrl) {
          return fail('ONLYOFFICE_NOT_RUNNING', 'Document Server is not running. Start it first.')
        }

        // Get secure editor configuration (disables macros, plugins, etc.)
        const secureConfig = getSecureEditorConfig()

        // Build document config for OnlyOffice
        const documentPayload = {
          document: {
            fileType: 'docx',
            key: `case_${params.caseId}_${Date.now()}`,
            title: `case_${params.caseId}_report`,
            url: params.filePath ?? '', // This would be served by the app
          },
          documentType: 'text',
          editorConfig: {
            mode: params.readOnly ? 'view' : 'edit',
            callbackUrl: params.readOnly ? undefined : `http://localhost:3000/api/onlyoffice/callback`,
            ...secureConfig,
          },
        }

        const jwtToken = generateJwtToken(documentPayload)

        return ok({
          documentUrl: serverUrl,
          jwtToken,
          callbackUrl: `http://localhost:3000/api/onlyoffice/callback`,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to open document'
        console.error('[onlyoffice:openDocument] error:', message)
        return fail('ONLYOFFICE_OPEN_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Report finalization handlers
// ---------------------------------------------------------------------------

function registerReportHandlers(): void {
  ipcMain.handle(
    'report:submitAttestation',
    (
      _event,
      params: {
        caseId: number
        signedBy: string
        attestationStatement: string
        signatureDate: string
      }
    ): IpcResponse<{ success: boolean; integrityHash: string; finalizedAt: string }> => {
      try {
        const result = submitAttestation({
          caseId: params.caseId,
          signedBy: params.signedBy,
          attestationStatement: params.attestationStatement,
          signatureDate: params.signatureDate,
        })
        return ok({
          success: true,
          integrityHash: result.integrityHash,
          finalizedAt: new Date().toISOString(),
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to submit attestation'
        console.error('[report:submitAttestation]', message)
        return fail('REPORT_SUBMIT_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'report:getStatus',
    (
      _event,
      params: { caseId: number }
    ): IpcResponse<{
      finalized: boolean
      finalizedAt?: string
      integrityHash?: string
      signedBy?: string
    }> => {
      try {
        const status = getReportStatus(params.caseId)
        return ok({
          finalized: status.isLocked,
          finalizedAt: status.integrityHash ? new Date().toISOString() : undefined,
          integrityHash: status.integrityHash ?? undefined,
          signedBy: undefined, // Could be stored in audit log details
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get report status'
        return fail('REPORT_STATUS_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'report:verifyIntegrity',
    (
      _event,
      params: { caseId: number }
    ): IpcResponse<{
      valid: boolean
      integrityHash: string
      expectedHash: string
    }> => {
      try {
        const result = verifyIntegrity(params.caseId)
        return ok({
          valid: result.valid,
          integrityHash: result.storedHash ?? '',
          expectedHash: result.computedHash,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to verify integrity'
        return fail('REPORT_VERIFY_FAILED', message)
      }
    }
  )

  // ------------------------------------------------------------------
  // report:exportAndOpen, Generate .docx from section content, open in Word
  // ------------------------------------------------------------------
  ipcMain.handle(
    'report:exportAndOpen',
    async (
      _event,
      params: {
        caseId: number
        fullName: string
        evalType: string
        sections: { title: string; body: string }[]
      }
    ): Promise<IpcResponse<{ filePath: string }>> => {
      try {
        // Dynamic require for docx (same pattern as docx-generator)
        const docxMod = require('docx') as typeof import('docx')
        const { Document: Doc, Packer: Pkr, Paragraph: Para, HeadingLevel: HL, TextRun: TR } = docxMod
        const { writeFileSync, mkdirSync: mkDir } = require('fs')
        const { join: joinPath } = require('path')

        // Build output directory
        const wsPath = loadWorkspacePath()
        if (!wsPath) {
          return fail('NO_WORKSPACE', 'Workspace not configured')
        }
        const draftsDir = joinPath(wsPath, `case_${params.caseId}`, 'report', 'drafts')
        mkDir(draftsDir, { recursive: true })

        // Find next version number
        const fs = require('fs')
        let version = 1
        try {
          const existing = fs.readdirSync(draftsDir) as string[]
          const versions = existing
            .filter((f: string) => f.match(/^draft_v\d+\.docx$/))
            .map((f: string) => {
              const m = f.match(/draft_v(\d+)/)
              return m ? parseInt(m[1], 10) : 0
            })
          if (versions.length > 0) {
            version = Math.max(...versions) + 1
          }
        } catch { /* empty dir */ }

        const fileName = `draft_v${version}.docx`
        const filePath = joinPath(draftsDir, fileName)

        // Build document
        const children: any[] = []

        // Title
        children.push(
          new Para({
            children: [new TR({ text: 'CONFIDENTIAL FORENSIC EVALUATION REPORT', bold: true, size: 28 })],
            alignment: 'center' as any,
            spacing: { after: 100 },
          })
        )
        children.push(
          new Para({
            children: [new TR({ text: params.evalType, color: '666666', size: 22 })],
            alignment: 'center' as any,
            spacing: { after: 300 },
          })
        )
        children.push(
          new Para({
            children: [
              new TR({ text: 'Examinee: ', bold: true, size: 22 }),
              new TR({ text: params.fullName, size: 22 }),
            ],
            spacing: { after: 80 },
          })
        )
        children.push(
          new Para({
            children: [
              new TR({ text: 'Date: ', bold: true, size: 22 }),
              new TR({ text: new Date().toLocaleDateString(), size: 22 }),
            ],
            spacing: { after: 300 },
          })
        )

        // Sections
        for (const sec of params.sections) {
          children.push(
            new Para({
              text: sec.title,
              heading: HL.HEADING_2,
              spacing: { before: 240, after: 120 },
            })
          )
          // Split body by newlines into paragraphs
          const bodyLines = sec.body.split('\n')
          for (const line of bodyLines) {
            children.push(
              new Para({
                children: [new TR({ text: line, size: 22 })],
                spacing: { after: 60 },
              })
            )
          }
        }

        // Signature block
        children.push(new Para({ text: '', spacing: { before: 600 } }))
        children.push(new Para({
          children: [new TR({ text: '________________________________________', size: 22 })],
          spacing: { after: 40 },
        }))
        children.push(new Para({
          children: [new TR({ text: '[Clinician Name, Credentials]', size: 22 })],
          spacing: { after: 20 },
        }))
        children.push(new Para({
          children: [new TR({ text: 'Licensed Psychologist', color: '666666', size: 20 })],
          spacing: { after: 20 },
        }))
        children.push(new Para({
          children: [new TR({ text: 'Date: _______________', color: '666666', size: 20 })],
        }))

        const doc = new Doc({
          sections: [{ children }],
        })

        const buffer = await Pkr.toBuffer(doc)
        writeFileSync(filePath, buffer)

        // Open in default application (MS Word)
        void shell.openPath(filePath)

        return ok({ filePath })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to export report'
        console.error('[report:exportAndOpen]', message)
        return fail('REPORT_EXPORT_FAILED', message)
      }
    }
  )

  // ------------------------------------------------------------------
  // report:loadTemplate, Pick a .docx template, extract text, strip PHI
  // ------------------------------------------------------------------
  ipcMain.handle(
    'report:loadTemplate',
    async (event): Promise<IpcResponse<{ sections: { title: string; body: string }[] }>> => {
      try {
        const parentWindow = BrowserWindow.fromWebContents(event.sender)
        const result = await dialog.showOpenDialog(parentWindow!, {
          title: 'Select Report Template (.docx)',
          filters: [
            { name: 'Word Documents', extensions: ['docx', 'doc'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: ['openFile'],
        })

        if (result.canceled || result.filePaths.length === 0) {
          return fail('USER_CANCELLED', 'No file selected')
        }

        const filePath = result.filePaths[0]
        const fs = require('fs')
        const fileBuffer = fs.readFileSync(filePath)

        // Use mammoth to extract text from docx
        const mammoth = require('mammoth')
        const extracted = await mammoth.extractRawText({ buffer: fileBuffer })
        const rawText: string = extracted.value ?? ''

        // Strip common PHI patterns
        let cleaned = rawText
        // SSN patterns
        cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '[SSN REMOVED]')
        // Dates of birth (MM/DD/YYYY, MM-DD-YYYY)
        cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, '[DOB REMOVED]')
        // Phone numbers
        cleaned = cleaned.replace(/\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, '[PHONE REMOVED]')
        // Email addresses
        cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL REMOVED]')
        // Addresses (simple pattern: number + street)
        cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Circle|Terrace|Drive|Lane|Road|Court|Boulevard|Avenue|Street)\b\.?/gi, '[ADDRESS REMOVED]')

        // Split into sections by headings (lines that are all-caps or short + bold-like)
        const lines = cleaned.split('\n').filter((l: string) => l.trim().length > 0)
        const sections: { title: string; body: string }[] = []
        let currentTitle = 'Imported Section'
        let currentBody: string[] = []

        for (const line of lines) {
          const trimmed = line.trim()
          // Heuristic: a heading is a short line (<80 chars) that's mostly uppercase
          const isHeading = trimmed.length < 80 && trimmed.length > 2 &&
            (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&:,\-,,]+$/.test(trimmed))

          if (isHeading) {
            if (currentBody.length > 0) {
              sections.push({ title: currentTitle, body: currentBody.join('\n') })
            }
            currentTitle = trimmed
            currentBody = []
          } else {
            currentBody.push(trimmed)
          }
        }
        if (currentBody.length > 0) {
          sections.push({ title: currentTitle, body: currentBody.join('\n') })
        }

        // If no sections found, put everything in one
        if (sections.length === 0) {
          sections.push({ title: 'Imported Template', body: cleaned })
        }

        return ok({ sections })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load template'
        console.error('[report:loadTemplate]', message)
        return fail('TEMPLATE_LOAD_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Audit trail handlers
// ---------------------------------------------------------------------------

function registerAuditHandlers(): void {
  ipcMain.handle(
    'audit:log',
    (
      _event,
      params: {
        caseId: number
        actionType: string
        actorType: 'clinician' | 'ai_agent' | 'system' | 'agent'
        actorId?: string
        details: string | Record<string, unknown>
        relatedEntityType?: string
        relatedEntityId?: string
      }
    ): IpcResponse<{ entryId: string; timestamp: string }> => {
      try {
        // Convert details to object if it's a string
        const detailsObj = typeof params.details === 'string' ? JSON.parse(params.details) : params.details

        // Map agent to ai_agent for consistency
        const actorType = params.actorType === 'agent' ? 'ai_agent' : params.actorType

        const auditLogId = logAuditEntry({
          caseId: params.caseId,
          actionType: params.actionType,
          actorType: actorType as 'clinician' | 'ai_agent' | 'system',
          actorId: params.actorId,
          details: detailsObj,
          relatedEntityType: params.relatedEntityType,
          relatedEntityId: params.relatedEntityId ? parseInt(params.relatedEntityId, 10) : undefined,
        })

        return ok({
          entryId: String(auditLogId),
          timestamp: new Date().toISOString(),
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to log audit entry'
        return fail('AUDIT_LOG_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'audit:getTrail',
    (
      _event,
      params: { caseId: number }
    ): IpcResponse<{
      entries: Array<{
        id: string
        caseId: number
        timestamp: string
        actionType: string
        actorType: 'clinician' | 'system' | 'agent'
        actorId?: string
        details: string
        relatedEntityType?: string
        relatedEntityId?: string
        status: 'complete' | 'in_progress' | 'error'
      }>
      total: number
    }> => {
      try {
        const auditRows = getAuditTrail(params.caseId)
        const entries = auditRows.map((row) => ({
          id: String(row.audit_log_id),
          caseId: row.case_id,
          timestamp: row.action_date,
          actionType: row.action_type,
          actorType: (row.actor_user_id === -1 ? 'agent' : 'system') as 'clinician' | 'system' | 'agent',
          actorId: row.actor_user_id === -1 ? 'ai_agent' : String(row.actor_user_id),
          details: row.details ?? '',
          relatedEntityType: row.related_entity_type ?? undefined,
          relatedEntityId: row.related_entity_id ? String(row.related_entity_id) : undefined,
          status: 'complete' as const,
        }))
        return ok({ entries, total: entries.length })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to get audit trail'
        return fail('AUDIT_GET_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'audit:export',
    (
      _event,
      params: { caseId: number; format?: 'csv' | 'json' }
    ): IpcResponse<{ data: string; mimeType: string }> => {
      try {
        const format = params.format ?? 'csv'
        const data = exportAuditTrail(params.caseId, format)
        const mimeType = format === 'json' ? 'application/json' : 'text/csv'
        return ok({ data, mimeType })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to export audit trail'
        return fail('AUDIT_EXPORT_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Testimony preparation handlers
// ---------------------------------------------------------------------------

function registerTestimonyHandlers(): void {
  ipcMain.handle(
    'testimony:prepare',
    async (
      _event,
      params: { caseId: number }
    ): Promise<
      IpcResponse<{
        success: boolean
        exportedFiles: readonly string[]
        timestamp: string
      }>
    > => {
      try {
        const result = await prepareTestimonyPackage(params.caseId)
        return ok({
          success: true,
          exportedFiles: result.files,
          timestamp: new Date().toISOString(),
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to prepare testimony package'
        console.error('[testimony:prepare]', message)
        return fail('TESTIMONY_PREPARE_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Resources handlers, writing samples, templates, documentation
// ---------------------------------------------------------------------------
// Referral document parsing, open a file picker, extract text from
// .docx or .pdf, then heuristically extract referral form fields.
// ---------------------------------------------------------------------------

function registerReferralParseHandlers(): void {
  const fs = require('fs')
  const pathMod = require('path')
  const mammoth = require('mammoth')
  const pdfParse = require('pdf-parse')

  ipcMain.handle('referral:parse-doc', async (_event): Promise<IpcResponse<Record<string, string>>> => {
    try {
      const parentWindow = BrowserWindow.getFocusedWindow()
      if (!parentWindow) return { status: 'error', error: 'No active window' }

      const result = await dialog.showOpenDialog(parentWindow, {
        title: 'Select Referral Document',
        filters: [
          { name: 'Documents', extensions: ['docx', 'doc', 'pdf', 'txt', 'rtf'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { status: 'error', error: 'cancelled' }
      }

      const filePath = result.filePaths[0]
      const ext = pathMod.extname(filePath).toLowerCase()
      const buffer = fs.readFileSync(filePath)

      // ── Extract text ────────────────────────────────────────────────
      let rawText = ''
      if (ext === '.docx' || ext === '.doc') {
        const extracted = await mammoth.extractRawText({ buffer })
        rawText = extracted.value ?? ''
      } else if (ext === '.pdf') {
        const parsed = await pdfParse(buffer)
        rawText = parsed.text ?? ''
      } else {
        rawText = buffer.toString('utf-8')
      }

      if (!rawText.trim()) {
        return { status: 'error', error: 'Could not extract text from document' }
      }

      // ── Heuristic field extraction ─────────────────────────────────
      const fields: Record<string, string> = { _rawText: rawText }
      const text = rawText

      // Helper: find value after a label pattern (case-insensitive)
      const extract = (patterns: RegExp[]): string => {
        for (const pat of patterns) {
          const m = text.match(pat)
          if (m && m[1]?.trim()) return m[1].trim()
        }
        return ''
      }

      // Case / Docket number
      fields.caseNumber = extract([
        /(?:case|docket|cause)\s*(?:no\.?|number|#)\s*[:\-]?\s*(.+)/i,
        /(?:case|docket)\s*[:\-]\s*(.+)/i,
        /\b(\d{2,4}[-\s]?[A-Z]{1,3}[-\s]?\d{3,8})\b/,
      ])

      // Judge / Court
      fields.judgeAssignedCourt = extract([
        /(?:judge|hon\.?|honorable)\s*[:\-]?\s*(.+)/i,
        /(?:assigned\s+court|court)\s*[:\-]?\s*(.+)/i,
        /(?:division|department|dept\.?)\s*[:\-]?\s*(.+)/i,
      ])

      // Defense counsel
      fields.defenseCounselName = extract([
        /(?:defense\s+(?:counsel|attorney|lawyer))\s*[:\-]?\s*(.+)/i,
        /(?:public\s+defender)\s*[:\-]?\s*(.+)/i,
      ])

      // Prosecution / Referring attorney
      fields.prosecutionAttorney = extract([
        /(?:prosecut(?:or|ing|ion)\s*(?:attorney)?)\s*[:\-]?\s*(.+)/i,
        /(?:district\s+attorney|da|ada)\s*[:\-]?\s*(.+)/i,
        /(?:referring\s+attorney)\s*[:\-]?\s*(.+)/i,
      ])

      // Referring party
      fields.referringPartyName = extract([
        /(?:referr(?:ed|ing)\s+(?:by|party|source))\s*[:\-]?\s*(.+)/i,
        /(?:referral\s+source)\s*[:\-]?\s*(.+)/i,
        /(?:ordered\s+by)\s*[:\-]?\s*(.+)/i,
      ])

      // Referring party type
      const rpTypeStr = extract([
        /(?:referral\s+type|referring\s+party\s+type)\s*[:\-]?\s*(.+)/i,
      ])
      if (rpTypeStr) {
        const lower = rpTypeStr.toLowerCase()
        if (lower.includes('court')) fields.referringPartyType = 'Court'
        else if (lower.includes('attorney') || lower.includes('counsel')) fields.referringPartyType = 'Attorney'
        else if (lower.includes('physician') || lower.includes('doctor')) fields.referringPartyType = 'Physician'
        else if (lower.includes('agency')) fields.referringPartyType = 'Agency'
        else if (lower.includes('insurance')) fields.referringPartyType = 'Insurance'
      }
      // Infer from content if not explicitly stated
      if (!fields.referringPartyType) {
        const lower = text.toLowerCase()
        if (/\bcourt\s+order/i.test(lower) || /\bordered\s+by\s+the\s+court/i.test(lower)) {
          fields.referringPartyType = 'Court'
        } else if (/\battorney|counsel/i.test(fields.referringPartyName)) {
          fields.referringPartyType = 'Attorney'
        }
      }

      // Evaluation type
      const evalStr = extract([
        /(?:evaluation|eval|assessment)\s*(?:type|requested)?\s*[:\-]?\s*(.+)/i,
        /(?:type\s+of\s+evaluation)\s*[:\-]?\s*(.+)/i,
        /(?:requesting|request\s+for)\s*[:\-]?\s*(.+)/i,
      ])
      if (evalStr) {
        const lower = evalStr.toLowerCase()
        const evalTypes: [RegExp, string][] = [
          [/competenc|cst/i, 'CST'],
          [/custod/i, 'Custody'],
          [/risk\s+assess/i, 'Risk Assessment'],
          [/fitness/i, 'Fitness for Duty'],
          [/ptsd/i, 'PTSD Dx'],
          [/adhd|attention/i, 'ADHD Dx'],
          [/malinger|feign/i, 'Malingering'],
          [/capacit/i, 'Capacity'],
          [/disabilit/i, 'Disability'],
          [/immigra|hardship/i, 'Immigration'],
          [/personal\s+injur/i, 'Personal Injury'],
          [/diagnostic/i, 'Diagnostic Assessment'],
          [/juvenile|minor/i, 'Juvenile'],
          [/mitigat/i, 'Mitigation'],
        ]
        for (const [pat, val] of evalTypes) {
          if (pat.test(lower) || pat.test(text)) {
            fields.evalType = val
            break
          }
        }
        if (!fields.evalType) fields.evalType = evalStr.substring(0, 60)
      }

      // Charges
      fields.charges = extract([
        /(?:charge[sd]?|offense[sd]?|allegation[sd]?)\s*[:\-]?\s*(.+)/i,
        /(?:charged\s+with)\s*[:\-]?\s*(.+)/i,
      ])

      // Reason for referral
      fields.reasonForReferral = extract([
        /(?:reason\s+for\s+referral)\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
        /(?:referral\s+question|purpose\s+of\s+evaluation)\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
        /(?:evaluation\s+requested\s+(?:to|for))\s*[:\-]?\s*([\s\S]{10,300}?)(?:\n\n|\n[A-Z])/i,
      ])

      // Deadline
      fields.courtDeadline = extract([
        /(?:deadline|due\s+date|report\s+due|completion\s+date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i,
        /(?:deadline|due\s+date|report\s+due)\s*[:\-]?\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
      ])
      // Normalize date to YYYY-MM-DD if we got something
      if (fields.courtDeadline) {
        const d = new Date(fields.courtDeadline)
        if (!isNaN(d.getTime())) {
          fields.courtDeadline = d.toISOString().split('T')[0]
        }
      }

      // Phone numbers (grab the first few found)
      const phones = text.match(/\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g) ?? []
      if (phones.length > 0 && !fields.referringPartyPhone) {
        fields.referringPartyPhone = phones[0]
      }

      // Filename as context
      fields._fileName = pathMod.basename(filePath)

      // Strip _rawText for brevity, keep only the first 3000 chars for reference
      if (fields._rawText.length > 3000) {
        fields._rawText = fields._rawText.substring(0, 3000) + '\n\n[... truncated ...]'
      }

      return { status: 'success', data: fields }
    } catch (err: any) {
      console.error('[referral:parse-doc]', err)
      return { status: 'error', error: err?.message ?? 'Failed to parse referral document' }
    }
  })
}

// ---------------------------------------------------------------------------
// Maps directly to filesystem folders inside the workspace:
//   Workspace/Writing Samples/
//   Workspace/Templates/
//   Workspace/Documents/
//   Workspace/Testing/
//   Workspace/Forms/
// No metadata sidecars, the panel reads actual filenames from actual folders.
// ---------------------------------------------------------------------------

function registerResourcesHandlers(): void {
  const fs = require('fs')
  const pathMod = require('path')
  const mammoth = require('mammoth')
  const pdfParse = require('pdf-parse')

  // ── No eager seed ────────────────────────────────────────────────────────
  // Previously this block called seedResources(wsPath) at handler registration
  // time, which re-created _Resources/Documentation/_cleaned/... in every
  // project root on every launch. That violated the "clean directory"
  // expectation of the setup wizard. Resources now seed on explicit demand
  // only, via the (future) Settings → Load demo resources button or by
  // uploading files through resources:upload.

  // Category keys must stay stable for the renderer, but labels now match
  // the new /Workspace/* folder layout. 'documentation' → 'Documents', plus
  // two new categories 'testing' and 'forms'.
  const CATEGORY_LABELS: Record<string, string> = {
    'writing-samples': 'Writing Samples',
    'templates': 'Templates',
    'documentation': 'Documents',
    'testing': 'Testing',
    'forms': 'Forms',
  }

  // Reverse map: folder name → category key
  const LABEL_TO_CATEGORY: Record<string, string> = {}
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    LABEL_TO_CATEGORY[label] = key
  }

  /** Resolve workspace root, falling back to default */
  function resolveWorkspace(): string {
    return loadWorkspacePath() || getDefaultWorkspacePath()
  }

  // Resources now live directly under /Workspace/<Category>/ rather than
  // under a separate _Resources/<Category>/ tree. The setup wizard
  // provisions and seeds these folders.
  function getResourcesRoot(): string {
    return pathMod.join(resolveWorkspace(), 'Workspace')
  }

  function getCategoryDir(category: string): string {
    const label = CATEGORY_LABELS[category] || category
    return pathMod.join(getResourcesRoot(), label)
  }

  function ensureCategoryDirs(): void {
    const root = getResourcesRoot()
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
    for (const label of Object.values(CATEGORY_LABELS)) {
      const dir = pathMod.join(root, label)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }
  }

  /** File extensions we recognise as documents (not hidden/system files) */
  const DOC_EXTS = new Set(['.txt', '.pdf', '.doc', '.docx', '.csv', '.rtf', '.md', '.xlsx', '.xls', '.json', '.xml', '.html', '.htm'])

  function mimeForExt(ext: string): string {
    switch (ext) {
      case '.pdf': return 'application/pdf'
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case '.doc': return 'application/msword'
      case '.txt': case '.md': return 'text/plain'
      case '.csv': return 'text/csv'
      case '.rtf': return 'application/rtf'
      case '.json': return 'application/json'
      case '.xml': return 'application/xml'
      case '.html': case '.htm': return 'text/html'
      case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      default: return 'application/octet-stream'
    }
  }

  /** Build the cleaned .txt filename, embedding the source extension.
   *  e.g. "Report_FFD_Montoya.docx" -> "Report_FFD_Montoya_docx.txt"
   *       "Sample_CST_Phan.txt"     -> "Sample_CST_Phan_txt.txt"
   *       "Eval_Risk.pdf"           -> "Eval_Risk_pdf.txt"            */
  function cleanedBaseName(filename: string, sourceExt: string): string {
    const stem = pathMod.basename(filename, sourceExt)
    const tag = sourceExt.replace('.', '')
    return `${stem}_${tag}.txt`
  }

  /** Strip PHI from raw text, same patterns as report:loadTemplate */
  function stripPhi(text: string): { cleaned: string; strippedCount: number } {
    let count = 0
    let cleaned = text

    // ── 1. SSN (xxx-xx-xxxx, xxx.xx.xxxx, xxxxxxxxx) ──
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, () => { count++; return '[SSN REMOVED]' })

    // ── 2. Dates (MM/DD/YYYY, MM-DD-YYYY, Month DD, YYYY, etc.) ──
    // Numeric format
    cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, () => { count++; return '[DATE REMOVED]' })
    // Written format: "January 15, 2024" or "Jan. 15, 2024" or "January 2024"
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+(19|20)\d{2}\b/gi, () => { count++; return '[DATE REMOVED]' })
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(19|20)\d{2}\b/gi, () => { count++; return '[DATE REMOVED]' })

    // ── 3. Phone numbers ──
    cleaned = cleaned.replace(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => { count++; return '[PHONE REMOVED]' })

    // ── 4. Email addresses ──
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, () => { count++; return '[EMAIL REMOVED]' })

    // ── 5. Street addresses (number + street name + suffix, optionally with unit/apt) ──
    cleaned = cleaned.replace(/\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Pkwy|Cir|Terr?|Drive|Lane|Road|Court|Boulevard|Avenue|Street|Parkway|Circle|Terrace|Place)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|Bldg|#)\s*[#]?\s*[A-Za-z0-9\-]+)?/gi, () => { count++; return '[ADDRESS REMOVED]' })

    // ── 6. City, State ZIP patterns ──
    cleaned = cleaned.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:CO|Colorado|CA|NY|TX|FL|AZ|NM|UT|WY|NE|KS|OK)\s+\d{5}(?:-\d{4})?\b/g, () => { count++; return '[LOCATION REMOVED]' })

    // ── 7. NPI numbers (10-digit national provider identifiers) ──
    cleaned = cleaned.replace(/\bNPI:?\s*\d{10}\b/gi, () => { count++; return '[NPI REMOVED]' })

    // ── 8. DEA numbers (2 letters + 7 digits) ──
    cleaned = cleaned.replace(/\bDEA:?\s*[A-Za-z]{2}\d{7}\b/gi, () => { count++; return '[DEA REMOVED]' })

    // ── 9. Medical record numbers (MRN patterns: prefix-year-digits) ──
    cleaned = cleaned.replace(/\bMRN:?\s*[A-Z]{1,5}-?\d{4}-?\d{3,8}\b/gi, () => { count++; return '[MRN REMOVED]' })

    // ── 10. Prescription numbers (Rx #prefix-digits) ──
    cleaned = cleaned.replace(/\bRx\s*#?\s*[A-Za-z]*-?\d{4,10}\b/gi, () => { count++; return '[RX REMOVED]' })

    // ── 11. Insurance / Medicaid / Member IDs ──
    cleaned = cleaned.replace(/\b(?:Member\s*ID|Medicaid\s*ID|Insurance\s*ID|Group\s*#?|Policy\s*#?|Claim\s*#?)\s*:?\s*[A-Za-z0-9\-]{5,20}\b/gi, () => { count++; return '[INSURANCE ID REMOVED]' })

    // ── 12. Driver's license numbers (state format: digits with hyphens) ──
    cleaned = cleaned.replace(/\b(?:driver'?s?\s*license|DL|CDL)\s*(?:#|number|num|no\.?)?\s*:?\s*[A-Za-z0-9\-]{6,15}\b/gi, () => { count++; return '[LICENSE REMOVED]' })

    // ── 13. Professional license numbers (PSY-, CSW-, LPC-, PT-, etc.) ──
    cleaned = cleaned.replace(/\b(?:License|Lic)\s*#?\s*:?\s*(?:PSY|CSW|LPC|LCSW|LMFT|PT|OT|MD|DO|RN|NP)-?\d{4,10}\b/gi, () => { count++; return '[LICENSE REMOVED]' })

    // ── 14. Badge numbers ──
    cleaned = cleaned.replace(/\b(?:badge|badge\s*#|badge\s*number)\s*:?\s*#?\s*[A-Za-z]*-?\d{2,8}\b/gi, () => { count++; return '[BADGE REMOVED]' })

    // ── 15. Employee / Student / Offender / Case IDs (PREFIX-YEAR-DIGITS patterns) ──
    cleaned = cleaned.replace(/\b(?:employee\s*ID|staff\s*ID|student\s*ID|offender\s*(?:number|#|ID)|CDOC\s*(?:#|number)?|inmate\s*(?:account|#|ID)|booking\s*#?|case\s*#?|SID|FBI\s*(?:number|#)?)\s*:?\s*[A-Za-z0-9\-]{4,20}\b/gi, () => { count++; return '[ID REMOVED]' })

    // ── 16. Generic alphanumeric IDs (LETTERS-YEAR-DIGITS format like CPD-2006-1184, ACS-2284) ──
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-\d{4}-\d{2,8}\b/g, () => { count++; return '[ID REMOVED]' })
    // Shorter prefix-digits: GTL-8847291, POST-2006-18847, SOMB-CO-2024-4472
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-(?:[A-Z]{2}-)?(?:\d{4}-)*\d{3,8}\b/g, () => { count++; return '[ID REMOVED]' })

    // ── 17. Passport numbers ──
    cleaned = cleaned.replace(/\b(?:passport)\s*#?\s*:?\s*[A-Z]?\d{6,9}\b/gi, () => { count++; return '[PASSPORT REMOVED]' })

    // ── 18. Bank account / routing numbers ──
    cleaned = cleaned.replace(/\b(?:account|routing)\s*#?\s*:?\s*[\*]*\d{4,12}\b/gi, () => { count++; return '[FINANCIAL REMOVED]' })

    // ── 19. Tax IDs (EIN format: XX-XXXXXXX) ──
    cleaned = cleaned.replace(/\b(?:Tax\s*ID|EIN)\s*:?\s*\d{2}-\d{7}\b/gi, () => { count++; return '[TAX ID REMOVED]' })

    // ── 20. Fax numbers ──
    cleaned = cleaned.replace(/\b(?:Fax|fax)\s*:?\s*\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => { count++; return '[FAX REMOVED]' })

    // ── 21. URLs ──
    cleaned = cleaned.replace(/\bhttps?:\/\/[^\s]+/gi, () => { count++; return '[URL REMOVED]' })

    // ── 22. Names with titles/honorifics ──
    // Catches: Dr. Firstname Lastname, Sgt. Firstname Lastname, Hon. Firstname Lastname, etc.
    // Also: Mr./Ms./Mrs. patterns, Officer/Detective/Lt./Chief patterns
    const NAME_TITLES = [
      'Dr', 'Mr', 'Ms', 'Mrs', 'Miss', 'Prof',
      'Sgt', 'Sergeant', 'Lt', 'Lieutenant', 'Cpl', 'Corporal',
      'Capt', 'Captain', 'Det', 'Detective', 'Inv', 'Investigator',
      'Chief', 'Officer', 'Ofc',
      'Hon', 'Judge', 'Justice',
      'Atty', 'Attorney',
    ]
    const titlePattern = NAME_TITLES.map(t => t.replace(/\./g, '\\.')).join('|')
    // Title + optional period + first name (+ optional middle initial) + last name
    const titleNameRegex = new RegExp(
      `\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`,
      'g'
    )
    cleaned = cleaned.replace(titleNameRegex, () => { count++; return '[NAME REMOVED]' })

    // Also catch: "Title Lastname" without first name (e.g., "Chief Hensley")
    const titleLastRegex = new RegExp(
      `\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]{2,}\\b`,
      'g'
    )
    cleaned = cleaned.replace(titleLastRegex, () => { count++; return '[NAME REMOVED]' })

    // ── 23. Labeled name fields ──
    // "Examinee: Firstname M. Lastname", "Referring Party: Firstname Lastname"
    const labeledNameLabels = [
      'Examinee', 'Patient', 'Client', 'Evaluee', 'Claimant',
      'Plaintiff', 'Defendant', 'Respondent', 'Petitioner',
      'Victim', 'Complainant', 'Subject',
    ]
    const labelPattern = labeledNameLabels.join('|')
    const labeledNameRegex = new RegExp(
      `\\b(?:${labelPattern})\\s*:\\s*[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?`,
      'g'
    )
    cleaned = cleaned.replace(labeledNameRegex, (match) => {
      const label = match.split(':')[0]
      count++
      return `${label}: [NAME REMOVED]`
    })

    // ── 24. Standalone full names (Firstname M. Lastname or Firstname Lastname) ──
    // This is aggressive: catches capitalized two/three-word sequences that look like names.
    // Run AFTER title-based removal to avoid double-processing.
    // Catches: "Adrian T. Maynard", "Jessica Lynn Trujillo", "Kevin Phan"
    // Skip common false positives: section headings (all caps), legal terms, place names
    const COMMON_NON_NAMES = new Set([
      'mental status', 'clinical formulation', 'relevant background',
      'referral question', 'united states', 'supreme court',
      'social security', 'district court', 'judicial district',
      'colorado springs', 'fort collins', 'denver county', 'adams county',
      'jefferson county', 'larimer county', 'el paso', 'arapahoe county',
      'boulder county', 'douglas county', 'weld county',
      'peak forensics', 'full scale', 'verbal comprehension',
      'working memory', 'processing speed', 'perceptual reasoning',
    ])

    // Match "Firstname [MiddleInitial.] Lastname" patterns not preceded by common labels
    cleaned = cleaned.replace(
      /\b([A-Z][a-z]{1,15})\s+([A-Z]\.?\s+)?([A-Z][a-z]{1,15}(?:-[A-Z][a-z]{1,15})?)\b/g,
      (match, first, _mid, last) => {
        // Skip if it looks like a place name, section heading, or common phrase
        const lower = match.toLowerCase()
        if (COMMON_NON_NAMES.has(lower)) return match
        // Skip single-letter "middle initials" that are really prepositions
        if (/^[A-Z][a-z]+\s+(The|And|For|With|From|Into|That|This|Each|Both|Such|Over|Upon)\s/i.test(match)) return match
        // Skip if followed by common non-name words (heuristic)
        // Only flag as a name if first and last both look like proper names (2+ chars, not common English words)
        const COMMON_WORDS = new Set([
          'the', 'and', 'for', 'was', 'were', 'are', 'has', 'had', 'his', 'her',
          'she', 'not', 'but', 'with', 'from', 'that', 'this', 'they', 'them',
          'been', 'have', 'will', 'would', 'could', 'should', 'about', 'into',
          'over', 'after', 'before', 'during', 'between', 'through', 'under',
          'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
          'both', 'each', 'more', 'most', 'other', 'some', 'such', 'only',
          'same', 'than', 'very', 'also', 'just', 'because', 'while',
          'does', 'did', 'doing', 'being', 'having', 'getting',
          // Common forensic/clinical terms that start with caps at sentence start
          'case', 'court', 'scale', 'test', 'score', 'trial', 'level',
          'total', 'index', 'factor', 'type', 'range', 'report', 'order',
          'standard', 'history', 'current', 'prior', 'first', 'second',
          'third', 'diagnosis', 'treatment', 'evidence', 'clinical',
        ])
        if (COMMON_WORDS.has(first.toLowerCase()) || COMMON_WORDS.has(last.toLowerCase())) return match
        if (first.length < 2 || last.length < 2) return match
        count++
        return '[NAME REMOVED]'
      }
    )

    // ── 25. Remaining standalone dates (catch dates written as "Date of Birth: Month DD, YYYY") ──
    cleaned = cleaned.replace(/\bDate\s+of\s+Birth\s*:\s*\[?[^\]\n]{5,30}\]?/gi, () => { count++; return 'Date of Birth: [DOB REMOVED]' })
    // "DOB: ..." patterns
    cleaned = cleaned.replace(/\bDOB\s*:\s*\S+/gi, () => { count++; return 'DOB: [DOB REMOVED]' })

    return { cleaned, strippedCount: count }
  }

  /** Extract text from a file for PHI stripping */
  async function extractText(filePath: string): Promise<string> {
    const ext = pathMod.extname(filePath).toLowerCase()
    if (ext === '.txt' || ext === '.csv' || ext === '.rtf' || ext === '.md') {
      return fs.readFileSync(filePath, 'utf-8')
    }
    if (ext === '.docx' || ext === '.doc') {
      const buffer = fs.readFileSync(filePath)
      const result = await mammoth.extractRawText({ buffer })
      return result.value ?? ''
    }
    return ''
  }

  // ── resources:upload ─────────────────────────────────────────────────────
  // Opens file picker, strips PHI, copies with ORIGINAL filename into the
  // category folder. Also writes a _cleaned/ version for AI consumption.
  ipcMain.handle(
    'resources:upload',
    async (event, params: { category: string; filePaths?: string[] }): Promise<
      IpcResponse<{ imported: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[]; phiStripped: number }>
    > => {
      try {
        ensureCategoryDirs()
        let filePaths = params.filePaths || []

        if (filePaths.length === 0) {
          const parentWindow = BrowserWindow.fromWebContents(event.sender)
          const result = await dialog.showOpenDialog(parentWindow!, {
            title: `Upload ${CATEGORY_LABELS[params.category] || params.category}`,
            filters: [
              { name: 'Documents', extensions: ['docx', 'doc', 'pdf', 'txt', 'csv', 'rtf', 'md'] },
              { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile', 'multiSelections'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return fail('USER_CANCELLED', 'No files selected')
          }
          filePaths = result.filePaths
        }

        const categoryDir = getCategoryDir(params.category)
        const imported: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[] = []
        let totalPhiStripped = 0

        for (const srcPath of filePaths) {
          const originalFilename = pathMod.basename(srcPath)
          const ext = pathMod.extname(originalFilename).toLowerCase()

          // Destination keeps original filename. Deduplicate if exists.
          let destFilename = originalFilename
          let destPath = pathMod.join(categoryDir, destFilename)
          let counter = 1
          while (fs.existsSync(destPath)) {
            const base = pathMod.basename(originalFilename, ext)
            destFilename = `${base} (${counter})${ext}`
            destPath = pathMod.join(categoryDir, destFilename)
            counter++
          }

          // Copy file with original name
          fs.copyFileSync(srcPath, destPath)

          // PHI strip for AI consumption → _cleaned/ subfolder
          let phiWasStripped = false
          const rawText = await extractText(srcPath)
          if (rawText && rawText.length > 0) {
            const { cleaned, strippedCount } = stripPhi(rawText)
            totalPhiStripped += strippedCount
            phiWasStripped = strippedCount > 0
            const cleanedDir = pathMod.join(categoryDir, '_cleaned')
            if (!fs.existsSync(cleanedDir)) fs.mkdirSync(cleanedDir, { recursive: true })
            const cleanedBase = cleanedBaseName(destFilename, ext)
            fs.writeFileSync(pathMod.join(cleanedDir, cleanedBase), cleaned, 'utf-8')
          }

          const stat = fs.statSync(destPath)
          imported.push({
            id: destFilename, // use filename as ID, it's unique within the folder
            category: params.category,
            originalFilename: destFilename,
            storedPath: destPath,
            fileSize: stat.size,
            mimeType: mimeForExt(ext),
            uploadedAt: stat.mtime.toISOString(),
            phiStripped: phiWasStripped,
          })
        }

        return ok({ imported, phiStripped: totalPhiStripped })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Resource upload failed'
        console.error('[resources:upload]', message)
        return fail('RESOURCE_UPLOAD_FAILED', message)
      }
    }
  )

  // ── resources:list ───────────────────────────────────────────────────────
  // Scans actual files in the category folders. No metadata files needed.
  // On first call, if folders are empty, auto-seeds demo resources.
  ipcMain.handle(
    'resources:list',
    async (_event, params: { category?: string }): Promise<
      IpcResponse<readonly { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[]>
    > => {
      try {
        // Do NOT call ensureCategoryDirs() here. Creating the _Resources
        // skeleton just to read from it pollutes the project root with
        // empty folders that show up in the LeftColumn tree. The directory
        // tree is populated lazily on first upload (resources:upload).
        // Until then the panel is empty by design.
        const results: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[] = []

        const categories = params.category ? [params.category] : Object.keys(CATEGORY_LABELS)
        for (const cat of categories) {
          const dir = getCategoryDir(cat)
          if (!fs.existsSync(dir)) continue

          // For writing-samples, list from _cleaned/ (de-identified copies only).
          // Originals with PHI are deleted after upload; only cleaned .txt files persist.
          if (cat === 'writing-samples') {
            const cleanedDir = pathMod.join(dir, '_cleaned')
            if (!fs.existsSync(cleanedDir)) continue
            const cleanedEntries: string[] = fs.readdirSync(cleanedDir)
            for (const filename of cleanedEntries) {
              if (filename.startsWith('.')) continue
              const ext = pathMod.extname(filename).toLowerCase()
              if (ext !== '.txt') continue

              const fullPath = pathMod.join(cleanedDir, filename)
              const stat = fs.statSync(fullPath)
              if (!stat.isFile()) continue

              results.push({
                id: filename,
                category: cat,
                originalFilename: filename,
                storedPath: fullPath,
                fileSize: stat.size,
                mimeType: 'text/plain',
                uploadedAt: stat.mtime.toISOString(),
                phiStripped: true,
              })
            }
            // Also list any .txt files in the main folder (seeded samples)
            const mainEntries: string[] = fs.readdirSync(dir)
            for (const filename of mainEntries) {
              if (filename.startsWith('.') || filename.startsWith('_')) continue
              const ext = pathMod.extname(filename).toLowerCase()
              if (ext !== '.txt') continue

              const fullPath = pathMod.join(dir, filename)
              const stat = fs.statSync(fullPath)
              if (!stat.isFile()) continue

              // Skip if already listed from _cleaned/
              if (results.some(r => r.originalFilename === filename && r.category === cat)) continue

              results.push({
                id: filename,
                category: cat,
                originalFilename: filename,
                storedPath: fullPath,
                fileSize: stat.size,
                mimeType: 'text/plain',
                uploadedAt: stat.mtime.toISOString(),
                phiStripped: false,
              })
            }
            continue
          }

          const entries: string[] = fs.readdirSync(dir)
          for (const filename of entries) {
            // Skip hidden files, system files, and the _cleaned subfolder
            if (filename.startsWith('.') || filename.startsWith('_')) continue
            const ext = pathMod.extname(filename).toLowerCase()
            if (!DOC_EXTS.has(ext)) continue

            const fullPath = pathMod.join(dir, filename)
            const stat = fs.statSync(fullPath)
            if (!stat.isFile()) continue

            // Check if a cleaned version exists
            const cleanedPath = pathMod.join(dir, '_cleaned', cleanedBaseName(filename, ext))
            const hasCleanedVersion = fs.existsSync(cleanedPath)

            results.push({
              id: filename,
              category: cat,
              originalFilename: filename,
              storedPath: fullPath,
              fileSize: stat.size,
              mimeType: mimeForExt(ext),
              uploadedAt: stat.mtime.toISOString(),
              phiStripped: hasCleanedVersion,
            })
          }
        }

        // Sort by filename ascending within each category
        results.sort((a, b) => a.originalFilename.localeCompare(b.originalFilename))
        return ok(results)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Resource list failed'
        return fail('RESOURCE_LIST_FAILED', message)
      }
    }
  )

  // ── resources:delete ─────────────────────────────────────────────────────
  ipcMain.handle(
    'resources:delete',
    async (_event, params: { id: string; storedPath: string }): Promise<IpcResponse<void>> => {
      try {
        // Remove the actual file
        if (fs.existsSync(params.storedPath)) fs.unlinkSync(params.storedPath)
        // If the file is NOT inside _cleaned/, also remove the cleaned version
        const dir = pathMod.dirname(params.storedPath)
        const dirName = pathMod.basename(dir)
        if (dirName !== '_cleaned') {
          const ext = pathMod.extname(params.storedPath)
          const cleanedPath = pathMod.join(dir, '_cleaned', cleanedBaseName(params.storedPath, ext))
          if (fs.existsSync(cleanedPath)) fs.unlinkSync(cleanedPath)
        }
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Resource delete failed'
        return fail('RESOURCE_DELETE_FAILED', message)
      }
    }
  )

  // ── resources:open ───────────────────────────────────────────────────────
  ipcMain.handle(
    'resources:open',
    async (_event, params: { storedPath: string }): Promise<IpcResponse<void>> => {
      try {
        await shell.openPath(params.storedPath)
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Resource open failed'
        return fail('RESOURCE_OPEN_FAILED', message)
      }
    }
  )

  // ── resources:uploadWritingSample ──────────────────────────────────────────
  // Dedicated writing sample upload with Presidio NER-based PHI stripping.
  // Unlike the generic resources:upload (which uses regex), this handler sends
  // extracted text through the Python sidecar's pii/redact endpoint, which
  // uses Presidio AnalyzerEngine + spaCy en_core_web_lg to detect all 18
  // HIPAA Safe Harbor identifiers: names, dates, phones, SSNs, MRNs, emails,
  // addresses, account numbers, license numbers, device IDs, URLs, IPs,
  // biometric IDs, vehicle IDs, geographic data, ages 90+, and any other
  // unique identifying number.
  //
  // The cleaned text is saved to _cleaned/ and is the ONLY version ever sent
  // to AI for voice/style analysis. The original stays on disk for the
  // doctor's reference but never leaves the machine.
  ipcMain.handle(
    'resources:uploadWritingSample',
    async (event, params: { filePaths?: string[] }): Promise<
      IpcResponse<{
        imported: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[]
        reports: { filename: string; originalSize: number; cleanedSize: number; entityCount: number; typeBreakdown: Record<string, number>; presidioUsed: boolean; cleanedPath: string; cleanedPreview: string }[]
        totalPhiStripped: number
        sidecarAvailable: boolean
      }>
    > => {
      try {
        ensureCategoryDirs()
        let filePaths = params.filePaths || []

        if (filePaths.length === 0) {
          const parentWindow = BrowserWindow.fromWebContents(event.sender)
          const result = await dialog.showOpenDialog(parentWindow!, {
            title: 'Upload Writing Samples for Voice Analysis',
            filters: [
              { name: 'Documents', extensions: ['docx', 'doc', 'pdf', 'txt', 'rtf', 'md'] },
              { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile', 'multiSelections'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return fail('USER_CANCELLED', 'No files selected')
          }
          filePaths = result.filePaths
        }

        const categoryDir = getCategoryDir('writing-samples')
        const cleanedDir = pathMod.join(categoryDir, '_cleaned')
        if (!fs.existsSync(cleanedDir)) fs.mkdirSync(cleanedDir, { recursive: true })

        const imported: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[] = []
        const reports: { filename: string; originalSize: number; cleanedSize: number; entityCount: number; typeBreakdown: Record<string, number>; presidioUsed: boolean; cleanedPath: string; cleanedPreview: string }[] = []
        let totalPhiStripped = 0

        // Test sidecar availability once before processing files
        let sidecarAvailable = false
        try {
          const { healthCheck } = require('../sidecar') as typeof import('../sidecar')
          await healthCheck()
          sidecarAvailable = true
        } catch {
          console.warn('[resources:uploadWritingSample] Presidio sidecar not available, falling back to regex')
        }

        for (const srcPath of filePaths) {
          const originalFilename = pathMod.basename(srcPath)
          const ext = pathMod.extname(originalFilename).toLowerCase()

          // Deduplicate destination filename
          let destFilename = originalFilename
          let destPath = pathMod.join(categoryDir, destFilename)
          let counter = 1
          while (fs.existsSync(destPath)) {
            const base = pathMod.basename(originalFilename, ext)
            destFilename = `${base} (${counter})${ext}`
            destPath = pathMod.join(categoryDir, destFilename)
            counter++
          }

          // Copy original to Writing Samples folder
          fs.copyFileSync(srcPath, destPath)

          // Extract text for PHI processing
          let rawText = ''
          if (ext === '.pdf') {
            try {
              const pdfBuffer = fs.readFileSync(srcPath)
              const pdfData = await pdfParse(pdfBuffer)
              rawText = pdfData.text ?? ''
            } catch (pdfErr) {
              console.warn(`[resources:uploadWritingSample] PDF text extraction failed for ${originalFilename}:`, pdfErr)
            }
          } else {
            rawText = await extractText(srcPath)
          }

          if (!rawText || rawText.trim().length === 0) {
            // No text to process (binary file or extraction failure)
            const stat = fs.statSync(destPath)
            imported.push({
              id: destFilename,
              category: 'writing-samples',
              originalFilename: destFilename,
              storedPath: destPath,
              fileSize: stat.size,
              mimeType: mimeForExt(ext),
              uploadedAt: stat.mtime.toISOString(),
              phiStripped: false,
            })
            reports.push({
              filename: destFilename,
              originalSize: rawText.length,
              cleanedSize: 0,
              entityCount: 0,
              typeBreakdown: {},
              presidioUsed: false,
              cleanedPath: '',
              cleanedPreview: '(No text could be extracted from this file)',
            })
            continue
          }

          let cleanedText = ''
          let entityCount = 0
          let typeBreakdown: Record<string, number> = {}
          let presidioUsed = false

          if (sidecarAvailable) {
            // Use Presidio sidecar for NER-based PHI detection (18 HIPAA identifiers)
            const operationId = `ws-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            try {
              const redactResult = await redact(rawText, operationId, 'report')
              cleanedText = redactResult.redactedText
              entityCount = redactResult.entityCount
              typeBreakdown = redactResult.typeBreakdown
              presidioUsed = true

              // CRITICAL: Destroy the UNID map immediately.
              // Writing sample de-identification is permanent. We never need to
              // rehydrate these texts. The UNID map contains the PHI-to-token
              // mapping and must not persist in memory.
              try {
                await destroyMap(operationId)
              } catch {
                // Non-fatal: map may have been auto-destroyed by rehydrate timeout
                console.warn(`[resources:uploadWritingSample] UNID map destroy returned error for ${operationId}`)
              }

              // Replace UNIDs with generic category markers for readability.
              // The redacted text contains tokens like [UNID-a7f3b2] which are
              // opaque. Replace them with readable markers like [PERSON], [DATE], etc.
              // Since we destroyed the map, the UNIDs are now meaningless tokens.
              // We keep them as-is because the Writer Agent only needs the structure
              // and voice, not the specific placeholder format.

            } catch (redactErr) {
              console.warn(`[resources:uploadWritingSample] Presidio redaction failed for ${originalFilename}, falling back to regex:`, redactErr)
              // Destroy map on error too, in case it was partially created
              try { await destroyMap(operationId) } catch { /* ignore */ }
              // Fall through to regex below
            }
          }

          // Regex fallback if sidecar unavailable or Presidio failed
          if (!presidioUsed) {
            const { cleaned, strippedCount } = stripPhi(rawText)
            cleanedText = cleaned
            entityCount = strippedCount
            typeBreakdown = strippedCount > 0 ? { 'REGEX_PATTERN': strippedCount } : {}
          }

          totalPhiStripped += entityCount

          // Write cleaned version for AI consumption
          const cleanedBase = cleanedBaseName(destFilename, ext)
          const cleanedPath = pathMod.join(cleanedDir, cleanedBase)
          fs.writeFileSync(cleanedPath, cleanedText, 'utf-8')

          // CRITICAL: Delete the original file (which contains PHI).
          // Only the de-identified .txt copy persists in the application.
          // The original must not remain on disk after cleaning.
          try {
            if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
          } catch (delErr) {
            console.warn(`[resources:uploadWritingSample] Could not delete original with PHI: ${destPath}`, delErr)
          }

          const cleanedStat = fs.statSync(cleanedPath)
          imported.push({
            id: cleanedBase,
            category: 'writing-samples',
            originalFilename: cleanedBase,
            storedPath: cleanedPath,
            fileSize: cleanedStat.size,
            mimeType: 'text/plain',
            uploadedAt: cleanedStat.mtime.toISOString(),
            phiStripped: entityCount > 0,
          })

          reports.push({
            filename: destFilename,
            originalSize: rawText.length,
            cleanedSize: cleanedText.length,
            entityCount,
            typeBreakdown,
            presidioUsed,
            cleanedPath,
            cleanedPreview: cleanedText.slice(0, 500),
          })
        }

        return ok({ imported, reports, totalPhiStripped, sidecarAvailable })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Writing sample upload failed'
        console.error('[resources:uploadWritingSample]', message)
        return fail('WRITING_SAMPLE_UPLOAD_FAILED', message)
      }
    }
  )

  // ── resources:previewCleaned ─────────────────────────────────────────────
  // Returns the de-identified text for a writing sample.
  // Originals with PHI are deleted at upload time; only the cleaned .txt
  // persists. The "originalText" field returns the same cleaned text since
  // the original is gone (this preserves the response shape for the UI).
  ipcMain.handle(
    'resources:previewCleaned',
    async (_event, params: { storedPath: string }): Promise<IpcResponse<{
      cleanedText: string
      originalText: string
      entityCount: number
      typeBreakdown: Record<string, number>
    }>> => {
      try {
        const filePath = params.storedPath
        if (!fs.existsSync(filePath)) {
          return fail('RESOURCE_NOT_FOUND', `File not found: ${filePath}`)
        }

        // The storedPath may point to _cleaned/ (new uploads) or main folder (seeded samples).
        // In either case, read the text directly.
        const ext = pathMod.extname(filePath).toLowerCase()
        let cleanedText = ''
        if (ext === '.pdf') {
          try {
            const pdfBuffer = fs.readFileSync(filePath)
            const pdfData = await pdfParse(pdfBuffer)
            cleanedText = pdfData.text ?? ''
          } catch {
            cleanedText = '(Could not extract text from PDF)'
          }
        } else {
          cleanedText = await extractText(filePath)
        }

        // If the file lives in _cleaned/, also check for the cleaned version
        // (it is the file itself). Count redaction markers.
        const markers = cleanedText.match(/\[(?:PERSON|DATE_TIME|PHONE_NUMBER|EMAIL_ADDRESS|US_SSN|LOCATION|CREDIT_CARD|CRYPTO|US_BANK_NUMBER|US_DRIVER_LICENSE|US_ITIN|US_PASSPORT|IP_ADDRESS|MEDICAL_LICENSE|URL|NRP|SSN REMOVED|DOB REMOVED|PHONE REMOVED|EMAIL REMOVED|ADDRESS REMOVED|UNID-[a-z0-9]+)\]/gi)
        const entityCount = markers ? markers.length : 0

        return ok({
          cleanedText,
          originalText: '(Original with PHI was permanently deleted after de-identification)',
          entityCount,
          typeBreakdown: {},
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Preview failed'
        return fail('PREVIEW_FAILED', message)
      }
    }
  )

  // ── resources:analyzeStyle ─────────────────────────────────────────────────
  // Runs local text analysis on de-identified writing samples to extract
  // voice and vocabulary style metrics. Operates only on _cleaned/ versions.
  // No network calls, no AI, purely local NLP heuristics.
  ipcMain.handle(
    'resources:analyzeStyle',
    async (_event, params: { storedPaths: string[] }): Promise<IpcResponse<{
      profiles: {
        filename: string
        avgSentenceLength: number
        medianSentenceLength: number
        wordCount: number
        sentenceCount: number
        paragraphCount: number
        avgParagraphLength: number
        vocabularyRichness: number
        topTerms: { term: string; count: number }[]
        hedgingPhrases: { phrase: string; count: number }[]
        personReference: { firstPerson: number; thirdPerson: number }
        tenseDistribution: { past: number; present: number }
        sectionHeadings: string[]
        formalityScore: number
      }[]
      aggregate: {
        avgSentenceLength: number
        vocabularyRichness: number
        formalityScore: number
        topTerms: { term: string; count: number }[]
        hedgingPhrases: { phrase: string; count: number }[]
        sampleCount: number
        totalWordCount: number
      }
    }>> => {
      try {
        // Clinical/forensic terms to track frequency
        const CLINICAL_TERMS = new Set([
          'evaluation', 'assessment', 'clinical', 'forensic', 'diagnosis', 'diagnostic',
          'psychological', 'psychiatric', 'cognitive', 'behavioral', 'affective',
          'competency', 'competent', 'malingering', 'symptom', 'symptoms',
          'disorder', 'impairment', 'functioning', 'history', 'interview',
          'collateral', 'records', 'testing', 'administered', 'results',
          'scale', 'score', 'scores', 'percentile', 'profile', 'validity',
          'criteria', 'criterion', 'consistent', 'inconsistent', 'reported',
          'presented', 'observed', 'exhibited', 'endorsed', 'denied',
          'treatment', 'medication', 'substance', 'trauma', 'risk',
          'recommendation', 'opinion', 'conclusion', 'formulation',
          'defendant', 'plaintiff', 'petitioner', 'respondent', 'examinee',
          'evaluee', 'claimant', 'referred', 'referral', 'court',
          'adjudicative', 'rational', 'factual', 'understanding',
          'prognosis', 'etiology', 'differential', 'comorbid', 'severity',
          'baseline', 'normative', 'standardized', 'psychometric',
          'reliability', 'validity', 'credibility', 'effort',
        ])

        // Hedging phrases common in forensic reports
        const HEDGING_PATTERNS = [
          'appears to', 'is consistent with', 'is inconsistent with',
          'suggests that', 'it is likely that', 'it is unlikely that',
          'to a reasonable degree of', 'within a reasonable degree',
          'more likely than not', 'based on the available',
          'the data suggest', 'the results indicate',
          'in this examiner\'s opinion', 'in my professional opinion',
          'the evidence suggests', 'it should be noted',
          'notably', 'it is important to note',
          'cannot be ruled out', 'may be attributed to',
          'appears consistent', 'does not appear to',
        ]

        // First-person markers
        const FIRST_PERSON = new Set(['i', 'my', 'me', 'mine', 'myself', 'we', 'our', 'us'])
        // Third-person markers (clinical)
        const THIRD_PERSON = new Set(['he', 'she', 'they', 'his', 'her', 'their', 'him', 'them',
          'the evaluee', 'the examinee', 'the defendant', 'the plaintiff',
          'the claimant', 'the respondent', 'the petitioner', 'mr', 'ms', 'mrs', 'dr'])

        // Past tense markers (simplified heuristic)
        const PAST_ENDINGS = ['ed', 'was', 'were', 'had', 'did', 'said', 'told', 'went', 'came', 'gave', 'made', 'took']

        const profiles: {
          filename: string; avgSentenceLength: number; medianSentenceLength: number
          wordCount: number; sentenceCount: number; paragraphCount: number
          avgParagraphLength: number; vocabularyRichness: number
          topTerms: { term: string; count: number }[]
          hedgingPhrases: { phrase: string; count: number }[]
          personReference: { firstPerson: number; thirdPerson: number }
          tenseDistribution: { past: number; present: number }
          sectionHeadings: string[]; formalityScore: number
        }[] = []

        for (const storedPath of params.storedPaths) {
          // Read the _cleaned/ version, not the original
          const ext = pathMod.extname(storedPath).toLowerCase()
          const dir = pathMod.dirname(storedPath)
          const cleanedBase = cleanedBaseName(storedPath, ext)
          const cleanedPath = pathMod.join(dir, '_cleaned', cleanedBase)

          let text = ''
          if (fs.existsSync(cleanedPath)) {
            text = fs.readFileSync(cleanedPath, 'utf-8')
          } else if (fs.existsSync(storedPath)) {
            // Fallback to original if no cleaned version (pre-existing files)
            text = await extractText(storedPath)
          }

          if (!text || text.trim().length === 0) {
            profiles.push({
              filename: pathMod.basename(storedPath),
              avgSentenceLength: 0, medianSentenceLength: 0,
              wordCount: 0, sentenceCount: 0, paragraphCount: 0,
              avgParagraphLength: 0, vocabularyRichness: 0,
              topTerms: [], hedgingPhrases: [],
              personReference: { firstPerson: 0, thirdPerson: 0 },
              tenseDistribution: { past: 0, present: 0 },
              sectionHeadings: [], formalityScore: 0,
            })
            continue
          }

          // Split into paragraphs
          const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
          const paragraphCount = paragraphs.length

          // Split into sentences (heuristic: period/question/exclamation followed by space+capital or end)
          const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 5)
          const sentenceCount = Math.max(sentences.length, 1)

          // Sentence lengths
          const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length)
          sentenceLengths.sort((a, b) => a - b)
          const avgSentenceLength = sentenceLengths.length > 0
            ? Math.round((sentenceLengths.reduce((sum, l) => sum + l, 0) / sentenceLengths.length) * 10) / 10
            : 0
          const medianSentenceLength = sentenceLengths.length > 0
            ? sentenceLengths[Math.floor(sentenceLengths.length / 2)]
            : 0

          // Words
          const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
          const wordCount = words.length
          const cleanWords = words.map(w => w.replace(/[^a-z'-]/g, '')).filter(w => w.length > 1)
          const uniqueWords = new Set(cleanWords)
          const vocabularyRichness = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 1000) / 1000 : 0

          // Average paragraph length
          const avgParagraphLength = paragraphCount > 0
            ? Math.round((sentenceCount / paragraphCount) * 10) / 10
            : 0

          // Clinical term frequency
          const termCounts: Record<string, number> = {}
          for (const w of cleanWords) {
            if (CLINICAL_TERMS.has(w)) {
              termCounts[w] = (termCounts[w] || 0) + 1
            }
          }
          const topTerms = Object.entries(termCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([term, count]) => ({ term, count }))

          // Hedging phrase detection
          const lowerText = text.toLowerCase()
          const hedgingPhrases: { phrase: string; count: number }[] = []
          for (const phrase of HEDGING_PATTERNS) {
            const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            const matches = text.match(regex)
            if (matches && matches.length > 0) {
              hedgingPhrases.push({ phrase, count: matches.length })
            }
          }
          hedgingPhrases.sort((a, b) => b.count - a.count)

          // Person reference analysis
          let firstPersonCount = 0
          let thirdPersonCount = 0
          for (const w of cleanWords) {
            if (FIRST_PERSON.has(w)) firstPersonCount++
            if (THIRD_PERSON.has(w)) thirdPersonCount++
          }
          const totalPerson = Math.max(firstPersonCount + thirdPersonCount, 1)
          const personReference = {
            firstPerson: Math.round((firstPersonCount / totalPerson) * 100),
            thirdPerson: Math.round((thirdPersonCount / totalPerson) * 100),
          }

          // Tense distribution (simplified)
          let pastCount = 0
          let presentCount = 0
          for (const w of cleanWords) {
            if (PAST_ENDINGS.includes(w) || (w.endsWith('ed') && w.length > 3)) pastCount++
            else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) presentCount++
          }
          const totalTense = Math.max(pastCount + presentCount, 1)
          const tenseDistribution = {
            past: Math.round((pastCount / totalTense) * 100),
            present: Math.round((presentCount / totalTense) * 100),
          }

          // Section headings (all-caps lines or lines ending with colon that are short)
          const sectionHeadings: string[] = []
          for (const line of text.split('\n')) {
            const trimmed = line.trim()
            if (trimmed.length < 3 || trimmed.length > 80) continue
            // All caps line (at least 3 words)
            if (/^[A-Z\s:]+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) {
              sectionHeadings.push(trimmed)
            }
            // Title case line ending with colon
            else if (/^[A-Z][a-z].*:$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) {
              sectionHeadings.push(trimmed)
            }
          }

          // Formality score (0-1): higher = more formal
          // Heuristic: long sentences + low first-person + high vocabulary richness + clinical terms
          const formalityScore = Math.min(1, Math.max(0,
            (Math.min(avgSentenceLength / 30, 1) * 0.25) +
            ((1 - (firstPersonCount / totalPerson)) * 0.25) +
            (Math.min(vocabularyRichness / 0.5, 1) * 0.25) +
            (Math.min(topTerms.length / 15, 1) * 0.25)
          ))

          profiles.push({
            filename: pathMod.basename(storedPath),
            avgSentenceLength, medianSentenceLength,
            wordCount, sentenceCount, paragraphCount, avgParagraphLength,
            vocabularyRichness, topTerms, hedgingPhrases,
            personReference, tenseDistribution,
            sectionHeadings: sectionHeadings.slice(0, 30),
            formalityScore: Math.round(formalityScore * 100) / 100,
          })
        }

        // Aggregate
        const totalWordCount = profiles.reduce((s, p) => s + p.wordCount, 0)
        const avgSentenceLength = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.avgSentenceLength, 0) / profiles.length) * 10) / 10
          : 0
        const vocabularyRichness = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.vocabularyRichness, 0) / profiles.length) * 1000) / 1000
          : 0
        const formalityScore = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.formalityScore, 0) / profiles.length) * 100) / 100
          : 0

        // Merge top terms across all profiles
        const mergedTerms: Record<string, number> = {}
        for (const p of profiles) {
          for (const t of p.topTerms) {
            mergedTerms[t.term] = (mergedTerms[t.term] || 0) + t.count
          }
        }
        const topTerms = Object.entries(mergedTerms)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([term, count]) => ({ term, count }))

        // Merge hedging phrases
        const mergedHedging: Record<string, number> = {}
        for (const p of profiles) {
          for (const h of p.hedgingPhrases) {
            mergedHedging[h.phrase] = (mergedHedging[h.phrase] || 0) + h.count
          }
        }
        const hedgingPhrases = Object.entries(mergedHedging)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 15)
          .map(([phrase, count]) => ({ phrase, count }))

        // Aggregate person reference and tense distribution
        let aggFirstPerson = 0
        let aggThirdPerson = 0
        let aggPast = 0
        let aggPresent = 0
        const allHeadings: string[] = []
        for (const p of profiles) {
          aggFirstPerson += p.personReference.firstPerson
          aggThirdPerson += p.personReference.thirdPerson
          aggPast += p.tenseDistribution.past
          aggPresent += p.tenseDistribution.present
          for (const h of p.sectionHeadings) {
            if (!allHeadings.includes(h)) allHeadings.push(h)
          }
        }
        const personCount = profiles.length || 1
        const personReference = {
          firstPerson: Math.round(aggFirstPerson / personCount),
          thirdPerson: Math.round(aggThirdPerson / personCount),
        }
        const tenseDistribution = {
          past: Math.round(aggPast / personCount),
          present: Math.round(aggPresent / personCount),
        }
        const sectionHeadings = allHeadings.slice(0, 30)

        const aggregate = {
          avgSentenceLength,
          vocabularyRichness,
          formalityScore,
          topTerms,
          hedgingPhrases,
          sampleCount: profiles.length,
          totalWordCount,
          personReference,
          tenseDistribution,
          sectionHeadings,
        }

        // Persist the aggregate as .style-profile.json
        try {
          const profilePath = pathMod.join(getCategoryDir('writing-samples'), '.style-profile.json')
          const persisted = {
            version: 1,
            updatedAt: new Date().toISOString(),
            ...aggregate,
          }
          fs.writeFileSync(profilePath, JSON.stringify(persisted, null, 2), 'utf-8')
        } catch (persistErr) {
          console.warn('[resources:analyzeStyle] Could not persist style profile:', persistErr)
        }

        return ok({ profiles, aggregate })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Style analysis failed'
        console.error('[resources:analyzeStyle]', message)
        return fail('STYLE_ANALYSIS_FAILED', message)
      }
    }
  )

  // ── resources:getStyleProfile ─────────────────────────────────────────────
  // Returns the persisted voice/style profile from .style-profile.json, or null.
  ipcMain.handle(
    'resources:getStyleProfile',
    async (): Promise<IpcResponse<unknown>> => {
      try {
        const profilePath = pathMod.join(getCategoryDir('writing-samples'), '.style-profile.json')
        if (!fs.existsSync(profilePath)) return ok(null)
        const raw = fs.readFileSync(profilePath, 'utf-8')
        return ok(JSON.parse(raw))
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load style profile'
        console.error('[resources:getStyleProfile]', message)
        return ok(null)
      }
    }
  )

  // ── resources:recalculateStyleProfile ───────────────────────────────────────
  // Scans ALL cleaned writing samples and re-runs the full style analysis.
  // Persists the result and returns the full analysis (profiles + aggregate).
  ipcMain.handle(
    'resources:recalculateStyleProfile',
    async (): Promise<IpcResponse<unknown>> => {
      try {
        const cleanedDir = pathMod.join(getCategoryDir('writing-samples'), '_cleaned')
        if (!fs.existsSync(cleanedDir)) {
          return ok({ profiles: [], aggregate: null })
        }
        const allFiles = fs.readdirSync(cleanedDir)
          .filter(f => f.endsWith('.txt') && !f.startsWith('.'))
          .map(f => pathMod.join(getCategoryDir('writing-samples'), f.replace('.txt', '.original-stub')))

        // Build storedPaths that the analyzeStyle handler expects:
        // it derives the _cleaned/ path from the storedPath. We need to
        // construct paths such that pathMod.join(dir, '_cleaned', base + '.txt') resolves.
        // The simplest approach: list the _cleaned/ .txt files and create
        // synthetic storedPaths that resolve correctly.
        const txtFiles = fs.readdirSync(cleanedDir)
          .filter(f => f.endsWith('.txt') && !f.startsWith('.'))
        const catDir = getCategoryDir('writing-samples')

        // For each cleaned file, we need a storedPath whose basename (minus ext) + '.txt'
        // matches the cleaned filename. Use the cleaned path directly as storedPath;
        // the analyzeStyle handler will try _cleaned/ first, then fall back to the file itself.
        const storedPaths = txtFiles.map(f => pathMod.join(catDir, f))

        if (storedPaths.length === 0) {
          return ok({ profiles: [], aggregate: null })
        }

        // Simulate an invoke to the analyzeStyle handler by building the same
        // event shape. Since we are in the main process, call ipcMain handlers
        // indirectly. The cleanest approach: invoke the channel directly.
        const { ipcMain: ipc } = require('electron')
        // Easier: just use ipcRenderer.invoke from main is not possible,
        // so we call the handler function through Electron's internal dispatch.
        const result = await (ipc as typeof import('electron').IpcMain)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .emit('resources:analyzeStyle', {} as any, { storedPaths }) as any

        // Since emit doesn't return the handler result, we need a different approach.
        // Instead, read the _cleaned files directly and return the profile.
        // Read the persisted profile that analyzeStyle just saved... but we haven't
        // called it yet. Let's just read the files ourselves.

        // Actually, the simplest correct approach: use electron's
        // ipcMain._invokeHandlerForChannel or call the analyzeStyle manually.
        // Let's restructure: directly invoke the analyze handler via the IPC system.
        // Electron does not expose a direct way to call IPC handlers from main.
        // The correct solution is to share the analysis logic.
        // For now, read all cleaned text files and build the aggregate ourselves.

        const profiles: {
          filename: string; avgSentenceLength: number; medianSentenceLength: number
          wordCount: number; sentenceCount: number; paragraphCount: number
          avgParagraphLength: number; vocabularyRichness: number
          topTerms: { term: string; count: number }[]
          hedgingPhrases: { phrase: string; count: number }[]
          personReference: { firstPerson: number; thirdPerson: number }
          tenseDistribution: { past: number; present: number }
          sectionHeadings: string[]; formalityScore: number
        }[] = []

        // Clinical/forensic terms
        const CLINICAL_TERMS = new Set([
          'evaluation', 'assessment', 'clinical', 'forensic', 'diagnosis', 'diagnostic',
          'psychological', 'psychiatric', 'cognitive', 'behavioral', 'affective',
          'competency', 'competent', 'malingering', 'symptom', 'symptoms',
          'disorder', 'impairment', 'functioning', 'history', 'interview',
          'collateral', 'records', 'testing', 'administered', 'results',
          'scale', 'score', 'scores', 'percentile', 'profile', 'validity',
          'criteria', 'criterion', 'consistent', 'inconsistent', 'reported',
          'presented', 'observed', 'exhibited', 'endorsed', 'denied',
          'treatment', 'medication', 'substance', 'trauma', 'risk',
          'recommendation', 'opinion', 'conclusion', 'formulation',
          'defendant', 'plaintiff', 'petitioner', 'respondent', 'examinee',
          'evaluee', 'claimant', 'referred', 'referral', 'court',
          'adjudicative', 'rational', 'factual', 'understanding',
          'prognosis', 'etiology', 'differential', 'comorbid', 'severity',
          'baseline', 'normative', 'standardized', 'psychometric',
          'reliability', 'validity', 'credibility', 'effort',
        ])
        const HEDGING_PATTERNS = [
          'appears to', 'is consistent with', 'is inconsistent with',
          'suggests that', 'it is likely that', 'it is unlikely that',
          'to a reasonable degree of', 'within a reasonable degree',
          'more likely than not', 'based on the available',
          'the data suggest', 'the results indicate',
          'in this examiner\'s opinion', 'in my professional opinion',
          'the evidence suggests', 'it should be noted',
          'notably', 'it is important to note',
          'cannot be ruled out', 'may be attributed to',
          'appears consistent', 'does not appear to',
        ]
        const FIRST_PERSON = new Set(['i', 'my', 'me', 'mine', 'myself', 'we', 'our', 'us'])
        const THIRD_PERSON = new Set(['he', 'she', 'they', 'his', 'her', 'their', 'him', 'them',
          'the evaluee', 'the examinee', 'the defendant', 'the plaintiff',
          'the claimant', 'the respondent', 'the petitioner', 'mr', 'ms', 'mrs', 'dr'])
        const PAST_ENDINGS = ['ed', 'was', 'were', 'had', 'did', 'said', 'told', 'went', 'came', 'gave', 'made', 'took']

        for (const txtFile of txtFiles) {
          const text = fs.readFileSync(pathMod.join(cleanedDir, txtFile), 'utf-8')
          if (!text || text.trim().length === 0) continue

          const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
          const paragraphCount = paragraphs.length
          const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 5)
          const sentenceCount = Math.max(sentences.length, 1)
          const sentenceLengths = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length)
          sentenceLengths.sort((a, b) => a - b)
          const avgSentenceLength = sentenceLengths.length > 0
            ? Math.round((sentenceLengths.reduce((sum, l) => sum + l, 0) / sentenceLengths.length) * 10) / 10 : 0
          const medianSentenceLength = sentenceLengths.length > 0
            ? sentenceLengths[Math.floor(sentenceLengths.length / 2)] : 0

          const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0)
          const wordCount = words.length
          const cleanWords = words.map(w => w.replace(/[^a-z'-]/g, '')).filter(w => w.length > 1)
          const uniqueWords = new Set(cleanWords)
          const vocabularyRichness = wordCount > 0 ? Math.round((uniqueWords.size / wordCount) * 1000) / 1000 : 0
          const avgParagraphLength = paragraphCount > 0
            ? Math.round((sentenceCount / paragraphCount) * 10) / 10 : 0

          const termCounts: Record<string, number> = {}
          for (const w of cleanWords) {
            if (CLINICAL_TERMS.has(w)) termCounts[w] = (termCounts[w] || 0) + 1
          }
          const topTerms = Object.entries(termCounts)
            .sort(([, a], [, b]) => b - a).slice(0, 20)
            .map(([term, count]) => ({ term, count }))

          const lowerText = text.toLowerCase()
          const hedgingPhrases: { phrase: string; count: number }[] = []
          for (const phrase of HEDGING_PATTERNS) {
            const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            const matches = text.match(regex)
            if (matches && matches.length > 0) hedgingPhrases.push({ phrase, count: matches.length })
          }
          hedgingPhrases.sort((a, b) => b.count - a.count)

          let firstPersonCount = 0
          let thirdPersonCount = 0
          for (const w of cleanWords) {
            if (FIRST_PERSON.has(w)) firstPersonCount++
            if (THIRD_PERSON.has(w)) thirdPersonCount++
          }
          const totalPerson = Math.max(firstPersonCount + thirdPersonCount, 1)
          const personReference = {
            firstPerson: Math.round((firstPersonCount / totalPerson) * 100),
            thirdPerson: Math.round((thirdPersonCount / totalPerson) * 100),
          }

          let pastCount = 0
          let presentCount = 0
          for (const w of cleanWords) {
            if (PAST_ENDINGS.includes(w) || (w.endsWith('ed') && w.length > 3)) pastCount++
            else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) presentCount++
          }
          const totalTense = Math.max(pastCount + presentCount, 1)
          const tenseDistribution = {
            past: Math.round((pastCount / totalTense) * 100),
            present: Math.round((presentCount / totalTense) * 100),
          }

          const sectionHeadings: string[] = []
          for (const line of text.split('\n')) {
            const trimmed = line.trim()
            if (trimmed.length < 3 || trimmed.length > 80) continue
            if (/^[A-Z\s:]+$/.test(trimmed) && trimmed.split(/\s+/).length >= 2) sectionHeadings.push(trimmed)
            else if (/^[A-Z][a-z].*:$/.test(trimmed) && trimmed.split(/\s+/).length <= 8) sectionHeadings.push(trimmed)
          }

          const formalityScore = Math.min(1, Math.max(0,
            (Math.min(avgSentenceLength / 30, 1) * 0.25) +
            ((1 - (firstPersonCount / totalPerson)) * 0.25) +
            (Math.min(vocabularyRichness / 0.5, 1) * 0.25) +
            (Math.min(topTerms.length / 15, 1) * 0.25)
          ))

          profiles.push({
            filename: txtFile,
            avgSentenceLength, medianSentenceLength,
            wordCount, sentenceCount, paragraphCount, avgParagraphLength,
            vocabularyRichness, topTerms, hedgingPhrases,
            personReference, tenseDistribution,
            sectionHeadings: sectionHeadings.slice(0, 30),
            formalityScore: Math.round(formalityScore * 100) / 100,
          })
        }

        // Build aggregate
        const totalWordCount = profiles.reduce((s, p) => s + p.wordCount, 0)
        const aggAvgSL = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.avgSentenceLength, 0) / profiles.length) * 10) / 10 : 0
        const aggVR = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.vocabularyRichness, 0) / profiles.length) * 1000) / 1000 : 0
        const aggFS = profiles.length > 0
          ? Math.round((profiles.reduce((s, p) => s + p.formalityScore, 0) / profiles.length) * 100) / 100 : 0

        const mergedTerms: Record<string, number> = {}
        for (const p of profiles) { for (const t of p.topTerms) { mergedTerms[t.term] = (mergedTerms[t.term] || 0) + t.count } }
        const aggTopTerms = Object.entries(mergedTerms).sort(([, a], [, b]) => b - a).slice(0, 20).map(([term, count]) => ({ term, count }))

        const mergedHedging2: Record<string, number> = {}
        for (const p of profiles) { for (const h of p.hedgingPhrases) { mergedHedging2[h.phrase] = (mergedHedging2[h.phrase] || 0) + h.count } }
        const aggHedging = Object.entries(mergedHedging2).sort(([, a], [, b]) => b - a).slice(0, 15).map(([phrase, count]) => ({ phrase, count }))

        let aFP = 0, aTP = 0, aPast = 0, aPres = 0
        const allH: string[] = []
        for (const p of profiles) {
          aFP += p.personReference.firstPerson; aTP += p.personReference.thirdPerson
          aPast += p.tenseDistribution.past; aPres += p.tenseDistribution.present
          for (const h of p.sectionHeadings) { if (!allH.includes(h)) allH.push(h) }
        }
        const pc = profiles.length || 1

        const aggregate = {
          avgSentenceLength: aggAvgSL, vocabularyRichness: aggVR, formalityScore: aggFS,
          topTerms: aggTopTerms, hedgingPhrases: aggHedging,
          sampleCount: profiles.length, totalWordCount,
          personReference: { firstPerson: Math.round(aFP / pc), thirdPerson: Math.round(aTP / pc) },
          tenseDistribution: { past: Math.round(aPast / pc), present: Math.round(aPres / pc) },
          sectionHeadings: allH.slice(0, 30),
        }

        // Persist
        try {
          const profilePath = pathMod.join(getCategoryDir('writing-samples'), '.style-profile.json')
          fs.writeFileSync(profilePath, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), ...aggregate }, null, 2), 'utf-8')
        } catch (_) { /* non-fatal */ }

        return ok({ profiles, aggregate })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Recalculation failed'
        console.error('[resources:recalculateStyleProfile]', message)
        return fail('RECALCULATE_FAILED', message)
      }
    }
  )

  // ── resources:read ────────────────────────────────────────────────────────
  // Read file content for in-app viewing.
  //   .txt/.md/.csv/.rtf  → { encoding:'text', content: raw UTF-8 }
  //   .docx               → { encoding:'html', content: converted HTML }
  //   .pdf                → { encoding:'pdf-base64', content: base64 PDF }
  //   other binary        → { encoding:'base64', content: base64 }
  // Also returns a PHI-redacted version (`redacted`) for safe viewing.
  ipcMain.handle(
    'resources:read',
    async (_event, params: { storedPath: string }): Promise<IpcResponse<{
      content: string
      redacted: string
      encoding: 'text' | 'html' | 'pdf-base64' | 'base64'
      mimeType: string
      phiCount: number
      localFilePath?: string
    }>> => {
      try {
        const filePath = params.storedPath
        if (!fs.existsSync(filePath)) {
          return fail('RESOURCE_NOT_FOUND', `File not found: ${filePath}`)
        }
        const ext = pathMod.extname(filePath).toLowerCase()
        const mime = mimeForExt(ext)

        // Text-based formats, read as UTF-8, strip PHI for redacted version
        if (['.txt', '.md', '.csv', '.rtf', '.json', '.xml', '.html', '.htm', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.log'].includes(ext)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const { cleaned, strippedCount } = stripPhi(content)
          return ok({ content, redacted: cleaned, encoding: 'text' as const, mimeType: mime, phiCount: strippedCount })
        }

        // .docx, convert to HTML via mammoth for rich preview
        if (ext === '.docx' || ext === '.doc') {
          try {
            const buffer = fs.readFileSync(filePath)
            const htmlResult = await mammoth.convertToHtml({ buffer })
            const html = htmlResult.value ?? ''
            const { cleaned, strippedCount } = stripPhi(html)
            return ok({ content: html, redacted: cleaned, encoding: 'html' as const, mimeType: 'text/html', phiCount: strippedCount })
          } catch {
            // Fall back to raw text extraction
            try {
              const buffer = fs.readFileSync(filePath)
              const textResult = await mammoth.extractRawText({ buffer })
              const text = textResult.value ?? ''
              const { cleaned, strippedCount } = stripPhi(text)
              return ok({ content: text, redacted: cleaned, encoding: 'text' as const, mimeType: 'text/plain', phiCount: strippedCount })
            } catch {
              const content = fs.readFileSync(filePath).toString('base64')
              return ok({ content, redacted: content, encoding: 'base64' as const, mimeType: mime, phiCount: 0 })
            }
          }
        }

        // .pdf, return base64 for iframe embedding + extract text for redacted view
        if (ext === '.pdf') {
          const pdfBuffer = fs.readFileSync(filePath)
          const base64 = pdfBuffer.toString('base64')
          // Extract text for redacted view
          let redactedHtml = ''
          let phiCount = 0
          try {
            const pdfData = await pdfParse(pdfBuffer)
            const text = pdfData.text ?? ''
            const { cleaned, strippedCount } = stripPhi(text)
            phiCount = strippedCount
            // Wrap extracted text in basic HTML for readable redacted view
            redactedHtml = cleaned.split('\n').map((line: string) =>
              line.trim() ? `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''
            ).filter(Boolean).join('\n')
          } catch {
            redactedHtml = '<p><em>Could not extract text for PHI redaction.</em></p>'
          }
          return ok({ content: base64, redacted: redactedHtml, encoding: 'pdf-base64' as const, mimeType: mime, phiCount, localFilePath: filePath })
        }

        // Other binary, base64
        const content = fs.readFileSync(filePath).toString('base64')
        return ok({ content, redacted: content, encoding: 'base64' as const, mimeType: mime, phiCount: 0 })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Resource read failed'
        return fail('RESOURCE_READ_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Template handlers: upload, analyze, save, list, get, delete
// ---------------------------------------------------------------------------

function registerTemplateHandlers(): void {
  const fs = require('fs')
  const pathMod = require('path')
  const mammoth = require('mammoth')
  const AdmZip = require('adm-zip')

  type TemplateFormattingConfig = import('../../shared/types/ipc').TemplateFormattingConfig
  type TemplateSectionProfile = import('../../shared/types/ipc').TemplateSectionProfile
  type TemplateProfile = import('../../shared/types/ipc').TemplateProfile
  type TemplateSummary = import('../../shared/types/ipc').TemplateSummary

  /** Resolve the Templates directory under the workspace */
  function getTemplatesDir(): string {
    const wsPath = loadWorkspacePath() || getDefaultWorkspacePath()
    return pathMod.join(wsPath, 'Workspace', 'Templates')
  }

  /** Custom templates stored in _custom/ subdirectory */
  function getCustomDir(): string {
    const dir = pathMod.join(getTemplatesDir(), '_custom')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  /** Temp directory for in-progress uploads */
  function getTempDir(): string {
    const dir = pathMod.join(getTemplatesDir(), '_temp')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  /** Last-used prefs stored as JSON in templates dir */
  function getPrefsPath(): string {
    return pathMod.join(getTemplatesDir(), '.template-prefs.json')
  }

  function loadPrefs(): Record<string, string> {
    const p = getPrefsPath()
    if (!fs.existsSync(p)) return {}
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return {} }
  }

  function savePrefs(prefs: Record<string, string>): void {
    fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8')
  }

  /** Keywords for auto-detecting eval type from document text */
  const EVAL_TYPE_KEYWORDS: Record<string, string[]> = {
    'CST': ['competency to stand trial', 'competence to stand trial', 'dusky', 'competency evaluation', 'competent to proceed'],
    'Custody': ['child custody', 'custody evaluation', 'best interests of the child', 'parenting time', 'parenting plan', 'custody assessment'],
    'Risk Assessment': ['risk assessment', 'violence risk', 'sexual reoffense', 'hcr-20', 'static-99', 'vrag', 'risk for future violence'],
    'Fitness for Duty': ['fitness for duty', 'fitness-for-duty', 'fit for duty', 'essential job functions', 'return to duty', 'iacp'],
    'PTSD Dx': ['ptsd', 'posttraumatic stress', 'post-traumatic stress', 'caps-5', 'pcl-5', 'criterion a', 'traumatic event'],
    'ADHD Dx': ['adhd', 'attention-deficit', 'attention deficit', 'hyperactivity disorder', 'diva-5', 'caadid', 'inattention'],
    'Malingering': ['malingering', 'symptom validity', 'feigning', 'performance validity', 'slick criteria', 'rogers model', 'effort testing'],
  }

  /** Auto-detect eval type from document text */
  function detectEvalType(text: string): string {
    const lower = text.toLowerCase()
    const scores: Record<string, number> = {}

    for (const [evalType, keywords] of Object.entries(EVAL_TYPE_KEYWORDS)) {
      let score = 0
      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const matches = lower.match(regex)
        if (matches) score += matches.length
      }
      scores[evalType] = score
    }

    let best = 'CST'
    let bestScore = 0
    for (const [evalType, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score
        best = evalType
      }
    }

    return best
  }

  /** Parse document sections from extracted text using heading detection */
  function parseSections(text: string): TemplateSectionProfile[] {
    const lines = text.split('\n').filter((l: string) => l.trim().length > 0)
    const sections: TemplateSectionProfile[] = []
    let currentHeading = ''
    let currentBody: string[] = []
    let order = 0

    for (const line of lines) {
      const trimmed = line.trim()
      // Heading heuristic: short line (<100 chars), mostly uppercase, not just a number
      const isHeading = trimmed.length < 100 && trimmed.length > 2 &&
        (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&:,\-/()]+$/.test(trimmed)) &&
        !/^\d+$/.test(trimmed)

      if (isHeading) {
        if (currentHeading && currentBody.length > 0) {
          const prose = currentBody.join('\n')
          sections.push({
            heading: currentHeading,
            contentType: detectContentType(prose),
            exampleProse: prose,
            estimatedLength: estimateLength(prose),
            order: order++,
          })
        }
        currentHeading = trimmed
        currentBody = []
      } else {
        currentBody.push(trimmed)
      }
    }

    // Last section
    if (currentHeading && currentBody.length > 0) {
      const prose = currentBody.join('\n')
      sections.push({
        heading: currentHeading,
        contentType: detectContentType(prose),
        exampleProse: prose,
        estimatedLength: estimateLength(prose),
        order: order++,
      })
    }

    // If no sections detected, treat whole text as one section
    if (sections.length === 0 && text.trim().length > 0) {
      sections.push({
        heading: 'Full Report',
        contentType: 'narrative',
        exampleProse: text.trim(),
        estimatedLength: estimateLength(text),
        order: 0,
      })
    }

    return sections
  }

  /** Detect whether a section contains tables, lists, or plain narrative */
  function detectContentType(text: string): 'narrative' | 'table' | 'list' | 'mixed' {
    const lines = text.split('\n')
    let listLines = 0
    let tableLines = 0
    let narrativeLines = 0

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^[\-*]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
        listLines++
      } else if (/\t.*\t/.test(trimmed) || /\s{3,}/.test(trimmed)) {
        tableLines++
      } else {
        narrativeLines++
      }
    }

    const total = lines.length
    if (total === 0) return 'narrative'
    if (tableLines / total > 0.3) return 'table'
    if (listLines / total > 0.4) return 'list'
    if (listLines > 0 && narrativeLines > 0) return 'mixed'
    return 'narrative'
  }

  /** Estimate section length from word count */
  function estimateLength(text: string): 'brief' | 'moderate' | 'extensive' {
    const words = text.split(/\s+/).length
    if (words < 80) return 'brief'
    if (words < 300) return 'moderate'
    return 'extensive'
  }

  /** Extract formatting metadata from a .docx using mammoth's HTML output */
  async function analyzeFormatting(filePath: string): Promise<TemplateFormattingConfig> {
    // Default forensic report formatting
    const defaults: TemplateFormattingConfig = {
      margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch = 1440 twips
      fontFamily: 'Times New Roman',
      fontSize: 12,
      lineSpacing: 1.5,
      headingFont: 'Times New Roman',
      headingSize: 14,
      headerContent: '',
      footerContent: '',
    }

    try {
      // mammoth gives us HTML which can hint at styles
      const buffer = fs.readFileSync(filePath)
      const htmlResult = await mammoth.convertToHtml({ buffer })
      const html: string = htmlResult.value ?? ''

      // Try to detect font from inline styles or common patterns
      const fontMatch = html.match(/font-family:\s*['"]?([^'";}]+)/i)
      if (fontMatch) {
        defaults.fontFamily = fontMatch[1].trim()
        defaults.headingFont = fontMatch[1].trim()
      }

      // Try to detect font size
      const sizeMatch = html.match(/font-size:\s*(\d+)pt/i)
      if (sizeMatch) {
        defaults.fontSize = parseInt(sizeMatch[1], 10)
      }

      // Try to extract header content from first centered/bold section
      const headerMatch = html.match(/<p[^>]*style="text-align:\s*center[^"]*"[^>]*>(.*?)<\/p>/i)
      if (headerMatch) {
        defaults.headerContent = headerMatch[1].replace(/<[^>]+>/g, '').trim()
      }
    } catch {
      // Fall back to defaults
    }

    return defaults
  }

  /** Use the existing aggressive stripPhi from resources handlers */
  /**
   * Strip PHI from a .docx file in-place by modifying the XML content
   * inside the zip archive. Preserves all formatting, styles, headers,
   * footers, and tables. Returns the path to the cleaned .docx and the
   * number of PHI entities removed.
   */
  function stripPhiFromDocx(srcPath: string, destPath: string): { strippedCount: number } {
    const zip = new AdmZip(srcPath)
    let totalCount = 0

    // Process all XML files inside the docx that may contain text
    const xmlEntries = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml', 'word/comments.xml', 'word/endnotes.xml', 'word/footnotes.xml']
    for (const entryName of xmlEntries) {
      const entry = zip.getEntry(entryName)
      if (!entry) continue

      let xml = entry.getData().toString('utf-8')

      // Extract text runs from XML, apply PHI stripping to text content only.
      // Pattern: find text between <w:t ...> and </w:t> tags, strip PHI from that text.
      xml = xml.replace(/>([^<]+)</g, (fullMatch: string, textContent: string) => {
        // Skip empty or whitespace-only content
        if (!textContent.trim()) return fullMatch
        const { cleaned, strippedCount } = stripPhiFromText(textContent)
        totalCount += strippedCount
        if (strippedCount > 0) return `>${cleaned}<`
        return fullMatch
      })

      zip.updateFile(entryName, Buffer.from(xml, 'utf-8'))
    }

    zip.writeZip(destPath)
    return { strippedCount: totalCount }
  }

  function stripPhiFromText(text: string): { cleaned: string; strippedCount: number } {
    // Import the stripPhi from the resources handler scope.
    // Since we can't share the function directly (it's scoped inside registerResourcesHandlers),
    // we duplicate the core patterns here. This is the same 25-pattern approach.
    let count = 0
    let cleaned = text

    // SSN
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, () => { count++; return '[SSN REMOVED]' })
    // Dates
    cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, () => { count++; return '[DATE REMOVED]' })
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+(19|20)\d{2}\b/gi, () => { count++; return '[DATE REMOVED]' })
    cleaned = cleaned.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(19|20)\d{2}\b/gi, () => { count++; return '[DATE REMOVED]' })
    // Phone
    cleaned = cleaned.replace(/\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g, () => { count++; return '[PHONE REMOVED]' })
    // Email
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g, () => { count++; return '[EMAIL REMOVED]' })
    // Address
    cleaned = cleaned.replace(/\b\d{1,5}\s+(?:[NSEW]\.?\s+)?[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\s+(?:St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Pkwy|Cir|Terr?|Drive|Lane|Road|Court|Boulevard|Avenue|Street|Parkway|Circle|Terrace|Place)\.?(?:\s*,?\s*(?:Apt|Suite|Ste|Unit|Bldg|#)\s*[#]?\s*[A-Za-z0-9\-]+)?/gi, () => { count++; return '[ADDRESS REMOVED]' })
    // City/State/ZIP
    cleaned = cleaned.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:CO|Colorado|CA|NY|TX|FL|AZ|NM|UT|WY|NE|KS|OK)\s+\d{5}(?:-\d{4})?\b/g, () => { count++; return '[LOCATION REMOVED]' })
    // NPI
    cleaned = cleaned.replace(/\bNPI:?\s*\d{10}\b/gi, () => { count++; return '[NPI REMOVED]' })
    // DEA
    cleaned = cleaned.replace(/\bDEA:?\s*[A-Za-z]{2}\d{7}\b/gi, () => { count++; return '[DEA REMOVED]' })
    // MRN
    cleaned = cleaned.replace(/\bMRN:?\s*[A-Z]{1,5}-?\d{4}-?\d{3,8}\b/gi, () => { count++; return '[MRN REMOVED]' })
    // Rx
    cleaned = cleaned.replace(/\bRx\s*#?\s*[A-Za-z]*-?\d{4,10}\b/gi, () => { count++; return '[RX REMOVED]' })
    // Insurance IDs
    cleaned = cleaned.replace(/\b(?:Member\s*ID|Medicaid\s*ID|Insurance\s*ID|Group\s*#?|Policy\s*#?|Claim\s*#?)\s*:?\s*[A-Za-z0-9\-]{5,20}\b/gi, () => { count++; return '[INSURANCE ID REMOVED]' })
    // License numbers
    cleaned = cleaned.replace(/\b(?:driver'?s?\s*license|DL|CDL)\s*(?:#|number|num|no\.?)?\s*:?\s*[A-Za-z0-9\-]{6,15}\b/gi, () => { count++; return '[LICENSE REMOVED]' })
    cleaned = cleaned.replace(/\b(?:License|Lic)\s*#?\s*:?\s*(?:PSY|CSW|LPC|LCSW|LMFT|PT|OT|MD|DO|RN|NP)-?\d{4,10}\b/gi, () => { count++; return '[LICENSE REMOVED]' })
    // Badge numbers
    cleaned = cleaned.replace(/\b(?:badge|badge\s*#|badge\s*number)\s*:?\s*#?\s*[A-Za-z]*-?\d{2,8}\b/gi, () => { count++; return '[BADGE REMOVED]' })
    // IDs
    cleaned = cleaned.replace(/\b(?:employee\s*ID|staff\s*ID|student\s*ID|offender\s*(?:number|#|ID)|CDOC\s*(?:#|number)?|inmate\s*(?:account|#|ID)|booking\s*#?|case\s*#?|SID|FBI\s*(?:number|#)?)\s*:?\s*[A-Za-z0-9\-]{4,20}\b/gi, () => { count++; return '[ID REMOVED]' })
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-\d{4}-\d{2,8}\b/g, () => { count++; return '[ID REMOVED]' })
    cleaned = cleaned.replace(/\b[A-Z]{2,6}-(?:[A-Z]{2}-)?(?:\d{4}-)*\d{3,8}\b/g, () => { count++; return '[ID REMOVED]' })
    // URLs
    cleaned = cleaned.replace(/\bhttps?:\/\/[^\s]+/gi, () => { count++; return '[URL REMOVED]' })

    // Names with titles
    const NAME_TITLES = ['Dr','Mr','Ms','Mrs','Miss','Prof','Sgt','Sergeant','Lt','Lieutenant','Cpl','Corporal','Capt','Captain','Det','Detective','Inv','Investigator','Chief','Officer','Ofc','Hon','Judge','Justice','Atty','Attorney']
    const titlePattern = NAME_TITLES.join('|')
    cleaned = cleaned.replace(new RegExp(`\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?\\b`, 'g'), () => { count++; return '[NAME REMOVED]' })
    cleaned = cleaned.replace(new RegExp(`\\b(?:${titlePattern})\\.?\\s+[A-Z][a-z]{2,}\\b`, 'g'), () => { count++; return '[NAME REMOVED]' })

    // Labeled name fields
    const LABELS = ['Examinee','Patient','Client','Evaluee','Claimant','Plaintiff','Defendant','Respondent','Petitioner','Victim','Complainant','Subject']
    cleaned = cleaned.replace(new RegExp(`\\b(?:${LABELS.join('|')})\\s*:\\s*[A-Z][a-z]+(?:\\s+[A-Z]\\.?)?\\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?`, 'g'), (match: string) => {
      const label = match.split(':')[0]
      count++
      return `${label}: [NAME REMOVED]`
    })

    // Standalone names
    const COMMON_NON_NAMES = new Set(['mental status','clinical formulation','relevant background','referral question','united states','supreme court','social security','district court','judicial district','colorado springs','fort collins','denver county','adams county','jefferson county','larimer county','el paso','arapahoe county','boulder county','douglas county','weld county','peak forensics','full scale','verbal comprehension','working memory','processing speed','perceptual reasoning'])
    const COMMON_WORDS = new Set(['the','and','for','was','were','are','has','had','his','her','she','not','but','with','from','that','this','they','them','been','have','will','would','could','should','about','into','over','after','before','during','between','through','under','again','further','then','once','here','there','when','where','both','each','more','most','other','some','such','only','same','than','very','also','just','because','while','does','did','doing','being','having','getting','case','court','scale','test','score','trial','level','total','index','factor','type','range','report','order','standard','history','current','prior','first','second','third','diagnosis','treatment','evidence','clinical'])
    cleaned = cleaned.replace(/\b([A-Z][a-z]{1,15})\s+([A-Z]\.?\s+)?([A-Z][a-z]{1,15}(?:-[A-Z][a-z]{1,15})?)\b/g, (match: string, first: string, _mid: string, last: string) => {
      if (COMMON_NON_NAMES.has(match.toLowerCase())) return match
      if (/^[A-Z][a-z]+\s+(The|And|For|With|From|Into|That|This|Each|Both|Such|Over|Upon)\s/i.test(match)) return match
      if (COMMON_WORDS.has(first.toLowerCase()) || COMMON_WORDS.has(last.toLowerCase())) return match
      if (first.length < 2 || last.length < 2) return match
      count++
      return '[NAME REMOVED]'
    })

    // DOB patterns
    cleaned = cleaned.replace(/\bDate\s+of\s+Birth\s*:\s*\[?[^\]\n]{5,30}\]?/gi, () => { count++; return 'Date of Birth: [DOB REMOVED]' })

    return { cleaned, strippedCount: count }
  }

  /** Generate a template ID from name */
  function nameToId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  /** Load all built-in template profiles from registry */
  function getBuiltinProfiles(): TemplateProfile[] {
    return BUILTIN_REPORT_TEMPLATES.map((t) => ({
      version: 1 as const,
      id: t.id,
      name: `${t.title} (Built-in)`,
      evalType: t.evalType,
      source: 'builtin' as const,
      createdAt: '2026-03-19T00:00:00.000Z',
      formatting: {
        margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        fontFamily: 'Times New Roman',
        fontSize: 12,
        lineSpacing: 1.5,
        headingFont: 'Times New Roman',
        headingSize: 14,
        headerContent: '',
        footerContent: '',
      },
      sections: t.sections.map((s, i) => ({
        heading: s.heading,
        contentType: 'narrative' as const,
        exampleProse: s.body.join('\n'),
        estimatedLength: (s.body.join(' ').split(/\s+/).length < 80 ? 'brief' : 'moderate') as 'brief' | 'moderate',
        order: i,
      })),
      sectionCount: t.sections.length,
      docxPath: null,
    }))
  }

  /** Load all custom template profiles from _custom/ directory */
  function getCustomProfiles(): TemplateProfile[] {
    const dir = getCustomDir()
    if (!fs.existsSync(dir)) return []
    const files: string[] = fs.readdirSync(dir)
    const profiles: TemplateProfile[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const raw = fs.readFileSync(pathMod.join(dir, file), 'utf-8')
        profiles.push(JSON.parse(raw) as TemplateProfile)
      } catch {
        // Skip corrupt profile files
      }
    }

    return profiles
  }

  // ── templates:analyze ──────────────────────────────────────────────────
  ipcMain.handle(
    'templates:analyze',
    async (event, params: { filePath?: string }): Promise<IpcResponse<{
      detectedEvalType: string
      suggestedName: string
      formatting: TemplateFormattingConfig
      sections: TemplateSectionProfile[]
      cleanedText: string
      phiStripped: number
      tempDocxPath: string
    }>> => {
      try {
        let filePath = params?.filePath

        // If no path provided, open file picker
        if (!filePath) {
          const parentWindow = BrowserWindow.fromWebContents(event.sender)
          const result = await dialog.showOpenDialog(parentWindow!, {
            title: 'Upload Report Template (.docx)',
            filters: [
              { name: 'Word Documents', extensions: ['docx', 'doc'] },
              { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
          })
          if (result.canceled || result.filePaths.length === 0) {
            return fail('USER_CANCELLED', 'No file selected')
          }
          filePath = result.filePaths[0]
        }

        // Extract raw text
        const buffer = fs.readFileSync(filePath)
        const extracted = await mammoth.extractRawText({ buffer })
        const rawText: string = extracted.value ?? ''

        if (!rawText || rawText.trim().length === 0) {
          return fail('EMPTY_DOCUMENT', 'No text could be extracted from this document')
        }

        // Strip PHI
        const { cleaned, strippedCount } = stripPhiFromText(rawText)

        // Analyze formatting
        const formatting = await analyzeFormatting(filePath)

        // Parse sections
        const sections = parseSections(cleaned)

        // Auto-detect eval type
        const detectedEvalType = detectEvalType(rawText)

        // Generate suggested name from filename
        const originalName = pathMod.basename(filePath, pathMod.extname(filePath))
        const suggestedName = originalName.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

        // Strip PHI from the docx itself (preserving formatting) and write cleaned copy to temp
        const tempDir = getTempDir()
        const tempDocxPath = pathMod.join(tempDir, `temp_${Date.now()}.docx`)
        stripPhiFromDocx(filePath, tempDocxPath)

        return ok({
          detectedEvalType,
          suggestedName,
          formatting,
          sections,
          cleanedText: cleaned,
          phiStripped: strippedCount,
          tempDocxPath,
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template analysis failed'
        return fail('TEMPLATE_ANALYZE_FAILED', message)
      }
    }
  )

  // ── templates:save ─────────────────────────────────────────────────────
  ipcMain.handle(
    'templates:save',
    async (_event, params: {
      tempDocxPath: string
      name: string
      evalType: string
      formatting: TemplateFormattingConfig
      sections: TemplateSectionProfile[]
    }): Promise<IpcResponse<TemplateProfile>> => {
      try {
        const id = nameToId(params.name)
        const customDir = getCustomDir()
        const docxDest = pathMod.join(customDir, `${id}.docx`)
        const profilePath = pathMod.join(customDir, `${id}.json`)

        // The temp docx was already PHI-stripped during the analyze step.
        // Copy the cleaned docx to the custom templates directory.
        // The original file with PHI was never stored; only this clean version persists.
        if (fs.existsSync(params.tempDocxPath)) {
          fs.copyFileSync(params.tempDocxPath, docxDest)
          // Clean up temp file
          try { fs.unlinkSync(params.tempDocxPath) } catch { /* ignore */ }
        }

        const profile: TemplateProfile = {
          version: 1,
          id,
          name: params.name,
          evalType: params.evalType,
          source: 'custom',
          createdAt: new Date().toISOString(),
          formatting: params.formatting,
          sections: params.sections,
          sectionCount: params.sections.length,
          docxPath: docxDest,
        }

        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf-8')

        return ok(profile)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template save failed'
        return fail('TEMPLATE_SAVE_FAILED', message)
      }
    }
  )

  // ── templates:list ─────────────────────────────────────────────────────
  ipcMain.handle(
    'templates:list',
    async (_event, params?: { evalType?: string }): Promise<IpcResponse<readonly TemplateSummary[]>> => {
      try {
        const builtins = getBuiltinProfiles()
        const custom = getCustomProfiles()
        const all = [...builtins, ...custom]

        // Check which built-ins have been deleted
        const deletedPath = pathMod.join(getTemplatesDir(), '.deleted-builtins.json')
        let deletedIds: string[] = []
        if (fs.existsSync(deletedPath)) {
          try { deletedIds = JSON.parse(fs.readFileSync(deletedPath, 'utf-8')) } catch { /* ignore */ }
        }

        const filtered = all
          .filter(t => !deletedIds.includes(t.id))
          .filter(t => !params?.evalType || t.evalType === params.evalType)

        const summaries: TemplateSummary[] = filtered.map(t => ({
          id: t.id,
          name: t.name,
          evalType: t.evalType,
          source: t.source,
          sectionCount: t.sectionCount,
          createdAt: t.createdAt,
          docxPath: t.docxPath,
        }))

        return ok(summaries)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template list failed'
        return fail('TEMPLATE_LIST_FAILED', message)
      }
    }
  )

  // ── templates:get ──────────────────────────────────────────────────────
  ipcMain.handle(
    'templates:get',
    async (_event, params: { id: string }): Promise<IpcResponse<TemplateProfile>> => {
      try {
        // Check custom first
        const customDir = getCustomDir()
        const customPath = pathMod.join(customDir, `${params.id}.json`)
        if (fs.existsSync(customPath)) {
          const raw = fs.readFileSync(customPath, 'utf-8')
          return ok(JSON.parse(raw) as TemplateProfile)
        }

        // Check built-ins
        const builtins = getBuiltinProfiles()
        const builtin = builtins.find(t => t.id === params.id)
        if (builtin) return ok(builtin)

        return fail('TEMPLATE_NOT_FOUND', `Template not found: ${params.id}`)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template get failed'
        return fail('TEMPLATE_GET_FAILED', message)
      }
    }
  )

  // ── templates:delete ───────────────────────────────────────────────────
  ipcMain.handle(
    'templates:delete',
    async (_event, params: { id: string }): Promise<IpcResponse<void>> => {
      try {
        // Check if it's a custom template
        const customDir = getCustomDir()
        const customJson = pathMod.join(customDir, `${params.id}.json`)
        const customDocx = pathMod.join(customDir, `${params.id}.docx`)

        if (fs.existsSync(customJson)) {
          fs.unlinkSync(customJson)
          if (fs.existsSync(customDocx)) fs.unlinkSync(customDocx)
          return ok(undefined)
        }

        // Built-in: track as deleted rather than actually removing code
        const deletedPath = pathMod.join(getTemplatesDir(), '.deleted-builtins.json')
        let deletedIds: string[] = []
        if (fs.existsSync(deletedPath)) {
          try { deletedIds = JSON.parse(fs.readFileSync(deletedPath, 'utf-8')) } catch { /* ignore */ }
        }
        if (!deletedIds.includes(params.id)) {
          deletedIds.push(params.id)
          fs.writeFileSync(deletedPath, JSON.stringify(deletedIds, null, 2), 'utf-8')
        }

        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template delete failed'
        return fail('TEMPLATE_DELETE_FAILED', message)
      }
    }
  )

  // ── templates:open ──────────────────────────────────────────────────────
  ipcMain.handle(
    'templates:open',
    async (_event, params: { id: string }): Promise<IpcResponse<void>> => {
      try {
        // Custom template: open the cleaned docx from _custom/
        const customDocx = pathMod.join(getCustomDir(), `${params.id}.docx`)
        if (fs.existsSync(customDocx)) {
          await shell.openPath(customDocx)
          return ok(undefined)
        }

        // Built-in template: open the provisioned docx from Templates/
        const templatesDir = getTemplatesDir()
        const files: string[] = fs.readdirSync(templatesDir)
        const match = files.find((f: string) => f.startsWith(params.id) && f.endsWith('.docx'))
        if (match) {
          await shell.openPath(pathMod.join(templatesDir, match))
          return ok(undefined)
        }

        return fail('TEMPLATE_NOT_FOUND', `No docx found for template: ${params.id}`)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Template open failed'
        return fail('TEMPLATE_OPEN_FAILED', message)
      }
    }
  )

  // ── templates:setLastUsed ──────────────────────────────────────────────
  ipcMain.handle(
    'templates:setLastUsed',
    async (_event, params: { evalType: string; templateId: string }): Promise<IpcResponse<void>> => {
      try {
        const prefs = loadPrefs()
        prefs[params.evalType] = params.templateId
        savePrefs(prefs)
        return ok(undefined)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save template preference'
        return fail('TEMPLATE_PREF_FAILED', message)
      }
    }
  )

  // ── templates:getLastUsed ──────────────────────────────────────────────
  ipcMain.handle(
    'templates:getLastUsed',
    async (_event, params: { evalType: string }): Promise<IpcResponse<string | null>> => {
      try {
        const prefs = loadPrefs()
        return ok(prefs[params.evalType] || null)
      } catch {
        return ok(null)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Diagnosis Catalog handlers, DSM-5-TR reference search/browse
// ---------------------------------------------------------------------------

function registerDiagnosisCatalogHandlers(): void {
  // Static imports above ensure electron-vite traces seed-catalog into the
  // main bundle. Prior code used `require(...)` at module load which rollup
  // did not reliably resolve in the packaged build.

  ipcMain.handle(
    'diagnosisCatalog:search',
    (_event, params: { query: string; limit?: number }): IpcResponse<unknown[]> => {
      try {
        const sqlite = getSqlite()
        seedDiagnosisCatalog(sqlite)

        const limit = Math.min(params.limit ?? 20, 100)
        const q = `%${params.query}%`
        const rows = sqlite
          .prepare(
            `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
             FROM diagnosis_catalog
             WHERE code LIKE ? OR dsm5tr_code LIKE ? OR name LIKE ?
             ORDER BY category, name
             LIMIT ?`
          )
          .all(q, q, q, limit)
        return ok(rows)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Catalog search failed'
        console.error('[diagnosisCatalog:search] error:', message)
        return fail('CATALOG_SEARCH_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'diagnosisCatalog:list',
    (_event, params?: { category?: string }): IpcResponse<unknown[]> => {
      try {
        const sqlite = getSqlite()
        seedDiagnosisCatalog(sqlite)

        let rows: unknown[]
        if (params?.category) {
          rows = sqlite
            .prepare(
              `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
               FROM diagnosis_catalog
               WHERE category = ?
               ORDER BY name`
            )
            .all(params.category)
        } else {
          rows = sqlite
            .prepare(
              `SELECT diagnosis_id, code, dsm5tr_code, name, description, category, is_builtin
               FROM diagnosis_catalog
               ORDER BY category, name`
            )
            .all()
        }
        return ok(rows)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Catalog list failed'
        console.error('[diagnosisCatalog:list] error:', message)
        return fail('CATALOG_LIST_FAILED', message)
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Public: register all IPC handlers
// ---------------------------------------------------------------------------

export function registerAllHandlers(): void {
  registerSetupHandlers()
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
  registerDataConfirmationHandlers()
  registerAiHandlers()
  registerAgentHandlers()
  registerPipelineHandlers()
  registerDecisionHandlers()
  registerScoreHandlers()
  registerUpdaterHandlers()
  registerOnlyOfficeHandlers()
  registerReportHandlers()
  registerTemplateHandlers()
  registerAuditHandlers()
  registerTestimonyHandlers()
  registerReferralParseHandlers()
  registerResourcesHandlers()
  registerWhisperHandlers()
  registerTestHarnessHandlers()
  try { registerDiagnosisCatalogHandlers() } catch (e) { console.warn('[main] diagnosisCatalog handlers skipped:', (e as Error).message) }
  registerBrandingHandlers()
}

// ---------------------------------------------------------------------------
// Branding handlers
// ---------------------------------------------------------------------------

function broadcastBrandingChanged(branding: PracticeBranding): void {
  const title = branding.practiceName.trim() || 'Psygil'
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.setTitle(title)
      win.webContents.send('branding:changed', branding)
    } catch (e) {
      console.warn('[branding] broadcast to window failed:', (e as Error).message)
    }
  }
}

function registerBrandingHandlers(): void {
  ipcMain.handle('branding:get', async (): Promise<IpcResponse<PracticeBranding>> => {
    try {
      const branding = await getBranding()
      return ok(branding)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load branding'
      return fail('BRANDING_GET_FAILED', message)
    }
  })

  ipcMain.handle(
    'branding:save',
    async (_event, branding: PracticeBranding): Promise<IpcResponse<{ ok: true }>> => {
      try {
        await saveBranding(branding)
        broadcastBrandingChanged(branding)
        return ok({ ok: true })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save branding'
        return fail('BRANDING_SAVE_FAILED', message)
      }
    }
  )

  ipcMain.handle(
    'branding:saveLogo',
    async (
      _event
    ): Promise<IpcResponse<{ logoPath: string; logoData: string }>> => {
      try {
        const focused = BrowserWindow.getFocusedWindow()
        const dialogOpts = {
          title: 'Select practice logo',
          properties: ['openFile'] as const,
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
        }
        const result = focused
          ? await dialog.showOpenDialog(focused, dialogOpts)
          : await dialog.showOpenDialog(dialogOpts)
        if (result.canceled || result.filePaths.length === 0) {
          return fail('BRANDING_LOGO_CANCELED', 'Logo selection canceled')
        }
        const sourcePath = result.filePaths[0]
        const destPath = await saveBrandingLogo(sourcePath)
        const fs = await import('fs')
        const logoData = fs.readFileSync(destPath).toString('base64')
        // Refresh listeners so the UI picks up the new logo immediately,
        // even if the user closes the panel without clicking Save Branding.
        const refreshed = await getBranding()
        broadcastBrandingChanged(refreshed)
        return ok({ logoPath: destPath, logoData })
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to save logo'
        return fail('BRANDING_SAVE_LOGO_FAILED', message)
      }
    }
  )
}
