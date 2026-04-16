/**
 * Test Case: DeShawn Riggins
 * Type: Competency to Stand Trial (CST)
 * Complexity: High
 * Target: Full pipeline run (onboarding -> complete)
 *
 * Scenario: 28-year-old male charged with Robbery 1st (F3) and Assault 2nd (F4)
 * in Denver District Court. Defense counsel reports defendant cannot meaningfully
 * participate in case preparation, appears confused about charges, and has a
 * documented history of schizoaffective disorder with multiple psychiatric
 * hospitalizations. Court-ordered CST evaluation per C.R.S. 16-8.5-101.
 *
 * This is the most complex test case: every pipeline stage exercised,
 * multiple instruments, collateral contacts, agent results, diagnostic
 * decisions, clinical formulation, and full report generation.
 */

import type { TestCaseManifest } from '../manifest'

// ---------------------------------------------------------------------------
// Document content generators
// ---------------------------------------------------------------------------

const COURT_ORDER = `DISTRICT COURT, CITY AND COUNTY OF DENVER, COLORADO
Case No. 2026CR1847

THE PEOPLE OF THE STATE OF COLORADO
v.
DESHAWN MARQUIS RIGGINS

ORDER FOR COMPETENCY EVALUATION

The Court, having reviewed the Motion filed by defense counsel Whitney Polk,
Assistant Public Defender, and having found reasonable cause to believe the
defendant may be incompetent to proceed pursuant to C.R.S. 16-8.5-101, hereby
ORDERS as follows:

1. The defendant shall submit to a competency evaluation to be conducted by a
   qualified forensic psychologist.

2. The evaluation shall address the following:
   a. Whether the defendant has sufficient present ability to consult with his
      attorney with a reasonable degree of rational understanding;
   b. Whether the defendant has a rational as well as factual understanding of
      the proceedings against him;
   c. Whether any mental disease or defect renders the defendant incompetent to
      proceed, and if so, whether restoration to competency is likely with
      appropriate treatment.

3. The evaluating psychologist shall submit a written report to the Court within
   thirty (30) days of this Order.

4. The defendant is charged with Robbery in the First Degree, C.R.S. 18-4-302
   (Class 3 Felony) and Assault in the Second Degree, C.R.S. 18-3-203 (Class 4
   Felony). Maximum combined penalty: 24 years DOC.

5. Defense counsel reports the defendant is unable to meaningfully participate in
   case preparation, appears confused about the nature of the charges, and has
   exhibited disorganized behavior during attorney-client meetings.

DATED this 15th day of March, 2026.

BY THE COURT:

_______________________________
The Honorable Frank W. Medina
Denver District Court, Division 5
`

const POLICE_REPORT = `DENVER POLICE DEPARTMENT
INCIDENT REPORT

Case No: 2026-0038741
Date of Incident: 2026-02-08
Time: 2237 hours
Location: 1400 block of Champa Street, Denver, CO 80202
Reporting Officer: Det. Brian Kowalski, Badge #4187

NARRATIVE:

On 02/08/2026 at approximately 2237 hours, officers responded to a robbery in
progress at the Quick Mart convenience store, 1423 Champa Street. Upon arrival,
officers found the victim, store clerk Rajesh Bhattacharya (DOB 04/12/1985),
with a laceration to the left forearm consistent with a bladed weapon.

Mr. Bhattacharya stated that a Black male, approximately 6 feet tall, entered
the store at approximately 2230 hours and demanded money from the register while
holding a box cutter. The suspect appeared agitated and was talking to himself.
When the clerk attempted to comply, the suspect became confused, dropped the box
cutter, picked it up, and inadvertently cut the clerk during a struggle. The
suspect fled on foot with approximately $147 in cash.

Surveillance footage (preserved, Exhibit A) shows the suspect entering the store,
appearing to respond to stimuli not present in the environment (looking at the
ceiling, mouthing words, appearing startled). The robbery attempt was disorganized;
the suspect took nearly 4 minutes to communicate his demand and at one point
appeared to forget why he was in the store.

The suspect was identified as DeShawn Marquis Riggins (DOB 07/23/1997) via
fingerprint evidence recovered from the box cutter (abandoned at scene) and
confirmed through surveillance footage comparison with prior booking photographs.

Mr. Riggins was located on 02/10/2026 at the Denver Rescue Mission, 1130
Park Avenue West. At the time of arrest, he was found in a disoriented state,
wearing the same clothing depicted in the surveillance footage. He had $23 in
cash on his person. Mr. Riggins did not resist arrest but appeared unable to
understand the Miranda advisement. He repeatedly asked officers "Is the ceiling
still there?" and stated "They keep moving the floor."

CHARGES FILED:
- Robbery in the First Degree, C.R.S. 18-4-302 (F3)
- Assault in the Second Degree, C.R.S. 18-3-203 (F4)

EVIDENCE LOGGED:
- Box cutter (Exhibit A)
- Surveillance footage, 4 camera angles (Exhibit B)
- Cash recovered ($23, Exhibit C)
- Booking photograph (Exhibit D)
- Victim medical records (Exhibit E)

Det. Brian Kowalski #4187
Denver Police Department, District 6
`

const JAIL_MEDICAL = `DENVER COUNTY JAIL - MEDICAL/MENTAL HEALTH SCREENING
CONFIDENTIAL HEALTH INFORMATION

Inmate: RIGGINS, DESHAWN MARQUIS
Booking #: 2026-J-018934
DOB: 07/23/1997   Age: 28   Sex: M   Race: Black
Booking Date: 02/10/2026   Time: 1415

INITIAL MEDICAL SCREENING (performed by RN C. Delgado):

Vitals: BP 142/88, HR 96, Temp 98.4, O2 Sat 97%
Weight: 178 lbs, Height: 6'0"
BMI: 24.1

Current Medications (per inmate report, unverified):
- Risperidone 4mg BID (reports noncompliance x 3 months)
- Trazodone 100mg QHS
- Benztropine 1mg BID

Allergies: Haloperidol (dystonic reaction, 2021)

Medical History:
- Schizoaffective disorder, bipolar type (first dx age 19, per inmate)
- 4 prior psychiatric hospitalizations (Colorado Mental Health Institute at
  Pueblo, 2016, 2018, 2020; Denver Health, 2023)
- History of medication noncompliance
- Appendectomy (2014)
- No seizure history
- No head injury (per inmate report)

Current Mental Status (screening level):
- Oriented to person only; confused about date and location
- Affect: flat, intermittent inappropriate laughter
- Speech: low volume, occasionally tangential
- Endorsed auditory hallucinations ("voices that argue with each other")
- Denied current SI/HI
- Poor hygiene, mild malnutrition

Substance Use:
- Denies current alcohol use
- Reports intermittent marijuana use (last use "maybe a few weeks ago")
- Denies IV drug use, methamphetamine, cocaine, opioids

Jail Psychiatry Referral: URGENT
Placed on mental health observation (Q15 checks)
Risperidone restarted at 2mg BID with titration plan to 4mg over 1 week

Screening Nurse: C. Delgado, RN
Date: 02/10/2026
`

