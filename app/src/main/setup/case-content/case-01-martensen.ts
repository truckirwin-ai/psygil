// =============================================================================
// Case 1: Martensen, Elijah, CST, Review stage, moderate complexity
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature, reportHeader } from './shared'

const CASE_NUMBER = '2026-0318'
const EXAMINEE = 'Martensen, Elijah D.'
const DOB = '1991-07-14'
const COURT = '18th Judicial District, Arapahoe County Division 7'

const REFERRAL: string = `${SYNTHETIC_BANNER}

LAW OFFICE OF HECTOR FUENTES
Arapahoe County Public Defender
6450 S. Revere Parkway
Centennial, CO 80111

March 3, 2026

Jordan Whitfield, Psy.D., ABPP
Pike Forensics
1420 Larimer Street, Suite 410
Denver, CO 80202

Re: State v. Elijah D. Martensen
Case No.: ${CASE_NUMBER}-CR
Charge: Second Degree Assault (C.R.S. 18-3-203)

Dear Dr. Whitfield,

I represent Mr. Martensen on a single count of second degree assault arising from an incident at a Centennial tavern on February 11, 2026. Mr. Martensen sustained a serious closed head injury in a 2017 motorcycle accident with documented post-concussive symptoms and intermittent cognitive lapses since. His mother reports he has been increasingly forgetful and verbally disorganized in the months leading up to the arrest.

I am requesting a competency to stand trial evaluation under C.R.S. 16-8.5. My specific concerns are Mr. Martensen's factual understanding of the charge and his ability to track the proceedings long enough to assist meaningfully in his defense. He is oriented and cooperative at the jail but loses the thread of conversations after a few minutes.

Enclosed are the arrest report, the 2017 neurology discharge summary, and a release for his records at Craig Hospital. Please contact my paralegal Lina Orozco at (303) 555-0184 for scheduling.

Sincerely,

Hector Fuentes
Attorney at Law
Reg. No. 38221
`

const COURT_ORDER: string = `${SYNTHETIC_BANNER}

DISTRICT COURT, ARAPAHOE COUNTY, COLORADO
Court Address: 7325 S. Potomac Street, Centennial, CO 80112

THE PEOPLE OF THE STATE OF COLORADO,
Plaintiff,
v.
ELIJAH D. MARTENSEN,
Defendant.

Case Number: ${CASE_NUMBER}-CR
Division: 7
Judge: Hon. Penelope Stransky

ORDER FOR COMPETENCY EVALUATION

THIS MATTER coming before the Court on defense counsel's Motion for a Competency Evaluation filed March 4, 2026, and the Court finding reasonable cause to believe the defendant may be incompetent to proceed, IT IS HEREBY ORDERED:

1. The defendant shall submit to a competency evaluation pursuant to C.R.S. 16-8.5-103.

2. Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed as the evaluating psychologist.

3. The evaluation shall address whether the defendant has a rational and factual understanding of the proceedings and the present ability to consult with counsel with a reasonable degree of rational understanding.

4. The evaluator shall have access to all relevant records, including medical and mental health records, and may interview collateral sources as necessary.

5. The written report shall be filed with the Court and provided to counsel for both parties no later than April 15, 2026.

6. Proceedings are stayed pending completion of the evaluation.

SO ORDERED this 5th day of March, 2026.

BY THE COURT:

Penelope Stransky
District Court Judge
`

