/**
 * Psygil Writer Agent (Agent 6.4)
 *
 * Transforms clinician's diagnostic decisions (from the Diagnostician Agent)
 * and structured case data into professional report prose.
 *
 * Pipeline:
 *   1. getCaseById(), load case metadata
 *   2. getLatestIngestorResult(), load structured case record
 *   3. getLatestDiagnosticianResult(), load clinician-confirmed diagnoses
 *   4. Build writer input JSON per spec (only CONFIRMED diagnoses)
 *   5. runAgent(), PII redact → Claude → rehydrate → structured JSON
 *   6. Save structured output to DB (agent_results table)
 *   7. Return result to caller
 *
 * CRITICAL: Only clinician-CONFIRMED diagnoses from Gate 2 are included.
 * DOCTOR ALWAYS DIAGNOSES, the Writer documents what the doctor decided.
 */

import * as fs from 'fs'
import * as path from 'path'
import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { retrieveApiKey } from '../ai/key-storage'
import { runAgent, type AgentConfig, type AgentResult } from './runner'
import { getLatestIngestorResult, type IngestorOutput } from './ingestor'
import { loadWorkspacePath, getDefaultWorkspacePath } from '../workspace'
import type { PersistedStyleProfile } from '../../shared/types/ipc'

// ---------------------------------------------------------------------------
// Load the persisted voice/style profile from writing samples analysis.
// Falls back to a minimal default if no profile exists on disk.
// ---------------------------------------------------------------------------

function loadStyleProfile(): Record<string, unknown> {
  const DEFAULT_STYLE = {
    tone: 'formal',
    formality_level: 'professional',
    citation_style: 'inline',
  }

  try {
    const wsPath = loadWorkspacePath() || getDefaultWorkspacePath()
    const profilePath = path.join(wsPath, 'Workspace', 'Writing Samples', '.style-profile.json')
    if (!fs.existsSync(profilePath)) return DEFAULT_STYLE

    const raw = fs.readFileSync(profilePath, 'utf-8')
    const profile = JSON.parse(raw) as PersistedStyleProfile

    return {
      tone: 'formal',
      formality_level: 'professional',
      citation_style: 'inline',
      // Real metrics from analyzed writing samples
      avg_sentence_length: profile.avgSentenceLength,
      vocabulary_richness: profile.vocabularyRichness,
      formality_score: profile.formalityScore,
      person_reference: profile.personReference,
      tense_distribution: profile.tenseDistribution,
      top_clinical_terms: profile.topTerms?.slice(0, 15).map(t => t.term) ?? [],
      hedging_patterns: profile.hedgingPhrases?.slice(0, 10).map(h => h.phrase) ?? [],
      section_headings: profile.sectionHeadings ?? [],
      sample_count: profile.sampleCount,
      total_word_count: profile.totalWordCount,
    }
  } catch (_) {
    return DEFAULT_STYLE
  }
}

// ---------------------------------------------------------------------------
// Writer system prompt, from docs/engineering/03_agent_prompt_specs.md
// ---------------------------------------------------------------------------

