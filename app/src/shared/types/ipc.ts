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

// cases.update — partial update of mutable case fields
export interface CasesUpdateParams {
  readonly case_id: number
  readonly evaluation_type?: string | null
  readonly workflow_current_stage?: string | null
  readonly case_status?: string
  readonly referral_source?: string | null
  readonly evaluation_questions?: string | null
  readonly notes?: string | null
}

export type CasesUpdateResult = CaseRow

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
  | 'diagnostic_notes'
  | 'referral_notes'
  | 'documents_notes'
  | 'testing_notes'
  | 'interview_notes'

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

export interface PickFilesResult {
  readonly filePaths: readonly string[]
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
// Agent System
// ---------------------------------------------------------------------------

export type AgentType = 'ingestor' | 'diagnostician' | 'writer' | 'editor'

export interface AgentRunParams {
  readonly agentType: AgentType
  readonly systemPrompt: string
  readonly caseId: number
  readonly inputTexts: readonly string[]
  readonly context?: string
  readonly maxTokens?: number
  readonly temperature?: number
}

export interface AgentRunResult {
  readonly operationId: string
  readonly agentType: AgentType
  readonly caseId: number
  readonly status: 'success' | 'error'
  readonly result?: unknown
  readonly error?: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

export interface AgentStatusResult {
  readonly operationId: string | null
  readonly agentType: AgentType | null
  readonly caseId: number | null
  readonly status: 'queued' | 'running' | 'done' | 'error' | 'idle'
  readonly elapsedMs: number
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
}

// ---------------------------------------------------------------------------
// Ingestor Agent
// ---------------------------------------------------------------------------

export interface IngestorRunParams {
  readonly caseId: number
}

export interface IngestorRunResult {
  readonly operationId: string
  readonly caseId: number
  readonly status: 'success' | 'error'
  readonly result?: unknown
  readonly error?: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

export interface IngestorGetResultParams {
  readonly caseId: number
}

// ---------------------------------------------------------------------------
// Diagnostician Agent
// ---------------------------------------------------------------------------

export interface DiagnosticianRunParams {
  readonly caseId: number
}

export interface DiagnosticianRunResult {
  readonly operationId: string
  readonly caseId: number
  readonly status: 'success' | 'error'
  readonly result?: unknown
  readonly error?: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

export interface DiagnosticianGetResultParams {
  readonly caseId: number
}

// ---------------------------------------------------------------------------
// Writer Agent
// ---------------------------------------------------------------------------

export interface WriterRunParams {
  readonly caseId: number
}

export interface WriterRunResult {
  readonly operationId: string
  readonly caseId: number
  readonly status: 'success' | 'error'
  readonly result?: unknown
  readonly error?: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

export interface WriterGetResultParams {
  readonly caseId: number
}

// ---------------------------------------------------------------------------
// Editor Agent
// ---------------------------------------------------------------------------

export interface EditorRunParams {
  readonly caseId: number
}

export interface EditorRunResult {
  readonly operationId: string
  readonly caseId: number
  readonly status: 'success' | 'error'
  readonly result?: unknown
  readonly error?: string
  readonly tokenUsage?: {
    readonly input: number
    readonly output: number
  }
  readonly durationMs: number
}

export interface EditorGetResultParams {
  readonly caseId: number
}

// ---------------------------------------------------------------------------
// Pipeline Stage Advancement
// ---------------------------------------------------------------------------

export interface PipelineCheckParams {
  readonly caseId: number
}

export interface PipelineCheckResult {
  readonly canAdvance: boolean
  readonly currentStage: PipelineStage
  readonly nextStage: PipelineStage | null
  readonly reason: string
}

export interface PipelineAdvanceParams {
  readonly caseId: number
}

export interface PipelineAdvanceResult {
  readonly success: boolean
  readonly newStage: PipelineStage
  readonly previousStage: PipelineStage
}

export interface PipelineSetStageParams {
  readonly caseId: number
  readonly stage: string
}

export interface PipelineSetStageResult {
  readonly success: boolean
  readonly newStage: string
  readonly previousStage: string
}

export interface PipelineConditionsParams {
  readonly stage: PipelineStage
}

export interface PipelineConditionsResult {
  readonly stage: PipelineStage
  readonly conditions: readonly string[]
}

// ---------------------------------------------------------------------------
// Data Confirmation — Gate for Onboarding stage
// ---------------------------------------------------------------------------

export interface DataConfirmationSaveParams {
  readonly caseId: number
  readonly categoryId: string
  readonly status: string
  readonly notes: string
}

export interface DataConfirmationGetParams {
  readonly caseId: number
}

export interface DataConfirmationGetResult {
  readonly data: Array<{
    readonly category_id: string
    readonly status: string
    readonly notes: string
  }>
}

// ---------------------------------------------------------------------------
// Diagnostic Decisions — ██ DOCTOR ALWAYS DIAGNOSES ██
// ---------------------------------------------------------------------------

export interface DiagnosticDecisionSaveParams {
  readonly case_id: number
  readonly diagnosis_key: string
  readonly icd_code: string
  readonly diagnosis_name: string
  readonly decision: 'render' | 'rule_out' | 'defer'
  readonly clinician_notes?: string
}

export interface DiagnosticDecisionRow {
  readonly decision_id: number
  readonly case_id: number
  readonly diagnosis_key: string
  readonly icd_code: string
  readonly diagnosis_name: string
  readonly decision: 'render' | 'rule_out' | 'defer'
  readonly clinician_notes: string
  readonly decided_at: string
  readonly updated_at: string
}

export interface DiagnosticDecisionListParams {
  readonly case_id: number
}

export interface DiagnosticDecisionDeleteParams {
  readonly case_id: number
  readonly diagnosis_key: string
}

// ---------------------------------------------------------------------------
// OnlyOffice Document Server
// ---------------------------------------------------------------------------

export interface OnlyOfficeStartResult {
  readonly port: number
  readonly jwtSecret: string
}

export interface OnlyOfficeStatusResult {
  readonly running: boolean
  readonly port: number | null
  readonly healthy: boolean
}

export interface OnlyOfficeTokenParams {
  readonly payload: Record<string, unknown>
}

export interface OnlyOfficeGenerateDocxParams {
  readonly caseId: number
}

export interface OnlyOfficeGenerateDocxResult {
  readonly filePath: string
  readonly version: number
}

export interface OnlyOfficeOpenDocumentParams {
  readonly caseId: number
  readonly filePath?: string
  readonly readOnly?: boolean
}

export interface OnlyOfficeOpenDocumentResult {
  readonly documentUrl: string
  readonly jwtToken: string
  readonly callbackUrl?: string
}

// ---------------------------------------------------------------------------
// Report Attestation & Finalization
// ---------------------------------------------------------------------------

export interface ReportStatusParams {
  readonly caseId: number
}

export interface ReportStatusResult {
  readonly finalized: boolean
  readonly finalizedAt?: string
  readonly integrityHash?: string
  readonly signedBy?: string
}

export interface SubmitAttestationParams {
  readonly caseId: number
  readonly signedBy: string
  readonly attestationStatement: string
  readonly signatureDate: string
}

export interface SubmitAttestationResult {
  readonly success: boolean
  readonly integrityHash: string
  readonly finalizedAt: string
}

export interface VerifyIntegrityParams {
  readonly caseId: number
}

export interface VerifyIntegrityResult {
  readonly valid: boolean
  readonly integrityHash: string
  readonly expectedHash: string
}

// ---------------------------------------------------------------------------
// Audit Trail
// ---------------------------------------------------------------------------

export interface AuditEntry {
  readonly id: string
  readonly caseId: number
  readonly timestamp: string
  readonly actionType: string
  readonly actorType: 'clinician' | 'system' | 'agent'
  readonly actorId?: string
  readonly actorName?: string
  readonly details: string
  readonly relatedEntityType?: string
  readonly relatedEntityId?: string
  readonly status: 'complete' | 'in_progress' | 'error'
}

export interface AuditLogParams {
  readonly caseId: number
  readonly actionType: string
  readonly actorType: 'clinician' | 'system' | 'agent'
  readonly actorId?: string
  readonly details: string
  readonly relatedEntityType?: string
  readonly relatedEntityId?: string
}

export interface AuditLogResult {
  readonly entryId: string
  readonly timestamp: string
}

export interface AuditGetTrailParams {
  readonly caseId: number
}

export interface AuditGetTrailResult {
  readonly entries: readonly AuditEntry[]
  readonly total: number
}

export interface AuditExportParams {
  readonly caseId: number
  readonly format: 'csv' | 'json'
}

export interface AuditExportResult {
  readonly data: string
  readonly mimeType: string
}

// ---------------------------------------------------------------------------
// Testimony Preparation
// ---------------------------------------------------------------------------

export interface TestimonyPrepareParams {
  readonly caseId: number
}

export interface TestimonyPrepareResult {
  readonly success: boolean
  readonly exportedFiles: readonly string[]
  readonly timestamp: string
}

// ---------------------------------------------------------------------------
// Resources (writing samples, templates, documentation)
// ---------------------------------------------------------------------------

export type ResourceCategory = 'writing-samples' | 'templates' | 'documentation'

export interface ResourceUploadParams {
  readonly category: ResourceCategory
  readonly filePaths: readonly string[]
}

export interface ResourceUploadResult {
  readonly imported: readonly ResourceItem[]
  readonly phiStripped: number
}

export interface ResourceItem {
  readonly id: string
  readonly category: ResourceCategory
  readonly originalFilename: string
  readonly storedPath: string
  readonly fileSize: number
  readonly mimeType: string
  readonly uploadedAt: string
  readonly phiStripped: boolean
}

export interface ResourceListParams {
  readonly category?: ResourceCategory
}

export interface ResourceDeleteParams {
  readonly id: string
  readonly storedPath: string
}

export interface ResourceOpenParams {
  readonly storedPath: string
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
    readonly update: (params: CasesUpdateParams) => Promise<IpcResponse<CasesUpdateResult>>
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
    readonly pickFiles: () => Promise<IpcResponse<PickFilesResult>>
    readonly pickFilesFrom: (params: { defaultPath?: string; title?: string; extensions?: string[] }) => Promise<IpcResponse<PickFilesResult>>
    readonly getDroppedFilePath: (file: File) => string
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
    readonly getMalformed: () => Promise<IpcResponse<readonly { name: string; path: string; reason: string }[]>>
    readonly scaffold: (folderPath: string) => Promise<IpcResponse<string[]>>
    readonly onFileChanged: (callback: (event: WorkspaceFileChangedEvent) => void) => unknown
    readonly offFileChanged: (wrapped?: unknown) => void
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
  readonly agent: {
    readonly run: (params: AgentRunParams) => Promise<IpcResponse<AgentRunResult>>
    readonly status: (operationId?: string) => Promise<IpcResponse<AgentStatusResult>>
  }
  readonly ingestor: {
    readonly run: (params: IngestorRunParams) => Promise<IpcResponse<IngestorRunResult>>
    readonly getResult: (params: IngestorGetResultParams) => Promise<IpcResponse<unknown>>
  }
  readonly diagnostician: {
    readonly run: (params: DiagnosticianRunParams) => Promise<IpcResponse<DiagnosticianRunResult>>
    readonly getResult: (params: DiagnosticianGetResultParams) => Promise<IpcResponse<unknown>>
  }
  readonly writer: {
    readonly run: (params: WriterRunParams) => Promise<IpcResponse<WriterRunResult>>
    readonly getResult: (params: WriterGetResultParams) => Promise<IpcResponse<unknown>>
  }
  readonly editor: {
    readonly run: (params: EditorRunParams) => Promise<IpcResponse<EditorRunResult>>
    readonly getResult: (params: EditorGetResultParams) => Promise<IpcResponse<unknown>>
  }
  readonly pipeline: {
    readonly check: (params: PipelineCheckParams) => Promise<IpcResponse<PipelineCheckResult>>
    readonly advance: (params: PipelineAdvanceParams) => Promise<IpcResponse<PipelineAdvanceResult>>
    readonly setStage: (params: PipelineSetStageParams) => Promise<IpcResponse<PipelineSetStageResult>>
    readonly conditions: (params: PipelineConditionsParams) => Promise<IpcResponse<PipelineConditionsResult>>
  }
  readonly diagnosticDecisions: {
    readonly save: (params: DiagnosticDecisionSaveParams) => Promise<IpcResponse<DiagnosticDecisionRow>>
    readonly list: (params: DiagnosticDecisionListParams) => Promise<IpcResponse<readonly DiagnosticDecisionRow[]>>
    readonly delete: (params: DiagnosticDecisionDeleteParams) => Promise<IpcResponse<void>>
  }
  readonly dataConfirmation: {
    readonly save: (args: { caseId: number; categoryId: string; status: string; notes: string }) => Promise<IpcResponse<{ status: string }>>
    readonly get: (args: { caseId: number }) => Promise<IpcResponse<DataConfirmationGetResult>>
  }

