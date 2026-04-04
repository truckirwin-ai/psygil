/**
 * Case Document Writer — generates .docx files on disk mirroring DB data.
 *
 * Each pipeline tab produces a corresponding Word document in the case folder:
 *   _Inbox/Patient_Intake.docx       — demographics, background, medical, clinical history
 *   Collateral/Referral_Information.docx — referral context, legal history, evaluation scope
 *   Testing/Testing_Summary.docx      — battery, validity, observations, ordered measures
 *   Interviews/Interview_Notes.docx   — per-session transcripts, MSE, observations, summaries
 *   Diagnostics/Diagnostic_Formulation.docx — conditions, formulations, final impressions
 *
 * These documents are regenerated on every save. They are BACKUP copies of DB data,
 * readable by any clinician, admin, or external party with folder access.
 *
 * Uses the `docx` npm package (already installed).
 */

import { existsSync, mkdirSync, promises as fsPromises } from 'fs'
import { join } from 'path'
import { getCaseById, getOnboardingSections } from '../cases'
import type { CaseRow, PatientIntakeRow, PatientOnboardingRow } from '../../shared/types'
import { getSqlite } from '../db/connection'

// ---------------------------------------------------------------------------
// Dynamic require for docx (same pattern as docx-generator.ts)
// ---------------------------------------------------------------------------

let Document: any, Packer: any, Paragraph: any, HeadingLevel: any, TextRun: any, AlignmentType: any

try {
  const m = require('docx') as typeof import('docx')
  Document = m.Document; Packer = m.Packer; Paragraph = m.Paragraph
  HeadingLevel = m.HeadingLevel; TextRun = m.TextRun; AlignmentType = m.AlignmentType
} catch (err) {
  console.error('[case-docs-writer] Failed to load docx module:', err)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function heading(text: string, level: 1 | 2 | 3 = 2): any {
  const hl = level === 1 ? HeadingLevel.HEADING_1
    : level === 3 ? HeadingLevel.HEADING_3
    : HeadingLevel.HEADING_2
  return new Paragraph({ text, heading: hl, spacing: { after: 120, before: level === 1 ? 0 : 200 } })
}

function labelValue(label: string, value: string | null | undefined): any {
  if (!value?.trim()) return null
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: value.trim(), size: 22 }),
    ],
    spacing: { after: 80 },
  })
}

function bodyText(text: string | null | undefined): any {
  if (!text?.trim()) return null
  return new Paragraph({ text: text.trim(), spacing: { after: 120 }, style: 'Normal' })
}

function sectionBlock(title: string, content: string | null | undefined): any[] {
  if (!content?.trim()) return []
  return [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 22, color: '333333' })],
      spacing: { after: 60, before: 160 },
    }),
    new Paragraph({ text: content.trim(), spacing: { after: 120 } }),
  ]
}

function emptyLine(): any {
  return new Paragraph({ text: '', spacing: { after: 80 } })
}

function timestampFooter(): any {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return new Paragraph({
    children: [new TextRun({ text: `Generated: ${now} UTC — This document is auto-generated from Psygil case data.`, italic: true, color: '888888', size: 18 })],
    spacing: { before: 400 },
  })
}

function compact(items: (any | null)[]): any[] {
  return items.filter(Boolean)
}

async function writeDocx(children: any[], filePath: string): Promise<void> {
  if (!Document) throw new Error('docx module not loaded')
  const dir = filePath.replace(/\/[^/]+$/, '')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const doc = new Document({ sections: [{ children }] })
  const buf = await Packer.toBuffer(doc)
  await fsPromises.writeFile(filePath, buf)
  console.log(`[case-docs] Wrote: ${filePath}`)
}

// ---------------------------------------------------------------------------
// Parse onboarding sections helper
// ---------------------------------------------------------------------------

function parseOnboardingSections(rows: readonly PatientOnboardingRow[]): Record<string, Record<string, string>> {
  const map: Record<string, Record<string, string>> = {}
  for (const row of rows) {
    try { map[row.section] = JSON.parse(row.content) as Record<string, string> } catch { /* skip */ }
  }
  return map
}

function getIntakeRow(caseId: number): PatientIntakeRow | null {
  const sqlite = getSqlite()
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'").all() as Array<{ name: string }>
  if (tables.length === 0) return null
  return (sqlite.prepare('SELECT * FROM patient_intake WHERE case_id = ?').get(caseId) as PatientIntakeRow | undefined) ?? null
}

// ---------------------------------------------------------------------------
// 1. Patient Intake Document
// ---------------------------------------------------------------------------