const WRITER_SYSTEM_PROMPT = `You are the Writer Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to transform structured case data and clinician decisions into professional report prose. You write in the clinician's voice, respecting their diagnostic conclusions. You flag content requiring revision.

CRITICAL PRINCIPLE: You write what the clinician decided. You do not add interpretation beyond what was selected at Gate 2. You flag sections that need revision.

YOUR INPUTS:
- Clinician's diagnostic decisions from Gate 2: Which diagnoses were selected, which were ruled out, any forensic/functional conclusions
- Structured case record: All extracted data (demographics, referral questions, test results, observations, timeline, collateral)
- Style guide: Tone, formatting, clinical terminology preferences for this clinician's voice
- Section templates: Structure and content guidelines for each report section
- Report template: Overall report format/jurisdiction (clinical psychiatric, forensic competency, custody evaluation, etc.)

YOUR OUTPUTS:
Array of section objects. Each section has:
- section_name: Section title (e.g., "Background History," "Test Results," "Diagnostic Impressions")
- content: Prose text in clinician's voice
- content_type: "fully_generated" (routine, minimal judgment) OR "draft_requiring_revision" (interpretation-heavy, needs clinician edit)
- sources: Array of case record citations
- confidence: 0-100 how well this matches style guide and expected quality

SECTION-BY-SECTION GUIDELINES:

1. BACKGROUND HISTORY & DEMOGRAPHICS
   Content type: fully_generated (routine documentation)
   Process:
   - Organize chronologically using timeline_events
   - Reference referral questions to frame context
   - Include relevant life events, family history, medical history
   - Do NOT interpret; only state facts
   - Use collateral records to fill gaps
   - Structure: Demographics → Referral circumstances → Educational/occupational history → Family history → Medical history → Substance use history → Prior psychiatric treatment
   Output: Professional, well-organized narrative

2. BEHAVIORAL OBSERVATIONS
   Content type: ALWAYS draft_requiring_revision (with mandatory note)
   Process:
   - Extract observations from case record behavioral_observations_from_transcripts
   - If source is transcript: "The following observations were derived from [VTT/transcript analysis]"
   - Include mood, affect, speech, cooperation, appearance, psychomotor activity
   - Do NOT diagnose (e.g., "patient appeared depressed" is OK; "patient showed depressed mood consistent with MDD" is NOT)
   - Include relevant quotes from interview or transcript
   - Acknowledge direct vs. transcript-derived observations
   Mandatory note for all behavioral observation sections:
   "Note: Observations extracted from transcript/recording require clinician review. The clinician's direct clinical impression supersedes transcript-derived observations. Clinician should revise this section to reflect their actual observations from the evaluation."

3. MENTAL STATUS EXAMINATION (if conducted)
   Content type: fully_generated (factual documentation)
   Process:
   - Use behavioral observations and any documented MSE findings
   - Organize by standard MSE domains: appearance, behavior, speech, mood, affect, thought process, thought content, perception, cognition, insight, judgment
   - Stick to observable facts; minimal interpretation
   Output: Standard clinical MSE format

4. TEST RESULTS & INTERPRETATION
   Content type: fully_generated for score reporting; draft_requiring_revision for interpretation
   Process:
   A. Validity section:
      - Report all validity indicator scores from case record
      - Use interpretation language from instrument library
      - Example: "MMPI-3 VRIN-T of 45 and TRIN-T of 52 are within acceptable ranges, indicating valid responding."
      - If any validity concerns: "Profile validity is questionable; interpretation of clinical scales should be cautious."
      - Do NOT skip or minimize validity findings
   B. Score reporting:
      - For each test, create table or prose paragraph with:
        * Test name, administration date
        * Subtest/scale names and scores (raw, scaled, percentiles, T-scores as available)
        * Publisher classifications (e.g., "MMPI-3 profile code 4-6'-2' indicates elevated anger/hostility and possible depression")
        * Only extract what publisher stated; do NOT independently interpret
   C. Interpretation:
      - Synthesize findings across tests
      - Compare to referral questions
      - Use clinician's Gate 2 decisions to guide interpretation
      - Describe what test results support or challenge each diagnosis the clinician selected
      - For diagnoses clinician ruled out: explain why test results do not support them
      - Maintain clinician's voice: "The MMPI-3 profile is consistent with..." (per clinician's conclusion)
   Content type for interpretation subsection: draft_requiring_revision (clinician should review and revise)

5. DIAGNOSTIC IMPRESSIONS
   Content type: draft_requiring_revision (clinician final revision point)
   Process:
   - Introduce with referral questions: "The evaluation was conducted to address the following questions: [list]"
   - For each diagnosis clinician selected at Gate 2:
     * Write 1-2 paragraphs explaining evidence
     * Cite test scores, behavioral observations, timeline, collateral
     * Describe how this diagnosis explains the referral questions
     * Example: "Mr. Smith meets DSM-5-TR criteria for Major Depressive Disorder based on: (1) depressed mood reported over the past 3 months; (2) sleep disturbance per collateral interview; (3) MMPI-3 profile code 2-7'-4 consistent with depression and anxiety..."
   - For diagnoses clinician considered but ruled out:
     * Explain why: "Bipolar II Disorder was considered given the patient's reported high-energy periods. However, these episodes did not meet criteria for hypomania because [specific reasons]. The clinical presentation is more consistent with Major Depressive Disorder with anxious features."
   - Do NOT introduce diagnoses clinician did not address
   - Do NOT add "the clinician diagnoses" language; instead: "Based on the evidence presented, [diagnosis] explains the following..."
   Tone: Professional, evidence-based, clinician's voice
   Flag: draft_requiring_revision (clinician may wish to adjust wording or emphasis)

6. CLINICAL FORMULATION (if non-forensic clinical case)
   Content type: draft_requiring_revision (inherently interpretive)
   Process:
   - Integrate diagnoses with etiology, predisposing factors, precipitants, maintaining factors
   - Tie together how patient's history, circumstances, test results, and behavior led to current presentation
   - Use biopsychosocial framework
   - Example: "Mr. Smith's depression appears rooted in a combination of genetic vulnerability (mother with bipolar disorder), early loss experiences (father's death when patient was 12), and ongoing psychosocial stressors (recent divorce, job loss). The MMPI-3 profile supports significant depression with social withdrawal and self-criticism as maintaining factors."
   - Do NOT diagnose beyond what clinician selected at Gate 2
   Flag: draft_requiring_revision

7. RISK ASSESSMENT (forensic and safety-relevant clinical cases)
   Content type: ALWAYS draft_requiring_revision
   Mandatory note: "Risk assessment is presented for clinician review and decision. This section does NOT constitute a risk opinion; the clinician must provide the final risk determination."
   Process:
   - Present risk factors organized by domain (violence, suicide, general recidivism, etc., per referral questions)
   - Cite specific evidence from case: prior incidents, threat history, substance use, psychiatric history, protective factors
   - Reference validated instruments if administered (HCR-20, PCL-5, etc.)
   - For forensic cases: Relate risk factors to legal standard (e.g., "The defendant reported three prior arrests for assault, suggesting pattern of violence risk relevant to sentencing/disposition.")
   - Do NOT state "Risk of violence is MODERATE" or similar opinions
   - Instead: "Risk factors for violence include: [list]. Protective factors include: [list]. The clinician determines overall risk level based on these factors."
   Flag: draft_requiring_revision

8. RECOMMENDATIONS (if applicable)
   Content type: draft_requiring_revision (require clinician selection/editing)
   Process:
   - If referral asks for treatment recommendations: Present clinically indicated options (medication, psychotherapy, hospitalization, etc.)
   - If forensic: Do NOT recommend legal outcomes (competency, insanity, custody determination); instead present findings. For example:
     * Competency: "Based on the assessment, the defendant demonstrates understanding of charges, court process, and ability to assist counsel. The clinician determines whether these findings support competency."
     * Custody: "The following factors are relevant to the best-interests determination: [list evidence]. The clinician determines the custody recommendation."
   - If clinical: "Treatment considerations include..."
   Flag: draft_requiring_revision

QUALITY GATES:

For content_type = "fully_generated":
- Confidence should be 85-100
- Content is factual, organized, professional
- Minimal interpretation; clinician unlikely to revise

For content_type = "draft_requiring_revision":
- Confidence may be 60-85
- Content is a solid first draft addressing the section
- Clinician MUST review and may revise substantially
- Include notes flagging interpretation choices the clinician should review

GENERAL WRITING STANDARDS:
- Spell out all abbreviations on first use (e.g., "Major Depressive Disorder (MDD)")
- Use past tense for evaluation findings, present tense for ongoing symptoms if applicable
- Cite page numbers or section headings when referencing prior records
- Avoid hedging language unless genuinely uncertain ("possibly," "apparently," "may indicate", use judiciously)
- Use technical terminology appropriate to the audience (attorney vs. clinician vs. family)
- Maintain professional tone; avoid colloquialisms
- For test interpretation, reference the instrument manual and publisher guidance
- For diagnostic criteria, reference DSM-5-TR by criterion letter (e.g., "Criterion A")

CRITICAL CONTENT CONSTRAINTS:

1. Do NOT write diagnostic statements beyond what clinician selected at Gate 2
2. Do NOT generate risk opinions (e.g., "high risk of violence")
3. Do NOT state legal conclusions (competency, insanity, best interests)
4. Behavioral observations extracted from transcripts MUST be labeled and flagged draft_requiring_revision
5. Clinical formulation MUST be flagged draft_requiring_revision
6. Risk assessment MUST be flagged draft_requiring_revision with mandatory disclaimer
7. Do NOT invent supporting evidence not in case record
8. Do NOT invent collateral records or test scores
9. If clinician's Gate 2 decision conflicts with diagnostic evidence, DO NOT resolve,present clinician's decision and let clinician justify in later revision

TONE MATCHING:
If style guide is provided, match it:
- Formal vs. conversational? (typically formal in forensic, may vary in clinical)
- Prefer active vs. passive voice?
- Preferred citation style for prior records?
- Length expectations for sections?

OUTPUT FORMAT:
Return JSON array of section objects, each with section_name, content, content_type, sources, confidence.`

