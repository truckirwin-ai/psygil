// =============================================================================
// Case 3: Willoughby, Dante, Risk Assessment, COMPLETE stage
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature, reportHeader } from './shared'

const CASE_NUMBER = '2026-0362'
const EXAMINEE = 'Willoughby, Dante M.'
const DOB = '1983-04-19'
const COURT = 'Jefferson County Parole Board'

const REFERRAL = `${SYNTHETIC_BANNER}

JEFFERSON COUNTY PAROLE BOARD
Office of Community Supervision
1000 10th Street, Golden, CO 80401

February 1, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics

Re: Willoughby, Dante M. (DOC #A-2027156)
Parole Eligibility Hearing Date: March 15, 2026

Dr. Whitfield,

The Jefferson County Parole Board requests a structured violence risk assessment for Mr. Dante M. Willoughby in advance of his March 15 eligibility hearing. Mr. Willoughby is serving a sentence for First Degree Assault (C.R.S. 18-3-202) with a prior conviction for Domestic Violence Assault from 2014. He has completed the Responsible Thinking program and has been infraction-free for 18 months.

The Board seeks an opinion on Mr. Willoughby's risk of future violence if granted parole, the factors that most contribute to that risk, and specific release conditions that would mitigate identified risks.

Please use the HCR-20v3 as the primary structured instrument. Additional measures at your discretion.

Maricela Hoeflich, LCSW
Senior Parole Hearing Officer
`

const HCR20_SUMMARY = `${SYNTHETIC_BANNER}

PIKE FORENSICS
HCR-20v3 Worksheet Summary

Examinee: ${EXAMINEE}
Interview dates: February 18 and March 2, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

HISTORICAL ITEMS (H1 to H10)

H1 Violence                  Present   High relevance
  Two adult convictions (2014 DV, 2019 First Degree Assault). Documented childhood fights and a juvenile adjudication for assault at age 15.

H2 Other antisocial behavior  Present   Moderate relevance
  Prior arrests for drug offenses and shoplifting. No felony non-violent offenses.

H3 Relationships              Present   High relevance
  Pattern of short, conflict-laden romantic relationships, two of which involved intimate partner violence.

H4 Employment                 Present   Moderate relevance
  Longest job held: 11 months. Poor response to supervisors historically.

H5 Substance use              Present   High relevance
  Alcohol Use Disorder prior to incarceration; both prior violent incidents involved alcohol intoxication.

H6 Major mental disorder      Possibly  Moderate relevance
  No psychotic disorder. Some depressive features during incarceration, consistent with Adjustment Disorder.

H7 Personality disorder       Present   High relevance
  Meets criteria for Antisocial Personality Disorder (F60.2).

H8 Traumatic experiences      Present   Moderate relevance
  Witnessed domestic violence in childhood. Father incarcerated. Self-reports no formal trauma treatment.

H9 Violent attitudes          Possibly  Moderate relevance
  At intake, scored 18 on CTS-R for Violence Normativity. Scores have declined over course of programming.

H10 Treatment response        Present   High relevance
  Prior outpatient court-mandated treatment in 2014 was minimally engaged. Current in-custody programming shows substantial improvement.

CLINICAL ITEMS (C1 to C5)

C1 Insight                    Possibly  High relevance
  Can describe how alcohol contributed to both prior incidents. Reluctant to fully own the 2019 offense; uses language like "the fight got out of hand."

C2 Violent ideation or intent No        Not relevant
  Denies current violent thoughts or plans. No recent infractions.

C3 Active symptoms            No        Not relevant

C4 Instability                Possibly  Moderate relevance
  Mild emotional dysregulation under stressors; improved with current CBT group.

C5 Treatment response         Present   High relevance
  Completed Responsible Thinking (18 months), CBT for Substance Use (12 months), active in Alcoholics Anonymous.

RISK MANAGEMENT ITEMS (R1 to R5)

R1 Professional services     Possibly  High relevance
  Release plan includes ongoing DUI monitoring and substance use counseling. Parole officer assignment confirmed.

R2 Living situation          Possibly  High relevance
  Will reside with adult sister Leandra Willoughby in Golden. Stable housing. No cohabitating partner.

R3 Personal support          Present   Moderate relevance
  Sister and AA sponsor are primary supports.

R4 Treatment response        Present   High relevance
  Projected engagement is favorable based on current trajectory.

R5 Stress or coping          Possibly  High relevance
  Anticipated stressors: reintegration, job search, possible contact with past social network.

CASE FORMULATION

Mr. Willoughby's historical risk profile is moderate to high, driven by two prior violent incidents, antisocial personality features, alcohol use disorder, and poor prior treatment engagement. His clinical profile shows meaningful improvement: insight has grown, positive symptoms are absent, and his current treatment response is strong. Risk management factors are favorable (stable housing, family support, structured release plan).

The highest-risk scenario is a return to alcohol use combined with an intimate partner conflict. Protective factors against this scenario are the absence of a current partner, the absence of cohabiting relationships in the release plan, AA involvement, and active CBT for substance use. No firearms history.

SUMMARY RISK JUDGMENT

For the 24 months following release to parole, MODERATE risk for violence, with risk concentrated in specific high-risk scenarios (alcohol relapse, intimate partner reintroduction). Risk is LOW for stranger violence.

Jordan Whitfield, Psy.D., ABPP
`