async function writeIntakeDoc(caseRow: CaseRow, intakeRow: PatientIntakeRow | null, sections: Record<string, Record<string, string>>): Promise<string | null> {
  if (!caseRow.folder_path) return null
  const filePath = join(caseRow.folder_path, '_Inbox', 'Patient_Intake.docx')

  const demo = sections.contact ?? {}
  const fam = sections.family ?? {}
  const edu = sections.education ?? fam
  const complaints = sections.complaints ?? {}
  const health = sections.health ?? {}
  const mental = sections.mental ?? {}
  const substance = sections.substance ?? {}
  const recent = sections.recent ?? {}

  const children = compact([
    heading(`Patient Intake — ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue('Case Number', caseRow.case_number),
    labelValue('Evaluation Type', intakeRow?.eval_type ?? caseRow.evaluation_type),
    labelValue('Date of Birth', caseRow.examinee_dob),
    labelValue('Gender', caseRow.examinee_gender),
    labelValue('Intake Status', intakeRow?.status ?? 'N/A'),
    labelValue('Created', caseRow.created_at?.split('T')[0]),
    emptyLine(),

    // Demographics
    heading('Demographics & Contact', 2),
    labelValue('Primary Language', demo.primary_language),
    labelValue('Marital Status', demo.marital_status),
    labelValue('Dependents', demo.dependents),
    labelValue('Living Situation', demo.living_situation),
    labelValue('Phone', demo.phone),
    labelValue('Email', demo.email),
    labelValue('Address', demo.address),
    labelValue('Emergency Contact', demo.emergency_contact),
    labelValue('Eval Setting', demo.eval_setting),

    // Education & Employment
    heading('Education & Employment', 2),
    labelValue('Highest Education', edu.highest_education),
    labelValue('Employment Status', edu.employment_status),
    labelValue('Current Employer', edu.current_employer),
    labelValue('Military Service', edu.military_service),
    ...sectionBlock('Work History', edu.work_history),
    ...sectionBlock('Academic Experience', edu.academic_experience),

    // Family Background
    heading('Family Background', 2),
    ...sectionBlock('Family of Origin', fam.family_of_origin),
    ...sectionBlock('Current Family Relationships', fam.current_family_relationships),
    ...sectionBlock('Family Mental Health History', fam.family_mental_health),
    ...sectionBlock('Family Medical History', fam.family_medical_history),

    // Presenting Complaints
    heading('Presenting Complaints', 2),
    ...sectionBlock('Primary Complaint', complaints.primary_complaint ?? intakeRow?.presenting_complaint),
    ...sectionBlock('Stressors', complaints.stressors),
    ...sectionBlock('Symptom History', complaints.symptom_history),
    ...sectionBlock('Goals for Evaluation', recent?.goals_evaluation),

    // Medical History
    heading('Medical History', 2),
    ...sectionBlock('Medical Conditions', health.medical_conditions),
    ...sectionBlock('Current Medications', health.current_medications),
    ...sectionBlock('Head Injuries / Neurological', health.head_injuries),
    ...sectionBlock('Surgeries / Hospitalizations', health.surgeries),
    ...sectionBlock('Sleep Quality', health.sleep_quality),
    ...sectionBlock('Appetite / Weight Changes', health.appetite),
    ...sectionBlock('Chronic Pain', health.chronic_pain),

    // Mental Health History
    heading('Mental Health History', 2),
    ...sectionBlock('Previous Diagnoses', mental.previous_diagnoses),
    ...sectionBlock('Previous Treatment', mental.previous_treatment),
    ...sectionBlock('Psychiatric Medications', mental.psych_medications),
    ...sectionBlock('Hospitalizations', mental.hospitalizations),
    ...sectionBlock('Suicide / Self-Harm History', mental.self_harm_history),
    ...sectionBlock('Violence History', mental.violence_history),
    ...sectionBlock('Current Stressors', mental.current_stressors),

    // Substance Use
    heading('Substance Use History', 2),
    ...sectionBlock('Alcohol Use', substance.alcohol_use),
    ...sectionBlock('Drug Use', substance.drug_use),
    ...sectionBlock('Tobacco Use', substance.tobacco_use),
    ...sectionBlock('Treatment History', substance.treatment_history),
    ...sectionBlock('Current Use', substance.current_use),

    // Recent Events
    heading('Recent Events & Current Circumstances', 2),
    ...sectionBlock('Events / Circumstances', recent.events_circumstances),
    ...sectionBlock('Current Stressors', recent.current_stressors),
    ...sectionBlock('Goals for Evaluation', recent.goals_evaluation),

    // Referral info (brief, full referral doc is separate)
    heading('Referral Summary', 2),
    labelValue('Referral Source', intakeRow?.referral_source ?? caseRow.referral_source),
    labelValue('Referral Type', intakeRow?.referral_type),
    labelValue('Jurisdiction', intakeRow?.jurisdiction),
    ...sectionBlock('Charges', intakeRow?.charges),
    labelValue('Attorney', intakeRow?.attorney_name),
    labelValue('Report Deadline', intakeRow?.report_deadline),

    timestampFooter(),
  ])

  await writeDocx(children, filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// 2. Referral Information Document
// ---------------------------------------------------------------------------

async function writeReferralDoc(caseRow: CaseRow, intakeRow: PatientIntakeRow | null, sections: Record<string, Record<string, string>>): Promise<string | null> {
  if (!caseRow.folder_path) return null
  const filePath = join(caseRow.folder_path, 'Collateral', 'Referral_Information.docx')

  const legal = sections.legal ?? {}
  const refNotes = sections.referral_notes ?? {}

  const children = compact([
    heading(`Referral Information — ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue('Case Number', caseRow.case_number),
    labelValue('Evaluation Type', intakeRow?.eval_type ?? caseRow.evaluation_type),
    emptyLine(),

    heading('Referral Details', 2),
    labelValue('Referral Source', intakeRow?.referral_source ?? caseRow.referral_source),
    labelValue('Referral Type', intakeRow?.referral_type),
    labelValue('Jurisdiction', intakeRow?.jurisdiction),
    labelValue('Attorney', intakeRow?.attorney_name),
    labelValue('Report Deadline', intakeRow?.report_deadline),
    ...sectionBlock('Charges', intakeRow?.charges),
    ...sectionBlock('Evaluation Questions', caseRow.evaluation_questions),

    heading('Legal History', 2),
    ...sectionBlock('Criminal History', legal.criminal_history),
    ...sectionBlock('Prior Evaluations', legal.prior_evaluations),
    ...sectionBlock('Current Legal Status', legal.current_legal_status),
    ...sectionBlock('Probation / Parole', legal.probation_parole),

    // Clinician referral notes (if saved)
    ...(refNotes.referral ? [...sectionBlock('Clinician Notes — Referral Context', refNotes.referral)] : []),
    ...(refNotes.eval ? [...sectionBlock('Clinician Notes — Evaluation Scope', refNotes.eval)] : []),
    ...(refNotes.legal ? [...sectionBlock('Clinician Notes — Legal History Notes', refNotes.legal)] : []),

    timestampFooter(),
  ])

  await writeDocx(children, filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// 3. Testing Summary Document
// ---------------------------------------------------------------------------

async function writeTestingDoc(caseRow: CaseRow, sections: Record<string, Record<string, string>>): Promise<string | null> {
  if (!caseRow.folder_path) return null
  const filePath = join(caseRow.folder_path, 'Testing', 'Testing_Summary.docx')

  const testNotes = sections.testing_notes ?? {}

  const children = compact([
    heading(`Testing Summary — ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue('Case Number', caseRow.case_number),
    labelValue('Evaluation Type', caseRow.evaluation_type),
    emptyLine(),

    heading('Test Battery & Administration', 2),
    ...sectionBlock('Battery Selection Rationale', testNotes.battery),
    ...sectionBlock('Validity & Effort Indicators', testNotes.validity),
    ...sectionBlock('Testing Behavioral Observations', testNotes.observations),

    timestampFooter(),
  ])

  await writeDocx(children, filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// 4. Interview Notes Document
// ---------------------------------------------------------------------------

async function writeInterviewDoc(caseRow: CaseRow, sections: Record<string, Record<string, string>>): Promise<string | null> {
  if (!caseRow.folder_path) return null
  const filePath = join(caseRow.folder_path, 'Interviews', 'Interview_Notes.docx')

  const intNotes = sections.interview_notes ?? {}

  // intNotes is stored as JSON: { "session-1": { mse, rapport, observations }, ... }
  // Or it might be a flat structure — handle both
  const children: any[] = compact([
    heading(`Interview Notes — ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue('Case Number', caseRow.case_number),
    labelValue('Evaluation Type', caseRow.evaluation_type),
    emptyLine(),
  ])

  // Try to parse session-keyed notes
  const sessionKeys = Object.keys(intNotes).filter(k => k.startsWith('session'))
  if (sessionKeys.length > 0) {
    for (const sessionKey of sessionKeys) {
      const sessionData = intNotes[sessionKey]
      // sessionData might be a JSON string of { mse, rapport, observations }
      let parsed: Record<string, string> = {}
      if (typeof sessionData === 'string') {
        try { parsed = JSON.parse(sessionData) } catch { parsed = { notes: sessionData } }
      } else if (typeof sessionData === 'object') {
        parsed = sessionData as unknown as Record<string, string>
      }

      children.push(heading(`${sessionKey.replace('session-', 'Session ')}`, 2))
      children.push(...sectionBlock('Mental Status Examination', parsed.mse))
      children.push(...sectionBlock('Rapport & Engagement', parsed.rapport))
      children.push(...sectionBlock('Clinical Observations', parsed.observations))
      children.push(...sectionBlock('Transcript', parsed.transcript))
      children.push(...sectionBlock('Summary', parsed.summary))
    }
  } else {
    // Flat notes
    children.push(...sectionBlock('Mental Status Examination', intNotes.mse))
    children.push(...sectionBlock('Rapport & Engagement', intNotes.rapport))
    children.push(...sectionBlock('Clinical Observations', intNotes.observations))
  }

  children.push(timestampFooter())

  await writeDocx(children.filter(Boolean), filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// 5. Diagnostic Formulation Document
// ---------------------------------------------------------------------------

async function writeDiagnosticsDoc(caseRow: CaseRow, sections: Record<string, Record<string, string>>): Promise<string | null> {
  if (!caseRow.folder_path) return null
  const filePath = join(caseRow.folder_path, 'Diagnostics', 'Diagnostic_Formulation.docx')

  const diagNotes = sections.diagnostic_notes ?? {}

  const children: any[] = compact([
    heading(`Diagnostic Formulation — ${caseRow.examinee_last_name}, ${caseRow.examinee_first_name}`, 1),
    labelValue('Case Number', caseRow.case_number),
    labelValue('Evaluation Type', caseRow.evaluation_type),
    emptyLine(),
  ])

  // Parse diagnostic notes — structured as condition name → formulation text
  const conditionKeys = Object.keys(diagNotes).filter(k => !k.startsWith('_'))
  const metaKeys = Object.keys(diagNotes).filter(k => k.startsWith('_'))

  if (conditionKeys.length > 0) {
    children.push(heading('Diagnostic Considerations', 2))
    for (const condName of conditionKeys) {
      const formulation = diagNotes[condName]
      if (formulation?.trim()) {
        children.push(heading(condName, 3))
        children.push(bodyText(formulation))
      }
    }
  }

  // Final formulation fields (_impressions, _ruledOut, _validity, _prognosis)
  if (metaKeys.length > 0) {
    children.push(heading('Final Diagnostic Formulation', 2))
    children.push(...sectionBlock('Diagnostic Impressions', diagNotes._impressions))
    children.push(...sectionBlock('Conditions Ruled Out', diagNotes._ruledOut))
    children.push(...sectionBlock('Response Style & Validity', diagNotes._validity))
    children.push(...sectionBlock('Prognosis & Recommendations', diagNotes._prognosis))
  }

  children.push(timestampFooter())

  await writeDocx(children.filter(Boolean), filePath)
  return filePath
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Write a single tab's document to disk. Called after each save.
 * @param tab - Which document to regenerate
 */
export async function writeCaseDoc(
  caseId: number,
  tab: 'intake' | 'referral' | 'testing' | 'interview' | 'diagnostics',
): Promise<string | null> {
  const caseRow = getCaseById(caseId)
  if (!caseRow?.folder_path) return null

  const onboarding = getOnboardingSections(caseId)
  const sections = parseOnboardingSections(onboarding)
  const intakeRow = getIntakeRow(caseId)

  switch (tab) {
    case 'intake': return writeIntakeDoc(caseRow, intakeRow, sections)
    case 'referral': return writeReferralDoc(caseRow, intakeRow, sections)
    case 'testing': return writeTestingDoc(caseRow, sections)
    case 'interview': return writeInterviewDoc(caseRow, sections)
    case 'diagnostics': return writeDiagnosticsDoc(caseRow, sections)
    default: return null
  }
}

/**
 * Regenerate ALL documents for a case. Called on manual sync or case export.
 */
export async function syncAllCaseDocs(caseId: number): Promise<{ files: string[]; errors: string[] }> {
  const files: string[] = []
  const errors: string[] = []

  const tabs = ['intake', 'referral', 'testing', 'interview', 'diagnostics'] as const
  for (const tab of tabs) {
    try {
      const path = await writeCaseDoc(caseId, tab)
      if (path) files.push(path)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${tab}: ${msg}`)
      console.error(`[case-docs] Failed to write ${tab} doc for case ${caseId}:`, msg)
    }
  }

  return { files, errors }
}