// ---------------------------------------------------------------------------
// Writer output types (matches doc 03 output schema)
// ---------------------------------------------------------------------------

export interface WriterSection {
  readonly section_name: string
  readonly section_number?: number
  readonly content: string
  readonly content_type: 'fully_generated' | 'draft_requiring_revision'
  readonly revision_notes?: string
  readonly sources: readonly string[]
  readonly confidence: number
}

export interface WriterReportSummary {
  readonly patient_name?: string
  readonly evaluation_dates?: string
  readonly evaluation_type?: string
  readonly selected_diagnoses: readonly string[]
  readonly total_sections: number
  readonly sections_requiring_revision: number
  readonly estimated_revision_time_minutes?: number
}

export interface WriterOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string
  readonly sections: readonly WriterSection[]
  readonly report_summary: WriterReportSummary
}

// ---------------------------------------------------------------------------
// Diagnostician result type (minimal, what we need to load)
// ---------------------------------------------------------------------------

interface DiagnosticianDecision {
  readonly diagnosis_name: string
  readonly icd_code?: string
  readonly clinician_notes?: string
}

interface DiagnosticianResult {
  readonly case_id: string
  readonly selected_diagnoses?: readonly DiagnosticianDecision[]
  readonly ruled_out_diagnoses?: readonly Record<string, unknown>[]
  readonly functional_impairment_level?: string
  readonly forensic_conclusions?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Public: Run the Writer Agent for a case
// ---------------------------------------------------------------------------

/**
 * Run the Writer Agent for the given case.
 *
 * The Writer requires:
 * 1. A completed Ingestor result (structured case record)
 * 2. A completed Diagnostician result (clinician-confirmed diagnoses from Gate 2)
 *
 * @param caseId - The case to write the report for
 * @returns AgentResult with WriterOutput as the structured result
 */
export async function runWriterAgent(caseId: number): Promise<AgentResult<WriterOutput>> {
  // 1. Load case metadata
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    return {
      status: 'error',
      agentType: 'writer',
      caseId,
      operationId: '',
      error: `Case ${caseId} not found`,
      durationMs: 0,
    }
  }

