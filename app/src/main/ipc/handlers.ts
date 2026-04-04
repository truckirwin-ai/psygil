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
import { registerWhisperHandlers } from '../whisper'
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
        console.log('[onlyoffice:start] Document Server started on port', result.port)
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
        console.log('[onlyoffice:stop] Document Server stopped')
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
        console.log('[onlyoffice:generateDocx] Generated:', result.filePath)
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
  // report:exportAndOpen — Generate .docx from section content, open in Word
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
        console.log('[report:exportAndOpen] Saved:', filePath)

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
  // report:loadTemplate — Pick a .docx template, extract text, strip PHI
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
            (trimmed === trimmed.toUpperCase() || /^[A-Z][A-Z\s&:—\-–,]+$/.test(trimmed))

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
// Resources handlers — writing samples, templates, documentation
// ---------------------------------------------------------------------------
// Referral document parsing — open a file picker, extract text from
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

      // Strip _rawText for brevity — keep only the first 3000 chars for reference
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
//   _Resources/Writing Samples/
//   _Resources/Templates/
//   _Resources/Documentation/
// No metadata sidecars — the panel reads actual filenames from actual folders.
// ---------------------------------------------------------------------------

function registerResourcesHandlers(): void {
  const fs = require('fs')
  const pathMod = require('path')
  const mammoth = require('mammoth')
  const pdfParse = require('pdf-parse')

  // ── Eager seed at registration time ──────────────────────────────────────
  // Ensures demo resource files exist on disk before any IPC call
  try {
    const wsPath = loadWorkspacePath() || getDefaultWorkspacePath()
    const seeded = seedResources(wsPath)
    if (seeded > 0) {
      console.log(`[resources] Eagerly seeded ${seeded} resource files at startup`)
    }
  } catch (e) {
    console.error('[resources] Eager seed failed:', e)
  }

  const CATEGORY_LABELS: Record<string, string> = {
    'writing-samples': 'Writing Samples',
    'templates': 'Templates',
    'documentation': 'Documentation',
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

  function getResourcesRoot(): string {
    return pathMod.join(resolveWorkspace(), '_Resources')
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
  const DOC_EXTS = new Set(['.txt', '.pdf', '.doc', '.docx', '.csv', '.rtf', '.md', '.xlsx', '.xls'])

  function mimeForExt(ext: string): string {
    switch (ext) {
      case '.pdf': return 'application/pdf'
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      case '.doc': return 'application/msword'
      case '.txt': case '.md': return 'text/plain'
      case '.csv': return 'text/csv'
      case '.rtf': return 'application/rtf'
      case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      default: return 'application/octet-stream'
    }
  }

  /** Strip PHI from raw text — same patterns as report:loadTemplate */
  function stripPhi(text: string): { cleaned: string; strippedCount: number } {
    let count = 0
    let cleaned = text
    cleaned = cleaned.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, () => { count++; return '[SSN REMOVED]' })
    cleaned = cleaned.replace(/\b(0?[1-9]|1[0-2])[/\-](0?[1-9]|[12]\d|3[01])[/\-](19|20)\d{2}\b/g, () => { count++; return '[DOB REMOVED]' })
    cleaned = cleaned.replace(/\b(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g, () => { count++; return '[PHONE REMOVED]' })
    cleaned = cleaned.replace(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b/g, () => { count++; return '[EMAIL REMOVED]' })
    cleaned = cleaned.replace(/\b\d{1,5}\s+[A-Z][a-z]+\s+(St|Ave|Blvd|Dr|Ln|Rd|Ct|Way|Pl|Circle|Terrace|Drive|Lane|Road|Court|Boulevard|Avenue|Street)\b\.?/gi, () => { count++; return '[ADDRESS REMOVED]' })
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
            const cleanedBase = pathMod.basename(destFilename, ext) + '.txt'
            fs.writeFileSync(pathMod.join(cleanedDir, cleanedBase), cleaned, 'utf-8')
          }

          const stat = fs.statSync(destPath)
          imported.push({
            id: destFilename, // use filename as ID — it's unique within the folder
            category: params.category,
            originalFilename: destFilename,
            storedPath: destPath,
            fileSize: stat.size,
            mimeType: mimeForExt(ext),
            uploadedAt: stat.mtime.toISOString(),
            phiStripped: phiWasStripped,
          })
        }

        console.log(`[resources:upload] Imported ${imported.length} files to ${params.category}, stripped ${totalPhiStripped} PHI instances`)
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
  let resourcesAutoSeeded = false
  ipcMain.handle(
    'resources:list',
    async (_event, params: { category?: string }): Promise<
      IpcResponse<readonly { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[]>
    > => {
      try {
        ensureCategoryDirs()

        // Auto-seed resources on every list call until files exist
        if (!resourcesAutoSeeded) {
          const wsPath = resolveWorkspace()
          console.log('[resources:list] Workspace path:', wsPath)
          try {
            const seeded = seedResources(wsPath)
            if (seeded > 0) {
              console.log(`[resources:list] Auto-seeded ${seeded} resource files`)
            }
            resourcesAutoSeeded = true
          } catch (seedErr) {
            console.error('[resources:list] Auto-seed failed:', seedErr)
          }
        }
        const results: { id: string; category: string; originalFilename: string; storedPath: string; fileSize: number; mimeType: string; uploadedAt: string; phiStripped: boolean }[] = []

        const categories = params.category ? [params.category] : Object.keys(CATEGORY_LABELS)
        for (const cat of categories) {
          const dir = getCategoryDir(cat)
          if (!fs.existsSync(dir)) continue
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
            const cleanedPath = pathMod.join(dir, '_cleaned', pathMod.basename(filename, ext) + '.txt')
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
        // Remove cleaned version if it exists
        const dir = pathMod.dirname(params.storedPath)
        const ext = pathMod.extname(params.storedPath)
        const cleanedPath = pathMod.join(dir, '_cleaned', pathMod.basename(params.storedPath, ext) + '.txt')
        if (fs.existsSync(cleanedPath)) fs.unlinkSync(cleanedPath)
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
    }>> => {
      try {
        const filePath = params.storedPath
        if (!fs.existsSync(filePath)) {
          return fail('RESOURCE_NOT_FOUND', `File not found: ${filePath}`)
        }
        const ext = pathMod.extname(filePath).toLowerCase()
        const mime = mimeForExt(ext)

        // Text-based formats — read as UTF-8, strip PHI for redacted version
        if (['.txt', '.md', '.csv', '.rtf'].includes(ext)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const { cleaned, strippedCount } = stripPhi(content)
          return ok({ content, redacted: cleaned, encoding: 'text' as const, mimeType: mime, phiCount: strippedCount })
        }

        // .docx — convert to HTML via mammoth for rich preview
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

        // .pdf — return base64 for iframe embedding + extract text for redacted view
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
          return ok({ content: base64, redacted: redactedHtml, encoding: 'pdf-base64' as const, mimeType: mime, phiCount })
        }

        // Other binary — base64
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
  registerDataConfirmationHandlers()
  registerAiHandlers()
  registerAgentHandlers()
  registerPipelineHandlers()
  registerDecisionHandlers()
  registerUpdaterHandlers()
  registerOnlyOfficeHandlers()
  registerReportHandlers()
  registerAuditHandlers()
  registerTestimonyHandlers()
  registerReferralParseHandlers()
  registerResourcesHandlers()
  registerWhisperHandlers()
}
