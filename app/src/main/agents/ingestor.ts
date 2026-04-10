/**
 * Psygil Ingestor Agent (Agent 6.2)
 *
 * Gathers all documents for a case, constructs the input payload per
 * docs/engineering/03_agent_prompt_specs.md (Agent 1: Ingestor), and runs
 * the generic agent runner to produce a structured case record.
 *
 * Pipeline:
 *   1. getCaseById(), load case metadata
 *   2. listDocuments(), load all uploaded documents + their indexed_content
 *   3. Build ingestor input JSON per spec
 *   4. runAgent(), PII redact → Claude → rehydrate → structured JSON
 *   5. Save structured case record to DB (agent_results table)
 *   6. Return result to caller
 *
 * THE AI NEVER DIAGNOSES. The Ingestor only extracts and organizes data.
 */

import { getSqlite } from '../db/connection'
import { getCaseById, getIntake } from '../cases'
import { listDocuments } from '../documents'
import { retrieveApiKey } from '../ai/key-storage'
import { runAgent, type AgentConfig, type AgentResult } from './runner'

// ---------------------------------------------------------------------------
// Ingestor system prompt, from docs/engineering/03_agent_prompt_specs.md
// ---------------------------------------------------------------------------

const INGESTOR_SYSTEM_PROMPT = `You are the Ingestor Agent for Psygil, an AI assistant for forensic and clinical psychologists. Your role is to parse raw case materials and extract structured data into a standardized case record.

CRITICAL PRINCIPLE: You extract and organize data. You do not interpret, score, or diagnose. The clinician diagnoses.

YOUR INPUTS:
- Raw documents: PDF text, DOCX text, VTT transcripts, Whisper transcripts, handwritten notes (as text)
- Referral documents: Letters, intake forms, legal requests
- Standardized test score reports: Q-global exports, PARiConnect exports, publisher score reports
- Collateral records: School reports, medical records, prior evaluations

YOUR OUTPUTS:
A structured JSON case record with sections: demographics, referral_questions, test_administrations, behavioral_observations_from_transcripts, timeline_events, collateral_summary, and completeness_flags.

EXTRACTION RULES:

1. DEMOGRAPHICS:
   - Extract: Name, DOB, age, sex/gender, race/ethnicity, handedness, education level, occupation, referral source, evaluator name, evaluation dates
   - If missing, note as null with a reason_missing flag
   - Do NOT infer or estimate missing values

2. REFERRAL QUESTIONS:
   - Extract verbatim referral questions from referral letters or intake forms
   - Label each question with source document and page number
   - If referral questions are implicit, extract them as inferred questions with an "inferred" flag

3. TEST ADMINISTRATIONS:
   - For each standardized test:
     * Extract test name, administration date, raw scores, scaled scores, percentiles, T-scores
     * Extract validity indicators exactly as reported
     * Extract diagnostic classifications provided by the test publisher
     * CRITICAL: Do NOT independently interpret or score tests. Extract only what the publisher score report explicitly states
     * Flag any missing subtests or incomplete administrations
     * Include the source document, date, and any administrator notes
   - PUBLISHER SCORE REPORT FORMATS (documents typed as "test_score_report"):
     * Q-Global (Pearson MMPI-3): Extract all clinical scales (ANX, FRS, OBS, DEP, HLT, BIZ, ANG, CYN, ASP, TPA, LSE, SOD, FAM, WRK, TRT), validity indicators (VRIN-T, TRIN-T, F, Fp, Fs, L, K), supplementary items (PS, HPI, RC scales). Include rawScore, tScore, percentile, classification for each.
     * PARiConnect (PAI): Extract all clinical scales, validity scales (NIM, PIM, ICN, INF), treatment indicators. Include rawScore, tScore, percentile for each.
     * WAIS-V (Pearson): Extract subtest scaled scores, Index scores (VCI, VSI, FRI, WMI, PSI), FSIQ, GAI. Include scaled_score, composite_score, percentile, confidence_interval.
     * TOMM: Extract Trial 1, Trial 2, Retention scores. Report pass/fail status (cutoff: 45).
     * SIRS-2: Extract scale classifications (Genuine, Indeterminate, Probable Feigning, Definite Feigning). Report per-scale results.
   - For each test, output a sub-object in test_administrations with keys: instrumentId, instrumentName, publisher, administrationDate, importSource, clinicalScales (object), validityIndicators (object), status, completeness

4. BEHAVIORAL OBSERVATIONS FROM TRANSCRIPTS:
   - If audio/video transcripts are provided, extract behavioral observations
   - Clearly label these as "transcript-derived" NOT clinician direct observation
   - Include: apparent mood, affect, speech patterns, cooperation, unusual behaviors, engagement level
   - Quote the relevant transcript passages
   - Do NOT diagnose or interpret behavior

5. TIMELINE EVENTS:
   - Extract key dates and events from all documents in chronological order
   - For each event, cite the source document
   - Do NOT infer causality or significance

6. COLLATERAL SUMMARY:
   - For each collateral record: source, date, key facts extracted
   - Do NOT interpret; only extract facts as stated
   - Note any conflicting information across collateral sources

7. COMPLETENESS FLAGS:
   - For each major data category, flag completeness: "complete," "partial," "missing"
   - Add a summary_gaps field noting the top 3 missing data categories

OUTPUT FORMAT:
Return a valid JSON object with these top-level keys:
  case_id, version, generated_at, demographics, referral_questions,
  test_administrations, behavioral_observations_from_transcripts,
  timeline_events, collateral_summary, completeness_flags

TONE:
Clinical, precise, objective. Use professional terminology. Avoid speculation.`

