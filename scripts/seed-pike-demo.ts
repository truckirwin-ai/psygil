/**
 * Pike Forensics demo seeder: 23 forensic psychology cases across all 6 pipeline stages.
 * Populates /Users/truckirwin/Desktop/Pike Forensics/ with realistic case folders and DB rows.
 *
 * Usage: cd app && npm rebuild better-sqlite3-multiple-ciphers && NODE_PATH="./shims:./node_modules" npx tsx ../scripts/seed-pike-demo.ts
 *
 * After running, restore Electron's native module:
 *   node scripts/electron-rebuild-clean.js
 */

import Database from 'better-sqlite3'
import argon2 from 'argon2'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WORKSPACE = '/Users/truckirwin/Desktop/Pike Forensics'
const DB_PATH = `${WORKSPACE}/.psygil/psygil.db`
const DEV_PASSPHRASE = 'psygil-dev-key-2026'
const DEV_SALT = Buffer.from('psygil-kdf-salt-v1')

const SUBFOLDERS = ['_Inbox', 'Collateral', 'Testing', 'Interviews', 'Diagnostics', 'Reports']

// ---------------------------------------------------------------------------
// Key derivation (matches src/main/db/index.ts exactly)
// ---------------------------------------------------------------------------

async function deriveKey(passphrase: string): Promise<string> {
  const keyBuffer = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
    salt: DEV_SALT,
    raw: true,
  })
  return (keyBuffer as Buffer).toString('hex')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

function stub(path: string, content: string): void {
  if (!existsSync(path)) writeFileSync(path, content, 'utf-8')
}

// ---------------------------------------------------------------------------
// Case data definitions
// ---------------------------------------------------------------------------

type Stage = 'onboarding' | 'testing' | 'interview' | 'diagnostics' | 'review' | 'complete'
type CaseStatus = 'intake' | 'in_progress' | 'completed'

interface PikeCase {
  num: string
  last: string
  first: string
  dob: string
  gender: string
  evalType: string
  referral: string
  questions: string
  stage: Stage
  status: CaseStatus
  notes: string
}

const CASES: PikeCase[] = [
  // Tier 1: Minimal onboarding (4 cases)
  {
    num: '2026-0601', last: 'Thompson', first: 'Marcus', dob: '1987-03-14', gender: 'M',
    evalType: 'CST', referral: 'Public Defender Office',
    questions: 'Does the defendant have a rational and factual understanding of the legal proceedings and the capacity to assist counsel in his own defense?',
    stage: 'onboarding', status: 'intake',
    notes: 'Charged with aggravated assault. Defense attorney questions competency to assist in own defense.',
  },
  {
    num: '2026-0602', last: 'Nguyen', first: 'Lisa', dob: '1995-08-22', gender: 'F',
    evalType: 'Custody', referral: 'Family Court, Judge Patricia Hernandez',
    questions: 'What is the parenting capacity of each parent? What custody arrangement serves the best interests of the minor children?',
    stage: 'onboarding', status: 'intake',
    notes: 'Contested custody. Mother alleges father has active substance abuse history.',
  },
  {
    num: '2026-0603', last: 'Okafor', first: 'David', dob: '1978-11-05', gender: 'M',
    evalType: 'Risk Assessment', referral: 'District Attorney, ADA Sarah Chen',
    questions: 'What is the defendant\'s risk for future violence? Are there factors that mitigate or elevate that risk?',
    stage: 'onboarding', status: 'intake',
    notes: 'Convicted of domestic violence (3 prior incidents). Prosecution seeks enhanced sentencing.',
  },
  {
    num: '2026-0604', last: 'Reeves', first: 'Sarah', dob: '2001-06-30', gender: 'F',
    evalType: 'Sanity (NGRI)', referral: 'Public Defender Maria Santos',
    questions: 'At the time of the alleged offense, did the defendant have a mental disease or defect that rendered her unable to appreciate the criminality of her conduct?',
    stage: 'onboarding', status: 'in_progress',
    notes: 'Charged with arson. Defense raising NGRI.',
  },

  // Tier 2: Onboarding complete, entering Testing (4 cases)
  {
    num: '2026-0605', last: 'Washington', first: 'Tamika', dob: '1990-02-18', gender: 'F',
    evalType: 'Custody', referral: 'Jefferson County Family Court',
    questions: 'What is the parenting capacity of each party? What residential custody arrangement is in the best interests of the children?',
    stage: 'testing', status: 'in_progress',
    notes: 'High-conflict custody. Onboarding complete. Testing phase initiated.',
  },
  {
    num: '2026-0606', last: 'Petrov', first: 'Andrei', dob: '1983-09-07', gender: 'M',
    evalType: 'CST', referral: 'Arapahoe County District Court',
    questions: 'Does the defendant have a rational and factual understanding of the nature of the charges and the court process? Can he meaningfully assist his attorney?',
    stage: 'testing', status: 'in_progress',
    notes: 'Charged with robbery and assault. Disorganized presentation at arraignment.',
  },
  {
    num: '2026-0607', last: 'Morales', first: 'Carlos', dob: '1975-04-12', gender: 'M',
    evalType: 'Fitness for Duty', referral: 'City of Pike Municipal HR Director',
    questions: 'Is the employee psychologically fit to return to his position as a law enforcement officer? If not, what conditions or treatment would be required?',
    stage: 'testing', status: 'in_progress',
    notes: 'Supervisor complaints of erratic behavior following use-of-force incident.',
  },
  {
    num: '2026-0608', last: 'Blackwell', first: 'Jasmine', dob: '1998-01-25', gender: 'F',
    evalType: 'Risk Assessment', referral: 'Adams County Probation Department',
    questions: 'What is the defendant\'s risk for future violence or reoffending? What dynamic risk factors are amenable to intervention?',
    stage: 'testing', status: 'in_progress',
    notes: 'Presentence risk evaluation. Two prior misdemeanor convictions.',
  },

  // Tier 3: Testing in progress or complete (4 cases)
  {
    num: '2026-0609', last: 'Chen', first: 'Wei', dob: '1988-07-19', gender: 'M',
    evalType: 'CST', referral: 'Denver District Court',
    questions: 'Does the defendant understand the nature and purpose of the criminal proceedings against him, and can he assist in his own defense?',
    stage: 'testing', status: 'in_progress',
    notes: 'MMPI-3 completed. WAIS-IV pending. Possible schizophrenia spectrum presentation.',
  },
  {
    num: '2026-0610', last: 'Sullivan', first: 'Patrick', dob: '1970-12-03', gender: 'M',
    evalType: 'CST', referral: 'El Paso County District Court',
    questions: 'Does the defendant have competency to stand trial? Are validity measures consistent with genuine response style?',
    stage: 'testing', status: 'in_progress',
    notes: 'Full battery completed. Defensive response style on MMPI-3. TOMM and WAIS-IV scored.',
  },
  {
    num: '2026-0611', last: 'Kim', first: 'Sung-Ho', dob: '1993-05-28', gender: 'M',
    evalType: 'Risk Assessment', referral: 'Colorado DOC Parole Board',
    questions: 'What is the examinee\'s risk for violent recidivism? What risk management strategies are indicated?',
    stage: 'testing', status: 'in_progress',
    notes: 'PCL-R and HCR-20V3 completed. Ready to advance to interview stage.',
  },
  {
    num: '2026-0612', last: 'Foster', first: 'Denise', dob: '1982-10-16', gender: 'F',
    evalType: 'Fitness for Duty', referral: 'Jefferson County Sheriff Office',
    questions: 'Is the deputy psychologically fit to return to full law enforcement duties? Are there conditions that must be met prior to return?',
    stage: 'testing', status: 'in_progress',
    notes: 'PAI administered and scored. Testing phase complete, ready to advance.',
  },

  // Tier 4: Interview stage (3 cases)
  {
    num: '2026-0613', last: 'Ramirez', first: 'Elena', dob: '1986-08-09', gender: 'F',
    evalType: 'Custody', referral: 'Douglas County Family Court, Judge Leonard Park',
    questions: 'What custody and parenting time arrangement is in the best interests of the minor children? Is either parent\'s functioning impaired in a way that affects parenting capacity?',
    stage: 'interview', status: 'in_progress',
    notes: 'Two interviews completed. Collateral from ex-spouse obtained.',
  },
  {
    num: '2026-0614', last: 'Mitchell', first: 'Terrance', dob: '1979-03-22', gender: 'M',
    evalType: 'CST', referral: 'Denver District Court, Judge Alicia Navarro',
    questions: 'Does the defendant have a rational and factual understanding of the criminal proceedings? Does he have the capacity to assist his attorney in preparing his defense?',
    stage: 'interview', status: 'in_progress',
    notes: 'Three interviews completed. Active psychotic symptoms. Responding to internal stimuli.',
  },
  {
    num: '2026-0615', last: 'Patel', first: 'Anjali', dob: '1991-11-14', gender: 'F',
    evalType: 'Custody', referral: 'Larimer County Family Court',
    questions: 'What parenting arrangement serves the best interests of the children? Are there psychological factors affecting either parent\'s fitness?',
    stage: 'interview', status: 'in_progress',
    notes: 'Evaluee interviewed x3, father interviewed x1, child therapist collateral obtained. Ingestor complete.',
  },

  // Tier 5: Diagnostics stage (3 cases)
  {
    num: '2026-0616', last: 'Rodriguez', first: 'Miguel', dob: '1984-06-01', gender: 'M',
    evalType: 'Risk Assessment', referral: 'Arapahoe County DA Office',
    questions: 'What is the defendant\'s risk for future violence? What criminogenic needs are present and what interventions would reduce risk?',
    stage: 'diagnostics', status: 'in_progress',
    notes: 'Diagnostician complete. ASPD and AUD rendered. CUD ruled out.',
  },
  {
    num: '2026-0617', last: 'Brooks', first: 'Deshawn', dob: '1996-02-27', gender: 'M',
    evalType: 'CST', referral: 'Denver District Court',
    questions: 'Does the defendant understand the nature of the proceedings and can he assist his attorney? Is restoration to competency feasible?',
    stage: 'diagnostics', status: 'in_progress',
    notes: 'Full diagnostics and clinical formulation complete. Ready for review.',
  },
  {
    num: '2026-0618', last: 'Yamamoto', first: 'Kenji', dob: '1987-01-15', gender: 'M',
    evalType: 'Custody', referral: 'Boulder County Family Court',
    questions: 'What custody arrangement is in the best interests of the children? Does either parent have a psychological condition that impairs parenting capacity?',
    stage: 'diagnostics', status: 'in_progress',
    notes: 'Full formulation approved. Ready to advance to review.',
  },

  // Tier 6: Review stage (2 cases)
  {
    num: '2026-0619', last: 'Williams', first: 'Angela', dob: '1980-09-08', gender: 'F',
    evalType: 'Fitness for Duty', referral: 'Colorado Springs Police Department HR',
    questions: 'Is the officer psychologically fit to return to full law enforcement duties? Are there restrictions or conditions required before return?',
    stage: 'review', status: 'in_progress',
    notes: 'Writer run complete. Two sections flagged for revision. Editor annotations present.',
  },
  {
    num: '2026-0620', last: 'Garcia', first: 'Maria', dob: '1993-04-17', gender: 'F',
    evalType: 'Custody', referral: 'Weld County Family Court, Judge Sandra Kim',
    questions: 'What parenting plan is in the best interests of the children? Are there psychological factors affecting either parent\'s fitness to parent?',
    stage: 'review', status: 'in_progress',
    notes: 'All report sections generated. Editor found 0 critical, 2 minor annotations. Attestation pending.',
  },

  // Tier 7: Complete (3 cases)
  {
    num: '2026-0621', last: 'Johnson', first: 'Robert', dob: '1976-07-20', gender: 'M',
    evalType: 'CST', referral: 'Denver District Court, Judge Marcus Webb',
    questions: 'Does the defendant have competency to stand trial? Is he able to assist counsel in his defense?',
    stage: 'complete', status: 'completed',
    notes: 'IST opinion rendered. Restoration recommended. Report sealed.',
  },
  {
    num: '2026-0622', last: 'Anderson', first: 'James', dob: '1969-05-11', gender: 'M',
    evalType: 'Risk Assessment', referral: 'Colorado DOC Parole Board',
    questions: 'What is the defendant\'s risk for future violence? What risk management conditions should be imposed if released?',
    stage: 'complete', status: 'completed',
    notes: 'Moderate-to-high risk opinion. ASPD and Narcissistic PD rendered. Report finalized.',
  },
  {
    num: '2026-0623', last: 'Taylor', first: 'Brianna', dob: '2000-12-09', gender: 'F',
    evalType: 'Sanity (NGRI)', referral: 'Public Defender Office, Atty. James Okafor',
    questions: 'At the time of the alleged offense, did the defendant have a mental disease or defect that rendered her unable to appreciate the criminality of her conduct or conform her conduct to the requirements of law?',
    stage: 'complete', status: 'completed',
    notes: 'NGRI opinion rendered. Bipolar I with psychotic features. Report sealed.',
  },
]

