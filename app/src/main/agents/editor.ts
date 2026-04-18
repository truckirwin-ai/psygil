/**
 * Psygil Editor/Legal Reviewer Agent (Agent 4)
 *
 * Reviews draft reports with a critical eye,flagging legal vulnerabilities,
 * factual inconsistencies, quality issues, and diagnostic overreach.
 *
 * Pipeline:
 *   1. Load the latest writer result (draft report) for a case
 *   2. Load case metadata, ingestor result, and Gate 2 decisions for context
 *   3. Build editor input payload per spec (doc 03)
 *   4. runAgent(), PII redact → Claude (Editor system prompt) → rehydrate
 *   5. Save structured result to agent_results table
 *   6. Return result to caller
 *
 * CRITICAL PRINCIPLE: The Editor is adversarial. It flags problems without
 * directly editing the draft. The clinician makes all final decisions.
 */

import { getSqlite } from '../db/connection'
import { getCaseById, getIntake } from '../cases'
import { runAgent, type AgentConfig, type AgentResult } from './runner'
import { getLatestIngestorResult } from './ingestor'

// ---------------------------------------------------------------------------
// Editor system prompt, from docs/engineering/03_agent_prompt_specs.md
// ---------------------------------------------------------------------------

const EDITOR_SYSTEM_PROMPT = `You are the Editor/Legal Reviewer Agent for Psygil, an AI tool for forensic and clinical psychologists. Your role is to review draft reports with a critical eye,flagging vulnerabilities, inconsistencies, and quality issues that could undermine credibility or legal defensibility.

CRITICAL PRINCIPLE: You are adversarial. You flag problems. You do not edit directly; you annotate and suggest fixes.

YOUR INPUTS:
- Draft report (from Writer Agent): sections array with prose content
- Confirmed case record: structured data that serves as ground truth
- Clinician's Gate 2 decisions: diagnoses selected and ruled out
- Evaluation type and jurisdiction (to assess legal standards)

YOUR REVIEW ROLE:
You read the draft report as if you were cross-examining the evaluation in court, or as a peer reviewer assessing scientific and clinical rigor. You look for:

1. SPECULATIVE LANGUAGE
   Flags when the report uses hedging, speculation, or unfounded assumptions
   Examples:
   - "The patient may have experienced trauma in childhood" (no evidence)
   - "Symptoms possibly indicate bipolar disorder" (not clinician's diagnosis)
   - "It is likely that the patient has..." (unfounded inference)
   Action: Suggest precise language grounded in evidence or remove speculation

2. UNSUPPORTED CONCLUSIONS
   Flags when claims are made without citing supporting evidence
   Examples:
   - "The patient demonstrates poor insight" (not documented in observations or tests)
   - "Family history suggests genetic predisposition" (no family psychiatric history in record)
   - "The patient is at high risk for violence" (no risk assessment instrument administered)
   Action: Cite the supporting evidence or revise/remove

3. LEGAL VULNERABILITIES
   Flags statements that could be challenged on Daubert/Frye grounds or that misstate legal standards
   Examples:
   - "The defendant is competent to stand trial" (clinician should not state legal conclusion)
   - "This patient is a danger to self and others" (overstated without specific evidence)
   - "The defendant was insane at the time of the offense" (legal conclusion, not clinical finding)
   - Report uses outdated psychological instruments or theory not accepted in jurisdiction
   Action: Reframe as clinical findings; remove legal conclusions; suggest appropriate framing

4. FACTUAL INCONSISTENCY
   Flags when report statements contradict case record or prior statements in report
   Examples:
   - Report states "Patient has no history of psychiatric treatment" but collateral record documents prior hospitalization
   - Report states "MMPI-3 validity is acceptable" but VRIN-T is elevated
   - Report says "Patient denies hearing voices" but later states "auditory hallucinations reported"
   Action: Identify the contradiction and suggest reconciliation

5. DAUBERT/FRYE RISK
   Flags use of unreliable instruments, methods, or interpretations
   Examples:
   - Graphology analysis (not scientifically valid)
   - Interpretation of MMPI scores outside publisher's guidelines
   - Claim of "repressed memory" recovery (controversial, not standard practice)
   - Use of projective instruments (TAT, Rorschach) for diagnosis without full protocols
   Action: Suggest removal or qualification with disclaimer

6. OVERSTATEMENT
   Flags language that exaggerates findings or conclusions
   Examples:
   - "Patient is completely unable to care for self" (but description shows some functioning)
   - "Clearly demonstrates severe psychosis" (descriptors do not match actual content)
   - "Absolutely no capacity for rational thought" (absolute language without nuance)
   Action: Suggest more measured, precise language

7. MISSING CAVEAT
   Flags when important limitations, confounds, or alternative explanations are not mentioned
   Examples:
   - Report interprets depression scores but does not note that medical condition (thyroid disorder) was not ruled out
   - Report makes cognitive conclusions without noting patient was on sedating medication
   - Behavioral observations from transcript not flagged as such
   - Report does not note missing collateral records that would strengthen conclusions
   Action: Suggest adding caveat or limitation

8. SOURCE MISMATCH
   Flags when evidence cited does not actually support the claim, or source is misattributed
   Examples:
   - Citation to test score that was not administered
   - Paraphrase of collateral record that contradicts actual wording
   - Attribution to "patient reported" when source was clinician inference
   Action: Identify correct source or revise claim

9. DIAGNOSTIC OVERREACH
   Flags when report states diagnoses or conclusions that differ from or exceed what clinician selected at Gate 2
   CRITICAL: This ensures Writer Agent did not editorialize the diagnostic section.
   Examples:
   - Clinician selected only MDD at Gate 2; report suggests GAD as comorbidity without clinician decision
   - Clinician ruled out Bipolar II; report says "cannot definitively rule out bipolar features"
   - Clinician did not select any personality disorder; report contains extensive formulation of personality pathology
   Action: Flag and ask clinician to confirm diagnosis or revise report

REVIEW PROCESS:

1. Compare each clinical claim in report to case record evidence
2. Check that every diagnosis mentioned was explicitly selected (or ruled out with explanation) at Gate 2
3. Verify that test scores and classifications cited match what was in test administration records
4. Verify that behavioral observations labeled "transcript-derived" are actually from transcripts
5. Verify that collateral facts cited actually appear in collateral_summary
6. Scan for hedging language (may, might, possibly, perhaps, appears to, seems, likely, suggests, etc.) and assess if warranted by evidence
7. Check for absolute language (never, always, completely, totally, absolutely) and assess if supported
8. Identify missing data (e.g., "patient states no psychiatric history" when no treatment history was documented) and flag as potential gap
9. For forensic reports: Verify that legal standards are correctly stated and that clinician has not made legal conclusions
10. For risk assessment: Verify that risk factors are cited from validated instruments or case evidence, not clinician speculation
11. Check that any cautions about validity, missing data, or alternative explanations are clearly stated

FLAG SEVERITY LEVELS:

- CRITICAL: Error that could undermine entire report or expose clinician to legal challenge
  Examples: Fundamental factual error, legal conclusion stated, instrument misused
- HIGH: Significant quality or accuracy issue requiring revision
  Examples: Unsupported major conclusion, major contradiction, missing critical caveat
- MEDIUM: Quality issue that should be addressed
  Examples: Speculative language, minor inconsistency, hedging without basis
- LOW: Minor issue or improvement suggestion
  Examples: Tone, clarity, organizational suggestion

OUTPUT FORMAT:
Return JSON object with review_summary, annotations array, and revision_priorities array.

TONE:
Professional, objective, constructive. Your suggestions are for improvement and legal protection, not criticism.`

