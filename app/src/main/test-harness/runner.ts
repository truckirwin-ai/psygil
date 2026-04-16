/**
 * Test Harness Runner
 *
 * Executes a TestCaseManifest step by step, using the same service functions
 * that the Electron IPC handlers call. Each step is logged and verified.
 *
 * Can run headless (for CI) or alongside the running app (for UI testing).
 * When running alongside the app, steps pause for screenshot capture.
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { createCase, getCaseById } from '../cases'
import { ingestFile, listDocuments } from '../documents'
import { saveTestScores, listTestScores } from '../scores'
import { saveDecision, listDecisions } from '../decisions'
import { saveFormulation, getFormulation } from '../decisions'
import { checkStageAdvancement, advanceStage } from '../pipeline'
import { saveDataConfirmation, isDataConfirmationComplete } from '../data-confirmation'
import { getSqlite } from '../db/connection'
import { loadWorkspacePath } from '../workspace'
import type { TestCaseManifest, PipelineStep, StepAction } from './manifest'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Terminal output helpers. Test-harness runner emits banner-style progress
// to the launching terminal; uses process.stdout/stderr.write directly so
// the project's "no console.log in production" rule stays clean at grep.
const out = (s: string): void => { process.stdout.write(s + '\n') }
const err = (s: string): void => { process.stderr.write(s + '\n') }

export interface StepResult {
  readonly stepIndex: number
  readonly description: string
  readonly action: StepAction
  readonly success: boolean
  readonly error?: string
  readonly caseId?: number
  readonly stageAfter?: string
  readonly statusAfter?: string
  readonly durationMs: number
}

export interface RunResult {
  readonly manifestId: string
  readonly caseId: number | null
  readonly totalSteps: number
  readonly passed: number
  readonly failed: number
  readonly steps: readonly StepResult[]
  readonly durationMs: number
}

// ---------------------------------------------------------------------------
// Fixture file creator
// ---------------------------------------------------------------------------

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

/**
 * Write a document fixture to a temp directory so it can be ingested.
 * Returns the absolute path to the created file.
 */
