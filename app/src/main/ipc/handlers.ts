import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import type {
  IpcResponse,
  CasesListParams,
  CasesListResult,
  CasesGetParams,
  CasesGetResult,
  CasesCreateParams,
  CasesCreateResult,
  CasesUpdateParams,
  CasesUpdateResult,
  CasesArchiveParams,
  CasesArchiveResult,
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
  FolderNode
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
  getWorkspaceTree,
  getDefaultWorkspacePath
} from '../workspace'
import { detect, batchDetect } from '../pii'

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
    (_event, _params: CasesListParams): IpcResponse<CasesListResult> =>
      ok({ cases: [], total: 0, page: 1, limit: 20 })
  )

  ipcMain.handle(
    'cases:get',
    (_event, _params: CasesGetParams): IpcResponse<CasesGetResult> =>
      ok({
        case_id: '',
        case_name: '',
        case_type: '',
        status: '',
        pipeline_stage: 'onboarding',
        created_at: '',
        last_modified: '',
        document_count: 0,
        metadata: {}
      })
  )

  ipcMain.handle(
    'cases:create',
    (_event, _params: CasesCreateParams): IpcResponse<CasesCreateResult> =>
      ok({ case_id: 'stub-id', created_at: new Date().toISOString() })
  )

  ipcMain.handle(
    'cases:update',
    (_event, _params: CasesUpdateParams): IpcResponse<CasesUpdateResult> =>
      ok({ case_id: '', updated_fields: [] })
  )

  ipcMain.handle(
    'cases:archive',
    (_event, _params: CasesArchiveParams): IpcResponse<CasesArchiveResult> =>
      ok({ case_id: '', archived_at: new Date().toISOString() })
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

        if (!result.success) {
          return fail('LOGIN_FAILED', result.error ?? 'Login failed')
        }

        const license = checkLicense()

        return ok({
          is_authenticated: true,
          user_id: result.userId ?? '',
          user_name: result.userName ?? '',
          user_email: result.email ?? '',
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
      shell.openPath(path)
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
}

// ---------------------------------------------------------------------------
// Public: register all IPC handlers
// ---------------------------------------------------------------------------

export function registerAllHandlers(): void {
  registerCasesHandlers()
  registerDbHandlers()
  registerAuthHandlers()
  registerConfigHandlers()
  registerPiiHandlers()
  registerWorkspaceHandlers()
}
