// =============================================================================
// Case 9: Lockridge, Keandre, CST Juvenile, ONBOARDING stage, complex
// 16yo transferred to adult court, developmental capacity questions
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER } from './shared'

const CASE_NUMBER = '2026-0489'
const EXAMINEE = 'Lockridge, Keandre J.'
const DOB = '2009-03-15'

const COURT_ORDER = `${SYNTHETIC_BANNER}

DENVER DISTRICT COURT
Case Number: ${CASE_NUMBER}-CR
Division: Criminal (Juvenile Transfer)
Judge: Hon. Wendell Straczynski

THE PEOPLE OF THE STATE OF COLORADO v. KEANDRE J. LOCKRIDGE
Juvenile (DOB 03/15/2009, age 16)
Charge: Aggravated Robbery (C.R.S. 18-4-302), transferred to adult court

ORDER FOR PRE-TRANSFER COMPETENCY AND DEVELOPMENTAL CAPACITY EVALUATION

The People have filed a motion to transfer this matter to adult criminal court under C.R.S. 19-2.5-802. Prior to the transfer hearing, defense counsel has requested a competency evaluation under C.R.S. 16-8.5 AND a developmental maturity evaluation addressing whether Mr. Lockridge has the capacity to participate meaningfully in adult criminal proceedings.

IT IS HEREBY ORDERED that Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed to conduct both evaluations in a single integrated report.

The evaluator is specifically requested to address:
1. Dusky competency (factual and rational understanding, consultation with counsel)
2. Developmental capacity for adult criminal proceedings
3. Any cognitive or mental health factors bearing on competency or transfer

The written report is due no later than June 1, 2026. Proceedings are stayed pending the report.

BY THE COURT:
Wendell Straczynski
District Court Judge
Dated: April 1, 2026
`

const REFERRAL = `${SYNTHETIC_BANNER}

COLORADO JUVENILE DEFENSE COALITION
Office of the Appointed Attorney
600 17th Street, Denver, CO 80202

April 3, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: State v. Keandre J. Lockridge (juvenile age 16)
Case No.: ${CASE_NUMBER}-CR

Dr. Whitfield,

I represent Keandre Lockridge in a juvenile transfer matter. The state has moved to transfer Keandre's aggravated robbery case to adult court. Given Keandre's age, limited educational history, and significant adverse childhood experiences, I have concerns about both (a) his competency under Dusky and (b) his developmental capacity to participate in adult proceedings even if found competent under Dusky.

Keandre is currently held at the Gilliam Youth Services Center. I am also requesting a Denver Public Schools records release and a Denver Human Services records release from his prior dependency case (2015 to 2018, during which he and his sister were removed from their mother's care after which she successfully completed reunification).

This is a complex case and I am grateful for your time. My paralegal Oswyn Penhaligon will coordinate scheduling at (303) 555-0155.

Daria Kwiatkowski
Juvenile Defender
`

const RECORDS_REQUEST = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Records Request Log

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}
Logged: April 5, 2026

1. Denver Public Schools records (2014 to present)
   - Requested from: DPS Central Records Office
   - Release signed: Yes (via defense counsel)
   - Date sent: April 5
   - Status: pending, 7-10 business day turnaround

2. Denver Human Services records (2015 to 2018 dependency case)
   - Requested from: DHS Records Custodian
   - Release signed: Yes (via defense counsel)
   - Date sent: April 5
   - Status: pending, expected 14 days

3. Gilliam Youth Services Center mental health and educational records (current)
   - Requested from: Gilliam YSC Records
   - Release signed: Yes
   - Date sent: April 5
   - Status: pending

