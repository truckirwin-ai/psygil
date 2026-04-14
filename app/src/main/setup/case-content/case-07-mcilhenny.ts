// =============================================================================
// Case 7: McIlhenny, Connor, Fitness for Duty, COMPLETE stage
// Post-shooting-incident FFD for Colorado Springs PD officer
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature, reportHeader } from './shared'

const CASE_NUMBER = '2026-0459'
const EXAMINEE = 'McIlhenny, Connor P.'
const DOB = '1987-05-22'
const COURT = 'Colorado Springs Police Department, Office of Internal Affairs'

const COMMAND_MEMO = `${SYNTHETIC_BANNER}

COLORADO SPRINGS POLICE DEPARTMENT
Office of the Chief
705 S. Nevada Avenue, Colorado Springs, CO 80903

January 7, 2026

FITNESS-FOR-DUTY EVALUATION REFERRAL

Subject Officer: Connor P. McIlhenny, Badge 8812
Assigned Unit: Patrol, District 3
Years of Service: 11

INCIDENT

On December 14, 2025, Officer McIlhenny was the primary responding officer to a domestic disturbance call in the 6200 block of N. Powers Boulevard. Upon arrival, the subject (adult male) advanced on Officer McIlhenny while holding a knife. Officer McIlhenny discharged his service weapon twice, striking the subject in the torso. The subject was pronounced at Memorial Hospital Central 35 minutes after arrival.

The officer-involved shooting was reviewed by the CSPD Use of Force Review Board on December 22, 2025 and found to be within policy. The subject's family has not initiated civil action as of this date.

REASON FOR REFERRAL

Per departmental policy, a fitness-for-duty evaluation is required following any officer-involved shooting before the officer returns to full duty. Officer McIlhenny has been on administrative leave with pay since December 15, 2025.

Specific questions:
1. Is Officer McIlhenny currently fit to perform the essential duties of a patrol officer?
2. If not currently fit, what accommodations or treatment would support a return to duty?
3. Are there any safety concerns related to Officer McIlhenny's current psychological state?

Payment: Departmental cost center 303-IA-Evals. Standard FFD rate schedule.

Chief Ingrid Aasgard
Colorado Springs Police Department
`

const MMPI3_RESULTS = `${SYNTHETIC_BANNER}

PIKE FORENSICS
MMPI-3 Results Summary

Examinee: ${EXAMINEE}
Date: January 20, 2026
Administration: In-office, paper form
Examiner: Jordan Whitfield, Psy.D., ABPP

VALIDITY SCALES

CNS:    3        (within normal limits)
VRIN-r: T=48
TRIN-r: T=55
F-r:    T=52
Fp-r:   T=47
Fs:     T=51
FBS-r:  T=49
RBS:    T=55
L-r:    T=58
K-r:    T=61

All validity indices are within normal limits. No indication of random, inconsistent, over-reporting, or underreporting. The K-r and L-r elevations are mildly in the self-favorable direction, consistent with the public safety context but not at a level that distorts interpretation.

SUBSTANTIVE SCALES

Higher Order:
  EID (Emotional/Internalizing Dysfunction): T=58
  THD (Thought Dysfunction):                 T=45
  BXD (Behavioral/Externalizing Dysfunction): T=52

Restructured Clinical:
  RCd (Demoralization):        T=56
  RC1 (Somatic Complaints):    T=48
  RC2 (Low Positive Emotions): T=54
  RC3 (Cynicism):              T=59
  RC4 (Antisocial Behavior):   T=51
  RC6 (Ideas of Persecution):  T=44
  RC7 (Dysfunctional Negative Emotions): T=62
  RC8 (Aberrant Experiences):  T=43
  RC9 (Hypomanic Activation):  T=52

All RC scales are within normal limits (T<65). The mild elevation on RC7 (T=62) reflects situationally appropriate negative emotional arousal in the context of the recent critical incident. There is no indication of a psychotic, thought, or personality disorder.

INTERPRETATION

Officer McIlhenny's MMPI-3 profile is within normal limits across all validity and substantive scales. There is no evidence of a current mental disorder that would preclude return to full patrol duty. The mildly elevated RC7 is clinically coherent with acute stress following a critical incident and does not itself reach clinical significance.

Jordan Whitfield, Psy.D., ABPP
`

const INTERVIEW = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Structured Fitness for Duty Interview

Examinee: ${EXAMINEE}
Date: January 27, 2026
Duration: 150 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTIFICATION

