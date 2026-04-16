// Psygil IPC Type Definitions
// Shared between main process and renderer via contextBridge.
// Source of truth: docs/engineering/02_ipc_api_contracts.md (Boundary 4)

// ---------------------------------------------------------------------------
// Generic envelope, discriminated union on `ok`
// ---------------------------------------------------------------------------

/**
 * Successful IPC response. Discriminator: ok === true.
 * Legacy field `status: 'success'` preserved so callers that check
 * `resp.status === 'success'` keep compiling during migration.
 */
export interface IpcOk<T> {
  readonly ok: true
  readonly status: 'success'
  readonly data: T
}

/**
 * Error IPC response. Discriminator: ok === false.
 * Legacy fields `status`, `error_code`, `message` preserved on this branch.
 */
export interface IpcErr {
  readonly ok: false
  readonly status: 'error'
  readonly error_code: string
  readonly message: string
}

/** Discriminated union. Narrow with `isOk(r)`, `isErr(r)`, or `r.ok`. */
export type IpcResponse<T> = IpcOk<T> | IpcErr

// Deprecated aliases kept for backwards compatibility.
// Prefer IpcOk / IpcErr in new code.
export type IpcSuccess<T> = IpcOk<T>
export type IpcError = IpcErr

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isOk<T>(r: IpcResponse<T>): r is IpcOk<T> {
  return r.ok === true
}

export function isErr<T>(r: IpcResponse<T>): r is IpcErr {
  return r.ok === false
}

// ---------------------------------------------------------------------------
// Constructor helpers (main-process handlers)
// ---------------------------------------------------------------------------

export function ok<T>(data: T): IpcOk<T> {
  return { ok: true, status: 'success', data }
}

export function fail(code: string, message = 'An error occurred'): IpcErr {
  return { ok: false, status: 'error', error_code: code, message }
}

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
// Cases, DB row shape (matches cases table + folder_path column)
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

// cases.create, reuse CreateCaseParams
export type CasesCreateParams = CreateCaseParams

export type CasesCreateResult = CaseRow

// cases.update, partial update of mutable case fields
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
// Psychometrician Agent
// ---------------------------------------------------------------------------

export interface PsychometricianRunParams {
  readonly caseId: number
}