const ARREST_REPORT: string = `${SYNTHETIC_BANNER}

CENTENNIAL POLICE DEPARTMENT
Case Report

Report Number: 2026-02-0471
Date of Incident: 02/11/2026
Time: Approximately 22:40 hours
Location: The Broken Spoke, 12890 E Arapahoe Road, Centennial, CO
Reporting Officer: Officer K. Villanueva, Badge 4112

INCIDENT SUMMARY

On the above date and time, I was dispatched to The Broken Spoke on a report of an assault in progress. Upon arrival I observed a male subject, later identified as Elijah D. Martensen (DOB: 07/14/1991), being held by two patrons. A second male subject, Dennis Orchard, was seated on a barstool holding a blood-soaked bar towel to his face.

Mr. Orchard stated that he had been playing pool with friends when Mr. Martensen approached the pool table and accused him of "talking about his mother." Mr. Orchard denied this. Mr. Martensen then struck Mr. Orchard in the face with a closed fist. Multiple witnesses confirmed this account.

Mr. Orchard sustained a laceration above his right eye and a fractured nasal bone per subsequent ED evaluation. He was transported to Centennial Medical Plaza by EMS and treated.

Mr. Martensen was taken into custody without further incident. He appeared confused and asked repeatedly why he had been stopped. He stated, "I don't remember being in here." He was unable to recall the events of the evening and was unable to provide a coherent account of his movements since leaving his mother's home earlier in the day.

Mr. Martensen was transported to the Arapahoe County Detention Facility and booked on a charge of second degree assault (C.R.S. 18-3-203).

Officer K. Villanueva
Centennial Police Department
`

const MEDICAL_RECORDS: string = `${SYNTHETIC_BANNER}

CRAIG HOSPITAL
3425 S. Clarkson Street
Englewood, CO 80113

DISCHARGE SUMMARY (Excerpt for Forensic Review)
Patient: Elijah D. Martensen
DOB: 07/14/1991
Admission Date: 08/22/2017
Discharge Date: 09/14/2017
Attending Physician: Rhea Montefiore, MD

HOSPITAL COURSE

Mr. Martensen was admitted to Craig Hospital after initial stabilization at Denver Health following a single-vehicle motorcycle collision on Interstate 70 west of Idaho Springs. Initial GCS at the scene was 7; intubation was performed en route. CT demonstrated a right temporal contusion with subarachnoid hemorrhage, a left frontal contusion, and a non-displaced skull fracture along the right temporal bone. ICP monitoring was initiated and remained elevated for 48 hours.

Mr. Martensen regained consciousness on hospital day 6 and began a graduated rehabilitation program focused on cognitive retraining, balance, and gait. At discharge he was ambulating without assistance, following two-step commands, and able to converse at a basic level. He continued to have word-finding difficulty, reduced processing speed, and impaired working memory. Post-concussive syndrome was documented.

DIAGNOSES AT DISCHARGE

1. Traumatic brain injury, moderate (S06.2X1A)
2. Post-concussive syndrome
3. Cognitive impairment, moderate

RECOMMENDATIONS

1. Outpatient speech-language therapy, twice weekly
2. Outpatient neuropsychology follow-up in 3 months
3. No return to motorcycle operation
4. Gradual reintroduction of work responsibilities under supervision
5. Family education regarding TBI recovery trajectory

Mr. Martensen and his mother, Marlena Martensen, acknowledged the discharge instructions.

Signed,
Rhea Montefiore, MD
`

const MOCA_SCREEN: string = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Screening Assessment Summary

Examinee: Elijah D. Martensen
Date of Administration: March 24, 2026
Location: Arapahoe County Detention Facility, Interview Room 4
Examiner: Jordan Whitfield, Psy.D., ABPP

MONTREAL COGNITIVE ASSESSMENT (MoCA)

Version: 8.2 (alternate form)
Administration time: 14 minutes
Total score: 22 of 30

Subtest breakdown:
  Visuospatial / Executive:    3 / 5
  Naming:                      2 / 3
  Attention:                   4 / 6
  Language:                    2 / 3
  Abstraction:                 1 / 2
  Delayed Recall:              2 / 5
  Orientation:                 6 / 6 (with prompt for day of week)

INTERPRETATION

A MoCA total of 22 is below the standard cutoff of 26 and consistent with mild cognitive impairment in an examinee with Mr. Martensen's documented history of moderate TBI. Delayed recall and executive function showed the greatest weakness. Basic orientation was preserved.

This screen supports the need for a structured competency interview with documentation of functional abilities across multiple contacts. The MoCA does not by itself answer the competency question.

