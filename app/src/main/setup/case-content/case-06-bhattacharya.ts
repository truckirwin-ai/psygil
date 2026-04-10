// =============================================================================
// Case 6: Bhattacharya, Harshit, ADHD Dx, ONBOARDING stage, simple
// Private pay, grad student requesting bar exam accommodations
// =============================================================================

import type { CaseRecord } from './shared'
import { SYNTHETIC_BANNER } from './shared'

const CASE_NUMBER = '2026-0445'
const EXAMINEE = 'Bhattacharya, Harshit'
const DOB = '1996-07-30'

const REFERRAL = `${SYNTHETIC_BANNER}

Harshit Bhattacharya
847 Spruce Street, Apt 4B
Boulder, CO 80302
harshit.bh.grad@colorado.example

April 2, 2026

Pike Forensics
Attn: Jordan Whitfield, Psy.D., ABPP

Dear Dr. Whitfield,

My name is Harshit Bhattacharya. I am a third-year law student at the University of Colorado Boulder and I will be sitting for the Colorado Bar Examination in July 2026. I am writing to request a psychological evaluation to document ADHD and to support a request for testing accommodations.

I was diagnosed with ADHD by my pediatrician when I was 8 years old and took methylphenidate through middle school. I stopped taking medication in high school because I felt I could manage without it. I have struggled with sustained attention throughout college and law school. I received extended time on my LSAT based on my childhood diagnosis, but the documentation from that accommodation is more than five years old and NCBE requires current documentation.

My law school has confirmed I will be eligible for accommodations if I can provide a current comprehensive evaluation. I am able to pay privately for the evaluation. I have no court involvement and this is not a disability or insurance claim.

Thank you for considering my request. I am available weekday afternoons and evenings.

Sincerely,
Harshit Bhattacharya
`

const INTAKE_FORM = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Intake Form Summary

Completed: April 5, 2026 (self-completed electronically)

IDENTIFYING INFORMATION

Name: Harshit Bhattacharya
Date of Birth: July 30, 1996
Address: 847 Spruce Street, Apt 4B, Boulder, CO 80302
Email: harshit.bh.grad@colorado.example
Phone: (720) 555-0180
Emergency contact: Priya Bhattacharya (mother), (510) 555-0143

CURRENT STATUS

Occupation: Full-time law student, third year, University of Colorado Law School
Insurance: Self-pay (declines to submit to insurance to avoid claims history)
Primary care physician: Dr. Ann-Mette Halversen, CU Wardenburg Health
Current medications: None

REASON FOR EVALUATION

Documentation of ADHD for Colorado Bar Examination accommodations (extended time). Law school has approved accommodations contingent on current evaluation.

PRIOR DIAGNOSIS

First diagnosed with ADHD by pediatrician in second grade (1996 timeframe). Treated with methylphenidate 10 mg TID from 2004 to approximately 2011. Discontinued voluntarily during high school. Received extended time on LSAT in 2019 based on original diagnosis documentation.

CURRENT CONCERNS

Sustained attention during reading long passages. Difficulty completing timed outlines. Task initiation on non-urgent work. Organization of study materials. Symptoms have been relatively stable since undergraduate.

CONSENT

Standard release signed electronically. Understands the evaluation is private-pay, is not part of any legal proceeding, and will be shared with his law school dean of students and the NCBE only with his written authorization.
`

const PLANNING_NOTE = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Case Planning Note, Onboarding

Case: ${EXAMINEE}
Case Number: ${CASE_NUMBER}
Date: April 6, 2026

PROTOCOL FOR THIS EVALUATION

This is a straightforward adult ADHD evaluation for accommodations. NCBE documentation standards require:
1. Evidence of symptoms that began in childhood (DSM-5-TR Criterion B)
2. Current symptoms meeting criteria in at least two settings
3. Functional impairment
4. Rule-out of other disorders that could account for the presentation
5. Standardized testing of attention and executive function

PLANNED MEASURES

1. Clinical interview (2 hours, scheduled April 14)
2. Collateral form completed by mother Priya Bhattacharya (mailed April 6)
3. Collateral form completed by current classmate or study group partner (to be identified)
4. CAARS (Conners Adult ADHD Rating Scales) self and observer forms
5. WAIS-V (full battery), baseline cognitive functioning
6. Conners CPT-3, objective attention measure
7. WIAT-4 selected subtests (reading comprehension, written expression, math problem solving) for baseline academic achievement

RECORDS TO REQUEST

1. Original childhood evaluation documentation (mother is locating)
2. LSAT accommodation documentation (2019)
3. Current law school transcript
4. Undergraduate transcript
5. Letter from current law school dean of students confirming accommodation eligibility

NO CURRENT CONCERNS

Mr. Bhattacharya is private-pay, not in legal or disability proceedings, has documented childhood history, and has insight into his symptoms. This evaluation is expected to be straightforward and to conclude with either (a) a current diagnosis and accommodation recommendations or (b) insufficient evidence for a current diagnosis with notes on alternate explanations.

Expected duration: 4 weeks from intake to final report.

Jordan Whitfield, Psy.D., ABPP
`

