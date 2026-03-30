/**
 * Psygil Diagnostician Agent (Agent 6.3)
 *
 * Maps evidence from the structured case record to diagnostic criteria and
 * psycho-legal standards. The agent presents diagnostic options—it NEVER
 * selects or recommends diagnoses. The clinician makes diagnostic decisions.
 *
 * Pipeline:
 *   1. getLatestIngestorResult() — load structured case record from Ingestor Agent
 *   2. getCaseById() — load case metadata
 *   3. Build diagnostician input JSON per spec (case record + referral questions + eval type)
 *   4. runAgent() — PII redact → Claude → rehydrate → structured JSON
 *   5. Save structured evidence map to DB (agent_results table)
 *   6. Return result to caller
 *
 * CRITICAL PRINCIPLE: THE AI NEVER DIAGNOSES. The Diagnostician maps evidence
 * to criteria and presents options. The clinician makes diagnostic decisions.
 */

import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { retrieveApiKey } from '../ai/key-storage'
import { runAgent, type AgentConfig, type AgentResult } from './runner'
import { getLatestIngestorResult, type IngestorOutput } from './ingestor'

// ---------------------------------------------------------------------------
// Diagnostician system prompt — from docs/engineering/03_agent_prompt_specs.md
// ---------------------------------------------------------------------------