Administered by: Jordan Whitfield, Psy.D., ABPP
`

const INTERVIEW_ONE: string = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES, SESSION 1
Examinee: Elijah D. Martensen
Date: March 24, 2026
Location: Arapahoe County Detention Facility
Duration: 90 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTIFICATION OF NON-CONFIDENTIALITY

Explained the purpose of the evaluation, the court referral, and the limits of confidentiality. Mr. Martensen restated the purpose in his own words: "You're checking if I understand my case. You'll write a report for the judge." He asked no questions and agreed to proceed.

MENTAL STATUS

Appropriately groomed in jail attire. Cooperative, slow to initiate speech, attentive to questions but required several repeated prompts for complex questions. Speech was fluent but showed mild word-finding pauses. Mood was described as "alright, kind of tired." Affect was restricted. Denied suicidal or homicidal ideation, auditory or visual hallucinations, and paranoid ideation. Oriented to person and place; stated the date was "the 22nd or 23rd" (actual was the 24th). Remote memory for personal history was generally intact. Recent memory showed multiple gaps.

FACTUAL UNDERSTANDING

Charges. Mr. Martensen named the charge as "assault." He could not recall the specific degree. When I read the charge to him (second degree assault), he acknowledged it without protest and said "OK, that sounds right."

Roles in the courtroom. He correctly identified the judge ("decides things"), the prosecutor ("the DA, trying to convict me"), and his own attorney ("Mr. Fuentes, he's on my side"). He described a jury as "people who listen and say if you did it." He was uncertain about the role of a court reporter.

Plea options. He identified guilty and not guilty. When asked about a third option, he said "I don't know. Is there another one?" I described no contest and a plea bargain; he said "Right, OK," but could not paraphrase either back to me when asked five minutes later.

INTERMEDIATE MEMORY NOTE

Mr. Martensen asked me twice during the interview "what was your name again?" and once "what are we doing here?" The second instance occurred approximately 35 minutes into the session. After a short break he re-engaged without apparent frustration.

Next session scheduled for April 4, 2026.

Jordan Whitfield, Psy.D., ABPP
`

const INTERVIEW_TWO: string = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES, SESSION 2
Examinee: Elijah D. Martensen
Date: April 4, 2026
Location: Arapahoe County Detention Facility
Duration: 75 minutes
Examiner: Jordan Whitfield, Psy.D., ABPP

FOLLOWUP MENTAL STATUS

Mr. Martensen appeared less fatigued than at session 1. He initiated conversation by correctly identifying me and stating the purpose of the meeting. Correctional staff reported he had been sleeping better in the last week after a minor housing change.

FACTUAL UNDERSTANDING RE-ASSESSMENT

Charges and procedure. Mr. Martensen could again name his charge and correctly paraphrase what it meant. He correctly named both prior plea options and, after prompting, recalled no contest and plea bargain. He could describe in his own words the difference between a plea and a trial.

Roles. Reliable across both sessions for judge, prosecutor, defense attorney, jury. Court reporter still unclear; he stated "someone who writes stuff down."

RATIONAL UNDERSTANDING

I asked Mr. Martensen what he thought his attorney would advise him to do, and why. He said "Fuentes told me the DA might offer a plea to a lesser charge because they know I have brain stuff. He says I should think about it before trial because trials are hard and juries don't like violent stuff." This response reflects an appropriate understanding of the attorney's role and a rational consideration of trial strategy.

CAPACITY TO CONSULT WITH COUNSEL

Mr. Martensen reported meeting with Mr. Fuentes twice in the week before this interview. He could recall the substance of both meetings (the topics, the recommendation, the next steps) with reasonable accuracy. He indicated he trusted his attorney and found him "patient about going slow for me."

When I asked him how he would want to handle questions from a prosecutor on the stand, he replied "I'd probably say I don't remember, because I really don't. I wouldn't make stuff up." This reflects an appropriate understanding of the obligation to answer honestly and an acknowledgment of his own memory limitations.

SUMMARY

Across two sessions Mr. Martensen has demonstrated factual understanding of the charges, roles, and procedural options. He is capable of providing meaningful direction to counsel, provided accommodations for his pace and memory are maintained. His cognitive impairment is real and has functional consequences, but it does not prevent competent participation.