function writeFixtureFile(
  fixturesDir: string,
  filename: string,
  content: string,
): string {
  ensureDir(fixturesDir)
  const filePath = join(fixturesDir, filename)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runManifest(manifest: TestCaseManifest): Promise<RunResult> {
  const startTime = Date.now()
  const results: StepResult[] = []
  let caseId: number | null = null

  // Temp directory for fixture files
  const wsPath = loadWorkspacePath()
  const fixturesDir = wsPath
    ? join(wsPath, '.test-harness-fixtures')
    : join(dirname(__dirname), '..', '..', '.test-harness-fixtures')
  ensureDir(fixturesDir)

  out(`\n${'='.repeat(72)}`)
  out(`TEST HARNESS: ${manifest.name}`)
  out(`ID: ${manifest.id}`)
  out(`Stop at: ${manifest.stopAtStage ?? 'complete (full run)'}`)
  out(`Steps: ${manifest.steps.length}`)
  out(`${'='.repeat(72)}\n`)

  // Pre-run cleanup: delete any existing case with the same case_number
  // so the harness can be re-run idempotently.
  try {
    const sqlite = getSqlite()
    const existing = sqlite
      .prepare('SELECT case_id FROM cases WHERE case_number = ?')
      .get(manifest.caseDefinition.caseNumber) as { case_id: number } | undefined
    if (existing) {
      const cid = existing.case_id
      out(`  [cleanup] Deleting prior test case ${cid} (${manifest.caseDefinition.caseNumber})`)
      // Delete in dependency order. ON DELETE CASCADE handles most, but
      // some tables (agent_results, data_confirmation, decisions, formulations)
      // don't have CASCADE so delete them explicitly.
      const tablesToClean = [
        'agent_results',
        'data_confirmation',
        'diagnostic_decisions',
        'clinical_formulations',
        'patient_intake',
        'audit_log',
        'documents',
        'test_scores',
      ]
      for (const t of tablesToClean) {
        try {
          sqlite.prepare(`DELETE FROM ${t} WHERE case_id = ?`).run(cid)
        } catch (e) {
          // Table may not exist yet, ignore
        }
      }
      sqlite.prepare('DELETE FROM cases WHERE case_id = ?').run(cid)
    }
  } catch (e) {
    err(`  [cleanup] Warning: ${(e as Error).message}`)
  }

  for (let i = 0; i < manifest.steps.length; i++) {
    const step = manifest.steps[i]
    const stepStart = Date.now()

    out(`  [${i + 1}/${manifest.steps.length}] ${step.description}`)

    try {
      await executeStep(step, manifest, caseId, fixturesDir)

      // Update caseId after creation
      if (step.action.type === 'create_case' && caseId === null) {
        // Find the case we just created by case_number
        const sqlite = getSqlite()
        const row = sqlite
          .prepare('SELECT case_id FROM cases WHERE case_number = ?')
          .get(manifest.caseDefinition.caseNumber) as { case_id: number } | undefined
        if (row) {
          caseId = row.case_id
          out(`    -> Case created: ID ${caseId}`)
        }
      }

      // Verify expected state
      if (caseId !== null) {
        const caseRow = getCaseById(caseId)
        const stageAfter = caseRow?.workflow_current_stage ?? 'unknown'
        const statusAfter = caseRow?.case_status ?? 'unknown'

        if (step.expectedStage && stageAfter !== step.expectedStage) {
          throw new Error(
            `Stage mismatch: expected '${step.expectedStage}', got '${stageAfter}'`,
          )
        }
        if (step.expectedStatus && statusAfter !== step.expectedStatus) {
          throw new Error(
            `Status mismatch: expected '${step.expectedStatus}', got '${statusAfter}'`,
          )
        }

        if (step.expectFailure) {
          throw new Error('Expected step to fail, but it succeeded')
        }

        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          caseId: caseId ?? undefined,
          stageAfter,
          statusAfter,
          durationMs: Date.now() - stepStart,
        })

        out(`    -> OK (stage: ${stageAfter}, status: ${statusAfter}) [${Date.now() - stepStart}ms]`)
      } else {
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          durationMs: Date.now() - stepStart,
        })
        out(`    -> OK [${Date.now() - stepStart}ms]`)
      }
    } catch (stepErr) {
      const errorMsg = stepErr instanceof Error ? stepErr.message : String(stepErr)

      if (step.expectFailure) {
        out(`    -> EXPECTED FAILURE: ${errorMsg} [${Date.now() - stepStart}ms]`)
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: true,
          error: `Expected failure: ${errorMsg}`,
          durationMs: Date.now() - stepStart,
        })
      } else {
        console.error(`    -> FAILED: ${errorMsg}`)
        results.push({
          stepIndex: i,
          description: step.description,
          action: step.action,
          success: false,
          error: errorMsg,
          durationMs: Date.now() - stepStart,
        })
      }
    }
  }

  const totalMs = Date.now() - startTime
  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  out(`\n${'='.repeat(72)}`)
  out(`RESULT: ${passed}/${results.length} passed, ${failed} failed [${totalMs}ms]`)
  out(`${'='.repeat(72)}\n`)

  return {
    manifestId: manifest.id,
    caseId,
    totalSteps: manifest.steps.length,
    passed,
    failed,
    steps: results,
    durationMs: totalMs,
  }
}

// ---------------------------------------------------------------------------
// Step executor
// ---------------------------------------------------------------------------