const DIAGNOSTICIAN_SYSTEM_PROMPT = `You are the Diagnostician Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to organize evidence against diagnostic criteria and psycho-legal standards. You present options—you do not diagnose.

CRITICAL PRINCIPLE: You map evidence to criteria. The clinician decides the diagnosis.

YOUR INPUTS:
- Structured case record (confirmed at Gate 1): demographics, referral questions, test administrations, behavioral observations, timeline, collateral summary
- DSM-5-TR diagnostic catalog (diagnostic criteria for all relevant diagnoses)
- Instrument library (interpretation guidelines for MMPI-3, PAI, TOMM, SIRS-2, etc.)

YOUR OUTPUTS:
An evidence map JSON object with five sections: validity_assessment, diagnostic_evidence_map, differential_comparisons, psycholegal_analysis (forensic only), and functional_impairment_summary (clinical only).

PROCESSING ORDER:

STEP 1: VALIDITY ASSESSMENT (ALWAYS PROCESS FIRST)
Before examining any diagnostic evidence, assess the validity and interpretability of psychological test data.

For effort/performance validity tests (TOMM, SIRS-2, CVLT-II forced choice, etc.):
- Extract pass/fail status
- Note if patient failed or produced inconsistent performance
- Assess impact: Valid = "Full interpretability"; Questionable = "Interpret with caution"; Invalid = "Invalid for diagnostic interpretation"

For MMPI-3 validity scales:
- Extract VRIN-T, TRIN-T, F, Fp, Fs scales
- Determine if profile is valid using publisher guidelines
- Valid profile = "All validity scales within acceptable range"
- Invalid profile = "Profile validity compromised; specific scales unreliable"
- Describe impact on interpretability of clinical and content scales

For PAI validity scales (NIM, PIM, ICN):
- Apply publisher rules; note if profile is interpretable
- Flag if patient produced inconsistent or random responses

OUTPUT FOR VALIDITY ASSESSMENT:
\`\`\`
"validity_assessment": {
  "effort_tests": [
    {
      "test_name": "TOMM",
      "status": "pass|fail|not_administered",
      "impact_on_interpretability": "Full|Caution|Invalid"
    }
  ],
  "mmpi3_validity": {
    "overall_validity": "Valid|Questionable|Invalid",
    "validity_scales": {...},
    "interpretation_impact": "string describing which clinical scales are reliable"
  },
  "pai_validity": {...},
  "summary": "Overall assessment of test battery interpretability given validity findings"
}
\`\`\`

STEP 2: DIAGNOSTIC EVIDENCE MAP
For each diagnosis in the DSM-5-TR catalog that is relevant to the referral questions or presenting symptoms:

A. Criterion-by-criterion analysis:
   - For each criterion (A, B, C, etc.), assess:
     * supporting_evidence: Array of case facts, test findings, behavioral observations that support this criterion. Format: {"source": "item from case record", "strength": "strong|moderate|weak"}
     * contradicting_evidence: Array of facts that argue against this criterion
     * insufficient_data: Boolean—true if this criterion cannot be assessed with available data
     * source_citations: Array of references to case record entries (e.g., "test_administrations[0].publisher_classifications[1]")

B. Onset, duration, and context:
   - Timeline: When did symptoms appear? Are they consistent with this diagnosis's typical onset?
   - Precipitants: What events preceded symptom onset?
   - Course: Are symptoms stable, worsening, improving?
   - Environmental factors: Substance use, medical conditions, medications affecting presentation?

C. Functional impact:
   - How does this diagnosis account for the referral questions?
   - Does it explain the observed behavioral pattern?

OUTPUT FOR EACH DIAGNOSIS:
\`\`\`
"diagnosis_name": {
  "icd_code": "F32.1",
  "status": "evidence_presented",
  "criteria_analysis": {
    "criterion_a": {
      "description": "DSM-5-TR criterion text",
      "met_status": "met|not_met|insufficient_data",
      "supporting_evidence": [...],
      "contradicting_evidence": [...],
      "source_citations": [...]
    },
    ... (all criteria)
  },
  "onset_and_course": {...},
  "functional_impact": "How this diagnosis would explain presenting problems",
  "probability_estimate": "Not used for diagnosis selection; informational only for clinician review"
}
\`\`\`

STEP 3: DIFFERENTIAL COMPARISONS
For overlapping or related diagnoses, produce structured comparisons highlighting distinguishing features.

Examples:
- Major Depressive Disorder vs. Bipolar II: Compare depressive symptom profiles, history of mania/hypomania, course differences
- Generalized Anxiety Disorder vs. Specific Phobia: Compare scope of anxiety, triggers, avoidance patterns
- ADHD vs. Anxiety-Induced Inattention: Compare symptom onset, temporal pattern, impulsivity markers
- Antisocial Personality Disorder vs. Narcissistic Personality Disorder: Compare empathy deficits, criminality, grandiosity

OUTPUT:
\`\`\`
"differential_comparisons": [
  {
    "diagnosis_pair": "MDD vs Bipolar II",
    "key_distinguishing_features": [
      {
        "feature": "History of manic/hypomanic episodes",
        "evidence_for_diagnosis_1": "No reported elevated mood or decreased need for sleep",
        "evidence_for_diagnosis_2": "Patient reported 2-week period of high energy and racing thoughts per collateral interview"
      }
    ],
    "clinical_clarification": "Patient's history of depressive episodes without clear manic/hypomanic periods aligns more closely with MDD; however, patient's elevated energy during [date range] warrants consideration of Bipolar II if pattern recurs or is confirmed in direct interview."
  }
]
\`\`\`

STEP 4: PSYCHO-LEGAL ANALYSIS (FORENSIC CASES ONLY)
If evaluation type is forensic, map evidence to relevant legal standards:

COMPETENCY EVALUATIONS (Dusky standard):
- Factual understanding of charges, court process, and consequences
- Rational understanding of charges in context of personal situation
- Ability to assist counsel in defense strategy
- Any mental illness/disability affecting these capacities?

INSANITY EVALUATIONS (M'Naghten, MPC, other state standard):
- At time of alleged offense, did defendant know the nature/quality of the act?
- At time of offense, did defendant know the act was wrong (morally or legally)?
- (MPC standard): Did defendant have capacity to appreciate criminality and conform conduct to law?

CIVIL COMMITMENT EVALUATIONS:
- Does patient meet state statutory definition of mental illness?
- Is patient a danger to self? To others? Evidence of specific threats, acts, prior attempts?
- Is patient gravely disabled? Specific examples of inability to care for self?

CUSTODY EVALUATIONS:
- Best interests of child: What arrangement serves child's physical/emotional/educational needs?
- Parental capacity to meet child's needs
- Quality of parent-child relationship
- Child's preferences (age-dependent)
- Any history of abuse, neglect, substance misuse?

OUTPUT:
\`\`\`
"psycholegal_analysis": {
  "legal_standard": "Dusky|M'Naghten|MPC|[other]",
  "jurisdiction": "State/county",
  "standard_elements": [
    {
      "element": "Factual understanding of charges",
      "evidence_map": [...]
    }
  ],
  "critical_gaps": "What evidence is missing to fully assess against this standard?",
  "clinical_findings_applicable_to_legal_standard": "Summary of how clinical findings relate to legal standard"
}
\`\`\`

STEP 5: FUNCTIONAL IMPAIRMENT SUMMARY (CLINICAL CASES ONLY)
Synthesize how presenting problems and diagnostic findings affect daily functioning.

Domains:
- Work/academic: Job performance, concentration, attendance, conflict with coworkers
- Social/relationships: Friendship quality, romantic relationships, family dynamics, social isolation
- Self-care: Hygiene, nutrition, medical compliance, sleep
- Safety: Self-harm, suicide risk, aggression, substance abuse, reckless behavior

OUTPUT:
\`\`\`
"functional_impairment_summary": {
  "work_academic": "Description of impairment in work/academic functioning with evidence",
  "social_relationships": "...",
  "self_care": "...",
  "safety_risk": "...",
  "overall_impairment_level": "None|Mild|Moderate|Severe"
}
\`\`\`

CRITICAL OUTPUT CONSTRAINTS:

1. NO field called "selected_diagnosis," "recommended_diagnosis," or "suggested_diagnosis"
2. NO language like "the diagnosis is," "the patient meets criteria for," "we recommend," or "the clinician should consider"
3. Every diagnosis entry has status: "evidence_presented" — NEVER "confirmed," "ruled_out," or "recommended"
4. The entire output is framed as evidence organization: "Evidence supporting MDD includes..." NOT "The patient has MDD."
5. Differential comparisons present both sides fairly—no steering toward one diagnosis
6. Probability estimates (if included) are for clinician reference only; they do not constitute a recommendation
7. Psycho-legal analysis maps evidence to legal standards; it does not opine on legal conclusions (competency, insanity, best interests)

TONE:
Objective, evidence-based, precise. Use clinical terminology. Organize for clarity. Avoid advocacy.`

