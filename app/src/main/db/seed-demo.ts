/**
 * DEMO DATA SEED SCRIPT, Psygil
 *
 * Inserts 10 AI-generated (AIG) demo cases for UI development and testing.
 * All cases are tagged [AIG-DEMO] and contain no real patient data.
 *
 * Usage: npm run db:seed-demo
 *
 * Safe to run multiple times, skips cases that already exist by case_number.
 */

import { initDb, getSqlite } from './connection'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import os from 'os'

// ---------------------------------------------------------------------------
// Demo workspace path, creates ~/Documents/Psygil Cases (Demo)/ if missing
// ---------------------------------------------------------------------------
const DEMO_WORKSPACE = join(os.homedir(), 'Documents', 'Psygil Cases (Demo)')

const CASE_SUBFOLDERS = [
  '_Inbox', 'Collateral', 'Testing', 'Interviews',
  'Diagnostics', 'Reports', 'Archive'
]

function ensureFolder(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

// ---------------------------------------------------------------------------
// Demo case data, 10 cases across all 6 pipeline stages and eval types
// ---------------------------------------------------------------------------
const DEMO_CASES = [
  {
    case_number: 'AIG-2026-0001',
    first: 'Marcus',
    last: 'Johnson',
    mi: 'D',
    dob: '1992-03-15',
    gender: 'M',
    eval_type: 'CST',
    referral: 'Denver District Court',
    status: 'Diagnostics',
    questions: 'Can the defendant understand the nature of the proceedings and assist in their own defense?',
    notes: '[AIG-DEMO] Schizophrenia, First Episode. 3 sessions completed. Testing: MMPI-3, PAI, WAIS-V, TOMM, SIRS-2.',
  },
  {
    case_number: 'AIG-2026-0002',
    first: 'Sofia',
    last: 'Ramirez',
    mi: '',
    dob: '1985-07-22',
    gender: 'F',
    eval_type: 'Custody',
    referral: 'Arapahoe County Family Court',
    status: 'Interview',
    questions: 'Parenting capacity evaluation. Which parent should have primary residential custody?',
    notes: '[AIG-DEMO] 2 children (ages 6, 9). Allegations of substance use by father. Testing in progress: MMPI-3, MCMI-IV.',
  },
  {
    case_number: 'AIG-2026-0003',
    first: 'Terrence',
    last: 'Washington',
    mi: 'L',
    dob: '1979-11-04',
    gender: 'M',
    eval_type: 'Risk',
    referral: 'Jefferson County Probation',
    status: 'Complete',
    questions: 'Violence risk assessment. Is the defendant amenable to community supervision?',
    notes: '[AIG-DEMO] Antisocial PD with substance use history. PCL-R, HCR-20v3, MMPI-3 completed. Opinion: Moderate-High risk.',
  },
  {
    case_number: 'AIG-2026-0004',
    first: 'Yuki',
    last: 'Tanaka',
    mi: '',
    dob: '1967-05-30',
    gender: 'F',
    eval_type: 'Capacity',
    referral: 'El Paso County Probate',
    status: 'Review',
    questions: 'Does the respondent have testamentary capacity to execute a will?',
    notes: '[AIG-DEMO] Early Alzheimer type. MoCA=18, WAIS-V Processing Speed significantly impaired. Draft report under review.',
  },
  {
    case_number: 'AIG-2026-0005',
    first: 'Deshawn',
    last: 'Brown',
    mi: 'L',
    dob: '2003-09-18',
    gender: 'M',
    eval_type: 'CST',
    referral: 'Denver District Court',
    status: 'Onboarding',
    questions: 'Competency to stand trial, Murder 2nd degree charge.',
    notes: '[AIG-DEMO] New intake. No prior psych history on file. Referral received 2026-03-20.',
  },
  {
    case_number: 'AIG-2026-0006',
    first: 'Carmen',
    last: 'Rivera',
    mi: '',
    dob: '1990-02-14',
    gender: 'F',
    eval_type: 'PTSD',
    referral: 'Attorney, Personal Injury',
    status: 'Testing',
    questions: 'Did the plaintiff develop PTSD as a result of the workplace incident of September 2024?',
    notes: '[AIG-DEMO] Motor vehicle accident + occupational injury. CAPS-5, PCL-5, MMPI-3 administered. Awaiting scores.',
  },
  {
    case_number: 'AIG-2026-0007',
    first: 'Gerald',
    last: 'Hawkins',
    mi: 'R',
    dob: '1958-12-09',
    gender: 'M',
    eval_type: 'Capacity',
    referral: 'Boulder County Probate Court',
    status: 'Complete',
    questions: 'Capacity for financial decisions. Is a conservatorship warranted?',
    notes: '[AIG-DEMO] Vascular neurocognitive disorder. MoCA=14. Opinion: Lacks capacity, conservatorship recommended.',
  },
  {
    case_number: 'AIG-2026-0008',
    first: 'Aaliyah',
    last: 'Thompson',
    mi: 'N',
    dob: '1998-06-25',
    gender: 'F',
    eval_type: 'ADHD',
    referral: 'Physician, University Health',
    status: 'Complete',
    questions: 'Does the patient meet criteria for ADHD? What accommodations are indicated?',
    notes: '[AIG-DEMO] ADHD, Combined Presentation confirmed. CAARS, CPT-3, WAIS-V. Academic + workplace accommodations recommended.',
  },
  {
    case_number: 'AIG-2026-0009',
    first: 'Viktor',
    last: 'Petrov',
    mi: '',
    dob: '1975-04-03',
    gender: 'M',
    eval_type: 'Malingering',
    referral: 'Insurance, Disability Claim',
    status: 'Diagnostics',
    questions: 'Is the claimant exaggerating or fabricating psychiatric symptoms?',
    notes: '[AIG-DEMO] MMPI-3 validity scales elevated (FBS, Fp). SIRS-2 and TOMM in progress. Feigning suspected.',
  },
  {
    case_number: 'AIG-2026-0010',
    first: 'Priya',
    last: 'Sharma',
    mi: '',
    dob: '1982-08-16',
    gender: 'F',
    eval_type: 'CST',
    referral: 'Adams County District Court',
    status: 'Interview',
    questions: 'Competency to stand trial, Arson 1st degree.',
    notes: '[AIG-DEMO] Schizoaffective Disorder, Bipolar type. Currently medicated. 2 interviews completed. Testing: MMPI-3, PAI, WAIS-V.',
  },
]

// Pipeline stage → status mapping for cases table
const STATUS_MAP: Record<string, string> = {
  Onboarding: 'intake',
  Testing: 'in_progress',
  Interview: 'in_progress',
  Diagnostics: 'in_progress',
  Review: 'in_progress',
  Complete: 'completed',
}

const STAGE_MAP: Record<string, string> = {
  Onboarding: 'gate_1',
  Testing: 'gate_1',
  Interview: 'gate_1',
  Diagnostics: 'gate_2',
  Review: 'gate_2',
  Complete: 'finalized',
}

async function main() {
  await initDb()
  const db = getSqlite()

  // Ensure demo workspace exists
  ensureFolder(DEMO_WORKSPACE)

  // Ensure a demo user exists (user_id=1)
  const existingUser = db.prepare('SELECT user_id FROM users WHERE user_id = 1').get()
  if (!existingUser) {
    db.prepare(`
      INSERT INTO users (user_id, email, full_name, role, credentials, is_active, created_at)
      VALUES (1, 'demo@psygil.com', 'Dr. Demo Clinician', 'psychologist', 'Ph.D., ABPP', 1, CURRENT_DATE)
    `).run()
  }

  let inserted = 0
  let skipped = 0

  for (const c of DEMO_CASES) {
    // Check if case already exists
    const existing = db.prepare('SELECT case_id FROM cases WHERE case_number = ?').get(c.case_number)
    if (existing) {
      skipped++
      continue
    }

    // Insert case record
    const result = db.prepare(`
      INSERT INTO cases (
        case_number, primary_clinician_user_id,
        examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
        evaluation_type, referral_source, evaluation_questions,
        case_status, workflow_current_stage, notes, created_at
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE)
    `).run(
      c.case_number,
      c.first, c.last, c.dob, c.gender,
      c.eval_type, c.referral, c.questions,
      STATUS_MAP[c.status] ?? 'intake',
      STAGE_MAP[c.status] ?? 'gate_1',
      c.notes
    )

    // Create case folder on disk
    const folderName = `${c.case_number} ${c.last}, ${c.first}${c.mi ? ' ' + c.mi + '.' : ''}`
    const casePath = join(DEMO_WORKSPACE, folderName)
    ensureFolder(casePath)
    for (const sub of CASE_SUBFOLDERS) {
      ensureFolder(join(casePath, sub))
    }

    // Drop a README in _Inbox so the folder isn't empty
    const readmePath = join(casePath, '_Inbox', 'README.txt')
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath,
        `PSYGIL DEMO CASE, AI-GENERATED DATA\n` +
        `=====================================\n` +
        `Case: ${c.case_number}\n` +
        `Patient: ${c.first} ${c.last}\n` +
        `Eval Type: ${c.eval_type}\n` +
        `Stage: ${c.status}\n\n` +
        `This is a demo case containing no real patient data.\n` +
        `All information is AI-generated for UI development purposes.\n`
      )
    }

    inserted++
  }

}

main().catch(err => {
  console.error('[demo-seed] Error:', err)
  process.exit(1)
})