// ---------------------------------------------------------------------------
// Document type mapping (file doc_type → ingestor document_type enum)
// ---------------------------------------------------------------------------

function mapDocType(docType: string, filePath?: string | null): string {
  const map: Record<string, string> = {
    referral: 'referral_letter',
    intake: 'intake_form',
    test_report: 'test_score_report',
    score_report: 'test_score_report',
    transcript_vtt: 'transcript_vtt',
    transcript: 'transcript_vtt',
    collateral: 'collateral_medical',
    medical_record: 'collateral_medical',
    educational_record: 'collateral_educational',
    legal_document: 'collateral_legal',
    prior_eval: 'prior_evaluation',
    report: 'prior_evaluation',
    other: 'collateral_medical',
  }

  // If the file lives in the Testing subfolder, it's likely a score report
  if (filePath) {
    const normalized = filePath.replace(/\\/g, '/')
    if (normalized.includes('/Testing/') || normalized.includes('/testing/')) {
      return 'test_score_report'
    }
  }

  return map[docType] ?? 'collateral_medical'
}

// ---------------------------------------------------------------------------
// Ingestor output type (matches doc 03 output schema)
// ---------------------------------------------------------------------------

export interface IngestorOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string
  readonly demographics: Record<string, unknown>
  readonly referral_questions: readonly Record<string, unknown>[]
  readonly test_administrations: readonly Record<string, unknown>[]
  readonly behavioral_observations_from_transcripts: Record<string, unknown>
  readonly timeline_events: readonly Record<string, unknown>[]
  readonly collateral_summary: readonly Record<string, unknown>[]
  readonly completeness_flags: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Public: Run the Ingestor Agent for a case
// ---------------------------------------------------------------------------

/**
 * Run the Ingestor Agent for the given case.
 *
 * @param caseId - The case to ingest
 * @returns AgentResult with IngestorOutput as the structured result
 */