const PRIOR_PSYCH_RECORDS = `COLORADO MENTAL HEALTH INSTITUTE AT PUEBLO
DISCHARGE SUMMARY

Patient: Riggins, DeShawn M.
MRN: CMHIP-2020-04821
Admission Date: 09/14/2020
Discharge Date: 11/22/2020
Length of Stay: 69 days
Admitting Psychiatrist: Rajiv Patel, M.D.
Discharge Psychiatrist: Rajiv Patel, M.D.

DIAGNOSES AT DISCHARGE:
Axis I:
  1. Schizoaffective Disorder, Bipolar Type (F25.0) - Primary
  2. Cannabis Use Disorder, Moderate (F12.20)

REASON FOR ADMISSION:
Mr. Riggins was admitted following a court-ordered competency restoration
pursuant to C.R.S. 16-8.5-111. He had been found incompetent to stand trial
on charges of Criminal Mischief (F4) in Arapahoe County Case No. 2020CR2614.
At the time of admission, Mr. Riggins was experiencing active psychotic symptoms
including auditory hallucinations (command type), paranoid delusions regarding
government surveillance, and disorganized thought processes that precluded
meaningful attorney-client communication.

COURSE OF TREATMENT:
Mr. Riggins was stabilized on risperidone 4mg BID after trials of olanzapine
(excessive sedation, 20 lb weight gain in 3 weeks) and aripiprazole (inadequate
symptom control at 30mg). Competency restoration education was provided through
structured group and individual sessions focusing on courtroom procedures, roles
of legal personnel, charges and potential penalties, and the ability to assist
counsel.

MENTAL STATUS AT DISCHARGE:
Mr. Riggins was alert, oriented x4, with organized thought processes and no
active psychotic symptoms. He demonstrated adequate factual understanding of
the charges, the roles of the judge, prosecutor, and defense attorney, and the
potential consequences of conviction. He was able to articulate a rational
strategy for working with his attorney.

COMPETENCY STATUS AT DISCHARGE:
Restored to competency. Returned to court jurisdiction on 11/22/2020.

MEDICATION AT DISCHARGE:
- Risperidone 4mg BID
- Benztropine 1mg BID (for EPS prophylaxis)
- Trazodone 100mg QHS (sleep)

FOLLOW-UP:
Community mental health at Mental Health Center of Denver.
Outpatient psychiatry with Dr. Lisa Huang.

PROGNOSIS:
Guarded. Mr. Riggins has a pattern of medication noncompliance following
discharge, with 3 prior hospitalizations (2016, 2018, prior to this admission)
all precipitated by cessation of antipsychotic medication. Risk of
decompensation is HIGH if medication adherence is not maintained.

Rajiv Patel, M.D.
Board Certified Psychiatry
CMHIP
`

const DEFENSE_MOTION = `DISTRICT COURT, CITY AND COUNTY OF DENVER, COLORADO
Case No. 2026CR1847

THE PEOPLE OF THE STATE OF COLORADO
v.
DESHAWN MARQUIS RIGGINS

MOTION FOR DETERMINATION OF COMPETENCY TO PROCEED

Whitney Polk, Assistant Public Defender, on behalf of the defendant, DeShawn
Marquis Riggins, respectfully moves this Court for an order directing a
competency evaluation pursuant to C.R.S. 16-8.5-101, and in support thereof
states the following:

1. The defendant is charged with Robbery in the First Degree (F3) and Assault
   in the Second Degree (F4), with a combined maximum exposure of 24 years in
   the Department of Corrections.

2. Defense counsel has met with the defendant on four occasions since his
   arrest on February 10, 2026 (February 12, February 19, February 26, and
   March 3, 2026).

3. During each meeting, the defendant exhibited the following concerning
   behaviors:
   a. Inability to sustain attention for more than 2-3 minutes
   b. Responding to internal stimuli (turning head, whispering to unseen
      persons, covering ears)
   c. Inability to articulate the charges against him despite repeated
      explanation
   d. Expressed belief that his attorney is "working for the voices"
   e. On one occasion (March 3), refused to exit his cell, stating that "the
      courtroom has been poisoned"

4. The defendant has a documented history of Schizoaffective Disorder, Bipolar
   Type, with four prior psychiatric hospitalizations, the most recent being a
   69-day competency restoration admission at CMHIP in 2020.

5. According to jail medical records, the defendant had been noncompliant with
   his prescribed antipsychotic medication (risperidone 4mg BID) for
   approximately three months prior to the alleged offense.

6. Counsel is unable to discuss plea options, review discovery, or prepare any
   defense strategy due to the defendant's current mental state.

WHEREFORE, defense counsel respectfully requests that this Court order a
competency evaluation by a qualified forensic psychologist.

Respectfully submitted,

_______________________________
Whitney Polk, #42891
Assistant Public Defender
Office of the Colorado State Public Defender
1290 Broadway, Suite 900
Denver, CO 80203
`

