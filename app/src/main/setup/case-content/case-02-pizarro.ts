// =============================================================================
// Case 2: Pizarro Echeverría, Raúl, CST, Diagnostics stage, complex
// Chronic schizophrenia, medication non-adherence, first felony
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER, clinicianSignature } from './shared'

const CASE_NUMBER = '2026-0347'
const EXAMINEE = 'Pizarro Echeverría, Raúl A.'
const DOB = '1997-11-08'

const COURT_ORDER = `${SYNTHETIC_BANNER}

DENVER DISTRICT COURT
Court Address: 1437 Bannock Street, Denver, CO 80202

Case Number: ${CASE_NUMBER}-CR
Division: Criminal
Judge: Hon. Isadora Qurban

THE PEOPLE OF THE STATE OF COLORADO v. RAÚL A. PIZARRO ECHEVERRÍA

ORDER FOR COMPETENCY EVALUATION

Defendant is charged with Second Degree Burglary (C.R.S. 18-4-203) and Criminal Mischief (C.R.S. 18-4-501). Defense counsel has raised good faith doubt as to the defendant's competence pursuant to C.R.S. 16-8.5-102.

IT IS HEREBY ORDERED that Jordan Whitfield, Psy.D., ABPP of Pike Forensics is appointed to conduct a competency evaluation and file a written report no later than April 28, 2026. All proceedings are stayed pending the report.

BY THE COURT:

Isadora Qurban
District Court Judge
Dated: March 12, 2026
`

const JAIL_RECORDS = `${SYNTHETIC_BANNER}

DENVER COUNTY JAIL
Mental Health Progress Notes (Excerpt)

Inmate: Pizarro Echeverría, Raúl (DOB 11/08/1997)
Book-in: March 5, 2026

3/5/2026 (intake RN): Inmate disheveled, agitated, speaking rapidly in a mixture of English and Spanish. Reports "the network" is watching him through the ceiling vents. Refusing food. Medical alert: prior psychiatric history per family notification.

3/6/2026 (psychiatric NP Bhavna Roychoudhury, PMHNP): Chart reviewed. Prior records from Denver Health Psychiatric 2021 and 2023 confirm Schizophrenia diagnosis. Last documented antipsychotic was olanzapine 20 mg QHS; inmate reports he stopped taking it "several weeks" before arrest because "it was part of the experiment." Mental status: paranoid delusions with persecutory and referential features, auditory hallucinations (hears "the announcers"), disorganized speech. Initiated olanzapine 10 mg QHS, increase over 5 days if tolerated.

3/12/2026: Dose increased to 15 mg QHS. Inmate sleeping better. Still paranoid but less agitated. Continues to decline food from staff ("they put it in the food"); will accept sealed commissary items.

3/20/2026: Dose increased to 20 mg QHS. Eating from staff trays approximately 50% of the time. Paranoid content reduced in intensity but not resolved. Able to track conversation for 5 to 10 minutes before drifting.

3/27/2026: Compliant with medication. Attorney visit today reported as "better than last time." Still believes the original charge is "tied to the experiment" but can entertain alternative explanations when prompted.
`

const PRIOR_EVAL = `${SYNTHETIC_BANNER}

DENVER HEALTH PSYCHIATRIC EMERGENCY SERVICES
Discharge Summary (Excerpt for Forensic Review)

Patient: Pizarro Echeverría, Raúl A.
Admission: February 14, 2023
Discharge: February 28, 2023
Attending: Reginald Oyeyemi, MD

HISTORY

Mr. Pizarro Echeverría presented to DHPES via police transport following a welfare check at his employer's request. Coworkers reported he had stopped coming to work three weeks prior and had been calling the office stating that "the shift manager was poisoning the water cooler." On arrival he was paranoid, disorganized, and unable to provide a coherent history.

This was his third psychiatric hospitalization. Prior admissions were in 2020 (first psychotic break, age 22) and 2021 (relapse after medication non-adherence). Diagnosis of Schizophrenia was established in 2021 after a three-month prospective course.

HOSPITAL COURSE

Olanzapine titrated to 20 mg QHS with gradual improvement in positive symptoms. By hospital day 10 the patient was able to engage in group and individual therapy and acknowledged that his persecutory beliefs had been symptoms of his illness returning. Discharged to outpatient care at Colorado Coalition for the Homeless Behavioral Health with housing referral.

DISCHARGE DIAGNOSES

1. Schizophrenia, continuous course (F20.9)
2. Cannabis Use Disorder, in sustained remission (F12.21)

DISCHARGE MEDICATIONS

Olanzapine 20 mg PO QHS
`