export async function runIngestorAgent(caseId: number): Promise<AgentResult<IngestorOutput>> {
  // 1. Load case metadata
  const caseRow = getCaseById(caseId)
  if (!caseRow) {
    return {
      status: 'error',
      agentType: 'ingestor',
      caseId,
      operationId: '',
      error: `Case ${caseId} not found`,
      durationMs: 0,
    }
  }

  // 2. Load all documents for this case
  const documents = listDocuments(caseId)
  if (documents.length === 0) {
    return {
      status: 'error',
      agentType: 'ingestor',
      caseId,
      operationId: '',
      error: 'No documents uploaded for this case. Upload documents before running ingestion.',
      durationMs: 0,
    }
  }

  // 3. Load intake data (if available) for additional context
  const intake = getIntake(caseId)

  // 4. Retrieve API key
  const apiKey = retrieveApiKey()
  if (!apiKey) {
    return {
      status: 'error',
      agentType: 'ingestor',
      caseId,
      operationId: '',
      error: 'Anthropic API key not configured. Set your API key in Settings.',
      durationMs: 0,
    }
  }

  // 5. Build the ingestor input payload
  // Format: JSON preamble with case metadata, then each document's text
  const rawDocs = documents
    .filter((d) => d.indexed_content) // Only documents with extracted text
    .map((d) => ({
      document_name: d.original_filename,
      document_type: mapDocType(d.document_type, d.file_path),
      text_content: d.indexed_content!,
      upload_date: d.upload_date,
    }))

  if (rawDocs.length === 0) {
    return {
      status: 'error',
      agentType: 'ingestor',
      caseId,
      operationId: '',
      error: 'No documents with extractable text found. Ensure documents are PDF, DOCX, or TXT.',
      durationMs: 0,
    }
  }

  const inputPayload = JSON.stringify(
    {
      case_id: caseRow.case_number ?? `CASE-${caseId}`,
      raw_documents: rawDocs,
      clinician_metadata: {
        clinician_name: 'Unknown', // Clinician name not stored on intake; sourced from case/user record
        evaluation_type: caseRow.evaluation_type ?? 'other',
        jurisdiction: intake?.jurisdiction ?? undefined,
        case_notes: intake?.presenting_complaint ?? undefined,
      },
    },
    null,
    2,
  )

  // 6. Build agent config
  const config: AgentConfig = {
    agentType: 'ingestor',
    systemPrompt: INGESTOR_SYSTEM_PROMPT,
    caseId,
    inputTexts: [inputPayload],
    maxTokens: 8192, // Ingestor output can be large
    temperature: 0,
  }

  // 7. Run through the generic agent runner (redact → Claude → rehydrate → destroy)
  const result = await runAgent<IngestorOutput>(apiKey, config)

  // 8. If successful, persist the structured result to the DB
  if (result.status === 'success' && result.result) {
    try {
      saveIngestorResult(caseId, result.operationId, result.result)
    } catch (e) {
      console.error('[ingestor] Failed to save result to DB:', (e as Error).message)
      // Don't fail the whole operation, the result is still returned
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Persistence, save structured ingestor output to the DB
// ---------------------------------------------------------------------------

/**
 * Save the ingestor's structured output to the agent_results table.
 * This creates a versioned record that can be retrieved later by
 * the Diagnostician, Writer, or any other consumer.
 */
function saveIngestorResult(
  caseId: number,
  operationId: string,
  output: IngestorOutput,
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
  } else {
    // Ensure legacy tables have the columns we need
    const cols = (sqlite.prepare("PRAGMA table_info(agent_results)").all()) as Array<{ name: string }>
    const colNames = new Set(cols.map((c) => c.name))
    if (!colNames.has('operation_id')) {
      try { sqlite.exec(`ALTER TABLE agent_results ADD COLUMN operation_id TEXT`) } catch {}
    }
    if (!colNames.has('version')) {
      try { sqlite.exec(`ALTER TABLE agent_results ADD COLUMN version TEXT DEFAULT '1.0'`) } catch {}
    }
  }

  sqlite.prepare(`
    INSERT INTO agent_results (case_id, agent_type, operation_id, result_json, version)
    VALUES (?, 'ingestor', ?, ?, ?)
  `).run(caseId, operationId, JSON.stringify(output), output.version ?? '1.0')
}

// ---------------------------------------------------------------------------
// Public: Retrieve the latest ingestor result for a case
// ---------------------------------------------------------------------------

/**
 * Get the most recent ingestor result for a case.
 * Returns null if the ingestor hasn't been run yet.
 */
export function getLatestIngestorResult(caseId: number): IngestorOutput | null {
  const sqlite = getSqlite()

  // Check if table exists
  const tables = (sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_results'"
  ).all()) as Array<{ name: string }>
  if (tables.length === 0) return null

  const row = sqlite.prepare(`
    SELECT result_json FROM agent_results
    WHERE case_id = ? AND agent_type = 'ingestor'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(caseId) as { result_json: string } | undefined

  if (!row) return null

  try {
    return JSON.parse(row.result_json) as IngestorOutput
  } catch {
    return null
  }
}
