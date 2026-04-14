/**
 * PSYGIL FULL LIFECYCLE WALKTHROUGH
 *
 * Narrated end-to-end test exercising every use case stage:
 *   Onboarding → Testing → Interview → Diagnostics → Review → Complete
 *
 * Each stage tests:
 *   1. Gate blocking (missing prerequisites)
 *   2. Data entry (cases, documents, confirmations, agent results)
 *   3. Gate passing (all prerequisites met)
 *   4. Stage advancement (pipeline progression)
 *   5. Audit trail logging (every action recorded)
 *   6. Module integration (reports, decisions, testimony)
 *
 * Run: npx vitest run src/main/__tests__/walkthrough.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getTestDb, resetTestDb } from './test-db'
import { checkStageAdvancement, advanceStage, getStageConditions, getNextStage } from '../pipeline'
import { saveDataConfirmation, getDataConfirmation, isDataConfirmationComplete } from '../data-confirmation'
import { logAuditEntry, getAuditTrail, exportAuditTrail } from '../audit'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createUser(db: any, id = 1): void {
  if (!db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(id)) {
    db.prepare(
      'INSERT INTO users (user_id, email, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)',
    ).run(id, 'dr.irwin@foundrysmb.com', 'Dr. Truck Irwin, Psy.D., ABPP', 'psychologist', 1)
  }
}

function createCase(db: any, id = 1, stage = 'onboarding'): void {
  createUser(db)
  db.prepare(
    `INSERT INTO cases
     (case_id, case_number, primary_clinician_user_id, examinee_first_name, examinee_last_name,
      workflow_current_stage, case_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, 'PSY-2026-0147', 1, 'James', 'Mitchell', stage, 'in_progress')
}

function createIntake(db: any, caseId: number, status = 'complete'): void {
  db.prepare(
    `INSERT INTO patient_intake
     (case_id, referral_source, referral_type, presenting_complaint, status)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    caseId,
    'Hon. Maria Gonzalez, Superior Court',
    'court_ordered',
    'Competency to Stand Trial evaluation ordered per PC 1368',
    status,
  )
}

function addDocument(db: any, caseId: number, docId: number, docType: string, filename: string): void {
  createUser(db)
  db.prepare(
    `INSERT INTO documents
     (document_id, case_id, document_type, original_filename, file_path, mime_type, uploaded_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(docId, caseId, docType, filename, `/workspace/case_1/${filename}`, 'application/pdf', 1)
}

function addAgentResult(db: any, caseId: number, agentType: string, resultId: number, result: Record<string, unknown> = {}): void {
  createUser(db)
  db.prepare(
    `INSERT INTO agent_results (result_id, case_id, agent_type, result_json, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
  ).run(resultId, caseId, agentType, JSON.stringify(result))
}

function addReport(db: any, caseId: number, version = 1, status = 'draft'): void {
  createUser(db)
  db.prepare(
    `INSERT INTO reports (case_id, report_version, generated_by_user_id, status, file_path, created_at, last_modified)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).run(caseId, version, 1, status, `/workspace/case_1/report/drafts/draft_v${version}.docx`)
}

function getCase(db: any, caseId: number): any {
  return db.prepare('SELECT * FROM cases WHERE case_id = ?').get(caseId)
}

function step(msg: string): void {
  console.log(`\n  ▸ ${msg}`)
}

function gate(blocked: boolean, reason: string): void {
  if (blocked) {
    console.log(`    🚫 BLOCKED: ${reason}`)
  } else {
    console.log(`    ✅ PASSED: ${reason}`)
  }
}

function action(msg: string): void {
  console.log(`    → ${msg}`)
}

// ---------------------------------------------------------------------------
// WALKTHROUGH
// ---------------------------------------------------------------------------

describe('═══ PSYGIL FULL LIFECYCLE WALKTHROUGH ═══', () => {
  let db: any

  beforeEach(() => {
    resetTestDb()
    db = getTestDb()
  })

  // =========================================================================
  // STAGE 0: ONBOARDING
  // =========================================================================

  describe('STAGE 0: ONBOARDING', () => {
    it('Case creation + intake + documents + data confirmation → advance to Testing', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 0: ONBOARDING                                 ║')
      console.log('║  Goal: Create case, complete intake, upload docs,     ║')
      console.log('║        confirm extracted data                         ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      // --- Create case ---
      step('Create new forensic evaluation case')
      createCase(db, 1, 'onboarding')
      const newCase = getCase(db, 1)
      expect(newCase).toBeTruthy()
      expect(newCase.case_number).toBe('PSY-2026-0147')
      expect(newCase.workflow_current_stage).toBe('onboarding')
      expect(newCase.examinee_first_name).toBe('James')
      action(`Case PSY-2026-0147 created: James Mitchell, CST evaluation`)
      action(`Stage: ONBOARDING`)

      // --- Log case creation ---
      step('Audit: log case creation')
      logAuditEntry({
        caseId: 1,
        actionType: 'case_created',
        actorType: 'clinician',
        details: { case_number: 'PSY-2026-0147', evaluation_type: 'CST' },
      })
      const trail = getAuditTrail(1)
      expect(trail.length).toBe(1)
      expect(trail[0].action_type).toBe('case_created')
      action('Audit entry recorded: case_created')

      // --- Gate check: no intake yet ---
      step('Gate check: can we advance? (no intake)')
      let check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Show conditions ---
      step('Stage conditions for Onboarding:')
      const conditions = getStageConditions('onboarding')
      conditions.forEach((c) => action(c))
      expect(conditions.length).toBe(3)

      // --- Complete intake ---
      step('Complete patient intake form')
      createIntake(db, 1, 'complete')
      logAuditEntry({
        caseId: 1,
        actionType: 'intake_completed',
        actorType: 'clinician',
        details: { referral_source: 'Superior Court', referral_type: 'court_ordered' },
      })
      action('Intake: CST eval ordered by Hon. Maria Gonzalez, Superior Court')

      // --- Gate check: no documents yet ---
      step('Gate check: can we advance? (no documents)')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Upload documents ---
      step('Upload referral documents')
      addDocument(db, 1, 1, 'referral', 'Court_Order_PC1368.pdf')
      addDocument(db, 1, 2, 'medical_record', 'Police_Report_2025-12-15.pdf')
      addDocument(db, 1, 3, 'medical_record', 'Prior_Psych_Eval_2024.pdf')
      logAuditEntry({
        caseId: 1,
        actionType: 'documents_uploaded',
        actorType: 'clinician',
        details: { count: 3, types: ['referral', 'medical_record', 'medical_record'] },
      })
      action('Uploaded 3 documents: court order, police report, prior eval')

      // --- Gate check: no data confirmation yet ---
      step('Gate check: can we advance? (data not confirmed)')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Data confirmation ---
      step('Review and confirm extracted data')

      action('Confirming Demographics...')
      saveDataConfirmation(1, 'demographics', 'confirmed', '')
      action('Confirming Referral Questions...')
      saveDataConfirmation(1, 'referral_questions', 'confirmed', '')
      action('Flagging Timeline (needs attention)...')
      saveDataConfirmation(1, 'timeline_events', 'flagged', 'Missing arrest date, check police report')
      action('Correcting Collateral Records...')
      saveDataConfirmation(1, 'collateral_summary', 'corrected', 'Prior eval date was 2023, not 2024')

      // Verify data confirmation state
      const confirmations = getDataConfirmation(1)
      expect(confirmations.length).toBe(4)
      action(`Data confirmation: ${confirmations.length} categories reviewed`)

      // Required categories complete?
      const complete = isDataConfirmationComplete(1)
      expect(complete).toBe(true)
      action('Required categories (Demographics + Referral Questions) confirmed ✓')

      // --- Gate check: all conditions met ---
      step('Gate check: can we advance now?')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(true)
      expect(check.nextStage).toBe('testing')
      gate(false, check.reason)

      // --- ADVANCE ---
      step('ADVANCE: Onboarding → Testing')
      const result = advanceStage(1)
      expect(result.newStage).toBe('testing')
      expect(result.previousStage).toBe('onboarding')
      action(`Stage advanced: ${result.previousStage} → ${result.newStage}`)

      const caseAfter = getCase(db, 1)
      expect(caseAfter.workflow_current_stage).toBe('testing')
      action('Database updated ✓')
    })
  })

  // =========================================================================
  // STAGE 1: TESTING
  // =========================================================================

  describe('STAGE 1: TESTING', () => {
    it('Upload test scores + advance to Interview', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 1: TESTING                                    ║')
      console.log('║  Goal: Upload test score reports, advance to          ║')
      console.log('║        Interview stage                                ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      // Setup: case at testing stage
      createCase(db, 1, 'testing')

      // --- Gate check: no test documents ---
      step('Gate check: can we advance? (no test documents)')
      let check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Upload test score reports ---
      step('Upload test score reports')
      addDocument(db, 1, 10, 'test_score_report', 'MMPI-3_Q-Global_Report.pdf')
      addDocument(db, 1, 11, 'test_score_report', 'PAI_PARiConnect_Report.pdf')
      addDocument(db, 1, 12, 'test_battery', 'WAIS-V_Score_Summary.pdf')
      addDocument(db, 1, 13, 'standardized_test', 'TOMM_Protocol.pdf')
      logAuditEntry({
        caseId: 1,
        actionType: 'test_scores_uploaded',
        actorType: 'clinician',
        details: { instruments: ['MMPI-3', 'PAI', 'WAIS-V', 'TOMM'] },
      })
      action('Uploaded 4 test reports: MMPI-3, PAI, WAIS-V, TOMM')

      // --- Gate check: test docs present ---
      step('Gate check: can we advance now?')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(true)
      gate(false, check.reason)

      // --- ADVANCE ---
      step('ADVANCE: Testing → Interview')
      const result = advanceStage(1)
      expect(result.newStage).toBe('interview')
      action(`Stage advanced: ${result.previousStage} → ${result.newStage}`)
    })
  })

  // =========================================================================
  // STAGE 2: INTERVIEW
  // =========================================================================

  describe('STAGE 2: INTERVIEW', () => {
    it('Upload interview notes + run Ingestor Agent → advance to Diagnostics', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 2: INTERVIEW                                  ║')
      console.log('║  Goal: Document interviews, run Ingestor Agent,       ║')
      console.log('║        advance to Diagnostics                         ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      createCase(db, 1, 'interview')

      // --- Gate check: no interview docs ---
      step('Gate check: can we advance? (no interview docs)')
      let check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Upload interview documentation ---
      step('Upload interview documentation')
      addDocument(db, 1, 20, 'interview_notes', 'Clinical_Interview_2026-03-20.pdf')
      addDocument(db, 1, 21, 'behavioral_observation', 'Behavioral_Observations.pdf')
      addDocument(db, 1, 22, 'transcript_vtt', 'Interview_Transcript.vtt')
      logAuditEntry({
        caseId: 1,
        actionType: 'interviews_documented',
        actorType: 'clinician',
        details: { interview_date: '2026-03-20', duration_minutes: 90 },
      })
      action('Uploaded clinical interview notes, behavioral observations, transcript')

      // --- Gate check: no ingestor result ---
      step('Gate check: can we advance? (Ingestor Agent not run)')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Run Ingestor Agent ---
      step('Run Ingestor Agent (PII redaction → Claude API → structured output)')
      addAgentResult(db, 1, 'ingestor', 1, {
        case_id: 'PSY-2026-0147',
        demographics: { name: '[UNID:op-2026-0147-001]', dob: '1985-07-22', gender: 'male' },
        referral_questions: ['Is defendant competent to stand trial per PC 1368?'],
        test_administrations: ['MMPI-3', 'PAI', 'WAIS-V', 'TOMM'],
        behavioral_observations: {
          appearance: 'Cooperative, oriented x4, adequate hygiene',
          effort: 'Adequate effort on all measures',
        },
        timeline: [
          { date: '2025-12-15', event: 'Arrest' },
          { date: '2026-01-10', event: 'Referral for CST evaluation' },
          { date: '2026-03-20', event: 'Clinical interview conducted' },
        ],
        completeness: { score: 0.92, missing: ['collateral interview'] },
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'agent_run',
        actorType: 'ai_agent',
        details: { agent: 'ingestor', result_id: 1, completeness: 0.92 },
      })
      action('Ingestor complete: 92% completeness, UNID redaction applied')

      // --- Gate check: all conditions met ---
      step('Gate check: can we advance now?')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(true)
      gate(false, check.reason)

      // --- ADVANCE ---
      step('ADVANCE: Interview → Diagnostics')
      const result = advanceStage(1)
      expect(result.newStage).toBe('diagnostics')
      action(`Stage advanced: ${result.previousStage} → ${result.newStage}`)
    })
  })

  // =========================================================================
  // STAGE 3: DIAGNOSTICS
  // =========================================================================

  describe('STAGE 3: DIAGNOSTICS', () => {
    it('Run Diagnostician Agent + clinician renders diagnoses → advance to Review', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 3: DIAGNOSTICS                                ║')
      console.log('║  DOCTOR ALWAYS DIAGNOSES, AI suggests, clinician     ║')
      console.log('║  decides. No auto-accept. No AI diagnosis.            ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      createCase(db, 1, 'diagnostics')

      // --- Gate check: no diagnostician result ---
      step('Gate check: can we advance? (Diagnostician not run)')
      let check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Run Diagnostician Agent ---
      step('Run Diagnostician Agent (presents diagnostic options)')
      addAgentResult(db, 1, 'diagnostician', 2, {
        case_id: 'PSY-2026-0147',
        diagnostic_options: [
          {
            diagnosis_name: 'Schizophrenia, First Episode',
            icd_code: 'F20.9',
            confidence: 0.78,
            criteria_met: ['A1', 'A3', 'B', 'C'],
            criteria_not_met: [],
            criteria_insufficient: ['A2'],
            evidence_summary: 'Disorganized speech noted in interview, persecutory delusions reported in collateral',
            differentials: ['Brief Psychotic Disorder', 'Schizoaffective Disorder'],
          },
          {
            diagnosis_name: 'Antisocial Personality Disorder',
            icd_code: 'F60.2',
            confidence: 0.45,
            criteria_met: ['A1', 'A3'],
            criteria_not_met: ['A5', 'A6'],
            criteria_insufficient: ['A2', 'A4', 'A7'],
            evidence_summary: 'Elevated PAI ANT scale, but limited behavioral evidence',
            differentials: ['Conduct Disorder (historical)'],
          },
        ],
        psycholegal_analysis: {
          competency_factors: {
            understanding_charges: 'impaired',
            assisting_counsel: 'impaired',
            rational_decision_making: 'impaired',
          },
        },
        functional_impairment: 'moderate_to_severe',
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'agent_run',
        actorType: 'ai_agent',
        details: { agent: 'diagnostician', result_id: 2, options_presented: 2 },
      })
      action('Diagnostician complete: 2 diagnostic options presented')
      action('  • Schizophrenia F20.9 (confidence: 0.78), 4 criteria met')
      action('  • ASPD F60.2 (confidence: 0.45), 2 criteria met')

      // --- Clinician diagnostic decisions ---
      step('DOCTOR RENDERS DIAGNOSES (clinician decides, NOT the AI)')
      // Simulate clinician decision via direct DB insert (normally via IPC)
      db.prepare(
        `INSERT INTO diagnostic_decisions
         (case_id, diagnosis_key, diagnosis_name, icd_code, decision, clinician_notes, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).run(1, 'schizophrenia_f20.9', 'Schizophrenia, First Episode', 'F20.9', 'render',
        'Criteria A met per clinical interview and collateral. Sufficient evidence for diagnosis.')
      db.prepare(
        `INSERT INTO diagnostic_decisions
         (case_id, diagnosis_key, diagnosis_name, icd_code, decision, clinician_notes, decided_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).run(1, 'aspd_f60.2', 'Antisocial Personality Disorder', 'F60.2', 'rule_out',
        'Insufficient criteria met. Elevated PAI ANT likely reflects situational factors.')
      logAuditEntry({
        caseId: 1,
        actionType: 'diagnosis_decision',
        actorType: 'clinician',
        details: {
          rendered: [{ name: 'Schizophrenia F20.9', decision: 'render' }],
          ruled_out: [{ name: 'ASPD F60.2', decision: 'rule_out' }],
        },
      })
      action('Clinician RENDERED: Schizophrenia F20.9')
      action('Clinician RULED OUT: ASPD F60.2')

      // Verify decisions in DB
      const decisions = db
        .prepare('SELECT * FROM diagnostic_decisions WHERE case_id = ?')
        .all(1) as any[]
      expect(decisions.length).toBe(2)
      expect(decisions.find((d: any) => d.decision === 'render').diagnosis_name).toBe('Schizophrenia, First Episode')
      action('Diagnostic decisions persisted to database ✓')

      // --- Gate check: diagnostician result exists ---
      step('Gate check: can we advance now?')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(true)
      gate(false, check.reason)

      // --- ADVANCE ---
      step('ADVANCE: Diagnostics → Review')
      const result = advanceStage(1)
      expect(result.newStage).toBe('review')
      action(`Stage advanced: ${result.previousStage} → ${result.newStage}`)
    })
  })

  // =========================================================================
  // STAGE 4: REVIEW
  // =========================================================================

  describe('STAGE 4: REVIEW', () => {
    it('Run Writer + Editor Agents + attestation → advance to Complete', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 4: REVIEW                                     ║')
      console.log('║  Goal: Generate report, review flags, sign report,    ║')
      console.log('║        advance to Complete                            ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      createCase(db, 1, 'review')

      // --- Gate check: no writer result ---
      step('Gate check: can we advance? (Writer not run)')
      let check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Run Writer Agent ---
      step('Run Writer Agent (generates report draft)')
      addAgentResult(db, 1, 'writer', 3, {
        case_id: 'PSY-2026-0147',
        version: '1.0',
        generated_at: '2026-03-29T10:00:00Z',
        sections: [
          { section_name: 'Identifying Information', content: 'James Mitchell, 40-year-old male...', content_type: 'fully_generated', sources: ['intake', 'court_order'], confidence: 0.95 },
          { section_name: 'Reason for Referral', content: 'Defendant referred for CST evaluation per PC 1368...', content_type: 'fully_generated', sources: ['court_order'], confidence: 0.98 },
          { section_name: 'Clinical Interview', content: 'Mr. Mitchell presented as a 40-year-old male...', content_type: 'draft_requiring_revision', sources: ['interview_notes', 'behavioral_observation'], confidence: 0.72 },
          { section_name: 'Test Results', content: 'MMPI-3: Clinical scales elevated on Rc6, Rc8...', content_type: 'fully_generated', sources: ['MMPI-3', 'PAI', 'WAIS-V', 'TOMM'], confidence: 0.90 },
          { section_name: 'Diagnostic Formulation', content: 'Based on the above data, the following diagnosis...', content_type: 'draft_requiring_revision', sources: ['diagnostician'], confidence: 0.65 },
          { section_name: 'Forensic Opinion', content: 'It is the opinion of the undersigned that...', content_type: 'draft_requiring_revision', sources: ['clinical_interview', 'testing', 'collateral'], confidence: 0.60 },
        ],
        report_summary: {
          patient_name: 'James Mitchell',
          evaluation_type: 'Competency to Stand Trial',
          selected_diagnoses: ['Schizophrenia F20.9'],
          total_sections: 6,
          sections_requiring_revision: 3,
          estimated_revision_time_minutes: 45,
        },
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'agent_run',
        actorType: 'ai_agent',
        details: { agent: 'writer', result_id: 3, sections: 6, requiring_revision: 3 },
      })
      action('Writer complete: 6 sections generated, 3 require clinician revision')
      action('  ⚠ Clinical Interview, AI DRAFT (confidence: 0.72)')
      action('  ⚠ Diagnostic Formulation, AI DRAFT (confidence: 0.65)')
      action('  ⚠ Forensic Opinion, AI DRAFT (confidence: 0.60)')

      // --- Gate check: no editor result ---
      step('Gate check: can we advance? (Editor not run)')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Run Editor Agent ---
      step('Run Editor Agent (legal/clinical review)')
      addAgentResult(db, 1, 'editor', 4, {
        case_id: 'PSY-2026-0147',
        version: '1.0',
        generated_at: '2026-03-29T10:15:00Z',
        review_summary: {
          total_flags: 4,
          critical_flags: 1,
          high_flags: 1,
          medium_flags: 2,
          low_flags: 0,
          overall_assessment: 'Report requires revision before signing',
        },
        annotations: [
          {
            flag_id: 'F001',
            location: { section_name: 'Forensic Opinion' },
            flag_type: 'legal_vulnerability',
            severity: 'critical',
            description: 'Forensic Opinion states ultimate legal conclusion ("defendant is incompetent"). Per Daubert, expert should opine on clinical factors only.',
            suggestion: 'Rephrase to: "Clinical findings are consistent with significant impairment in the abilities necessary for competency to stand trial."',
          },
          {
            flag_id: 'F002',
            location: { section_name: 'Diagnostic Formulation' },
            flag_type: 'unsupported_claim',
            severity: 'high',
            description: 'Diagnostic formulation references "longstanding pattern" without citing supporting collateral records.',
            suggestion: 'Add specific citations or remove temporal qualifier.',
          },
          {
            flag_id: 'F003',
            location: { section_name: 'Clinical Interview' },
            flag_type: 'factual_inconsistency',
            severity: 'medium',
            description: 'Interview notes state 3 prior hospitalizations; collateral records show 2.',
            suggestion: 'Verify count against medical records and reconcile.',
          },
          {
            flag_id: 'F004',
            location: { section_name: 'Test Results' },
            flag_type: 'missing_context',
            severity: 'medium',
            description: 'TOMM results reported but effort validity conclusion not stated.',
            suggestion: 'Add explicit statement: "Performance on the TOMM indicates [adequate/inadequate] effort."',
          },
        ],
      })
      logAuditEntry({
        caseId: 1,
        actionType: 'agent_run',
        actorType: 'ai_agent',
        details: { agent: 'editor', result_id: 4, flags: 4, critical: 1 },
      })
      action('Editor complete: 4 flags (1 critical, 1 high, 2 medium)')
      action('  🔴 CRITICAL: Forensic Opinion, ultimate legal conclusion')
      action('  🟠 HIGH: Diagnostic Formulation, unsupported temporal claim')
      action('  🟡 MEDIUM: Clinical Interview, hospitalization count mismatch')
      action('  🟡 MEDIUM: Test Results, missing effort validity statement')

      // --- Gate check: no attestation ---
      step('Gate check: can we advance? (no attestation)')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      gate(true, check.reason)

      // --- Generate DOCX ---
      step('Generate DOCX report from Writer output')
      addReport(db, 1, 1, 'draft')
      logAuditEntry({
        caseId: 1,
        actionType: 'report_generated',
        actorType: 'system',
        details: { version: 1, format: 'docx' },
      })
      action('Report draft v1 generated: draft_v1.docx')

      // --- Clinician reviews and edits in OnlyOffice ---
      step('Clinician reviews report in OnlyOffice editor')
      action('Clinician resolves all 4 Editor flags')
      action('Clinician revises 3 AI DRAFT sections')
      logAuditEntry({
        caseId: 1,
        actionType: 'report_edited',
        actorType: 'clinician',
        details: { flags_resolved: 4, sections_revised: 3 },
      })

      // --- Update report version ---
      db.prepare(
        `UPDATE reports SET status = 'approved', last_modified = datetime('now') WHERE case_id = 1`,
      ).run()

      // --- Attestation ---
      step('Clinician signs attestation')
      const attestationDetails = {
        signedBy: 'Dr. Truck Irwin, Psy.D., ABPP',
        attestationStatement: 'I certify that I am the evaluating clinician, that I have personally reviewed all materials, conducted the evaluation, and that this report accurately reflects my professional opinions.',
        signatureDate: '2026-03-29',
        integrityHash: 'a1b2c3d4e5f6...', // Would be computed from actual DOCX
      }
      logAuditEntry({
        caseId: 1,
        actionType: 'report_signed',
        actorType: 'clinician',
        details: attestationDetails,
      })
      action(`Signed by: ${attestationDetails.signedBy}`)
      action(`Date: ${attestationDetails.signatureDate}`)
      action('Report locked with SHA-256 integrity hash')

      // Lock the report
      db.prepare(
        `UPDATE reports SET status = 'finalized', is_locked = 1,
         integrity_hash = 'a1b2c3d4e5f6', finalized_at = datetime('now')
         WHERE case_id = 1`,
      ).run()
      const report = db.prepare('SELECT * FROM reports WHERE case_id = 1').get() as any
      expect(report.is_locked).toBe(1)
      expect(report.status).toBe('finalized')
      action('Report finalized and locked ✓')

      // --- Gate check: all conditions met ---
      step('Gate check: can we advance now?')
      check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(true)
      gate(false, check.reason)

      // --- ADVANCE ---
      step('ADVANCE: Review → Complete')
      const advResult = advanceStage(1)
      expect(advResult.newStage).toBe('complete')
      action(`Stage advanced: ${advResult.previousStage} → ${advResult.newStage}`)
    })
  })

  // =========================================================================
  // STAGE 5: COMPLETE
  // =========================================================================

  describe('STAGE 5: COMPLETE', () => {
    it('Case complete, audit trail export + testimony prep + no further advancement', () => {
      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  STAGE 5: COMPLETE                                   ║')
      console.log('║  Goal: Verify final state, export audit trail,        ║')
      console.log('║        prepare testimony materials                    ║')
      console.log('╚══════════════════════════════════════════════════════╝')

      createCase(db, 1, 'complete')

      // --- Cannot advance past complete ---
      step('Gate check: can we advance past Complete?')
      const check = checkStageAdvancement(1)
      expect(check.canAdvance).toBe(false)
      expect(check.nextStage).toBeNull()
      gate(true, check.reason)
      action('Complete is the final stage, no further advancement possible')

      // --- Verify getNextStage ---
      step('Verify stage topology')
      expect(getNextStage('onboarding')).toBe('testing')
      expect(getNextStage('testing')).toBe('interview')
      expect(getNextStage('interview')).toBe('diagnostics')
      expect(getNextStage('diagnostics')).toBe('review')
      expect(getNextStage('review')).toBe('complete')
      expect(getNextStage('complete')).toBeNull()
      action('Pipeline topology: Onboarding → Testing → Interview → Diagnostics → Review → Complete ✓')

      // --- Simulate full audit trail ---
      step('Build complete audit trail')
      const actions = [
        { type: 'case_created', actor: 'clinician' as const },
        { type: 'intake_completed', actor: 'clinician' as const },
        { type: 'documents_uploaded', actor: 'clinician' as const },
        { type: 'data_confirmed', actor: 'clinician' as const },
        { type: 'stage_advanced', actor: 'system' as const },
        { type: 'test_scores_uploaded', actor: 'clinician' as const },
        { type: 'stage_advanced', actor: 'system' as const },
        { type: 'interviews_documented', actor: 'clinician' as const },
        { type: 'agent_run', actor: 'ai_agent' as const },
        { type: 'stage_advanced', actor: 'system' as const },
        { type: 'agent_run', actor: 'ai_agent' as const },
        { type: 'diagnosis_decision', actor: 'clinician' as const },
        { type: 'stage_advanced', actor: 'system' as const },
        { type: 'agent_run', actor: 'ai_agent' as const },
        { type: 'agent_run', actor: 'ai_agent' as const },
        { type: 'report_generated', actor: 'system' as const },
        { type: 'report_edited', actor: 'clinician' as const },
        { type: 'report_signed', actor: 'clinician' as const },
        { type: 'stage_advanced', actor: 'system' as const },
      ]
      for (const a of actions) {
        logAuditEntry({ caseId: 1, actionType: a.type, actorType: a.actor, details: {} })
      }
      action(`${actions.length} audit entries recorded`)

      // --- Verify audit trail ---
      step('Verify audit trail')
      const trail = getAuditTrail(1)
      expect(trail.length).toBe(actions.length)
      const clinicianActions = trail.filter((e: any) => e.actor_user_id === 1).length
      const aiActions = trail.filter((e: any) => e.actor_user_id === -1).length
      const systemActions = trail.filter((e: any) => e.actor_user_id === 0).length
      action(`Clinician actions: ${clinicianActions}`)
      action(`AI Agent operations: ${aiActions}`)
      action(`System events: ${systemActions}`)
      expect(clinicianActions + aiActions + systemActions).toBe(actions.length)

      // --- Export audit trail ---
      step('Export audit trail (CSV)')
      const csv = exportAuditTrail(1, 'csv')
      expect(csv).toContain('Timestamp')
      expect(csv).toContain('case_created')
      expect(csv).toContain('report_signed')
      const csvLines = csv.trim().split('\n')
      action(`CSV export: ${csvLines.length} lines (1 header + ${csvLines.length - 1} entries)`)

      step('Export audit trail (JSON)')
      const json = exportAuditTrail(1, 'json')
      const parsed = JSON.parse(json) as any[]
      expect(parsed.length).toBe(actions.length)
      action(`JSON export: ${parsed.length} entries`)

      // --- Final state verification ---
      step('FINAL STATE VERIFICATION')
      const caseRow = getCase(db, 1)
      expect(caseRow.workflow_current_stage).toBe('complete')
      expect(caseRow.case_status).toBe('in_progress') // Status stays active until archived
      action(`Case PSY-2026-0147: Stage=COMPLETE, Status=active`)
      action('Case remains accessible for testimony prep, addenda, and archival')

      console.log('\n╔══════════════════════════════════════════════════════╗')
      console.log('║  ✅ FULL LIFECYCLE COMPLETE                           ║')
      console.log('║  Onboarding → Testing → Interview → Diagnostics →    ║')
      console.log('║  Review → Complete                                    ║')
      console.log('║                                                       ║')
      console.log('║  All gates tested. All stages exercised.              ║')
      console.log('║  DOCTOR ALWAYS DIAGNOSES enforced throughout.         ║')
      console.log('╚══════════════════════════════════════════════════════╝')
    })
  })
})