const MMPI_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Testing Note, MMPI-3 Administration (INVALID)

Examinee: ${EXAMINEE}
Date of Administration: March 31, 2026
Examiner: Jordan Whitfield, Psy.D., ABPP

NOTES

Administration was attempted at Denver County Jail. Mr. Pizarro Echeverría was offered the Spanish-language MMPI-3 after determining his preferred language with him. He completed approximately 180 of 335 items before asking to stop, stating "these questions are the experiment, you're recording my answers into the network."

VALIDITY

With only 180 items completed, the standard scoring rules cannot produce interpretable substantive scores. The CNS (Cannot Say) count would be over 15, and the VRIN-r and TRIN-r patterns on the items completed suggest inconsistent responding driven by the examinee's paranoid state rather than by random answering.

CLINICAL INTERPRETATION

The MMPI-3 cannot be scored or interpreted in this administration. The reason is directly observable: active positive symptoms of psychosis interfered with the examinee's ability to engage with the test instructions. This finding is itself informative for the competency question.

A repeat administration should be attempted only if symptoms substantially remit.

Jordan Whitfield, Psy.D., ABPP
`

const INTERVIEW = `${SYNTHETIC_BANNER}

COMPETENCY INTERVIEW NOTES
Examinee: ${EXAMINEE}
Date: March 31, 2026 (session 1) and April 14, 2026 (session 2)
Location: Denver County Jail
Examiner: Jordan Whitfield, Psy.D., ABPP

SESSION 1 (March 31)

Notification of non-confidentiality was provided in English and Spanish. Mr. Pizarro Echeverría acknowledged understanding with a simple nod and the phrase "OK, for the judge."

Mental status: disheveled in jail attire; restless; speech mildly pressured with loose associations. Oriented to person, uncertain of date. Endorsed auditory hallucinations ("announcers who say what I'm doing") and a persecutory delusional system involving "the network" that he believes includes jail staff, "maybe" his attorney, and the District Attorney's office. Affect suspicious with moments of appropriate humor.

Factual understanding: named the charge as "something about burglary." Could not explain what a plea bargain was, asked "what's a bargain?" Identified his attorney as "the lawyer they sent," the judge as "a judge," and stated a jury is "I don't know."

Rational understanding: believes his charge is "a cover story" for the surveillance operation. When asked whether his attorney might be working with the prosecution, replied "maybe, I can't tell yet."

Capacity to consult with counsel: refused to discuss the charge substantively. Said "I don't know what I can say here because of the microphones."

SESSION 2 (April 14)

Mr. Pizarro Echeverría had been on olanzapine 20 mg QHS for approximately six weeks. He recognized me, stated the purpose of the meeting, and apologized for the first session ("I wasn't myself").

Mental status: better groomed. Speech organized. Still mildly paranoid regarding "the network" but could entertain that these thoughts may be part of his illness. Affect less guarded.

Factual understanding improved: named both charges correctly, described trial and plea as two distinct paths, identified roles of judge, prosecution, defense, and jury. Able to explain plea bargain in his own words.

Rational understanding: still holds some persecutory content about "the DA" but acknowledges "my doctor said these thoughts come back when I stop my meds." Able to consider alternative explanations for his current situation without abandoning them entirely.

Capacity to consult with counsel: reports meeting with his attorney Federico Lopresti twice in the prior week. Can paraphrase those meetings. Acknowledges he has had trouble trusting Mr. Lopresti but is "trying."

The improvement between sessions is clinically meaningful but incomplete. The examinee remains symptomatic. Whether the remaining symptoms prevent rational engagement is the central question for the formulation.

Jordan Whitfield, Psy.D., ABPP
`

const FORMULATION = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Preliminary Diagnostic Formulation (DRAFT)

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}

DIAGNOSIS

Schizophrenia, continuous course (F20.9)

The diagnosis is supported by documentation of three prior psychotic episodes (2020, 2021, 2023), sustained positive symptoms across episodes (paranoid delusions, auditory hallucinations, disorganized speech), duration greater than six months, and functional decline. Each episode has been temporally associated with antipsychotic medication non-adherence and each has responded to reintroduced olanzapine. The current episode follows the same pattern.

COMPETENCY CONSIDERATIONS (PRELIMINARY, PENDING FINAL SESSION)

Session 1 findings clearly supported incompetence: the examinee held fixed persecutory beliefs about his attorney and the DA's office, could not name or explain his charges, and refused to discuss his case on the basis of delusional content.

Session 2 findings show clinically meaningful improvement with 6 weeks of adherent antipsychotic treatment, but the picture is not yet clear. The examinee has acquired factual understanding he previously lacked. He is capable of limited, tentative engagement with his attorney. Persecutory content about the DA persists in a softer form.

The key question is whether the examinee's rational understanding is currently sufficient. The answer depends on whether his residual symptoms meaningfully prevent him from collaborating on strategy and testimony. A third session is indicated before finalizing the opinion.

NEXT STEPS

1. Schedule third interview for approximately April 28, consistent with the reporting deadline.
2. Collateral contact with Federico Lopresti (defense counsel) to assess quality of attorney-client consultation from the attorney's perspective.
3. Review Denver County Jail mental health progress notes through the date of the third interview.
4. Consider whether an opinion of "currently incompetent but likely restorable" is the most accurate and useful framing for this case.
${clinicianSignature()}`