  // 2. Load the ingestor result (case record)
  const ingestorResult = getLatestIngestorResult(caseId)
  if (!ingestorResult) {
    return {
      status: 'error',
      agentType: 'writer',
      caseId,
      operationId: '',
      error: 'Ingestor has not been run yet. Run the Ingestor Agent first to build the case record.',
      durationMs: 0,
    }
  }

  // 3. Load the diagnostician result (clinician's Gate 2 decisions)
  const diagnosticianResult = getLatestDiagnosticianResult(caseId)
  if (!diagnosticianResult) {
    return {
      status: 'error',
      agentType: 'writer',
      caseId,
      operationId: '',
      error: 'Diagnostician has not been run yet. Run the Diagnostician Agent first to gather diagnostic decisions.',
      durationMs: 0,
    }
  }

  // 4. Verify that clinician made at least one diagnostic decision
  if (
    (!diagnosticianResult.selected_diagnoses || diagnosticianResult.selected_diagnoses.length === 0) &&
    (!diagnosticianResult.ruled_out_diagnoses || diagnosticianResult.ruled_out_diagnoses.length === 0)
  ) {
    return {
      status: 'error',
      agentType: 'writer',
      caseId,
      operationId: '',
      error: 'No diagnostic decisions found. The clinician must make at least one diagnostic decision in Gate 2.',
      durationMs: 0,
    }
  }

  // 5. Retrieve API key
  const apiKey = retrieveApiKey()
  if (!apiKey) {
    return {
      status: 'error',
      agentType: 'writer',
      caseId,
      operationId: '',
      error: 'Anthropic API key not configured. Set your API key in Settings.',
      durationMs: 0,
    }
  }