export interface PsychometricianRunResult {
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

export interface PsychometricianGetResultParams {
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
// Data Confirmation, Gate for Onboarding stage
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
// Test Scores
// ---------------------------------------------------------------------------

export interface TestScoreEntry {
  readonly scale_name: string
  readonly raw_score?: number
  readonly t_score?: number
  readonly percentile?: number
  readonly scaled_score?: number
  readonly interpretation?: string
  readonly is_elevated?: boolean
}

export interface TestScoreSaveParams {
  readonly case_id: number
  readonly instrument_name: string
  readonly instrument_abbrev: string
  readonly administration_date: string
  readonly data_entry_method: 'manual' | 'pdf_extraction'
  readonly scores: readonly TestScoreEntry[]
  readonly validity_scores?: readonly TestScoreEntry[]
  readonly clinical_narrative?: string
  readonly notes?: string
}

export interface TestScoreListParams {
  readonly case_id: number
}

// ---------------------------------------------------------------------------
// Diagnosis Catalog, DSM-5-TR reference lookup
// ---------------------------------------------------------------------------

export interface DiagnosisCatalogRow {
  readonly diagnosis_id: number
  readonly code: string
  readonly dsm5tr_code: string
  readonly name: string
  readonly description: string
  readonly category: string
  readonly is_builtin: number
}

export interface DiagnosisCatalogSearchParams {
  readonly query: string
  readonly limit?: number
}

export interface DiagnosisCatalogListParams {
  readonly category?: string
}

// ---------------------------------------------------------------------------
// Diagnostic Decisions, ██ DOCTOR ALWAYS DIAGNOSES ██
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
// Clinical Formulation, clinician's authoritative narrative per case
// ---------------------------------------------------------------------------

export interface ClinicalFormulationRow {
  readonly formulation_id: number
  readonly case_id: number
  readonly formulation_text: string
  readonly updated_at: string
}

export interface ClinicalFormulationSaveParams {
  readonly case_id: number
  readonly formulation_text: string
}

export interface ClinicalFormulationGetParams {
  readonly case_id: number
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
  readonly actorType: 'clinician' | 'system' | 'ai_agent'
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
  readonly actorType: 'clinician' | 'system' | 'ai_agent'
  readonly actorId?: string
  readonly details: string | Record<string, unknown>
  readonly relatedEntityType?: string
  readonly relatedEntityId?: string | number
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
// Writing Sample upload with Presidio PII pipeline
// ---------------------------------------------------------------------------

/** Per-file PHI detection report returned after Presidio processing */
export interface WritingSamplePhiReport {
  readonly filename: string
  readonly originalSize: number
  readonly cleanedSize: number
  /** Total PHI entities detected and redacted */
  readonly entityCount: number
  /** Breakdown by HIPAA category: { PERSON: 12, DATE_TIME: 5, ... } */
  readonly typeBreakdown: Record<string, number>
  /** Whether the sidecar was used (true) or fell back to regex (false) */
  readonly presidioUsed: boolean
  /** Path to the cleaned file in _cleaned/ */
  readonly cleanedPath: string
  /** Short excerpt of the cleaned text (first 500 chars) for preview */
  readonly cleanedPreview: string
}

export interface WritingSampleUploadParams {
  readonly filePaths?: readonly string[]
}

export interface WritingSampleUploadResult {
  readonly imported: readonly ResourceItem[]
  readonly reports: readonly WritingSamplePhiReport[]
  /** Total PHI entities stripped across all files */
  readonly totalPhiStripped: number
  /** Whether the Presidio sidecar was available */
  readonly sidecarAvailable: boolean
}

/** Voice/style analysis result for a single writing sample */
export interface VoiceStyleProfile {
  readonly filename: string
  /** Average sentence length in words */
  readonly avgSentenceLength: number
  /** Median sentence length in words */
  readonly medianSentenceLength: number
  /** Total word count */
  readonly wordCount: number
  /** Total sentence count */
  readonly sentenceCount: number
  /** Paragraph count */
  readonly paragraphCount: number
  /** Average paragraph length in sentences */
  readonly avgParagraphLength: number
  /** Vocabulary richness: unique words / total words */
  readonly vocabularyRichness: number
  /** Top 20 most-used clinical/forensic terms */
  readonly topTerms: readonly { term: string; count: number }[]
  /** Hedging phrases found (e.g., "appears to", "is consistent with") */
  readonly hedgingPhrases: readonly { phrase: string; count: number }[]
  /** Person reference: percentage of first-person vs third-person */
  readonly personReference: { firstPerson: number; thirdPerson: number }
  /** Tense distribution: past vs present */
  readonly tenseDistribution: { past: number; present: number }
  /** Detected section headings */
  readonly sectionHeadings: readonly string[]
  /** Formality score: 0 (conversational) to 1 (highly formal) */
  readonly formalityScore: number
}

export interface WritingSampleAnalyzeParams {
  readonly storedPaths: readonly string[]
}

export interface WritingSampleAnalyzeResult {
  readonly profiles: readonly VoiceStyleProfile[]
  /** Aggregate across all samples */
  readonly aggregate: {
    readonly avgSentenceLength: number
    readonly vocabularyRichness: number
    readonly formalityScore: number
    readonly topTerms: readonly { term: string; count: number }[]
    readonly hedgingPhrases: readonly { phrase: string; count: number }[]
    readonly sampleCount: number
    readonly totalWordCount: number
    readonly personReference: { firstPerson: number; thirdPerson: number }
    readonly tenseDistribution: { past: number; present: number }
    readonly sectionHeadings: readonly string[]
  }
}

/** Persisted voice/style profile saved to .style-profile.json in the workspace */
export interface PersistedStyleProfile {
  readonly version: 1
  readonly updatedAt: string
  readonly sampleCount: number
  readonly totalWordCount: number
  readonly avgSentenceLength: number
  readonly vocabularyRichness: number
  readonly formalityScore: number
  readonly topTerms: readonly { term: string; count: number }[]
  readonly hedgingPhrases: readonly { phrase: string; count: number }[]
  readonly personReference: { firstPerson: number; thirdPerson: number }
  readonly tenseDistribution: { past: number; present: number }
  readonly sectionHeadings: readonly string[]
}

export interface WritingSamplePreviewParams {
  readonly storedPath: string
}

export interface WritingSamplePreviewResult {
  /** The cleaned (de-identified) text content */
  readonly cleanedText: string
  /** The original text (for side-by-side comparison, stays local) */
  readonly originalText: string
  /** PHI entities found during the original redaction */
  readonly entityCount: number
  readonly typeBreakdown: Record<string, number>
}

// ---------------------------------------------------------------------------
// Report Templates (custom uploaded + built-in)
// ---------------------------------------------------------------------------

/** Formatting config extracted from a .docx template */
export interface TemplateFormattingConfig {
  readonly margins: { top: number; bottom: number; left: number; right: number }
  readonly fontFamily: string
  readonly fontSize: number
  readonly lineSpacing: number
  readonly headingFont: string
  readonly headingSize: number
  readonly headerContent: string
  readonly footerContent: string
}

/** A single section in a parsed template */
export interface TemplateSectionProfile {
  readonly heading: string
  readonly contentType: 'narrative' | 'table' | 'list' | 'mixed'
  readonly exampleProse: string
  readonly estimatedLength: 'brief' | 'moderate' | 'extensive'
  readonly order: number
}

/** Full template profile stored as JSON sidecar */
export interface TemplateProfile {
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly evalType: string
  readonly source: 'builtin' | 'custom'
  readonly createdAt: string
  readonly formatting: TemplateFormattingConfig
  readonly sections: readonly TemplateSectionProfile[]
  readonly sectionCount: number
  readonly docxPath: string | null
}

/** Params for template upload (step 1: analyze) */
export interface TemplateAnalyzeParams {
  readonly filePath?: string
}

/** Result from template analysis before confirmation */
export interface TemplateAnalyzeResult {
  readonly detectedEvalType: string
  readonly suggestedName: string
  readonly formatting: TemplateFormattingConfig
  readonly sections: readonly TemplateSectionProfile[]
  readonly cleanedText: string
  readonly phiStripped: number
  readonly tempDocxPath: string
}

/** Params for saving a confirmed template */
export interface TemplateSaveParams {
  readonly tempDocxPath: string
  readonly name: string
  readonly evalType: string
  readonly formatting: TemplateFormattingConfig
  readonly sections: readonly TemplateSectionProfile[]
}

/** Saved template summary (for listing) */
export interface TemplateSummary {
  readonly id: string
  readonly name: string
  readonly evalType: string
  readonly source: 'builtin' | 'custom'
  readonly sectionCount: number
  readonly createdAt: string
  readonly docxPath: string | null
}

export interface TemplateListParams {
  readonly evalType?: string
}

export interface TemplateGetParams {
  readonly id: string
}

export interface TemplateDeleteParams {
  readonly id: string
}

export interface TemplateOpenParams {
  readonly id: string
}

export interface TemplateSetLastUsedParams {
  readonly evalType: string
  readonly templateId: string
}

export interface TemplateGetLastUsedParams {
  readonly evalType: string
}

// ---------------------------------------------------------------------------
// Preload API shape, exposed as window.psygil
// ---------------------------------------------------------------------------

export interface PsygilApi {
  readonly platform: string
  readonly cases: {
    readonly list: (params?: CasesListParams) => Promise<IpcResponse<CasesListResult>>
    readonly get: (params: CasesGetParams) => Promise<IpcResponse<CasesGetResult>>
    readonly create: (params: CasesCreateParams) => Promise<IpcResponse<CasesCreateResult>>
    readonly update: (params: CasesUpdateParams) => Promise<IpcResponse<CasesUpdateResult>>
    readonly archive: (params: CasesArchiveParams) => Promise<IpcResponse<CasesArchiveResult>>
    readonly onChanged: (callback: (data: { caseId: number; newStage: string; previousStage: string }) => void) => (...args: unknown[]) => void
    readonly offChanged: (wrapped?: (...args: unknown[]) => void) => void
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
    readonly syncToDisk: (params: { case_id: number }) => Promise<IpcResponse<{ files: string[]; errors: string[] }>>
    readonly writeTabDoc: (params: { case_id: number; tab: 'intake' | 'referral' | 'testing' | 'interview' | 'diagnostics' }) => Promise<IpcResponse<string | null>>
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
  readonly psychometrician: {
    readonly run: (params: PsychometricianRunParams) => Promise<IpcResponse<PsychometricianRunResult>>
    readonly getResult: (params: PsychometricianGetResultParams) => Promise<IpcResponse<unknown>>
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
  readonly testScores: {
    readonly save: (params: TestScoreSaveParams) => Promise<IpcResponse<unknown>>
    readonly list: (params: TestScoreListParams) => Promise<IpcResponse<readonly unknown[]>>
    readonly delete: (params: { id: number }) => Promise<IpcResponse<void>>
  }
  readonly clinicalFormulation: {
    readonly save: (params: ClinicalFormulationSaveParams) => Promise<IpcResponse<ClinicalFormulationRow>>
    readonly get: (params: ClinicalFormulationGetParams) => Promise<IpcResponse<ClinicalFormulationRow | null>>
  }
  readonly dataConfirmation: {
    readonly save: (args: { caseId: number; categoryId: string; status: string; notes: string }) => Promise<IpcResponse<{ status: string }>>
    readonly get: (args: { caseId: number }) => Promise<IpcResponse<DataConfirmationGetResult>>
  }

  readonly branding: {
    readonly get: () => Promise<IpcResponse<{
      practiceName: string
      logoPath?: string
      logoData?: string
      primaryColor: string
      tagline?: string
      showAttribution: boolean
    }>>
    readonly save: (branding: {
      practiceName: string
      logoPath?: string
      logoData?: string
      primaryColor: string
      tagline?: string
      showAttribution: boolean
    }) => Promise<IpcResponse<{ ok: true }>>
    readonly saveLogo: () => Promise<IpcResponse<{ logoPath: string; logoData: string }>>
    /** Subscribe to main-broadcast branding updates. Returns unsubscribe fn. */
    readonly onChanged: (cb: (branding: {
      practiceName: string
      logoPath?: string
      logoData?: string
      primaryColor: string
      tagline?: string
      showAttribution: boolean
    }) => void) => () => void
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
  readonly templates: {
    /** Step 1: Upload and analyze a .docx report, strip PHI, detect eval type and sections */
    readonly analyze: (args: TemplateAnalyzeParams) => Promise<IpcResponse<TemplateAnalyzeResult>>
    /** Step 2: Save the analyzed template with user-confirmed name and eval type */
    readonly save: (args: TemplateSaveParams) => Promise<IpcResponse<TemplateProfile>>
    /** List all templates (built-in + custom), optionally filtered by eval type */
    readonly list: (args?: TemplateListParams) => Promise<IpcResponse<readonly TemplateSummary[]>>
    /** Get full template profile by ID */
    readonly get: (args: TemplateGetParams) => Promise<IpcResponse<TemplateProfile>>
    /** Delete a template */
    readonly delete: (args: TemplateDeleteParams) => Promise<IpcResponse<void>>
    /** Open the template's cleaned .docx in the system default app */
    readonly open: (args: TemplateOpenParams) => Promise<IpcResponse<void>>
    /** Record which template was last used for an eval type */
    readonly setLastUsed: (args: TemplateSetLastUsedParams) => Promise<IpcResponse<void>>
    /** Get the last used template ID for an eval type */
    readonly getLastUsed: (args: TemplateGetLastUsedParams) => Promise<IpcResponse<string | null>>
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
    /** Upload writing samples with Presidio NER-based PHI stripping (18 HIPAA identifiers) */
    readonly uploadWritingSample: (args: WritingSampleUploadParams) => Promise<IpcResponse<WritingSampleUploadResult>>
    /** Preview a cleaned writing sample alongside original (both stay local, never sent to AI) */
    readonly previewCleaned: (args: WritingSamplePreviewParams) => Promise<IpcResponse<WritingSamplePreviewResult>>
    /** Analyze de-identified writing samples for voice and vocabulary style */
    readonly analyzeStyle: (args: WritingSampleAnalyzeParams) => Promise<IpcResponse<WritingSampleAnalyzeResult>>
    /** Load persisted voice/style profile from disk (null if none exists) */
    readonly getStyleProfile: () => Promise<IpcResponse<PersistedStyleProfile | null>>
    /** Recompute voice/style profile across ALL cleaned writing samples and persist to disk */
    readonly recalculateStyleProfile: () => Promise<IpcResponse<WritingSampleAnalyzeResult>>
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
  readonly diagnosisCatalog: {
    readonly search: (params: DiagnosisCatalogSearchParams) => Promise<IpcResponse<readonly DiagnosisCatalogRow[]>>
    readonly list: (params?: DiagnosisCatalogListParams) => Promise<IpcResponse<readonly DiagnosisCatalogRow[]>>
  }
  readonly testHarness: {
    readonly list: () => Promise<IpcResponse<readonly { id: string; name: string; description: string; stopAtStage: string | null; stepCount: number }[]>>
    readonly run: (params: { manifestId: string }) => Promise<IpcResponse<unknown>>
    readonly runAll: () => Promise<IpcResponse<unknown>>
  }
  readonly updater: {
    readonly check: () => Promise<unknown>
    readonly download: (args: { version: string }) => Promise<unknown>
    readonly getVersion: () => Promise<unknown>
  }
  readonly setup: import('./setup').SetupApi
}

// Augment the global Window interface for renderer usage
declare global {
  interface Window {
    readonly psygil: PsygilApi
  }
}
