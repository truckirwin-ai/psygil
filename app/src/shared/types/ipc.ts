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
// Cases — DB row shape (matches cases table + folder_path column)
// ---------------------------------------------------------------------------

export interface CaseRow {
  readonly case_id: number
  readonly case_number: string
  readonly primary_clinician_user_id: number
  readonly examinee_first_name: string
  readonly examinee_last_name: string
  readonly examinee_dob: string | null
  readonly examinee_gender: string | null
  readonly cultural_context: string | null
  readonly linguistic_context: string | null
  readonly evaluation_type: string | null
  readonly practice_profile_id: number | null
  readonly referral_source: string | null
  readonly evaluation_questions: string | null
  readonly case_status: string
  readonly workflow_current_stage: string | null
  readonly created_at: string
  readonly last_modified: string | null
  readonly completed_at: string | null
  readonly notes: string | null
  readonly practice_id: number | null
  readonly folder_path: string | null
  readonly deleted_at?: string | null
}

export interface CreateCaseParams {
  readonly case_number: string
  readonly primary_clinician_user_id: number
  readonly examinee_first_name: string
  readonly examinee_last_name: string
  readonly examinee_dob?: string
  readonly examinee_gender?: string
  readonly evaluation_type?: string
  readonly referral_source?: string
  readonly evaluation_questions?: string
  readonly notes?: string
}

// cases.list
export interface CasesListParams {
  readonly filter?: {
    readonly case_status?: string
    readonly pipeline_stage?: PipelineStage
  }
}

export interface CasesListResult {
  readonly cases: readonly CaseRow[]
  readonly total: number
}

// cases.get
export interface CasesGetParams {
  readonly case_id: number
}

export type CasesGetResult = CaseRow

// cases.create — reuse CreateCaseParams
export type CasesCreateParams = CreateCaseParams

export type CasesCreateResult = CaseRow

// cases.archive
export interface CasesArchiveParams {
  readonly case_id: number
}

export type CasesArchiveResult = CaseRow

// ---------------------------------------------------------------------------
// Patient Intake
// ---------------------------------------------------------------------------

export type ReferralType = 'court' | 'attorney' | 'self' | 'walk-in'

export interface PatientIntakeRow {
  readonly intake_id: number
  readonly case_id: number
  readonly referral_type: ReferralType
  readonly referral_source: string | null
  readonly eval_type: string | null
  readonly presenting_complaint: string | null
  readonly jurisdiction: string | null
  readonly charges: string | null
  readonly attorney_name: string | null
  readonly report_deadline: string | null
  readonly status: 'draft' | 'complete'
  readonly created_at: string
  readonly updated_at: string
}

export interface IntakeSaveParams {
  readonly case_id: number
  readonly data: {
    readonly referral_type?: ReferralType
    readonly referral_source?: string
    readonly eval_type?: string
    readonly presenting_complaint?: string
    readonly jurisdiction?: string
    readonly charges?: string
    readonly attorney_name?: string
    readonly report_deadline?: string
    readonly status?: 'draft' | 'complete'
  }
}

export interface IntakeGetParams {
  readonly case_id: number
}

// ---------------------------------------------------------------------------
// Patient Onboarding
// ---------------------------------------------------------------------------

export type OnboardingSection =
  | 'contact'
  | 'complaints'
  | 'family'
  | 'education'
  | 'health'
  | 'mental'
  | 'substance'
  | 'legal'
  | 'recent'

export interface PatientOnboardingRow {
  readonly onboarding_id: number
  readonly case_id: number
  readonly section: OnboardingSection
  readonly content: string
  readonly clinician_notes: string | null
  readonly verified: number
  readonly status: 'draft' | 'complete'
  readonly created_at: string
  readonly updated_at: string
}

export interface OnboardingSaveParams {
  readonly case_id: number
  readonly section: OnboardingSection
  readonly data: {
    readonly content: string
    readonly clinician_notes?: string
    readonly verified?: boolean
    readonly status?: 'draft' | 'complete'
  }
}

