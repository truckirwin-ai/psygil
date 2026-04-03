/**
 * Comprehensive demo seeder — 42 forensic psychology cases across all 6 pipeline stages,
 * 10 evaluation types, varied complaints, with full supporting data:
 *   - patient_intake, data_confirmation, documents, agent_runs,
 *     diagnoses (via diagnosis_catalog), reports, audit_log
 *
 * Called from main/index.ts after initDb() if SEED_TRIGGER file exists.
 * Runs once, then deletes the trigger so it doesn't re-run.
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getSqlite } from './db/connection'
import { loadWorkspacePath, getDefaultWorkspacePath, createFolderStructure, CASE_SUBFOLDERS } from './workspace'
import { seedResources } from './seed-resources'

const TRIGGER = join(app.getPath('userData'), 'seed-demo.trigger')

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

/** Create a placeholder file (empty PDF-like) to represent a document on disk */
function createPlaceholder(dir: string, filename: string, content?: string): string {
  ensureDir(dir)
  const filePath = join(dir, filename)
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content ?? `[DEMO PLACEHOLDER] ${filename}\nThis is a demo file for UI development.\n`, 'utf-8')
  }
  return filePath
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stage = 'onboarding' | 'testing' | 'interview' | 'diagnostics' | 'review' | 'complete'
type CaseStatus = 'intake' | 'in_progress' | 'completed'

interface DemoCase {
  num: string
  last: string
  first: string
  dob: string
  gender: 'M' | 'F' | 'NB'
  evalType: string
  referral: string
  stage: Stage
  complaint: string
  charges: string
  jurisdiction: string
  attorney: string
  deadline: string
  createdAt: string
  notes: string
}

// ---------------------------------------------------------------------------
// 42 Cases — distribution across stages, eval types, complaints
// ---------------------------------------------------------------------------
//
// Stage distribution:  Onboarding(5), Testing(6), Interview(6),
//                      Diagnostics(7), Review(6), Complete(12)
//
// Eval types:  CST(10), Custody(5), Risk(6), Capacity(4), PTSD Dx(4),
//              ADHD Dx(3), Malingering(3), Fitness(3), Neuropsych(2), Mitigation(2)

