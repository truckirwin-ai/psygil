// =============================================================================
// seed-resources.ts, Populate _Resources folders with realistic demo content
// =============================================================================
//
// Creates sample files across all three resource categories:
//   - Writing Samples: Forensic psychologist's own writing (voice/style)
//   - Templates: Report templates per evaluation type
//   - Documentation: DSM references, state guidelines, testing manuals
//
// Files are written with their ORIGINAL filenames into the category folders.
// The ResourcesPanel scans these folders directly, no metadata sidecars.
// A _cleaned/ subfolder in each category holds PHI-stripped text versions.
// =============================================================================

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'

interface SeedFile {
  readonly originalFilename: string
  readonly content: string
  readonly ext: string
  readonly mime: string
}

function writeSeedFile(dir: string, file: SeedFile): void {
  const filePath = join(dir, file.originalFilename)
  writeFileSync(filePath, file.content, 'utf-8')

  // Also write a cleaned version for AI consumption
  const cleanedDir = join(dir, '_cleaned')
  if (!existsSync(cleanedDir)) mkdirSync(cleanedDir, { recursive: true })
  const cleanedName = basename(file.originalFilename, extname(file.originalFilename)) + '.txt'
  writeFileSync(join(cleanedDir, cleanedName), file.content, 'utf-8')
}

// ---------------------------------------------------------------------------
// WRITING SAMPLES, Excerpts from a forensic psychologist's own work
// ---------------------------------------------------------------------------

