/**
 * One-shot script: generate all .docx documents for every active case in the DB.
 *
 * Usage:  cd app && npx tsx scripts/sync-case-docs.ts
 *
 * Connects to the SQLCipher database, reads all active cases, and writes
 * 5 Word documents per case into the case folder structure on disk.
 */

import Database from 'better-sqlite3-multiple-ciphers'
import argon2 from 'argon2'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import os from 'os'

// ── Encryption ────────────────────────────────────────────────────────
const DEV_PASSPHRASE = 'psygil-dev-key-2026'
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')

// ── DB paths ──────────────────────────────────────────────────────────
const ELECTRON_DB_PATH = join(
  os.homedir(),
  'Library',
  'Application Support',
  'psygil-app',
  'psygil.db',
)

// ── docx helpers ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const docx = require('docx')
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx

function heading(text: string, level = 2) {
  const hl =
    level === 1
      ? HeadingLevel.HEADING_1
      : level === 3
        ? HeadingLevel.HEADING_3
        : HeadingLevel.HEADING_2
  return new Paragraph({
    text,
    heading: hl,
    spacing: { after: 120, before: level === 1 ? 0 : 200 },
  })
}

function lv(label: string, value: unknown) {
  if (!value || !String(value).trim()) return null
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22 }),
      new TextRun({ text: String(value).trim(), size: 22 }),
    ],
    spacing: { after: 80 },
  })
}

function sb(title: string, content: unknown) {
  if (!content || !String(content).trim()) return []
  return [
    new Paragraph({
      children: [
        new TextRun({ text: title, bold: true, size: 22, color: '333333' }),
      ],
      spacing: { after: 60, before: 160 },
    }),
    new Paragraph({
      text: String(content).trim(),
      spacing: { after: 120 },
    }),
  ]
}

function footer() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return new Paragraph({
    children: [
      new TextRun({
        text: `Generated: ${now} UTC — Auto-generated from Psygil case data.`,
        italic: true,
        color: '888888',
        size: 18,
      }),
    ],
    spacing: { before: 400 },
  })
}

function compact(items: unknown[]) {
  return items.filter(Boolean)
}