// ---------------------------------------------------------------------------
// Markdown document content generators
// ---------------------------------------------------------------------------

function intakeReferral(c: PikeCase): string {
  return `# Referral Letter

**Case Number:** ${c.num}
**Examinee:** ${c.last}, ${c.first}
**Date of Birth:** ${c.dob}
**Evaluation Type:** ${c.evalType}
**Referring Party:** ${c.referral}

## Referral Request

${c.questions}

## Presenting Circumstances

${c.notes}

## Requested Turnaround

Report requested within 30 days of evaluation completion. Please contact this office with any questions or scheduling needs.

**Referral Date:** 2026-03-${('0' + (parseInt(c.num.slice(-2)) % 28 + 1)).slice(-2)}
`
}

function intakeForm(c: PikeCase): string {
  const phones: Record<string, string> = {
    Thompson: '(719) 555-0142', Nguyen: '(303) 555-0287', Okafor: '(720) 555-0391',
    Reeves: '(719) 555-0104', Washington: '(303) 555-0512', Petrov: '(720) 555-0638',
    Morales: '(719) 555-0745', Blackwell: '(303) 555-0856', Chen: '(720) 555-0967',
    Sullivan: '(719) 555-0173', Kim: '(303) 555-0284', Foster: '(720) 555-0395',
    Ramirez: '(719) 555-0406', Mitchell: '(303) 555-0517', Patel: '(720) 555-0628',
    Rodriguez: '(719) 555-0739', Brooks: '(303) 555-0840', Yamamoto: '(720) 555-0951',
    Williams: '(719) 555-0162', Garcia: '(303) 555-0273', Johnson: '(720) 555-0384',
    Anderson: '(719) 555-0495', Taylor: '(303) 555-0506',
  }
  return `# Patient Intake Form

**Case Number:** ${c.num}
**Examinee:** ${c.first} ${c.last}
**Date of Birth:** ${c.dob}
**Gender:** ${c.gender === 'M' ? 'Male' : 'Female'}

## Contact Information

- **Address:** ${100 + parseInt(c.num.slice(-3))} Main Street, Colorado Springs, CO 80906
- **Phone:** ${phones[c.last] ?? '(719) 555-0100'}
- **Email:** ${c.first.toLowerCase()}.${c.last.toLowerCase()}@email.com

## Referral Information

- **Referral Source:** ${c.referral}
- **Evaluation Type:** ${c.evalType}
- **Referral Question:** ${c.questions}

## Insurance / Billing

- **Billing Party:** ${c.evalType.includes('Court') || c.evalType === 'CST' || c.evalType === 'Risk Assessment' || c.evalType === 'Sanity (NGRI)' ? 'Court / Public Defender' : 'Private Pay'}
- **Authorization:** On file

## Consent

Signed informed consent obtained prior to evaluation. Examinee informed of the non-confidential nature of the evaluation, the identity of the retaining party, and the intended use of the report.
`
}

function onboardingNarrative(c: PikeCase): string {
  const ageYear = 2026 - parseInt(c.dob.slice(0, 4))
  const pronouns = c.gender === 'F' ? ['she', 'her', 'her'] : ['he', 'him', 'his']
  return `# Onboarding Summary

**Case:** ${c.num} | ${c.last}, ${c.first} | Age ${ageYear} | ${c.evalType}

## Identifying Information

${c.first} ${c.last} is a ${ageYear}-year-old ${c.gender === 'F' ? 'female' : 'male'} referred for ${c.evalType} evaluation by ${c.referral}. ${pronouns[0].charAt(0).toUpperCase() + pronouns[0].slice(1)} was born on ${c.dob} and currently resides in the Colorado Springs metropolitan area.

## Presenting Complaint

${c.notes}

## Referral Questions

${c.questions}

## Demographic and Background Summary

${pronouns[0].charAt(0).toUpperCase() + pronouns[0].slice(1)} completed onboarding on 2026-03-${('0' + (parseInt(c.num.slice(-2)) % 28 + 1)).slice(-2)}. All six onboarding sections were reviewed with the examinee prior to the clinical interview. Contact information, insurance, family history, medical history, substance use history, and recent circumstances were documented. ${pronouns[0].charAt(0).toUpperCase() + pronouns[0].slice(1)} was cooperative throughout the onboarding process.

## Data Confirmation Status

All onboarding sections confirmed. Referral questions reviewed and documented. Timeline verified with referral materials.
`
}