const CASES: DemoCase[] = [
  // ─── ONBOARDING (5) ───────────────────────────────────────────────
  { num:'PSY-2026-0201', last:'Brown',      first:'Deshawn',  dob:'2003-09-18', gender:'M',  evalType:'CST',        referral:'Court',     stage:'onboarding', complaint:'Defendant unable to communicate with counsel',                    charges:'Murder 2nd (F2)',                              jurisdiction:'Denver District Court',           attorney:'PD Sarah Henley',           deadline:'2026-05-01', createdAt:'2026-03-25', notes:'New intake. No prior psych history on file.' },
  { num:'PSY-2026-0202', last:'Lewis',      first:'Darnell',  dob:'1991-04-10', gender:'M',  evalType:'CST',        referral:'Court',     stage:'onboarding', complaint:'Bizarre behavior in courtroom, talking to self',                  charges:'Assault 1st (F3), Kidnapping (F2)',            jurisdiction:'Denver District Court',           attorney:'PD Alisha Green',           deadline:'2026-05-12', createdAt:'2026-03-27', notes:'Court observed disorganized speech during arraignment.' },
  { num:'PSY-2026-0203', last:'Ramirez',    first:'Sofia',    dob:'1988-06-15', gender:'F',  evalType:'Risk',       referral:'Court',     stage:'onboarding', complaint:'Repeated violations of protective order',                         charges:'Harassment (M1), Stalking (M1)',               jurisdiction:'Adams County',                    attorney:'PD Raymond Ortiz',          deadline:'2026-05-15', createdAt:'2026-03-28', notes:'Third DV-related charge in 18 months.' },
  { num:'PSY-2026-0204', last:'Okafor',     first:'Chidi',    dob:'1978-11-22', gender:'M',  evalType:'Neuropsych', referral:'Attorney',  stage:'onboarding', complaint:'Cognitive decline following TBI',                                  charges:'',                                             jurisdiction:'',                                attorney:'Marcus Webb, Esq.',          deadline:'2026-05-20', createdAt:'2026-03-29', notes:'MVA 6 months ago. Employer reports significant functional decline.' },
  { num:'PSY-2026-0205', last:'Park',       first:'Minji',    dob:'2001-02-08', gender:'F',  evalType:'ADHD Dx',    referral:'Physician', stage:'onboarding', complaint:'Academic underperformance, inattention complaints from employer', charges:'',                                             jurisdiction:'',                                attorney:'',                          deadline:'2026-05-25', createdAt:'2026-03-29', notes:'Referred by PCP. History of poor academic performance.' },

  // ─── TESTING (6) ──────────────────────────────────────────────────
  { num:'PSY-2026-0211', last:'Martinez',   first:'Jose',     dob:'1982-01-30', gender:'M',  evalType:'Custody',    referral:'Attorney',  stage:'testing',    complaint:'Parenting capacity dispute',                                      charges:'',                                             jurisdiction:'Arapahoe County Family Court',    attorney:'Maria Gonzalez, Esq.',      deadline:'2026-04-20', createdAt:'2026-03-10', notes:'High-conflict custody. Allegations of alcohol use by father.' },
  { num:'PSY-2026-0212', last:'Rivera',     first:'Carmen',   dob:'1990-02-14', gender:'F',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'testing',    complaint:'Psychological injury from workplace harassment',                  charges:'',                                             jurisdiction:'',                                attorney:'Linda Park, Esq.',           deadline:'2026-04-25', createdAt:'2026-03-08', notes:'CAPS-5, PCL-5, MMPI-3 administered. Awaiting score entry.' },
  { num:'PSY-2026-0213', last:'Morales',    first:'Diego',    dob:'1995-07-03', gender:'M',  evalType:'Risk',       referral:'Court',     stage:'testing',    complaint:'Threat assessment after workplace threat',                        charges:'Menacing (F5), Harassment (M3)',               jurisdiction:'Denver District Court',           attorney:'PD Rachel Wong',            deadline:'2026-05-05', createdAt:'2026-03-15', notes:'PCL-R, HCR-20v3 in progress. MMPI-3 completed.' },
  { num:'PSY-2026-0214', last:'Okafor',     first:'Yinka',    dob:'1999-03-22', gender:'F',  evalType:'ADHD Dx',    referral:'Physician', stage:'testing',    complaint:'Poor concentration, missed deadlines at work',                    charges:'',                                             jurisdiction:'',                                attorney:'',                          deadline:'2026-04-30', createdAt:'2026-03-12', notes:'CAARS, CPT-3, WAIS-V administered. Score entry in progress.' },
  { num:'PSY-2026-0215', last:'Cooper',     first:'Marcus',   dob:'1970-12-05', gender:'M',  evalType:'Capacity',   referral:'Attorney',  stage:'testing',    complaint:'Financial decision-making capacity questioned by family',          charges:'',                                             jurisdiction:'El Paso County Probate',          attorney:'Elena Ruiz, Esq.',           deadline:'2026-04-18', createdAt:'2026-03-06', notes:'MoCA and WAIS-V completed. Awaiting Trail Making and WCST.' },
  { num:'PSY-2026-0216', last:'Mitchell',   first:'Jamal',    dob:'1987-09-28', gender:'M',  evalType:'Mitigation', referral:'Attorney',  stage:'testing',    complaint:'Sentencing mitigation evaluation',                                charges:'Armed Robbery (F3)',                            jurisdiction:'Denver District Court',           attorney:'PD Thomas Grant',           deadline:'2026-04-22', createdAt:'2026-03-11', notes:'Defense requesting mitigation report for sentencing hearing.' },

  // ─── INTERVIEW (6) ────────────────────────────────────────────────
  { num:'PSY-2026-0221', last:'Nguyen',     first:'Linh',     dob:'1994-08-17', gender:'F',  evalType:'CST',        referral:'Court',     stage:'interview',  complaint:'Defendant mute during proceedings',                               charges:'Arson 1st (F3)',                                jurisdiction:'Arapahoe County',                 attorney:'PD Michael Torres',         deadline:'2026-04-28', createdAt:'2026-03-05', notes:'2 interviews completed. Testing: MMPI-3, PAI, WAIS-V.' },
  { num:'PSY-2026-0222', last:'Rivera',     first:'Carmen',   dob:'1985-04-12', gender:'F',  evalType:'Custody',    referral:'Court',     stage:'interview',  complaint:'Relocation dispute affecting custody arrangement',                charges:'',                                             jurisdiction:'Jefferson County Family Court',   attorney:'Judge Patricia Reeves',     deadline:'2026-05-10', createdAt:'2026-03-02', notes:'Mother interview complete. Father interview scheduled.' },
  { num:'PSY-2026-0223', last:'Mitchell',   first:'Brenda',   dob:'1976-10-30', gender:'F',  evalType:'CST',        referral:'Court',     stage:'interview',  complaint:'Reported auditory hallucinations during detention',               charges:'Criminal Mischief (F4), Trespass (M3)',       jurisdiction:'Jefferson County',                attorney:'PD Thomas Grant',           deadline:'2026-05-08', createdAt:'2026-03-01', notes:'1 interview completed. Collateral interview with family pending.' },
  { num:'PSY-2026-0224', last:'Jackson',    first:'Terrell',  dob:'1980-05-19', gender:'M',  evalType:'Risk',       referral:'Court',     stage:'interview',  complaint:'Parole board risk evaluation for early release',                  charges:'Sexual Assault 2nd (F4)',                      jurisdiction:'Colorado DOC',                    attorney:'ADA Karen Wells',           deadline:'2026-04-15', createdAt:'2026-02-20', notes:'Clinical interview and collateral review complete. Ingestor pending.' },
  { num:'PSY-2026-0225', last:'Kim',        first:'Sung-Ho',  dob:'1973-12-01', gender:'M',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'interview',  complaint:'Combat-related PTSD claim for VA benefits',                       charges:'',                                             jurisdiction:'',                                attorney:'Steven Park, Esq.',          deadline:'2026-04-20', createdAt:'2026-02-25', notes:'3 interview sessions. Detailed trauma history documented.' },
  { num:'PSY-2026-0226', last:'Thompson',   first:'Kiara',    dob:'1996-07-14', gender:'F',  evalType:'Fitness',    referral:'Court',     stage:'interview',  complaint:'Fitness to proceed — alleged intellectual disability',             charges:'Theft (M1), Fraud (M2)',                       jurisdiction:'Boulder County',                  attorney:'PD Anna Klein',             deadline:'2026-05-02', createdAt:'2026-03-03', notes:'WAIS-V and ABAS-3 completed. Clinical interview in progress.' },

  // ─── DIAGNOSTICS (7) ──────────────────────────────────────────────
  { num:'PSY-2026-0231', last:'Johnson',    first:'Marcus',   dob:'1992-03-15', gender:'M',  evalType:'CST',        referral:'Court',     stage:'diagnostics', complaint:'Cannot assist counsel — possible psychotic disorder',             charges:'Assault 1st (F3), Criminal Mischief (M1)',    jurisdiction:'Denver District Court',           attorney:'ADA Rachel Thornton',       deadline:'2026-04-15', createdAt:'2026-02-15', notes:'Schizophrenia suspected. 3 sessions completed. All testing done.' },
  { num:'PSY-2026-0232', last:'Williams',   first:'Sarah',    dob:'1984-09-08', gender:'F',  evalType:'Risk',       referral:'Court',     stage:'diagnostics', complaint:'Stalking with escalation pattern',                                charges:'Stalking (F5), Menacing (M1)',                 jurisdiction:'Jefferson County',                attorney:'PD Kevin Ford',             deadline:'2026-04-01', createdAt:'2026-02-10', notes:'HCR-20v3, PCL-R scored. Diagnostician ready for review.' },
  { num:'PSY-2026-0233', last:'Washington', first:'Keisha',   dob:'1989-01-25', gender:'F',  evalType:'CST',        referral:'Court',     stage:'diagnostics', complaint:'Erratic behavior, possible bipolar episode',                      charges:'Robbery (F4), Assault 3rd (M1)',              jurisdiction:'Adams County',                    attorney:'PD David Chen',             deadline:'2026-04-12', createdAt:'2026-02-18', notes:'Diagnostician identified Bipolar I and ASPD differential.' },
  { num:'PSY-2026-0234', last:'Kim',        first:'Sung-Ho',  dob:'1973-12-01', gender:'M',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'diagnostics', complaint:'PTSD and TBI differential diagnosis',                             charges:'',                                             jurisdiction:'',                                attorney:'Steven Park, Esq.',          deadline:'2026-04-05', createdAt:'2026-02-05', notes:'Diagnostician presenting PTSD vs. Adjustment Disorder options.' },
  { num:'PSY-2026-0235', last:'Foster',     first:'Derek',    dob:'1981-06-20', gender:'M',  evalType:'Malingering',referral:'Court',     stage:'diagnostics', complaint:'Suspected symptom fabrication — disability claim',                charges:'Theft (F4)',                                   jurisdiction:'Denver District Court',           attorney:'ADA Nancy Clark',           deadline:'2026-04-02', createdAt:'2026-02-08', notes:'MMPI-3 FBS elevated. SIRS-2 probable. TOMM below cutoff.' },
  { num:'PSY-2026-0236', last:'Tanaka',     first:'Yuki',     dob:'1967-05-30', gender:'F',  evalType:'Capacity',   referral:'Attorney',  stage:'diagnostics', complaint:'Testamentary capacity for contested will',                        charges:'',                                             jurisdiction:'El Paso County Probate',          attorney:'Margaret Collins, Esq.',     deadline:'2026-04-10', createdAt:'2026-02-12', notes:'MoCA=18. Diagnostician weighing Major NCD vs. age-related decline.' },
  { num:'PSY-2026-0237', last:'Reeves',     first:'Anthony',  dob:'1975-03-08', gender:'M',  evalType:'Mitigation', referral:'Attorney',  stage:'diagnostics', complaint:'Sentencing mitigation — childhood trauma history',                charges:'Aggravated Assault (F4)',                      jurisdiction:'Arapahoe County',                 attorney:'PD Carlos Diaz',            deadline:'2026-04-18', createdAt:'2026-02-14', notes:'ACEs score 8/10. Diagnostician evaluating PTSD + SUD comorbidity.' },

  // ─── REVIEW (6) ───────────────────────────────────────────────────
  { num:'PSY-2026-0241', last:'Fitzgerald', first:'Sean',     dob:'1963-08-11', gender:'M',  evalType:'Capacity',   referral:'Attorney',  stage:'review',     complaint:'Financial conservatorship evaluation',                            charges:'',                                             jurisdiction:'Douglas County Probate',          attorney:'Margaret Collins, Esq.',     deadline:'2026-04-18', createdAt:'2026-01-20', notes:'Draft report in clinician review. Vascular NCD diagnosed.' },
  { num:'PSY-2026-0242', last:'Hoffman',    first:'Rachel',   dob:'1990-11-04', gender:'F',  evalType:'Fitness',    referral:'Court',     stage:'review',     complaint:'Fitness to proceed — possible dissociative disorder',              charges:'Forgery (F5)',                                 jurisdiction:'Boulder County',                  attorney:'PD James Hartley',          deadline:'2026-04-08', createdAt:'2026-01-25', notes:'Report drafted. Editor flagged 2 medium issues.' },
  { num:'PSY-2026-0243', last:'Kowalski',   first:'Anna',     dob:'1979-03-16', gender:'F',  evalType:'Custody',    referral:'Court',     stage:'review',     complaint:'Custody modification — substance abuse allegation',               charges:'',                                             jurisdiction:'El Paso County Family Court',     attorney:'Judge William Huang',       deadline:'2026-04-15', createdAt:'2026-01-28', notes:'Both parents evaluated. Report under clinical review.' },
  { num:'PSY-2026-0244', last:'Cooper',     first:'Ashley',   dob:'1988-04-22', gender:'F',  evalType:'CST',        referral:'Court',     stage:'review',     complaint:'Restored competency — re-evaluation',                             charges:'Assault 2nd (F4), Resisting Arrest (M2)',     jurisdiction:'Denver District Court',           attorney:'PD Olivia Barnes',          deadline:'2026-04-08', createdAt:'2026-01-15', notes:'Competent. Report ready for attestation. Editor: 1 high flag.' },
  { num:'PSY-2026-0245', last:'Patel',      first:'Neha',     dob:'1986-07-09', gender:'F',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'review',     complaint:'PTSD from sexual assault — civil damages case',                   charges:'',                                             jurisdiction:'',                                attorney:'Jennifer Walsh, Esq.',      deadline:'2026-04-12', createdAt:'2026-01-22', notes:'PTSD confirmed. Report in final review before attestation.' },
  { num:'PSY-2026-0246', last:'Santos',     first:'Rafael',   dob:'1971-10-15', gender:'M',  evalType:'Neuropsych', referral:'Attorney',  stage:'review',     complaint:'Cognitive impairment after industrial chemical exposure',          charges:'',                                             jurisdiction:'',                                attorney:'David Greenwald, Esq.',     deadline:'2026-04-20', createdAt:'2026-01-18', notes:'Neuropsych battery complete. Report drafted with 3 AI draft sections.' },

  // ─── COMPLETE (12) ────────────────────────────────────────────────
  { num:'PSY-2026-0251', last:'Chen',       first:'Wei',      dob:'1977-02-19', gender:'M',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'complete',   complaint:'Occupational PTSD — first responder',                             charges:'',                                             jurisdiction:'',                                attorney:'Linda Park, Esq.',           deadline:'2026-03-10', createdAt:'2025-12-15', notes:'PTSD confirmed. Report finalized and sealed.' },
  { num:'PSY-2026-0252', last:'Thompson',   first:'Robert',   dob:'1969-06-30', gender:'M',  evalType:'Malingering',referral:'Court',     stage:'complete',   complaint:'Symptom exaggeration in disability claim',                        charges:'Fraud (F4)',                                   jurisdiction:'Adams County',                    attorney:'ADA James Whitfield',       deadline:'2026-03-20', createdAt:'2025-12-10', notes:'Malingering confirmed. MMPI-3 and SIRS-2 definitive.' },
  { num:'PSY-2026-0253', last:'Anderson',   first:'Lisa',     dob:'1993-09-14', gender:'F',  evalType:'Fitness',    referral:'Court',     stage:'complete',   complaint:'Fitness restored after treatment',                                charges:'Theft (M1)',                                   jurisdiction:'Boulder County',                  attorney:'PD Anna Klein',             deadline:'2026-03-15', createdAt:'2025-12-01', notes:'Fit to proceed. Treatment compliance documented.' },
  { num:'PSY-2026-0254', last:'Garcia',     first:'Miguel',   dob:'1965-12-03', gender:'M',  evalType:'Capacity',   referral:'Attorney',  stage:'complete',   complaint:'Conservatorship — advanced dementia',                             charges:'',                                             jurisdiction:'El Paso County Probate',          attorney:'Elena Ruiz, Esq.',           deadline:'2026-02-28', createdAt:'2025-11-15', notes:'Lacks capacity. Conservatorship recommended.' },
  { num:'PSY-2026-0255', last:'Petrov',     first:'Alexei',   dob:'1975-04-03', gender:'M',  evalType:'Risk',       referral:'Court',     stage:'complete',   complaint:'SVP risk assessment — sexual offense history',                    charges:'Sexual Assault (F3)',                          jurisdiction:'Denver District Court',           attorney:'ADA Karen Wells',           deadline:'2026-03-15', createdAt:'2025-11-20', notes:'High risk. Civil commitment recommended.' },
  { num:'PSY-2026-0256', last:'Jackson',    first:'Tamara',   dob:'1983-08-07', gender:'F',  evalType:'CST',        referral:'Court',     stage:'complete',   complaint:'Incompetent — treatment ordered',                                 charges:'Assault 2nd (F4)',                              jurisdiction:'Denver District Court',           attorney:'PD Marcus Lee',             deadline:'2026-03-10', createdAt:'2025-11-25', notes:'IST. Committed to CMHIP for restoration.' },
  { num:'PSY-2026-0257', last:'Taylor',     first:'Brandon',  dob:'1997-01-20', gender:'M',  evalType:'CST',        referral:'Court',     stage:'complete',   complaint:'Substance-induced psychosis resolved',                            charges:'DUI (M1), Eluding (F5)',                       jurisdiction:'Adams County',                    attorney:'ADA Robert Park',           deadline:'2026-03-25', createdAt:'2025-12-05', notes:'Competent. Substance-induced condition resolved.' },
  { num:'PSY-2026-0258', last:'Harris',     first:'Tyrone',   dob:'1972-11-28', gender:'M',  evalType:'Risk',       referral:'Court',     stage:'complete',   complaint:'DV risk — lethality assessment for bond hearing',                 charges:'Domestic Violence (F4)',                        jurisdiction:'Arapahoe County',                 attorney:'ADA Michelle Stevens',      deadline:'2026-03-05', createdAt:'2025-11-10', notes:'High lethality risk. No-contact bond recommended.' },
  { num:'PSY-2026-0259', last:'Suzuki',     first:'Kenji',    dob:'1998-05-16', gender:'M',  evalType:'ADHD Dx',    referral:'Physician', stage:'complete',   complaint:'ADHD evaluation for workplace accommodations',                    charges:'',                                             jurisdiction:'',                                attorney:'',                          deadline:'2026-03-30', createdAt:'2025-12-20', notes:'ADHD Combined confirmed. Accommodations letter provided.' },
  { num:'PSY-2026-0260', last:'Singh',      first:'Rajveer',  dob:'1968-03-09', gender:'M',  evalType:'Fitness',    referral:'Court',     stage:'complete',   complaint:'Fitness evaluation — non-English speaker',                        charges:'DUI (M1)',                                     jurisdiction:'Weld County',                     attorney:'PD Carlos Diaz',            deadline:'2026-03-18', createdAt:'2025-12-08', notes:'Fit to proceed with interpreter. Language barrier only.' },
  { num:'PSY-2026-0261', last:'OBrien',     first:'Patrick',  dob:'1960-09-25', gender:'M',  evalType:'Malingering',referral:'Insurance', stage:'complete',   complaint:'Workers comp claim — suspected feigning',                         charges:'',                                             jurisdiction:'',                                attorney:'Hartford Insurance',        deadline:'2026-03-28', createdAt:'2025-12-12', notes:'Malingering probable. TOMM and SIRS-2 below cutoffs.' },
  { num:'PSY-2026-0262', last:'Hawkins',    first:'Gerald',   dob:'1958-12-09', gender:'M',  evalType:'Capacity',   referral:'Court',     stage:'complete',   complaint:'Healthcare proxy decision-making capacity',                       charges:'',                                             jurisdiction:'Boulder County Probate',          attorney:'Margaret Collins, Esq.',     deadline:'2026-02-15', createdAt:'2025-11-01', notes:'Vascular NCD. Lacks capacity for healthcare decisions.' },
]