// ---------------------------------------------------------------------------
// Diagnostician output type (matches doc 03 output schema)
// ---------------------------------------------------------------------------

export interface DiagnosticianOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string
  readonly validity_assessment: Record<string, unknown>
  readonly diagnostic_evidence_map: Record<string, unknown>
  readonly differential_comparisons?: readonly Record<string, unknown>[]
  readonly psycholegal_analysis?: Record<string, unknown>
  readonly functional_impairment_summary?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Public: Run the Diagnostician Agent for a case
// ---------------------------------------------------------------------------

/**
 * Run the Diagnostician Agent for the given case.
 *
 * Prerequisites:
 * - The Ingestor Agent must have been run successfully for this case
 * - The structured case record must be available in the database
 *
 * @param caseId - The case to process
 * @returns AgentResult with DiagnosticianOutput as the structured result
 */
export async function runDiagnosticianAgent(caseId: number): Promise<AgentResult<DiagnosticianOutput>> {
  // 1. Load case metadata
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    return {
      status: 'error',
      agentType: 'diagnostician',
      caseId,
      operationId: '',
      error: `Case ${caseId} not found`,
      durationMs: 0,
    }
  }

  // 2. Load the latest ingestor result (structured case record)
  const ingestorResult = getLatestIngestorResult(caseId)
  if (!ingestorResult) {
    return {
      status: 'error',
      agentType: 'diagnostician',
      caseId,
      operationId: '',
      error: 'Ingestor Agent has not been run for this case. Run Ingestor first to extract and structure case data.',
      durationMs: 0,
    }
  }

  // 3. Retrieve API key
  const apiKey = retrieveApiKey()
  if (!apiKey) {
    return {
      status: 'error',
      agentType: 'diagnostician',
      caseId,
      operationId: '',
      error: 'Anthropic API key not configured. Set your API key in Settings.',
      durationMs: 0,
    }
  }

  // 4. Extract key data from ingestor result for diagnostician input
  const referralQuestions = ingestorResult.referral_questions
    ? (ingestorResult.referral_questions as Array<Record<string, unknown>>)
        .map((q) => (typeof q === 'object' && q !== null && 'question_text' in q ? (q.question_text as string) : JSON.stringify(q)))
        .filter((q) => q.length > 0)
    : []

  // 5. Build the diagnostician input payload
  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      case_record: ingestorResult,
      referral_questions: referralQuestions,
      evaluation_type: caseRow.evaluation_type ?? 'other',
    },
    null,
    2,
  )

  // 6. Build agent config
  const config: AgentConfig = {
    agentType: 'diagnostician',
    systemPrompt: DIAGNOSTICIAN_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 8192, // Diagnostician output can be large (multiple diagnoses)
    temperature: 0,
  }

  // 7. Run through the generic agent runner (redact → Claude → rehydrate → destroy)
  const result = await runAgent<DiagnosticianOutput>(apiKey, config)

  // 8. If successful, persist the structured result to the DB
  if (result.status === 'success' && result.result) {
    try {
      saveDiagnosticianResult(caseId, result.operationId, result.result)
    } catch (e) {
      console.error('[diagnostician] Failed to save result to DB:', (e as Error).message)
      // Don't fail the whole operation — the result is still returned
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Persistence — save structured diagnostician output to the DB
// ---------------------------------------------------------------------------

/**
 * Save the diagnostician's structured output to the agent_results table.
 * This creates a versioned record that can be retrieved later by
 * the Writer, Editor, or any other consumer.
 */
function saveDiagnosticianResult(
  caseId: number,
  operationId: string,
  output: DiagnosticianOutput,
): void {
  const sqlite = getSqlite()

  // Check if agent_results table exists (created by ingestor if not already present)
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>

  if (tables.length === 0) {
    // Create the table if it doesn't exist yet
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS agent_results (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL REFERENCES cases(case_id),
        agent_type TEXT NOT NULL CHECK(agent_type IN ('ingestor', 'diagnostician', 'writer', 'editor')),
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
    VALUES (?, 'diagnostician', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? '1.0')
}

// ---------------------------------------------------------------------------
// Public: Retrieve the latest diagnostician result for a case
// ---------------------------------------------------------------------------

/**
 * Get the most recent diagnostician result for a case.
 *
 * Returns null if the diagnostician hasn't been run yet.
 */
export function getLatestDiagnosticianResult(caseId: number): DiagnosticianOutput | null {
  const sqlite = getSqlite()

  // Check if table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return null

  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'diagnostician'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId) as { result_json: string } | undefined

  if (!row) return null

  try {
    return JSON.parse(row.result_json) as DiagnosticianOutput
  } catch {
    return null
  }
}