function testingProtocol(c: PikeCase, instruments: string[]): string {
  return `# Testing Protocol and Score Summary

**Case:** ${c.num} | ${c.last}, ${c.first}
**Evaluation Type:** ${c.evalType}
**Testing Dates:** 2026-03-${('0' + (parseInt(c.num.slice(-2)) % 20 + 5)).slice(-2)} through 2026-04-${('0' + (parseInt(c.num.slice(-2)) % 10 + 1)).slice(-2)}

## Instruments Administered

${instruments.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Administration Notes

All tests administered in a standard clinical examination room. The examinee was given breaks as needed. Testing conditions were adequate. Instructions were provided in English. The examinee appeared to understand instructions and made a reasonable effort throughout testing.

## Validity Assessment

Embedded and stand-alone validity measures were administered as part of the battery. Results are interpreted in light of validity findings noted in the test score entries.
`
}

function interviewNotes(c: PikeCase): string {
  const isMale = c.gender === 'M'
  const pronoun = isMale ? 'he' : 'she'
  const pronounCap = isMale ? 'He' : 'She'
  const pronounPoss = isMale ? 'his' : 'her'

  const mseContent: Record<string, string> = {
    Mitchell: `## Mental Status Examination

- **Appearance:** Unkempt, poor hygiene. Clothing worn and disheveled.
- **Behavior:** Fidgeting, intermittent eye contact. Appeared to respond to internal stimuli on two occasions.
- **Speech:** Tangential, pressured at times. Volume variable.
- **Mood:** "I'm fine." Incongruent with behavior and affect.
- **Affect:** Blunted with occasional inappropriate smiling.
- **Thought Process:** Tangential, loose associations. Difficulty maintaining a coherent narrative.
- **Thought Content:** Paranoid ideation regarding jail staff. Reported belief that guards were recording ${pronounPoss} conversations.
- **Perceptual Disturbances:** Denied auditory hallucinations but paused and looked to the side on multiple occasions, consistent with attending to internal stimuli.
- **Cognition:** Alert, partially oriented. Correctly identified year but reported the wrong month and a date two weeks off. Could not name ${pronounPoss} attorney.
- **Insight/Judgment:** Severely impaired. Does not appreciate the seriousness of ${pronounPoss} charges.`,
    Thompson: `## Mental Status Examination

- **Appearance:** Casual dress, adequate grooming.
- **Behavior:** Cooperative, maintained appropriate eye contact.
- **Speech:** Normal rate and volume.
- **Mood:** "Stressed."
- **Affect:** Anxious, congruent with reported mood.
- **Thought Process:** Goal-directed.
- **Thought Content:** Preoccupied with legal situation. No paranoid ideation.
- **Perceptual Disturbances:** Denied.
- **Cognition:** Alert, oriented x4.
- **Insight/Judgment:** Limited insight into the nature of the charges.`,
  }

  const mseDefault = `## Mental Status Examination

- **Appearance:** Age-appropriate dress, adequate grooming.
- **Behavior:** Cooperative throughout the interview. Maintained appropriate eye contact.
- **Speech:** Normal rate, rhythm, and volume.
- **Mood:** "${c.evalType === 'Custody' ? 'Stressed about the kids' : c.evalType.includes('CST') ? 'Confused' : 'Okay, I guess.'}"
- **Affect:** ${c.gender === 'F' ? 'Anxious, tearful at times when discussing the children' : 'Mildly anxious, congruent with reported mood'}.
- **Thought Process:** Largely goal-directed.
- **Thought Content:** Preoccupied with legal and family circumstances. No suicidal or homicidal ideation.
- **Perceptual Disturbances:** Denied.
- **Cognition:** Alert, oriented x4.
- **Insight/Judgment:** ${c.evalType === 'CST' ? 'Limited. Described charges in vague terms.' : 'Fair to good.'}`

  return `# Clinical Interview Notes

**Case:** ${c.num} | ${c.last}, ${c.first}
**Interview Dates:** 2026-03-${('0' + (parseInt(c.num.slice(-2)) % 20 + 8)).slice(-2)}, 2026-04-${('0' + (parseInt(c.num.slice(-2)) % 8 + 2)).slice(-2)}
**Location:** Pike Forensics, 1122 Main St., Colorado Springs, CO

## Interview Summary

${c.first} ${c.last} participated in a clinical interview conducted across two sessions. ${pronounCap} presented as ${c.gender === 'F' ? 'a woman' : 'a man'} who appeared ${pronoun === 'he' ? 'his' : 'her'} stated age. ${pronounCap} was informed of the non-confidential nature of the evaluation prior to the commencement of the interview.

The interview covered presenting complaint, developmental and educational history, occupational history, relationship history, medical and psychiatric history, substance use history, and legal history.

## Behavioral Observations

${c.last === 'Mitchell' ? `The examinee presented in a highly disorganized manner. ${pronounPoss.charAt(0).toUpperCase() + pronounPoss.slice(1)} hygiene was poor and ${pronounPoss} clothing was disheveled. ${pronounCap} had significant difficulty maintaining focus and frequently lost track of the question being asked. On two occasions, ${pronoun} paused and appeared to respond to stimuli that were not externally present.` :
c.last === 'Ramirez' || c.evalType === 'Custody' ? `The examinee was cooperative and engaged throughout the interview. ${pronounCap} became tearful on several occasions when discussing ${pronounPoss} children. Grooming and dress were adequate. ${pronounCap} spoke at a normal rate and maintained appropriate eye contact.` :
`The examinee was cooperative and made adequate effort throughout the interview. Grooming and dress were appropriate. ${pronounCap} answered questions directly and did not appear to minimize or exaggerate.`}

${mseContent[c.last] ?? mseDefault}

## Summary of Clinical History

${c.notes}
`
}

function diagnosticFormulation(c: PikeCase): string {
  type DiagMap = Record<string, { dx: string; ruled: string; opinion: string }>
  const diagMap: DiagMap = {
    Rodriguez: {
      dx: 'Antisocial Personality Disorder (F60.2) and Alcohol Use Disorder, Moderate (F10.20)',
      ruled: 'Cannabis Use Disorder was considered but ruled out due to extended period of abstinence and insufficient current criteria.',
      opinion: 'The pattern of persistent disregard for others, impulsivity, and criminal history is consistent with Antisocial Personality Disorder. Alcohol use is a dynamic risk factor amenable to intervention.',
    },
    Brooks: {
      dx: 'Schizophrenia (F20.9) and Mild Intellectual Disability (F70)',
      ruled: 'Cannabis Use Disorder was considered but is in sustained remission and does not currently account for the psychotic symptoms.',
      opinion: 'Active schizophrenia is the primary psychiatric condition impairing competency. Intellectual disability compounds deficits in understanding the legal process. Both conditions are chronic and the combination significantly impairs competency-related abilities.',
    },
    Yamamoto: {
      dx: 'Generalized Anxiety Disorder (F41.1) and Adjustment Disorder with Anxious Mood (F43.20)',
      ruled: 'Major Depressive Disorder was considered and ruled out. Depressive symptoms are mild, reactive, and do not reach threshold for an independent MDD diagnosis.',
      opinion: 'Anxiety is a clinical concern but does not impair parenting capacity in a material way. Adjustment disorder symptoms are expected to remit as the custody process concludes.',
    },
    Johnson: {
      dx: 'Schizophrenia Spectrum Disorder (F20.9)',
      ruled: 'Malingering (Z76.5) was considered and ruled out. Validity measures were consistent with a genuine and severe symptom presentation.',
      opinion: 'Active schizophrenia renders the defendant not competent to stand trial. Inpatient restoration at a state psychiatric hospital is recommended.',
    },
    Anderson: {
      dx: 'Antisocial Personality Disorder (F60.2) and Narcissistic Personality Disorder (F60.81)',
      ruled: 'PTSD was considered and ruled out. No qualifying traumatic stressor was identified and the symptom profile is more parsimoniously explained by personality pathology.',
      opinion: 'Convergent findings from structured risk instruments, clinical interview, and psychological testing support a moderate-to-high risk classification for future violence.',
    },
    Taylor: {
      dx: 'Bipolar I Disorder with Psychotic Features, Most Recent Episode Manic (F31.2)',
      ruled: 'Borderline Personality Disorder was considered. Although some traits are present, the clinical picture is best accounted for by Bipolar I with psychotic features. A deferred diagnosis of BPD may be revisited following mood stabilization.',
      opinion: 'At the time of the alleged offense, the defendant was in the midst of an acute manic episode with psychotic features. She lacked the capacity to appreciate the nature and consequences of her actions.',
    },
  }
  const info = diagMap[c.last]
  if (!info) return `# Diagnostic Formulation\n\n**Case:** ${c.num}\n\nFormulation pending clinician review.\n`

  return `# Diagnostic Formulation

**Case:** ${c.num} | ${c.last}, ${c.first}
**Evaluation Type:** ${c.evalType}
**Clinician:** Dr. Robert Irwin, Psy.D.

## Diagnoses Rendered

${info.dx}

## Diagnoses Ruled Out

${info.ruled}

## Clinical Impressions

${info.opinion}

## Validity Assessment

Response style validity measures were reviewed as part of the diagnostic process. Test validity data, behavioral observations, and record review were examined for consistency. The diagnosis rendered reflects the clinician's independent professional judgment.

## Prognosis

Prognosis and treatment implications are addressed in the body of the report.

**Date:** 2026-04-${('0' + (parseInt(c.num.slice(-2)) % 15 + 3)).slice(-2)}
**Clinician Signature:** Dr. Robert Irwin, Psy.D. [PENDING ATTESTATION]
`
}