const FINAL_REPORT = `${reportHeader(
  CASE_NUMBER,
  EXAMINEE,
  DOB,
  'Violence Risk Assessment (HCR-20v3)',
  COURT,
)}REFERRAL QUESTION

The Jefferson County Parole Board requested a structured violence risk assessment to inform Mr. Willoughby's March 15, 2026 parole eligibility hearing. Specific questions: (1) likelihood of future violence if released on parole, (2) factors most contributing to that risk, and (3) release conditions that would mitigate identified risks.

PROCEDURES

I reviewed Mr. Willoughby's DOC file including all prior convictions, disciplinary history, program completions, and mental health records. I conducted two clinical interviews on February 18 and March 2, 2026. I administered the HCR-20v3 through interview, record review, and collateral input from his corrections case manager Oleta Vandermark. Collateral telephone contact was made with his sister Leandra Willoughby.

RELEVANT BACKGROUND

Mr. Willoughby is a 42-year-old African American man raised in Pueblo by his mother and maternal grandmother. His father was incarcerated during most of his childhood. He witnessed intimate partner violence between his mother and a stepfather between ages 7 and 12. He completed 10th grade and later earned a GED in DOC custody.

He has two prior convictions for violence. The 2014 conviction was a DV misdemeanor plea from an original felony assault charge involving a live-in girlfriend. He completed court-mandated DV treatment with minimal engagement. The 2019 First Degree Assault conviction involved a bar fight in which Mr. Willoughby struck a stranger with a bar stool during an alcohol-related altercation; the victim suffered a fractured skull and recovered with surgical intervention. Mr. Willoughby received an 8-year sentence and has served 6 years.

His in-custody record shows no infractions in the last 18 months. He completed the Responsible Thinking program, CBT for Substance Use, and anger management. He attends AA weekly. He is employed in the prison kitchen at the highest available trust level.

DIAGNOSTIC IMPRESSION

Antisocial Personality Disorder (F60.2)
Alcohol Use Disorder, in sustained remission in a controlled environment (F10.21)

STRUCTURED RISK ASSESSMENT

Using the HCR-20v3 framework, Mr. Willoughby presents with a moderate to high historical profile, an improved clinical profile, and a favorable risk management profile. Historical risk is anchored by two violent convictions (both alcohol-involved), antisocial personality features, a history of intimate partner violence, and childhood exposure to violence. Dynamic clinical factors have improved substantially: he has developed insight into the role of alcohol in his violence, he is asymptomatic, and his treatment engagement is strong. Release plan factors are favorable: stable housing with a non-romantic relative, identified outpatient services, and a parole officer assignment.

SUMMARY RISK JUDGMENT

For the 24 months following release to parole, Mr. Willoughby's risk of future violence is MODERATE. Risk is not distributed randomly: it is concentrated in two specific scenarios. The first is a return to alcohol use, particularly in a social drinking context. The second is the reintroduction of a romantic partner under conditions of financial or emotional stress, given his documented pattern of intimate partner conflict. Outside these scenarios his risk for violence is low. His risk for stranger violence in the absence of alcohol is low.

RECOMMENDATIONS

If the Board grants parole, the following conditions would meaningfully mitigate the identified risks:

1. Continuous alcohol monitoring for at least 12 months. Ethyl glucuronide testing is more sensitive than traditional breathalyzer testing and is recommended.
2. Continuing outpatient CBT for Substance Use with a therapist experienced in relapse prevention.
3. Continuing AA participation with sponsor verification.
4. A 12-month restriction on cohabitating romantic relationships, with verification at parole meetings.
5. Immediate return to supervision if any alcohol-positive screen occurs, rather than awaiting a violation hearing.
6. A structured return-to-work plan developed with his parole officer within 30 days of release.

If the Board denies parole, clinical factors support a recommendation that Mr. Willoughby continue his current programming and be reconsidered at his next eligibility hearing.
${clinicianSignature()}`