  readonly onlyoffice: {
    readonly start: () => Promise<IpcResponse<OnlyOfficeStartResult>>
    readonly stop: () => Promise<IpcResponse<void>>
    readonly status: () => Promise<IpcResponse<OnlyOfficeStatusResult>>
    readonly getUrl: () => Promise<IpcResponse<string | null>>
    readonly generateToken: (args: OnlyOfficeTokenParams) => Promise<IpcResponse<string>>
    readonly generateDocx: (args: OnlyOfficeGenerateDocxParams) => Promise<IpcResponse<OnlyOfficeGenerateDocxResult>>
    readonly openDocument: (args: OnlyOfficeOpenDocumentParams) => Promise<IpcResponse<OnlyOfficeOpenDocumentResult>>
  }
  readonly report: {
    readonly getStatus: (args: ReportStatusParams) => Promise<IpcResponse<ReportStatusResult>>
    readonly submitAttestation: (args: SubmitAttestationParams) => Promise<IpcResponse<SubmitAttestationResult>>
    readonly verifyIntegrity: (args: VerifyIntegrityParams) => Promise<IpcResponse<VerifyIntegrityResult>>
    readonly exportAndOpen: (args: { caseId: number; fullName: string; evalType: string; sections: { title: string; body: string }[] }) => Promise<IpcResponse<{ filePath: string }>>
    readonly loadTemplate: () => Promise<IpcResponse<{ sections: { title: string; body: string }[] }>>
  }
  readonly audit: {
    readonly log: (args: AuditLogParams) => Promise<IpcResponse<AuditLogResult>>
    readonly getTrail: (args: AuditGetTrailParams) => Promise<IpcResponse<AuditGetTrailResult>>
    readonly export: (args: AuditExportParams) => Promise<IpcResponse<AuditExportResult>>
  }
  readonly testimony: {
    readonly prepare: (args: TestimonyPrepareParams) => Promise<IpcResponse<TestimonyPrepareResult>>
  }