// ---------------------------------------------------------------------------
// Editor output type (matches doc 03 output schema)
// ---------------------------------------------------------------------------

export interface EditorAnnotation {
  readonly flag_id: string
  readonly location: {
    readonly section_name: string
    readonly paragraph_reference?: string
    readonly sentence_or_quote?: string
  }
  readonly flag_type:
    | 'speculative_language'
    | 'unsupported_conclusion'
    | 'legal_vulnerability'
    | 'factual_inconsistency'
    | 'daubert_frye_risk'
    | 'overstatement'
    | 'missing_caveat'
    | 'source_mismatch'
    | 'diagnostic_overreach'
  readonly severity: 'critical' | 'high' | 'medium' | 'low'
  readonly description: string
  readonly suggestion: string
  readonly source_reference?: string
  readonly impact?: 'credibility' | 'legal_defensibility' | 'accuracy' | 'clarity'
}

export interface EditorRevisionPriority {
  readonly priority_order: number
  readonly section: string
  readonly key_issues: readonly string[]
}

export interface EditorOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string
  readonly review_summary: {
    readonly total_flags: number
    readonly critical_flags: number
    readonly high_flags: number
    readonly medium_flags: number
    readonly low_flags: number
    readonly overall_assessment: 'ready_for_clinician_review' | 'requires_revision' | 'requires_major_revision'
  }
  readonly annotations: readonly EditorAnnotation[]
  readonly revision_priorities?: readonly EditorRevisionPriority[]
}

// ---------------------------------------------------------------------------
// Public: Run the Editor Agent for a case
// ---------------------------------------------------------------------------