4. Prior pediatric mental health records (Children's Hospital Colorado, 2015 to 2019)
   - Requested from: Children's Hospital HIM
   - Release signed: Yes
   - Date sent: April 5
   - Status: pending

5. Police incident report (instant offense)
   - Already in file from defense counsel
   - Date received: April 3

Jordan Whitfield, Psy.D., ABPP
`

const INITIAL_CONTACT = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Initial Contact Note

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}
Contact date: April 4, 2026
Contact type: Telephone with defense counsel Daria Kwiatkowski

Ms. Kwiatkowski called to confirm receipt of my acceptance of the appointment. She briefed me on the following:

1. Keandre's history of adverse childhood experiences: Keandre and his sister Makayla (now 19) were removed from their mother's care in 2015 following allegations of neglect related to her methamphetamine use. They spent approximately three years in foster care before successfully reunifying in 2018. His mother Carissa Lockridge has been sober since 2017 and is actively involved in his care.

2. Educational history: Keandre has been educated in Denver Public Schools. He was placed in special education services for a Specific Learning Disorder in reading in third grade. His IEP has been maintained continuously. His 2024 WIAT-IV results (most recent available) showed Basic Reading at the 12th percentile and Reading Comprehension at the 8th percentile.

3. Prior mental health: Outpatient trauma-focused therapy at Children's Hospital Colorado from 2016 to 2019. Never psychiatrically hospitalized. Not currently medicated.

4. Instant offense: Aggravated robbery charge from February 28, 2026 involving a convenience store. Keandre was one of three co-defendants. The other two are over 18. The knife was in the possession of one of the adult co-defendants. Keandre entered the store first.

5. Counsel's specific concerns: Keandre is cooperative but functions very concretely. In their first meeting, Keandre could not explain what "transfer to adult court" meant despite Ms. Kwiatkowski's explanation twice. He asked "does that mean I go to the grown-up jail?" without appearing to grasp the longer-term implications for his education, housing, and adult record.

NEXT STEPS

1. Review records as they arrive
2. Schedule first interview at Gilliam YSC for April 17 (confirmed by facility)
3. Schedule collateral interview with Carissa Lockridge at Pike Forensics on April 22
4. Plan developmental assessment battery including age-normed competency measures

Jordan Whitfield, Psy.D., ABPP
`

export const CASE_09_LOCKRIDGE: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-04-01',
  lastModified: '2026-04-05',
  firstName: 'Keandre',
  lastName: 'Lockridge',
  dob: DOB,
  gender: 'M',
  evaluationType: 'CST',
  referralSource: 'Juvenile Defense Coalition / Denver District Court',
  evaluationQuestions:
    'Dusky competency AND developmental capacity for adult criminal proceedings in a 16-year-old with documented learning disability and childhood trauma history.',
  stage: 'onboarding',
  caseStatus: 'intake',
  notes:
    'Case just received. Records requested. First interview scheduled April 17 at Gilliam YSC.',
  complexity: 'complex',
  summary:
    '16yo, charged with aggravated robbery, transfer to adult court pending. SLD reading, childhood trauma, cooperative but concrete.',
  diagnoses: [
    'F81.0 Specific Learning Disorder with impairment in reading (childhood)',
  ],
  intake: {
    referral_type: 'court',
    referral_source: 'Hon. Wendell Straczynski, Denver District Court',
    eval_type: 'CST',
    presenting_complaint:
      'Juvenile transferred to adult court; competency and developmental maturity.',
    jurisdiction: 'Denver County (2nd Judicial District)',
    charges: 'Aggravated Robbery (C.R.S. 18-4-302)',
    attorney_name: 'Daria Kwiatkowski, Juvenile Defender',
    report_deadline: '2026-06-01',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Held at Gilliam Youth Services Center, Denver. Mother Carissa Lockridge is primary contact. Defense counsel Daria Kwiatkowski via (303) 555-0155.',
      status: 'complete',
    },
    {
      section: 'family',
      content:
        'Mother Carissa, older sister Makayla (19). Removed from mother 2015 to 2018 for neglect related to maternal meth use. Mother sober since 2017. Father not involved.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'Denver Public Schools. SLD in reading identified 3rd grade, IEP maintained. WIAT-IV 2024: Basic Reading 12th pctl, Reading Comp 8th pctl. Currently 10th grade.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'Trauma-focused outpatient therapy at Children\'s Hospital Colorado 2016 to 2019. Never psychiatrically hospitalized. No current medications.',
      status: 'complete',
    },
    {
      section: 'legal',
      content:
        '2015-2018 dependency case. No juvenile delinquency prior to February 2026. Instant offense: aggravated robbery co-defendant with two adults.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Juvenile_Defender_Referral.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Juvenile Defense Coalition referral letter',
    },
    {
      subfolder: 'Collateral',
      filename: 'Court_Order_CST_and_Developmental.txt',
      documentType: 'other',
      content: COURT_ORDER,
      description: 'Court order for integrated CST and developmental evaluation',
    },
    {
      subfolder: '_Inbox',
      filename: 'Records_Request_Log.txt',
      documentType: 'other',
      content: RECORDS_REQUEST,
      description: 'Log of 5 records requests in progress',
    },
    {
      subfolder: '_Inbox',
      filename: 'Initial_Contact_Note.txt',
      documentType: 'other',
      content: INITIAL_CONTACT,
      description: 'Initial contact with defense counsel and planning',
    },
  ],
}
