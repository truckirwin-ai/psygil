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
  getDefaultWorkspacePath,
  getMalformedFolders,
  scaffoldCaseSubfolders,
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
import { registerDecisionHandlers } from '../decisions/decision-handlers'
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
}