export const CASE_02_PIZARRO: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-03-12',
  lastModified: '2026-04-07',
  firstName: 'Raúl',
  lastName: 'Pizarro Echeverría',
  dob: DOB,
  gender: 'M',
  evaluationType: 'CST',
  referralSource: 'Denver District Court, Division Criminal',
  evaluationQuestions:
    'Competency in context of active psychotic symptoms and ongoing medication response.',
  stage: 'diagnostics',
  caseStatus: 'in_progress',
  notes:
    'Two sessions complete, clinically meaningful improvement on olanzapine. Third session and collateral pending.',
  complexity: 'complex',
  summary:
    '28yo man, chronic schizophrenia with documented med non-adherence, charged with burglary. Partial improvement over two sessions.',
  diagnoses: ['F20.9 Schizophrenia, continuous'],
  intake: {
    referral_type: 'court',
    referral_source: 'Hon. Isadora Qurban, Denver District Court',
    eval_type: 'CST',
    presenting_complaint:
      'Active psychosis, paranoid delusions involving the proceedings, medication non-adherence prior to arrest.',
    jurisdiction: 'Denver County',
    charges: 'Second Degree Burglary (C.R.S. 18-4-203), Criminal Mischief (C.R.S. 18-4-501)',
    attorney_name: 'Federico Lopresti, Denver Public Defender',
    report_deadline: '2026-04-28',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Custody at Denver County Jail since March 5, 2026. Family contact through sister Ximena Pizarro at (303) 555-0199 with signed release.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'Schizophrenia, continuous course. Prior hospitalizations in 2020, 2021, 2023, each following medication non-adherence. Current episode began approximately 6 weeks before arrest after stopping olanzapine. Jail psychiatry restarted olanzapine March 6, titrated to 20 mg QHS by March 20.',
      clinician_notes: 'Dose response trajectory is typical for this examinee per prior records.',
      status: 'complete',
    },
    {
      section: 'substance',
      content:
        'Cannabis Use Disorder in sustained remission since 2023 per DHPES records. Denies current use.',
      status: 'complete',
    },
    {
      section: 'legal',
      content: 'First felony charge. No prior criminal history.',
      status: 'complete',
    },
    {
      section: 'family',
      content:
        'Oldest of three. Parents in Mexico City. Lived with sister Ximena in Denver since 2019. Sister is primary support and medication monitor when stable.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'Completed high school in Mexico City. Attended two semesters of community college in Denver. Employed intermittently as prep cook.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: 'Collateral',
      filename: 'Court_Order_Competency_Eval.txt',
      documentType: 'other',
      content: COURT_ORDER,
      description: 'Denver District Court CST order',
    },
    {
      subfolder: 'Collateral',
      filename: 'Jail_Mental_Health_Progress_Notes.txt',
      documentType: 'other',
      content: JAIL_RECORDS,
      description: 'Denver County Jail psychiatric progress notes',
    },
    {
      subfolder: 'Collateral',
      filename: 'DHPES_2023_Discharge_Summary.txt',
      documentType: 'other',
      content: PRIOR_EVAL,
      description: '2023 Denver Health Psychiatric discharge',
    },
    {
      subfolder: 'Testing',
      filename: 'MMPI-3_Invalid_Administration.txt',
      documentType: 'other',
      content: MMPI_NOTE,
      description: 'MMPI-3 invalid administration note',
    },
    {
      subfolder: 'Interviews',
      filename: 'Two_Session_Interview_Notes.txt',
      documentType: 'other',
      content: INTERVIEW,
      description: 'Two session CST interview notes, March 31 and April 14',
    },
    {
      subfolder: 'Diagnostics',
      filename: 'Preliminary_Formulation.txt',
      documentType: 'other',
      content: FORMULATION,
      description: 'Preliminary formulation pending third session',
    },
  ],
}