const COLLATERAL_MOTHER = `COLLATERAL CONTACT NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Contact: Loretta Riggins (mother)
Date: 03/28/2026
Interviewer: Clinician
Duration: 47 minutes
Method: Telephone

Ms. Riggins (age 54) was contacted by telephone and provided verbal consent
for this collateral interview. She was cooperative and appeared genuinely
concerned about her son's welfare.

DEVELOPMENTAL HISTORY:
DeShawn was born full-term following an uncomplicated pregnancy. Ms. Riggins
denied any prenatal substance use. Developmental milestones were met within
normal limits. He attended Denver Public Schools through 11th grade, when he
dropped out following his first psychiatric hospitalization at age 19. He was
in special education from 7th grade for "emotional disturbance" (per IEP
records she recalls). He played football in 9th and 10th grade but quit after
a disciplinary suspension.

FAMILY PSYCHIATRIC HISTORY:
Ms. Riggins reported that DeShawn's biological father, Marcus Riggins Sr.
(deceased, 2019, cardiac arrest), had "episodes" that she believes were
psychotic, but he was never formally diagnosed or treated. DeShawn's paternal
uncle, Terrence Riggins, was diagnosed with schizophrenia and is currently
a resident at a group home in Aurora. A maternal cousin was treated for
bipolar disorder. Ms. Riggins herself takes sertraline for depression.

ONSET OF SYMPTOMS:
Ms. Riggins recalled that DeShawn first "started acting different" around age
17. He became increasingly isolated, stopped attending school regularly, and
began talking to himself. At 19, following an incident where he barricaded
himself in his room for 3 days believing the television was communicating
directly with him, he was hospitalized at CMHIP for the first time.

MEDICATION COMPLIANCE:
Ms. Riggins stated that DeShawn "does well when he takes his medicine, but he
always stops." She described a repeating cycle: hospitalization, stabilization,
discharge, 3-6 months of compliance, then gradual discontinuation followed by
decompensation. The most recent discontinuation began around November 2025
when DeShawn lost his Medicaid coverage during an address change and could not
afford the medication out of pocket.

CURRENT LIVING SITUATION:
Prior to arrest, DeShawn was living intermittently at the Denver Rescue Mission
and occasionally staying with Ms. Riggins at her apartment in Montbello. She
stated he had been "getting worse for about two months" before the arrest,
with increasing disorganization, poor self-care, and talking to voices "more
than I've ever seen."

FUNCTIONING WHEN STABLE:
When medicated and stable, Ms. Riggins described DeShawn as "sweet, funny, and
helpful." He held a part-time job at a warehouse (DHL) for 8 months in 2022
and volunteered at his church (New Hope Baptist) intermittently. He has never
been married and has no children.

Interviewer notes: Ms. Riggins's account is consistent with the documented
psychiatric history and supports a pattern of cyclic decompensation linked to
medication noncompliance. Her report of the timeline of recent deterioration
aligns with jail medical records showing 3 months of missed risperidone.
`

const INTERVIEW_NOTES_1 = `CLINICAL INTERVIEW NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Session: 1 of 2
Date: 03/29/2026
Duration: 52 minutes
Location: Interview Room B, Denver County Jail
Clinician: [Primary Evaluator]

BEHAVIORAL OBSERVATIONS:
Mr. Riggins was escorted to the interview room by correctional staff. He was
dressed in standard jail-issue clothing that appeared clean but wrinkled. He
was malodorous, suggesting poor hygiene. He made intermittent eye contact,
frequently scanning the corners of the room and the ceiling. He was restless,
shifting in his chair and occasionally standing without apparent purpose before
sitting again.

ORIENTATION AND ATTENTION:
Mr. Riggins was oriented to person ("DeShawn Riggins") and partial to place
("a jail... Denver, I think"). He was not oriented to date, stating it was
"January... no, February" (actual date March 29). He was unable to maintain
attention for more than 3-4 minutes before becoming distracted by internal
stimuli.

UNDERSTANDING OF EVALUATION PURPOSE:
When asked why he was being seen today, Mr. Riggins stated, "My lawyer... she
wants to know if I'm crazy." With prompting, he was unable to elaborate on
what a competency evaluation means or what its outcome might be.

UNDERSTANDING OF CHARGES:
Mr. Riggins was asked about his current charges. He stated, "They say I robbed
somebody." When asked what robbery means, he said, "Taking stuff." He was
unable to name the specific charges (Robbery 1st, Assault 2nd) despite
reportedly being informed multiple times by counsel. When asked about possible
penalties, he stated, "They could lock me up for a long time," but was unable
to provide any specifics regarding sentence length or felony classification.

UNDERSTANDING OF COURTROOM ROLES:
Judge: "The boss. He decides things." (Adequate understanding)
Prosecutor: "The one trying to get me." (Partial understanding; unable to
  articulate that the prosecutor represents the state/people)
Defense attorney: Initially stated, "She's nice," referring to Ms. Polk.
  When asked what her job is, he said, "To help me, I think." However, when
  asked if he trusts her, he paused for approximately 15 seconds, then
  stated, "Sometimes the voices say she's lying to me."
Jury: "People who watch." (Inadequate; unable to describe the jury's
  decision-making role)

ABILITY TO ASSIST COUNSEL:
Mr. Riggins was asked to describe what happened on the night of February 8.
His account was fragmented and largely incoherent. He stated, "I went to the
store because they told me to get something... not the voices, the other
ones... I needed something but I can't remember what." He was unable to provide
a linear narrative of events. When asked specific questions about the incident,
he became increasingly agitated and stated, "I don't want to talk about the
ceiling people."

THOUGHT PROCESS:
Tangential, with frequent loose associations. Example: When asked about his
medication history, he responded, "The pills make the floor stay still.
The floor at Pueblo was better. They had good chicken there. My mom makes
chicken too. Is she coming today?"

PSYCHOTIC SYMPTOMS:
Mr. Riggins endorsed ongoing auditory hallucinations, describing "two voices
that argue about what I should do." He reported that one voice is "mean" and
tells him "not to trust anyone" while the other "tries to help but gets
confused." He stated the voices have been present "since forever" but have
been "louder" since he stopped taking medication. He denied visual
hallucinations but appeared to track nonexistent stimuli in the room on
multiple occasions.

He endorsed a persecutory belief that "the ceiling people" are monitoring him
and can "move the floor" to disorient him. He was unable to identify who the
ceiling people are or what they want.

AFFECT AND MOOD:
Mood: "I don't know. Tired, I guess."
Affect: Flat with intermittent inappropriate laughter, typically following
mentions of the "ceiling people" or voices. No tearfulness. Range was
markedly restricted.

RISK ASSESSMENT:
Suicidal ideation: Denied. "I don't want to die."
Homicidal ideation: Denied.
Self-harm: No evidence of recent self-harm. No scars observed.
Violence risk: Low in current setting. No behavioral incidents reported by
jail staff since booking.

IMPRESSION:
Mr. Riggins presents with active psychotic symptoms (auditory hallucinations,
persecutory delusions, disorganized thought process) that significantly impair
his factual and rational understanding of the legal proceedings. His current
presentation is consistent with his documented history of schizoaffective
disorder during periods of medication noncompliance. Formal testing will
further quantify cognitive and personality functioning.

Second interview session scheduled for 04/01/2026 to complete the evaluation.
`