const RELEASE_FORM = `${SYNTHETIC_BANNER}

PIKE FORENSICS
Authorization for Release of Information

Executed: April 5, 2026

I, Harshit Bhattacharya, authorize:

Priya Bhattacharya (mother)
Address: 2245 Avalon Way, Fremont, CA 94539

to release to Jordan Whitfield, Psy.D., ABPP of Pike Forensics:

[X] Any childhood medical or psychological records in her possession
[X] A completed Collateral History Form
[ ] Other

I also authorize the University of Colorado Law School, Office of Student Services, to release:

[X] Accommodation eligibility letter
[X] Current academic transcript

AND the Colorado Bar Exam NCBE Testing Accommodations Office to RECEIVE the final evaluation report from Pike Forensics upon my subsequent written release (which will be executed after I review the final report).

This authorization expires 12 months from the date of execution unless revoked earlier in writing.

Signed:
Harshit Bhattacharya
Date: April 5, 2026

Witness:
Jordan Whitfield, Psy.D., ABPP
`

export const CASE_06_BHATTACHARYA: CaseRecord = {
  caseNumber: CASE_NUMBER,
  createdAt: '2026-04-02',
  lastModified: '2026-04-06',
  firstName: 'Harshit',
  lastName: 'Bhattacharya',
  dob: DOB,
  gender: 'M',
  evaluationType: 'ADHD Dx',
  referralSource: 'Self-referral, private pay',
  evaluationQuestions:
    'Current ADHD diagnosis and functional impairment to support Colorado Bar Exam accommodation request.',
  stage: 'onboarding',
  caseStatus: 'intake',
  notes:
    'Simple private-pay ADHD eval. Intake complete, testing scheduled, records requested.',
  complexity: 'simple',
  summary:
    '29yo law student, childhood ADHD with prior treatment, seeking current diagnosis for bar exam accommodations.',
  diagnoses: [],
  intake: {
    referral_type: 'self',
    referral_source: 'Self-referral',
    eval_type: 'ADHD Dx',
    presenting_complaint:
      'Documentation of ADHD for Colorado Bar Exam accommodations; childhood diagnosis with outdated paperwork.',
    jurisdiction: null,
    charges: null,
    attorney_name: null,
    report_deadline: '2026-05-30',
    status: 'complete',
  },
  onboarding: [
    {
      section: 'contact',
      content:
        'Boulder, CO resident. Third-year law student at CU Law. Cell (720) 555-0180. Mother in Fremont, CA is primary childhood history source.',
      status: 'complete',
    },
    {
      section: 'complaints',
      content:
        'Sustained attention on long reading, timed task completion, task initiation, organization. Symptoms stable since undergraduate.',
      status: 'complete',
    },
    {
      section: 'mental',
      content:
        'Childhood ADHD diagnosis (age 8). Methylphenidate 2004 to 2011. No other psychiatric history. No current medications. No suicidal ideation.',
      status: 'complete',
    },
    {
      section: 'education',
      content:
        'Bachelor\'s in political science, University of California Irvine. Currently J.D. program at CU Law, expected graduation May 2026. GPA 3.4.',
      status: 'complete',
    },
  ],
  documents: [
    {
      subfolder: '_Inbox',
      filename: 'Self_Referral_Letter.txt',
      documentType: 'other',
      content: REFERRAL,
      description: 'Self-referral email from examinee',
    },
    {
      subfolder: '_Inbox',
      filename: 'Intake_Form_Summary.txt',
      documentType: 'other',
      content: INTAKE_FORM,
      description: 'Intake form summary',
    },
    {
      subfolder: '_Inbox',
      filename: 'Release_of_Information_Forms.txt',
      documentType: 'other',
      content: RELEASE_FORM,
      description: 'Signed releases for mother, law school, and NCBE',
    },
    {
      subfolder: 'Collateral',
      filename: 'Case_Planning_Note.txt',
      documentType: 'other',
      content: PLANNING_NOTE,
      description: 'Planning note with protocol and records list',
    },
  ],
}