// ---------------------------------------------------------------------------
// Stage → case_status mapping
// ---------------------------------------------------------------------------

function stageToStatus(stage: Stage): CaseStatus {
  switch (stage) {
    case 'onboarding': return 'intake'
    case 'complete':   return 'completed'
    default:           return 'in_progress'
  }
}

// ---------------------------------------------------------------------------
// Generate realistic onboarding data per case
// ---------------------------------------------------------------------------

function generateOnboardingData(c: DemoCase): Record<string, Record<string, string>> {
  const age = new Date().getFullYear() - parseInt(c.dob.slice(0, 4), 10)
  const isMale = c.gender === 'M'

  // Vary data by eval type for clinical realism
  const marital = age > 35 ? (Math.random() > 0.5 ? 'Married' : 'Divorced') : 'Single'
  const edu = age > 40 ? "Bachelor's degree" : (Math.random() > 0.5 ? 'Some college' : 'High school diploma')

  return {
    contact: {
      marital_status: marital,
      dependents: marital === 'Married' || marital === 'Divorced' ? `${Math.floor(Math.random() * 3) + 1} children` : 'None',
      living_situation: marital === 'Married' ? 'Lives with spouse' : (age > 30 ? 'Lives alone in apartment' : 'Lives with family'),
      primary_language: c.last === 'Martinez' || c.last === 'Rivera' || c.last === 'Morales' || c.last === 'Ramirez' ? 'Spanish (bilingual English)' : 'English',
    },
    complaints: {
      primary_complaint: c.complaint,
      secondary_concerns: c.evalType === 'Capacity'
        ? 'Family members report increasing confusion about financial matters, missed bill payments, and difficulty managing daily affairs over the past 12 months.'
        : c.evalType === 'CST'
        ? 'Difficulty understanding court proceedings. Reports confusion about roles of judge, attorney, and jury.'
        : c.evalType === 'Custody'
        ? 'Concerned about impact on children. Reports stress and sleep disruption since proceedings began.'
        : c.evalType === 'PTSD Dx'
        ? 'Nightmares, hypervigilance, avoidance of trauma reminders. Reports significant impairment in daily functioning.'
        : c.evalType === 'Risk'
        ? 'Reports feeling misunderstood. Denies intent to harm but acknowledges anger management difficulties.'
        : 'Reports difficulty concentrating, maintaining employment, and managing daily responsibilities.',
      onset_timeline: c.evalType === 'Capacity'
        ? 'Gradual onset over approximately 18 months. Family first noticed problems with checkbook management.'
        : `Approximately ${Math.floor(Math.random() * 12) + 3} months ago, coinciding with ${c.charges ? 'legal involvement' : 'the precipitating event'}.`,
    },
    family: {
      family_of_origin: `Raised by ${isMale ? 'both parents' : 'mother'} in ${['Denver', 'Colorado Springs', 'Pueblo', 'Aurora', 'Fort Collins'][Math.floor(Math.random() * 5)]}. ${Math.floor(Math.random() * 3) + 1} siblings.`,
      family_mental_health: c.evalType === 'Capacity'
        ? 'Mother had dementia diagnosed in her 70s. Father died of stroke at age 68.'
        : Math.random() > 0.4
        ? `${isMale ? 'Mother' : 'Father'} treated for depression. No other known family psychiatric history.`
        : 'No known family psychiatric history reported.',
      family_medical_history: 'Hypertension (maternal), diabetes (paternal).',
      current_family_relationships: marital === 'Married'
        ? 'Reports supportive relationship with spouse. Regular contact with extended family.'
        : marital === 'Divorced'
        ? 'Co-parenting relationship described as strained. Limited contact with ex-spouse.'
        : 'Maintains regular contact with parents and siblings.',
    },
    education: {
      highest_education: edu,
      schools_attended: `${['East', 'West', 'North', 'Central', 'Mountain View'][Math.floor(Math.random() * 5)]} High School${edu.includes('college') || edu.includes('Bachelor') ? `, ${['Metro State', 'UC Denver', 'PPCC', 'Colorado State', 'CU Boulder'][Math.floor(Math.random() * 5)]}` : ''}`,
      academic_experience: edu.includes('Bachelor') ? 'Average academic performance. No special education history.' : 'Graduated on time. No learning disability diagnosis.',
      employment_status: c.evalType === 'Capacity' ? 'Retired' : (Math.random() > 0.3 ? 'Employed' : 'Unemployed'),
      current_employer: c.evalType === 'Capacity' ? 'N/A — retired since 2020' : '',
      work_history: c.evalType === 'Capacity'
        ? 'Worked 30+ years in financial services. Retired as branch manager. Employer noted no concerns prior to retirement.'
        : `${Math.floor(Math.random() * 5) + 2} jobs in the past 10 years. Longest tenure: ${Math.floor(Math.random() * 5) + 2} years.`,
      military_service: Math.random() > 0.8 ? `${isMale ? 'US Army' : 'US Air Force'}, ${4 + Math.floor(Math.random() * 8)} years, honorable discharge.` : 'N/A',
    },
    health: {
      medical_conditions: c.evalType === 'Capacity'
        ? 'Hypertension (controlled with medication), Type 2 diabetes, mild hearing loss bilateral.'
        : Math.random() > 0.5
        ? 'No significant medical conditions reported.'
        : 'Hypertension, managed with medication. No other active conditions.',
      current_medications: c.evalType === 'Capacity'
        ? 'Lisinopril 20mg daily, Metformin 500mg BID, aspirin 81mg daily.'
        : Math.random() > 0.5
        ? 'None reported.'
        : 'Sertraline 50mg daily.',
      surgeries_hospitalizations: c.evalType === 'Capacity' ? 'Appendectomy (1995), knee replacement (2018).' : 'No surgical history reported.',
      head_injuries: c.evalType === 'Capacity'
        ? 'No reported head injuries. No loss of consciousness events.'
        : c.evalType === 'Neuropsych'
        ? 'TBI from motor vehicle accident 6 months ago. Brief loss of consciousness at scene. ER evaluation, CT negative.'
        : 'No reported head injuries.',
      sleep_quality: c.evalType === 'PTSD Dx' ? 'Poor — nightmares 3-4 times per week, difficulty falling asleep.' : 'Reports adequate sleep, 6-7 hours per night.',
      appetite_weight: 'Appetite normal. No significant weight changes in past 6 months.',
    },
    mental: {
      previous_treatment: c.evalType === 'PTSD Dx'
        ? 'Outpatient therapy for 3 months after incident. Discontinued due to cost. No current treatment.'
        : Math.random() > 0.5
        ? 'No prior mental health treatment reported.'
        : 'Brief counseling 2 years ago for adjustment issues. No ongoing treatment.',
      previous_diagnoses: c.evalType === 'PTSD Dx'
        ? 'Provisional PTSD diagnosis by treating therapist.'
        : c.evalType === 'ADHD Dx'
        ? 'Teacher recommended ADHD evaluation in childhood; never formally assessed.'
        : 'No prior psychiatric diagnoses.',
      psych_medications: Math.random() > 0.6 ? 'None currently.' : 'Sertraline 50mg, started 6 months ago by PCP.',
      self_harm_history: 'Denies any history of self-harm or suicidal ideation.',
      violence_history: c.evalType === 'Risk'
        ? 'One prior assault charge (dismissed). Reports two physical altercations in past 5 years.'
        : 'Denies history of violence toward others.',
    },
    substance: {
      alcohol_use: Math.random() > 0.5 ? 'Social drinking, 2-3 drinks per week. Denies binge drinking.' : 'Denies alcohol use.',
      drug_use: c.evalType === 'CST' && Math.random() > 0.5
        ? 'Reports marijuana use, daily for past 2 years. Denies other substance use.'
        : 'Denies current or past illicit drug use.',
      substance_treatment: 'No history of substance abuse treatment.',
    },
    legal: {
      arrests_convictions: c.charges
        ? `Current charges: ${c.charges}. ${Math.random() > 0.5 ? 'One prior misdemeanor conviction.' : 'No prior criminal history.'}`
        : 'No criminal history reported.',
      incarceration_history: c.charges && Math.random() > 0.5 ? 'Brief pretrial detention (3 days) related to current charges.' : 'No incarceration history.',
      probation_parole: 'Not currently on probation or parole.',
      protective_orders: c.evalType === 'Risk'
        ? 'Active protective order filed by complainant. No prior protective orders.'
        : 'No protective orders.',
    },
    recent: {
      events_circumstances: c.evalType === 'Capacity'
        ? 'Adult children petitioned for conservatorship after discovering $40,000 in unpaid bills and several suspicious financial transactions over the past year. Mr. Cooper was previously meticulous about finances. Family reports he has become increasingly confused about account balances and bill due dates.'
        : `${c.complaint}. ${c.charges ? `Facing charges of ${c.charges}.` : ''} Evaluation ordered to address ${c.evalType === 'CST' ? 'competency to stand trial' : c.evalType === 'Custody' ? 'parenting fitness and custody recommendation' : c.evalType === 'Risk' ? 'risk of future violence' : 'the referral question'}.`,
      current_stressors: c.charges
        ? 'Pending legal proceedings, potential incarceration, financial strain from legal costs.'
        : c.evalType === 'Capacity'
        ? 'Family conflict over financial management. Loss of independence. Uncertainty about living situation.'
        : 'Current legal/evaluation process, occupational impact, relationship strain.',
      goals_evaluation: c.evalType === 'Capacity'
        ? 'Wants to demonstrate he can manage his own affairs. States he is "just fine" and family is overreacting.'
        : c.evalType === 'CST'
        ? 'Wants the process to be over. Uncertain about what the evaluation entails.'
        : 'Hopes evaluation will support a favorable outcome. Willing to cooperate with process.',
    },
  }
}