function reportDraftStub(c: PikeCase, version: number): string {
  return `# ${c.evalType} Evaluation Report

**DRAFT v${version} - CONFIDENTIAL - NOT FOR DISTRIBUTION**

**Examinee:** ${c.last}, ${c.first}
**Case Number:** ${c.num}
**Date of Birth:** ${c.dob}
**Referral Source:** ${c.referral}
**Evaluating Clinician:** Dr. Robert Irwin, Psy.D.
**Evaluation Dates:** 2026-03-10 through 2026-04-05

---

## 1. Referral Question

${c.questions}

## 2. Informed Consent and Notification of Purpose

The examinee was informed prior to the evaluation of its non-confidential nature, the identity of the retaining party, and the intended use of the report. Signed informed consent was obtained.

## 3. Records Reviewed

[Section generated by Writer agent. Review for completeness.]

## 4. Background History

[Draft section. Clinician review required before finalization.]

## 5. Clinical Interview Findings

[Draft section. Review for accuracy and completeness.]

## 6. Psychological Testing Results

[Draft section. Verify all score references against raw data.]

## 7. Diagnostic Formulation

[Draft section. Confirm diagnoses match the diagnostic_decisions table.]

## 8. Forensic Opinion

[Draft section requiring clinician attestation. See editor annotations.]

---

*This report was prepared using Psygil. All diagnostic and forensic opinions represent the independent professional judgment of the signing clinician.*
`
}

function finalReportStub(c: PikeCase): string {
  type OpinionMap = Record<string, string>
  const opinions: OpinionMap = {
    Johnson: 'Based on a review of the available records, psychological testing, and clinical interview, it is my professional opinion that Robert Johnson is NOT competent to stand trial at this time. He lacks both a factual and rational understanding of the legal proceedings due to active and severe psychotic symptoms consistent with Schizophrenia Spectrum Disorder. Inpatient restoration treatment at a state psychiatric facility is recommended.',
    Anderson: 'Based on convergent evidence from the PCL-R (Total Score = 31), HCR-20V3, psychological testing, and clinical interview, James Anderson presents at moderate-to-high risk for future violent behavior. The primary risk factors are static in nature and include a history of early-onset antisocial behavior, prior violence, and diagnosed Antisocial and Narcissistic Personality Disorders. Risk management through structured community supervision with firm, consistent limit-setting is recommended.',
    Taylor: 'It is my professional opinion that at the time of the alleged offense (the date specified in the charging documents), Brianna Taylor was experiencing an acute manic episode with psychotic features. As a result of this mental disease, she lacked the substantial capacity to appreciate the criminality of her conduct or to conform her conduct to the requirements of law. This opinion is offered to a reasonable degree of psychological certainty.',
  }

  return `# ${c.evalType} Evaluation Report

**FINAL - SEALED - ${c.num}**

**Examinee:** ${c.last}, ${c.first}
**Date of Birth:** ${c.dob}
**Case Number:** ${c.num}
**Referral Source:** ${c.referral}
**Evaluating Clinician:** Dr. Robert Irwin, Psy.D.
**Report Date:** 2026-04-15

---

## Forensic Opinion

${opinions[c.last] ?? 'Opinion on file. See sealed report.'}

---

*ATTESTATION: I attest that the contents of this report are true and accurate to the best of my knowledge and professional judgment.*

*Dr. Robert Irwin, Psy.D.*
*Colorado License PSY-11223344*
*Pike Forensics | Colorado Springs, CO*
*Date: 2026-04-15*

---
*This report was prepared using Psygil. Sealed with integrity hash on 2026-04-15.*
`
}

function collateralLetter(c: PikeCase): string {
  const collateralSources: Record<string, string> = {
    Ramirez: 'Interview with ex-spouse, Marco Ramirez, conducted telephonically on 2026-04-03. He reported concerns about the examinee\'s mental health and substance use. He described her as "overwhelmed" but "a good mother." He denied observing active substance use in the presence of the children.',
    Mitchell: 'Collateral interview with jail classification officer Sgt. Dana Williams conducted on 2026-03-28. She reported that the defendant frequently mutters to himself in his cell, refuses medication on approximately 30% of medication passes, and has been observed responding to stimuli not visible to staff on multiple occasions.',
    Patel: 'Collateral interview with the children\'s therapist, Dr. Laura Kim, Ph.D., conducted 2026-04-07. Dr. Kim reported that both children present as anxious but attached to both parents. She noted no indicators of parental alienation from either party.',
  }
  return `# Collateral Interview Notes

**Case:** ${c.num}

${collateralSources[c.last] ?? `Collateral interview scheduled. Documentation on file.`}
`
}

// ---------------------------------------------------------------------------
// Score data generators
// ---------------------------------------------------------------------------

interface ScoreRow {
  instrument: string
  abbrev: string
  date: string
  narrative: string
  scoresJson: string
  validityJson: string
}

