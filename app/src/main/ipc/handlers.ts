import { ipcMain, BrowserWindow } from 'electron'
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
  ConfigSetResult
} from '../../shared/types'
import { getAuthStatus } from '../auth'
import { performLogin } from '../auth/login'
import { performLogout } from '../auth/logout'
import { checkLicense } from '../auth/user'

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
// Public: register all IPC handlers
// ---------------------------------------------------------------------------

export function registerAllHandlers(): void {
  registerCasesHandlers()
  registerDbHandlers()
  registerAuthHandlers()
  registerConfigHandlers()
}
