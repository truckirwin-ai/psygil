/**
 * One-shot script: generate all .docx documents for every case in the DB.
 * Run via: cd app && npx electron scripts/sync-case-docs.js
 */
const { app } = require('electron')

app.whenReady().then(async () => {
  try {
    const { join } = require('path')
    const os = require('os')
    const fs = require('fs')
    const Database = require('better-sqlite3-multiple-ciphers')
    const argon2 = require('argon2')

    // Derive encryption key (same as db/index.ts)
    const DEV_PASSPHRASE = 'psygil-dev-key-2026'
    const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')
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
    const hexKey = keyBuffer.toString('hex')

    // Open encrypted database — check known locations
    const electronDbPath = join(os.homedir(), 'Library', 'Application Support', 'psygil-app', 'psygil.db')
    const fallbackDbPath = join(os.homedir(), 'Library', 'Application Support', 'Psygil', 'psygil.db')
    const localDbPath = join(__dirname, '..', 'data', 'psygil.db')
    const dbPath = fs.existsSync(electronDbPath) ? electronDbPath
      : fs.existsSync(fallbackDbPath) ? fallbackDbPath
      : localDbPath

    console.log(`[sync] Opening database: ${dbPath}`)
    const db = new Database(dbPath)
    db.pragma("cipher='sqlcipher'")
    db.pragma(`key="x'${hexKey}'"`)

    // Verify
    const tableCount = db.prepare("SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().n
    console.log(`[sync] Database opened. ${tableCount} tables found.`)

    // Get all cases
    const cases = db.prepare('SELECT case_id, case_number, examinee_first_name, examinee_last_name, examinee_dob, examinee_gender, evaluation_type, referral_source, evaluation_questions, folder_path FROM cases WHERE case_status != ?').all('archived')
    console.log(`[sync] Found ${cases.length} active cases`)

    for (const c of cases) {
      console.log(`\n[sync] Case ${c.case_number}: ${c.examinee_last_name}, ${c.examinee_first_name}`)
      console.log(`[sync]   folder: ${c.folder_path}`)

      if (!c.folder_path) {
        console.log(`[sync]   SKIP: no folder_path`)
        continue
      }

      if (!fs.existsSync(c.folder_path)) {
        console.log(`[sync]   SKIP: folder does not exist on disk`)
        continue
      }

      // Get intake row
      const intakeTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_intake'").all()
      let intakeRow = null
      if (intakeTables.length > 0) {
        intakeRow = db.prepare('SELECT * FROM patient_intake WHERE case_id = ?').get(c.case_id) ?? null
      }

      // Get onboarding sections
      const obTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='patient_onboarding'").all()
      let obRows = []
      if (obTables.length > 0) {
        obRows = db.prepare('SELECT * FROM patient_onboarding WHERE case_id = ? ORDER BY section').all(c.case_id)
      }

      // Parse onboarding sections
      const sections = {}
      for (const row of obRows) {
        try { sections[row.section] = JSON.parse(row.content) } catch { /* skip */ }
      }

      console.log(`[sync]   intake: ${intakeRow ? 'yes' : 'no'}, onboarding sections: ${obRows.length}`)
      console.log(`[sync]   sections: ${Object.keys(sections).join(', ') || 'none'}`)

      // Now generate docx files using the docx module
      const docx = require('docx')
      const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx

      function heading(text, level = 2) {
        const hl = level === 1 ? HeadingLevel.HEADING_1 : level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2
        return new Paragraph({ text, heading: hl, spacing: { after: 120, before: level === 1 ? 0 : 200 } })
      }
      function lv(label, value) {
        if (!value || !String(value).trim()) return null
        return new Paragraph({
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 22 }),
            new TextRun({ text: String(value).trim(), size: 22 }),
          ],
          spacing: { after: 80 },
        })
      }
      function sb(title, content) {
        if (!content || !String(content).trim()) return []
        return [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 22, color: '333333' })],
            spacing: { after: 60, before: 160 },
          }),
          new Paragraph({ text: String(content).trim(), spacing: { after: 120 } }),
        ]
      }
      function footer() {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
        return new Paragraph({
          children: [new TextRun({ text: `Generated: ${now} UTC — Auto-generated from Psygil case data.`, italic: true, color: '888888', size: 18 })],
          spacing: { before: 400 },
        })
      }
      function compact(items) { return items.filter(Boolean) }

      async function writeDoc(children, filePath) {
        const dir = require('path').dirname(filePath)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        const doc = new Document({ sections: [{ children }] })
        const buf = await Packer.toBuffer(doc)
        fs.writeFileSync(filePath, buf)
        console.log(`[sync]   WROTE: ${filePath}`)
      }

      const name = `${c.examinee_last_name}, ${c.examinee_first_name}`
      // Section aliases — data lives in specific onboarding sections
      const demo = sections.contact || {}
      const fam = sections.family || {}        // also holds education/employment
      const complaints = sections.complaints || {}
      const health = sections.health || {}     // also holds mental health history
      const substance = sections.substance || {}
      const recent = sections.recent || {}
      const legal = sections.legal || {}
      const refNotes = sections.referral_notes || {}
      const testNotes = sections.testing_notes || {}
      const intNotes = sections.interview_notes || {}
      const diagNotes = sections.diagnostic_notes || {}

      // ── 1. Patient Intake ──────────────────────────────────────────────
      await writeDoc(compact([
        heading(`Patient Intake — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),
        lv('Gender', c.examinee_gender),
        lv('Intake Status', intakeRow?.status),

        heading('Demographics & Contact', 2),
        lv('Primary Language', demo.primary_language),
        lv('Marital Status', demo.marital_status),
        lv('Living Situation', demo.living_situation),
        lv('Dependents', demo.dependents),
        lv('Phone', demo.phone), lv('Email', demo.email),
        lv('Emergency Contact', demo.emergency_contact),

        heading('Education & Employment', 2),
        lv('Highest Education', fam.highest_education),
        lv('Schools Attended', fam.schools_attended),
        lv('Employment Status', fam.employment_status),
        lv('Current Employer', fam.current_employer),
        lv('Military Service', fam.military_service),
        ...sb('Work History', fam.work_history),
        ...sb('Academic Experience', fam.academic_experience),

        heading('Family Background', 2),
        ...sb('Family of Origin', fam.family_of_origin),
        ...sb('Current Family Relationships', fam.current_family_relationships),
        ...sb('Family Mental Health History', fam.family_mental_health),
        ...sb('Family Medical History', fam.family_medical_history),

        heading('Presenting Complaints', 2),
        ...sb('Primary Complaint', complaints.primary_complaint || (intakeRow && intakeRow.presenting_complaint)),
        ...sb('Secondary Concerns', complaints.secondary_concerns),
        ...sb('Onset & Timeline', complaints.onset_timeline),

        heading('Medical History', 2),
        ...sb('Medical Conditions', health.medical_conditions),
        ...sb('Current Medications', health.current_medications),
        ...sb('Surgeries & Hospitalizations', health.surgeries_hospitalizations),
        ...sb('Head Injuries / Neurological', health.head_injuries),
        ...sb('Sleep Quality', health.sleep_quality),
        ...sb('Appetite & Weight Changes', health.appetite_weight),

        heading('Mental Health History', 2),
        ...sb('Previous Diagnoses', health.previous_diagnoses),
        ...sb('Previous Treatment', health.previous_treatment),
        ...sb('Psychiatric Medications', health.psych_medications),
        ...sb('Suicide / Self-Harm History', health.self_harm_history),
        ...sb('Violence History', health.violence_history),

        heading('Substance Use History', 2),
        ...sb('Alcohol Use', substance.alcohol_use),
        ...sb('Drug Use', substance.drug_use),
        ...sb('Tobacco Use', substance.tobacco_use),
        ...sb('Substance Use Treatment', substance.substance_treatment),

        heading('Recent Events & Current Circumstances', 2),
        ...sb('Events / Circumstances', recent.events_circumstances),
        ...sb('Current Stressors', recent.current_stressors),
        ...sb('Goals for Evaluation', recent.goals_evaluation),

        heading('Referral Summary', 2),
        lv('Referral Source', intakeRow?.referral_source || c.referral_source),
        lv('Referral Type', intakeRow?.referral_type),
        lv('Jurisdiction / Case Number', intakeRow?.jurisdiction),
        ...sb('Charges / Legal Matter', intakeRow?.charges),
        lv('Attorney', intakeRow?.attorney_name),
        lv('Report Deadline', intakeRow?.report_deadline),
        ...sb('Presenting Complaint (Referral)', intakeRow?.presenting_complaint),
        footer(),
      ]), join(c.folder_path, '_Inbox', 'Patient_Intake.docx'))

      // ── 2. Referral Information ────────────────────────────────────────
      await writeDoc(compact([
        heading(`Referral Information — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),
        lv('Gender', c.examinee_gender),

        heading('Referral Details', 2),
        lv('Referral Source', intakeRow?.referral_source || c.referral_source),
        lv('Referral Type', intakeRow?.referral_type),
        lv('Jurisdiction / Case Number', intakeRow?.jurisdiction),
        lv('Attorney', intakeRow?.attorney_name),
        lv('Report Deadline', intakeRow?.report_deadline),
        ...sb('Charges / Legal Matter', intakeRow?.charges),
        ...sb('Evaluation Questions', c.evaluation_questions),

        heading('Reason for Referral', 2),
        ...sb('Presenting Complaint', intakeRow?.presenting_complaint || complaints.primary_complaint),
        ...sb('Goals for Evaluation', recent.goals_evaluation),

        heading('Legal History', 2),
        ...sb('Criminal History', legal.criminal_history),
        ...sb('Prior Evaluations', legal.prior_evaluations),
        ...sb('Current Legal Status', legal.current_legal_status),
        ...sb('Probation / Parole', legal.probation_parole),

        heading('Events Leading to Referral', 2),
        ...sb('Events / Circumstances', recent.events_circumstances),
        ...sb('Current Stressors', recent.current_stressors),

        heading('Relevant Clinical Background', 2),
        ...sb('Previous Diagnoses', health.previous_diagnoses),
        ...sb('Previous Treatment', health.previous_treatment),
        ...sb('Violence History', health.violence_history),

        ...(refNotes.referral ? [heading('Clinician Notes', 2), ...sb('Referral Context', refNotes.referral)] : []),
        ...sb('Evaluation Scope', refNotes.eval),
        ...sb('Legal History Notes', refNotes.legal),
        footer(),
      ]), join(c.folder_path, 'Collateral', 'Referral_Information.docx'))

      // ── 3. Testing Summary ─────────────────────────────────────────────
      await writeDoc(compact([
        heading(`Testing Summary — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),

        heading('Evaluation Context', 2),
        ...sb('Presenting Complaint', complaints.primary_complaint || (intakeRow && intakeRow.presenting_complaint)),
        ...sb('Previous Diagnoses', health.previous_diagnoses),
        ...sb('Head Injuries / Neurological', health.head_injuries),

        heading('Test Battery & Administration', 2),
        ...sb('Battery Selection Rationale', testNotes.battery),
        ...sb('Validity & Effort Indicators', testNotes.validity),
        ...sb('Testing Behavioral Observations', testNotes.observations),
        footer(),
      ]), join(c.folder_path, 'Testing', 'Testing_Summary.docx'))

      // ── 4. Interview Notes ─────────────────────────────────────────────
      await writeDoc(compact([
        heading(`Interview Notes — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),

        heading('Evaluation Context', 2),
        ...sb('Presenting Complaint', complaints.primary_complaint || (intakeRow && intakeRow.presenting_complaint)),
        ...sb('Events / Circumstances', recent.events_circumstances),

        heading('Interview Sessions', 2),
        ...sb('Mental Status Examination', intNotes.mse),
        ...sb('Rapport & Engagement', intNotes.rapport),
        ...sb('Clinical Observations', intNotes.observations),
        footer(),
      ]), join(c.folder_path, 'Interviews', 'Interview_Notes.docx'))

      // ── 5. Diagnostic Formulation ──────────────────────────────────────
      const condKeys = Object.keys(diagNotes).filter(k => !k.startsWith('_'))
      const metaKeys = Object.keys(diagNotes).filter(k => k.startsWith('_'))
      const diagChildren = compact([
        heading(`Diagnostic Formulation — ${name}`, 1),
        lv('Case Number', c.case_number),
        lv('Evaluation Type', intakeRow?.eval_type || c.evaluation_type),
        lv('Date of Birth', c.examinee_dob),
      ])

      // Clinical summary for diagnostic context
      diagChildren.push(heading('Clinical Summary', 2))
      diagChildren.push(...sb('Presenting Complaint', complaints.primary_complaint || (intakeRow && intakeRow.presenting_complaint)))
      diagChildren.push(...sb('Secondary Concerns', complaints.secondary_concerns))
      diagChildren.push(...sb('Onset & Timeline', complaints.onset_timeline))

      diagChildren.push(heading('Relevant History', 2))
      diagChildren.push(...sb('Previous Diagnoses', health.previous_diagnoses))
      diagChildren.push(...sb('Previous Treatment', health.previous_treatment))
      diagChildren.push(...sb('Psychiatric Medications', health.psych_medications))
      diagChildren.push(...sb('Head Injuries / Neurological', health.head_injuries))
      diagChildren.push(...sb('Substance Use — Alcohol', substance.alcohol_use))
      diagChildren.push(...sb('Substance Use — Drugs', substance.drug_use))
      diagChildren.push(...sb('Self-Harm History', health.self_harm_history))
      diagChildren.push(...sb('Violence History', health.violence_history))

      if (condKeys.length > 0) {
        diagChildren.push(heading('Diagnostic Considerations', 2))
        for (const k of condKeys) {
          if (diagNotes[k] && diagNotes[k].trim()) {
            diagChildren.push(heading(k, 3))
            diagChildren.push(new Paragraph({ text: diagNotes[k].trim(), spacing: { after: 120 } }))
          }
        }
      }
      if (metaKeys.length > 0) {
        diagChildren.push(heading('Final Diagnostic Formulation', 2))
        diagChildren.push(...sb('Diagnostic Impressions', diagNotes._impressions))
        diagChildren.push(...sb('Conditions Ruled Out', diagNotes._ruledOut))
        diagChildren.push(...sb('Response Style & Validity', diagNotes._validity))
        diagChildren.push(...sb('Prognosis & Recommendations', diagNotes._prognosis))
      }
      diagChildren.push(footer())
      await writeDoc(diagChildren.filter(Boolean), join(c.folder_path, 'Diagnostics', 'Diagnostic_Formulation.docx'))
    }

    console.log('\n[sync] Done — all case documents written to disk.')
    db.close()
    app.quit()
  } catch (err) {
    console.error('[sync] FATAL:', err)
    app.quit()
  }
})