const INTERVIEW_NOTES_2 = `CLINICAL INTERVIEW NOTES
Case: Riggins, DeShawn M. (PSY-2026-H001)
Session: 2 of 2
Date: 04/01/2026
Duration: 43 minutes
Location: Interview Room B, Denver County Jail
Clinician: [Primary Evaluator]

NOTE: Mr. Riggins has now been back on risperidone (titrated to 4mg BID as of
03/24/2026) for approximately 3 weeks. Jail psychiatry reports partial
stabilization with reduced hallucination frequency and improved sleep.

BEHAVIORAL OBSERVATIONS:
Mr. Riggins was notably more organized in presentation compared to Session 1.
Hygiene had improved. He sat still for approximately 10-minute stretches before
becoming restless. Eye contact was improved but remained inconsistent. He
appeared tired but cooperative.

ORIENTATION:
Oriented to person and place ("Denver County Jail"). Oriented to approximate
date ("end of March or early April" - close; actual date April 1). Significant
improvement from Session 1.

FOLLOW-UP ON CHARGES AND LEGAL UNDERSTANDING:
When asked again about his charges, Mr. Riggins stated, "Robbery and assault.
They say I hurt the guy at the store." This represents improved factual
recall from Session 1. However, when asked about the difference between
Robbery 1st and 2nd degree, or the distinction between felony classes, he
was unable to articulate any differences. When asked about maximum penalties,
he stated, "A long time. Years." He was unable to give a number.

PLEA OPTIONS:
When asked about possible plea options, Mr. Riggins stated, "Guilty means I
did it. Not guilty means I didn't." He was unable to describe what a plea
bargain is or why someone might accept one. He stated he wants "to go home"
but could not connect that desire to any legal strategy.

ABILITY TO ASSIST COUNSEL (REASSESSED):
Mr. Riggins was asked to describe the events of February 8 again. His
narrative was somewhat more coherent than Session 1: "I went to the store.
I had the thing, the cutter. I needed money. The voices were loud that night.
I didn't mean to cut him." However, he was unable to identify potential
witnesses, discuss surveillance footage strategically, or consider how his
mental state at the time might be relevant to a defense.

When asked if he could sit through a trial, he stated, "I don't know. Sometimes
it gets too loud in my head." When asked what he would do if the voices became
disruptive during a hearing, he said, "I'd try to ignore them."

MEDICATION EFFECTS:
Mr. Riggins reported that the risperidone has made the voices "quieter but
not gone." He stated the voices are present for portions of each day but are
no longer constant. The persecutory beliefs about "ceiling people" persist but
are described with less conviction: "I know it sounds crazy, but I still
feel like they're watching."

COMPETENCY-SPECIFIC FUNCTIONING:
Applied to the Dusky standard (Dusky v. United States, 1960):

1. Rational understanding of proceedings: IMPAIRED. Mr. Riggins has improved
   factual knowledge of his situation but continues to incorporate delusional
   material into his understanding of the legal process (e.g., concern that
   the courtroom may be "poisoned," intermittent belief that counsel is allied
   with the voices).

2. Factual understanding of proceedings: PARTIALLY INTACT. He can now name
   his charges, identify the general roles of courtroom personnel, and
   understands that conviction results in incarceration. However, he lacks
   nuanced understanding of plea options, felony grades, and procedural rights.

3. Ability to assist counsel: SIGNIFICANTLY IMPAIRED. While his narrative of
   events has improved, he remains unable to discuss case strategy, evaluate
   evidence, or identify relevant information for his defense. His ongoing
   psychotic symptoms, though partially treated, continue to intrude upon his
   reasoning.

OVERALL IMPRESSION:
Mr. Riggins shows partial improvement with medication reinstatement but remains
significantly impaired in his ability to assist counsel and in his rational
understanding of proceedings. The improvement trend suggests restoration is
feasible with continued treatment, consistent with his prior restoration at
CMHIP in 2020 (69-day course).

Testing data (MMPI-3, PAI, WAIS-IV, MacCAT-CA) will be integrated with
interview findings for the final report.
`

// ---------------------------------------------------------------------------
// Test score data (psychometrically valid)
// ---------------------------------------------------------------------------

const MMPI3_SCORES: import('../manifest').TestScoreFixture = {
  instrumentName: 'Minnesota Multiphasic Personality Inventory-3',
  instrumentAbbrev: 'MMPI-3',
  administrationDate: '2026-03-30',
  dataEntryMethod: 'manual',
  scores: [
    { scaleName: 'RC1 (Somatic Complaints)', tScore: 58, percentile: 79, interpretation: 'Within normal limits' },
    { scaleName: 'RC2 (Low Positive Emotions)', tScore: 72, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'RC3 (Cynicism)', tScore: 55, percentile: 69, interpretation: 'Within normal limits' },
    { scaleName: 'RC4 (Antisocial Behavior)', tScore: 61, percentile: 86, interpretation: 'Mildly elevated' },
    { scaleName: 'RC6 (Ideas of Persecution)', tScore: 88, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'RC7 (Dysfunctional Negative Emotions)', tScore: 70, percentile: 98, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'RC8 (Aberrant Experiences)', tScore: 85, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'RC9 (Hypomanic Activation)', tScore: 62, percentile: 88, interpretation: 'Mildly elevated' },
    { scaleName: 'EID (Emotional/Internalizing Dysfunction)', tScore: 71, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'THD (Thought Dysfunction)', tScore: 86, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'BXD (Behavioral/Externalizing Dysfunction)', tScore: 57, percentile: 76, interpretation: 'Within normal limits' },
  ],
  validityScores: [
    { scaleName: 'CNS (Cannot Say)', rawScore: 2, interpretation: 'Valid' },
    { scaleName: 'VRIN-r (Variable Response Inconsistency)', tScore: 52, interpretation: 'Valid' },
    { scaleName: 'TRIN-r (True Response Inconsistency)', tScore: 57, interpretation: 'Valid' },
    { scaleName: 'F-r (Infrequent Responses)', tScore: 78, interpretation: 'Elevated but consistent with severe psychopathology', isElevated: true },
    { scaleName: 'Fp-r (Infrequent Psychopathology)', tScore: 63, interpretation: 'Acceptable range' },
    { scaleName: 'Fs (Infrequent Somatic)', tScore: 51, interpretation: 'Valid' },
    { scaleName: 'FBS-r (Symptom Validity)', tScore: 55, interpretation: 'Valid' },
    { scaleName: 'L-r (Uncommon Virtues)', tScore: 45, interpretation: 'Valid' },
    { scaleName: 'K-r (Adjustment Validity)', tScore: 38, interpretation: 'Low; consistent with poor coping resources' },
  ],
  clinicalNarrative: 'The MMPI-3 profile is valid and interpretable. The pattern of elevated THD (T=86), RC6 (T=88), and RC8 (T=85) is consistent with active psychotic symptomatology including persecutory ideation and aberrant perceptual experiences. Elevated EID and RC2 suggest comorbid depressive features with anhedonia. The overall configuration is consistent with schizoaffective disorder presentation. F-r elevation (T=78) is within the range expected for individuals with genuine severe psychopathology and does not suggest overreporting when considered alongside validity indicators.',
}