Jordan Whitfield, Psy.D., ABPP
`

const FORMULATION: string = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Diagnostic Formulation

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}
Prepared by: Jordan Whitfield, Psy.D., ABPP
Date: April 8, 2026

DIAGNOSTIC IMPRESSION

1. Major Neurocognitive Disorder Due to Traumatic Brain Injury, mild severity (F02.80)
2. Adjustment Disorder with Depressed Mood (F43.21), contextual

Mr. Martensen's diagnostic picture is anchored in a well-documented moderate TBI sustained in 2017 with residual deficits in short-term memory, processing speed, and mild executive dysfunction. The MoCA total of 22 is consistent with this history. His adjustment features are secondary to his current legal situation and the loss of stable housing that preceded the arrest.

CRITERION ANALYSIS (F02.80)

Evidence of significant cognitive decline from a previous level of performance in one or more cognitive domains (memory and complex attention) based on concern of the individual, a knowledgeable informant, or the clinician (Mr. Martensen and his mother have both reported functional decline since 2017), and a substantial impairment documented by standardized neurocognitive assessment (MoCA 22 in the mild cognitive impairment range) or another quantified clinical assessment.

The cognitive deficits interfere with independence in everyday activities (Mr. Martensen has been unable to return to his former work as a journeyman electrician and lives with his mother). The deficits do not occur exclusively in the context of delirium. The deficits are not better explained by another mental disorder. Etiology is a documented TBI with abnormal neuroimaging.

Severity is mild: the examinee is capable of self-care, conversation, and structured tasks but requires support for complex planning and novel problem solving.

COMPETENCY OPINION

See the attached draft report for the formal opinion. In brief, Mr. Martensen's cognitive limitations are real and required accommodation during the evaluation, but across two sessions he demonstrated factual understanding of the charges and proceedings, rational understanding of the attorney-client relationship, and the capacity to consult with counsel within his pace.

Jordan Whitfield, Psy.D., ABPP
`