Officer McIlhenny was informed at the outset that this evaluation was requested by his department, that information shared would be reported to the department's designated recipient (Chief Aasgard), and that the evaluation did not create a treating relationship. He acknowledged understanding in his own words and agreed to proceed.

PERSONAL AND OCCUPATIONAL HISTORY

Officer McIlhenny is a 38-year-old man who joined the Colorado Springs Police Department in 2015 after six years as an Army Military Police officer (no deployments). He is married to Hana Thorburn-McIlhenny (RN, Memorial Hospital); they have two children ages 7 and 4. He holds an associate's degree in criminal justice. His department record includes no sustained complaints and two commendations for community engagement.

THE INCIDENT

Officer McIlhenny described the December 14 incident in his own words without prompting. His account was organized, factual, and consistent with the reports already in the file. He identified the moment he decided to fire, identified that he called for a supervisor and EMS immediately, and described his actions at the scene until relief arrived. He showed appropriate emotional engagement: a brief tearing of the eyes when describing the subject being pronounced, followed by a clear return to narrative.

POST-INCIDENT SYMPTOMS

First two weeks post-incident: difficulty sleeping (average 4 to 5 hours), intrusive memories (daily) of the subject advancing with the knife, mild hypervigilance in public, one instance of elevated startle response when a neighbor dropped a toolbox. He attended the department's mandatory debrief and met twice with his peer support officer. He initiated his own contact with a civilian therapist on January 5.

Weeks three and four: Sleep improving to 6 to 7 hours. Intrusive memories reduced to 2 or 3 times per week. Hypervigilance reduced. Attended 3 sessions with his therapist. Was able to go to his children's winter concert.

Current (week six): Sleep normalized. No nightmares for two weeks. Intrusions occur only when prompted by specific cues (knife imagery in media). He reports feeling "ready to go back, with support." He plans to continue therapy through the next several months and intends to attend the department's peer support retreat in March.

CAPACITY EVALUATION

Officer McIlhenny was asked how he would respond if called to a similar incident. His answer was thoughtful: he described a graduated return-to-duty approach he had discussed with his sergeant, beginning with administrative and training duty and transitioning back to patrol with his regular partner for the first two weeks. He described what he would need from his supervisor ("I want to be told if they see me hesitating"). He did not express bravado, denial, or inappropriate readiness.

IMPRESSION

Officer McIlhenny is showing a clinically appropriate acute stress response to a critical incident. His symptoms peaked in the first two weeks, responded to peer support and private therapy, and are substantially resolved at six weeks. His insight is intact. He has an appropriate support system and a coherent return-to-duty plan. There is no indication of PTSD, depression, substance misuse, or safety concerns.

Jordan Whitfield, Psy.D., ABPP
`

const FFD_REPORT = `${reportHeader(
  CASE_NUMBER,
  EXAMINEE,
  DOB,
  'Fitness for Duty Evaluation',
  COURT,
)}REFERRAL QUESTION

The Colorado Springs Police Department requested a fitness-for-duty evaluation of Officer Connor P. McIlhenny following an officer-involved shooting on December 14, 2025. The referral asked whether Officer McIlhenny is currently fit to perform the essential duties of a patrol officer, what accommodations or treatment would support return to duty if he is not, and whether there are any safety concerns related to his current psychological state.

PROCEDURES

I reviewed the CSPD Incident Report #2025-12-3401, the Use of Force Review Board findings dated December 22, 2025, the debrief notes from the mandatory critical incident debrief dated December 18, 2025, and Officer McIlhenny's department personnel summary. I conducted an extended clinical interview on January 27, 2026 (approximately 2.5 hours) and administered the MMPI-3 on January 20, 2026. Collateral telephone contact was made with Hana Thorburn-McIlhenny (wife) on January 29, 2026.

BACKGROUND

Officer McIlhenny is a 38-year-old man who joined CSPD in 2015 after six years as an Army Military Police officer. He is married and has two children. His department record is positive with no sustained complaints. He has no prior psychological issues, no prior critical incidents of this magnitude, and no mental health treatment prior to January 2026.

MENTAL STATUS

Officer McIlhenny presented well-groomed, cooperative, and organized. Mood was described as "getting back to normal." Affect was appropriate with a brief moment of tearfulness when describing the outcome of the subject. Speech was fluent and coherent. Thought process was logical and goal-directed. He denied suicidal or homicidal ideation, hallucinations, and delusions.

CLINICAL COURSE