function getScores(c: PikeCase): ScoreRow[] {
  const baseDate = `2026-03-${('0' + (parseInt(c.num.slice(-2)) % 18 + 10)).slice(-2)}`

  if (c.num === '2026-0609') {
    return [{
      instrument: 'Minnesota Multiphasic Personality Inventory, Third Edition',
      abbrev: 'MMPI-3',
      date: baseDate,
      narrative: 'The MMPI-3 validity scales indicated an over-reporting response style. Clinical scales RC1 (Somatic Complaints, T=72) and RC8 (Aberrant Experiences, T=68) are elevated, consistent with somatic preoccupation and unusual perceptual experiences.',
      scoresJson: JSON.stringify([
        { scale: 'RC1 (Somatic Complaints)', score: 72, type: 'T-score' },
        { scale: 'RC8 (Aberrant Experiences)', score: 68, type: 'T-score' },
        { scale: 'RC6 (Ideas of Persecution)', score: 71, type: 'T-score' },
        { scale: 'RC4 (Antisocial Behavior)', score: 55, type: 'T-score' },
      ]),
      validityJson: JSON.stringify([
        { scale: 'VRIN-r', score: 48, type: 'T-score', interpretation: 'Valid, inconsistent responding within normal limits' },
        { scale: 'TRIN-r', score: 52, type: 'T-score', interpretation: 'Valid' },
        { scale: 'F-r', score: 74, type: 'T-score', interpretation: 'Elevated, possible over-reporting' },
        { scale: 'Fp-r', score: 61, type: 'T-score', interpretation: 'Moderate elevation' },
      ]),
    }]
  }

  if (c.num === '2026-0610') {
    return [
      {
        instrument: 'Minnesota Multiphasic Personality Inventory, Third Edition',
        abbrev: 'MMPI-3',
        date: baseDate,
        narrative: 'Defensive response style. L-r scale markedly elevated (T=78), indicating under-reporting of psychological difficulties. Clinical scales suppressed. Profile interpreted cautiously as reflecting defensive presentation rather than genuine absence of psychopathology.',
        scoresJson: JSON.stringify([
          { scale: 'RC1', score: 48, type: 'T-score' },
          { scale: 'RC2 (Low Positive Emotions)', score: 45, type: 'T-score' },
          { scale: 'RC8', score: 50, type: 'T-score' },
        ]),
        validityJson: JSON.stringify([
          { scale: 'L-r (Uncommon Virtues)', score: 78, type: 'T-score', interpretation: 'Markedly elevated: defensive under-reporting' },
          { scale: 'K-r (Adjustment Validity)', score: 68, type: 'T-score', interpretation: 'Elevated: over-claimed adjustment' },
        ]),
      },
      {
        instrument: 'Test of Memory Malingering',
        abbrev: 'TOMM',
        date: baseDate,
        narrative: 'TOMM results are above the empirically established cutoff scores for credible performance. Trial 1: 47/50, Trial 2: 50/50, Retention: 49/50. This pattern is inconsistent with genuine memory impairment and supports adequate engagement with cognitive testing.',
        scoresJson: JSON.stringify([
          { scale: 'Trial 1', score: 47, type: 'raw', cutoff: 45 },
          { scale: 'Trial 2', score: 50, type: 'raw', cutoff: 45 },
          { scale: 'Retention Trial', score: 49, type: 'raw', cutoff: 45 },
        ]),
        validityJson: JSON.stringify([
          { scale: 'Cutoff (all trials)', score: 45, type: 'cutoff', interpretation: 'All scores exceed cutoff: credible performance' },
        ]),
      },
      {
        instrument: 'Wechsler Adult Intelligence Scale, Fourth Edition',
        abbrev: 'WAIS-IV',
        date: baseDate,
        narrative: 'FSIQ of 78 falls in the Borderline range (8th percentile). VCI=82 (12th percentile), PRI=74 (4th percentile). The VCI-PRI discrepancy of 8 points is not statistically significant. Processing speed and working memory indexes are also below average. Cognitive limitations are relevant to competency prong analysis.',
        scoresJson: JSON.stringify([
          { scale: 'FSIQ (Full Scale IQ)', score: 78, type: 'standard', percentile: 8 },
          { scale: 'VCI (Verbal Comprehension)', score: 82, type: 'standard', percentile: 12 },
          { scale: 'PRI (Perceptual Reasoning)', score: 74, type: 'standard', percentile: 4 },
          { scale: 'WMI (Working Memory)', score: 76, type: 'standard', percentile: 5 },
          { scale: 'PSI (Processing Speed)', score: 81, type: 'standard', percentile: 10 },
        ]),
        validityJson: JSON.stringify([]),
      },
    ]
  }

  if (c.num === '2026-0611') {
    return [
      {
        instrument: 'Hare Psychopathy Checklist, Revised',
        abbrev: 'PCL-R',
        date: baseDate,
        narrative: 'PCL-R Total Score of 28 falls above the commonly used research cutoff of 25 for significant psychopathy. Factor 1 (Interpersonal/Affective) score of 14 is elevated. Factor 2 (Social Deviance) score of 14 is also elevated. This profile is consistent with significant psychopathic traits.',
        scoresJson: JSON.stringify([
          { scale: 'Total Score', score: 28, type: 'raw', max: 40 },
          { scale: 'Factor 1 (Interpersonal/Affective)', score: 14, type: 'raw', max: 16 },
          { scale: 'Factor 2 (Social Deviance)', score: 14, type: 'raw', max: 18 },
        ]),
        validityJson: JSON.stringify([]),
      },
      {
        instrument: 'Historical Clinical Risk Management, Version 3',
        abbrev: 'HCR-20V3',
        date: baseDate,
        narrative: 'HCR-20V3 administered by trained evaluator. Historical items: 8/10. Clinical items: 4/10. Risk Management items: 4/10. Final structured professional judgment: HIGH risk for violence in the event of conditional release without intensive supervision.',
        scoresJson: JSON.stringify([
          { scale: 'H (Historical)', score: 8, type: 'raw', max: 10 },
          { scale: 'C (Clinical)', score: 4, type: 'raw', max: 10 },
          { scale: 'R (Risk Management)', score: 4, type: 'raw', max: 10 },
          { scale: 'Total', score: 16, type: 'raw', max: 30 },
        ]),
        validityJson: JSON.stringify([]),
      },
      {
        instrument: 'Minnesota Multiphasic Personality Inventory, Third Edition',
        abbrev: 'MMPI-3',
        date: baseDate,
        narrative: 'Validity scales within acceptable limits. RC4 (Antisocial Behavior, T=82) and RC9 (Hypomanic Activation, T=75) are markedly elevated. This profile is consistent with antisocial personality features, impulsivity, and disregard for rules and social norms.',
        scoresJson: JSON.stringify([
          { scale: 'RC4 (Antisocial Behavior)', score: 82, type: 'T-score' },
          { scale: 'RC9 (Hypomanic Activation)', score: 75, type: 'T-score' },
          { scale: 'AGG (Aggression)', score: 70, type: 'T-score' },
          { scale: 'RC6 (Ideas of Persecution)', score: 58, type: 'T-score' },
        ]),
        validityJson: JSON.stringify([
          { scale: 'F-r', score: 58, type: 'T-score', interpretation: 'Within acceptable limits' },
          { scale: 'L-r', score: 44, type: 'T-score', interpretation: 'Within acceptable limits' },
        ]),
      },
    ]
  }

  if (c.num === '2026-0612') {
    return [{
      instrument: 'Personality Assessment Inventory',
      abbrev: 'PAI',
      date: baseDate,
      narrative: 'PAI administered under standard conditions. DEP (Depression, T=71) and ANX (Anxiety, T=68) are clinically elevated. SOM (Somatic Complaints, T=65) is mildly elevated. BOR (Borderline Features, T=55) is within normal limits. The profile suggests a current stress reaction with depressive and anxious features. No evidence of feigning.',
      scoresJson: JSON.stringify([
        { scale: 'DEP (Depression)', score: 71, type: 'T-score' },
        { scale: 'ANX (Anxiety)', score: 68, type: 'T-score' },
        { scale: 'SOM (Somatic Complaints)', score: 65, type: 'T-score' },
        { scale: 'BOR (Borderline Features)', score: 55, type: 'T-score' },
        { scale: 'ANT (Antisocial Features)', score: 48, type: 'T-score' },
        { scale: 'AGG (Aggression)', score: 52, type: 'T-score' },
      ]),
      validityJson: JSON.stringify([
        { scale: 'ICN (Inconsistency)', score: 42, type: 'T-score', interpretation: 'Valid' },
        { scale: 'INF (Infrequency)', score: 50, type: 'T-score', interpretation: 'Valid' },
        { scale: 'NIM (Negative Impression)', score: 54, type: 'T-score', interpretation: 'Within acceptable limits' },
        { scale: 'PIM (Positive Impression)', score: 48, type: 'T-score', interpretation: 'Within acceptable limits' },
      ]),
    }]
  }

  // Default: no specific scores for this case
  return []
}

// ---------------------------------------------------------------------------
// Audit entry builder
// ---------------------------------------------------------------------------

interface AuditEntry {
  action_type: string
  action_date: string
  details: string
}