export interface OnboardingGetParams {
  readonly case_id: number
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
// PII Detection
// ---------------------------------------------------------------------------

export interface PiiEntity {
  readonly text: string
  readonly start: number
  readonly end: number
  readonly type: string
  readonly score: number
}

// pii.detect
export interface PiiDetectParams {
  readonly text: string
}

export interface PiiDetectResult {
  readonly entities: readonly PiiEntity[]
}

// pii.batchDetect
export interface PiiBatchDetectParams {
  readonly texts: readonly string[]
}

export interface PiiBatchDetectResult {
  readonly results: readonly (readonly PiiEntity[])[]
}

// pii.redact
export interface PiiRedactParams {
  readonly text: string
  readonly operationId: string
  readonly context: 'intake' | 'report' | 'review' | 'diagnostics'
}

export interface PiiRedactResult {
  readonly redactedText: string
  readonly entityCount: number
  readonly typeBreakdown: Record<string, number>
}

// pii.rehydrate
export interface PiiRehydrateParams {
  readonly text: string
  readonly operationId: string
}

export interface PiiRehydrateResult {
  readonly fullText: string
  readonly unidsReplaced: number
}

// pii.destroy
export interface PiiDestroyParams {
  readonly operationId: string
}

export interface PiiDestroyResult {
  readonly destroyed: boolean
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type CaseSubfolder =
  | '_Inbox'
  | 'Collateral'
  | 'Testing'
  | 'Interviews'
  | 'Diagnostics'
  | 'Reports'
  | 'Archive'

export interface DocumentRow {
  readonly document_id: number
  readonly case_id: number
  readonly session_id: number | null
  readonly document_type: string
  readonly original_filename: string
  readonly file_path: string
  readonly file_size_bytes: number | null
  readonly mime_type: string | null
  readonly uploaded_by_user_id: number
  readonly upload_date: string
  readonly description: string | null
  readonly indexed_content: string | null
  readonly remote_path: string | null
  readonly remote_version: string | null
  readonly sync_status: string
  readonly last_synced_at: string | null
}

export interface IngestFileParams {
  readonly case_id: number
  readonly file_path: string
  readonly subfolder: CaseSubfolder
}

export interface DocumentsGetParams {
  readonly document_id: number
}

export interface DocumentsListParams {
  readonly case_id: number
}

export interface DocumentsDeleteParams {
  readonly document_id: number
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export interface FolderNode {
  readonly name: string
  readonly path: string
  readonly isDirectory: boolean
  readonly children?: readonly FolderNode[]
}

export interface WorkspaceFileChangedEvent {
  readonly event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  readonly path: string
}

// ---------------------------------------------------------------------------
// API Key Storage
// ---------------------------------------------------------------------------

export interface ApiKeyStoreParams {
  readonly key: string
}

export interface ApiKeyStoreResult {
  readonly stored: boolean
}

export interface ApiKeyRetrieveResult {
  readonly key: string | null
}

export interface ApiKeyDeleteResult {
  readonly deleted: boolean
}

export interface ApiKeyHasResult {
  readonly hasKey: boolean
}

// ---------------------------------------------------------------------------
// AI / Claude API
// ---------------------------------------------------------------------------

export interface AiCompleteParams {
  readonly systemPrompt: string
  readonly userMessage: string
  readonly context?: string
  readonly model?: string
  readonly maxTokens?: number
}

export interface AiCompleteResult {
  readonly content: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: string
}

export interface AiTestConnectionParams {}

export interface AiTestConnectionResult {
  readonly connected: boolean
  readonly model?: string
  readonly error?: string
}

// ---------------------------------------------------------------------------
// Preload API shape — exposed as window.psygil
// ---------------------------------------------------------------------------

export interface PsygilApi {
  readonly platform: string
  readonly cases: {
    readonly list: (params?: CasesListParams) => Promise<IpcResponse<CasesListResult>>
    readonly get: (params: CasesGetParams) => Promise<IpcResponse<CasesGetResult>>
    readonly create: (params: CasesCreateParams) => Promise<IpcResponse<CasesCreateResult>>
    readonly archive: (params: CasesArchiveParams) => Promise<IpcResponse<CasesArchiveResult>>
  }
  readonly intake: {
    readonly save: (params: IntakeSaveParams) => Promise<IpcResponse<PatientIntakeRow>>
    readonly get: (params: IntakeGetParams) => Promise<IpcResponse<PatientIntakeRow | null>>
  }
  readonly onboarding: {
    readonly save: (params: OnboardingSaveParams) => Promise<IpcResponse<PatientOnboardingRow>>
    readonly get: (params: OnboardingGetParams) => Promise<IpcResponse<readonly PatientOnboardingRow[]>>
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
  readonly documents: {
    readonly ingest: (params: IngestFileParams) => Promise<IpcResponse<DocumentRow>>
    readonly list: (params: DocumentsListParams) => Promise<IpcResponse<readonly DocumentRow[]>>
    readonly get: (params: DocumentsGetParams) => Promise<IpcResponse<DocumentRow | null>>
    readonly delete: (params: DocumentsDeleteParams) => Promise<IpcResponse<void>>
    readonly pickFile: () => Promise<IpcResponse<string | null>>
  }
  readonly pii: {
    readonly detect: (params: PiiDetectParams) => Promise<IpcResponse<PiiDetectResult>>
    readonly batchDetect: (params: PiiBatchDetectParams) => Promise<IpcResponse<PiiBatchDetectResult>>
    readonly redact: (params: PiiRedactParams) => Promise<IpcResponse<PiiRedactResult>>
    readonly rehydrate: (params: PiiRehydrateParams) => Promise<IpcResponse<PiiRehydrateResult>>
    readonly destroy: (params: PiiDestroyParams) => Promise<IpcResponse<PiiDestroyResult>>
  }
  readonly seed: {
    readonly demoCases: () => Promise<IpcResponse<{ inserted: number }>>
  }
  readonly workspace: {
    readonly getPath: () => Promise<IpcResponse<string | null>>
    readonly setPath: (path: string) => Promise<IpcResponse<void>>
    readonly getTree: () => Promise<IpcResponse<readonly FolderNode[]>>
    readonly openInFinder: (path: string) => Promise<IpcResponse<void>>
    readonly openNative: (path: string) => Promise<IpcResponse<void>>
    readonly pickFolder: () => Promise<IpcResponse<string | null>>
    readonly getDefaultPath: () => Promise<IpcResponse<string>>
    readonly onFileChanged: (callback: (event: WorkspaceFileChangedEvent) => void) => void
    readonly offFileChanged: () => void
  }
  readonly apiKey: {
    readonly store: (params: ApiKeyStoreParams) => Promise<IpcResponse<ApiKeyStoreResult>>
    readonly retrieve: () => Promise<IpcResponse<ApiKeyRetrieveResult>>
    readonly delete: () => Promise<IpcResponse<ApiKeyDeleteResult>>
    readonly has: () => Promise<IpcResponse<ApiKeyHasResult>>
  }
  readonly ai: {
    readonly complete: (params: AiCompleteParams) => Promise<IpcResponse<AiCompleteResult>>
    readonly testConnection: (params: AiTestConnectionParams) => Promise<IpcResponse<AiTestConnectionResult>>
  }
}

// Augment the global Window interface for renderer usage
declare global {
  interface Window {
    readonly psygil: PsygilApi
  }
}