// ---------------------------------------------------------------------------
// Test battery by eval type — used for document generation
// ---------------------------------------------------------------------------

const TEST_BATTERIES: Record<string, string[]> = {
  CST:        ['MMPI-3', 'PAI', 'WAIS-V', 'TOMM', 'SIRS-2'],
  Custody:    ['MMPI-3', 'MCMI-IV', 'PPVT-5', 'ASPECT'],
  Risk:       ['MMPI-3', 'PCL-R', 'HCR-20v3', 'STATIC-99R'],
  Capacity:   ['MoCA', 'WAIS-V', 'Trail Making A-B', 'WCST'],
  'PTSD Dx':  ['MMPI-3', 'CAPS-5', 'PCL-5', 'TSI-2'],
  'ADHD Dx':  ['CAARS-2', 'CPT-3', 'WAIS-V', 'BRIEF-2A'],
  Malingering:['MMPI-3', 'SIRS-2', 'TOMM', 'PAI'],
  Fitness:    ['WAIS-V', 'ABAS-3', 'MMPI-3', 'MacCAT-CA'],
  Neuropsych: ['WAIS-V', 'WMS-IV', 'Trail Making A-B', 'WCST', 'D-KEFS', 'BNT'],
  Mitigation: ['MMPI-3', 'PAI', 'ACE-Q', 'PCL-5'],
}