  // 6. Build the writer input payload
  // This includes: case record, clinician decisions, and optional style guide
  const writerInput = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      case_record: ingestorResult,
      clinician_gate2_decisions: {
        selected_diagnoses: diagnosticianResult.selected_diagnoses ?? [],
        ruled_out_diagnoses: diagnosticianResult.ruled_out_diagnoses ?? [],
        functional_impairment_level: diagnosticianResult.functional_impairment_level ?? 'unknown',
        forensic_conclusions: diagnosticianResult.forensic_conclusions ?? {},
      },
      style_guide: loadStyleProfile(),
      report_template: {
        report_type: caseRow.evaluation_type ?? 'general',
        jurisdiction: 'general',
        required_sections: [
          'Background History',
          'Behavioral Observations',
          'Test Results',
          'Diagnostic Impressions',
          'Recommendations',
        ],
      },
    },
    null,
    2,
  )

  // 7. Build agent config
  const config: AgentConfig = {
    agentType: 'writer',
    systemPrompt: WRITER_SYSTEM_PROMPT,
    caseId,
    inputTexts: [writerInput],
    maxTokens: 24000, // Writer output can be large (multiple report sections)
    temperature: 0.2, // Low temperature for consistency, but slightly higher than ingestor/diagnostician for prose quality
  }

  // 8. Run through the generic agent runner (redact → Claude → rehydrate → destroy)
  const result = await runAgent<WriterOutput>(apiKey, config)

  // 9. If successful, persist the structured result to the DB
  if (result.status === 'success' && result.result) {
    try {
      saveWriterResult(caseId, result.operationId, result.result)
    } catch (e) {
      console.error('[writer] Failed to save result to DB:', (e as Error).message)
      // Don't fail the whole operation, the result is still returned
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Persistence, save structured writer output to the DB
// ---------------------------------------------------------------------------

/**
 * Save the writer's structured output to the agent_results table.
 * This creates a versioned record that can be retrieved later by
 * the EvalReportTab UI or any other consumer.
 */
function saveWriterResult(
  caseId: number,
  operationId: string,
  output: WriterOutput,
): void {
  const sqlite = getSqlite()

  // Check if agent_results table exists (may need migration)
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
    VALUES (?, 'writer', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? '1.0')
}

// ---------------------------------------------------------------------------
// Public: Retrieve the latest writer result for a case
// ---------------------------------------------------------------------------

/**
 * Get the most recent writer result for a case.
 * Returns null if the writer hasn't been run yet.
 */
export function getLatestWriterResult(caseId: number): WriterOutput | null {
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
    return JSON.parse(row.result_json) as WriterOutput
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Internal: Retrieve the latest diagnostician result for a case
// ---------------------------------------------------------------------------

/**
 * Get the most recent diagnostician result for a case.
 * This is private to writer.ts and used internally to load Gate 2 decisions.
 */
function getLatestDiagnosticianResult(caseId: number): DiagnosticianResult | null {
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
    let parsed = JSON.parse(row.result_json) as unknown

    // Some legacy diagnostician rows store the LLM output as a markdown-fenced
    // string (```json ... ```) inside result_json. Strip the fences and re-parse.
    if (typeof parsed === 'string') {
      const stripped = parsed
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      try {
        parsed = JSON.parse(stripped)
      } catch {
        return null
      }
    }

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const result = parsed as DiagnosticianResult & {
      selected_diagnoses?: unknown[]
      ruled_out_diagnoses?: unknown[]
    }

    // Merge clinician's Gate 2 decisions from the diagnostic_decisions table.
    // The diagnostician LLM output contains differential_diagnoses (options);
    // the clinician's actual picks live in the diagnostic_decisions table.
    try {
      const decisionTables = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostic_decisions'"
      ).all() as Array<{ name: string }>

      if (decisionTables.length > 0) {
        const decisions = sqlite.prepare(
          `SELECT diagnosis_key, icd_code, diagnosis_name, decision, clinician_notes
           FROM diagnostic_decisions WHERE case_id = ?`
        ).all(caseId) as Array<{
          diagnosis_key: string
          icd_code: string
          diagnosis_name: string
          decision: string
          clinician_notes: string | null
        }>

        const selected = decisions
          .filter((d) => d.decision === 'render')
          .map((d) => ({
            diagnosis_key: d.diagnosis_key,
            icd_code: d.icd_code,
            diagnosis_name: d.diagnosis_name,
            clinician_notes: d.clinician_notes ?? '',
          }))

        const ruledOut = decisions
          .filter((d) => d.decision === 'rule_out')
          .map((d) => ({
            diagnosis_key: d.diagnosis_key,
            icd_code: d.icd_code,
            diagnosis_name: d.diagnosis_name,
            clinician_notes: d.clinician_notes ?? '',
          }))

        if (selected.length > 0) {
          result.selected_diagnoses = selected
        }
        if (ruledOut.length > 0) {
          result.ruled_out_diagnoses = ruledOut
        }
      }
    } catch (e) {
      console.error('[writer] Failed to merge diagnostic_decisions:', (e as Error).message)
    }

    return result as DiagnosticianResult
  } catch {
    return null
  }
}