/**
 * Run the Editor/Legal Reviewer Agent for the given case.
 *
 * Loads the latest writer result (draft report) and reviews it against
 * the case record and clinician's Gate 2 decisions, flagging problems
 * with legal defensibility, factual accuracy, and diagnostic overreach.
 *
 * @param caseId - The case to review
 * @returns AgentResult with EditorOutput as the annotation set
 */
export async function runEditorAgent(caseId: number): Promise<AgentResult<EditorOutput>> {
  // 1. Load case metadata
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    return {
      status: 'error',
      agentType: 'editor',
      caseId,
      operationId: '',
      error: `Case ${caseId} not found`,
      durationMs: 0,
    }
  }

  // 2. Load latest writer result (draft report)
  const draftReport = getLatestWriterResult(caseId)
  if (!draftReport) {
    return {
      status: 'error',
      agentType: 'editor',
      caseId,
      operationId: '',
      error: 'No draft report found. Run Writer Agent before Editor Agent.',
      durationMs: 0,
    }
  }

  // 3. Load case record from ingestor result
  const ingestorResult = getLatestIngestorResult(caseId)
  if (!ingestorResult) {
    return {
      status: 'error',
      agentType: 'editor',
      caseId,
      operationId: '',
      error: 'No ingestor result found. Run Ingestor Agent before Editor Agent.',
      durationMs: 0,
    }
  }

  // 4. Load clinician's Gate 2 decisions (stored with writer result or separately)
  const gate2Decisions = getLatestGate2Decisions(caseId) ?? {}

  // 5. Load intake data for jurisdiction info
  const intake = getIntake(caseId)

  // 6. Retrieve API key
  // API key resolution handled by provider.ts (passthrough or BYOK)

  // 7. Build the editor input payload
  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      draft_report: draftReport,
      case_record: ingestorResult,
      clinician_gate2_decisions: gate2Decisions,
      evaluation_type: caseRow.evaluation_type ?? 'other',
      jurisdiction: intake?.jurisdiction ?? undefined,
    },
    null,
    2,
  )

  // 8. Build agent config
  const config: AgentConfig = {
    agentType: 'editor',
    systemPrompt: EDITOR_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 20000, // Editor output can include many annotations
    temperature: 0,
  }

  // 9. Run through the generic agent runner (redact → Claude → rehydrate → destroy)
  const result = await runAgent<EditorOutput>(null, config)

  // 10. If successful, persist the result to the DB
  if (result.status === 'success' && result.result) {
    try {
      saveEditorResult(caseId, result.operationId, result.result)
    } catch (e) {
      console.error('[editor] Failed to save result to DB:', (e as Error).message)
      // Don't fail the whole operation, the result is still returned
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Persistence, save editor output to the DB
// ---------------------------------------------------------------------------

/**
 * Save the editor's review output to the agent_results table.
 */
function saveEditorResult(caseId: number, operationId: string, output: EditorOutput): void {
  const sqlite = getSqlite()

  // Check if agent_results table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>

  if (tables.length === 0) {
    // Create the table if it doesn't exist yet
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'psychometrician', 'diagnostician', 'writer', 'editor')),
        operation_id TEXT NOT NULL,
        result_json TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(case_id, agent_type, operation_id)
      )
    `)
    sqlite.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_results_case
        ON agent_results(case_id, agent_type)
    `)
  }

  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'editor', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? '1.0')
}

// ---------------------------------------------------------------------------
// Public: Retrieve the latest editor result for a case
// ---------------------------------------------------------------------------

/**
 * Get the most recent editor review result for a case.
 * Returns null if the editor hasn't been run yet.
 */
export function getLatestEditorResult(caseId: number): EditorOutput | null {
  const sqlite = getSqlite()

  // Check if table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return null

  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'editor'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId) as { result_json: string } | undefined

  if (!row) return null

  try {
    return JSON.parse(row.result_json) as EditorOutput
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Internal helpers, retrieve writer result and Gate 2 decisions
// ---------------------------------------------------------------------------

/**
 * Get the latest writer result (draft report) for a case.
 * This is what the editor reviews.
 */
function getLatestWriterResult(caseId: number): Record<string, unknown> | null {
  const sqlite = getSqlite()

  // Check if table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return null

  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'writer'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId) as { result_json: string } | undefined

  if (!row) return null

  try {
    return JSON.parse(row.result_json) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Get the latest Gate 2 decisions for a case.
 * These are stored with the writer result or in a dedicated table.
 * For now, we try to extract them from the writer result or return empty.
 */
function getLatestGate2Decisions(caseId: number): Record<string, unknown> | null {
  // TODO: This would be stored either with the writer result or in a dedicated gate2_decisions table
  // For now, return null and let the editor work with what it can from the draft report
  return null
}
