/**
 * Test Harness Manifest Types
 *
 * Defines the shape of a test case manifest: everything needed to create a case,
 * populate it with documents/scores/decisions, advance through pipeline stages,
 * and verify state at each checkpoint.
 *
 * Each manifest describes one forensic psychology case from intake through
 * completion (or partial completion for stop-point testing).
 */

// ---------------------------------------------------------------------------
// Pipeline stage type (mirrors shared/types)
// ---------------------------------------------------------------------------

export type PipelineStage =
  | 'onboarding'
  | 'testing'
  | 'interview'
  | 'diagnostics'
  | 'review'
  | 'complete'

// ---------------------------------------------------------------------------
// Case definition
// ---------------------------------------------------------------------------

export interface CaseDefinition {
  readonly caseNumber: string
  readonly firstName: string
  readonly lastName: string
  readonly dob: string
  readonly gender: 'M' | 'F' | 'NB'
  readonly evaluationType: string
  readonly referralSource: string
  readonly evaluationQuestions: string
  readonly notes: string
}

// ---------------------------------------------------------------------------
// Intake data
// ---------------------------------------------------------------------------

export interface IntakeDefinition {
  readonly referralSource: string
  readonly referralType: 'court_ordered' | 'defense_retained' | 'prosecution_retained' | 'self_referred' | 'attorney_referred'
  readonly presentingComplaint: string
  readonly status: 'pending' | 'complete'
}

// ---------------------------------------------------------------------------
// Document fixtures
// ---------------------------------------------------------------------------

export type DocumentSubfolder =
  | '_Inbox'
  | 'Collateral'
  | 'Testing'
  | 'Interviews'
  | 'Diagnostics'
  | 'Reports'
  | 'Archive'

export interface DocumentFixture {
  /** Filename to create on disk */
  readonly filename: string
  /** Target subfolder in case workspace */
  readonly subfolder: DocumentSubfolder
  /** Document type for DB classification */
  readonly documentType: string
  /** Full text content of the document (realistic, clinical-grade) */
  readonly content: string
  /** Description for DB metadata */
  readonly description: string
}

// ---------------------------------------------------------------------------
// Test scores
// ---------------------------------------------------------------------------

export interface ScoreEntry {
  readonly scaleName: string
  readonly rawScore?: number
  readonly tScore?: number
  readonly percentile?: number
  readonly scaledScore?: number
  readonly interpretation?: string
  readonly isElevated?: boolean
}

export interface TestScoreFixture {
  readonly instrumentName: string
  readonly instrumentAbbrev: string
  readonly administrationDate: string
  readonly dataEntryMethod: 'manual' | 'pdf_extraction'
  readonly scores: readonly ScoreEntry[]
  readonly validityScores?: readonly ScoreEntry[]
  readonly clinicalNarrative?: string
  readonly notes?: string
}

// ---------------------------------------------------------------------------
// Diagnostic decisions
// ---------------------------------------------------------------------------

export interface DiagnosticDecisionFixture {
  readonly diagnosisKey: string
  readonly icdCode: string
  readonly diagnosisName: string
  readonly decision: 'render' | 'rule_out' | 'defer'
  readonly clinicianNotes?: string
}

// ---------------------------------------------------------------------------
// Clinical formulation
// ---------------------------------------------------------------------------

export interface ClinicalFormulationFixture {
  readonly formulation: string
}

// ---------------------------------------------------------------------------
// Agent result stubs (for bypassing real API calls in testing)
// ---------------------------------------------------------------------------

export interface AgentResultStub {
  readonly agentType: 'ingestor' | 'diagnostician' | 'writer' | 'editor'
  readonly resultJson: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Data confirmation
// ---------------------------------------------------------------------------

export interface DataConfirmationFixture {
  readonly categoryId: string
  readonly status: 'confirmed' | 'corrected' | 'flagged'
  readonly notes?: string
}

// ---------------------------------------------------------------------------
// Pipeline step - one atomic action in the case lifecycle
// ---------------------------------------------------------------------------

export type StepAction =
  | { readonly type: 'create_case' }
  | { readonly type: 'save_intake' }
  | { readonly type: 'ingest_document'; readonly documentIndex: number }
  | { readonly type: 'confirm_data'; readonly confirmationIndex: number }
  | { readonly type: 'advance_stage' }
  | { readonly type: 'force_stage'; readonly stage: PipelineStage }
  | { readonly type: 'save_scores'; readonly scoreIndex: number }
  | { readonly type: 'save_decision'; readonly decisionIndex: number }
  | { readonly type: 'save_formulation' }
  | { readonly type: 'inject_agent_result'; readonly agentResultIndex: number }
  | { readonly type: 'attest_report' }
  | { readonly type: 'screenshot'; readonly label: string }

export interface PipelineStep {
  /** Human-readable description for logging */
  readonly description: string
  /** The action to execute */
  readonly action: StepAction
  /** Expected pipeline stage AFTER this step */
  readonly expectedStage?: PipelineStage
  /** Expected case_status AFTER this step */
  readonly expectedStatus?: string
  /** If true, this step should fail (for negative testing) */
  readonly expectFailure?: boolean
  /** Tags for filtering (e.g., 'screenshot', 'verification') */
  readonly tags?: readonly string[]
}

// ---------------------------------------------------------------------------
// Full manifest
// ---------------------------------------------------------------------------

export interface TestCaseManifest {
  /** Unique identifier for this test case */
  readonly id: string
  /** Human-readable name */
  readonly name: string
  /** Description of what this case tests */
  readonly description: string
  /** Target stop-point (null = run to completion) */
  readonly stopAtStage: PipelineStage | null
  /** Case definition */
  readonly caseDefinition: CaseDefinition
  /** Intake form data */
  readonly intake: IntakeDefinition
  /** All documents to be ingested */
  readonly documents: readonly DocumentFixture[]
  /** Test score records */
  readonly scores: readonly TestScoreFixture[]
  /** Diagnostic decisions */
  readonly decisions: readonly DiagnosticDecisionFixture[]
  /** Clinical formulation */
  readonly formulation: ClinicalFormulationFixture | null
  /** Agent result stubs */
  readonly agentResults: readonly AgentResultStub[]
  /** Data confirmation entries */
  readonly dataConfirmations: readonly DataConfirmationFixture[]
  /** Ordered pipeline steps */
  readonly steps: readonly PipelineStep[]
}