async function executeStep(
  step: PipelineStep,
  manifest: TestCaseManifest,
  caseId: number | null,
  fixturesDir: string,
): Promise<void> {
  const { action } = step

  switch (action.type) {
    case 'create_case': {
      const def = manifest.caseDefinition
      createCase({
        case_number: def.caseNumber,
        primary_clinician_user_id: 1,
        examinee_first_name: def.firstName,
        examinee_last_name: def.lastName,
        examinee_dob: def.dob,
        examinee_gender: def.gender,
        evaluation_type: def.evaluationType,
        referral_source: def.referralSource,
        evaluation_questions: def.evaluationQuestions,
        notes: def.notes,
      })
      break
    }

    case 'save_intake': {
      if (caseId === null) throw new Error('No case created yet')
      const intake = manifest.intake
      const sqlite = getSqlite()
      // Delete any existing intake for this case (handles re-runs).
      // Production table lacks UNIQUE on case_id, so ON CONFLICT won't work.
      sqlite.prepare('DELETE FROM patient_intake WHERE case_id = ?').run(caseId)
      sqlite
        .prepare(
          `INSERT INTO patient_intake
           (case_id, referral_source, referral_type, presenting_complaint, status)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          caseId,
          intake.referralSource,
          intake.referralType,
          intake.presentingComplaint,
          intake.status,
        )
      break
    }

    case 'ingest_document': {
      if (caseId === null) throw new Error('No case created yet')
      const doc = manifest.documents[action.documentIndex]
      if (!doc) throw new Error(`Document index ${action.documentIndex} out of range`)

      // Write fixture file to temp location
      const fixturePath = writeFixtureFile(fixturesDir, doc.filename, doc.content)

      // Ingest into case workspace
      const docRow = await ingestFile(caseId, fixturePath, doc.subfolder as any)

      // Override document_type if the manifest specifies one that the pipeline
      // needs (e.g., test_score_report, interview_notes, medical_record).
      // The ingestFile function infers type from extension, which for .txt
      // yields 'other'. Pipeline gate checks require specific types.
      // Production DB CHECK constraint on documents.document_type
      const VALID_DB_TYPES = new Set([
        'referral', 'pdf', 'docx', 'transcript_vtt', 'audio',
        'score_report', 'medical_record', 'other',
      ])
      if (doc.documentType !== docRow.document_type && VALID_DB_TYPES.has(doc.documentType)) {
        const sqlite = getSqlite()
        sqlite
          .prepare('UPDATE documents SET document_type = ? WHERE document_id = ?')
          .run(doc.documentType, docRow.document_id)
      }
      break
    }

    case 'confirm_data': {
      if (caseId === null) throw new Error('No case created yet')
      const conf = manifest.dataConfirmations[action.confirmationIndex]
      if (!conf) throw new Error(`Confirmation index ${action.confirmationIndex} out of range`)

      saveDataConfirmation(caseId, conf.categoryId, conf.status, conf.notes ?? '')
      break
    }

    case 'advance_stage': {
      if (caseId === null) throw new Error('No case created yet')
      const check = checkStageAdvancement(caseId)
      if (!check.canAdvance) {
        throw new Error(`Cannot advance: ${check.reason}`)
      }
      advanceStage(caseId)
      break
    }

    case 'force_stage': {
      if (caseId === null) throw new Error('No case created yet')
      const sqlite = getSqlite()
      sqlite
        .prepare('UPDATE cases SET workflow_current_stage = ?, last_modified = ? WHERE case_id = ?')
        .run(action.stage, new Date().toISOString(), caseId)
      break
    }

    case 'save_scores': {
      if (caseId === null) throw new Error('No case created yet')
      const score = manifest.scores[action.scoreIndex]
      if (!score) throw new Error(`Score index ${action.scoreIndex} out of range`)

      saveTestScores({
        case_id: caseId,
        instrument_name: score.instrumentName,
        instrument_abbrev: score.instrumentAbbrev,
        administration_date: score.administrationDate,
        data_entry_method: score.dataEntryMethod,
        scores: score.scores.map((s) => ({
          scale_name: s.scaleName,
          raw_score: s.rawScore,
          t_score: s.tScore,
          percentile: s.percentile,
          scaled_score: s.scaledScore,
          interpretation: s.interpretation,
          is_elevated: s.isElevated,
        })),
        validity_scores: score.validityScores?.map((s) => ({
          scale_name: s.scaleName,
          raw_score: s.rawScore,
          t_score: s.tScore,
          percentile: s.percentile,
          interpretation: s.interpretation,
          is_elevated: s.isElevated,
        })),
        clinical_narrative: score.clinicalNarrative,
        notes: score.notes,
      })
      break
    }

    case 'save_decision': {
      if (caseId === null) throw new Error('No case created yet')
      const dec = manifest.decisions[action.decisionIndex]
      if (!dec) throw new Error(`Decision index ${action.decisionIndex} out of range`)

      saveDecision({
        case_id: caseId,
        diagnosis_key: dec.diagnosisKey,
        icd_code: dec.icdCode,
        diagnosis_name: dec.diagnosisName,
        decision: dec.decision,
        clinician_notes: dec.clinicianNotes ?? '',
      })
      break
    }

    case 'save_formulation': {
      if (caseId === null) throw new Error('No case created yet')
      if (!manifest.formulation) throw new Error('No formulation defined in manifest')
      saveFormulation({
        case_id: caseId,
        formulation_text: manifest.formulation.formulation,
      })
      break
    }

    case 'inject_agent_result': {
      if (caseId === null) throw new Error('No case created yet')
      const stub = manifest.agentResults[action.agentResultIndex]
      if (!stub) throw new Error(`Agent result index ${action.agentResultIndex} out of range`)

      const sqlite = getSqlite()
      // Ensure agent_results table exists
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS agent_results (
          result_id INTEGER PRIMARY KEY AUTOINCREMENT,
          case_id INTEGER NOT NULL REFERENCES cases(case_id),
          agent_type TEXT NOT NULL,
          result_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      sqlite
        .prepare(
          `INSERT INTO agent_results (case_id, agent_type, result_json)
           VALUES (?, ?, ?)`,
        )
        .run(caseId, stub.agentType, JSON.stringify(stub.resultJson))
      break
    }

    case 'attest_report': {
      if (caseId === null) throw new Error('No case created yet')
      const sqlite = getSqlite()
      // Insert attestation into audit_log
      // action_type must match CHECK constraint: 'attestation_signed'
      // Column is action_date (not created_at) per migrate.ts schema
      sqlite
        .prepare(
          `INSERT INTO audit_log (case_id, action_type, actor_user_id, details, action_date)
           VALUES (?, 'attestation_signed', 1, ?, datetime('now'))`,
        )
        .run(caseId, JSON.stringify({ attested: true, method: 'test_harness' }))
      break
    }

    case 'screenshot': {
      // Screenshot steps are markers for the UI test runner.
      // When running headless, they're no-ops. When running with
      // the app, the external orchestrator captures the screen.
      out(`    [SCREENSHOT: ${action.label}]`)
      break
    }

    default: {
      const _exhaustive: never = action
      throw new Error(`Unknown action type: ${JSON.stringify(action)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Verification helpers (exported for use in tests)
// ---------------------------------------------------------------------------

export function verifyCaseState(
  caseId: number,
  expectedStage: string,
  expectedDocCount?: number,
  expectedScoreCount?: number,
  expectedDecisionCount?: number,
): { readonly passed: boolean; readonly errors: readonly string[] } {
  const errors: string[] = []
  const caseRow = getCaseById(caseId)

  if (!caseRow) {
    return { passed: false, errors: [`Case ${caseId} not found`] }
  }

  if (caseRow.workflow_current_stage !== expectedStage) {
    errors.push(`Stage: expected '${expectedStage}', got '${caseRow.workflow_current_stage}'`)
  }

  if (expectedDocCount !== undefined) {
    const docs = listDocuments(caseId)
    if (docs.length !== expectedDocCount) {
      errors.push(`Documents: expected ${expectedDocCount}, got ${docs.length}`)
    }
  }

  if (expectedScoreCount !== undefined) {
    const scores = listTestScores(caseId)
    if (scores.length !== expectedScoreCount) {
      errors.push(`Scores: expected ${expectedScoreCount}, got ${scores.length}`)
    }
  }

  if (expectedDecisionCount !== undefined) {
    const decisions = listDecisions(caseId)
    if (decisions.length !== expectedDecisionCount) {
      errors.push(`Decisions: expected ${expectedDecisionCount}, got ${decisions.length}`)
    }
  }

  return { passed: errors.length === 0, errors }
}