const PAI_SCORES: import('../manifest').TestScoreFixture = {
  instrumentName: 'Personality Assessment Inventory',
  instrumentAbbrev: 'PAI',
  administrationDate: '2026-03-30',
  dataEntryMethod: 'manual',
  scores: [
    { scaleName: 'SCZ (Schizophrenia)', tScore: 82, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'SCZ-P (Psychotic Experiences)', tScore: 86, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'SCZ-S (Social Detachment)', tScore: 74, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'SCZ-T (Thought Disorder)', tScore: 78, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'PAR (Paranoia)', tScore: 76, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'PAR-H (Hypervigilance)', tScore: 72, percentile: 99, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'PAR-P (Persecution)', tScore: 80, percentile: 99, interpretation: 'Markedly elevated', isElevated: true },
    { scaleName: 'DEP (Depression)', tScore: 68, percentile: 96, interpretation: 'Clinically elevated', isElevated: true },
    { scaleName: 'ANX (Anxiety)', tScore: 64, percentile: 92, interpretation: 'Mildly elevated' },
    { scaleName: 'MAN (Mania)', tScore: 58, percentile: 79, interpretation: 'Within normal limits' },
    { scaleName: 'ANT (Antisocial Features)', tScore: 56, percentile: 73, interpretation: 'Within normal limits' },
    { scaleName: 'AGG (Aggression)', tScore: 52, percentile: 58, interpretation: 'Within normal limits' },
    { scaleName: 'SUI (Suicidal Ideation)', tScore: 48, percentile: 42, interpretation: 'Within normal limits' },
  ],
  validityScores: [
    { scaleName: 'ICN (Inconsistency)', tScore: 55, interpretation: 'Valid' },
    { scaleName: 'INF (Infrequency)', tScore: 62, interpretation: 'Acceptable' },
    { scaleName: 'NIM (Negative Impression)', tScore: 71, interpretation: 'Mildly elevated; consistent with genuine distress', isElevated: true },
    { scaleName: 'PIM (Positive Impression)', tScore: 39, interpretation: 'Low; not attempting to minimize' },
    { scaleName: 'MAL (Malingering Index)', rawScore: 2, interpretation: 'Below cutoff; no malingering indicators' },
  ],
  clinicalNarrative: 'PAI results corroborate the MMPI-3 findings. The SCZ composite (T=82) with prominent psychotic experiences (SCZ-P=86) and thought disorder (SCZ-T=78) subscales confirms the presence of significant psychotic symptomatology. Paranoia (T=76) with prominent persecution (PAR-P=80) aligns with the documented persecutory delusions regarding "ceiling people." Validity indicators are acceptable; the MAL index (2) and absence of elevated NIM/INF convergence argue against symptom fabrication.',
}

const WAIS_IV_SCORES: import('../manifest').TestScoreFixture = {
  instrumentName: 'Wechsler Adult Intelligence Scale - IV',
  instrumentAbbrev: 'WAIS-IV',
  administrationDate: '2026-03-31',
  dataEntryMethod: 'manual',
  scores: [
    { scaleName: 'Verbal Comprehension Index (VCI)', rawScore: undefined, scaledScore: undefined, tScore: undefined, percentile: 27, interpretation: 'Low Average', isElevated: false },
    { scaleName: 'Perceptual Reasoning Index (PRI)', percentile: 21, interpretation: 'Low Average' },
    { scaleName: 'Working Memory Index (WMI)', percentile: 9, interpretation: 'Low; consistent with attentional impairment from psychotic symptoms', isElevated: true },
    { scaleName: 'Processing Speed Index (PSI)', percentile: 16, interpretation: 'Low Average' },
    { scaleName: 'Full Scale IQ (FSIQ)', rawScore: undefined, tScore: undefined, percentile: 18, interpretation: 'Low Average (FSIQ = 86, 95% CI: 82-91)' },
    { scaleName: 'Similarities', scaledScore: 8, interpretation: 'Average' },
    { scaleName: 'Vocabulary', scaledScore: 7, interpretation: 'Low Average' },
    { scaleName: 'Information', scaledScore: 7, interpretation: 'Low Average' },
    { scaleName: 'Block Design', scaledScore: 7, interpretation: 'Low Average' },
    { scaleName: 'Matrix Reasoning', scaledScore: 8, interpretation: 'Average' },
    { scaleName: 'Visual Puzzles', scaledScore: 7, interpretation: 'Low Average' },
    { scaleName: 'Digit Span', scaledScore: 5, interpretation: 'Borderline; impaired forward and backward span', isElevated: true },
    { scaleName: 'Arithmetic', scaledScore: 6, interpretation: 'Low Average' },
    { scaleName: 'Symbol Search', scaledScore: 7, interpretation: 'Low Average' },
    { scaleName: 'Coding', scaledScore: 6, interpretation: 'Low Average' },
  ],
  clinicalNarrative: 'Estimated FSIQ of 86 (Low Average, 18th percentile) likely represents an underestimate of premorbid functioning given the impact of active psychotic symptoms on attention and processing speed. The WMI (9th percentile) is notably depressed relative to VCI (27th percentile), consistent with attentional fragmentation secondary to hallucinations. Digit Span (scaled score 5) was particularly impaired, with Mr. Riggins reporting auditory hallucinations during administration. These results should be interpreted with caution given the confounding effect of active psychosis on cognitive test performance.',
}

const MACCAT_CA_SCORES: import('../manifest').TestScoreFixture = {
  instrumentName: 'MacArthur Competence Assessment Tool - Criminal Adjudication',
  instrumentAbbrev: 'MacCAT-CA',
  administrationDate: '2026-04-01',
  dataEntryMethod: 'manual',
  scores: [
    { scaleName: 'Understanding', rawScore: 10, interpretation: 'Minimal impairment (range 0-16; clinical concern below 10)' },
    { scaleName: 'Reasoning', rawScore: 8, interpretation: 'Mild impairment (range 0-16; clinical concern below 10)', isElevated: true },
    { scaleName: 'Appreciation', rawScore: 4, interpretation: 'Clinically significant impairment (range 0-12; clinical concern below 6)', isElevated: true },
  ],
  clinicalNarrative: 'MacCAT-CA results reveal a dissociation between Understanding (adequate) and Appreciation (significantly impaired). Mr. Riggins can recite factual information about the legal system when prompted (Understanding = 10) but is unable to apply that knowledge rationally to his own situation (Appreciation = 4). This pattern is characteristic of psychotic interference with rational decision-making capacity. The Appreciation subscale was particularly impacted by his incorporation of delusional material when asked to apply legal concepts to his case (e.g., belief that the courtroom is "poisoned," mistrust of counsel driven by auditory hallucinations). Reasoning (8) falls below the concern threshold, suggesting difficulty in legal decision-making even when provided with relevant information.',
}