function buildAuditTrail(c: PikeCase, caseNum: number): AuditEntry[] {
  const entries: AuditEntry[] = []
  const baseDay = parseInt(c.num.slice(-2)) % 20
  const d = (offset: number): string => {
    const dt = new Date(2026, 2, baseDay + 1 + offset)
    return dt.toISOString().slice(0, 10)
  }

  entries.push({ action_type: 'case_created', action_date: d(0), details: JSON.stringify({ eval_type: c.evalType, referral: c.referral }) })

  const stageIdx = ['onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete'].indexOf(c.stage)

  if (stageIdx >= 0) {
    entries.push({ action_type: 'document_uploaded', action_date: d(1), details: JSON.stringify({ filename: 'referral_letter.md', type: 'referral' }) })
  }

  if (stageIdx >= 1) {
    entries.push({ action_type: 'gate_completed', action_date: d(2), details: JSON.stringify({ from: 'onboarding', to: 'testing' }) })
    entries.push({ action_type: 'document_uploaded', action_date: d(3), details: JSON.stringify({ filename: 'onboarding_summary.md' }) })
    entries.push({ action_type: 'test_score_entered', action_date: d(4), details: JSON.stringify({ instrument: 'MMPI-3' }) })
  }

  if (stageIdx >= 2) {
    entries.push({ action_type: 'gate_completed', action_date: d(5), details: JSON.stringify({ from: 'testing', to: 'interview' }) })
    entries.push({ action_type: 'document_uploaded', action_date: d(6), details: JSON.stringify({ filename: 'interview_notes.md' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(7), details: JSON.stringify({ agent: 'ingestor' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(7), details: JSON.stringify({ agent: 'ingestor', event: 'completed', status: 'success' }) })
  }

  if (stageIdx >= 3) {
    entries.push({ action_type: 'gate_completed', action_date: d(8), details: JSON.stringify({ from: 'interview', to: 'diagnostics' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(9), details: JSON.stringify({ agent: 'diagnostician' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(9), details: JSON.stringify({ agent: 'diagnostician', event: 'completed', status: 'success' }) })
    entries.push({ action_type: 'diagnosis_selected', action_date: d(10), details: JSON.stringify({ clinician: 'Dr. Robert Irwin', action: 'diagnostic decision recorded' }) })
  }

  if (stageIdx >= 4) {
    entries.push({ action_type: 'gate_completed', action_date: d(11), details: JSON.stringify({ from: 'diagnostics', to: 'review' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(12), details: JSON.stringify({ agent: 'writer' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(12), details: JSON.stringify({ agent: 'writer', event: 'completed', sections_generated: 6 }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(13), details: JSON.stringify({ agent: 'editor' }) })
    entries.push({ action_type: 'agent_invoked', action_date: d(13), details: JSON.stringify({ agent: 'editor', event: 'completed', annotations: 2 }) })
    entries.push({ action_type: 'report_generated', action_date: d(13), details: JSON.stringify({ version: 1 }) })
  }

  if (stageIdx >= 5) {
    // Complete cases: full lifecycle
    entries.push({ action_type: 'gate_completed', action_date: d(14), details: JSON.stringify({ from: 'review', to: 'complete' }) })
    entries.push({ action_type: 'case_modified', action_date: d(15), details: JSON.stringify({ version: 2, changes: 'clinician revisions applied' }) })
    entries.push({ action_type: 'attestation_signed', action_date: d(16), details: JSON.stringify({ signed_by: 'Dr. Robert Irwin, Psy.D.', license: 'PSY-11223344' }) })
    entries.push({ action_type: 'report_finalized', action_date: d(16), details: JSON.stringify({ format: 'PDF', sealed: true }) })
    entries.push({ action_type: 'document_uploaded', action_date: d(17), details: JSON.stringify({ filename: 'final_report.md', type: 'report' }) })

    // Taylor (case 23): extra entries for 40+ total
    if (c.last === 'Taylor') {
      for (let i = 0; i < 20; i++) {
        entries.push({ action_type: 'case_modified', action_date: d(i % 18), details: JSON.stringify({ event: `lifecycle_event_${i}` }) })
      }
      entries.push({ action_type: 'audit_export', action_date: d(10), details: JSON.stringify({ exported_by: 'Dr. Robert Irwin', purpose: 'peer consultation - NGRI opinion' }) })
    }

    if (c.last === 'Anderson') {
      for (let i = 0; i < 10; i++) {
        entries.push({ action_type: 'case_modified', action_date: d(i % 18), details: JSON.stringify({ event: `lifecycle_event_${i}` }) })
      }
    }
  }

  return entries
}

// ---------------------------------------------------------------------------
// Diagnostic decisions per case
// ---------------------------------------------------------------------------

interface DiagDecision {
  key: string
  icd_code: string
  name: string
  decision: 'render' | 'rule_out' | 'defer'
  notes: string
}

function getDiagDecisions(c: PikeCase): DiagDecision[] {
  type DxMap = Record<string, DiagDecision[]>
  const map: DxMap = {
    Rodriguez: [
      { key: 'aspd_f60.2', icd_code: 'F60.2', name: 'Antisocial Personality Disorder', decision: 'render', notes: 'Pervasive pattern of disregard for others since adolescence. Confirmed by history, testing (RC4 T=80), and collateral records.' },
      { key: 'aud_f10.20', icd_code: 'F10.20', name: 'Alcohol Use Disorder, Moderate', decision: 'render', notes: 'Met 5 of 11 DSM-5-TR criteria. Reports daily use, failed attempts to cut down, and continued use despite interpersonal consequences.' },
      { key: 'cud_f12.10', icd_code: 'F12.10', name: 'Cannabis Use Disorder, Mild', decision: 'rule_out', notes: 'Reports abstinence for 14 months. Insufficient current criteria for an active diagnosis. No residual cannabis-related impairment.' },
    ],
    Brooks: [
      { key: 'schizophrenia_f20.9', icd_code: 'F20.9', name: 'Schizophrenia', decision: 'render', notes: 'Meets DSM-5-TR criteria: auditory hallucinations, disorganized speech, disorganized behavior, and negative symptoms persisting for over 12 months.' },
      { key: 'mild_id_f70', icd_code: 'F70', name: 'Intellectual Disability, Mild', decision: 'render', notes: 'WAIS-IV FSIQ=64. Adaptive deficits confirmed by collateral report and Vineland-3 screening. Condition is longstanding and predates current charges.' },
      { key: 'cud_f12.10', icd_code: 'F12.10', name: 'Cannabis Use Disorder', decision: 'rule_out', notes: 'In sustained full remission for over 12 months. Psychotic symptoms predate and persist independent of cannabis use.' },
    ],
    Yamamoto: [
      { key: 'gad_f41.1', icd_code: 'F41.1', name: 'Generalized Anxiety Disorder', decision: 'render', notes: 'Excessive worry across multiple domains, difficulty controlling worry, physical tension, and sleep disturbance for more than 6 months.' },
      { key: 'adjustment_f43.20', icd_code: 'F43.20', name: 'Adjustment Disorder with Anxiety', decision: 'render', notes: 'Symptoms acutely exacerbated by divorce proceedings and custody dispute. GAD is the primary diagnosis; adjustment disorder captures the situational overlay.' },
      { key: 'mdd_f32.9', icd_code: 'F32.9', name: 'Major Depressive Disorder', decision: 'rule_out', notes: 'Depressive symptoms are mild and reactive. Insufficient duration and severity to meet threshold for an independent MDD diagnosis.' },
    ],
    Johnson: [
      { key: 'schizophrenia_f20.9', icd_code: 'F20.9', name: 'Schizophrenia Spectrum Disorder', decision: 'render', notes: 'Active positive and negative symptoms. Paranoid delusions, auditory hallucinations, disorganized thinking, and severely impaired social functioning.' },
      { key: 'malingering_z76.5', icd_code: 'Z76.5', name: 'Malingering', decision: 'rule_out', notes: 'TOMM above cutoff (T1=47, T2=50). SIRS-2 within normal limits. Behavioral observations are consistent with genuine psychotic disorder throughout all contacts.' },
    ],
    Anderson: [
      { key: 'aspd_f60.2', icd_code: 'F60.2', name: 'Antisocial Personality Disorder', decision: 'render', notes: 'PCL-R Total=31. Pervasive pattern of exploitation, deceitfulness, and disregard for others since before age 15.' },
      { key: 'npd_f60.81', icd_code: 'F60.81', name: 'Narcissistic Personality Disorder', decision: 'render', notes: 'Grandiosity, entitlement, lack of empathy, and exploitativeness are consistent features supported by multi-source data.' },
      { key: 'ptsd_f43.10', icd_code: 'F43.10', name: 'PTSD', decision: 'rule_out', notes: 'No qualifying traumatic stressor identified. Hypervigilance and reactivity are better accounted for by personality pathology.' },
    ],
    Taylor: [
      { key: 'bipolar1_f31.2', icd_code: 'F31.2', name: 'Bipolar I Disorder with Psychotic Features', decision: 'render', notes: 'Documented manic episode with grandiosity, decreased need for sleep, pressured speech, and flight of ideas. Psychotic features (delusions of special mission) present during index episode.' },
      { key: 'bpd_f60.3', icd_code: 'F60.3', name: 'Borderline Personality Disorder', decision: 'defer', notes: 'Some traits present. Deferred pending mood stabilization. Cannot reliably distinguish trait from state features in the context of an acute manic episode.' },
    ],
  }
  return map[c.last] ?? []
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const start = Date.now()
  console.log('[seed-pike-demo] Deriving encryption key...')
  const hexKey = await deriveKey(DEV_PASSPHRASE)

  console.log('[seed-pike-demo] Opening database...')
  const sqlite = new Database(DB_PATH)
  sqlite.pragma("cipher='sqlcipher'")
  sqlite.pragma(`key="x'${hexKey}'"`)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')

  // Verify DB is readable
  const check = sqlite.prepare("SELECT count(*) as n FROM sqlite_master WHERE type='table'").get() as { n: number }
  console.log(`[seed-pike-demo] DB open. Tables found: ${check.n}`)

  // Ensure all runtime-created tables exist
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
    );
    CREATE INDEX IF NOT EXISTS idx_test_scores_case ON test_scores(case_id);

    CREATE TABLE IF NOT EXISTS diagnostic_decisions (
      decision_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      diagnosis_key TEXT NOT NULL,
      icd_code TEXT NOT NULL DEFAULT '',
      diagnosis_name TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('render', 'rule_out', 'defer')),
      clinician_notes TEXT NOT NULL DEFAULT '',
      decided_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id, diagnosis_key)
    );
    CREATE INDEX IF NOT EXISTS idx_diag_decisions_case ON diagnostic_decisions(case_id);

    CREATE TABLE IF NOT EXISTS clinical_formulations (
      formulation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL REFERENCES cases(case_id),
      formulation_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(case_id)
    );
  `)

  // Ensure user exists
  const existingUser = sqlite.prepare('SELECT user_id FROM users WHERE user_id = 1').get()
  if (!existingUser) {
    sqlite.prepare(`
      INSERT OR IGNORE INTO users
        (user_id, email, full_name, role, credentials, license_number, state_licensed, is_active, created_at)
      VALUES (1, 'robert.irwin@pikeforensics.com', 'Dr. Robert Irwin', 'psychologist', 'Psy.D., ABPP-FP', 'PSY-11223344', 'CO', 1, '2026-01-01')
    `).run()
    console.log('[seed-pike-demo] Created user: Dr. Robert Irwin')
  } else {
    // Update name if it's a placeholder
    sqlite.prepare(`UPDATE users SET full_name = 'Dr. Robert Irwin', email = 'robert.irwin@pikeforensics.com' WHERE user_id = 1 AND full_name NOT LIKE '%Robert%'`).run()
  }

  const stmtCase = sqlite.prepare(`
    INSERT OR IGNORE INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage,
      folder_path, notes, created_at, last_modified
    ) VALUES (
      @case_number, 1,
      @first, @last, @dob, @gender,
      @evalType, @referral, @questions,
      @status, @stage,
      @folderPath, @notes, @createdAt, @createdAt
    )
  `)

  const stmtIntake = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtOnboarding = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_onboarding
      (case_id, section, content, verified, status, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'complete', ?, ?)
  `)

  const stmtDoc = sqlite.prepare(`
    INSERT OR IGNORE INTO documents (
      case_id, document_type, original_filename, file_path,
      file_size_bytes, mime_type, uploaded_by_user_id, upload_date
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `)

  const stmtScore = sqlite.prepare(`
    INSERT OR IGNORE INTO test_scores (
      case_id, instrument_name, instrument_abbrev, administration_date,
      data_entry_method, scores_json, validity_scores_json, clinical_narrative
    ) VALUES (?, ?, ?, ?, 'manual', ?, ?, ?)
  `)

  const stmtDiagDecision = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnostic_decisions
      (case_id, diagnosis_key, icd_code, diagnosis_name, decision, clinician_notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const stmtFormulation = sqlite.prepare(`
    INSERT OR IGNORE INTO clinical_formulations (case_id, formulation_text)
    VALUES (?, ?)
  `)

  const stmtAgentResult = sqlite.prepare(`
    INSERT OR IGNORE INTO agent_results
      (case_id, agent_type, operation_id, result_json, version, created_at)
    VALUES (?, ?, ?, ?, '1.0', ?)
  `)

  const stmtAudit = sqlite.prepare(`
    INSERT INTO audit_log
      (case_id, action_type, actor_user_id, action_date, details, granularity)
    VALUES (?, ?, 1, ?, ?, 'decision_record_only')
  `)

  const stmtReport = sqlite.prepare(`
    INSERT OR IGNORE INTO reports (
      case_id, report_version, generated_by_user_id,
      status, file_path, is_locked, integrity_hash,
      finalized_by_user_id, finalized_at, created_at, last_modified
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stmtDataConf = sqlite.prepare(`
    INSERT OR IGNORE INTO data_confirmation
      (case_id, category_id, status, notes, updated_at)
    VALUES (?, ?, 'confirmed', '', datetime('now'))
  `)

  let totalCases = 0
  let totalDocs = 0
  let totalAudit = 0

  const seedTx = sqlite.transaction(() => {
    for (const c of CASES) {
      const stageIdx = ['onboarding', 'testing', 'interview', 'diagnostics', 'review', 'complete'].indexOf(c.stage)
      const folderName = `${c.num} ${c.last}, ${c.first}`
      const casePath = join(WORKSPACE, 'cases', folderName)
      const createdAt = `2026-03-${('0' + (parseInt(c.num.slice(-2)) % 25 + 1)).slice(-2)}`

      // Create folder structure
      dir(casePath)
      for (const sub of SUBFOLDERS) dir(join(casePath, sub))
      dir(join(casePath, 'Reports', 'Archive'))
      dir(join(casePath, 'Reports', 'final'))

      // Insert case row
      const res = stmtCase.run({
        case_number: c.num,
        first: c.first,
        last: c.last,
        dob: c.dob,
        gender: c.gender,
        evalType: c.evalType,
        referral: c.referral,
        questions: c.questions,
        status: c.status,
        stage: c.stage,
        folderPath: casePath,
        notes: c.notes,
        createdAt,
      })

      if (res.changes === 0) {
        // Case already exists; update folder_path and continue
        sqlite.prepare('UPDATE cases SET folder_path = ? WHERE case_number = ?').run(casePath, c.num)
        console.log(`  [skip] ${c.num} ${c.last}, ${c.first} (already exists)`)
        continue
      }

      const caseId = Number(res.lastInsertRowid)
      totalCases++
      console.log(`  [+] ${c.num} ${c.last}, ${c.first} (stage: ${c.stage}, id: ${caseId})`)

      // ---- Tier 1: minimal (case 1 has no intake at all) ----
      if (c.num === '2026-0601') {
        // Referral letter stub in _Inbox
        const refPath = join(casePath, '_Inbox', 'referral_stub.md')
        stub(refPath, `# Referral\n\nReferral received. Intake not yet started.\n`)
        // No intake, no docs, no audit
        continue
      }

      // ---- Referral letter to disk + doc row for all other cases ----
      {
        const refPath = join(casePath, '_Inbox', 'referral_letter.md')
        stub(refPath, intakeReferral(c))
        stmtDoc.run(caseId, 'referral', 'referral_letter.md', refPath, Buffer.byteLength(intakeReferral(c)), 'text/markdown', createdAt)
        totalDocs++
      }

      // ---- Intake (partial for case 2, full for 3+) ----
      if (c.num === '2026-0602') {
        // Partial intake: contact info only, no insurance
        stmtIntake.run(caseId, 'court', c.referral, c.evalType, c.notes, 'draft', createdAt, createdAt)
        stmtOnboarding.run(caseId, 'contact', JSON.stringify({
          phone: '(303) 555-0287', email: 'lisa.nguyen@email.com',
          address: '702 Main Street, Colorado Springs, CO 80906',
        }), createdAt, createdAt)
        const auditEntries = buildAuditTrail(c, caseId)
        auditEntries.slice(0, 1).forEach(e => {
          stmtAudit.run(caseId, e.action_type, e.action_date, e.details)
          totalAudit++
        })
        continue
      }

      if (c.num === '2026-0603') {
        // Full intake, no documents beyond referral
        const refType = c.referral.toLowerCase().includes('attorney') ? 'attorney' : 'court'
        stmtIntake.run(caseId, refType, c.referral, c.evalType, c.notes, 'complete', createdAt, createdAt)
        stmtOnboarding.run(caseId, 'contact', JSON.stringify({
          phone: '(720) 555-0391', email: 'david.okafor@email.com',
          address: '503 Elm Ave, Pueblo, CO 81001',
        }), createdAt, createdAt)
        const auditEntries = buildAuditTrail(c, caseId)
        auditEntries.slice(0, 1).forEach(e => {
          stmtAudit.run(caseId, e.action_type, e.action_date, e.details)
          totalAudit++
        })
        continue
      }

      // ---- Full intake for cases 4+ ----
      const refType = c.referral.toLowerCase().includes('attorney') || c.referral.toLowerCase().includes('public defender') ? 'attorney'
        : c.referral.toLowerCase().includes('insurance') ? 'insurance'
        : c.referral.toLowerCase().includes('physician') ? 'physician'
        : 'court'
      stmtIntake.run(caseId, refType, c.referral, c.evalType, c.notes, stageIdx >= 1 ? 'complete' : 'draft', createdAt, createdAt)

      // ---- Case 4: referral document in _Inbox ----
      if (c.num === '2026-0604') {
        const intakePath = join(casePath, '_Inbox', 'intake_form.md')
        stub(intakePath, intakeForm(c))
        stmtDoc.run(caseId, 'other', 'intake_form.md', intakePath, Buffer.byteLength(intakeForm(c)), 'text/markdown', createdAt)
        totalDocs++
        stmtAudit.run(caseId, 'case_created', createdAt, JSON.stringify({ eval_type: c.evalType }))
        stmtAudit.run(caseId, 'document_uploaded', createdAt, JSON.stringify({ filename: 'intake_form.md' }))
        totalAudit += 2
        continue
      }

      // ---- Stages 1+: full onboarding ----
      if (stageIdx >= 1) {
        const onboardingPath = join(casePath, 'Collateral', 'onboarding_summary.md')
        stub(onboardingPath, onboardingNarrative(c))
        stmtDoc.run(caseId, 'other', 'onboarding_summary.md', onboardingPath, Buffer.byteLength(onboardingNarrative(c)), 'text/markdown', createdAt)
        totalDocs++

        // Onboarding sections
        const sections = ['contact', 'complaints', 'family', 'health', 'mental', 'substance']
        const onboardingData: Record<string, Record<string, string>> = {
          contact: { phone: '(719) 555-0100', address: '123 Maple Dr, Colorado Springs, CO 80906', living_situation: 'Lives alone' },
          complaints: { primary: c.notes, referral_question: c.questions },
          family: { marital_status: 'Single', children: 'None reported', family_history: 'Parental history of anxiety reported' },
          health: { conditions: 'No significant medical conditions', medications: 'None reported', head_injuries: 'None reported' },
          mental: { prior_treatment: 'None reported', prior_diagnoses: 'None', hospitalizations: 'None' },
          substance: { alcohol: 'Social use', drugs: 'Denies illicit drug use', treatment: 'None' },
        }
        for (const section of sections) {
          stmtOnboarding.run(caseId, section, JSON.stringify(onboardingData[section] ?? {}), createdAt, createdAt)
        }

        // Data confirmation
        stmtDataConf.run(caseId, 'demographics')
        stmtDataConf.run(caseId, 'referral_questions')
        stmtDataConf.run(caseId, 'timeline')
        stmtDataConf.run(caseId, 'collateral_records')

        // Stage-appropriate documents in Collateral
        const collateral = stageIdx >= 2 ? 4 : 2
        for (let i = 0; i < collateral; i++) {
          const docTypes = ['prior_records', 'school_records', 'medical_records', 'employment_file']
          const docNames = ['prior_records.md', 'school_records.md', 'medical_records.md', 'employment_file.md']
          const docContent = `# ${docTypes[i].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\nCollateral document for ${c.first} ${c.last}.\n\nCase: ${c.num}\n`
          const docPath = join(casePath, 'Collateral', docNames[i])
          stub(docPath, docContent)
          stmtDoc.run(caseId, 'medical_record', docNames[i], docPath, Buffer.byteLength(docContent), 'text/markdown', createdAt)
          totalDocs++
        }

        // Testing directory content
        const testProtoPath = join(casePath, 'Testing', 'testing_protocol.md')
        const instruments = c.evalType === 'CST' ? ['MMPI-3', 'PAI', 'WAIS-IV', 'TOMM', 'SIRS-2']
          : c.evalType === 'Custody' ? ['MMPI-3', 'MCMI-IV', 'ASPECT', 'PPVT-5']
          : c.evalType === 'Risk Assessment' ? ['MMPI-3', 'PCL-R', 'HCR-20V3']
          : c.evalType === 'Fitness for Duty' ? ['PAI', 'MMPI-3', 'IES-R']
          : c.evalType === 'Sanity (NGRI)' ? ['MMPI-3', 'PAI', 'SIRS-2', 'TOMM']
          : ['MMPI-3', 'PAI']
        stub(testProtoPath, testingProtocol(c, instruments))
        stmtDoc.run(caseId, 'score_report', 'testing_protocol.md', testProtoPath, Buffer.byteLength(testingProtocol(c, instruments)), 'text/markdown', createdAt)
        totalDocs++
      }

      // ---- Specific test scores for Tier 3 cases ----
      const scores = getScores(c)
      for (const s of scores) {
        stmtScore.run(caseId, s.instrument, s.abbrev, s.date, s.scoresJson, s.validityJson, s.narrative)
      }

      // ---- Stage 2+: interview notes ----
      if (stageIdx >= 2) {
        const intPath = join(casePath, 'Interviews', 'interview_notes.md')
        stub(intPath, interviewNotes(c))
        stmtDoc.run(caseId, 'other', 'interview_notes.md', intPath, Buffer.byteLength(interviewNotes(c)), 'text/markdown', createdAt)
        totalDocs++

        const behPath = join(casePath, 'Interviews', 'behavioral_observations.md')
        const behContent = `# Behavioral Observations\n\n**Case:** ${c.num} | ${c.last}, ${c.first}\n\nSee interview notes for detailed MSE and behavioral observations.\n`
        stub(behPath, behContent)
        stmtDoc.run(caseId, 'other', 'behavioral_observations.md', behPath, Buffer.byteLength(behContent), 'text/markdown', createdAt)
        totalDocs++

        // Collateral letter for specific cases
        if (['Ramirez', 'Mitchell', 'Patel'].includes(c.last)) {
          const collPath = join(casePath, 'Interviews', 'collateral_notes.md')
          stub(collPath, collateralLetter(c))
          stmtDoc.run(caseId, 'other', 'collateral_notes.md', collPath, Buffer.byteLength(collateralLetter(c)), 'text/markdown', createdAt)
          totalDocs++
        }

        // Ingestor agent result for Patel
        if (c.last === 'Patel') {
          stmtAgentResult.run(caseId, 'ingestor', `ingestor-${c.num}-001`,
            JSON.stringify({
              status: 'success',
              sections_extracted: ['interview_summary', 'mse', 'behavioral_observations', 'history'],
              completeness_score: 0.93,
              ready_for_diagnostics: true,
            }),
            createdAt
          )
        }
      }

      // ---- Stage 3+: diagnostics ----
      if (stageIdx >= 3) {
        const diagDecisions = getDiagDecisions(c)
        for (const dd of diagDecisions) {
          stmtDiagDecision.run(caseId, dd.key, dd.icd_code, dd.name, dd.decision, dd.notes)
        }

        stmtAgentResult.run(caseId, 'diagnostician', `diag-${c.num}-001`,
          JSON.stringify({
            diagnoses_proposed: diagDecisions.map(d => ({ icd: d.icd_code, name: d.name })),
            evidence_summary: `Diagnostic analysis complete for ${c.evalType} evaluation.`,
          }),
          createdAt
        )

        const formText = diagnosticFormulation(c)
        stmtFormulation.run(caseId, formText)

        const diagPath = join(casePath, 'Diagnostics', 'diagnostic_formulation.md')
        stub(diagPath, formText)
        stmtDoc.run(caseId, 'other', 'diagnostic_formulation.md', diagPath, Buffer.byteLength(formText), 'text/markdown', createdAt)
        totalDocs++
      }

      // ---- Stage 4+: review ----
      if (stageIdx >= 4) {
        const draftContent = reportDraftStub(c, 1)
        const draftPath = join(casePath, 'Reports', 'draft_v1.md')
        stub(draftPath, draftContent)
        stmtDoc.run(caseId, 'docx', 'draft_v1.docx', draftPath, Buffer.byteLength(draftContent), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', createdAt)
        totalDocs++

        stmtReport.run(caseId, 1, 'in_review', draftPath, 0, null, null, null, createdAt, createdAt)

        // Writer agent
        stmtAgentResult.run(caseId, 'writer', `writer-${c.num}-001`,
          JSON.stringify({
            sections_generated: 6,
            sections_requiring_revision: c.last === 'Williams' ? 2 : 0,
            confidence_range: [0.72, 0.91],
          }),
          createdAt
        )

        // Editor agent
        stmtAgentResult.run(caseId, 'editor', `editor-${c.num}-001`,
          JSON.stringify({
            annotations: c.last === 'Williams' ? [
              { section: 'Forensic Opinion', severity: 'high', issue: 'Speculative language: "likely will" should be "may" per APA guidelines.' },
              { section: 'Test Results', severity: 'medium', issue: 'Missing caveat regarding norm sample applicability.' },
              { section: 'Background History', severity: 'low', issue: 'Minor overstatement of educational attainment. Verify with records.' },
            ] : [
              { section: 'Background History', severity: 'low', issue: 'Verify date of first psychiatric hospitalization against source records.' },
              { section: 'Diagnostic Formulation', severity: 'low', issue: 'Consider adding DSM-5-TR specifier language.' },
            ],
            total_annotations: c.last === 'Williams' ? 3 : 2,
            critical_count: c.last === 'Williams' ? 1 : 0,
          }),
          createdAt
        )
      }

      // ---- Stage 5: complete ----
      if (stageIdx >= 5) {
        const finalContent = finalReportStub(c)
        const finalPath = join(casePath, 'Reports', 'final', `final_report_${c.num}.md`)
        stub(finalPath, finalContent)
        stmtDoc.run(caseId, 'docx', `final_report_${c.num}.md`, finalPath, Buffer.byteLength(finalContent), 'text/markdown', createdAt)
        totalDocs++

        const integrityHash = `sha256:pike${caseId.toString(16).padStart(4, '0')}${c.num.replace(/[^0-9]/g, '')}`
        const reportFinalized = stmtReport.run(caseId, 2, 'finalized', finalPath, 1, integrityHash, 1, '2026-04-15', createdAt, '2026-04-15')
        if (reportFinalized.changes === 0) {
          // Update existing draft report to finalized
          sqlite.prepare(`UPDATE reports SET status = 'finalized', is_locked = 1, integrity_hash = ?, file_path = ?, finalized_by_user_id = 1, finalized_at = '2026-04-15', last_modified = '2026-04-15' WHERE case_id = ?`).run(integrityHash, finalPath, caseId)
        }

        // Archive draft
        const archivePath = join(casePath, 'Reports', 'Archive', 'draft_v1.md')
        const draftContent = reportDraftStub(c, 1)
        stub(archivePath, draftContent)
      }

      // ---- Audit trail ----
      const auditEntries = buildAuditTrail(c, caseId)
      for (const e of auditEntries) {
        stmtAudit.run(caseId, e.action_type, e.action_date, e.details)
        totalAudit++
      }
    }
  })

  seedTx()

  sqlite.close()

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('')
  console.log(`[seed-pike-demo] Complete in ${elapsed}s`)
  console.log(`  Cases seeded:   ${totalCases}`)
  console.log(`  Documents:      ${totalDocs}`)
  console.log(`  Audit entries:  ${totalAudit}`)
  process.exit(0)
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[seed-pike-demo] FATAL:', msg)
  if (err instanceof Error && err.stack) console.error(err.stack)
  process.exit(1)
})