async function writeDoc(children: unknown[], filePath: string) {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const doc = new Document({ sections: [{ children }] })
  const buf = await Packer.toBuffer(doc)
  writeFileSync(filePath, buf)
  console.log(`  WROTE: ${filePath}`)
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  // 1. Derive encryption key
  console.log('[sync] Deriving encryption key...')
  const keyBuffer = await argon2.hash(DEV_PASSPHRASE, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })
  const hexKey = (keyBuffer as Buffer).toString('hex')

  // 2. Open encrypted database
  const dbPath = existsSync(ELECTRON_DB_PATH)
    ? ELECTRON_DB_PATH
    : join(process.cwd(), 'data', 'psygil.db')

  console.log(`[sync] Opening database: ${dbPath}`)
  if (!existsSync(dbPath)) {
    console.error('[sync] Database file not found!')
    process.exit(1)
  }

  const db = new Database(dbPath)
  db.pragma("cipher='sqlcipher'")
  db.pragma(`key="x'${hexKey}'"`)

  // Verify
  const tableCount = (
    db
      .prepare(
        "SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .get() as { n: number }
  ).n
  console.log(`[sync] Database opened. ${tableCount} tables found.`)

  // 3. Get all active cases
  const cases = db
    .prepare(
      'SELECT case_id, case_number, examinee_first_name, examinee_last_name, examinee_dob, examinee_gender, evaluation_type, folder_path FROM cases WHERE case_status != ?',
    )
    .all('archived') as Array<{
    case_id: number
    case_number: string
    examinee_first_name: string
    examinee_last_name: string
    examinee_dob?: string
    examinee_gender?: string
    evaluation_type?: string
    folder_path?: string
  }>

  console.log(`[sync] Found ${cases.length} active cases\n`)

  for (const c of cases) {
    const name = `${c.examinee_last_name}, ${c.examinee_first_name}`
    console.log(`[sync] Case ${c.case_number}: ${name}`)
    console.log(`  folder: ${c.folder_path || '(none)'}`)

    if (!c.folder_path) {
      console.log('  SKIP: no folder_path\n')
      continue
    }
    if (!existsSync(c.folder_path)) {
      console.log('  SKIP: folder does not exist on disk\n')
      continue
    }

    // Get intake row
    const intakeTables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'",
      )
      .all()
    let intakeRow: Record<string, unknown> | null = null
    if (intakeTables.length > 0) {
      intakeRow =
        (db
          .prepare('SELECT * FROM patient_intake WHERE case_id = ?')
          .get(c.case_id) as Record<string, unknown>) ?? null
    }

    // Get onboarding sections
    const obTables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='patient_onboarding'",
      )
      .all()
    let obRows: Array<{ section: string; content: string }> = []
    if (obTables.length > 0) {
      obRows = db
        .prepare(
          'SELECT * FROM patient_onboarding WHERE case_id = ? ORDER BY section',
        )
        .all(c.case_id) as Array<{ section: string; content: string }>
    }

    // Parse onboarding sections
    const sections: Record<string, Record<string, string>> = {}
    for (const row of obRows) {
      try {
        sections[row.section] = JSON.parse(row.content)
      } catch {
        /* skip */
      }
    }

    console.log(
      `  intake: ${intakeRow ? 'yes' : 'no'}, onboarding sections: ${obRows.length}`,
    )
    console.log(
      `  sections: ${Object.keys(sections).join(', ') || 'none'}`,
    )

    const demo = sections.contact || {}
    const fam = sections.family || {}
    const edu = sections.education || fam
    const complaints = sections.complaints || {}
    const health = sections.health || {}
    const mental = sections.mental || {}
    const substance = sections.substance || {}
    const recent = sections.recent || {}
    const legal = sections.legal || {}
    const refNotes = sections.referral_notes || {}
    const testNotes = sections.testing_notes || {}
    const intNotes = sections.interview_notes || {}
    const diagNotes = sections.diagnostic_notes || {}

    // 1. Patient Intake
    await writeDoc(
      compact([
        heading(`Patient Intake — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),
        lv('Gender', c.examinee_gender),
        lv('Intake Status', intakeRow?.status),
        heading('Demographics & Contact', 2),
        lv('Primary Language', demo.primary_language),
        lv('Marital Status', demo.marital_status),
        lv('Dependents', demo.dependents),
        lv('Living Situation', demo.living_situation),
        lv('Phone', demo.phone),
        lv('Email', demo.email),
        lv('Emergency Contact', demo.emergency_contact),
        heading('Education & Employment', 2),
        lv('Highest Education', edu.highest_education),
        lv('Employment Status', edu.employment_status),
        lv('Current Employer', edu.current_employer),
        lv('Military Service', edu.military_service),
        ...sb('Work History', edu.work_history),
        ...sb('Academic Experience', edu.academic_experience),
        heading('Family Background', 2),
        ...sb('Family of Origin', fam.family_of_origin),
        ...sb(
          'Current Family Relationships',
          fam.current_family_relationships,
        ),
        ...sb('Family Mental Health History', fam.family_mental_health),
        ...sb('Family Medical History', fam.family_medical_history),
        heading('Presenting Complaints', 2),
        ...sb(
          'Primary Complaint',
          complaints.primary_complaint ||
            (intakeRow && (intakeRow.presenting_complaint as string)),
        ),
        ...sb('Stressors', complaints.stressors),
        ...sb('Symptom History', complaints.symptom_history),
        heading('Medical History', 2),
        ...sb('Medical Conditions', health.medical_conditions),
        ...sb('Current Medications', health.current_medications),
        ...sb('Head Injuries / Neurological', health.head_injuries),
        ...sb('Sleep Quality', health.sleep_quality),
        ...sb('Chronic Pain', health.chronic_pain),
        heading('Mental Health History', 2),
        ...sb('Previous Diagnoses', mental.previous_diagnoses),
        ...sb('Previous Treatment', mental.previous_treatment),
        ...sb('Psychiatric Medications', mental.psych_medications),
        ...sb('Self-Harm History', mental.self_harm_history),
        ...sb('Violence History', mental.violence_history),
        heading('Substance Use History', 2),
        ...sb('Alcohol Use', substance.alcohol_use),
        ...sb('Drug Use', substance.drug_use),
        ...sb('Tobacco Use', substance.tobacco_use),
        ...sb('Treatment History', substance.treatment_history),
        heading('Recent Events', 2),
        ...sb('Events / Circumstances', recent.events_circumstances),
        ...sb('Current Stressors', recent.current_stressors),
        ...sb('Goals for Evaluation', recent.goals_evaluation),
        footer(),
      ]),
      join(c.folder_path, '_Inbox', 'Patient_Intake.docx'),
    )

    // 2. Referral
    await writeDoc(
      compact([
        heading(`Referral Information — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        heading('Referral Details', 2),
        lv(
          'Referral Source',
          intakeRow?.referral_source || (c as Record<string, unknown>).referral_source,
        ),
        lv('Referral Type', intakeRow?.referral_type),
        lv('Jurisdiction', intakeRow?.jurisdiction),
        lv('Attorney', intakeRow?.attorney_name),
        lv('Report Deadline', intakeRow?.report_deadline),
        ...sb('Charges', intakeRow?.charges as string),
        ...sb(
          'Evaluation Questions',
          (c as Record<string, unknown>).evaluation_questions as string,
        ),
        heading('Legal History', 2),
        ...sb('Criminal History', legal.criminal_history),
        ...sb('Prior Evaluations', legal.prior_evaluations),
        ...sb('Current Legal Status', legal.current_legal_status),
        ...sb('Clinician Notes — Referral', refNotes.referral),
        ...sb('Clinician Notes — Eval Scope', refNotes.eval),
        ...sb('Clinician Notes — Legal', refNotes.legal),
        footer(),
      ]),
      join(c.folder_path, 'Collateral', 'Referral_Information.docx'),
    )

    // 3. Testing
    await writeDoc(
      compact([
        heading(`Testing Summary — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', c.evaluation_type),
        heading('Test Battery & Administration', 2),
        ...sb('Battery Selection Rationale', testNotes.battery),
        ...sb('Validity & Effort Indicators', testNotes.validity),
        ...sb('Testing Behavioral Observations', testNotes.observations),
        footer(),
      ]),
      join(c.folder_path, 'Testing', 'Testing_Summary.docx'),
    )

    // 4. Interview Notes
    await writeDoc(
      compact([
        heading(`Interview Notes — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', c.evaluation_type),
        ...sb('Mental Status Examination', intNotes.mse),
        ...sb('Rapport & Engagement', intNotes.rapport),
        ...sb('Clinical Observations', intNotes.observations),
        footer(),
      ]),
      join(c.folder_path, 'Interviews', 'Interview_Notes.docx'),
    )

    // 5. Diagnostics
    const condKeys = Object.keys(diagNotes).filter(
      (k) => !k.startsWith('_'),
    )
    const metaKeys = Object.keys(diagNotes).filter((k) =>
      k.startsWith('_'),
    )
    const diagChildren = compact([
      heading(`Diagnostic Formulation — ${name}`, 1),
      lv('Case Number', c.case_number),
      lv('Evaluation Type', c.evaluation_type),
    ]) as unknown[]

    if (condKeys.length > 0) {
      diagChildren.push(heading('Diagnostic Considerations', 2))
      for (const k of condKeys) {
        if (diagNotes[k] && diagNotes[k].trim()) {
          diagChildren.push(heading(k, 3))
          diagChildren.push(
            new Paragraph({
              text: diagNotes[k].trim(),
              spacing: { after: 120 },
            }),
          )
        }
      }
    }
    if (metaKeys.length > 0) {
      diagChildren.push(heading('Final Diagnostic Formulation', 2))
      diagChildren.push(
        ...sb('Diagnostic Impressions', diagNotes._impressions),
      )
      diagChildren.push(
        ...sb('Conditions Ruled Out', diagNotes._ruledOut),
      )
      diagChildren.push(
        ...sb('Response Style & Validity', diagNotes._validity),
      )
      diagChildren.push(
        ...sb('Prognosis & Recommendations', diagNotes._prognosis),
      )
    }
    diagChildren.push(footer())
    await writeDoc(
      diagChildren.filter(Boolean),
      join(c.folder_path, 'Diagnostics', 'Diagnostic_Formulation.docx'),
    )

    console.log('')
  }

  console.log('[sync] Done — all case documents written to disk.')
  db.close()
}

main().catch((err) => {
  console.error('[sync] FATAL:', err)
  process.exit(1)
})
