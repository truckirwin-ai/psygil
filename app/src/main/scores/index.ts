/**
 * Test Score Persistence, Sprint 8
 *
 * Stores clinician-entered test scores keyed by case + instrument.
 * Scores and validity scores are stored as JSON blobs in TEXT columns.
 *
 * Table: test_scores
 * Columns: score_id, case_id, instrument_name, instrument_abbrev,
 *          administration_date, data_entry_method,
 *          scores_json, validity_scores_json,
 *          clinical_narrative, notes, created_at, updated_at
 */

import { getSqlite } from '../db/connection'

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

export interface ScoreEntry {
  readonly scale_name: string
  readonly raw_score?: number
  readonly t_score?: number
  readonly percentile?: number
  readonly scaled_score?: number
  readonly interpretation?: string
  readonly is_elevated?: boolean
}

export interface TestScoreRow {
  readonly score_id: number
  readonly case_id: number
  readonly instrument_name: string
  readonly instrument_abbrev: string
  readonly administration_date: string
  readonly data_entry_method: 'manual' | 'pdf_extraction'
  readonly scores: readonly ScoreEntry[]
  readonly validity_scores: readonly ScoreEntry[]
  readonly clinical_narrative: string
  readonly notes: string
  readonly created_at: string
  readonly updated_at: string
}

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface SaveTestScoresParams {
  readonly case_id: number
  readonly instrument_name: string
  readonly instrument_abbrev: string
  readonly administration_date: string
  readonly data_entry_method: 'manual' | 'pdf_extraction'
  readonly scores: readonly ScoreEntry[]
  readonly validity_scores?: readonly ScoreEntry[]
  readonly clinical_narrative?: string
  readonly notes?: string
}

// ---------------------------------------------------------------------------
// Internal DB row (JSON fields as strings)
// ---------------------------------------------------------------------------

interface RawTestScoreRow {
  score_id: number
  case_id: number
  instrument_name: string
  instrument_abbrev: string
  administration_date: string
  data_entry_method: string
  scores_json: string
  validity_scores_json: string
  clinical_narrative: string
  notes: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureTable(): void {
  const sqlite = getSqlite()
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_scores (
      score_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      instrument_name TEXT NOT NULL,
      instrument_abbrev TEXT NOT NULL DEFAULT '',
      administration_date TEXT NOT NULL,
      data_entry_method TEXT NOT NULL DEFAULT 'manual',
      scores_json TEXT NOT NULL DEFAULT '[]',
      validity_scores_json TEXT NOT NULL DEFAULT '[]',
      clinical_narrative TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, instrument_name)
    )
  `)
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_test_scores_case
      ON test_scores(case_id)
  `)
}

function toPublicRow(raw: RawTestScoreRow): TestScoreRow {
  return {
    score_id: raw.score_id,
    case_id: raw.case_id,
    instrument_name: raw.instrument_name,
    instrument_abbrev: raw.instrument_abbrev,
    administration_date: raw.administration_date,
    data_entry_method: raw.data_entry_method as 'manual' | 'pdf_extraction',
    scores: JSON.parse(raw.scores_json) as ScoreEntry[],
    validity_scores: JSON.parse(raw.validity_scores_json) as ScoreEntry[],
    clinical_narrative: raw.clinical_narrative,
    notes: raw.notes,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Save (upsert) test scores for a case + instrument combination.
 * If a row already exists for this case + instrument_name, update it.
 */
export function saveTestScores(params: SaveTestScoresParams): TestScoreRow {
  ensureTable()
  const sqlite = getSqlite()

  const scoresJson = JSON.stringify(params.scores)
  const validityJson = JSON.stringify(params.validity_scores ?? [])

  sqlite.prepare(`
    INSERT INTO test_scores (
      case_id, instrument_name, instrument_abbrev, administration_date,
      data_entry_method, scores_json, validity_scores_json,
      clinical_narrative, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(case_id, instrument_name) DO UPDATE SET
      instrument_abbrev = excluded.instrument_abbrev,
      administration_date = excluded.administration_date,
      data_entry_method = excluded.data_entry_method,
      scores_json = excluded.scores_json,
      validity_scores_json = excluded.validity_scores_json,
      clinical_narrative = excluded.clinical_narrative,
      notes = excluded.notes,
      updated_at = datetime('now')
  `).run(
    params.case_id,
    params.instrument_name,
    params.instrument_abbrev,
    params.administration_date,
    params.data_entry_method,
    scoresJson,
    validityJson,
    params.clinical_narrative ?? '',
    params.notes ?? '',
  )

  const raw = sqlite.prepare(`
    SELECT * FROM test_scores
    WHERE case_id = ? AND instrument_name = ?
  `).get(params.case_id, params.instrument_name) as RawTestScoreRow

  return toPublicRow(raw)
}

/**
 * List all test score records for a case, ordered by administration date.
 */
export function listTestScores(caseId: number): TestScoreRow[] {
  ensureTable()
  const sqlite = getSqlite()
  const rows = sqlite.prepare(`
    SELECT * FROM test_scores
    WHERE case_id = ?
    ORDER BY administration_date ASC, score_id ASC
  `).all(caseId) as RawTestScoreRow[]

  return rows.map(toPublicRow)
}

/**
 * Delete a test score record by its primary key.
 */
export function deleteTestScores(scoreId: number): boolean {
  ensureTable()
  const sqlite = getSqlite()
  const result = sqlite.prepare(`
    DELETE FROM test_scores WHERE score_id = ?
  `).run(scoreId)
  return result.changes > 0
}
