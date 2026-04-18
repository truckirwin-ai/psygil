/**
 * Psygil Psychometrician Agent (Agent 5)
 *
 * Parses scoring reports that already contain T-scores and runs validity
 * protocol cutoffs. Does NOT perform raw scoring from answer sheets (norms
 * are copyrighted). Produces a structured psychometric summary the
 * Diagnostician can cite as evidence.
 *
 * Pipeline:
 *   1. Load case metadata (age, sex, education for normative context)
 *   2. Load test_scores table entries (clinician-entered T-scores)
 *   3. Load Testing/ subfolder documents with indexed_content
 *   4. Run validity protocol cutoffs (deterministic, no LLM)
 *   5. Send structured data to Claude for cross-instrument synthesis
 *   6. Save PsychometricianOutput to agent_results table
 *
 * THE AI NEVER DIAGNOSES. The Psychometrician computes, validates, and
 * synthesizes. The clinician interprets.
 */

import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { listDocuments } from '../documents'
import { runAgent, type AgentConfig, type AgentResult } from './runner'

// ---------------------------------------------------------------------------
// Output types (match docs/engineering/27_Psychometrician_Agent_Spec.md)
// ---------------------------------------------------------------------------

export interface InstrumentResult {
  readonly instrument: string
  readonly administration_date?: string
  readonly form?: string
  readonly validity_scales: Record<string, {
    readonly score: number
    readonly interpretation: string
    readonly elevated: boolean
  }>
  readonly clinical_scales: Record<string, {
    readonly raw?: number
    readonly scaled: number
    readonly interpretation: string
  }>
  readonly profile_interpretation: string
  readonly validity_status: 'valid' | 'questionable' | 'invalid'
}

export interface PsychometricianOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string
  readonly instruments_administered: readonly InstrumentResult[]
  readonly overall_validity: {
    readonly status: 'valid' | 'questionable' | 'invalid'
    readonly concerns: readonly string[]
    readonly summary: string
  }
  readonly clinical_elevations: readonly {
    readonly instrument: string
    readonly scale: string
    readonly score: number
    readonly interpretation: string
    readonly severity: 'mild' | 'moderate' | 'marked' | 'severe'
  }[]
  readonly effort_assessment: {
    readonly tests_administered: readonly string[]
    readonly overall_effort: 'adequate' | 'suboptimal' | 'poor'
    readonly indicators: readonly string[]
  }
}

// ---------------------------------------------------------------------------
// Validity protocol cutoffs (deterministic, no LLM)
// ---------------------------------------------------------------------------

interface ValidityCutoff {
  readonly scale: string
  readonly threshold: number
  readonly direction: 'gte' | 'lte'
  readonly meaning: string
}

const MMPI3_VALIDITY: readonly ValidityCutoff[] = [
  { scale: 'VRIN-r', threshold: 80, direction: 'gte', meaning: 'Random responding' },
  { scale: 'TRIN-r', threshold: 80, direction: 'gte', meaning: 'Fixed responding' },
  { scale: 'F-r', threshold: 100, direction: 'gte', meaning: 'Infrequent responding / over-reporting' },
  { scale: 'Fp-r', threshold: 100, direction: 'gte', meaning: 'Infrequent psychopathology' },
  { scale: 'Fs', threshold: 100, direction: 'gte', meaning: 'Infrequent somatic responding' },
  { scale: 'L-r', threshold: 80, direction: 'gte', meaning: 'Uncommon virtues / under-reporting' },
  { scale: 'K-r', threshold: 80, direction: 'gte', meaning: 'Adjustment validity / defensiveness' },
  { scale: 'RBS', threshold: 100, direction: 'gte', meaning: 'Response Bias Scale elevation' },
  { scale: 'FBS-r', threshold: 100, direction: 'gte', meaning: 'Symptom validity concern' },
]

const PAI_VALIDITY: readonly ValidityCutoff[] = [
  { scale: 'INF', threshold: 75, direction: 'gte', meaning: 'Infrequency / random responding' },
  { scale: 'ICN', threshold: 73, direction: 'gte', meaning: 'Inconsistency' },
  { scale: 'NIM', threshold: 92, direction: 'gte', meaning: 'Negative impression / malingering probable' },
  { scale: 'PIM', threshold: 68, direction: 'gte', meaning: 'Positive impression / under-reporting' },
]

const TOMM_CUTOFF: ValidityCutoff = {
  scale: 'Trial 2',
  threshold: 45,
  direction: 'lte',
  meaning: 'Suboptimal effort',
}

/**
 * Check a single score against a cutoff. Returns true if the score is elevated.
 */
function isElevated(score: number, cutoff: ValidityCutoff): boolean {
  return cutoff.direction === 'gte' ? score >= cutoff.threshold : score < cutoff.threshold
}

/**
 * Run validity checks against a set of named scores for a given instrument.
 * Returns an array of concern strings for any elevated validity indicators.
 */
