// =============================================================================
// Case 5: Bremner, Siobhan, PTSD Dx, TESTING stage, moderate complexity
// Civil personal injury, workplace MVC, plaintiff-retained
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature } from './shared'

const CASE_NUMBER = '2026-0421'
const EXAMINEE = 'Bremner, Siobhan K.'
const DOB = '1974-09-11'

const REFERRAL = `${SYNTHETIC_BANNER}

HALVORSEN & OSTROM LLP
Attorneys at Law
1400 17th Street, Suite 1800, Denver, CO 80202

February 24, 2026

Jordan Whitfield, Psy.D., ABPp
Pike Forensics

Re: Bremner v. Denver Western Stockyards, Inc.
Case No.: 2025-CV-01420 (Adams County District Court)

Dr. Whitfield,

We represent Ms. Siobhan K. Bremner in her civil action against Denver Western Stockyards following a workplace collision on October 8, 2024. Ms. Bremner was struck by a forklift while working in the receiving bay and sustained a right tibial plateau fracture. Since that date she has experienced substantial psychological symptoms that have prevented her return to work.

We are retaining you to conduct a diagnostic evaluation to determine whether Ms. Bremner meets DSM-5-TR criteria for Posttraumatic Stress Disorder, to identify any comorbid conditions, and to offer an opinion on the causal relationship between the October 8 incident and her current psychological condition.

Enclosed are the Safety and Health Administration incident report, the Anschutz Medical Center ED and follow-up records, the employer's return-to-work evaluations, and a complete release. The discovery deadline is August 15, 2026.

Please invoice our office. Our paralegal Noemi Caballero will coordinate scheduling at (303) 555-0172.

Merrit Halvorsen
Senior Partner
`

const INCIDENT_REPORT = `${SYNTHETIC_BANNER}

COLORADO DEPARTMENT OF LABOR AND EMPLOYMENT
OSHA-Reportable Incident Report (Redacted Summary)

Incident Date: October 8, 2024
Location: Denver Western Stockyards, 6850 E. 56th Avenue, Denver, CO
Reporting Supervisor: Alastair Penderghast, Operations Manager

SUMMARY

At approximately 11:15 AM on October 8, 2024, employee Siobhan K. Bremner was in the west receiving bay reviewing a shipment manifest when a forklift operated by another employee entered the bay without sounding its reverse alarm. The forklift struck Ms. Bremner in her right leg. She fell backward onto the concrete floor.

Emergency services were summoned and arrived within 7 minutes. Ms. Bremner was transported by ambulance to Anschutz Medical Center. Initial assessment by ED physician documented a displaced right tibial plateau fracture and mechanism-consistent soft tissue injuries. She was conscious throughout.

The forklift operator, Beaufort Van Dyken, stated he believed the bay was clear. The reverse alarm was subsequently determined to have been disconnected sometime in the two weeks prior; no record of the disconnection exists in maintenance logs. The alarm was restored and all bay procedures reviewed.

Ms. Bremner remained employed by Denver Western Stockyards until January 15, 2025, when she was placed on extended medical leave without return-to-work date.
`

const ED_RECORDS = `${SYNTHETIC_BANNER}

ANSCHUTZ MEDICAL CENTER
Emergency Department Report (Excerpt)

Patient: Siobhan K. Bremner (DOB 09/11/1974)
Arrival: 11:48 AM, October 8, 2024
Chief Complaint: Crush injury to right lower extremity

PRESENTATION

EMS reports 51-year-old woman struck by a forklift at her workplace. Conscious and oriented. Reports pain in right knee and leg 10/10. Denied loss of consciousness. GCS 15 throughout transport.

EXAMINATION

Vitals: BP 142/88, HR 108, RR 18, SpO2 98% on RA.
Obvious deformity of right proximal tibia with ecchymosis and swelling. Distal pulses intact. No open wound.

IMAGING

Right tibia/fibula X-ray: Displaced fracture of the right tibial plateau, Schatzker type II.
Right knee MRI (obtained 10/09): Confirmed fracture with mild associated meniscal injury.

COURSE

Orthopedic consult. Patient admitted for operative fixation on 10/09. ORIF performed by Dr. Karaduman without complication. Discharged to home with outpatient physical therapy on 10/13.

Observation note: Patient expressed significant anxiety in the ED about "the sound" of the forklift, asking repeatedly whether it was coming toward her again. Psychiatry consult not obtained in the ED. Social work provided general support.

Orley Dymbort, MD
ED Attending
`

const CAPS5_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Testing Note, CAPS-5 Partial Administration

Examinee: ${EXAMINEE}
Date: March 18, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP
Status: PARTIAL, Administration paused at Criterion D

ADMINISTRATION

CAPS-5 administration was initiated at 10:00 AM. The index event was clearly established as the October 8, 2024 workplace collision. Criterion A is met.

Criterion B (intrusion): Completed. Ms. Bremner endorsed 4 of 5 items at clinically significant frequency and intensity. Composite symptom severity for Criterion B: 8 (of a possible 20). Intrusion symptoms include weekly distressing dreams of the collision, dissociative reactions to the sound of backup alarms, and prolonged distress when watching warehouse scenes on television.

