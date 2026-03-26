// Psygil IPC Type Definitions
// Shared between main process and renderer via contextBridge.
// Source of truth: docs/engineering/02_ipc_api_contracts.md (Boundary 4)

// ---------------------------------------------------------------------------
// Generic envelope
// ---------------------------------------------------------------------------

export interface IpcSuccess<T> {
  readonly status: 'success'
  readonly data: T
}

export interface IpcError {
  readonly status: 'error'
  readonly error_code: string
  readonly message: string
}

export type IpcResponse<T> = IpcSuccess<T> | IpcError

// ---------------------------------------------------------------------------
// Pipeline stages (6-stage clinical pipeline)
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'onboarding'
  | 'testing'
  | 'interview'
  | 'diagnostics'
  | 'review'
  | 'complete'

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export interface CaseRecord {
  readonly case_id: string
  readonly case_name: string
  readonly case_type: string
  readonly status: string
  readonly pipeline_stage: PipelineStage
  readonly created_at: string
  readonly last_modified: string
  readonly document_count: number
  readonly metadata: Record<string, unknown>
}

// cases.list
export interface CasesListParams {
  readonly filter?: {
    readonly case_type?: string
    readonly status?: string
    readonly pipeline_stage?: PipelineStage
  }
  readonly sort?: {
    readonly field: string
    readonly order: 'asc' | 'desc'
  }
  readonly pagination?: {
    readonly page: number
    readonly limit: number
  }
}

export interface CasesListResult {
  readonly cases: readonly CaseRecord[]
  readonly total: number
  readonly page: number
  readonly limit: number
}

// cases.get
export interface CasesGetParams {
  readonly case_id: string
}

export type CasesGetResult = CaseRecord

// cases.create
export interface CasesCreateParams {
  readonly case_name: string
  readonly case_type: string
  readonly client_id?: string
  readonly description?: string
  readonly metadata?: Record<string, unknown>
}

export interface CasesCreateResult {
  readonly case_id: string
  readonly created_at: string
}

// cases.update
export interface CasesUpdateParams {
  readonly case_id: string
  readonly updates: Record<string, unknown>
}

export interface CasesUpdateResult {
  readonly case_id: string
  readonly updated_fields: readonly string[]
}

// cases.archive
export interface CasesArchiveParams {
  readonly case_id: string
}

export interface CasesArchiveResult {
  readonly case_id: string
  readonly archived_at: string
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

// db.health
export type DbHealthParams = void

export interface DbHealthResult {
  readonly connected: boolean
  readonly encrypted: boolean
  readonly version: string
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// auth.login
export type AuthLoginParams = void

export interface AuthLoginResult {
  readonly is_authenticated: boolean
  readonly user_id: string
  readonly user_name: string
  readonly user_email: string
  readonly is_active: boolean
}

// auth.getStatus
export type AuthGetStatusParams = void

export interface AuthGetStatusResult {
  readonly is_authenticated: boolean
  readonly user_id?: string
  readonly user_name?: string
  readonly user_email?: string
  readonly is_active?: boolean
  readonly roles?: readonly string[]
  readonly session_expires_at?: string
  readonly session_expired?: boolean
}

// auth.logout
export type AuthLogoutParams = void

export interface AuthLogoutResult {
  readonly logged_out_at: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// config.get
export interface ConfigGetParams {
  readonly config_key: string
}

export interface ConfigGetResult {
  readonly config: Record<string, unknown>
}

// config.set
export interface ConfigSetParams {
  readonly updates: Record<string, unknown>
}

export interface ConfigSetResult {
  readonly updated_config: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Preload API shape — exposed as window.psygil
// ---------------------------------------------------------------------------

export interface PsygilApi {
  readonly platform: string
  readonly cases: {
    readonly list: (params: CasesListParams) => Promise<IpcResponse<CasesListResult>>
    readonly get: (params: CasesGetParams) => Promise<IpcResponse<CasesGetResult>>
    readonly create: (params: CasesCreateParams) => Promise<IpcResponse<CasesCreateResult>>
    readonly update: (params: CasesUpdateParams) => Promise<IpcResponse<CasesUpdateResult>>
    readonly archive: (params: CasesArchiveParams) => Promise<IpcResponse<CasesArchiveResult>>
  }
  readonly db: {
    readonly health: () => Promise<IpcResponse<DbHealthResult>>
  }
  readonly auth: {
    readonly login: () => Promise<IpcResponse<AuthLoginResult>>
    readonly getStatus: () => Promise<IpcResponse<AuthGetStatusResult>>
    readonly logout: () => Promise<IpcResponse<AuthLogoutResult>>
  }
  readonly config: {
    readonly get: (params: ConfigGetParams) => Promise<IpcResponse<ConfigGetResult>>
    readonly set: (params: ConfigSetParams) => Promise<IpcResponse<ConfigSetResult>>
  }
}

// Augment the global Window interface for renderer usage
declare global {
  interface Window {
    readonly psygil: PsygilApi
  }
}