export const CASE_03_WILLOUGHBY: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-02-01',
  lastModified: '2026-03-10',
  firstName: 'Dante',
  lastName: 'Willoughby',
  dob: DOB,
  gender: 'M',
  evaluationType: 'Risk Assessment',
  referralSource: 'Jefferson County Parole Board',
  evaluationQuestions:
    'Future violence risk, contributing factors, and mitigating release conditions using HCR-20v3.',
  stage: 'complete',
  caseStatus: 'completed',
  notes: 'Completed, signed, and delivered. Moderate risk, scenario-specific.',
  complexity: 'moderate',
  summary:
    '42yo man, 2 prior violent convictions, 6 years served, 18 months infraction-free, HCR-20v3 moderate risk.',
  diagnoses: [
    'F60.2 Antisocial Personality Disorder',
    'F10.21 Alcohol Use Disorder, in sustained remission in a controlled environment',
  ],
  intake: {
    referral_type: 'court',
    referral_source: 'Maricela Hoeflich, Jefferson County Parole Board',
    eval_type: 'Risk Assessment',
    presenting_complaint: 'Parole eligibility hearing; prior violent convictions.',
    jurisdiction: 'Jefferson County',
    charges: 'Prior: First Degree Assault (C.R.S. 18-3-202)',
    attorney_name: null,
    report_deadline: '2026-03-10',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'DOC facility Buena Vista. Case manager Oleta Vandermark. Sister Leandra Willoughby in Golden is release plan contact.',
      status: 'complete',
    },
    {
      section: 'legal',
      content:
        '2014 Domestic Violence misdemeanor (plea from original felony assault). 2019 First Degree Assault conviction, 8-year sentence, 6 served.',
      status: 'complete',
    },
    {
      section: 'substance',
      content:
        'Alcohol Use Disorder in sustained remission in controlled environment. Both prior violent incidents involved alcohol intoxication.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'No psychotic or mood disorder. Antisocial Personality Disorder features. Completed Responsible Thinking, CBT for Substance Use, anger management in custody.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Parole_Board_Referral.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Parole Board referral letter',
    },
    {
      subfolder: 'Testing',
      filename: 'HCR-20v3_Worksheet_Summary.txt',
      documentType: 'other',
      content: HCR20_SUMMARY,
      description: 'HCR-20v3 structured professional judgment worksheet',
    },
    {
      subfolder: 'Reports',
      filename: 'FINAL_Risk_Assessment_Report.txt',
      documentType: 'other',
      content: FINAL_REPORT,
      description: 'Final signed risk assessment report',
    },
  ],
}