// ---------------------------------------------------------------------------
// Document type mapping for stages
// ---------------------------------------------------------------------------

const REFERRAL_DOC_TYPES = ['referral', 'medical_record', 'other'] as const
// Production schema CHECK: ('referral','pdf','docx','transcript_vtt','audio','score_report','medical_record','other')
const TEST_DOC_TYPE = 'score_report' as const
const INTERVIEW_DOC_TYPES = ['other', 'other', 'transcript_vtt'] as const

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function shouldSeedDemoCases(): boolean {
  return existsSync(TRIGGER)
}

export function createSeedTrigger(): void {
  writeFileSync(TRIGGER, new Date().toISOString(), 'utf-8')
}

/**
 * Backfill evaluation_type (and other metadata) for demo cases that were
 * created by workspace sync before the seeder ran.  Safe to call repeatedly —
 * only touches rows with NULL evaluation_type.
 */
export function backfillDemoTypes(): number {
  const sqlite = getSqlite()
  const update = sqlite.prepare(`
    UPDATE cases SET
      evaluation_type = ?,
      referral_source = ?,
      evaluation_questions = ?,
      examinee_dob = ?,
      examinee_gender = ?,
      notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes END
    WHERE case_number = ? AND (evaluation_type IS NULL OR evaluation_type = '')
  `)

  let updated = 0
  for (const c of CASES) {
    // Workspace sync stores case_number WITHOUT "PSY-" prefix (e.g. "2026-0201"),
    // but CASES array has "PSY-2026-0201". Try both forms.
    const bare = c.num.replace(/^PSY-/, '')
    let result = update.run(
      c.evalType, c.referral, c.complaint, c.dob, c.gender,
      `[DEMO] ${c.notes}`, bare
    )
    if (result.changes === 0) {
      // Also try with prefix in case seeder created the row
      result = update.run(
        c.evalType, c.referral, c.complaint, c.dob, c.gender,
        `[DEMO] ${c.notes}`, c.num
      )
    }
    if (result.changes > 0) updated++
  }

  if (updated > 0) {
    console.log(`[seed] Backfilled evaluation_type for ${updated} demo cases`)
  }
  return updated
}

/**
 * Backfill intake AND onboarding data for existing demo cases that were
 * created before these tables were populated by the seeder (or were created
 * by workspace sync). Safe to call repeatedly — only inserts missing rows.
 */