  readonly referral: {
    readonly parseDoc: () => Promise<IpcResponse<Record<string, string>>>
  }

  readonly resources: {
    readonly upload: (args: ResourceUploadParams) => Promise<IpcResponse<ResourceUploadResult>>
    readonly list: (args: ResourceListParams) => Promise<IpcResponse<readonly ResourceItem[]>>
    readonly delete: (args: ResourceDeleteParams) => Promise<IpcResponse<void>>
    readonly open: (args: ResourceOpenParams) => Promise<IpcResponse<void>>
    readonly read: (args: ResourceOpenParams) => Promise<IpcResponse<{ content: string; redacted: string; encoding: 'text' | 'html' | 'pdf-base64' | 'base64'; mimeType: string; phiCount: number }>>
  }
  readonly whisper: {
    /** Save an audio blob (base64-encoded) to the case's Interviews folder */
    readonly saveAudio: (args: { caseId: number; audioBase64: string; filename: string; mimeType: string }) => Promise<IpcResponse<{ filePath: string; sizeBytes: number }>>
    /** Batch-transcribe a complete audio file */
    readonly transcribe: (args: { filePath: string; language?: string }) => Promise<IpcResponse<{ text: string; segments: readonly { start: number; end: number; text: string }[]; duration: number }>>
    /** Check transcription engine availability */
    readonly status: () => Promise<IpcResponse<{ available: boolean; model: string | null; version: string | null; sidecarReady: boolean }>>
    /** Start live streaming transcription session */
    readonly streamStart: (args: { sessionId: string }) => Promise<IpcResponse<{ started: boolean }>>
    /** Send an audio chunk during live streaming (fire-and-forget) */
    readonly streamAudio: (args: { sessionId: string; audioBase64: string }) => void
    /** Stop live streaming session */
    readonly streamStop: (args: { sessionId: string }) => Promise<IpcResponse<{ stopped: boolean }>>
    /** Listen for live transcription text (partial chunks + final) */
    readonly onLiveText: (callback: (data: { sessionId: string; text: string; type: 'partial' | 'final' | 'error' }) => void) => () => void
  }
}

// Augment the global Window interface for renderer usage
declare global {
  interface Window {
    readonly psygil: PsygilApi
  }
}