const DRAFT_REPORT: string = `${reportHeader(
  CASE_NUMBER,
  EXAMINEE,
  DOB,
  'Forensic Psychological Evaluation: Competency to Stand Trial',
  COURT,
)}REFERRAL QUESTION

The Court requested an evaluation addressing whether Mr. Elijah D. Martensen has a rational and factual understanding of the proceedings against him and sufficient present ability to consult with counsel, consistent with Dusky v. United States, 362 U.S. 402 (1960). Mr. Martensen is charged with one count of Second Degree Assault (C.R.S. 18-3-203).

PROCEDURES

I reviewed the arrest report dated February 11, 2026, the 2017 discharge summary from Craig Hospital, the jail medical screening notes from February 12 through March 23, 2026, and correspondence with defense counsel Hector Fuentes. I conducted two clinical interviews totaling approximately 165 minutes on March 24 and April 4, 2026. I administered the Montreal Cognitive Assessment (MoCA) Version 8.2 and a structured competency-focused interview. Collateral contact with Mr. Martensen's mother, Marlena Martensen, was completed by telephone on April 1, 2026.

NOTIFICATION OF NON-CONFIDENTIALITY

At each interview Mr. Martensen was informed of the purpose of the evaluation, the limits of confidentiality, and the intended recipients of the report. He acknowledged understanding in his own words and agreed to proceed.

RELEVANT BACKGROUND

Mr. Martensen is a 34-year-old man raised in Parker, Colorado by his mother Marlena Martensen. He completed high school and a two-year apprenticeship in electrical work. He worked as a journeyman electrician for approximately six years before a motorcycle collision in August 2017 resulted in a moderate traumatic brain injury documented at Craig Hospital. Imaging at that time revealed bilateral contusions and a right temporal skull fracture. He completed an inpatient rehabilitation stay of approximately three weeks.

Since 2017 Mr. Martensen has lived intermittently with his mother. He has attempted to return to electrical work on three occasions and has been unable to sustain employment beyond four months due to cognitive demands of the job and difficulty tracking schedules. He receives Social Security Disability Insurance based on the TBI. He has no prior criminal history.

Mr. Martensen acknowledges social drinking but denies a history of substance use disorder. He has not been psychiatrically hospitalized. A prior course of cognitive rehabilitation ended in 2019.

MENTAL STATUS ACROSS TWO SESSIONS

At the first session Mr. Martensen was appropriately groomed, cooperative, and oriented to person and place with uncertainty about the date. His speech was fluent with mild word-finding pauses. His mood was neutral; his affect was restricted. He denied hallucinations and paranoid ideation. Intermediate memory for the interview itself was impaired: he asked twice to be reminded of my name and once the purpose of the meeting.

At the second session, two weeks later, Mr. Martensen was notably clearer. He initiated the conversation by correctly identifying me, stating the purpose of the meeting, and asking an appropriate procedural question about the next step. Correctional staff reported improved sleep over the prior week.

FUNCTIONAL ABILITIES

Factual understanding of the proceedings. At the second session Mr. Martensen correctly identified his charge, the roles of courtroom personnel, and the major plea options (guilty, not guilty, no contest, plea bargain). He could explain in his own words the difference between a trial and a plea.

Rational understanding. Mr. Martensen articulated an appropriate understanding of his attorney's recommendation regarding a plea offer and a rational consideration of the trial risks (jury perception, evidentiary issues). He does not hold delusional or distorted beliefs about the proceedings.

Capacity to consult with counsel. Mr. Martensen reported two recent meetings with Mr. Fuentes and could paraphrase both meetings' substance. He indicated trust in his attorney and identified specific accommodations (slower pace, written summaries) that helped him engage effectively. In the interview he was capable of sustained, meaningful exchange with these accommodations.

CLINICAL FORMULATION

Mr. Martensen meets criteria for Major Neurocognitive Disorder Due to Traumatic Brain Injury, mild severity (F02.80). His presentation is consistent with the documented 2017 injury. He also shows contextual adjustment features related to the current legal situation and loss of stable housing in the months preceding the arrest. He does not meet criteria for a psychotic disorder or a primary mood disorder.

The cognitive impairment is real, functionally relevant, and measurable. It does not rise to a level that prevents competent participation in the proceedings, provided his pace and memory limitations are accommodated by counsel and the Court.

OPINION

To a reasonable degree of psychological certainty, it is my opinion that Mr. Martensen presently has a rational and factual understanding of the proceedings against him and has sufficient present ability to consult with counsel with a reasonable degree of rational understanding. He is competent to stand trial under Dusky v. United States and C.R.S. 16-8.5.

RECOMMENDATIONS

1. Counsel should use shorter meetings (30 to 45 minutes) rather than a single long meeting, and should provide written summaries of decisions made and next steps.
2. The Court should allow the defendant occasional short breaks during extended proceedings.
3. Continued cognitive rehabilitation and case management support are warranted and should be coordinated by jail mental health while Mr. Martensen is in custody.
4. If the case proceeds to trial, counsel should consider whether expert testimony regarding the defendant's cognitive limitations would be relevant to jury understanding of his memory gaps.
${clinicianSignature()}`

// ---------------------------------------------------------------------------
// CaseRecord
// ---------------------------------------------------------------------------