// ---------------------------------------------------------------------------
// Agent result stubs
// ---------------------------------------------------------------------------

const INGESTOR_RESULT: import('../manifest').AgentResultStub = {
  agentType: 'ingestor',
  resultJson: {
    case_id: 'PSY-2026-H001',
    version: '1.0',
    generated_at: '2026-04-02T14:30:00Z',
    demographics: {
      name: 'DeShawn Marquis Riggins',
      dob: '1997-07-23',
      age: 28,
      sex: 'Male',
      race: 'Black',
      education: '11th grade (did not graduate)',
      occupation: 'Unemployed (last employment: DHL warehouse, 2022)',
    },
    referral_questions: [
      {
        question_text: 'Does the defendant have sufficient present ability to consult with his attorney with a reasonable degree of rational understanding?',
        source_document: 'Court Order, Case No. 2026CR1847',
      },
      {
        question_text: 'Does the defendant have a rational as well as factual understanding of the proceedings against him?',
        source_document: 'Court Order, Case No. 2026CR1847',
      },
      {
        question_text: 'If incompetent, is restoration to competency likely with appropriate treatment?',
        source_document: 'Court Order, Case No. 2026CR1847',
      },
    ],
    completeness_flags: {
      demographics: 'complete',
      referral_questions: 'complete',
      test_results: 'complete',
      interview_data: 'complete',
      collateral_information: 'complete',
    },
  },
}

const DIAGNOSTICIAN_RESULT: import('../manifest').AgentResultStub = {
  agentType: 'diagnostician',
  resultJson: {
    case_id: 'PSY-2026-H001',
    version: '1.0',
    generated_at: '2026-04-03T10:00:00Z',
    diagnostic_evidence_map: {
      'Schizoaffective Disorder, Bipolar Type': {
        icd_code: 'F25.0',
        status: 'evidence_presented',
        supporting_evidence: [
          'Active auditory hallucinations (command and conversational type)',
          'Persecutory delusions ("ceiling people")',
          'Disorganized thought process documented across interviews',
          'MMPI-3 THD T=86, RC6 T=88, RC8 T=85',
          'PAI SCZ T=82, SCZ-P T=86',
          '4 prior hospitalizations with this diagnosis',
          'History of medication response (risperidone)',
          'Family history: paternal uncle with schizophrenia',
        ],
      },
    },
    psycholegal_analysis: {
      legal_standard: 'Dusky v. United States (1960)',
      jurisdiction: 'Colorado, C.R.S. 16-8.5-101',
      standard_elements: [
        { element: 'Factual understanding', evidence_map: ['MacCAT-CA Understanding = 10 (adequate)'] },
        { element: 'Rational understanding', evidence_map: ['MacCAT-CA Appreciation = 4 (impaired)', 'Delusional intrusions into legal reasoning'] },
        { element: 'Ability to assist counsel', evidence_map: ['Unable to provide coherent narrative', 'Cannot discuss case strategy', 'Paranoid regarding counsel'] },
      ],
    },
  },
}

const WRITER_RESULT: import('../manifest').AgentResultStub = {
  agentType: 'writer',
  resultJson: {
    case_id: 'PSY-2026-H001',
    version: '1.0',
    generated_at: '2026-04-04T09:00:00Z',
    sections_generated: ['identifying_information', 'referral_information', 'relevant_history', 'behavioral_observations', 'test_results', 'clinical_findings', 'competency_analysis', 'conclusions_and_recommendations'],
    status: 'draft_complete',
  },
}

