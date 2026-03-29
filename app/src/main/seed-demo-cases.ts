/**
 * One-shot demo seeder — run once then self-deletes the trigger file.
 * Called from main/index.ts after initDb() if SEED_TRIGGER file exists.
 */

import { existsSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getSqlite } from './db/connection'

const WORKSPACE = '/Users/truckirwin/Desktop/PEAK'
const TRIGGER = join(app.getPath('userData'), 'seed-demo.trigger')

interface DemoCase {
  num: string
  last: string
  first: string
  mi: string
  evalType: string
  referral: string
  stage: string
  sessions: number
  hrs: number
  deadline: string
  charges: string
  jurisdiction: string
  attorney: string
}

const DEMO_CASES: DemoCase[] = [
  { num:'2026-0147', last:'Johnson',    first:'Marcus',  mi:'D', evalType:'CST',        referral:'Court',     stage:'diagnostics', sessions:3, hrs:6.5, deadline:'2026-04-15', charges:'Assault 1st (F3), Criminal Mischief (M1)', jurisdiction:'Denver District Court',              attorney:'ADA Rachel Thornton' },
  { num:'2026-0152', last:'Martinez',   first:'Jose',    mi:'',  evalType:'Custody',    referral:'Attorney',  stage:'testing',     sessions:1, hrs:2.0, deadline:'2026-04-20', charges:'', jurisdiction:'Arapahoe County',                                                               attorney:'Maria Gonzalez, Esq.' },
  { num:'2026-0158', last:'Williams',   first:'Sarah',   mi:'',  evalType:'Risk',       referral:'Court',     stage:'diagnostics', sessions:2, hrs:4.0, deadline:'2026-04-01', charges:'Stalking (F5), Menacing (M1)', jurisdiction:'Jefferson County',                               attorney:'PD Kevin Ford' },
  { num:'2026-0161', last:'Chen',       first:'Wei',     mi:'',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'complete',    sessions:3, hrs:5.5, deadline:'2026-04-10', charges:'', jurisdiction:'',                                                                              attorney:'Linda Park, Esq.' },
  { num:'2026-0165', last:'Okafor',     first:'Yinka',   mi:'',  evalType:'ADHD Dx',    referral:'Physician', stage:'testing',     sessions:1, hrs:1.5, deadline:'2026-04-25', charges:'', jurisdiction:'',                                                                              attorney:'' },
  { num:'2025-0989', last:'Thompson',   first:'Robert',  mi:'J', evalType:'Malingering',referral:'Court',     stage:'complete',    sessions:3, hrs:7.0, deadline:'2026-03-20', charges:'Fraud (F4)', jurisdiction:'Adams County',                                                      attorney:'ADA James Whitfield' },
  { num:'2025-0988', last:'Anderson',   first:'Lisa',    mi:'',  evalType:'Fitness',    referral:'Court',     stage:'complete',    sessions:2, hrs:4.0, deadline:'2026-03-15', charges:'Theft (M1)', jurisdiction:'Boulder County',                                                    attorney:'PD Anna Klein' },
  { num:'2025-0987', last:'Garcia',     first:'Miguel',  mi:'A', evalType:'Capacity',   referral:'Attorney',  stage:'complete',    sessions:2, hrs:3.5, deadline:'2026-02-28', charges:'', jurisdiction:'El Paso County',                                                               attorney:'Elena Ruiz, Esq.' },
  { num:'2026-0170', last:'Brown',      first:'Deshawn', mi:'L', evalType:'CST',        referral:'Court',     stage:'onboarding',  sessions:0, hrs:0.0, deadline:'2026-05-01', charges:'Murder 2nd (F2)', jurisdiction:'Denver District Court',                                        attorney:'PD Sarah Henley' },
  { num:'2026-0171', last:'Nguyen',     first:'Linh',    mi:'T', evalType:'CST',        referral:'Court',     stage:'interview',   sessions:2, hrs:3.0, deadline:'2026-04-28', charges:'Arson 1st (F3)', jurisdiction:'Arapahoe County',                                             attorney:'PD Michael Torres' },
  { num:'2026-0172', last:'Petrov',     first:'Alexei',  mi:'',  evalType:'Risk',       referral:'Court',     stage:'complete',    sessions:3, hrs:8.0, deadline:'2026-03-15', charges:'Sexual Assault (F3)', jurisdiction:'Denver District Court',                                   attorney:'ADA Karen Wells' },
  { num:'2026-0173', last:'Washington', first:'Keisha',  mi:'M', evalType:'CST',        referral:'Court',     stage:'diagnostics', sessions:2, hrs:4.5, deadline:'2026-04-12', charges:'Robbery (F4), Assault 3rd (M1)', jurisdiction:'Adams County',                                attorney:'PD David Chen' },
  { num:'2026-0174', last:'Rivera',     first:'Carmen',  mi:'',  evalType:'Custody',    referral:'Court',     stage:'interview',   sessions:1, hrs:2.0, deadline:'2026-05-10', charges:'', jurisdiction:'Jefferson County Family Court',                                               attorney:'Judge Patricia Reeves' },
  { num:'2026-0175', last:'Kim',        first:'Sung-Ho', mi:'',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'diagnostics', sessions:2, hrs:4.0, deadline:'2026-04-05', charges:'', jurisdiction:'',                                                                              attorney:'Steven Park, Esq.' },
  { num:'2026-0176', last:'OBrien',     first:'Patrick', mi:'',  evalType:'Malingering',referral:'Insurance', stage:'complete',    sessions:2, hrs:4.0, deadline:'2026-03-28', charges:'', jurisdiction:'',                                                                              attorney:'Hartford Insurance' },
  { num:'2026-0177', last:'Jackson',    first:'Tamara',  mi:'D', evalType:'CST',        referral:'Court',     stage:'complete',    sessions:3, hrs:6.0, deadline:'2026-03-10', charges:'Assault 2nd (F4)', jurisdiction:'Denver District Court',                                      attorney:'PD Marcus Lee' },
  { num:'2026-0178', last:'Fitzgerald', first:'Sean',    mi:'',  evalType:'Capacity',   referral:'Attorney',  stage:'review',      sessions:2, hrs:3.0, deadline:'2026-04-18', charges:'', jurisdiction:'Douglas County Probate',                                                       attorney:'Margaret Collins, Esq.' },
  { num:'2026-0179', last:'Morales',    first:'Diego',   mi:'',  evalType:'Risk',       referral:'Court',     stage:'testing',     sessions:1, hrs:1.5, deadline:'2026-05-05', charges:'Menacing (F5), Harassment (M3)', jurisdiction:'Denver District Court',                       attorney:'PD Rachel Wong' },
  { num:'2026-0180', last:'Taylor',     first:'Brandon', mi:'K', evalType:'CST',        referral:'Court',     stage:'complete',    sessions:2, hrs:3.5, deadline:'2026-03-25', charges:'DUI (M1), Eluding (F5)', jurisdiction:'Adams County',                                        attorney:'ADA Robert Park' },
  { num:'2026-0181', last:'Hoffman',    first:'Rachel',  mi:'',  evalType:'Fitness',    referral:'Court',     stage:'review',      sessions:2, hrs:4.0, deadline:'2026-04-08', charges:'Forgery (F5)', jurisdiction:'Boulder County',                                               attorney:'PD James Hartley' },
  { num:'2026-0182', last:'Patel',      first:'Arun',    mi:'',  evalType:'PTSD Dx',    referral:'Attorney',  stage:'complete',    sessions:2, hrs:4.0, deadline:'2026-03-22', charges:'', jurisdiction:'',                                                                              attorney:'Jennifer Walsh, Esq.' },
  { num:'2026-0183', last:'Lewis',      first:'Darnell', mi:'',  evalType:'CST',        referral:'Court',     stage:'onboarding',  sessions:0, hrs:0.0, deadline:'2026-05-12', charges:'Assault 1st (F3), Kidnapping (F2)', jurisdiction:'Denver District Court',                  attorney:'PD Alisha Green' },
  { num:'2026-0184', last:'Kowalski',   first:'Anna',    mi:'',  evalType:'Custody',    referral:'Court',     stage:'review',      sessions:2, hrs:3.5, deadline:'2026-04-15', charges:'', jurisdiction:'El Paso County Family Court',                                                attorney:'Judge William Huang' },
  { num:'2026-0185', last:'Harris',     first:'Tyrone',  mi:'',  evalType:'Risk',       referral:'Court',     stage:'complete',    sessions:3, hrs:7.5, deadline:'2026-03-05', charges:'Domestic Violence (F4)', jurisdiction:'Arapahoe County',                                    attorney:'ADA Michelle Stevens' },
  { num:'2026-0186', last:'Suzuki',     first:'Kenji',   mi:'',  evalType:'ADHD Dx',    referral:'Physician', stage:'complete',    sessions:1, hrs:2.0, deadline:'2026-03-30', charges:'', jurisdiction:'',                                                                              attorney:'' },
  { num:'2026-0187', last:'Mitchell',   first:'Brenda',  mi:'L', evalType:'CST',        referral:'Court',     stage:'interview',   sessions:1, hrs:2.0, deadline:'2026-05-08', charges:'Criminal Mischief (F4), Trespass (M3)', jurisdiction:'Jefferson County',                    attorney:'PD Thomas Grant' },
  { num:'2026-0188', last:'Foster',     first:'Derek',   mi:'',  evalType:'Malingering',referral:'Court',     stage:'diagnostics', sessions:2, hrs:5.0, deadline:'2026-04-02', charges:'Theft (F4)', jurisdiction:'Denver District Court',                                           attorney:'ADA Nancy Clark' },
  { num:'2026-0189', last:'Ramirez',    first:'Sofia',   mi:'',  evalType:'Risk',       referral:'Court',     stage:'onboarding',  sessions:0, hrs:0.0, deadline:'2026-05-15', charges:'Harassment (M1), Stalking (M1)', jurisdiction:'Adams County',                               attorney:'PD Raymond Ortiz' },
  { num:'2026-0190', last:'Singh',      first:'Rajveer', mi:'',  evalType:'Fitness',    referral:'Court',     stage:'complete',    sessions:2, hrs:3.0, deadline:'2026-03-18', charges:'DUI (M1)', jurisdiction:'Weld County',                                                      attorney:'PD Carlos Diaz' },
  { num:'2026-0191', last:'Cooper',     first:'Ashley',  mi:'N', evalType:'CST',        referral:'Court',     stage:'review',      sessions:3, hrs:5.5, deadline:'2026-04-08', charges:'Assault 2nd (F4), Resisting Arrest (M2)', jurisdiction:'Denver District Court',           attorney:'PD Olivia Barnes' },
]