export function backfillOnboarding(): number {
  const sqlite = getSqlite()

  const insertIntake = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status, created_at, updated_at
    ) VALUES (
      @caseId, @refType, @referral, @evalType,
      @complaint, @jurisdiction, @charges,
      @attorney, @deadline, @intakeStatus, @createdAt, @createdAt
    )
  `)

  const insertOb = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let intakeFilled = 0
  let obFilled = 0

  for (const c of CASES) {
    // Find case_id — try both PSY-prefixed and bare case numbers
    const bare = c.num.replace(/^PSY-/, '')
    const row = sqlite.prepare('SELECT case_id FROM cases WHERE case_number = ? OR case_number = ?').get(c.num, bare) as { case_id: number } | undefined
    if (!row) continue

    const stageIndex = ['onboarding','testing','interview','diagnostics','review','complete'].indexOf(c.stage)

    // Referral type mapping
    const refType = c.referral.toLowerCase().includes('court') ? 'court'
      : c.referral.toLowerCase().includes('attorney') ? 'attorney'
      : c.referral.toLowerCase().includes('insurance') ? 'insurance'
      : c.referral.toLowerCase().includes('physician') ? 'physician'
      : 'court'

    // ── Backfill intake if missing ──
    const existingIntake = sqlite.prepare('SELECT COUNT(*) as cnt FROM patient_intake WHERE case_id = ?').get(row.case_id) as { cnt: number }
    if (existingIntake.cnt === 0) {
      const intakeComplete = stageIndex >= 1
      insertIntake.run({
        caseId: row.case_id,
        refType,
        referral: c.referral,
        evalType: c.evalType,
        complaint: c.complaint,
        jurisdiction: c.jurisdiction || null,
        charges: c.charges || null,
        attorney: c.attorney || null,
        deadline: c.deadline,
        intakeStatus: intakeComplete ? 'complete' : 'draft',
        createdAt: c.createdAt,
      })
      intakeFilled++
    }

    // ── Backfill onboarding if missing (testing+ stages only) ──
    if (stageIndex >= 1) {
      const existingOb = sqlite.prepare('SELECT COUNT(*) as cnt FROM patient_onboarding WHERE case_id = ?').get(row.case_id) as { cnt: number }
      if (existingOb.cnt === 0) {
        const ob = generateOnboardingData(c)
        for (const [section, content] of Object.entries(ob)) {
          insertOb.run(
            row.case_id, section, JSON.stringify(content), null, 1, 'complete', c.createdAt, c.createdAt,
          )
        }
        obFilled++
      }
    }
  }

  if (intakeFilled > 0) console.log(`[seed] Backfilled intake data for ${intakeFilled} demo cases`)
  if (obFilled > 0) console.log(`[seed] Backfilled onboarding data for ${obFilled} demo cases`)
  return intakeFilled + obFilled
}

export function seedDemoCases(): void {
  if (!existsSync(TRIGGER)) return
  console.log('[seed] Starting comprehensive demo seed (42 cases)...')

  const sqlite = getSqlite()
  const now = new Date().toISOString()

  // Resolve workspace path — use configured path, or default
  let wsPath = loadWorkspacePath()
  if (!wsPath) {
    wsPath = getDefaultWorkspacePath()
  }
  // Ensure workspace root + system subfolders exist
  createFolderStructure(wsPath)
  console.log(`[seed] Workspace: ${wsPath}`)

  // ── Ensure demo clinician user exists ──
  const existingUser = sqlite.prepare('SELECT user_id FROM users WHERE user_id = 1').get()
  if (!existingUser) {
    sqlite.prepare(`
      INSERT INTO users (user_id, email, full_name, role, credentials, license_number, state_licensed, is_active, created_at)
      VALUES (1, 'truck@psygil.com', 'Dr. Truck Irwin, Psy.D.', 'psychologist', 'Psy.D., ABPP', 'PSY-CO-12345', 'CO', 1, '2026-01-01')
    `).run()
    console.log('[seed] Created clinician user (user_id=1)')
  }

  // Prepared statements
  const insertCase = sqlite.prepare(`
    INSERT OR IGNORE INTO cases (
      case_number, primary_clinician_user_id,
      examinee_first_name, examinee_last_name, examinee_dob, examinee_gender,
      evaluation_type, referral_source, evaluation_questions,
      case_status, workflow_current_stage, notes, created_at, last_modified
    ) VALUES (
      @case_number, 1,
      @first, @last, @dob, @gender,
      @evalType, @referral, @complaint,
      @status, @stage, @notes, @createdAt, @createdAt
    )
  `)

  const insertIntake = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_intake (
      case_id, referral_type, referral_source, eval_type,
      presenting_complaint, jurisdiction, charges,
      attorney_name, report_deadline, status, created_at, updated_at
    ) VALUES (
      @caseId, @refType, @referral, @evalType,
      @complaint, @jurisdiction, @charges,
      @attorney, @deadline, @intakeStatus, @createdAt, @createdAt
    )
  `)

  const insertOnboarding = sqlite.prepare(`
    INSERT OR IGNORE INTO patient_onboarding (
      case_id, section, content, clinician_notes, verified, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertDataConf = sqlite.prepare(`
    INSERT OR IGNORE INTO data_confirmation (
      case_id, category_id, status, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `)

  const insertDoc = sqlite.prepare(`
    INSERT INTO documents (
      case_id, document_type, original_filename, file_path, mime_type, uploaded_by_user_id, upload_date
    ) VALUES (?, ?, ?, ?, ?, 1, ?)
  `)

  // agent_runs: agent_type CHECK('diagnostician','writer','validator')
  const insertAgentRun = sqlite.prepare(`
    INSERT INTO agent_runs (
      case_id, agent_type, input_summary, output_summary, status, invoked_by_user_id, started_at, completed_at
    ) VALUES (?, ?, ?, ?, 'success', 1, ?, ?)
  `)

  // Ensure diagnosis_catalog has entries for our demo diagnoses
  const insertCatalogEntry = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnosis_catalog (code, dsm5tr_code, name, category, is_builtin)
    VALUES (?, ?, ?, ?, 1)
  `)
  const getCatalogId = sqlite.prepare(`SELECT diagnosis_id FROM diagnosis_catalog WHERE code = ?`)

  const insertDiagnosis = sqlite.prepare(`
    INSERT OR IGNORE INTO diagnoses (
      case_id, diagnosis_id, clinician_user_id, confidence_level,
      supporting_evidence, selection_date, is_primary_diagnosis, rule_out_rationale
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
  `)

  const insertReport = sqlite.prepare(`
    INSERT INTO reports (
      case_id, report_version, generated_by_user_id, status, file_path,
      is_locked, integrity_hash, finalized_at, created_at, last_modified
    ) VALUES (?, 1, 1, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAudit = sqlite.prepare(`
    INSERT INTO audit_log (
      case_id, action_type, actor_user_id, action_date, details
    ) VALUES (?, ?, ?, ?, ?)
  `)

  let inserted = 0

  const seedTransaction = sqlite.transaction(() => {
    for (const c of CASES) {
      // ── Insert case ──
      const status = stageToStatus(c.stage)
      const result = insertCase.run({
        case_number: c.num,
        first: c.first,
        last: c.last,
        dob: c.dob,
        gender: c.gender,
        evalType: c.evalType,
        referral: c.referral,
        complaint: c.complaint,
        status,
        stage: c.stage,
        notes: `[DEMO] ${c.notes}`,
        createdAt: c.createdAt,
      })

      if (result.changes === 0) continue // already existed
      const caseId = Number(result.lastInsertRowid)
      inserted++

      // ── Create case folder on disk ──
      // Format: {case_number} {Last}, {First}
      const folderName = `${c.num.replace('PSY-','')} ${c.last}, ${c.first}`
      const caseFolderPath = join(wsPath!, folderName)
      ensureDir(caseFolderPath)
      for (const sub of CASE_SUBFOLDERS) {
        ensureDir(join(caseFolderPath, sub))
      }

      // Update folder_path in DB
      sqlite.prepare('UPDATE cases SET folder_path = ? WHERE case_id = ?').run(caseFolderPath, caseId)

      // Drop a case info file in _Inbox
      createPlaceholder(join(caseFolderPath, '_Inbox'), 'CASE_INFO.txt',
        `PSYGIL DEMO CASE — AI-GENERATED DATA\n${'='.repeat(40)}\n` +
        `Case:       ${c.num}\n` +
        `Examinee:   ${c.last}, ${c.first}\n` +
        `DOB:        ${c.dob}\n` +
        `Eval Type:  ${c.evalType}\n` +
        `Stage:      ${c.stage.toUpperCase()}\n` +
        `Referral:   ${c.referral}\n` +
        `Complaint:  ${c.complaint}\n` +
        `${c.charges ? `Charges:    ${c.charges}\n` : ''}` +
        `${c.jurisdiction ? `Court:      ${c.jurisdiction}\n` : ''}` +
        `${c.attorney ? `Attorney:   ${c.attorney}\n` : ''}` +
        `Deadline:   ${c.deadline}\n\n` +
        `This is a demo case containing no real patient data.\n`
      )

      // Referral type mapping — matches expanded CHECK after migration 008
      const refType = c.referral.toLowerCase().includes('court') ? 'court'
        : c.referral.toLowerCase().includes('attorney') ? 'attorney'
        : c.referral.toLowerCase().includes('insurance') ? 'insurance'
        : c.referral.toLowerCase().includes('physician') ? 'physician'
        : 'court'

      // ── STAGE-APPROPRIATE DATA ──
      // Each stage builds on the previous — cases further along have more data

      const stageIndex = ['onboarding','testing','interview','diagnostics','review','complete'].indexOf(c.stage)

      // ──────────────────────────────────────────────────────────────
      // ALL stages: intake form (complete if past onboarding)
      // ──────────────────────────────────────────────────────────────
      const intakeComplete = stageIndex >= 1
      insertIntake.run({
        caseId,
        refType,
        referral: c.referral,
        evalType: c.evalType,
        complaint: c.complaint,
        jurisdiction: c.jurisdiction || null,
        charges: c.charges || null,
        attorney: c.attorney || null,
        deadline: c.deadline,
        intakeStatus: intakeComplete ? 'complete' : 'draft',
        createdAt: c.createdAt,
      })

      insertAudit.run(caseId, 'case_created', 1, c.createdAt, JSON.stringify({ eval_type: c.evalType }))

      // ──────────────────────────────────────────────────────────────
      // Testing+: onboarding sections (complete if past onboarding)
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 1) {
        const ob = generateOnboardingData(c)
        for (const [section, content] of Object.entries(ob)) {
          insertOnboarding.run(
            caseId, section, JSON.stringify(content), null, 1, 'complete', c.createdAt, c.createdAt,
          )
        }
      }

      // ──────────────────────────────────────────────────────────────
      // Onboarding+: referral documents (on disk + in DB)
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 0) {
        const collateralDir = join(caseFolderPath, 'Collateral')
        const refFile = createPlaceholder(collateralDir, `Referral_Order_${c.num.replace('PSY-','')}.pdf`,
          `[DEMO] Referral Order\nCase: ${c.num}\nFrom: ${c.referral}\nComplaint: ${c.complaint}\n`)
        insertDoc.run(caseId, 'referral', `Referral_Order_${c.num.replace('PSY-','')}.pdf`, refFile, 'application/pdf', c.createdAt)
        if (c.charges) {
          const priorFile = createPlaceholder(collateralDir, `Prior_Records_${c.num.replace('PSY-','')}.pdf`,
            `[DEMO] Prior Records\nCase: ${c.num}\nCharges: ${c.charges}\n`)
          insertDoc.run(caseId, 'medical_record', `Prior_Records_${c.num.replace('PSY-','')}.pdf`, priorFile, 'application/pdf', c.createdAt)
        }
      }

      // ──────────────────────────────────────────────────────────────
      // Testing+: data confirmation + test score documents
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 1) {
        // Data confirmation (completed)
        insertDataConf.run(caseId, 'demographics', 'confirmed', '', c.createdAt)
        insertDataConf.run(caseId, 'referral_questions', 'confirmed', '', c.createdAt)
        insertDataConf.run(caseId, 'timeline', stageIndex >= 2 ? 'confirmed' : 'flagged', stageIndex >= 2 ? '' : 'Timeline needs verification', c.createdAt)
        insertDataConf.run(caseId, 'collateral_records', 'confirmed', '', c.createdAt)

        insertAudit.run(caseId, 'case_modified', 1, c.createdAt, '{}')
        insertAudit.run(caseId, 'case_modified', 1, c.createdAt, '{}')
        insertAudit.run(caseId, 'gate_completed', 1, c.createdAt, JSON.stringify({ from: 'onboarding', to: 'testing' }))

        // Test score reports (on disk + in DB)
        const tests = TEST_BATTERIES[c.evalType] || ['MMPI-3', 'PAI']
        const testingDir = join(caseFolderPath, 'Testing')
        for (const test of tests) {
          const testFile = createPlaceholder(testingDir, `${test}_Scores_${c.num.replace('PSY-','')}.pdf`,
            `[DEMO] ${test} Score Report\nCase: ${c.num}\nExaminee: ${c.first} ${c.last}\n`)
          insertDoc.run(caseId, 'score_report', `${test}_Scores_${c.num.replace('PSY-','')}.pdf`, testFile, 'application/pdf', c.createdAt)
        }
        insertAudit.run(caseId, 'test_score_entered', 1, c.createdAt, JSON.stringify({ count: tests.length }))
      }

      // ──────────────────────────────────────────────────────────────
      // Interview+: interview docs + ingestor agent result
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 2) {
        insertAudit.run(caseId, 'gate_completed', 1, c.createdAt, JSON.stringify({ from: 'testing', to: 'interview' }))

        const interviewDir = join(caseFolderPath, 'Interviews')
        const intNotesFile = createPlaceholder(interviewDir, `Clinical_Interview_Notes.pdf`,
          `[DEMO] Clinical Interview Notes\nCase: ${c.num}\nExaminee: ${c.first} ${c.last}\nEval Type: ${c.evalType}\n`)
        insertDoc.run(caseId, 'pdf', `Clinical_Interview_Notes.pdf`, intNotesFile, 'application/pdf', c.createdAt)
        const behObsFile = createPlaceholder(interviewDir, `Behavioral_Observations.pdf`,
          `[DEMO] Behavioral Observations\nCase: ${c.num}\nExaminee: ${c.first} ${c.last}\n`)
        insertDoc.run(caseId, 'pdf', `Behavioral_Observations.pdf`, behObsFile, 'application/pdf', c.createdAt)

        // Validator agent run (data completeness check before diagnostics)
        insertAgentRun.run(caseId, 'validator',
          `Validate data completeness for ${c.evalType} evaluation`,
          JSON.stringify({
            completeness_score: 0.85 + Math.random() * 0.12,
            sections_checked: ['demographics', 'referral', 'history', 'observations', 'test_data'],
            ready_for_diagnostics: true,
          }),
          c.createdAt, c.createdAt)
        insertAudit.run(caseId, 'agent_invoked', 1, c.createdAt, JSON.stringify({ agent: 'validator' }))
      }

      // ──────────────────────────────────────────────────────────────
      // Diagnostics+: diagnostician agent + clinician decisions
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 3) {
        insertAudit.run(caseId, 'gate_completed', 1, c.createdAt, JSON.stringify({ from: 'interview', to: 'diagnostics' }))

        // Diagnostician agent run with eval-type-specific diagnoses
        const diagOptions = getDiagnosticOptions(c.evalType)
        insertAgentRun.run(caseId, 'diagnostician',
          `Diagnostic analysis for ${c.evalType} evaluation`,
          JSON.stringify({
            diagnostic_options: diagOptions.map(d => ({ key: d.key, name: d.name, icd: d.icd_code })),
            evidence_summary: `Analysis based on ${c.evalType} evaluation protocol`,
          }),
          c.createdAt, c.createdAt)
        insertAudit.run(caseId, 'agent_invoked', 1, c.createdAt, JSON.stringify({ agent: 'diagnostician' }))

        // Clinician diagnostic decisions via diagnoses table (DOCTOR ALWAYS DIAGNOSES)
        // Ensure catalog entries exist for each diagnosis
        for (const dx of diagOptions) {
          insertCatalogEntry.run(dx.icd_code, dx.icd_code, dx.name, c.evalType)
          const catalogRow = getCatalogId.get(dx.icd_code) as { diagnosis_id: number } | undefined
          if (!catalogRow) continue
          const isPrimary = dx.decision === 'render' ? 1 : 0
          const ruleOutRationale = dx.decision === 'rule_out' ? dx.notes : null
          const confidence = dx.decision === 'render' ? 'high' : dx.decision === 'defer' ? 'low' : 'moderate'
          insertDiagnosis.run(
            caseId,
            catalogRow.diagnosis_id,
            confidence,
            dx.notes,
            c.createdAt,
            isPrimary,
            ruleOutRationale,
          )
        }
        insertAudit.run(caseId, 'diagnosis_selected', 1, c.createdAt, JSON.stringify({
          rendered: diagOptions.filter(d => d.decision === 'render').map(d => d.name),
          ruled_out: diagOptions.filter(d => d.decision === 'rule_out').map(d => d.name),
        }))
      }

      // ──────────────────────────────────────────────────────────────
      // Review+: writer + editor agents, report draft
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 4) {
        insertAudit.run(caseId, 'gate_completed', 1, c.createdAt, JSON.stringify({ from: 'diagnostics', to: 'review' }))

        // Writer agent run
        insertAgentRun.run(caseId, 'writer',
          `Generate report draft for ${c.evalType} evaluation`,
          JSON.stringify({
            sections: ['Identifying Information', 'Referral Question', 'Background History', 'Clinical Interview', 'Test Results', 'Diagnostic Formulation', 'Forensic Opinion'],
            draft_sections: ['Clinical Interview', 'Diagnostic Formulation', 'Forensic Opinion'],
            confidence_range: [0.60, 0.85],
          }),
          c.createdAt, c.createdAt)
        insertAudit.run(caseId, 'agent_invoked', 1, c.createdAt, JSON.stringify({ agent: 'writer' }))

        // Validator agent run (report quality check — stands in for editor)
        insertAgentRun.run(caseId, 'validator',
          `Validate report draft for ${c.evalType} evaluation`,
          JSON.stringify({
            flags: [
              { severity: 'high', section: 'Forensic Opinion', issue: 'Review ultimate opinion language' },
              { severity: 'medium', section: 'Test Results', issue: 'Verify score accuracy' },
            ],
            total_flags: 2,
          }),
          c.createdAt, c.createdAt)
        insertAudit.run(caseId, 'agent_invoked', 1, c.createdAt, JSON.stringify({ agent: 'validator' }))

        // Report draft (on disk + in DB)
        const reportsDir = join(caseFolderPath, 'Reports')
        const reportFile = createPlaceholder(reportsDir, `draft_v1.docx`,
          `[DEMO] Report Draft v1\nCase: ${c.num}\nExaminee: ${c.first} ${c.last}\nEval Type: ${c.evalType}\n`)
        insertReport.run(caseId, 'in_review', reportFile, 0, null, null, c.createdAt, c.createdAt)
        insertAudit.run(caseId, 'report_generated', 1, c.createdAt, '{}')
      }

      // ──────────────────────────────────────────────────────────────
      // Complete: finalized report with attestation
      // ──────────────────────────────────────────────────────────────
      if (stageIndex >= 5) {
        insertAudit.run(caseId, 'attestation_signed', 1, c.createdAt, JSON.stringify({ signed_by: 'Dr. Truck Irwin, Psy.D., ABPP' }))
        insertAudit.run(caseId, 'gate_completed', 1, c.createdAt, JSON.stringify({ from: 'review', to: 'complete' }))

        // Create sealed PDF on disk + update report to finalized
        const sealedPdf = createPlaceholder(join(caseFolderPath, 'Reports'), `Final_Report_${c.num.replace('PSY-','')}.pdf`,
          `[DEMO] SEALED FINAL REPORT\nCase: ${c.num}\nExaminee: ${c.first} ${c.last}\nEval Type: ${c.evalType}\nFinalized: ${c.createdAt}\n`)
        sqlite.prepare(`
          UPDATE reports SET status = 'finalized', is_locked = 1,
            integrity_hash = ?, sealed_pdf_path = ?, finalized_at = ?
          WHERE case_id = ? AND report_version = 1
        `).run(
          `sha256:${caseId.toString(16).padStart(8,'0')}demo${c.num.replace(/[^0-9]/g,'')}`,
          sealedPdf,
          c.createdAt,
          caseId,
        )
      }
    }
  })

  seedTransaction()
  console.log(`[seed] Inserted ${inserted}/${CASES.length} demo cases with full supporting data`)

  // Seed _Resources folders (writing samples, templates, documentation)
  try {
    seedResources(wsPath)
  } catch (e) {
    console.error('[seed] Resources seed failed:', e)
  }

  // Remove trigger so this only runs once
  try { unlinkSync(TRIGGER) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Eval-type-specific diagnostic options
// ---------------------------------------------------------------------------

interface DiagOption {
  key: string
  icd_code: string
  name: string
  decision: 'render' | 'rule_out' | 'defer'
  notes: string
}

function getDiagnosticOptions(evalType: string): DiagOption[] {
  switch (evalType) {
    case 'CST':
      return [
        { key: 'schizophrenia_f20.9',  icd_code: 'F20.9',  name: 'Schizophrenia, Unspecified',         decision: 'render',   notes: 'Meets criteria per clinical interview and testing' },
        { key: 'aspd_f60.2',           icd_code: 'F60.2',  name: 'Antisocial Personality Disorder',    decision: 'rule_out', notes: 'Insufficient criteria met' },
      ]
    case 'Custody':
      return [
        { key: 'aud_f10.20',           icd_code: 'F10.20', name: 'Alcohol Use Disorder, Moderate',     decision: 'render',   notes: 'Confirmed by history and collateral' },
        { key: 'gad_f41.1',            icd_code: 'F41.1',  name: 'Generalized Anxiety Disorder',       decision: 'render',   notes: 'Meets criteria, impacts parenting' },
        { key: 'bpd_f60.3',            icd_code: 'F60.3',  name: 'Borderline Personality Disorder',    decision: 'rule_out', notes: 'Some traits but insufficient for full diagnosis' },
      ]
    case 'Risk':
      return [
        { key: 'aspd_f60.2',           icd_code: 'F60.2',  name: 'Antisocial Personality Disorder',    decision: 'render',   notes: 'PCL-R score elevated, meets criteria' },
        { key: 'sud_f19.20',           icd_code: 'F19.20', name: 'Substance Use Disorder, Moderate',   decision: 'render',   notes: 'Active use contributes to risk profile' },
        { key: 'ied_f63.81',           icd_code: 'F63.81', name: 'Intermittent Explosive Disorder',    decision: 'rule_out', notes: 'Pattern better accounted for by ASPD' },
      ]
    case 'PTSD Dx':
      return [
        { key: 'ptsd_f43.10',          icd_code: 'F43.10', name: 'PTSD, Unspecified',                  decision: 'render',   notes: 'Meets all DSM-5-TR criteria per CAPS-5' },
        { key: 'adjustment_f43.21',    icd_code: 'F43.21', name: 'Adjustment Disorder with Depression',decision: 'rule_out', notes: 'Symptoms exceed adjustment disorder severity' },
      ]
    case 'ADHD Dx':
      return [
        { key: 'adhd_f90.2',           icd_code: 'F90.2',  name: 'ADHD, Combined Presentation',        decision: 'render',   notes: 'Met criteria on CAARS-2, CPT-3, and clinical interview' },
        { key: 'gad_f41.1',            icd_code: 'F41.1',  name: 'Generalized Anxiety Disorder',       decision: 'defer',    notes: 'Some overlap with ADHD symptoms; monitor' },
      ]
    case 'Malingering':
      return [
        { key: 'malingering_z76.5',    icd_code: 'Z76.5',  name: 'Malingering',                        decision: 'render',   notes: 'SIRS-2 and TOMM confirm feigning' },
        { key: 'factitious_f68.1',     icd_code: 'F68.1',  name: 'Factitious Disorder',                decision: 'rule_out', notes: 'External incentive present; not factitious' },
      ]
    case 'Fitness':
      return [
        { key: 'mild_id_f70',          icd_code: 'F70',    name: 'Mild Intellectual Disability',       decision: 'render',   notes: 'WAIS-V FSIQ < 70, adaptive deficits confirmed' },
        { key: 'sld_f81.9',            icd_code: 'F81.9',  name: 'Specific Learning Disorder',         decision: 'rule_out', notes: 'Deficits too broad for SLD' },
      ]
    case 'Capacity':
      return [
        { key: 'ncd_major_f03.90',     icd_code: 'F03.90', name: 'Major Neurocognitive Disorder',      decision: 'render',   notes: 'MoCA and neuropsych testing confirm major impairment' },
        { key: 'mdd_f32.1',            icd_code: 'F32.1',  name: 'Major Depressive Disorder',          decision: 'rule_out', notes: 'Cognitive deficits not attributable to depression' },
      ]
    case 'Neuropsych':
      return [
        { key: 'tbi_ncd_f06.30',       icd_code: 'F06.30', name: 'NCD due to Traumatic Brain Injury',  decision: 'render',   notes: 'Neuropsych profile consistent with TBI sequelae' },
        { key: 'mdd_f32.1',            icd_code: 'F32.1',  name: 'Major Depressive Disorder',          decision: 'render',   notes: 'Comorbid depression affecting recovery' },
      ]
    case 'Mitigation':
      return [
        { key: 'ptsd_f43.10',          icd_code: 'F43.10', name: 'PTSD, Unspecified',                  decision: 'render',   notes: 'Childhood trauma history meets PTSD criteria' },
        { key: 'sud_f19.20',           icd_code: 'F19.20', name: 'Substance Use Disorder, Moderate',   decision: 'render',   notes: 'Polysubstance use since adolescence' },
        { key: 'aspd_f60.2',           icd_code: 'F60.2',  name: 'Antisocial Personality Disorder',    decision: 'defer',    notes: 'Features present but mitigated by trauma history' },
      ]
    default:
      return [
        { key: 'unspecified_f99',      icd_code: 'F99',    name: 'Unspecified Mental Disorder',        decision: 'defer',    notes: 'Further evaluation needed' },
      ]
  }
}