const EDITOR_RESULT: import('../manifest').AgentResultStub = {
  agentType: 'editor',
  resultJson: {
    case_id: 'PSY-2026-H001',
    version: '1.0',
    generated_at: '2026-04-04T14:00:00Z',
    review_status: 'approved_with_minor_edits',
    issues_found: 3,
    issues_resolved: 3,
  },
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const deshawnRigginsManifest: TestCaseManifest = {
  id: 'cst-riggins-001',
  name: 'DeShawn Riggins - CST Full Pipeline',
  description: 'Complex Competency to Stand Trial evaluation. 28-year-old male with schizoaffective disorder, 4 prior hospitalizations, medication noncompliance. Court-ordered eval for Robbery 1st / Assault 2nd in Denver District Court. Tests every pipeline stage from intake through report completion.',
  stopAtStage: null, // full run

  caseDefinition: {
    caseNumber: 'PSY-2026-H001',
    firstName: 'DeShawn',
    lastName: 'Riggins',
    dob: '1997-07-23',
    gender: 'M',
    evaluationType: 'CST',
    referralSource: 'Court',
    evaluationQuestions: 'Competency to stand trial per C.R.S. 16-8.5-101. (1) Sufficient present ability to consult with attorney? (2) Rational and factual understanding of proceedings? (3) If incompetent, is restoration likely?',
    notes: 'Court-ordered CST. Prior CMHIP restoration (2020, 69 days). Currently decompensated, restarted risperidone 02/10/2026.',
  },

  intake: {
    referralSource: 'Hon. Frank W. Medina, Denver District Court, Division 5',
    referralType: 'court_ordered',
    presentingComplaint: 'Defense counsel reports defendant unable to meaningfully participate in case preparation, appears confused about charges, exhibits disorganized behavior and responds to internal stimuli during attorney meetings. History of schizoaffective disorder with medication noncompliance.',
    status: 'complete',
  },

  documents: [
    {
      filename: 'Court_Order_CST_Evaluation_2026CR1847.txt',
      subfolder: '_Inbox',
      documentType: 'court_order',
      content: COURT_ORDER,
      description: 'Court order for competency evaluation, Case No. 2026CR1847',
    },
    {
      filename: 'Denver_PD_Incident_Report_2026-0038741.txt',
      subfolder: 'Collateral',
      documentType: 'police_report',
      content: POLICE_REPORT,
      description: 'Denver PD incident report for robbery/assault, Det. Kowalski',
    },
    {
      filename: 'Denver_County_Jail_Medical_Screening.txt',
      subfolder: 'Collateral',
      documentType: 'medical_record',
      content: JAIL_MEDICAL,
      description: 'Jail intake medical/mental health screening, RN Delgado',
    },
    {
      filename: 'CMHIP_Discharge_Summary_2020.txt',
      subfolder: 'Collateral',
      documentType: 'medical_record',
      content: PRIOR_PSYCH_RECORDS,
      description: 'CMHIP discharge summary from 2020 competency restoration (69 days)',
    },
    {
      filename: 'Defense_Motion_Competency_2026CR1847.txt',
      subfolder: 'Collateral',
      documentType: 'legal_document',
      content: DEFENSE_MOTION,
      description: 'Defense motion for competency determination, Whitney Polk APD',
    },
    {
      filename: 'Collateral_Contact_Loretta_Riggins_Mother.txt',
      subfolder: 'Collateral',
      documentType: 'collateral_contact',
      content: COLLATERAL_MOTHER,
      description: 'Collateral interview with Loretta Riggins (mother), 47 min telephone',
    },
    // Testing documents (uploaded during testing stage)
    {
      filename: 'MMPI3_Score_Report_Riggins.txt',
      subfolder: 'Testing',
      documentType: 'score_report',
      content: 'MMPI-3 Score Report\nExaminee: DeShawn Riggins\nDate: 03/30/2026\n[Score data entered manually via ScoreImportModal]',
      description: 'MMPI-3 score report placeholder (scores entered manually)',
    },
    {
      filename: 'PAI_Score_Report_Riggins.txt',
      subfolder: 'Testing',
      documentType: 'score_report',
      content: 'PAI Score Report\nExaminee: DeShawn Riggins\nDate: 03/30/2026\n[Score data entered manually via ScoreImportModal]',
      description: 'PAI score report placeholder (scores entered manually)',
    },
    {
      filename: 'WAIS_IV_Score_Report_Riggins.txt',
      subfolder: 'Testing',
      documentType: 'score_report',
      content: 'WAIS-IV Score Report\nExaminee: DeShawn Riggins\nDate: 03/31/2026\n[Score data entered manually via ScoreImportModal]',
      description: 'WAIS-IV score report placeholder (scores entered manually)',
    },
    {
      filename: 'MacCAT_CA_Score_Report_Riggins.txt',
      subfolder: 'Testing',
      documentType: 'score_report',
      content: 'MacCAT-CA Score Report\nExaminee: DeShawn Riggins\nDate: 04/01/2026\n[Score data entered manually via ScoreImportModal]',
      description: 'MacCAT-CA score report placeholder (scores entered manually)',
    },
    // Interview documents
    {
      filename: 'Clinical_Interview_Session_1_03292026.txt',
      subfolder: 'Interviews',
      documentType: 'transcript_vtt',
      content: INTERVIEW_NOTES_1,
      description: 'Clinical interview session 1 (52 min), Denver County Jail',
    },
    {
      filename: 'Clinical_Interview_Session_2_04012026.txt',
      subfolder: 'Interviews',
      documentType: 'transcript_vtt',
      content: INTERVIEW_NOTES_2,
      description: 'Clinical interview session 2 (43 min), Denver County Jail',
    },
  ],

  scores: [MMPI3_SCORES, PAI_SCORES, WAIS_IV_SCORES, MACCAT_CA_SCORES],

  decisions: [
    {
      diagnosisKey: 'F25.0',
      icdCode: 'ICD-10-CM',
      diagnosisName: 'Schizoaffective Disorder, Bipolar Type',
      decision: 'render',
      clinicianNotes: 'Well-established diagnosis with 4 hospitalizations, consistent MMPI-3/PAI profiles, documented psychotic symptoms across multiple sources. Current decompensation secondary to 3-month medication noncompliance.',
    },
    {
      diagnosisKey: 'F12.20',
      icdCode: 'ICD-10-CM',
      diagnosisName: 'Cannabis Use Disorder, Moderate',
      decision: 'render',
      clinicianNotes: 'Documented in CMHIP records. Per self-report, intermittent use continues. Not a primary contributor to current presentation but relevant to treatment planning.',
    },
    {
      diagnosisKey: 'Z65.1',
      icdCode: 'ICD-10-CM',
      diagnosisName: 'Imprisonment',
      decision: 'render',
      clinicianNotes: 'Contextual factor relevant to current evaluation setting.',
    },
    {
      diagnosisKey: 'F31.9',
      icdCode: 'ICD-10-CM',
      diagnosisName: 'Bipolar Disorder, Unspecified',
      decision: 'rule_out',
      clinicianNotes: 'Psychotic features and course are better accounted for by schizoaffective disorder. No periods of psychosis independent of mood episodes were identified in the limited history available, but the schizoaffective presentation across multiple hospitalizations and treatment responses supports schizoaffective over pure bipolar.',
    },
    {
      diagnosisKey: 'F20.9',
      icdCode: 'ICD-10-CM',
      diagnosisName: 'Schizophrenia, Unspecified',
      decision: 'rule_out',
      clinicianNotes: 'Mood episodes (depressive) documented during 2020 CMHIP admission argue against pure schizophrenia. Schizoaffective, bipolar type, better fits the longitudinal course.',
    },
  ],

  formulation: {
    formulation: 'Mr. Riggins is a 28-year-old Black male with a well-documented history of Schizoaffective Disorder, Bipolar Type, currently experiencing psychotic decompensation following approximately 3 months of antipsychotic medication noncompliance. His presentation, including auditory hallucinations, persecutory delusions, and disorganized thought processes, is consistent across multiple data sources: clinical interview, collateral contact with his mother, jail medical records, prior hospitalization records, and objective psychological testing (MMPI-3, PAI, WAIS-IV, MacCAT-CA).\n\nWith respect to the referral questions, Mr. Riggins demonstrates adequate factual understanding of the proceedings (MacCAT-CA Understanding = 10) but significantly impaired rational understanding (MacCAT-CA Appreciation = 4) and impaired ability to assist counsel. Active psychotic symptoms intrude upon his legal reasoning, producing paranoid beliefs about counsel and delusional interpretations of the courtroom environment. His cognitive profile (FSIQ = 86) represents a likely underestimate given attentional interference from hallucinations.\n\nGiven his history of successful competency restoration at CMHIP in 2020 (69-day course on risperidone 4mg BID) and his partial response to medication reinstatement since booking, the prognosis for restoration is favorable with continued antipsychotic treatment in a structured setting. However, his documented pattern of cyclic medication noncompliance raises concerns about long-term maintenance of competency if returned to the community without robust support systems.',
  },

  agentResults: [INGESTOR_RESULT, DIAGNOSTICIAN_RESULT, WRITER_RESULT, EDITOR_RESULT],

  dataConfirmations: [
    { categoryId: 'demographics', status: 'confirmed', notes: 'Verified against jail booking records and CMHIP discharge summary' },
    { categoryId: 'referral_questions', status: 'confirmed', notes: 'Three referral questions confirmed per court order' },
  ],

  // ---------------------------------------------------------------------------
  // Pipeline steps - ordered execution
  // ---------------------------------------------------------------------------
  steps: [
    // === ONBOARDING STAGE ===
    {
      description: 'Create case: DeShawn Riggins, CST evaluation',
      action: { type: 'create_case' },
      expectedStage: 'onboarding',
      tags: ['screenshot'],
    },
    {
      description: 'Screenshot: Empty case created in onboarding',
      action: { type: 'screenshot', label: '01_case_created_onboarding' },
    },
    {
      description: 'Save intake form (court-ordered CST)',
      action: { type: 'save_intake' },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest court order (Case No. 2026CR1847)',
      action: { type: 'ingest_document', documentIndex: 0 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest police report (Det. Kowalski)',
      action: { type: 'ingest_document', documentIndex: 1 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest jail medical screening',
      action: { type: 'ingest_document', documentIndex: 2 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest CMHIP discharge summary (2020)',
      action: { type: 'ingest_document', documentIndex: 3 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest defense motion for competency',
      action: { type: 'ingest_document', documentIndex: 4 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Ingest collateral contact (mother Loretta Riggins)',
      action: { type: 'ingest_document', documentIndex: 5 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Screenshot: All onboarding documents ingested',
      action: { type: 'screenshot', label: '02_onboarding_docs_complete' },
    },
    {
      description: 'Confirm demographics data',
      action: { type: 'confirm_data', confirmationIndex: 0 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Confirm referral questions',
      action: { type: 'confirm_data', confirmationIndex: 1 },
      expectedStage: 'onboarding',
    },
    {
      description: 'Advance: onboarding -> testing',
      action: { type: 'advance_stage' },
      expectedStage: 'testing',
    },
    {
      description: 'Screenshot: Advanced to testing stage',
      action: { type: 'screenshot', label: '03_testing_stage_entered' },
    },

    // === TESTING STAGE ===
    {
      description: 'Ingest MMPI-3 score report',
      action: { type: 'ingest_document', documentIndex: 6 },
      expectedStage: 'testing',
    },
    {
      description: 'Save MMPI-3 scores (manual entry)',
      action: { type: 'save_scores', scoreIndex: 0 },
      expectedStage: 'testing',
    },
    {
      description: 'Ingest PAI score report',
      action: { type: 'ingest_document', documentIndex: 7 },
      expectedStage: 'testing',
    },
    {
      description: 'Save PAI scores (manual entry)',
      action: { type: 'save_scores', scoreIndex: 1 },
      expectedStage: 'testing',
    },
    {
      description: 'Ingest WAIS-IV score report',
      action: { type: 'ingest_document', documentIndex: 8 },
      expectedStage: 'testing',
    },
    {
      description: 'Save WAIS-IV scores (manual entry)',
      action: { type: 'save_scores', scoreIndex: 2 },
      expectedStage: 'testing',
    },
    {
      description: 'Ingest MacCAT-CA score report',
      action: { type: 'ingest_document', documentIndex: 9 },
      expectedStage: 'testing',
    },
    {
      description: 'Save MacCAT-CA scores (manual entry)',
      action: { type: 'save_scores', scoreIndex: 3 },
      expectedStage: 'testing',
    },
    {
      description: 'Screenshot: All test scores entered',
      action: { type: 'screenshot', label: '04_test_scores_complete' },
    },
    {
      description: 'Advance: testing -> interview',
      action: { type: 'advance_stage' },
      expectedStage: 'interview',
    },
    {
      description: 'Screenshot: Advanced to interview stage',
      action: { type: 'screenshot', label: '05_interview_stage_entered' },
    },

    // === INTERVIEW STAGE ===
    {
      description: 'Ingest clinical interview session 1 notes',
      action: { type: 'ingest_document', documentIndex: 10 },
      expectedStage: 'interview',
    },
    {
      description: 'Ingest clinical interview session 2 notes',
      action: { type: 'ingest_document', documentIndex: 11 },
      expectedStage: 'interview',
    },
    {
      description: 'Screenshot: Interview documents uploaded',
      action: { type: 'screenshot', label: '06_interviews_documented' },
    },
    {
      description: 'Inject ingestor agent result (case synthesis)',
      action: { type: 'inject_agent_result', agentResultIndex: 0 },
      expectedStage: 'interview',
    },
    {
      description: 'Advance: interview -> diagnostics',
      action: { type: 'advance_stage' },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Screenshot: Advanced to diagnostics stage',
      action: { type: 'screenshot', label: '07_diagnostics_stage_entered' },
    },

    // === DIAGNOSTICS STAGE ===
    {
      description: 'Inject diagnostician agent result (evidence map)',
      action: { type: 'inject_agent_result', agentResultIndex: 1 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Screenshot: Diagnostician evidence map available',
      action: { type: 'screenshot', label: '08_evidence_map_ready' },
    },
    {
      description: 'Clinician renders Schizoaffective Disorder, Bipolar Type (F25.0)',
      action: { type: 'save_decision', decisionIndex: 0 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Clinician renders Cannabis Use Disorder, Moderate (F12.20)',
      action: { type: 'save_decision', decisionIndex: 1 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Clinician renders Z-code: Imprisonment (Z65.1)',
      action: { type: 'save_decision', decisionIndex: 2 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Clinician rules out Bipolar Disorder (F31.9)',
      action: { type: 'save_decision', decisionIndex: 3 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Clinician rules out Schizophrenia (F20.9)',
      action: { type: 'save_decision', decisionIndex: 4 },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Save clinical formulation',
      action: { type: 'save_formulation' },
      expectedStage: 'diagnostics',
    },
    {
      description: 'Screenshot: All diagnostic decisions and formulation complete',
      action: { type: 'screenshot', label: '09_diagnostics_complete' },
    },
    {
      description: 'Advance: diagnostics -> review',
      action: { type: 'advance_stage' },
      expectedStage: 'review',
    },
    {
      description: 'Screenshot: Advanced to review stage',
      action: { type: 'screenshot', label: '10_review_stage_entered' },
    },

    // === REVIEW STAGE ===
    {
      description: 'Inject writer agent result (draft report)',
      action: { type: 'inject_agent_result', agentResultIndex: 2 },
      expectedStage: 'review',
    },
    {
      description: 'Inject editor agent result (legal review)',
      action: { type: 'inject_agent_result', agentResultIndex: 3 },
      expectedStage: 'review',
    },
    {
      description: 'Screenshot: Report drafted and reviewed',
      action: { type: 'screenshot', label: '11_report_drafted' },
    },
    {
      description: 'Clinician attests to report accuracy',
      action: { type: 'attest_report' },
      expectedStage: 'review',
    },
    {
      description: 'Advance: review -> complete',
      action: { type: 'advance_stage' },
      expectedStage: 'complete',
    },
    {
      description: 'Screenshot: Case complete',
      action: { type: 'screenshot', label: '12_case_complete' },
    },
  ],
}