export function shouldSeedDemoCases(): boolean {
  return existsSync(TRIGGER)
}

export function createSeedTrigger(): void {
  writeFileSync(TRIGGER, new Date().toISOString(), 'utf-8')
}

export function seedDemoCases(): void {
  if (!existsSync(TRIGGER)) return

  const sqlite = getSqlite()
  const today = new Date().toISOString().split('T')[0]

  // Check if cases table has sessions_count / total_hours columns
  const cols: string[] = (sqlite.pragma('table_info(cases)') as Array<{ name: string }>).map(c => c.name)
  const hasSessionsCount = cols.includes('sessions_count')
  const hasTotalHours = cols.includes('total_hours')
  const hasReportDeadline = cols.includes('report_deadline')
  const hasCharges = cols.includes('charges')
  const hasJurisdiction = cols.includes('jurisdiction')
  const hasAttorney = cols.includes('attorney_of_record')

  const insertSQL = `
    INSERT OR IGNORE INTO cases (
      case_number,
      examinee_last_name,
      examinee_first_name,
      evaluation_type,
      referral_source,
      workflow_current_stage,
      folder_path,
      created_at
      ${hasReportDeadline ? ', report_deadline' : ''}
      ${hasCharges ? ', charges' : ''}
      ${hasJurisdiction ? ', jurisdiction' : ''}
      ${hasAttorney ? ', attorney_of_record' : ''}
      ${hasSessionsCount ? ', sessions_count' : ''}
      ${hasTotalHours ? ', total_hours' : ''}
    ) VALUES (
      @num, @last, @first, @evalType, @referral, @stage, @folderPath, @createdAt
      ${hasReportDeadline ? ', @deadline' : ''}
      ${hasCharges ? ', @charges' : ''}
      ${hasJurisdiction ? ', @jurisdiction' : ''}
      ${hasAttorney ? ', @attorney' : ''}
      ${hasSessionsCount ? ', @sessions' : ''}
      ${hasTotalHours ? ', @hrs' : ''}
    )
  `

  const insert = sqlite.prepare(insertSQL)
  let inserted = 0

  for (const c of DEMO_CASES) {
    const nameParts = [c.num, `${c.last},`, c.first + (c.mi ? ` ${c.mi}.` : '')]
    const folderName = nameParts.join(' ')
    const folderPath = join(WORKSPACE, folderName)

    try {
      insert.run({
        num: c.num,
        last: c.last,
        first: c.first,
        evalType: c.evalType,
        referral: c.referral,
        stage: c.stage,
        folderPath,
        createdAt: today,
        deadline: c.deadline,
        charges: c.charges || null,
        jurisdiction: c.jurisdiction || null,
        attorney: c.attorney || null,
        sessions: c.sessions,
        hrs: c.hrs,
      })
      inserted++
    } catch (e) {
      console.error('[seed] Failed to insert', c.num, (e as Error).message)
    }
  }

  console.log(`[seed] Inserted ${inserted}/${DEMO_CASES.length} demo cases`)

  // Remove trigger so this only runs once
  try { unlinkSync(TRIGGER) } catch { /* ignore */ }
}