Criterion C (avoidance): Completed. Both items endorsed. She avoids warehouses, loading docks, and any audio content involving large vehicles. She has not returned to her workplace.

Criterion D (negative alterations in cognition and mood): Administration paused after 3 of 7 items due to examinee distress. Ms. Bremner became tearful while describing her inability to feel close to her husband since the incident, and requested a break. After a 15-minute break she indicated she wished to return another day.

NEXT STEPS

Resume Criterion D items on the next appointment. Complete Criteria E and F. Administer PCL-5 as a parallel self-report measure. Administer TSI-2 for validity and breadth of trauma symptoms. Consider the M-FAST for symptom validity given the civil context.

Ms. Bremner's distress during administration is clinically informative and consistent with a genuine PTSD presentation; it is not a reason to conclude the administration was invalid. The distress will be noted in the final report with the full context.

Next session: March 25, 2026.

Jordan Whitfield, Psy.D., ABPP
`

const PCL5_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
PCL-5 Self-Report Results

Examinee: ${EXAMINEE}
Date: March 18, 2026
Administration: Paper self-report, Pike Forensics office
Index trauma: Motor vehicle / workplace collision October 8, 2024

RESULTS

Total PCL-5 Score: 54
Screening threshold for probable PTSD: 33
Clinical significance: Well above threshold

Cluster scores:
  B (intrusion):       14 / 20
  C (avoidance):        8 / 8
  D (negative cognition and mood): 18 / 28
  E (arousal/reactivity): 14 / 24

INTERPRETATION

The PCL-5 total of 54 is substantially above the screening threshold of 33 and is consistent with probable PTSD. Cluster scores are elevated across all four DSM-5 PTSD criteria. Avoidance cluster is maximally endorsed.

The PCL-5 is a screening instrument, not a diagnostic one. The CAPS-5 (currently in progress) is the definitive diagnostic interview. The concordance between the PCL-5 self-report and the initial CAPS-5 findings is high.

Jordan Whitfield, Psy.D., ABPP
`

export const CASE_05_BREMNER: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-02-24',
  lastModified: '2026-03-18',
  firstName: 'Siobhan',
  lastName: 'Bremner',
  dob: DOB,
  gender: 'F',
  evaluationType: 'PTSD Dx',
  referralSource: 'Halvorsen & Ostrom LLP (Plaintiff)',
  evaluationQuestions:
    'DSM-5-TR PTSD criteria, comorbid conditions, causal relationship to October 2024 workplace collision.',
  stage: 'testing',
  caseStatus: 'in_progress',
  notes:
    'CAPS-5 in progress (paused at Criterion D). PCL-5 completed. TSI-2 and M-FAST scheduled.',
  complexity: 'moderate',
  summary:
    '51yo woman, workplace forklift collision 10/8/2024, tibial plateau fracture. No prior psych history. PCL-5 = 54, CAPS-5 in progress.',
  diagnoses: ['F43.10 Posttraumatic Stress Disorder (provisional, pending completion of CAPS-5)'],
  intake: {
    referral_type: 'attorney',
    referral_source: 'Merrit Halvorsen, Halvorsen & Ostrom LLP',
    eval_type: 'PTSD Dx',
    presenting_complaint:
      'Persistent trauma symptoms following workplace collision preventing return to work.',
    jurisdiction: 'Adams County District Court',
    charges: null,
    attorney_name: 'Merrit Halvorsen (plaintiff)',
    report_deadline: '2026-06-15',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Lives in Thornton with husband Calum Bremner. Reached via cell at (303) 555-0167. Attorney paralegal Noemi Caballero coordinates scheduling.',
      status: 'complete',
    },
    {
      section: 'complaints',
      content:
        'Intrusion, avoidance, negative mood, hyperarousal. Unable to return to workplace. Deteriorated marital closeness since the incident.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'No prior psychiatric history, no prior treatment, no prior medications. Primary care records confirm no mental health concerns prior to October 2024.',
      status: 'complete',
    },
    {
      section: 'health',
      content:
        'ORIF right tibial plateau October 2024 without complication. Completed PT through June 2025. Residual knee stiffness.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'Associate degree in business administration. Employed at Denver Western Stockyards 2009 to present (on extended leave since January 2025).',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Plaintiff_Counsel_Referral.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Plaintiff counsel referral letter',
    },
    {
      subfolder: 'Collateral',
      filename: 'OSHA_Incident_Report.txt',
      documentType: 'other',
      content: INCIDENT_REPORT,
      description: 'OSHA-reportable incident report, October 2024',
    },
    {
      subfolder: 'Collateral',
      filename: 'Anschutz_ED_Report.txt',
      documentType: 'other',
      content: ED_RECORDS,
      description: 'Anschutz ED report October 8, 2024',
    },
    {
      subfolder: 'Testing',
      filename: 'CAPS-5_Partial_Administration_Note.txt',
      documentType: 'other',
      content: CAPS5_NOTE,
      description: 'CAPS-5 partial administration note',
    },
    {
      subfolder: 'Testing',
      filename: 'PCL-5_Self_Report_Results.txt',
      documentType: 'other',
      content: PCL5_RESULTS,
      description: 'PCL-5 self-report results, total 54',
    },
  ],
}