Officer McIlhenny showed an acute stress response in the two weeks following the incident (sleep disruption, intrusions, mild hypervigilance) that has substantially resolved at the six-week mark with the combination of peer support, self-initiated civilian therapy, and appropriate family support. He does not meet criteria for Posttraumatic Stress Disorder or Acute Stress Disorder. He shows brief, contextually appropriate features consistent with an Adjustment Disorder with Anxiety (F43.22) that is nearly resolved.

Collateral from his wife confirmed the self-report: improved sleep, normalized family engagement, active use of coping strategies, no concerning behavior.

TESTING

MMPI-3 administered January 20, 2026. All validity scales within normal limits. All substantive scales within normal limits with the exception of a mild elevation on RC7 (T=62) reflecting situationally appropriate negative emotional arousal. No evidence of a current mental disorder on objective testing.

OPINION

To a reasonable degree of psychological certainty, Officer Connor P. McIlhenny is currently fit for duty as a patrol officer. His acute stress response has substantially resolved, his insight is intact, he has an appropriate support system and continued treatment engagement, and his approach to return to duty is thoughtful and collaborative.

RECOMMENDATIONS

1. Graduated return to duty beginning with two weeks of administrative and training duty, transitioning to patrol with his regular partner thereafter.
2. Continuation of his current civilian therapy for at least four additional months.
3. Attendance at the department peer support retreat scheduled for March 2026.
4. Scheduled supervisor check-in at 30 days post-return with explicit permission for Officer McIlhenny to raise concerns at any time.
5. If significant new symptoms arise in the first 90 days post-return, re-evaluation should be considered.

Officer McIlhenny's current clinical trajectory is favorable. The recommendations above are intended as structure and support rather than as restrictions driven by concern.
${clinicianSignature()}`

export const CASE_07_MCILHENNY: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-01-07',
  lastModified: '2026-02-05',
  firstName: 'Connor',
  lastName: 'McIlhenny',
  dob: DOB,
  gender: 'M',
  evaluationType: 'Fitness for Duty',
  referralSource: 'Colorado Springs Police Department',
  evaluationQuestions:
    'Current fitness for patrol duty following December 2025 officer-involved shooting; accommodations; safety concerns.',
  stage: 'complete',
  caseStatus: 'completed',
  notes: 'FFD report complete. Cleared for duty with graduated return plan.',
  complexity: 'moderate',
  summary:
    '38yo police officer, 11 years service, fit for duty following December OIS with appropriate acute stress response resolving.',
  diagnoses: ['F43.22 Adjustment Disorder with Anxiety (resolving)'],
  intake: {
    referral_type: 'attorney',
    referral_source: 'Chief Ingrid Aasgard, CSPD',
    eval_type: 'Fitness for Duty',
    presenting_complaint:
      'Post-OIS fitness for duty evaluation. Officer on administrative leave since December 15, 2025.',
    jurisdiction: 'El Paso County',
    charges: null,
    attorney_name: null,
    report_deadline: '2026-02-15',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'CSPD badge 8812. Wife Hana Thorburn-McIlhenny (RN, Memorial Hospital). Two children ages 7 and 4. Civilian therapist since January 5, 2026.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'No prior psychiatric history. Initiated civilian therapy January 5, 2026. Attending departmental peer support. Acute stress response with steady resolution.',
      status: 'complete',
    },
    {
      section: 'legal',
      content:
        'OIS on December 14, 2025 ruled within policy by Use of Force Review Board December 22, 2025.',
      status: 'complete',
    },
    {
      section: 'recent',
      content:
        'On administrative leave December 15, 2025 to present. Self-initiated therapy week three post-incident. Positive family support.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Chief_Referral_Memo.txt',
      documentType: 'other',
      content: COMMAND_MEMO,
      description: 'Chief of Police FFD referral memo',
    },
    {
      subfolder: 'Testing',
      filename: 'MMPI-3_Results_Summary.txt',
      documentType: 'other',
      content: MMPI3_RESULTS,
      description: 'MMPI-3 results, within normal limits',
    },
    {
      subfolder: 'Interviews',
      filename: 'Structured_FFD_Interview.txt',
      documentType: 'other',
      content: INTERVIEW,
      description: 'Structured FFD interview notes',
    },
    {
      subfolder: 'Reports',
      filename: 'FINAL_FFD_Report.txt',
      documentType: 'other',
      content: FFD_REPORT,
      description: 'Final FFD report, cleared for duty',
    },
  ],
}