function checkValidity(
  instrumentName: string,
  scores: Record<string, number>,
  cutoffs: readonly ValidityCutoff[],
): readonly string[] {
  const concerns: string[] = []
  for (const cutoff of cutoffs) {
    const score = scores[cutoff.scale]
    if (score !== undefined && isElevated(score, cutoff)) {
      concerns.push(
        `${instrumentName} ${cutoff.scale} = ${score} (T >= ${cutoff.threshold}): ${cutoff.meaning}`
      )
    }
  }
  return concerns
}

// ---------------------------------------------------------------------------
// System prompt for the LLM interpretation layer
// ---------------------------------------------------------------------------

const PSYCHOMETRICIAN_SYSTEM_PROMPT = `You are the Psychometrician Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to parse scoring reports, validate test protocols, and produce structured psychometric summaries.

CRITICAL PRINCIPLE: You validate and synthesize test data. You do not diagnose. The clinician diagnoses.

YOUR INPUTS:
- Pre-computed T-scores from scoring reports (publisher PDFs parsed by the Ingestor, or clinician-entered scores)
- Validity protocol results (already computed deterministically; you receive them as structured data)
- Case demographics (age, sex, education) for normative context

YOUR TASK:
1. Review the validity indicators provided. Summarize which protocols are valid, questionable, or invalid.
2. Identify clinically significant elevations (T >= 65 for most scales).
3. For each elevated scale, provide a brief clinical interpretation using standard psychometric terminology.
4. Synthesize across instruments: if multiple tests converge on a pattern (e.g., MMPI-3 RC1 + PAI SOM both elevated), note the convergence.
5. Assess overall effort using SVT/PVT results (TOMM, MSVT) if available.

YOU MUST NOT:
- Invent or estimate T-scores. Only interpret scores provided to you.
- Diagnose or suggest diagnoses. State what the scores indicate, not what condition the examinee has.
- Interpret raw scores. You only work with scaled/T-scores from publisher scoring reports.
- Use copyrighted normative tables. All scoring was done by the test publisher or clinician.

SEVERITY CLASSIFICATION:
- mild: T-score 65-74 (1.5-2.4 SD above mean)
- moderate: T-score 75-84 (2.5-3.4 SD above mean)
- marked: T-score 85-99 (3.5-4.9 SD above mean)
- severe: T-score >= 100 (5+ SD above mean)

For cognitive scores (IQ-scaled, M=100, SD=15):
- Flag index discrepancies > 23 points (1.5 SD) as clinically significant

OUTPUT FORMAT:
Return a valid JSON object matching the PsychometricianOutput schema with keys:
  case_id, version, generated_at, instruments_administered,
  overall_validity, clinical_elevations, effort_assessment

TONE: Clinical, precise, objective. Use standard psychometric terminology. No speculation.`

// ---------------------------------------------------------------------------
// Helper: load test scores from the test_scores table
// ---------------------------------------------------------------------------

interface TestScoreRow {
  readonly score_id: number
  readonly case_id: number
  readonly instrument_name: string
  readonly scale_name: string
  readonly score_type: string
  readonly raw_score: number | null
  readonly scaled_score: number | null
  readonly t_score: number | null
  readonly percentile: number | null
  readonly confidence_interval_low: number | null
  readonly confidence_interval_high: number | null
  readonly classification: string | null
  readonly notes: string | null
  readonly administration_date: string | null
}

function loadTestScores(caseId: number): readonly TestScoreRow[] {
  const sqlite = getSqlite()

  // Check if table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='test_scores'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return []

  return sqlite.prepare(
    'SELECT * FROM test_scores WHERE case_id = ? ORDER BY instrument_name, scale_name'
  ).all(caseId) as TestScoreRow[]
}

// ---------------------------------------------------------------------------
// Helper: group test scores by instrument
// ---------------------------------------------------------------------------

interface InstrumentScores {
  readonly instrument: string
  readonly administrationDate: string | null
  readonly scores: Record<string, number>
  readonly rawScores: Record<string, number | null>
  readonly classifications: Record<string, string | null>
}