const WRITING_SAMPLES: SeedFile[] = [
  {
    originalFilename: 'CST_Evaluation_Writing_Sample.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `COMPETENCY TO STAND TRIAL EVALUATION
Forensic Psychological Evaluation

IDENTIFYING INFORMATION

[NAME REMOVED] is a [AGE]-year-old [GENDER] individual currently detained at [FACILITY REMOVED] pending adjudication of charges including [CHARGES REMOVED]. This evaluation was ordered by [COURT REMOVED] pursuant to [STATUTE REMOVED] to address the defendant's competency to stand trial.

REFERRAL INFORMATION

This evaluator was appointed by the [COURT REMOVED] to conduct a competency evaluation of [NAME REMOVED] following a motion filed by defense counsel. The referral question is whether [NAME REMOVED] has sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and whether [NAME REMOVED] has a rational as well as factual understanding of the proceedings, consistent with the standard articulated in Dusky v. United States (1960).

NOTIFICATION OF RIGHTS AND LIMITS OF CONFIDENTIALITY

Prior to the commencement of this evaluation, [NAME REMOVED] was informed of the following: (1) the nature and purpose of this evaluation; (2) that this evaluation was ordered by the court and is not a treatment relationship; (3) that the usual rules of therapist-patient confidentiality do not apply; (4) that a written report will be submitted to the court and made available to all attorneys of record; (5) that this evaluator may be called to testify regarding findings and opinions; and (6) that participation, while ordered by the court, does not compel the examinee to answer any specific question. [NAME REMOVED] verbally acknowledged understanding of these conditions and agreed to proceed.

SOURCES OF INFORMATION

1. Clinical interview with [NAME REMOVED] conducted on [DATE REMOVED] at [FACILITY REMOVED] (approximately 3.5 hours)
2. Review of arrest report and probable cause affidavit dated [DATE REMOVED]
3. Review of prior mental health records from [PROVIDER REMOVED] ([DATE RANGE REMOVED])
4. Review of prior competency evaluation report by [EVALUATOR REMOVED] dated [DATE REMOVED]
5. Review of jail medical records including current medication log
6. Administration and scoring of the MacArthur Competence Assessment Tool,Criminal Adjudication (MacCAT-CA)
7. Administration and scoring of the Evaluation of Competency to Stand Trial,Revised (ECST-R)
8. Collateral telephone interview with defense counsel, [NAME REMOVED], Esq. (approximately 20 minutes)

MENTAL STATUS EXAMINATION

[NAME REMOVED] presented as a [DESCRIPTION] individual who appeared [DESCRIPTION] stated age. Hygiene and grooming were [DESCRIPTION]. The examinee was cooperative with the evaluation process throughout, maintaining adequate eye contact and engaging with questions in a manner that suggested genuine effort.

Speech was spontaneous, normal in rate, rhythm, and volume, and goal-directed throughout the evaluation. There were no observed abnormalities in articulation or prosody. Thought processes were linear and coherent, with occasional mild tangentiality that was easily redirected. There was no evidence of loosening of associations, thought blocking, flight of ideas, or neologisms.

Mood was described by the examinee as "alright, I guess, considering." Affect was mildly restricted in range but mood-congruent and appropriate to conversational content. There were no observed episodes of lability, flattening, or incongruence.

With respect to thought content, [NAME REMOVED] denied current suicidal ideation, homicidal ideation, or intent to harm self or others. The examinee denied current auditory or visual hallucinations, though reported a history of auditory hallucinations during periods of medication non-compliance (see Background History). There were no delusions elicited during the evaluation. [NAME REMOVED] did not exhibit paranoid ideation or ideas of reference during the interview.

Orientation was intact to person, place, time, and situation. Attention and concentration were adequate, as evidenced by the ability to engage in sustained conversation and follow multi-step test instructions. Immediate recall was intact for three of three items, with two of three items recalled after a five-minute delay. Fund of general knowledge was estimated to be within the average range. Insight was fair, and judgment appeared adequate for the purposes of this evaluation.

COMPETENCY ASSESSMENT INSTRUMENTS

MacArthur Competence Assessment Tool,Criminal Adjudication (MacCAT-CA)

The MacCAT-CA is a structured clinical instrument designed to assess three abilities related to adjudicative competence: Understanding (of the legal system and adjudicative process), Reasoning (about one's own legal situation), and Appreciation (of the relevance of information to one's own situation). Scores are interpreted relative to clinical and normative comparison groups.

Understanding: [NAME REMOVED] obtained a score of 14 out of a possible 16 on this subscale, which falls in the Adequate range. The examinee demonstrated a solid understanding of the roles of key courtroom personnel, the adversarial nature of proceedings, the nature and purpose of a plea, and the elements of an offense. [NAME REMOVED] was able to articulate the difference between a guilty and not-guilty plea and understood the potential consequences of each. The two items scored below the maximum involved minor imprecision in describing the role of the jury foreperson and the process of plea bargaining, neither of which represented a clinically significant deficit.

Reasoning: [NAME REMOVED] obtained a score of 12 out of a possible 16, which falls in the Adequate range. When presented with hypothetical legal scenarios, the examinee was able to identify relevant information, appreciate the implications of different courses of action, and demonstrate a basic capacity for means-ends reasoning. [NAME REMOVED] was able to describe a rationale for accepting or rejecting a plea offer that reflected consideration of evidence strength and potential consequences.

Appreciation: [NAME REMOVED] obtained a score of 5 out of a possible 6, which falls in the Adequate range. The examinee demonstrated appropriate appreciation of the charges, the likely evidence against [PRONOUN], and the potential penalties. [NAME REMOVED] did not exhibit delusional thinking regarding the legal process or [PRONOUN] own legal situation.

DIAGNOSTIC IMPRESSIONS

Based on the totality of data gathered during this evaluation, the following diagnostic impressions are offered consistent with the Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition, Text Revision (DSM-5-TR):

1. Schizoaffective Disorder, Bipolar Type (F25.0), in partial remission on current medication regimen. This diagnosis is supported by the examinee's documented history of mood episodes with concurrent psychotic features, periods of auditory hallucinations, and a longitudinal course consistent with the diagnostic criteria. Current partial remission is supported by the absence of active psychotic symptoms during this evaluation and adequate mood stability reported by jail medical staff.

2. Cannabis Use Disorder, Moderate (F12.20), in a controlled environment. This diagnosis is supported by the examinee's self-reported history of regular cannabis use prior to incarceration, failed attempts to reduce use, and continued use despite knowledge of legal and health consequences.

PSYCHOLEGAL OPINIONS

It is this evaluator's opinion, based on the data gathered during this evaluation, and within reasonable psychological certainty, that:

1. Regarding factual understanding of the proceedings: [NAME REMOVED] demonstrates adequate factual understanding of the charges, the roles of courtroom personnel, the adversarial nature of proceedings, possible pleas, and potential penalties. The examinee's performance on the MacCAT-CA Understanding subscale was in the Adequate range, and clinical interview responses were consistent with this finding. [NAME REMOVED] was able to accurately describe the charges, identify [PRONOUN] attorney and the prosecutor by name, explain the judge's role, and articulate the difference between a bench trial and a jury trial.

2. Regarding rational understanding of the proceedings: [NAME REMOVED] demonstrates adequate rational understanding. The examinee does not exhibit delusional thinking that distorts [PRONOUN] perception of the legal process, the evidence, or the likely outcomes. [NAME REMOVED]'s MacCAT-CA Appreciation score was in the Adequate range. The examinee was able to apply information about [PRONOUN] own case in a logical manner without the intrusion of psychotic thought content.

3. Regarding ability to consult with counsel: [NAME REMOVED] demonstrates adequate ability to communicate with defense counsel. The examinee was able to sustain attention throughout a 3.5-hour evaluation, respond to questions coherently, and describe [PRONOUN] version of events in a linear and organized fashion. Defense counsel reports that [NAME REMOVED] has been able to participate meaningfully in case preparation meetings, discuss strategy, and review discovery materials with appropriate comprehension.

Therefore, it is this evaluator's opinion that [NAME REMOVED] is COMPETENT TO STAND TRIAL at this time. This opinion is contingent upon the examinee's continued adherence to [PRONOUN] current psychotropic medication regimen. Should medication compliance lapse, a re-evaluation may be warranted.

LIMITATIONS

This evaluation represents a snapshot of the examinee's functioning at the time of this assessment. Competency is a fluid construct that may change as a function of psychiatric stability, medication adherence, substance use, or other factors. The opinions expressed herein are based on the data available at the time of this evaluation and may require revision if new information becomes available.
`,
  },
  {
    originalFilename: 'Risk_Assessment_Narrative_Sample.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `VIOLENCE RISK ASSESSMENT
Clinical Formulation and Psycholegal Opinions, Writing Sample

CLINICAL FORMULATION

The assessment of [NAME REMOVED]'s risk for future violence requires integration of historical, clinical, and contextual factors. The structured professional judgment approach employed in this evaluation uses validated instruments not to generate actuarial probability estimates, but to ensure systematic consideration of empirically supported risk and protective factors.

Historical risk factors are notable in this case. [NAME REMOVED] has a documented history of violent behavior beginning in adolescence, with [NUMBER] adjudicated offenses involving physical violence and [NUMBER] documented incidents of institutional aggression. The pattern of violence reflects predominantly reactive aggression, characterized by impulsive responses to perceived provocation rather than calculated, predatory behavior. This distinction has implications for risk management, as reactive violence is more amenable to pharmacological and cognitive-behavioral intervention than instrumental violence.

The examinee's history of substance use disorder constitutes a significant dynamic risk factor. Collateral records indicate that each of [NAME REMOVED]'s violent offenses occurred in the context of active substance use, specifically alcohol and stimulant intoxication. During periods of sustained sobriety, documented at [FACILITY REMOVED] between [DATE RANGE REMOVED], there were no documented acts of aggression. This suggests a strong functional relationship between substance use and violent behavior.

With respect to mental health factors, [NAME REMOVED]'s diagnosis of Bipolar I Disorder introduces additional risk variance. Episodes of mania, particularly those with psychotic features, have historically been associated with increased agitation, impulsivity, and impaired reality testing. However, the literature is clear that the relationship between severe mental illness and violence is modest and substantially mediated by substance use and treatment non-adherence (Elbogen & Johnson, 2009). [NAME REMOVED]'s current psychiatric stability on [MEDICATION REMOVED] is a protective factor, though one that is contingent on continued medication compliance and access to psychiatric care.

Protective factors identified in this evaluation include: (1) the examinee's expressed motivation for treatment and insight into the relationship between substance use and violent behavior; (2) a prosocial support network including [RELATIONSHIP REMOVED] who has agreed to provide housing and accountability; (3) absence of psychopathic personality traits as measured by the PCL-R (Total Score: [SCORE], which falls below the clinical threshold); and (4) increasing age, which is associated with desistance from violent behavior across populations.

HCR-20 V3 RESULTS

The Historical-Clinical-Risk Management-20, Version 3 (HCR-20 V3; Douglas, Hart, Webster, & Belfrage, 2013) is a structured professional judgment instrument comprising 20 items across three scales. Items are rated as Absent, Possibly Present, or Definitely Present, and the evaluator formulates a final risk judgment based on the totality of the assessment.

Historical Scale (H1-H10): [NAME REMOVED] received ratings of Definitely Present on H1 (Violence), H5 (Substance Use Problems), H7 (Personality Disorder), and H10 (Prior Supervision Failure). Ratings of Possibly Present were assigned to H2 (Other Antisocial Behavior), H4 (Employment Problems), and H6 (Major Mental Disorder). Items H3 (Relationships), H8 (Traumatic Experiences), and H9 (Violent Attitudes) received ratings of Absent or Possibly Present.

Clinical Scale (C1-C5): Current clinical factors reflect a mixed picture. C1 (Insight) was rated as Possibly Present, reflecting the examinee's partial but developing understanding of risk factors. C2 (Violent Ideation) was rated Absent based on current presentation. C3 (Symptoms of Major Mental Disorder) was rated Possibly Present given controlled but active psychiatric symptoms. C4 (Instability) was rated Possibly Present. C5 (Treatment or Supervision Response) was rated Possibly Present given mixed historical compliance.

Risk Management Scale (R1-R5): The relevance of risk management factors depends on the scenario being considered. In a community reintegration scenario with structured supervision: R1 (Professional Services and Plans) was rated Possibly Present given the availability of outpatient treatment resources. R2 (Living Situation) was rated Possibly Present. R3 (Personal Support) was rated Absent given the identified prosocial support system. R4 (Treatment or Supervision Response) and R5 (Stress or Coping) were each rated Possibly Present.

PSYCHOLEGAL OPINIONS ON RISK

Based on the structured professional judgment approach described above, and considering the totality of historical, clinical, and risk management factors:

It is this evaluator's opinion, within reasonable psychological certainty, that [NAME REMOVED] presents a MODERATE risk for future violence. This judgment reflects the following considerations:

Risk-elevating factors: Established pattern of reactive violence, significant substance use history with a functional relationship to violent episodes, history of supervision failure, and residual psychiatric symptoms requiring ongoing management.

Risk-mitigating factors: Absence of psychopathic personality traits, motivated engagement with treatment, identified prosocial supports, increasing age, and current psychiatric stability.

The temporal dimension of this risk opinion is critical. This moderate risk designation applies to a scenario in which [NAME REMOVED] is released to a structured community supervision plan with mandated substance use treatment, psychiatric medication management, and regular reporting. In the absence of such structured supports, risk would be expected to increase substantially. Conversely, sustained sobriety and medication adherence over a period of 12-18 months would support a downward revision of risk level.

It must be emphasized that violence risk assessment is inherently probabilistic and that no clinical instrument or method can predict with certainty whether a specific individual will or will not engage in future violence. The opinions expressed herein represent the evaluator's best clinical judgment based on the available data and current scientific understanding of violence risk factors.
`,
  },
  {
    originalFilename: 'Custody_Eval_Clinical_Formulation.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `CHILD CUSTODY EVALUATION
Clinical Formulation Section, Writing Sample

CLINICAL FORMULATION

This evaluation involved comprehensive assessment of both parents and the minor child, including clinical interviews, psychological testing, collateral contacts, and record review. The following formulation integrates data across all sources to address the referral questions posed by the Court.

Parenting Capacity of [PARENT A]

[PARENT A] presented as an engaged and emotionally attuned parent who demonstrated a clear understanding of the children's developmental needs. During the clinical interview, [PARENT A] was able to articulate each child's temperament, academic strengths and challenges, social relationships, and emotional needs with specificity and accuracy, which was corroborated by collateral contacts including the children's teachers and pediatrician.

Psychological testing results for [PARENT A] were within normal limits. The MMPI-3 validity scales were acceptable (F = [SCORE]T, L = [SCORE]T, K = [SCORE]T), supporting the interpretability of the clinical scales. No clinical scales were elevated above the threshold of clinical significance (65T). The Parenting Stress Index, Fourth Edition (PSI-4) yielded a Total Stress score at the [PERCENTILE] percentile, which falls in the normal range and suggests that [PARENT A] is managing the stresses of parenting within expected limits. The Parent-Child Relationship Inventory (PCRI) reflected relative strengths in Communication and Involvement, with no domains of concern.

Areas of concern identified for [PARENT A] include: (1) a tendency to engage in mildly disparaging remarks about [PARENT B] in the children's presence, which was reported by [CHILD] during the individual interview and confirmed by collateral contact [COLLATERAL]; and (2) difficulty distinguishing between the children's own wishes and [PARENT A]'s projections about what the children want, which was observed during the parent-child observation and is consistent with the somewhat elevated Enmeshment scale on the PCRI.

Parenting Capacity of [PARENT B]

[PARENT B] presented as a caring parent who expressed genuine concern for the children's wellbeing and articulated a desire to maintain a close relationship. [PARENT B]'s knowledge of the children's daily routines, medical needs, and school performance was adequate, though somewhat less detailed than [PARENT A]'s, which is consistent with [PARENT B]'s historically more limited time with the children rather than a lack of investment.

The MMPI-3 for [PARENT B] showed acceptable validity (F = [SCORE]T, L = [SCORE]T, K = [SCORE]T). Elevation on Scale 4 (Antisocial Behavior, [SCORE]T) was in the moderate range and is consistent with [PARENT B]'s history of interpersonal conflict and authority difficulties documented in the record. No other clinical scales reached the threshold of significance. The PSI-4 Total Stress score was at the [PERCENTILE] percentile, also within normal limits. The PCRI showed relative strength in Autonomy-granting but a lower score on Limit Setting, which aligns with both self-report and collateral observations that [PARENT B] tends toward a more permissive parenting style.

Areas of concern identified for [PARENT B] include: (1) inconsistency in exercise of parenting time, with [NUMBER] missed or truncated visits documented over the past [TIME PERIOD], attributed by [PARENT B] to work schedule conflicts; (2) the presence of [PARTNER] in the home, about whom the children expressed mixed feelings during individual interviews; and (3) difficulty managing anger during co-parent communication, documented in text message exchanges reviewed during this evaluation.

The Children's Perspective

[CHILD 1], age [AGE], was interviewed individually and presented as a verbal, socially aware child who demonstrated a strong attachment to both parents. When asked about each parent, [CHILD 1] spontaneously offered positive attributes of both and expressed a wish to spend time with each parent. [CHILD 1] was able to articulate what was enjoyable about time with each parent with age-appropriate specificity. [CHILD 1] did report feeling "in the middle" at times, stating "[QUOTE REMOVED]," which reflects an awareness of parental conflict that is developmentally inappropriate and potentially harmful.

The Child Behavior Checklist (CBCL) completed by each parent showed notable discrepancy. [PARENT A]'s ratings yielded elevations on the Anxious/Depressed and Withdrawn/Depressed syndrome scales, while [PARENT B]'s ratings were entirely within normal limits. Such cross-informant discrepancies are common in custody evaluations and may reflect differences in the children's behavior across settings, differences in parental perceptiveness or reporting bias, or some combination thereof. This discrepancy does not, by itself, indicate that either parent's ratings are invalid.

Co-Parenting Dynamics

The central challenge identified in this evaluation is not parenting capacity, both parents demonstrate adequate capacity to meet the children's basic needs, but rather the quality of the co-parenting relationship. Communication between the parents is characterized by high conflict, defensive reactivity, and a pattern of escalation documented in text messages, emails, and collateral reports. Each parent attributes the conflict primarily to the other, and each demonstrates limited insight into their own contribution to the dynamic.

This pattern of co-parenting conflict is the most significant risk factor for the children's adjustment. The research literature consistently demonstrates that ongoing interparental conflict, particularly conflict to which children are exposed, is more predictive of negative child outcomes than family structure itself (Amato, 2001; Emery, 1999; Johnston, 1994). Both parents would benefit from structured co-parenting intervention, such as the High-Conflict Parenting Program or similar evidence-based program, to develop skills in parallel parenting, communication containment, and child-centered decision-making.

PSYCHOLEGAL OPINIONS

Consistent with professional guidelines and ethical standards, this evaluator does not recommend a specific custody schedule, as such determinations are within the province of the Court. Instead, the following clinical observations are offered to inform the Court's decision:

1. Both parents demonstrate adequate parenting capacity. Neither parent presents with psychopathology or behavioral patterns that would render them unfit or constitute a risk to the children's safety.

2. The children have meaningful attachments to both parents and would benefit from maintaining substantial relationships with each.

3. The primary risk to the children's wellbeing is ongoing exposure to interparental conflict rather than any deficiency in either parent's individual parenting capacity.

4. The children's expressed preferences, while noted, should be interpreted in the context of their developmental stage and their awareness of parental conflict, which may influence their statements.

5. A structured parallel parenting framework with clearly delineated responsibilities and minimal required direct communication between the parents would likely reduce conflict exposure for the children.
`,
  },
]

// ---------------------------------------------------------------------------
// TEMPLATES, Report structure templates per evaluation type
// ---------------------------------------------------------------------------

const TEMPLATES: SeedFile[] = [
  {
    originalFilename: 'CST_Report_Template.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `COMPETENCY TO STAND TRIAL EVALUATION REPORT
[TEMPLATE]

=============================================
TITLE PAGE
=============================================
CONFIDENTIAL FORENSIC EVALUATION REPORT

Re: [Examinee Full Name]
Case Number: [Case #]
Date of Evaluation: [Date(s)]
Date of Report: [Date]

Evaluator: [Name, Degrees]
[License Type and Number]
[Board Certification if applicable]
[Professional Address]

Submitted to: [Court Name]
[Judge Name]

=============================================
1. IDENTIFYING INFORMATION
=============================================
[Full Name] is a [age]-year-old [gender] individual currently [detained at / released on bond to] [location]. Date of birth: [DOB]. Race/Ethnicity: [as self-reported].

=============================================
2. REFERRAL INFORMATION
=============================================
This evaluation was requested by [Court/Defense/Prosecution] to address the following question:

Whether the defendant has sufficient present ability to consult with [his/her/their] lawyer with a reasonable degree of rational understanding, and whether the defendant has a rational as well as factual understanding of the proceedings against [him/her/them], consistent with the standard established in Dusky v. United States, 362 U.S. 402 (1960).

Pending charges: [List charges with statute numbers]

=============================================
3. NOTIFICATION AND INFORMED CONSENT
=============================================
Prior to this evaluation, the examinee was informed of:
  (a) The nature and purpose of the evaluation
  (b) That this is not a treatment relationship
  (c) That confidentiality is limited
  (d) That a report will be submitted to the court
  (e) That the evaluator may testify
  (f) That participation does not require answering every question

The examinee [acknowledged / did not acknowledge] understanding and [agreed / declined] to proceed.

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview with examinee ([date], approximately [hours] hours)
  2. [List all records reviewed with dates]
  3. [List all collateral interviews with relationship and duration]
  4. [List all instruments administered]

=============================================
5. RELEVANT BACKGROUND HISTORY
=============================================

Psychiatric History:
[Chronological psychiatric treatment history, hospitalizations, medications]

Substance Use History:
[Substances, age of onset, pattern, treatment history]

Legal History:
[Prior charges, convictions, prior competency evaluations]

Educational / Developmental History:
[Highest education, learning disabilities, developmental milestones if relevant]

=============================================
6. MENTAL STATUS EXAMINATION
=============================================
Appearance:
Behavior:
Speech:
Mood (self-reported):
Affect (observed):
Thought Process:
Thought Content:
Perceptual Disturbances:
Cognition (orientation, attention, memory):
Insight:
Judgment:

=============================================
7. COMPETENCY ASSESSMENT INSTRUMENTS
=============================================

[Instrument Name] (Citation)
[Description of instrument and what it measures]
[Score reporting by subscale]
[Interpretation relative to normative data]

[Repeat for each instrument]

=============================================
8. FUNCTIONAL COMPETENCY ABILITIES
=============================================

Factual Understanding of Proceedings:
- Understands charges: [yes/no with basis]
- Understands possible penalties: [yes/no with basis]
- Understands roles of courtroom personnel: [yes/no with basis]
- Understands plea options: [yes/no with basis]
- Understands trial process: [yes/no with basis]

Rational Understanding of Proceedings:
- Appreciates own legal situation: [yes/no with basis]
- Does not exhibit delusional distortion of proceedings: [yes/no with basis]
- Can weigh options rationally: [yes/no with basis]

Ability to Assist Counsel:
- Can communicate coherently: [yes/no with basis]
- Can sustain attention: [yes/no with basis]
- Can provide relevant information about the alleged offense: [yes/no with basis]
- Can participate in decision-making: [yes/no with basis]

=============================================
9. DIAGNOSTIC IMPRESSIONS
=============================================
[DSM-5-TR diagnosis with code]
[Supporting rationale]
[Differential diagnoses considered and ruled out]

=============================================
10. PSYCHOLEGAL OPINIONS
=============================================
It is this evaluator's opinion, within reasonable psychological certainty, that [Name]:

1. [Does / Does not] have sufficient factual understanding of the proceedings.
   Basis: [Specific data supporting this conclusion]

2. [Does / Does not] have rational understanding of the proceedings.
   Basis: [Specific data supporting this conclusion]

3. [Does / Does not] have sufficient ability to assist counsel.
   Basis: [Specific data supporting this conclusion]

Overall opinion: [Name] is [COMPETENT / NOT COMPETENT] to stand trial at this time.

[If incompetent: Opinion on restorability, recommended restoration setting, estimated timeline]

=============================================
11. LIMITATIONS
=============================================
[Standard limitations language: snapshot in time, medication contingency, new information caveat]

=============================================
12. SIGNATURE
=============================================
[Attestation statement]

_______________________________
[Name, Degrees]
[License]
[Board Certification]
[Date]
[Contact Information]
`,
  },
  {
    originalFilename: 'Custody_Evaluation_Template.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `CHILD CUSTODY EVALUATION REPORT
[TEMPLATE, AFCC Model Standards Compliant]

=============================================
TITLE PAGE
=============================================
CONFIDENTIAL CHILD CUSTODY EVALUATION

In the Matter of: [Case Caption]
Case Number: [Case #]
Court: [Court Name, Division]

Evaluation Period: [Start Date] through [End Date]
Date of Report: [Date]

Evaluator: [Name, Degrees]
[License Type and Number]
[Board Certification]
[Professional Address]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Parent A: [Name], DOB [DATE], age [age]
Parent B: [Name], DOB [DATE], age [age]
Child(ren):
  - [Name], DOB [DATE], age [age], grade [grade]
  - [Name], DOB [DATE], age [age], grade [grade]

=============================================
2. REFERRAL AND COURT ORDER
=============================================
This evaluation was ordered by [Court] pursuant to [Order/Stipulation dated DATE]. The Court has requested that this evaluator address the following:
  (a) [Specific question 1]
  (b) [Specific question 2]
  (c) [Specific question 3]

=============================================
3. INFORMED CONSENT AND CONFIDENTIALITY
=============================================
All parties were informed that:
  (a) This is not a treatment relationship
  (b) The evaluator serves as an objective expert
  (c) Information from one party may be shared with the other
  (d) The report will be provided to the Court and counsel
  (e) The evaluator may testify
All parties acknowledged understanding and agreed to participate.

=============================================
4. SOURCES OF INFORMATION
=============================================
Parent A:
  - Individual interview(s): [dates, total hours]
  - Psychological testing: [instruments]
  - Home visit: [date, duration]

Parent B:
  - Individual interview(s): [dates, total hours]
  - Psychological testing: [instruments]
  - Home visit: [date, duration]

Children:
  - Individual interview(s): [dates, total hours per child]
  - [Testing instruments if administered]

Parent-Child Observations:
  - [Parent A] with children: [date, duration, setting]
  - [Parent B] with children: [date, duration, setting]

Collateral Contacts:
  - [Name, relationship, date, duration, for each contact]

Records Reviewed:
  - [Comprehensive list of all documents reviewed]

=============================================
5. BACKGROUND, PARENT A
=============================================
Personal History:
Relationship History:
Parenting History and Philosophy:
Employment and Financial Situation:
Mental Health History:
Substance Use History:
Legal History:
Current Living Situation:
Parenting Strengths Identified:
Areas of Concern Identified:

=============================================
6. BACKGROUND, PARENT B
=============================================
[Same structure as Parent A, parallel format required]

=============================================
7. BACKGROUND, CHILDREN
=============================================
[For each child:]
Developmental History:
Educational Functioning:
Social Functioning:
Emotional/Behavioral Functioning:
Health:
Expressed Preferences (with developmental context):
Observed Attachment Behaviors:

=============================================
8. MENTAL STATUS EXAMINATIONS
=============================================
Parent A MSE:
[Standard MSE categories]

Parent B MSE:
[Standard MSE categories]

=============================================
9. PSYCHOLOGICAL TESTING RESULTS
=============================================

Parent A:
[Instrument, Validity indicators, Clinical scales, Interpretation]

Parent B:
[Instrument, Validity indicators, Clinical scales, Interpretation]

Children (if tested):
[Instrument, scores, interpretation]

Cross-informant analysis:
[Compare CBCL/TRF ratings across informants]

=============================================
10. PARENT-CHILD OBSERVATIONS
=============================================
[Parent A] with children:
[Detailed behavioral observations, warmth, responsiveness, limit-setting, child's behavior]

[Parent B] with children:
[Detailed behavioral observations, parallel structure]

=============================================
11. DIAGNOSTIC IMPRESSIONS
=============================================
Parent A: [Diagnoses or "No diagnosis warranted"]
Parent B: [Diagnoses or "No diagnosis warranted"]
Children: [Diagnoses or adjustment concerns if applicable]

=============================================
12. CLINICAL FORMULATION
=============================================
[Integration of all data addressing:]
  - Parenting capacity of each parent
  - Children's developmental needs
  - Attachment patterns
  - Co-parenting dynamics
  - Risk and protective factors
  - Impact of conflict on children

=============================================
13. PSYCHOLEGAL OPINIONS
=============================================
[Address each court-ordered question individually]

Question (a): [Restate question]
Opinion: [Clinical observations that inform this question]
Basis: [Specific data sources supporting this observation]

[Repeat for each question]

Note: Specific custody schedule recommendations are within the province of the Court. The above clinical observations are offered to inform the Court's determination regarding the best interests of the children.

=============================================
14. RECOMMENDATIONS
=============================================
  1. [Therapy, co-parenting program, etc.]
  2. [Specific to identified concerns]
  3. [Re-evaluation timeline if applicable]

=============================================
15. LIMITATIONS
=============================================
[Standard limitations]

=============================================
16. SIGNATURE AND ATTESTATION
=============================================
[Attestation statement]

_______________________________
[Name, Degrees]
[License, Board Certification]
[Date]
`,
  },
  {
    originalFilename: 'Risk_Assessment_Template.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `VIOLENCE RISK ASSESSMENT REPORT
[TEMPLATE, Structured Professional Judgment Framework]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Name: [Full Name]
DOB: [Date]  |  Age: [age]
Gender: [Gender]
Referral Source: [Source]
Type of Risk Assessed: [General violence / Sexual violence / Intimate partner / Stalking]
Date(s) of Evaluation: [Dates]
Date of Report: [Date]

=============================================
2. REFERRAL QUESTION
=============================================
[Who requested the evaluation and what specific risk question is being addressed]
[Legal context: sentencing, parole, civil commitment, treatment planning]

=============================================
3. CONFIDENTIALITY NOTICE
=============================================
[Standard forensic confidentiality notice]

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview: [date, duration]
  2. Criminal records: [jurisdictions, date range]
  3. Institutional records: [facility, date range]
  4. Prior risk assessments: [evaluator, date]
  5. Collateral interviews: [name, relationship, date]
  6. Risk assessment instruments administered: [list]
  7. Psychological testing: [list]

=============================================
5. RELEVANT HISTORY
=============================================

Violence History (chronological):
[Date] - [Incident description, severity, context, outcome]
[Date] - [Repeat for each documented incident]

Pattern Analysis:
  - Predominant type: [Reactive / Instrumental / Mixed]
  - Typical triggers: [List identified triggers]
  - Typical targets: [Strangers / Acquaintances / Intimate partners / Authority figures]
  - Escalation pattern: [Describe]
  - Weapons involvement: [Describe]

Substance Use History:
[With specific attention to co-occurrence with violent episodes]

Mental Health History:
[Diagnoses, treatment, medication adherence, symptom-violence relationship]

Relationship History:
[Stability, conflict patterns, IPV history]

Employment History:
[Stability, disciplinary issues]

Institutional Behavior:
[Disciplinary record, program participation, infractions]

=============================================
6. MENTAL STATUS EXAMINATION
=============================================
[Standard MSE]

=============================================
7. PSYCHOLOGICAL TESTING
=============================================
[Personality assessment with attention to:]
  - Antisocial features
  - Psychopathic traits
  - Anger/hostility
  - Impulsivity
  - Substance abuse indicators
  - Validity/response style

=============================================
8. RISK ASSESSMENT INSTRUMENTS
=============================================

[Instrument Name] (Citation)
Purpose: [What the instrument assesses]
Structure: [Number of items, scales]

Item-level results:
[Present each item with rating and supporting data]

Summary: [Overall characterization based on instrument]

[Repeat for each instrument: HCR-20 V3, PCL-R, VRAG-R, STATIC-99R, etc.]

=============================================
9. RISK FACTORS IDENTIFIED
=============================================

Static Risk Factors (historical, unchangeable):
  - [Factor]: [Present/Absent], [Supporting data]

Dynamic Risk Factors (potentially changeable):
  - [Factor]: [Current status], [Supporting data]

Protective Factors:
  - [Factor]: [Current status], [Supporting data]

=============================================
10. RISK FORMULATION
=============================================
[Narrative integration of all risk and protective factors]
[Identification of key drivers of risk]
[Plausible violence scenarios]
[Temporal considerations]

=============================================
11. RISK MANAGEMENT RECOMMENDATIONS
=============================================
  1. [Supervision level]
  2. [Treatment targets, substance use, mental health, anger management]
  3. [Monitoring requirements]
  4. [Conditions that would indicate escalating risk]
  5. [Re-assessment timeline]

=============================================
12. PSYCHOLEGAL OPINION ON RISK LEVEL
=============================================
Based on the structured professional judgment approach:

Overall Risk Level: [LOW / MODERATE / HIGH]

This opinion applies to: [Specific scenario, e.g., community release with supervision]
Temporal scope: [Time frame, e.g., over the next 12 months under described conditions]

Risk-elevating factors: [Summary]
Risk-mitigating factors: [Summary]

[Explicitly state: risk is probabilistic, conditions may change, re-assessment warranted if circumstances change]

=============================================
13. LIMITATIONS
=============================================
[Standard limitations + specific to risk assessment:
  - Risk assessment is probabilistic, not predictive
  - Conditions may change
  - Assessment reflects point-in-time judgment
  - No instrument can predict with certainty]

=============================================
14. SIGNATURE
=============================================
[Attestation statement]
[Signature block]
`,
  },
  {
    originalFilename: 'PTSD_Personal_Injury_Template.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `PSYCHOLOGICAL EVALUATION, PERSONAL INJURY / PTSD CLAIM
[TEMPLATE]

=============================================
1. IDENTIFYING INFORMATION
=============================================
Examinee: [Name]
DOB: [Date]  |  Age: [age]
Date of Claimed Incident: [Date]
Date(s) of Evaluation: [Date(s)]
Referral Source: [Attorney name, representing Plaintiff/Defendant]
Case: [Case caption and number]

=============================================
2. REFERRAL QUESTIONS
=============================================
  (a) Does the examinee meet diagnostic criteria for PTSD or other psychological disorder?
  (b) If so, is the diagnosed condition causally related to the claimed incident?
  (c) What is the examinee's current level of functional impairment?
  (d) What is the prognosis, with and without treatment?
  (e) Were there pre-existing psychological conditions?

=============================================
3. CONFIDENTIALITY NOTICE
=============================================
[Standard forensic notice, note: retained by [Plaintiff/Defense] counsel]

=============================================
4. SOURCES OF INFORMATION
=============================================
  1. Clinical interview: [date, duration]
  2. Pre-incident medical/mental health records: [list with dates]
  3. Post-incident treatment records: [list with dates]
  4. Employment records: [if applicable]
  5. Incident report / police report: [date]
  6. Deposition transcripts: [if applicable]
  7. Collateral interview: [name, relationship, date]
  8. Psychological testing: [list all instruments]

=============================================
5. PRE-INCIDENT BASELINE
=============================================
Mental Health History (pre-incident):
[Prior diagnoses, treatment, medications, hospitalizations]

Functional Baseline:
  - Employment: [Job, performance, attendance]
  - Relationships: [Quality, stability]
  - Social functioning: [Activities, engagement]
  - Physical health: [Relevant conditions]
  - Prior trauma exposure: [List with dates]

=============================================
6. INCIDENT DESCRIPTION
=============================================
[Examinee's account of the incident]
[Corroborating documentation]
[Discrepancies between accounts, if any]

=============================================
7. POST-INCIDENT COURSE
=============================================
Symptom Onset: [Timeline relative to incident]
Treatment Sought: [When, where, by whom]
Treatment Received: [Type, duration, response]
Current Symptoms: [Detailed current presentation]

Functional Impact:
  - Employment: [Changes since incident]
  - Relationships: [Changes since incident]
  - Daily activities: [Changes since incident]
  - Sleep: [Changes since incident]
  - Avoidance behaviors: [Specific examples]

=============================================
8. MENTAL STATUS EXAMINATION
=============================================
[Standard MSE with attention to trauma-related observations]

=============================================
9. PSYCHOLOGICAL TESTING, VALIDITY
=============================================
[MUST appear before substantive test results]

Performance Validity:
  - TOMM Trial 1: [Score]/50  Trial 2: [Score]/50  (Cutoff: 45)
  - [Other PVT results]

Symptom Validity:
  - SIMS Total: [Score] (Cutoff: >14)
  - MMPI-3 F: [Score]T  Fp: [Score]T  FBS: [Score]T
  - [Other SVT results]

Interpretation: [Credible / Non-credible / Mixed, with specific basis]

=============================================
10. PSYCHOLOGICAL TESTING, SUBSTANTIVE
=============================================

PTSD-Specific Measures:
  - CAPS-5 Total: [Score] (Threshold: 33)
    Cluster B (Intrusion): [Score]
    Cluster C (Avoidance): [Score]
    Cluster D (Cognition/Mood): [Score]
    Cluster E (Arousal): [Score]
  - PCL-5 Total: [Score] (Cutoff: 31-33)

Personality/Broad Assessment:
  - MMPI-3: [Validity + clinical scale profile]
  - [Other instruments]

Functional Assessment:
  - [Instruments measuring functional impairment]

=============================================
11. DIAGNOSTIC IMPRESSIONS
=============================================
  (a) Current diagnosis: [DSM-5-TR with code and specifiers]
  (b) Diagnostic criteria met: [Map symptoms to specific criteria]
  (c) Pre-existing conditions: [Diagnoses present before incident]
  (d) Differential diagnoses considered: [And basis for ruling out]
  (e) Validity and effort considerations: [Impact on diagnostic confidence]

=============================================
12. CAUSATION ANALYSIS
=============================================
  (a) Temporal relationship: [Symptom onset relative to incident]
  (b) Pre-existing vulnerability vs. new condition: [Analysis]
  (c) Intervening stressors: [Other events that may contribute]
  (d) Dose-response: [Severity of incident relative to symptom severity]
  (e) Causal opinion: [Within reasonable psychological certainty]

=============================================
13. FUNCTIONAL IMPAIRMENT
=============================================
[Quantified where possible: work days missed, income impact, relationship changes, activity restriction]

=============================================
14. PROGNOSIS
=============================================
  - With appropriate treatment: [Expected course and timeline]
  - Without treatment: [Expected course]
  - Treatment recommendations: [Specific modalities, estimated duration]

=============================================
15. LIMITATIONS
=============================================
[Standard limitations + retrospective assessment caveat, self-report reliance, time elapsed]

=============================================
16. SIGNATURE
=============================================
[Attestation + compensation disclosure per Fed. R. Civ. P. 26]
`,
  },
]

// ---------------------------------------------------------------------------
// DOCUMENTATION, Reference materials
// ---------------------------------------------------------------------------

const DOCUMENTATION: SeedFile[] = [
  {
    originalFilename: 'DSM-5-TR_Forensic_Quick_Reference.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `DSM-5-TR FORENSIC QUICK REFERENCE
Commonly Encountered Diagnoses in Forensic Evaluation

Last Updated: 2026

=============================================
PSYCHOTIC SPECTRUM DISORDERS
=============================================

Schizophrenia (F20.x)
  - Key Criteria: 2+ of: delusions, hallucinations, disorganized speech, disorganized/catatonic behavior, negative symptoms. At least 1 must be delusions, hallucinations, or disorganized speech. Duration ≥6 months with ≥1 month active symptoms.
  - Forensic Relevance: Most common diagnosis in CST evaluations involving psychosis. Address current symptom status, medication response, impact on each Dusky prong separately.
  - Common Specifiers: First episode vs. multiple episodes; currently in acute episode, partial remission, or full remission.

Schizoaffective Disorder (F25.x)
  - Key Criteria: Concurrent mood episode (Major Depressive or Manic) with Criterion A symptoms of schizophrenia. Delusions or hallucinations for ≥2 weeks in absence of major mood episode during lifetime duration.
  - Forensic Relevance: Requires careful differentiation from Schizophrenia with comorbid mood disorder and from Bipolar I with psychotic features. Longitudinal course is the distinguishing factor.
  - Subtypes: Bipolar type (F25.0) vs. Depressive type (F25.1)

Brief Psychotic Disorder (F23)
  - Key Criteria: ≥1 of delusions, hallucinations, disorganized speech, grossly disorganized/catatonic behavior. Duration 1 day to <1 month with full return to premorbid functioning.
  - Forensic Relevance: May be relevant in cases involving acute stress response at time of offense. Address temporal relationship between psychotic episode and alleged offense.

=============================================
MOOD DISORDERS
=============================================

Major Depressive Disorder (F32.x / F33.x)
  - Forensic Relevance: Common in personal injury claims, disability evaluations. Must differentiate from adjustment disorder, bereavement, and malingered depression. Validity testing critical in litigation context.
  - Key Forensic Consideration: Severity specifier (mild/moderate/severe) directly impacts functional impairment opinions.

Bipolar I Disorder (F31.x)
  - Forensic Relevance: Manic episodes may be relevant to CST (impaired judgment, grandiosity affecting cooperation with counsel), risk assessment (impulsivity during mania), and criminal responsibility.
  - Key Forensic Consideration: Distinguish between behavior during episode vs. interepisode functioning. Current episode specifier is critical.

=============================================
TRAUMA AND STRESSOR-RELATED DISORDERS
=============================================

Posttraumatic Stress Disorder (F43.10)
  - Criterion A: Exposure to actual or threatened death, serious injury, or sexual violence (direct, witnessed, learned about close person, repeated professional exposure)
  - Criterion B: Intrusion symptoms (≥1 required)
  - Criterion C: Avoidance (≥1 required)
  - Criterion D: Negative cognitions and mood (≥2 required)
  - Criterion E: Arousal and reactivity (≥2 required)
  - Duration: >1 month
  - Forensic Relevance: Primary diagnosis in personal injury/tort claims. MUST assess with structured instrument (CAPS-5). MUST include validity testing (SIMS, TOMM, MMPI F-family). Address Criterion A gateway carefully, not every distressing event qualifies.
  - Specifiers: With dissociative symptoms (depersonalization/derealization); With delayed expression (≥6 months)

Acute Stress Disorder (F43.0)
  - Forensic Relevance: May apply in immediate aftermath evaluations. Duration 3 days to 1 month after trauma. Does not require same cluster structure as PTSD.

Adjustment Disorder (F43.2x)
  - Forensic Relevance: Important differential in personal injury cases where stressor does not meet PTSD Criterion A. Less severe impairment. Must resolve within 6 months of stressor termination.

=============================================
SUBSTANCE USE DISORDERS
=============================================

General Framework:
  - Mild: 2-3 criteria
  - Moderate: 4-5 criteria
  - Severe: 6+ criteria
  - Specifiers: In early remission (3-12 mo), in sustained remission (>12 mo), on maintenance therapy, in a controlled environment

Alcohol Use Disorder (F10.x0)
  - Forensic Relevance: Relevant to risk assessment (disinhibition), CST (chronic cognitive effects), criminal responsibility (voluntary intoxication), custody (parenting capacity).

Cannabis Use Disorder (F12.x0)
  - Forensic Relevance: Increasingly relevant as legalization creates tension between legal status and clinical impact. Address cognitive effects during active use.

Stimulant Use Disorder (F15.x0 cocaine; F15.x0 amphetamine)
  - Forensic Relevance: Stimulant-induced psychosis mimics primary psychotic disorders. Time course is critical, stimulant psychosis typically resolves within days to weeks of cessation.

=============================================
NEURODEVELOPMENTAL DISORDERS
=============================================

Intellectual Disability (F7x)
  - Classification: Mild (F70), Moderate (F71), Severe (F72), Profound (F73)
  - Forensic Relevance: Directly relevant to CST (Dusky capacities), criminal responsibility (mens rea), Atkins v. Virginia (2002) for capital cases, Miranda waiver capacity.
  - Assessment: Requires BOTH (1) intellectual deficits on standardized testing AND (2) adaptive functioning deficits. IQ alone is insufficient.

ADHD (F90.x)
  - Forensic Relevance: May affect impulse control, risk behavior, substance use. Consider as context factor, rarely central to psycholegal question.

=============================================
PERSONALITY DISORDERS
=============================================

Antisocial Personality Disorder (F60.2)
  - Key Criteria: Age ≥18, evidence of conduct disorder onset before age 15, pervasive pattern of disregard for rights of others (≥3 criteria since age 15)
  - Forensic Relevance: Relevant to risk assessment, not appropriate as sole basis for civil commitment in most jurisdictions. PCL-R measures related but distinct construct (psychopathy).
  - IMPORTANT: Do not conflate with psychopathy. A person can meet ASPD criteria without elevated PCL-R scores, and vice versa.

Borderline Personality Disorder (F60.3)
  - Forensic Relevance: May affect credibility assessments, stalking/harassment cases, custody evaluations (emotional dysregulation impact on parenting).

=============================================
NEUROCOGNITIVE DISORDERS
=============================================

Major Neurocognitive Disorder (F02.x)
  - Forensic Relevance: Central to testamentary capacity, financial capacity, guardianship evaluations. Requires documented cognitive decline from premorbid level AND functional impairment.
  - Key: Must specify suspected etiology (Alzheimer's, vascular, Lewy body, etc.)

Mild Neurocognitive Disorder (F06.7x)
  - Forensic Relevance: Capacity may be preserved. Decision-specific and time-specific capacity assessment required.

=============================================
MALINGERING (V65.2 / Z76.5)
=============================================
  - NOT a mental disorder, listed in "Other Conditions That May Be a Focus of Clinical Attention"
  - DSM-5-TR guidance: Suspect when (1) medicolegal context, (2) marked discrepancy between claimed distress and objective findings, (3) lack of cooperation, (4) presence of ASPD
  - NEVER use as standalone label. Specify: malingered cognitive deficits, malingered psychiatric symptoms, malingered somatic complaints
  - Base on converging evidence from multiple validity indicators, not a single test score
`,
  },
  {
    originalFilename: 'Colorado_CST_Statute_Reference.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `COLORADO COMPETENCY TO STAND TRIAL, STATUTORY REFERENCE
C.R.S. § 16-8.5-101 through 16-8.5-116

Compiled for forensic evaluation practice reference.
This is a practice summary, not legal advice. Verify current statute text.

=============================================
KEY DEFINITIONS (§ 16-8.5-101)
=============================================

"Competent to proceed" means that a defendant does not have a mental disability or developmental disability that renders the defendant incapable of:
  (a) Understanding the nature and course of the proceedings against the defendant; or
  (b) Participating or assisting in the defense; or
  (c) Cooperating with defense counsel.

"Mental disability" means a substantial disorder of thought, mood, perception, or cognitive ability that results in marked functional disability.

=============================================
RAISING THE QUESTION (§ 16-8.5-102)
=============================================

The question of competency may be raised by the court, prosecution, or defense at any time after charges are filed. Good faith doubt about competency triggers mandatory evaluation.

=============================================
EVALUATION REQUIREMENTS (§ 16-8.5-103)
=============================================

Court shall appoint one or more qualified experts to examine the defendant.

Qualified evaluator must be:
  - Licensed psychologist or psychiatrist
  - Completed forensic evaluation training approved by the Department
  - In some cases, provisionally licensed clinicians under supervision

Evaluation must be completed within:
  - 30 days if defendant is in custody
  - 60 days if defendant is out of custody
  - Extensions may be granted for good cause

=============================================
REPORT REQUIREMENTS (§ 16-8.5-104)
=============================================

Written report must include:
  (a) Description of evaluation procedures
  (b) Diagnosis, if any, with DSM criteria met
  (c) Clinical findings specific to each competency prong:
      - Understanding of nature and course of proceedings
      - Ability to participate/assist in defense
      - Ability to cooperate with counsel
  (d) Opinion on competency
  (e) If incompetent: opinion on restorability and timeframe
  (f) If incompetent: recommended placement (outpatient vs. inpatient)
  (g) Any medications being taken and their effects

=============================================
COMPETENCY HEARING (§ 16-8.5-105)
=============================================

Burden of proof: Preponderance of the evidence
Burden falls on: The party raising the issue

If found competent: Case proceeds.
If found incompetent: Court considers restoration.

=============================================
RESTORATION (§ 16-8.5-111)
=============================================

Restoration services may be provided:
  - Outpatient (community-based), preferred when appropriate
  - Inpatient (state hospital), when community setting insufficient

Maximum restoration period:
  - Misdemeanor: 91 days
  - Felony (non-violent): 1 year
  - Felony (violent): 3 years

Court must review progress every 90 days.

If not restored within maximum period:
  - Charges dismissed OR
  - Civil commitment proceedings initiated

=============================================
MEDICATION OVER OBJECTION (§ 16-8.5-112)
=============================================

Involuntary medication for restoration purposes requires:
  - Sell v. United States (2003) hearing
  - Government must demonstrate:
    (1) Important governmental interest at stake
    (2) Medication is substantially likely to render defendant competent
    (3) Medication is substantially unlikely to have side effects undermining fairness
    (4) Less intrusive alternatives have been considered

=============================================
EVALUATOR PRACTICE NOTES
=============================================

1. Always address ALL THREE prongs separately, even if one clearly resolves the question.
2. Colorado uses "competent to proceed" language, not "competent to stand trial."
3. Report must be filed with court and copies provided to both prosecution and defense.
4. Evaluator may be called to testify, prepare for both direct and cross.
5. If defendant refuses to participate: document refusal, base opinion on available data, note limitations.
6. Consider cultural and linguistic factors, interpreter use must be documented.
7. The evaluation is point-in-time. If medication changes between evaluation and hearing, note this in testimony.
`,
  },
  {
    originalFilename: 'Dusky_Standard_and_Key_Case_Law.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `KEY CASE LAW FOR FORENSIC PSYCHOLOGY PRACTICE
Quick Reference for Evaluation and Testimony

=============================================
COMPETENCY TO STAND TRIAL
=============================================

Dusky v. United States, 362 U.S. 402 (1960)
  Standard: Whether the defendant has "sufficient present ability to consult with his lawyer with a reasonable degree of rational understanding" and whether he has "a rational as well as factual understanding of the proceedings against him."
  Two prongs: (1) Ability to consult with counsel; (2) Understanding of proceedings (both factual AND rational).
  Key: "Present ability", competency is assessed at the time of proceedings, not at time of offense.

Drope v. Missouri, 420 U.S. 162 (1975)
  Expanded Dusky: Added that the defendant must have "the ability to assist in preparing his defense." Effectively creates a third prong in some jurisdictions.
  Key: Failure to conduct a competency evaluation when facts raise a bona fide doubt violates due process.

Godinez v. Moran, 509 U.S. 389 (1993)
  The Dusky standard applies to all stages of criminal proceedings, including guilty pleas and waiver of counsel. No heightened competency standard required.

Indiana v. Edwards, 554 U.S. 164 (2008)
  States may require a higher standard of competency for self-representation than for standing trial. A defendant may be competent to stand trial with counsel but not competent to represent themselves.

Cooper v. Oklahoma, 517 U.S. 348 (1996)
  Burden of proof for incompetency: preponderance of the evidence (states may not require clear and convincing evidence).

=============================================
CRIMINAL RESPONSIBILITY / INSANITY
=============================================

M'Naghten's Case (1843), England
  "At the time of committing the act, the party accused was laboring under such a defect of reason, from disease of the mind, as not to know the nature and quality of the act he was doing, or if he did know it, that he did not know he was doing what was wrong."
  Still used in many U.S. jurisdictions.

Clark v. Arizona, 548 U.S. 735 (2006)
  States may limit the insanity defense to the M'Naghten standard (knowledge of wrongfulness only) without violating due process.

=============================================
EXPERT TESTIMONY ADMISSIBILITY
=============================================

Daubert v. Merrell Dow Pharmaceuticals, 509 U.S. 579 (1993)
  Federal standard for scientific expert testimony. Court acts as gatekeeper. Considers:
    (1) Whether theory/technique can be and has been tested
    (2) Whether it has been subjected to peer review and publication
    (3) Known or potential rate of error
    (4) General acceptance in the relevant scientific community
  Key for forensic psychology: Use validated instruments. Document methodology. Make reasoning explicit.

Frye v. United States, 293 F. 1013 (D.C. Cir. 1923)
  "General acceptance" test. Still used in some state courts (CA, NY, IL, others). Expert testimony must be based on scientific methods that are "generally accepted" in the relevant field.

Kumho Tire Co. v. Carmichael, 526 U.S. 137 (1999)
  Extended Daubert to all expert testimony, not just scientific experts. Clinical opinion testimony is also subject to reliability scrutiny.

=============================================
INTELLECTUAL DISABILITY / CAPITAL CASES
=============================================

Atkins v. Virginia, 536 U.S. 304 (2002)
  Execution of intellectually disabled persons violates the Eighth Amendment. States set their own procedures for determining intellectual disability.

Hall v. Florida, 572 U.S. 701 (2014)
  States may not use a strict IQ cutoff of 70 to determine intellectual disability. Must consider the standard error of measurement (SEM). An IQ score of 75 with SEM of 5 means the true score could be 70.

Moore v. Texas, 581 U.S. 1 (2017)
  Clinical standards (AAIDD, APA) must inform the determination, not outdated stereotypes or lay stereotypes of intellectual disability.

=============================================
RISK ASSESSMENT
=============================================

Kansas v. Hendricks, 521 U.S. 346 (1997)
  Sexually violent predator (SVP) civil commitment requires a "mental abnormality" that makes the person likely to engage in predatory acts of sexual violence. Not limited to DSM diagnoses.

Kansas v. Crane, 534 U.S. 407 (2002)
  SVP commitment requires proof that the individual has "serious difficulty" controlling behavior, not complete inability to control behavior.

Barefoot v. Estelle, 463 U.S. 880 (1983)
  Expert testimony on future dangerousness is admissible despite acknowledged limitations in predictive accuracy. However, cross-examination can expose those limitations.
  Note: This case is widely criticized. Evaluation practice has evolved substantially since 1983 with SPJ instruments.

=============================================
MIRANDA AND CONFESSIONS
=============================================

Miranda v. Arizona, 384 U.S. 436 (1966)
  Custodial interrogation requires warnings. Waiver must be knowing, intelligent, and voluntary.
  Forensic relevance: Evaluate whether a defendant's mental state (intellectual disability, psychosis, intoxication) rendered Miranda waiver invalid.

Colorado v. Connelly, 479 U.S. 157 (1986)
  Coercive police conduct is a necessary predicate for involuntary confession. Mental illness alone does not make a confession involuntary.

=============================================
CUSTODY EVALUATION
=============================================

Troxel v. Granville, 530 U.S. 57 (2000)
  Fit parents have a fundamental right to make decisions concerning the care, custody, and control of their children. Court orders overriding a fit parent's decision must receive special weight.

AFCC Model Standards for Child Custody Evaluation (2006)
  Not case law but the professional standard of care. Evaluators should be familiar with these standards and follow them.
`,
  },
  {
    originalFilename: 'Test_Battery_Selection_Guide.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `FORENSIC TEST BATTERY SELECTION GUIDE
By Evaluation Type, Instruments, Purpose, and Norming Notes

=============================================
UNIVERSAL: PERFORMANCE & SYMPTOM VALIDITY
=============================================
ALWAYS administer validity testing FIRST, report BEFORE substantive results.

Performance Validity Tests (PVT):
  - TOMM (Test of Memory Malingering): Trial 1, Trial 2, Retention. Cutoff: <45 on Trial 2.
  - MSVT (Medical Symptom Validity Test): Immediate, Delayed, Consistency. Cutoff varies by index.
  - WMT (Word Memory Test): Immediate, Delayed, Consistency. Published cutoffs.
  - b Test: Cutoff: <15 errors.
  - RDS (Reliable Digit Span from WAIS-IV): Cutoff: ≤7.

Symptom Validity Tests (SVT):
  - SIMS (Structured Inventory of Malingered Symptomatology): Total >14 suggests feigning.
  - M-FAST (Miller Forensic Assessment of Symptoms Test): Total >6 warrants further assessment.
  - MMPI-3 Validity Scales: F, Fp, FBS, RBS, Fs. Interpret as configuration, not individual scales.

=============================================
COMPETENCY TO STAND TRIAL
=============================================

Primary Competency Instruments:
  - MacCAT-CA (MacArthur Competence Assessment Tool, Criminal Adjudication)
    Subscales: Understanding (0-16), Reasoning (0-16), Appreciation (0-6)
    Norms: Clinical and community samples. Interpret by subscale, not total.

  - ECST-R (Evaluation of Competency to Stand Trial, Revised)
    Subscales: Consult with Counsel, Factual Understanding, Rational Understanding
    Also includes: Atypical Presentation scales (detect feigned incompetency)

  - CAST*MR (Competence Assessment for Standing Trial for Defendants with Mental Retardation)
    Use ONLY when intellectual disability is suspected. Simplified language.

Supplemental:
  - WAIS-IV/WAIS-V (if cognitive deficits suspected)
  - MMPI-3 or PAI (personality and psychopathology)
  - MoCA or MMSE (brief cognitive screening)

=============================================
CHILD CUSTODY
=============================================

Parent Assessment:
  - MMPI-3 (Minnesota Multiphasic Personality Inventory-3)
    568 items. Validity + Clinical + PSY-5 + RC scales. Gold standard for custody.
    Note: MMPI-2 still widely used but MMPI-3 is current edition.

  - PAI (Personality Assessment Inventory)
    344 items. Alternative to MMPI when reading level is concern (4th grade vs. 6th).
    Validity: ICN, INF, NIM, PIM. Clinical: 11 scales.

  - MCMI-IV (Millon Clinical Multiaxial Inventory-IV)
    Use cautiously in custody, designed for clinical populations, not general population.
    High false positive rate for personality disorders in custody litigants.

  - PSI-4 (Parenting Stress Index, 4th Edition)
    120 items. Measures parenting stress across domains.

  - PCRI (Parent-Child Relationship Inventory)
    78 items. Measures parenting attitudes and relationship quality.
    Scales: Support, Satisfaction, Involvement, Communication, Limit Setting, Autonomy, Role Orientation

Child Assessment:
  - CBCL (Child Behavior Checklist, Achenbach System)
    Parent-report (CBCL), Teacher-report (TRF), Youth self-report (YSR 11-18).
    Cross-informant comparison is critical in custody cases.

  - Sentence Completion (age-appropriate version)
  - Kinetic Family Drawing (projective, use with caution, limited psychometric support)
  - ASPECT (Ackerman-Schoendorf Scales for Parent Evaluation of Custody)

=============================================
VIOLENCE RISK ASSESSMENT
=============================================

General Violence:
  - HCR-20 V3 (Historical-Clinical-Risk Management-20, Version 3)
    20 items across H (10), C (5), R (5) scales. SPJ framework.
    NOT actuarial, generates low/moderate/high judgment, not probability.

  - PCL-R (Psychopathy Checklist, Revised)
    20 items, semi-structured interview + file review. Total score 0-40.
    Factor 1: Interpersonal/Affective. Factor 2: Lifestyle/Antisocial.
    Clinical threshold: 30 (North America). Research cutoff only, NOT diagnostic.
    IMPORTANT: Requires specific training. Administration time ~3 hours.

  - VRAG-R (Violence Risk Appraisal Guide, Revised)
    Actuarial instrument. 12 items. Generates probability estimate.
    Use in conjunction with SPJ, not alone.

Sexual Violence:
  - STATIC-99R: Actuarial, 10 items (static factors only). Risk categories.
  - SVR-20 (Sexual Violence Risk-20): SPJ framework.
  - STABLE-2007 / ACUTE-2007: Dynamic risk factors for ongoing monitoring.

Intimate Partner Violence:
  - SARA (Spousal Assault Risk Assessment Guide): 20-item SPJ.
  - DVSI-R (Domestic Violence Screening Instrument, Revised)
  - ODARA (Ontario Domestic Assault Risk Assessment): Actuarial, 13 items.

Stalking:
  - SAM (Stalking Assessment and Management): SPJ framework.

=============================================
PTSD / PERSONAL INJURY
=============================================

PTSD-Specific:
  - CAPS-5 (Clinician-Administered PTSD Scale for DSM-5)
    Gold standard structured interview. 30 items. Maps directly to DSM-5 criteria.
    Severity score 0-80. Diagnostic threshold: 33 (recommended).
    REQUIRED in forensic PTSD evaluation, self-report alone is insufficient.

  - PCL-5 (PTSD Checklist for DSM-5)
    20-item self-report. Screening/monitoring, not diagnostic alone.
    Cutoff: 31-33 (varies by population).

  - TSI-2 (Trauma Symptom Inventory-2)
    136 items. 12 clinical scales. Includes validity scales (ATR, RL, INC).
    Broader trauma symptoms beyond PTSD.

Supplemental:
  - MMPI-3 (critical for validity assessment in litigation context)
  - BDI-2 (Beck Depression Inventory-II), comorbid depression
  - BAI (Beck Anxiety Inventory), comorbid anxiety
  - Functional assessment instruments as appropriate

=============================================
TESTAMENTARY / DECISIONAL CAPACITY
=============================================

Cognitive Screening:
  - MoCA (Montreal Cognitive Assessment): 30 points. <26 suggests impairment.
  - MMSE (Mini-Mental State Examination): 30 points. Well-known but ceiling effects.
  - SLUMS (Saint Louis University Mental Status): 30 points. Better sensitivity than MMSE.

Full Neuropsychological Battery (when warranted):
  - WAIS-IV/WAIS-V (intellectual functioning)
  - WMS-IV (memory)
  - D-KEFS (executive function)
  - Trail Making Test A & B
  - WCST (Wisconsin Card Sorting Test)
  - Boston Naming Test
  - Category Fluency / Letter Fluency

Capacity-Specific:
  - MacCAT-T (MacArthur Competence Assessment Tool, Treatment)
    For treatment decision-making capacity.
  - HCAI (Hopemont Capacity Assessment Interview)
  - ILS (Independent Living Scales)
  - ACCT (Assessment of Capacity for Clinical Trial participation)

=============================================
SCORE REPORTING CONVENTIONS
=============================================

Always report:
  1. Standard score on the instrument's native metric
  2. Percentile rank
  3. 95% confidence interval
  4. Descriptive classification per the test manual
  5. Normative sample used
  6. Validity indicator status BEFORE interpreting scores

Classification Systems (vary by instrument, use the publisher's system):
  IQ-Type (M=100, SD=15): <70 Extremely Low → 130+ Very Superior
  T-Scores (M=50, SD=10): <30 Very Low → 70+ Very High
  Scaled (M=10, SD=3): 1-4 Extremely Low → 16-19 Superior
`,
  },
  {
    originalFilename: 'APA_Specialty_Guidelines_Summary.txt',
    ext: '.txt',
    mime: 'text/plain',
    content: `APA SPECIALTY GUIDELINES FOR FORENSIC PSYCHOLOGY (2013)
Practice Reference Summary

Source: American Psychological Association. (2013). Specialty guidelines for forensic psychology. American Psychologist, 68(1), 7-19.

=============================================
PURPOSE AND SCOPE
=============================================

These guidelines are aspirational, not mandatory. They are intended to improve the quality of forensic psychological services and facilitate the systematic development of the specialty. They apply to all psychologists who provide forensic services, regardless of whether they identify as forensic psychologists.

Forensic psychology is defined broadly: professional practice by any psychologist working within any sub-discipline of psychology when applying the scientific, technical, or specialized knowledge of psychology to the law.

=============================================
1. RESPONSIBILITIES (Guidelines 1.01-1.04)
=============================================

1.01, Knowledge of the Legal System
Forensic practitioners seek to understand the legal and professional standards relevant to their practice area, including relevant case law, statutes, rules, and legal procedures.

1.02, Knowledge of Scientific Basis
Practitioners rely on scientifically and professionally derived knowledge. Distinguish between established facts, provisional opinions, and personal values.

1.03, Competence
Practice within boundaries of competence based on education, training, supervised experience, and professional experience. Seek continuing education.

1.04, Scope of Practice
Do not extend opinions beyond the scope of relevant data and scientific basis. Acknowledge limitations.

=============================================
2. INDEPENDENCE AND OBJECTIVITY (Guidelines 2.01-2.08)
=============================================

2.01, Impartiality and Fairness
Strive for accuracy, impartiality, and fairness. Guard against the effects of advocacy.

2.02, Conflicts of Interest
Avoid dual roles. Do not serve as both therapist and forensic evaluator for the same individual.

2.03, Multiple Relationships
Be alert to multiple relationship issues. The forensic context creates unique multiple relationship risks.

2.04, Therapeutic-Forensic Role Conflicts
When a treating clinician is asked to provide forensic opinions, clearly delineate the limitations of doing so. Preferably, refer to an independent evaluator.

2.07, Contingent Fees
Forensic practitioners do not accept contingent fees (fees contingent on outcome of a case).

=============================================
3. INFORMED CONSENT AND NOTIFICATION (Guidelines 3.01-3.03)
=============================================

3.01, Notification of Purpose
Before conducting an evaluation, notify the examinee of:
  - The nature, purpose, and anticipated use of the evaluation
  - Who requested the evaluation
  - Who will receive the results
  - The limits of confidentiality
  - The voluntary or court-ordered nature of participation

3.02, Informed Consent
When possible, obtain informed consent. In court-ordered evaluations where consent is not required, notification (above) is still mandatory.

3.03, Communication with Collateral Sources
Consider obtaining consent before contacting collateral sources when feasible. Document any limitations on this process.

=============================================
4. METHODS AND PROCEDURES (Guidelines 4.01-4.08)
=============================================

4.01, Use of Methods and Procedures
Select methods and procedures that are appropriate to the forensic context and relevant to the psycholegal question.

4.02, Use of Multiple Sources of Information
Rely on multiple sources of data. Avoid over-reliance on any single source. Cross-validate information across sources.

4.02.01, When Sources Conflict
When information from different sources conflicts, attempt to resolve the discrepancy. Document the conflict and how it was addressed.

4.03, Use of Forensic Assessment Instruments
Use instruments that are validated for the specific forensic purpose. Be aware of the limitations of general clinical instruments when applied in forensic contexts.

4.04, Third Party Observation
Consider the potential effects of third-party observation on evaluation results.

4.06, Documentation
Maintain thorough documentation of all contacts, procedures, findings, and consultations.

=============================================
5. OPINIONS (Guidelines 5.01-5.04)
=============================================

5.01, Basis for Opinions
Base opinions on adequate foundation. Do not provide opinions without adequate basis.

5.02, Knowledge of the Law
Understand the legal standard being addressed but express opinions in clinical/scientific terms.

5.03, Ultimate Issue Opinions
When providing ultimate issue opinions (e.g., "competent to stand trial"), clearly articulate the clinical basis and the reasoning connecting data to opinion.

5.04, Report Writing
Reports should:
  - Be well-organized and clearly written
  - Distinguish between observations, inferences, and opinions
  - Present reasoning chains transparently
  - Acknowledge limitations and alternative explanations
  - Define technical terms

=============================================
6. COMMUNICATION (Guidelines 6.01-6.05)
=============================================

6.01, Honesty and Accuracy
Present findings honestly and accurately, including findings that may be adverse to the retaining party's position.

6.02, Scope of Testimony
In testimony, stay within the scope of expertise and the data gathered.

6.04, Comprehensive and Accurate Presentation
Present the full range of relevant data, including contradictory information. Do not selectively present data.

=============================================
IMPLICATIONS FOR PSYGIL IMPLEMENTATION
=============================================

1. Template system must enforce notification/consent documentation (Guideline 3.01).
2. Sources of Information section must be comprehensive and mandatory (Guideline 4.02).
3. Reports must separate observations from opinions structurally (Guideline 5.04).
4. The "DOCTOR ALWAYS DIAGNOSES" principle aligns with Guideline 5.01, opinions must have adequate basis and be formed by the clinician, not generated by AI.
5. Limitations section is mandatory, not optional (Guideline 1.04).
6. Contradictory data must be presented even when it weakens the opinion (Guideline 6.04).
7. Template warnings should flag potential dual-role conflicts (Guideline 2.02).
`,
  },
]

// ---------------------------------------------------------------------------
// PUBLIC: Seed function
// ---------------------------------------------------------------------------

export function seedResources(workspacePath: string): number {
  // Resources live under /Workspace/<Category>/ per the consolidated
  // folder architecture. The old _Resources/ tree is no longer used.
  const resourcesRoot = join(workspacePath, 'Workspace')
  const writingSamplesDir = join(resourcesRoot, 'Writing Samples')
  const templatesDir = join(resourcesRoot, 'Templates')
  const documentationDir = join(resourcesRoot, 'Documents')

  // Create directory structure
  for (const dir of [resourcesRoot, writingSamplesDir, templatesDir, documentationDir]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  // Clean up stale files from old UUID-based seed (meta.json, UUID-named files, _cleaned.txt)
  const cleanStaleFiles = (dir: string): void => {
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.meta.json')) {
          try { const { unlinkSync } = require('fs'); unlinkSync(join(dir, f)) } catch { /* ignore */ }
        }
        // UUID pattern: 8-4-4-4-12 hex chars
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(f)) {
          try { const { unlinkSync } = require('fs'); unlinkSync(join(dir, f)) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
  }
  cleanStaleFiles(writingSamplesDir)
  cleanStaleFiles(templatesDir)
  cleanStaleFiles(documentationDir)

  // Skip if already seeded, check for real document files by known extensions
  const DOC_EXTS = new Set(['.txt', '.pdf', '.doc', '.docx', '.csv', '.rtf', '.md', '.xlsx'])
  const hasRealDocs = (dir: string): boolean => {
    try {
      return readdirSync(dir).some((f: string) => {
        if (f.startsWith('.') || f.startsWith('_')) return false
        const ext = f.substring(f.lastIndexOf('.')).toLowerCase()
        return DOC_EXTS.has(ext)
      })
    } catch { return false }
  }
  if (hasRealDocs(writingSamplesDir) || hasRealDocs(templatesDir) || hasRealDocs(documentationDir)) {
    console.log('[seed] Resources already seeded, skipping')
    return 0
  }

  let count = 0

  for (const file of WRITING_SAMPLES) {
    writeSeedFile(writingSamplesDir, file)
    count++
  }

  for (const file of TEMPLATES) {
    writeSeedFile(templatesDir, file)
    count++
  }

  for (const file of DOCUMENTATION) {
    writeSeedFile(documentationDir, file)
    count++
  }

  console.log(`[seed] Seeded ${count} resource files across 3 categories`)
  return count
}