export const CASE_01_MARTENSEN: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-03-03',
  lastModified: '2026-04-08',
  firstName: 'Elijah',
  lastName: 'Martensen',
  dob: DOB,
  gender: 'M',
  evaluationType: 'CST',
  referralSource: 'Arapahoe County Public Defender',
  evaluationQuestions:
    'Factual and rational understanding of proceedings; capacity to consult with counsel given documented TBI history.',
  stage: 'review',
  caseStatus: 'in_progress',
  notes:
    'Draft report completed; attestation pending. Two-session evaluation showed competence with accommodations.',
  complexity: 'moderate',
  summary:
    '34yo man, moderate TBI (2017), charged with second degree assault. Two sessions show competent with memory accommodations.',
  diagnoses: [
    'F02.80 Major Neurocognitive Disorder Due to TBI, mild',
    'F43.21 Adjustment Disorder with Depressed Mood',
  ],
  intake: {
    referral_type: 'attorney',
    referral_source: 'Hector Fuentes, Arapahoe County PD',
    eval_type: 'CST',
    presenting_complaint:
      'Competency concerns secondary to documented TBI; counsel reports loss of conversational thread.',
    jurisdiction: '18th Judicial District, Arapahoe County',
    charges: 'Second Degree Assault (C.R.S. 18-3-203)',
    attorney_name: 'Hector Fuentes (Reg. 38221)',
    report_deadline: '2026-04-15',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Held at Arapahoe County Detention Facility since February 11, 2026. Contact via defense counsel Hector Fuentes at (303) 555-0184. Mother Marlena Martensen is primary collateral.',
      status: 'complete',
    },
    {
      section: 'complaints',
      content:
        'Memory lapses, word-finding difficulty, loss of conversational thread after several minutes, increasing disorganization in months preceding arrest.',
      status: 'complete',
    },
    {
      section: 'health',
      content:
        'Moderate TBI from 2017 motorcycle collision (GCS 7 at scene, bilateral contusions, right temporal fracture). Three-week Craig Hospital stay. Post-concussive syndrome documented. No current medications; prior brief course of cognitive rehabilitation.',
      clinician_notes:
        'Craig Hospital discharge summary obtained via release. Imaging confirms bilateral contusions.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'No psychiatric hospitalizations. No prior psychotic symptoms. No current suicidal or homicidal ideation. Mild depressive features tied to current legal situation and housing instability.',
      status: 'complete',
    },
    {
      section: 'substance',
      content:
        'Social alcohol use, no current substance use disorder per self report and jail medical screen.',
      status: 'complete',
    },
    {
      section: 'legal',
      content:
        'No prior criminal history. First-time felony charge.',
      status: 'complete',
    },
    {
      section: 'family',
      content:
        'Lives intermittently with mother Marlena Martensen in Parker, Colorado. Father deceased 2012. No siblings. Never married, no children.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'High school diploma, two-year electrical apprenticeship. Worked as journeyman electrician 2011 to 2017. Unable to sustain employment beyond four months since TBI.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Referral_Letter_Fuentes.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Referral letter from defense counsel',
    },
    {
      subfolder: 'Collateral',
      filename: 'Court_Order_Competency_Eval.txt',
      documentType: 'other',
      content: COURT_ORDER,
      description: 'Court order appointing examiner under C.R.S. 16-8.5',
    },
    {
      subfolder: 'Collateral',
      filename: 'Arrest_Report_Centennial_PD.txt',
      documentType: 'other',
      content: ARREST_REPORT,
      description: 'Centennial PD arrest report',
    },
    {
      subfolder: 'Collateral',
      filename: 'Craig_Hospital_Discharge_2017.txt',
      documentType: 'other',
      content: MEDICAL_RECORDS,
      description: '2017 TBI discharge summary from Craig Hospital',
    },
    {
      subfolder: 'Testing',
      filename: 'MoCA_Screening_Summary.txt',
      documentType: 'other',
      content: MOCA_SCREEN,
      description: 'MoCA cognitive screening, score 22/30',
    },
    {
      subfolder: 'Interviews',
      filename: 'Interview_Session_1.txt',
      documentType: 'other',
      content: INTERVIEW_ONE,
      description: 'First competency interview, March 24',
    },
    {
      subfolder: 'Interviews',
      filename: 'Interview_Session_2.txt',
      documentType: 'other',
      content: INTERVIEW_TWO,
      description: 'Second competency interview, April 4',
    },
    {
      subfolder: 'Diagnostics',
      filename: 'Diagnostic_Formulation.txt',
      documentType: 'other',
      content: FORMULATION,
      description: 'Diagnostic formulation and criterion analysis',
    },
    {
      subfolder: 'Reports',
      filename: 'DRAFT_CST_Evaluation_Report.txt',
      documentType: 'other',
      content: DRAFT_REPORT,
      description: 'Draft competency evaluation report, pending attestation',
    },
  ],
}