function groupByInstrument(scores: readonly TestScoreRow[]): readonly InstrumentScores[] {
  const map = new Map<string, {
    instrument: string
    administrationDate: string | null
    scores: Record<string, number>
    rawScores: Record<string, number | null>
    classifications: Record<string, string | null>
  }>()

  for (const row of scores) {
    if (!map.has(row.instrument_name)) {
      map.set(row.instrument_name, {
        instrument: row.instrument_name,
        administrationDate: row.administration_date,
        scores: {},
        rawScores: {},
        classifications: {},
      })
    }
    const group = map.get(row.instrument_name)!
    const tScore = row.t_score ?? row.scaled_score
    if (tScore !== null) {
      group.scores[row.scale_name] = tScore
    }
    group.rawScores[row.scale_name] = row.raw_score
    group.classifications[row.scale_name] = row.classification
  }

  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Public: Run the Psychometrician Agent for a case
// ---------------------------------------------------------------------------

export async function runPsychometricianAgent(caseId: number): Promise<AgentResult<PsychometricianOutput>> {
  // 1. Load case metadata
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    return {
      status: 'error',
      agentType: 'psychometrician',
      caseId,
      operationId: '',
      error: `Case ${caseId} not found`,
      durationMs: 0,
    }
  }

  // 2. Load test scores from the database
  const testScores = loadTestScores(caseId)

  // 3. Load Testing/ subfolder documents for additional context
  const documents = listDocuments(caseId)
  const testingDocs = documents.filter((d) => {
    const path = (d.file_path ?? '').replace(/\\/g, '/')
    const isTestingFolder = path.includes('/Testing/') || path.includes('/testing/')
    const isScoreReport = d.document_type === 'test_report' ||
      d.document_type === 'score_report' ||
      d.document_type === 'test_score_report'
    return (isTestingFolder || isScoreReport) && d.indexed_content
  })

  // If there are no test scores and no testing documents, there's nothing to process
  if (testScores.length === 0 && testingDocs.length === 0) {
    return {
      status: 'error',
      agentType: 'psychometrician',
      caseId,
      operationId: '',
      error: 'No test scores or scoring reports found. Enter scores in the Testing tab or upload scoring reports before running the Psychometrician.',
      durationMs: 0,
    }
  }

  // 4. Retrieve API key
  // API key resolution handled by provider.ts (passthrough or BYOK)

  // 5. Group scores by instrument and run deterministic validity checks
  const instrumentGroups = groupByInstrument(testScores)
  const allValidityConcerns: string[] = []

  for (const group of instrumentGroups) {
    const name = group.instrument.toUpperCase()
    if (name.includes('MMPI')) {
      allValidityConcerns.push(...checkValidity('MMPI-3', group.scores, MMPI3_VALIDITY))
    } else if (name.includes('PAI')) {
      allValidityConcerns.push(...checkValidity('PAI', group.scores, PAI_VALIDITY))
    } else if (name.includes('TOMM')) {
      const trial2 = group.scores['Trial 2'] ?? group.scores['trial_2'] ?? group.scores['Trial2']
      if (trial2 !== undefined && isElevated(trial2, TOMM_CUTOFF)) {
        allValidityConcerns.push(
          `TOMM Trial 2 = ${trial2} (< 45): Suboptimal effort`
        )
      }
      const retention = group.scores['Retention'] ?? group.scores['retention']
      if (retention !== undefined && isElevated(retention, TOMM_CUTOFF)) {
        allValidityConcerns.push(
          `TOMM Retention = ${retention} (< 45): Suboptimal effort`
        )
      }
    }
  }

  // 6. Build the input payload for the LLM interpretation layer
  const scoringDocTexts = testingDocs.map((d) => ({
    document_name: d.original_filename,
    document_type: d.document_type,
    text_content: d.indexed_content!,
  }))

  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      demographics: {
        age: caseRow.examinee_dob ?? 'unknown',
        gender: caseRow.examinee_gender ?? 'unknown',
        evaluation_type: caseRow.evaluation_type ?? 'unknown',
      },
      test_scores_from_database: instrumentGroups.map((g) => ({
        instrument: g.instrument,
        administration_date: g.administrationDate,
        scores: g.scores,
        raw_scores: g.rawScores,
        classifications: g.classifications,
      })),
      scoring_report_documents: scoringDocTexts,
      deterministic_validity_concerns: allValidityConcerns,
    },
    null,
    2,
  )

  // 7. Build agent config
  const config: AgentConfig = {
    agentType: 'psychometrician',
    systemPrompt: PSYCHOMETRICIAN_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 6144,
    temperature: 0,
  }

  // 8. Run through the generic agent runner (redact -> Claude -> rehydrate -> destroy)
  const result = await runAgent<PsychometricianOutput>(null, config)

  // 9. If successful, persist the structured result to the DB
  if (result.status === 'success' && result.result) {
    try {
      savePsychometricianResult(caseId, result.operationId, result.result)
    } catch (e) {
      // Don't fail the whole operation; the result is still returned
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Persistence: save structured output to agent_results
// ---------------------------------------------------------------------------

function savePsychometricianResult(
  caseId: number,
  operationId: string,
  output: PsychometricianOutput,
): void {
  const sqlite = getSqlite()

  // Check if agent_results table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>

  if (tables.length === 0) {
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
    VALUES (?, 'psychometrician', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? '1.0')
}

// ---------------------------------------------------------------------------
// Public: Retrieve the latest psychometrician result for a case
// ---------------------------------------------------------------------------

export function getLatestPsychometricianResult(caseId: number): PsychometricianOutput | null {
  const sqlite = getSqlite()

  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return null

  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'psychometrician'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId) as { result_json: string } | undefined

  if (!row) return null

  try {
    return JSON.parse(row.result_json) as PsychometricianOutput
  } catch {
    return null
  }
}
