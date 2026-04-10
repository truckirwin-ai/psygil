// =============================================================================
// Report Template Registry
// =============================================================================
//
// Each template maps to one of the 7 evaluation types supported by the MVP:
//   CST, Competency to Stand Trial
//   Custody, Child Custody Evaluation
//   Risk Assessment, Violence / Sexual Reoffense Risk
//   Fitness for Duty, Public safety, law enforcement, sensitive positions
//   PTSD Dx, PTSD diagnostic evaluation
//   ADHD Dx, ADHD diagnostic evaluation
//   Malingering, Symptom validity / feigning assessment
//
// Template sections follow forensic report conventions (referral question,
// procedures, behavioral observations, test results, clinical interview,
// formulation, opinion to reasonable degree of psychological certainty).
//
// Each section body contains realistic example prose that the Writer Agent
// uses as a structural blueprint. The prose models the tone, length, and
// clinical specificity expected in a production report. Patient-specific
// details are replaced at generation time; the example text shows the
// examiner what a finished section looks like.
//
// Placeholders use double-brace mustache-style tokens: {{TOKEN_NAME}}
// At template provisioning time, practice-level tokens are replaced once
// with values from the setup wizard. Patient-level tokens remain for the
// report to fill in later.
//
// Practice-level tokens (replaced at provisioning time):
//   {{PRACTICE_NAME}}           e.g. "Forensic Psychology Associates"
//   {{CLINICIAN_FULL_NAME}}     e.g. "Dr. Jordan Whitfield"
//   {{CLINICIAN_CREDENTIALS}}   e.g. "Psy.D., ABPP"
//   {{CLINICIAN_LICENSE}}       e.g. "PSY12345"
//   {{CLINICIAN_STATE}}         e.g. "Colorado"
//   {{PRACTICE_ADDRESS}}        e.g. "1234 Main St, Denver, CO 80202"
//   {{PRACTICE_PHONE}}          e.g. "(303) 555-0100"
//
// Patient-level tokens (left in place; filled at report time):
//   {{PATIENT_NAME}}            {{DATE_OF_BIRTH}}     {{CASE_NUMBER}}
//   {{REFERRING_PARTY}}         {{DATE_OF_REPORT}}    {{DATES_OF_CONTACT}}
//   {{COURT_NAME}}              {{DOCKET_NUMBER}}     {{JURISDICTION}}
// =============================================================================

export type EvalType =
  | 'CST'
  | 'Custody'
  | 'Risk Assessment'
  | 'Fitness for Duty'
  | 'PTSD Dx'
  | 'ADHD Dx'
  | 'Malingering'

export interface TemplateSection {
  readonly heading: string
  readonly body: readonly string[] // one paragraph per string
}

export interface ReportTemplate {
  readonly id: string // stable slug, used as filename stem
  readonly evalType: EvalType
  readonly title: string
  readonly subtitle: string
  readonly sections: readonly TemplateSection[]
}

// ---------------------------------------------------------------------------
// Shared boilerplate that appears in every template
// ---------------------------------------------------------------------------

const HEADER_BLOCK: TemplateSection = {
  heading: 'Header',
  body: [
    '{{PRACTICE_NAME}}',
    '{{PRACTICE_ADDRESS}}',
    'Phone: {{PRACTICE_PHONE}}',
    '',
    'CONFIDENTIAL FORENSIC PSYCHOLOGICAL EVALUATION',
  ],
}

const IDENTIFYING_INFO: TemplateSection = {
  heading: 'Identifying Information',
  body: [
    'Patient Name: {{PATIENT_NAME}}',
    'Date of Birth: {{DATE_OF_BIRTH}}',
    'Case Number: {{CASE_NUMBER}}',
    'Referring Party: {{REFERRING_PARTY}}',
    'Date of Report: {{DATE_OF_REPORT}}',
    'Dates of Contact: {{DATES_OF_CONTACT}}',
    'Examiner: {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}',
    'License: {{CLINICIAN_LICENSE}} ({{CLINICIAN_STATE}})',
  ],
}

const NOTICE_OF_NON_CONFIDENTIALITY: TemplateSection = {
  heading: 'Notice of Non-Confidentiality',
  body: [
    'The evaluee was informed at the outset that this evaluation is being conducted at the request of {{REFERRING_PARTY}} and that the usual rules of doctor-patient confidentiality do not apply. The evaluee was advised that information obtained during the evaluation would be included in a written report provided to the referring party and that the report may be shared with the court and other parties to the legal proceeding. The evaluee acknowledged understanding of these limits and voluntarily agreed to participate.',
  ],
}

const PROCEDURES_BOILERPLATE: string[] = [
  'Review of records provided by the referring party',
  'Clinical interview with the evaluee',
  'Mental status examination',
  'Collateral interview(s) where appropriate',
  'Standardized psychological testing (see Test Results)',
  'Symptom validity and effort testing',
]

const SIGNATURE_BLOCK: TemplateSection = {
  heading: 'Signature',
  body: [
    'The opinions expressed in this report are held to a reasonable degree of psychological certainty based on the data reviewed and the methods described. If additional information becomes available, I reserve the right to supplement or modify these opinions.',
    '',
    'Respectfully submitted,',
    '',
    '',
    '_______________________________',
    '{{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}',
    'Licensed Psychologist, {{CLINICIAN_STATE}} #{{CLINICIAN_LICENSE}}',
    'Date: {{DATE_OF_REPORT}}',
  ],
}

// ---------------------------------------------------------------------------
// Template 1: Competency to Stand Trial (CST)
// ---------------------------------------------------------------------------

const CST_TEMPLATE: ReportTemplate = {
  id: 'report_cst',
  evalType: 'CST',
  title: 'Competency to Stand Trial Evaluation',
  subtitle: 'Forensic Psychological Evaluation',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The {{COURT_NAME}} ordered a psychological evaluation to address the following question: whether {{PATIENT_NAME}} has sufficient present ability to consult with counsel with a reasonable degree of rational understanding, and whether the defendant has a rational as well as factual understanding of the proceedings, as set forth in Dusky v. United States, 362 U.S. 402 (1960). The court order specified the following jurisdiction-specific statutory criteria: {{JURISDICTION}} competency standard.',
      ],
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        ...PROCEDURES_BOILERPLATE,
        'Administration of the MacArthur Competence Assessment Tool, Criminal Adjudication (MacCAT-CA)',
        'Administration of the Evaluation of Competency to Stand Trial, Revised (ECST-R)',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Arrest report and charging documents dated [DATE]',
        'Criminal complaint and affidavit of probable cause',
        'Prior psychiatric and psychological evaluation reports',
        'Jail medical intake screening and mental health records',
        'Prescription medication administration records from the detention facility',
        'Prior competency evaluation(s), if any',
        'Collateral statements from defense counsel',
      ],
    },
    {
      heading: 'Relevant Background',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who was born in [LOCATION]. The defendant reported being raised by [CAREGIVERS] and described the home environment as [DESCRIPTION]. There was no reported history of physical abuse, sexual abuse, or neglect, though the defendant noted [RELEVANT CHILDHOOD DETAILS]. The defendant completed [EDUCATION LEVEL] and reported [WORK HISTORY]. The defendant denied any history of special education placement or learning disability diagnosis.',
        'Regarding psychiatric history, the defendant reported first contact with mental health services at age [AGE] for [SYMPTOMS]. The defendant has carried diagnoses of [DIAGNOSES] and has been prescribed [MEDICATIONS]. The defendant reported [NUMBER] prior psychiatric hospitalizations, the most recent in [DATE] at [FACILITY] for [REASON]. The defendant described [COMPLIANCE/NONCOMPLIANCE] with prescribed medications prior to the current arrest.',
        'The defendant reported a history of [SUBSTANCE] use beginning at age [AGE]. At its most severe, the defendant described [PATTERN OF USE]. The defendant reported last using [SUBSTANCE] on [DATE]. The defendant denied any history of medically supervised detoxification or inpatient substance treatment, though noted [RELEVANT TREATMENT HISTORY].',
        'The defendant has a criminal history that includes [NUMBER] prior arrests for [OFFENSES]. The defendant reported [NUMBER] prior incarcerations, with the longest term being [DURATION]. The defendant denied any prior competency evaluations or commitments for competency restoration. The defendant is currently charged with [CHARGES] and faces a potential sentence of [RANGE].',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [RACE/ETHNICITY] [GENDER] who appeared [CONSISTENT/OLDER/YOUNGER] than the stated age of [AGE]. The defendant was dressed in jail-issued clothing and appeared [GROOMING]. The defendant was [COOPERATIVE/GUARDED/HOSTILE] with the evaluation process and [DID/DID NOT] appear to put forth adequate effort.',
        'Speech was [RATE], [RHYTHM], and [VOLUME], with [NORMAL/ABNORMAL] prosody. The defendant\'s receptive language appeared [INTACT/IMPAIRED], and expressive language was [DESCRIPTION]. The defendant [DID/DID NOT] require repetition of questions.',
        'The defendant described mood as "[PATIENT WORDS]." Affect was [RANGE] in range, [CONGRUENT/INCONGRUENT] with stated mood, and [APPROPRIATE/INAPPROPRIATE] to content. No tearfulness, irritability, or affective lability was observed during the interview.',
        'Thought process was [LINEAR/CIRCUMSTANTIAL/TANGENTIAL/LOOSE]. The defendant [DENIED/ENDORSED] current suicidal ideation, homicidal ideation, and intent to harm self or others. The defendant [DENIED/ENDORSED] auditory hallucinations, visual hallucinations, and paranoid ideation. There was [NO EVIDENCE/EVIDENCE] of delusional thinking during the interview. Thought content was notable for [RELEVANT CONTENT].',
        'The defendant was oriented to person, place, date, and situation. Attention and concentration appeared [INTACT/IMPAIRED] based on the defendant\'s ability to track questions and maintain the thread of conversation throughout the interview. Immediate recall was [INTACT/IMPAIRED]. The defendant demonstrated [ADEQUATE/IMPAIRED] fund of general knowledge. Insight into the current legal situation was [GOOD/FAIR/POOR]. Judgment, as assessed by the defendant\'s decision-making in the current legal context, was [GOOD/FAIR/POOR].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'MacArthur Competence Assessment Tool, Criminal Adjudication (MacCAT-CA): The MacCAT-CA is a structured clinical instrument that assesses three areas of competency-related abilities. On the Understanding subscale, the defendant scored [SCORE], which falls in the [RANGE] range and indicates [INTERPRETATION] grasp of the legal process. On the Reasoning subscale, the defendant scored [SCORE], indicating [INTERPRETATION] ability to process and discriminate legally relevant information. On the Appreciation subscale, the defendant scored [SCORE], indicating [INTERPRETATION] capacity to apply legal understanding to the defendant\'s own case.',
        'Evaluation of Competency to Stand Trial, Revised (ECST-R): The ECST-R is a structured interview designed to assess competency-relevant abilities and includes embedded validity scales. On the Consult with Counsel subscale, the defendant scored [SCORE], placing performance in the [RANGE] range. On the Factual Understanding of Courtroom Proceedings subscale, the defendant scored [SCORE], in the [RANGE] range. On the Rational Understanding of Courtroom Proceedings subscale, the defendant scored [SCORE], in the [RANGE] range. The Atypical Presentation Scale score was [SCORE], which [DID/DID NOT] exceed the recommended cutoff for suspected feigning of incompetency.',
        'Miller Forensic Assessment of Symptoms Test (M-FAST): The M-FAST is a brief screening instrument for feigned mental illness. The defendant obtained a total score of [SCORE]. Scores at or above 6 suggest possible malingering and warrant further assessment. The defendant\'s score [DID/DID NOT] exceed this threshold.',
        'Validity Indicator Profile (VIP) or Test of Memory Malingering (TOMM): [INSTRUMENT] was administered to assess effort and response validity. The defendant scored [SCORES ACROSS TRIALS]. These results [ARE/ARE NOT] consistent with adequate effort, and the defendant\'s performance [IS/IS NOT] considered valid for interpretation purposes.',
      ],
    },
    {
      heading: 'Functional Abilities Assessment',
      body: [
        'Factual Understanding of the Proceedings: The defendant was asked to describe the roles of various courtroom personnel. The defendant [CORRECTLY/INCORRECTLY] identified the role of the judge as [DEFENDANT\'S RESPONSE]. The defendant described the prosecutor\'s role as [DEFENDANT\'S RESPONSE] and defense counsel\'s role as [DEFENDANT\'S RESPONSE]. The defendant [WAS/WAS NOT] able to explain the function of a jury. The defendant demonstrated [ADEQUATE/INADEQUATE] understanding of the adversarial nature of the proceedings and [COULD/COULD NOT] identify the range of pleas available (guilty, not guilty, no contest). When asked about the potential consequences of conviction, the defendant stated [DEFENDANT\'S RESPONSE].',
        'Rational Understanding of the Proceedings: The defendant was asked to describe how the legal proceedings apply to the defendant\'s own situation. The defendant [WAS/WAS NOT] able to articulate the specific charges and their elements in basic terms. When asked what evidence the prosecution might present, the defendant stated [DEFENDANT\'S RESPONSE]. The defendant\'s account of the alleged offense was [CONSISTENT/INCONSISTENT] across the interview and [DID/DID NOT] reflect an appreciation of the legal significance of the facts. The defendant [DID/DID NOT] demonstrate the ability to weigh the relative merits of going to trial versus accepting a plea offer, stating [DEFENDANT\'S RESPONSE].',
        'Capacity to Consult with Counsel: The defendant reported [FREQUENCY AND QUALITY] of contact with defense counsel. The defendant [WAS/WAS NOT] able to identify the attorney by name and describe the content of recent discussions. During the evaluation, the defendant demonstrated [ADEQUATE/IMPAIRED] ability to track questions, provide relevant answers, and maintain a coherent conversational thread. The defendant [DID/DID NOT] show the ability to disclose potentially useful information when asked open-ended questions about the circumstances of the offense. The defendant\'s capacity to tolerate the stress of courtroom proceedings appeared [ADEQUATE/COMPROMISED] based on [BEHAVIORAL OBSERVATIONS]. The defendant [DID/DID NOT] demonstrate the ability to make reasoned decisions about defense strategy when presented with hypothetical scenarios.',
      ],
    },
    {
      heading: 'Clinical Formulation',
      body: [
        'Based on the totality of the data gathered in this evaluation, {{PATIENT_NAME}} presents with [CLINICAL PICTURE SUMMARY]. The defendant carries prior diagnoses of [DIAGNOSES], and the current evaluation findings are [CONSISTENT/INCONSISTENT] with [DIAGNOSIS per DSM-5-TR criteria]. Specifically, [DESCRIBE KEY SYMPTOMS AND HOW THEY MAP TO DIAGNOSTIC CRITERIA].',
        'With respect to competency-relevant abilities, the defendant\'s [DIAGNOSIS/SYMPTOMS] [DO/DO NOT] appear to impair the defendant\'s factual understanding of the proceedings. The defendant [CAN/CANNOT] identify courtroom personnel, describe the charges, and explain potential outcomes with reasonable accuracy. Regarding rational understanding, the defendant [IS/IS NOT] able to apply legal knowledge to the defendant\'s own case, as evidenced by [SPECIFIC EXAMPLES]. The defendant\'s capacity to consult with counsel [IS/IS NOT] compromised by [SYMPTOM/CONDITION], as demonstrated by [SPECIFIC EXAMPLES].',
        'Symptom validity testing produced results that [ARE/ARE NOT] consistent with genuine symptom presentation and adequate effort. The defendant\'s performance on the M-FAST [DID/DID NOT] suggest feigning of mental illness. Performance on the [TOMM/VIP] indicated [ADEQUATE/INADEQUATE] effort, and the cognitive and clinical test results are [CONSIDERED/NOT CONSIDERED] valid reflections of the defendant\'s actual functioning.',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, it is this examiner\'s opinion that {{PATIENT_NAME}} [IS/IS NOT] competent to stand trial at the present time.',
        '[IF COMPETENT]: The defendant demonstrates a factual and rational understanding of the nature and object of the proceedings and possesses a sufficient present ability to consult with counsel with a reasonable degree of rational understanding. While the defendant does present with [DIAGNOSIS/SYMPTOMS], these conditions do not impair the defendant\'s competency-relevant abilities to a degree that would render the defendant incompetent under the Dusky standard.',
        '[IF NOT COMPETENT]: The defendant does not, at the present time, possess a sufficient factual and rational understanding of the proceedings, and/or does not possess sufficient present ability to consult with counsel. Specifically, the defendant\'s [DIAGNOSIS/CONDITION] impairs the defendant\'s ability to [SPECIFIC DEFICITS]. These deficits are directly attributable to [CLINICAL CONDITION] and are not the product of deliberate malingering or volitional noncooperation, based on the validity testing results described above.',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '[IF COMPETENT]: No further action is recommended for purposes of competency. The court may wish to consider [RELEVANT CLINICAL RECOMMENDATIONS, e.g., continued medication management, mental health monitoring during proceedings].',
        '[IF NOT COMPETENT]: It is recommended that the defendant be committed for competency restoration treatment. Based on the nature of the defendant\'s condition, inpatient treatment at a [STATE HOSPITAL/FORENSIC UNIT] is recommended. The defendant\'s primary deficits are in the area of [SPECIFIC DEFICITS], and restoration efforts should focus on [PSYCHOEDUCATION/MEDICATION STABILIZATION/SPECIFIC INTERVENTIONS]. Given the defendant\'s clinical presentation and treatment history, the prognosis for restoration within a [TIMEFRAME] period is [GOOD/FAIR/GUARDED/POOR]. The basis for this prognosis is [REASONING].',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 2: Child Custody Evaluation
// ---------------------------------------------------------------------------

const CUSTODY_TEMPLATE: ReportTemplate = {
  id: 'report_custody',
  evalType: 'Custody',
  title: 'Child Custody Evaluation',
  subtitle: 'Best Interests of the Child',
  sections: [
    HEADER_BLOCK,
    {
      heading: 'Identifying Information',
      body: [
        'Child(ren): {{PATIENT_NAME}}',
        'Dates of Birth: {{DATE_OF_BIRTH}}',
        'Parents/Parties: (to be entered)',
        'Case Number: {{CASE_NUMBER}}',
        'Court: {{COURT_NAME}}',
        'Docket: {{DOCKET_NUMBER}}',
        'Referring Party: {{REFERRING_PARTY}}',
        'Date of Report: {{DATE_OF_REPORT}}',
        'Examiner: {{CLINICIAN_FULL_NAME}}, {{CLINICIAN_CREDENTIALS}}',
      ],
    },
    {
      heading: 'Referral Question',
      body: [
        'The {{COURT_NAME}} ordered a psychological evaluation to address the best interests of the child(ren) with respect to decision-making responsibility and parenting time. The evaluation is guided by the APA Guidelines for Child Custody Evaluations in Family Law Proceedings (2010) and the AFCC Model Standards of Practice for Child Custody Evaluation (2022).',
      ],
    },
    {
      heading: 'Notice of Limits on Confidentiality',
      body: [
        'All parties were informed at the outset that this is a court-ordered evaluation, that information obtained will be included in a written report provided to the court and the parties, and that the usual rules of confidentiality do not apply. Each parent signed a written acknowledgment of informed consent. The children were informed, in developmentally appropriate language, that the examiner would be writing a report for the judge about what is best for the family, and that what they said would not be kept secret from the parents or the court.',
      ],
    },
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        'Review of court filings, prior orders, and legal pleadings',
        'Review of prior custody or parenting evaluations, if any',
        'Individual clinical interview with [PARENT A], approximately [HOURS] hours across [NUMBER] sessions',
        'Individual clinical interview with [PARENT B], approximately [HOURS] hours across [NUMBER] sessions',
        'Individual clinical interview with each child at a developmentally appropriate level',
        'Observation of [PARENT A]-child interaction (structured and unstructured, approximately [DURATION])',
        'Observation of [PARENT B]-child interaction (structured and unstructured, approximately [DURATION])',
        'Home visit to [PARENT A]\'s residence on [DATE]',
        'Home visit to [PARENT B]\'s residence on [DATE]',
        'Standardized psychological testing of each parent (see Test Results)',
        'Collateral interviews with [NUMBER] individuals identified by the parties and the court',
        'Review of school records, medical records, and mental health records for each child',
      ],
    },
    {
      heading: 'Background of the Family',
      body: [
        '[PARENT A] and [PARENT B] married on [DATE] and separated on [DATE], after approximately [DURATION] of marriage. The couple has [NUMBER] children together: [CHILD NAMES AND AGES]. The separation was initiated by [PARENT] following [CIRCUMSTANCES]. The divorce petition was filed on [DATE].',
        'Both parents described the early relationship as [DESCRIPTION]. Conflict reportedly increased when [PRECIPITANT]. [PARENT A] alleged [ALLEGATIONS]. [PARENT B] denied these allegations and counter-alleged [COUNTER-ALLEGATIONS]. The court has [ISSUED/NOT ISSUED] any temporary protective orders. There [IS/IS NO] active involvement of child protective services.',
        '[CHILD NAME], age [AGE], is currently in [GRADE] at [SCHOOL]. The child\'s teachers describe the child as [TEACHER OBSERVATIONS]. The child [IS/IS NOT] receiving any special services at school. The child\'s pediatrician, [NAME], reported [RELEVANT MEDICAL INFORMATION]. The child [HAS/HAS NOT] been in individual therapy; if so, with [THERAPIST NAME] since [DATE] for [PRESENTING CONCERNS].',
        'The current parenting schedule, pursuant to temporary orders entered [DATE], provides for [SCHEDULE DESCRIPTION]. Both parties reported [COMPLIANCE/NONCOMPLIANCE] with the current schedule. [PARENT] reported conflict at exchanges, specifically [DESCRIPTION].',
      ],
    },
    {
      heading: 'Clinical Interview with [PARENT A]',
      body: [
        '[PARENT A] is a [AGE]-year-old [OCCUPATION] who resides in [LOCATION]. The parent presented as [APPEARANCE AND DEMEANOR] and was [COOPERATIVE/GUARDED] throughout the interview. The parent appeared invested in the evaluation and [DID/DID NOT] present information in a balanced manner.',
        'Regarding the marriage and separation, [PARENT A] reported [PARENT\'S ACCOUNT]. The parent expressed concern about [SPECIFIC CONCERNS ABOUT OTHER PARENT\'S PARENTING]. When asked to describe [PARENT B]\'s strengths as a parent, [PARENT A] stated [RESPONSE]. When asked about personal weaknesses as a parent, the parent stated [RESPONSE].',
        '[PARENT A] described a parenting approach characterized by [STYLE]. The parent reported a typical day with the children as [DESCRIPTION]. The parent reported involvement in the children\'s schoolwork, medical appointments, and extracurricular activities as follows: [DESCRIPTION].',
        'Mental status examination of [PARENT A] revealed [MSE FINDINGS]. The parent [DENIED/ENDORSED] current psychiatric symptoms. The parent reported [MENTAL HEALTH HISTORY]. The parent [DENIED/ENDORSED] current or past substance use concerns.',
        '[PARENT A] proposed the following parenting plan: [DESCRIPTION OF DESIRED OUTCOME]. The parent\'s reasoning was [RATIONALE].',
      ],
    },
    {
      heading: 'Clinical Interview with [PARENT B]',
      body: [
        '[PARENT B] is a [AGE]-year-old [OCCUPATION] who resides in [LOCATION]. The parent presented as [APPEARANCE AND DEMEANOR] and was [COOPERATIVE/GUARDED] throughout the interview.',
        'Regarding the marriage and separation, [PARENT B] reported [PARENT\'S ACCOUNT]. The parent expressed concern about [SPECIFIC CONCERNS ABOUT OTHER PARENT\'S PARENTING]. When asked to describe [PARENT A]\'s strengths as a parent, [PARENT B] stated [RESPONSE]. When asked about personal weaknesses as a parent, the parent stated [RESPONSE].',
        '[PARENT B] described a parenting approach characterized by [STYLE]. The parent reported a typical day with the children as [DESCRIPTION]. The parent reported involvement in the children\'s education, healthcare, and activities as follows: [DESCRIPTION].',
        'Mental status examination of [PARENT B] revealed [MSE FINDINGS]. The parent [DENIED/ENDORSED] current psychiatric symptoms. The parent reported [MENTAL HEALTH HISTORY]. The parent [DENIED/ENDORSED] current or past substance use concerns.',
        '[PARENT B] proposed the following parenting plan: [DESCRIPTION OF DESIRED OUTCOME]. The parent\'s reasoning was [RATIONALE].',
      ],
    },
    {
      heading: 'Clinical Interviews with Children',
      body: [
        '[CHILD NAME], age [AGE], was interviewed individually on [DATE]. The child presented as a [DESCRIPTION] child who appeared [COMFORTABLE/ANXIOUS/GUARDED] in the interview setting. Rapport was established [EASILY/WITH DIFFICULTY].',
        'The child described life at [PARENT A]\'s home as [DESCRIPTION]. The child described life at [PARENT B]\'s home as [DESCRIPTION]. When asked about the parenting schedule, the child stated [CHILD\'S WORDS]. The child [DID/DID NOT] express a preference regarding where to live, stating [CHILD\'S WORDS IF APPLICABLE]. The examiner notes that the child\'s expressed preference [IS/IS NOT] consistent with the child\'s observed emotional state and [APPEARS/DOES NOT APPEAR] to reflect undue influence from either parent.',
        'The child described school as [DESCRIPTION] and identified [FRIENDS/ACTIVITIES]. When asked about the family situation, the child stated [CHILD\'S WORDS]. The child [DID/DID NOT] report awareness of parental conflict. The child\'s emotional presentation when discussing each parent was [OBSERVATION].',
        'The child\'s developmental level and verbal capacities [ARE/ARE NOT] sufficient to provide meaningful input into custody considerations. The examiner assigns [WEIGHT] to the child\'s expressed preferences based on [REASONING].',
      ],
    },
    {
      heading: 'Parent-Child Observations',
      body: [
        'Observation of [PARENT A] with [CHILD/CHILDREN]: The observation took place on [DATE] at [LOCATION] and lasted approximately [DURATION]. [PARENT A] greeted the child(ren) by [GREETING BEHAVIOR]. During unstructured play, the parent [DESCRIPTION OF INTERACTION]. The parent demonstrated [WARMTH/ATTUNEMENT/DIRECTIVENESS/PERMISSIVENESS] in interactions. The parent set limits by [DESCRIPTION]. The child(ren) appeared [COMFORTABLE/CLINGY/AVOIDANT/RELAXED] with this parent. The parent [DID/DID NOT] initiate physical affection, and the child(ren) [DID/DID NOT] seek proximity.',
        'Observation of [PARENT B] with [CHILD/CHILDREN]: The observation took place on [DATE] at [LOCATION] and lasted approximately [DURATION]. [PARENT B] greeted the child(ren) by [GREETING BEHAVIOR]. During unstructured play, the parent [DESCRIPTION OF INTERACTION]. The parent demonstrated [WARMTH/ATTUNEMENT/DIRECTIVENESS/PERMISSIVENESS]. The parent set limits by [DESCRIPTION]. The child(ren) appeared [COMFORTABLE/CLINGY/AVOIDANT/RELAXED] with this parent.',
        'Comparison of Observations: Both parents demonstrated [SHARED STRENGTHS]. [PARENT A] was notably more [QUALITY] while [PARENT B] was notably more [QUALITY]. The children\'s behavior [DID/DID NOT] vary meaningfully between the two observations. [ANY NOTABLE DIFFERENCES IN CHILD BEHAVIOR].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'Minnesota Multiphasic Personality Inventory-3 (MMPI-3): [PARENT A] produced a valid profile (CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T). The Substantive Scale profile was characterized by [DESCRIPTION OF ELEVATED SCALES AND INTERPRETATION]. Of particular relevance to the custody context, [SPECIFIC FINDINGS].',
        'Minnesota Multiphasic Personality Inventory-3 (MMPI-3): [PARENT B] produced a valid profile (CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T). The Substantive Scale profile was characterized by [DESCRIPTION OF ELEVATED SCALES AND INTERPRETATION]. Of particular relevance to the custody context, [SPECIFIC FINDINGS].',
        'Parenting Stress Index, Fourth Edition (PSI-4): [PARENT A] obtained a Total Stress score of [PERCENTILE] percentile, with elevations on [SPECIFIC SUBSCALES]. [PARENT B] obtained a Total Stress score of [PERCENTILE] percentile, with elevations on [SPECIFIC SUBSCALES]. These results suggest [INTERPRETATION].',
        'Parent-Child Relationship Inventory (PCRI): [PARENT A] produced a profile indicating [DESCRIPTION]. [PARENT B] produced a profile indicating [DESCRIPTION]. Of note, [SPECIFIC COMPARISONS RELEVANT TO REFERRAL QUESTION].',
        'Symptom validity was assessed through embedded indicators on the MMPI-3 and behavioral observation during testing. Both parents produced valid profiles. Neither parent\'s test results showed evidence of gross over-reporting or under-reporting of symptoms that would invalidate interpretation.',
      ],
    },
    {
      heading: 'Collateral Information',
      body: [
        '[COLLATERAL NAME], [RELATIONSHIP], was interviewed by telephone on [DATE]. This individual reported [SUMMARY OF RELEVANT INFORMATION]. The collateral described [PARENT]\'s parenting as [DESCRIPTION] and reported observing [SPECIFIC OBSERVATIONS].',
        '[COLLATERAL NAME], [RELATIONSHIP/PROFESSIONAL ROLE], was interviewed on [DATE]. This individual reported [SUMMARY]. Of note, this collateral stated [SPECIFIC RELEVANT INFORMATION].',
        '[SCHOOL PROFESSIONAL NAME], [TITLE] at [SCHOOL], reported that [CHILD NAME] is [DESCRIPTION OF SCHOOL FUNCTIONING]. The school professional reported contact with [PARENT A] regarding school matters as [FREQUENCY/QUALITY] and with [PARENT B] as [FREQUENCY/QUALITY]. The school professional [DID/DID NOT] express concerns about either parent\'s involvement.',
        '[THERAPIST NAME], [CHILD]\'s individual therapist, reported [RELEVANT CLINICAL OBSERVATIONS, noting limitations of collateral reporting due to therapeutic confidentiality]. The therapist [DID/DID NOT] express concerns about the child\'s adjustment to the current arrangement.',
      ],
    },
    {
      heading: 'Best-Interests Analysis',
      body: [
        'The following analysis applies the statutory best-interests factors to the data gathered in this evaluation. Each factor is addressed individually, followed by a summary integration.',
        'Wishes of the parents: [PARENT A] seeks [PROPOSED PLAN]. [PARENT B] seeks [PROPOSED PLAN]. The parents [AGREE/DISAGREE] on [SPECIFIC AREAS].',
        'Wishes of the child(ren): [CHILD NAME], age [AGE], expressed [PREFERENCE/NO PREFERENCE]. The weight assigned to this preference is [WEIGHT] based on the child\'s age, maturity, and the examiner\'s assessment of the degree to which the preference reflects the child\'s own reasoning versus external influence. [REPEAT FOR EACH CHILD].',
        'Interaction and interrelationship: The children have [STRONG/ADEQUATE/STRAINED] relationships with both parents. The children [DO/DO NOT] demonstrate differential attachment behavior. Sibling relationships are [DESCRIPTION]. Each parent\'s extended family provides [DESCRIPTION OF SUPPORT].',
        'Adjustment to home, school, and community: The children are currently [WELL/ADEQUATELY/POORLY] adjusted to their school setting. The children have [DESCRIPTION OF PEER RELATIONSHIPS AND COMMUNITY TIES] in each parent\'s community. A change in primary residence would require [DESCRIPTION OF DISRUPTION].',
        'Mental and physical health of all individuals: [PARENT A]\'s mental health [IS/IS NOT] a factor in this analysis. Testing revealed [RELEVANT FINDINGS]. [PARENT B]\'s mental health [IS/IS NOT] a factor. The children\'s mental health [IS/IS NOT] a concern, as evidenced by [RELEVANT FINDINGS].',
        'History of domestic violence: [THERE IS/THERE IS NO] credible evidence of domestic violence in this case. [IF PRESENT: DESCRIPTION, IMPACT ON CHILDREN, AND ANALYSIS OF RISK]. The record reflects [FINDINGS RE: PROTECTIVE ORDERS, POLICE REPORTS, CPS INVOLVEMENT].',
        'Cooperation and facilitation: [PARENT A] has demonstrated [DESCRIPTION] willingness to support the children\'s relationship with [PARENT B]. [PARENT B] has demonstrated [DESCRIPTION] willingness to support the children\'s relationship with [PARENT A]. Specific examples include [EXAMPLES]. Gatekeeping behavior [WAS/WAS NOT] observed, specifically [DESCRIPTION].',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, and based on the totality of data gathered in this evaluation, I offer the following opinions:',
        'Regarding decision-making responsibility: The data support [JOINT/SOLE/CONDITIONAL] decision-making. [PARENT A] and [PARENT B] [ARE/ARE NOT] able to communicate and cooperate on major decisions regarding the children\'s education, healthcare, and religious upbringing. The basis for this opinion is [SPECIFIC DATA POINTS].',
        'Regarding parenting time: The data support a parenting schedule that [DESCRIPTION OF RECOMMENDED SCHEDULE AND REASONING]. This recommendation is based on the following considerations: the children\'s ages and developmental needs, the quality of each parent-child relationship as observed, each parent\'s capacity to meet the children\'s daily needs, the geographic proximity of the parents\' residences, and the children\'s school and activity schedules.',
        'The examiner notes the following limitations of this evaluation: [E.g., one parent was less forthcoming, records from a specific provider were not available, the children were interviewed during a period of acute stress].',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '1. [DECISION-MAKING ALLOCATION]: [Joint/Sole] decision-making responsibility is recommended, with [SPECIFIC PROVISIONS for areas of disagreement if applicable].',
        '2. [PARENTING TIME SCHEDULE]: The recommended schedule provides for [DESCRIPTION], with [HOLIDAY/VACATION PROVISIONS]. Transitions should occur at [LOCATION/METHOD].',
        '3. [THERAPEUTIC SERVICES]: Individual therapy is recommended for [CHILD NAME] to address [SPECIFIC CONCERNS], with a therapist selected jointly by both parents. Co-parenting counseling is [RECOMMENDED/NOT RECOMMENDED] to address [ISSUES].',
        '4. [COMMUNICATION]: The parents are encouraged to use [COMMUNICATION METHOD, e.g., a co-parenting application] to minimize direct conflict and create a written record of agreements.',
        '5. [RE-EVALUATION]: A review of the parenting arrangement in [TIMEFRAME] is recommended to assess the children\'s adjustment and any changes in circumstances.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 3: Violence Risk Assessment
// ---------------------------------------------------------------------------

const RISK_ASSESSMENT_TEMPLATE: ReportTemplate = {
  id: 'report_risk_assessment',
  evalType: 'Risk Assessment',
  title: 'Violence Risk Assessment',
  subtitle: 'Structured Professional Judgment',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The referring party requested an evaluation of {{PATIENT_NAME}}\'s risk for future violence, the risk factors contributing to that risk, and recommended risk management strategies. The evaluation uses a structured professional judgment (SPJ) approach informed by the HCR-20 Version 3 (Historical-Clinical-Risk Management-20; Douglas, Hart, Webster, & Belfrage, 2013). This report does not produce a single numerical probability of violence. Instead, it identifies risk factors, describes the nature and severity of anticipated violence, identifies likely scenarios, and recommends management strategies.',
      ],
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        ...PROCEDURES_BOILERPLATE,
        'Coding of risk factors on the HCR-20 Version 3',
        'Administration of the Psychopathy Checklist, Revised (PCL-R) or Psychopathy Checklist: Screening Version (PCL:SV)',
        'Administration of the Personality Assessment Inventory (PAI)',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Criminal history records, including adult and juvenile records',
        'Arrest reports and police narratives for the index offense and prior violent offenses',
        'Pre-sentence investigation report',
        'Institutional disciplinary and classification records',
        'Institutional mental health treatment records',
        'Prior psychiatric and psychological evaluation reports',
        'Prior risk assessment reports, if any',
        'Community supervision records (probation/parole)',
        'Victim impact statements, where available',
      ],
    },
    {
      heading: 'Relevant Background',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [INCARCERATED AT/ON SUPERVISION IN/RESIDING IN]. The examinee was referred for risk assessment in connection with [CONTEXT, e.g., parole consideration, civil commitment review, sentencing].',
        'The examinee was raised in [LOCATION] by [CAREGIVERS]. The home environment was characterized by [DESCRIPTION]. The examinee reported [PRESENCE/ABSENCE] of childhood physical abuse, sexual abuse, witnessing domestic violence, and parental substance use. The examinee first came to the attention of the juvenile justice system at age [AGE] for [OFFENSE].',
        'Educational history includes [HIGHEST LEVEL COMPLETED]. The examinee reported [HISTORY OF SCHOOL BEHAVIORAL PROBLEMS/SUSPENSIONS/EXPULSIONS/SPECIAL EDUCATION PLACEMENT]. Employment history has been [STABLE/UNSTABLE], with the longest period of continuous employment being [DURATION] at [TYPE OF WORK].',
        'Relationship history includes [NUMBER] significant intimate partnerships. The examinee described these relationships as [DESCRIPTION]. There [IS/IS NOT] a documented history of intimate partner violence, including [SPECIFIC INCIDENTS IF APPLICABLE].',
        'Substance use history includes [SUBSTANCES] beginning at age [AGE]. The examinee described [PATTERN AND SEVERITY]. The examinee has completed [NUMBER] substance treatment programs. The examinee reported last using [SUBSTANCE] on [DATE]. The relationship between substance use and violent behavior in this examinee\'s history is [DESCRIPTION].',
        'Psychiatric history includes [DIAGNOSES, TREATMENT HISTORY, HOSPITALIZATIONS]. The examinee is currently prescribed [MEDICATIONS] and reports [COMPLIANCE/NONCOMPLIANCE]. The relationship between psychiatric symptoms and violent behavior in this examinee\'s history is [DESCRIPTION].',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared the stated age of [AGE]. Grooming and hygiene were [DESCRIPTION]. The examinee was [COOPERATIVE/GUARDED/HOSTILE] with the evaluation process. Eye contact was [DESCRIPTION]. Psychomotor activity was [NORMAL/AGITATED/RETARDED].',
        'Speech was [RATE, RHYTHM, VOLUME]. Mood was described as "[PATIENT\'S WORDS]." Affect was [DESCRIPTION]. Thought process was [LINEAR/CIRCUMSTANTIAL/TANGENTIAL]. Thought content was notable for [DESCRIPTION]. The examinee [DENIED/ENDORSED] current suicidal and homicidal ideation. There was [NO EVIDENCE/EVIDENCE] of hallucinations or delusions.',
        'Cognition was grossly [INTACT/IMPAIRED]. The examinee was oriented to person, place, date, and situation. Attention and concentration were [ADEQUATE/IMPAIRED]. Insight into the factors contributing to past violent behavior was [GOOD/LIMITED/POOR]. Judgment appeared [ADEQUATE/IMPAIRED].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'Personality Assessment Inventory (PAI): The examinee produced a [VALID/INVALID] profile. Validity scale findings: Inconsistency (ICN) = [SCORE]T, Infrequency (INF) = [SCORE]T, Negative Impression (NIM) = [SCORE]T, Positive Impression (PIM) = [SCORE]T. The clinical profile was characterized by elevations on [SCALES AND SCORES]. Of particular relevance to the risk assessment, [SPECIFIC FINDINGS, e.g., AGG-A (Aggressive Attitude) = SCORE, AGG-P (Aggressive Behavior) = SCORE, ANT (Antisocial Features) = SCORE, VPI (Violence Potential Index) = SCORE].',
        'Psychopathy Checklist, Revised (PCL-R): The examinee obtained a Total score of [SCORE] (Factor 1 = [SCORE]; Factor 2 = [SCORE]). This score falls [BELOW/WITHIN/ABOVE] the range typically associated with a designation of psychopathy in [FORENSIC/CORRECTIONAL] settings (cutoff of 30). The interpersonal and affective features (Factor 1) were [PROMINENT/NOT PROMINENT], as evidenced by [BEHAVIORAL EXAMPLES]. The antisocial lifestyle features (Factor 2) were [PROMINENT/NOT PROMINENT], as evidenced by [BEHAVIORAL EXAMPLES].',
        'Performance validity and symptom validity testing: [INSTRUMENT(S)] were administered. Results indicated [ADEQUATE/INADEQUATE] effort and [NO EVIDENCE/EVIDENCE] of symptom exaggeration. The examinee\'s self-report is considered [RELIABLE/UNRELIABLE] for purposes of this evaluation.',
      ],
    },
    {
      heading: 'Historical Risk Factors',
      body: [
        'H1, Violence: The examinee has a documented history of [NUMBER] violent acts, beginning at age [AGE]. The most serious prior violent act involved [DESCRIPTION]. The pattern of prior violence is characterized by [INSTRUMENTAL/REACTIVE/MIXED] aggression, directed toward [VICTIM TYPES]. Severity has [ESCALATED/REMAINED STABLE/DE-ESCALATED] over time. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H2, Other Antisocial Behavior: The examinee has a history of [DESCRIPTION OF NON-VIOLENT CRIMINAL AND ANTISOCIAL BEHAVIOR]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H3, Relationships: The examinee has [NEVER/RARELY/INTERMITTENTLY] maintained stable intimate relationships. The quality of family and peer relationships has been characterized by [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H4, Employment: Employment history has been characterized by [CHRONIC UNEMPLOYMENT/INSTABILITY/TERMINATED POSITIONS]. The longest period of sustained employment was [DURATION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H5, Substance Use: Substance use has been a [MAJOR/MINOR/ABSENT] factor in the examinee\'s history. The relationship between substance use and violence is [DIRECT/INDIRECT/ABSENT]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H6, Major Mental Disorder: The examinee [HAS/HAS NOT] been diagnosed with a major mental disorder ([DIAGNOSIS]). The temporal relationship between active symptoms and violent behavior is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H7, Personality Disorder: The examinee [DOES/DOES NOT] present with features consistent with [PERSONALITY DISORDER]. PCL-R findings [SUPPORT/DO NOT SUPPORT] a pattern of psychopathic traits. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H8, Traumatic Experiences: The examinee reports [HISTORY OF TRAUMA]. The connection between trauma history and violent behavior patterns is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H9, Violent Attitudes: The examinee expressed attitudes toward violence that were [DESCRIPTION]. The examinee [DID/DID NOT] endorse beliefs that violence is an acceptable means of conflict resolution. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'H10, Treatment or Supervision Response: The examinee\'s history of response to prior treatment and supervision has been [DESCRIPTION]. Prior supervision violations include [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
      ],
    },
    {
      heading: 'Clinical Risk Factors',
      body: [
        'C1, Insight: The examinee demonstrated [GOOD/PARTIAL/POOR] insight into mental disorder, risk factors for violence, and the need for treatment. Specifically, the examinee [DESCRIPTION OF INSIGHT OR LACK THEREOF]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'C2, Violent Ideation or Intent: The examinee [DENIED/ENDORSED] current thoughts, fantasies, or plans involving violence. [IF ENDORSED: DESCRIPTION OF CONTENT, TARGET, PLAN SPECIFICITY]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'C3, Symptoms of Major Mental Disorder: The examinee currently [DOES/DOES NOT] exhibit active symptoms of [DISORDER]. Current symptoms include [DESCRIPTION]. The relationship between current symptoms and violence risk is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'C4, Instability: The examinee\'s current functioning is characterized by [STABILITY/INSTABILITY] in the areas of [AFFECT, BEHAVIOR, COGNITION]. Recent destabilizing events include [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'C5, Treatment or Supervision Response: The examinee\'s current response to treatment and supervision is [DESCRIPTION]. Compliance with medication, programming, and supervisory conditions is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
      ],
    },
    {
      heading: 'Risk Management Factors',
      body: [
        'R1, Professional Services and Plans: The availability and quality of professional services in the anticipated setting is [DESCRIPTION]. The examinee [HAS/HAS NOT] been connected with [MENTAL HEALTH TREATMENT, SUBSTANCE TREATMENT, CASE MANAGEMENT]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'R2, Living Situation: The anticipated living arrangement is [DESCRIPTION]. Stability, exposure to destabilizers (substances, antisocial peers, weapons access), and access to potential victims are [ASSESSED]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'R3, Personal Support: The examinee\'s prosocial support network includes [DESCRIPTION]. The quality and willingness of these supports to assist with risk management is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'R4, Treatment or Supervision Response: The examinee\'s anticipated response to future treatment and supervision, based on historical patterns and current engagement, is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
        'R5, Stress or Coping: Anticipated stressors in the release environment include [DESCRIPTION]. The examinee\'s demonstrated coping resources include [DESCRIPTION]. The gap between anticipated stressors and coping capacity is [DESCRIPTION]. This item is coded as [PRESENT/POSSIBLY PRESENT/ABSENT].',
      ],
    },
    {
      heading: 'Formulation',
      body: [
        'The primary drivers of risk in {{PATIENT_NAME}}\'s case are [IDENTIFICATION OF KEY RISK FACTORS AND THEIR INTERRELATIONSHIP]. The examinee\'s history of violence has been characterized by [PATTERN], and the conditions under which violence has occurred in the past have consistently involved [PRECIPITANTS].',
        'The clinical picture is [COMPLICATED/CLARIFIED] by [SPECIFIC FACTORS, e.g., co-occurring substance use and psychotic symptoms, psychopathic personality features, treatment noncompliance]. The examinee\'s current mental state [DOES/DOES NOT] mirror the conditions present during prior violent episodes.',
        'Protective factors include [DESCRIPTION, e.g., age-related desistance, stable relationship, employment, medication compliance, demonstrated prosocial coping skills]. These protective factors [ARE/ARE NOT] sufficient to offset the identified risk factors given the anticipated setting.',
      ],
    },
    {
      heading: 'Scenario Planning',
      body: [
        'Most likely scenario: Based on the pattern of prior violence and current risk factors, the most likely violent scenario involves [WHO: victim type, WHAT: nature of violence, WHERE: setting, WHEN: precipitating conditions, HOW: method]. The estimated time horizon for this scenario is [SHORT-TERM/MEDIUM-TERM/LONG-TERM]. The conditions that would make this scenario more likely include [DESTABILIZERS]. The conditions that would make it less likely include [PROTECTIVE FACTORS AND MANAGEMENT STRATEGIES].',
        'Worst-case scenario: The most severe plausible scenario involves [DESCRIPTION]. This scenario would be more likely if [CONDITIONS]. Although less probable than the above scenario, it warrants planning because [REASONING].',
      ],
    },
    {
      heading: 'Summary Risk Judgment',
      body: [
        'Based on the structured professional judgment analysis described above, the examiner rates {{PATIENT_NAME}}\'s risk for future violence as [LOW/MODERATE/HIGH] for the [TIME HORIZON] in the context of [SPECIFIED SETTING].',
        'This judgment is based on the following key considerations: [NUMBERED LIST OF PRIMARY FACTORS DRIVING THE RATING]. The judgment assumes [SPECIFIC CONDITIONS, e.g., that the examinee will receive recommended treatment, that supervision conditions will be enforced]. If these conditions change, the risk level may change accordingly.',
        'This risk rating reflects the examiner\'s clinical judgment informed by the HCR-20V3 framework. It is not a prediction that violence will or will not occur. It is an assessment of the presence and relevance of empirically supported risk factors, applied to the specific circumstances of this case.',
      ],
    },
    {
      heading: 'Risk Management Recommendations',
      body: [
        '1. Monitoring: [SPECIFIC MONITORING RECOMMENDATIONS, e.g., frequency of supervision contacts, substance testing schedule, GPS monitoring, curfew conditions, weapon restrictions].',
        '2. Treatment: [SPECIFIC TREATMENT RECOMMENDATIONS, e.g., psychiatric medication management with named medications if applicable, individual psychotherapy targeting specific criminogenic needs, substance abuse treatment modality, anger management programming].',
        '3. Supervision: [SPECIFIC SUPERVISION CONDITIONS, e.g., residential restrictions, association restrictions, employment requirements, reporting conditions].',
        '4. Victim Safety: [IF APPLICABLE: specific recommendations for victim notification, no-contact orders, geographic restrictions].',
        '5. Re-evaluation: This risk assessment should be updated in [TIMEFRAME] or sooner if there is a significant change in the examinee\'s circumstances, mental state, or behavior.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 4: Fitness for Duty Evaluation
// ---------------------------------------------------------------------------

const FFD_TEMPLATE: ReportTemplate = {
  id: 'report_fitness_for_duty',
  evalType: 'Fitness for Duty',
  title: 'Fitness for Duty Evaluation',
  subtitle: 'Psychological Fitness for Continued Employment',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The referring employer, [AGENCY/DEPARTMENT NAME], requested a fitness for duty evaluation (FFDE) of {{PATIENT_NAME}} to determine whether the employee is psychologically fit to perform the essential functions of the position of [JOB TITLE] safely and effectively. The evaluation was triggered by [BRIEF DESCRIPTION OF TRIGGERING EVENT]. This evaluation is conducted consistent with the International Association of Chiefs of Police (IACP) Psychological Services Section guidelines for fitness for duty evaluations (2018) and applicable ADA requirements. The scope of this evaluation is limited to the question of fitness; it is not a general psychological evaluation.',
      ],
    },
    {
      heading: 'Notice of Limits on Confidentiality',
      body: [
        'The employee was informed, both verbally and in writing, that this evaluation is being conducted at the request of the employer, not for treatment purposes. The employee was advised that information obtained during the evaluation would be included in a written report provided to the employer and that the scope of disclosure is limited to information directly relevant to the fitness determination. The employee was informed that the usual rules of doctor-patient confidentiality do not apply in this context. The employee was also advised of the right to decline participation, with the understanding that a refusal would be reported to the employer and might result in administrative action. The employee signed a written acknowledgment of these limits and voluntarily agreed to participate.',
      ],
    },
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        'Review of position description and essential job functions for [JOB TITLE]',
        'Review of the triggering incident documentation provided by the employer',
        'Review of personnel records, performance evaluations, and disciplinary history provided by the employer',
        'Review of medical and mental health records authorized by the employee',
        'Clinical interview with the employee, approximately [HOURS] hours',
        'Standardized psychological testing (see Test Results)',
        'Symptom validity and performance validity testing',
        'Collateral interview with [SUPERVISOR/COMMANDING OFFICER NAME AND TITLE], on [DATE]',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Position description and essential functions for [JOB TITLE], dated [DATE]',
        'Internal affairs investigation report(s), case number(s) [NUMBER], dated [DATE]',
        'Incident reports dated [DATES]',
        'Performance evaluations for the past [NUMBER] years',
        'Disciplinary actions and letters of reprimand, if any',
        'Training records, including use-of-force training and de-escalation training completion',
        'Medical records from [PROVIDER] authorized by the employee',
        'Mental health records from [PROVIDER] authorized by the employee',
        'Prior fitness for duty evaluation(s), dated [DATE], if any',
        'Employee Assistance Program (EAP) utilization records, if authorized by the employee',
      ],
    },
    {
      heading: 'Essential Job Functions',
      body: [
        'The position of [JOB TITLE] with [AGENCY] requires the following psychological capacities, as derived from the position description and the IACP guidelines: (1) the ability to exercise sound judgment and make decisions under conditions of acute stress and ambiguity; (2) the ability to interact effectively and professionally with the public, colleagues, and supervisors; (3) the ability to control emotional reactions and maintain composure during confrontational or high-risk encounters; (4) the ability to carry and, if necessary, deploy a firearm or other use-of-force instruments with appropriate judgment [IF APPLICABLE]; (5) the ability to work rotating shifts and tolerate irregular schedules without significant impairment; (6) the ability to maintain the alertness and concentration necessary for safe performance of duties; and (7) the ability to accept and respond appropriately to supervisory direction and organizational authority.',
      ],
    },
    {
      heading: 'Relevant Background',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [GENDER] who has been employed with [AGENCY] for [DURATION] in the capacity of [JOB TITLE]. The employee reported [PRIOR LAW ENFORCEMENT/PUBLIC SAFETY EXPERIENCE]. The employee described work performance prior to the triggering incident(s) as [DESCRIPTION]. The employee reported [NUMBER] prior internal affairs investigations, resulting in [OUTCOMES].',
        'The employee reported a psychiatric history of [DESCRIPTION, OR DENIED PRIOR TREATMENT]. The employee is currently [TAKING/NOT TAKING] psychotropic medications, specifically [MEDICATIONS AND DOSAGES]. The employee [DENIED/ENDORSED] current substance use, including alcohol use of [FREQUENCY AND QUANTITY]. The employee reported last consuming alcohol on [DATE].',
        'Personal stressors identified by the employee include [DESCRIPTION, e.g., marital difficulties, financial pressures, family illness, recent loss, child-related stress]. The employee reported sleep of approximately [HOURS] per night and described sleep quality as [DESCRIPTION]. The employee [DENIED/ENDORSED] symptoms of depression, anxiety, posttraumatic stress, and anger/irritability.',
        'The employee reported [NUMBER] critical incidents during the course of employment, including [BRIEF DESCRIPTIONS]. The employee [HAS/HAS NOT] participated in critical incident debriefing. The employee described coping with occupational stress through [METHODS].',
      ],
    },
    {
      heading: 'Triggering Concerns',
      body: [
        'According to documents provided by the employer, the referral for FFDE was prompted by [DETAILED DESCRIPTION OF TRIGGERING EVENT(S), DATES, AND CIRCUMSTANCES]. The employer specifically identified the following concerns: [ENUMERATED CONCERNS FROM THE REFERRAL LETTER].',
        'The employee\'s account of the triggering incident(s) is as follows: [EMPLOYEE\'S VERSION]. The employee attributed the incident(s) to [EMPLOYEE\'S EXPLANATION]. Points of agreement between the employer\'s account and the employee\'s account include [AREAS OF AGREEMENT]. Points of disagreement include [AREAS OF DISAGREEMENT].',
        'The employee\'s supervisor, [NAME AND TITLE], reported the following additional concerns during a collateral interview on [DATE]: [SUPERVISOR\'S OBSERVATIONS]. The supervisor described the employee\'s performance trajectory as [DESCRIPTION] and noted [SPECIFIC BEHAVIORAL CHANGES OBSERVED].',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN/YOUNGER THAN] the stated age of [AGE]. The employee was dressed in [ATTIRE] and was [WELL/ADEQUATELY/POORLY] groomed. The employee arrived [ON TIME/LATE] and was [COOPERATIVE/GUARDED/DEFENSIVE/HOSTILE] throughout the evaluation. The employee\'s attitude toward the evaluation was characterized by [DESCRIPTION].',
        'Speech was [RATE, VOLUME, RHYTHM]. The employee was [SPONTANEOUS/REQUIRED PROMPTING]. Mood was described as "[EMPLOYEE\'S WORDS]." Affect was [RANGE, CONGRUENCE, APPROPRIATENESS]. The employee became [TEARFUL/ANGRY/FLAT] when discussing [TOPIC].',
        'Thought process was [LINEAR AND GOAL-DIRECTED/CIRCUMSTANTIAL/TANGENTIAL]. Thought content was notable for [DESCRIPTION]. The employee [DENIED/ENDORSED] suicidal ideation, homicidal ideation, and intent to harm self or others. There was [NO EVIDENCE/EVIDENCE] of psychotic symptoms.',
        'Cognition was grossly intact. The employee was oriented in all spheres. Attention and concentration appeared [ADEQUATE/IMPAIRED] during the interview. Insight into the concerns that prompted the evaluation was [GOOD/PARTIAL/POOR]. Judgment, as assessed by the employee\'s response to the evaluation process and understanding of the situation, was [GOOD/FAIR/POOR].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'Minnesota Multiphasic Personality Inventory-3 (MMPI-3): The employee produced a [VALID/INVALID] profile. Validity indicators: CNS = [SCORE], TRIN-r = [SCORE]T, VRIN-r = [SCORE]T, F-r = [SCORE]T, Fp-r = [SCORE]T, Fs = [SCORE]T, FBS-r = [SCORE]T, L-r = [SCORE]T, K-r = [SCORE]T. [IF INVALID: The profile is considered invalid due to REASON and interpretation of the clinical scales is precluded.] [IF VALID: The clinical profile was characterized by DESCRIPTION OF ELEVATIONS AND INTERPRETATION]. Scales of particular relevance to the fitness question include [SPECIFIC SCALES AND INTERPRETATION].',
        'Personality Assessment Inventory (PAI): The employee produced a [VALID/INVALID] profile. Validity indicators: ICN = [SCORE]T, INF = [SCORE]T, NIM = [SCORE]T, PIM = [SCORE]T. The clinical profile was characterized by [DESCRIPTION]. Of note, the following scales were elevated: [SCALES AND INTERPRETATIONS RELEVANT TO FITNESS].',
        'Trauma Symptom Inventory-2 (TSI-2) [IF TRAUMA CONCERN]: The employee\'s profile was [VALID/INVALID]. Elevated scales included [SCALES], consistent with [INTERPRETATION].',
        'Performance validity testing ([INSTRUMENT]): The employee scored [SCORE], which [DOES/DOES NOT] exceed the cutoff for adequate effort. Symptom validity testing ([INSTRUMENT]): The employee scored [SCORE], indicating [CREDIBLE/NONCREDIBLE] symptom presentation.',
      ],
    },
    {
      heading: 'Job-Related Functional Analysis',
      body: [
        'The following analysis maps the clinical findings to the essential job functions identified above.',
        'Judgment under stress: The employee\'s current capacity for sound judgment under stress is [ADEQUATE/COMPROMISED]. This assessment is based on [TEST FINDINGS, BEHAVIORAL OBSERVATIONS, AND INCIDENT HISTORY]. [SPECIFIC EXAMPLES OF HOW CURRENT SYMPTOMS OR PERSONALITY FEATURES MAY AFFECT JUDGMENT].',
        'Interpersonal functioning: The employee\'s ability to interact effectively with the public, colleagues, and supervisors is [ADEQUATE/COMPROMISED]. Testing revealed [RELEVANT FINDINGS]. The triggering incident(s) [DO/DO NOT] reflect a pattern of interpersonal dysfunction. [SPECIFIC EXAMPLES].',
        'Emotional regulation: The employee\'s ability to control emotional reactions and maintain composure is [ADEQUATE/COMPROMISED]. Testing and interview findings suggest [DESCRIPTION]. The employee\'s history of [CRITICAL INCIDENTS/PERSONAL STRESSORS] [HAS/HAS NOT] affected emotional regulation capacity.',
        'Firearms judgment [IF APPLICABLE]: The employee\'s psychological capacity for safe firearms handling and appropriate use-of-force decision-making is [ADEQUATE/COMPROMISED]. This assessment is based on [SPECIFIC FINDINGS].',
        'Alertness and concentration: The employee\'s current capacity to maintain the alertness and concentration required for safe performance is [ADEQUATE/COMPROMISED]. The employee reports [SLEEP PATTERN, SUBSTANCE USE, MEDICATION EFFECTS].',
        'Response to authority: The employee\'s capacity to accept and respond appropriately to supervisory direction is [ADEQUATE/COMPROMISED]. This assessment is based on [INTERVIEW FINDINGS, PERSONNEL RECORD, TEST DATA].',
      ],
    },
    {
      heading: 'Clinical Formulation',
      body: [
        'Based on the totality of data gathered in this evaluation, {{PATIENT_NAME}} presents with [CLINICAL SUMMARY]. The current clinical picture [IS/IS NOT] consistent with a diagnosable mental health condition. Specifically, the employee meets criteria for [DIAGNOSIS per DSM-5-TR, OR: does not meet criteria for a diagnosable condition at this time].',
        'The relationship between the clinical findings and the employee\'s job-relevant functioning is as follows: [DESCRIPTION OF HOW SYMPTOMS/TRAITS MAP TO FUNCTIONAL DEFICITS, IF ANY]. The triggering incident(s) [ARE/ARE NOT] attributable to the identified clinical condition. [ALTERNATIVE EXPLANATIONS IF APPLICABLE, e.g., personality style, situational factors, volitional misconduct].',
        'Symptom validity and performance validity findings [SUPPORT/DO NOT SUPPORT] the credibility of the employee\'s self-reported symptoms. The examiner\'s overall confidence in the clinical data is [HIGH/MODERATE/LOW], based on [REASONING].',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, it is this examiner\'s opinion that {{PATIENT_NAME}} is:',
        '[SELECT ONE]:',
        'Fit for Duty: The employee does not present with a psychological condition that impairs the ability to perform the essential functions of the position of [JOB TITLE] safely and effectively at this time.',
        'Fit for Duty with Conditions: The employee is fit to return to duty provided the following conditions are met: [SPECIFIC CONDITIONS, e.g., continued treatment, medication compliance, supervisory monitoring, temporary duty restrictions, follow-up evaluation].',
        'Temporarily Unfit for Duty: The employee is not currently fit to perform the essential functions of the position due to [CONDITION]. The condition is expected to be treatable, and restoration to fitness is reasonably anticipated within [TIMEFRAME], provided the employee engages in [RECOMMENDED TREATMENT].',
        'Unfit for Duty: The employee is not fit to perform the essential functions of the position due to [CONDITION], and the prognosis for restoration to fitness within a reasonable period is [POOR/GUARDED].',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '1. Treatment: [SPECIFIC TREATMENT RECOMMENDATIONS, e.g., individual psychotherapy with a clinician experienced in law enforcement/first responder issues, psychiatric medication evaluation, substance treatment]. Treatment should target [SPECIFIC GOALS].',
        '2. Return-to-duty conditions [IF APPLICABLE]: [SPECIFIC CONDITIONS, e.g., modified duty assignment, partner assignment, removal from specific duties, administrative assignment pending treatment completion].',
        '3. Follow-up evaluation: A follow-up fitness evaluation is recommended in [TIMEFRAME] to assess treatment progress and readiness for [FULL DUTY/CONTINUED MODIFIED DUTY].',
        '4. Scope of disclosure: Consistent with ADA requirements and IACP guidelines, the employer is advised to limit disclosure of this report to individuals with a need to know. The employee\'s specific diagnoses and treatment details should not be disclosed beyond what is necessary for the fitness determination and accommodation process.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 5: PTSD Diagnostic Evaluation
// ---------------------------------------------------------------------------

const PTSD_TEMPLATE: ReportTemplate = {
  id: 'report_ptsd_dx',
  evalType: 'PTSD Dx',
  title: 'PTSD Diagnostic Evaluation',
  subtitle: 'DSM-5-TR Posttraumatic Stress Disorder Assessment',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The referring party, {{REFERRING_PARTY}}, requested a diagnostic evaluation of {{PATIENT_NAME}} to determine whether the evaluee currently meets DSM-5-TR criteria for Posttraumatic Stress Disorder (309.81, F43.10), to identify any related or alternative diagnoses, to assess the relationship between the claimed traumatic event and the current clinical presentation, and to offer treatment recommendations. This evaluation was requested in the context of [LITIGATION/WORKERS COMPENSATION CLAIM/DISABILITY DETERMINATION/CLINICAL REFERRAL].',
      ],
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        ...PROCEDURES_BOILERPLATE,
        'Administration of the Clinician-Administered PTSD Scale for DSM-5 (CAPS-5)',
        'Administration of the PTSD Checklist for DSM-5 (PCL-5)',
        'Administration of the Detailed Assessment of Posttraumatic Stress (DAPS)',
        'Administration of the Beck Depression Inventory-II (BDI-II)',
        'Administration of the Miller Forensic Assessment of Symptoms Test (M-FAST)',
        'Administration of the Test of Memory Malingering (TOMM)',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Pre-incident mental health records from [PROVIDER], dated [RANGE]',
        'Post-incident mental health treatment records from [PROVIDER], dated [RANGE]',
        'Medical records from [PROVIDER] related to the claimed traumatic event',
        'Incident report/police report/military records dated [DATE]',
        'Employment records, including pre-incident performance evaluations',
        'Disability application or workers compensation claim documents',
        'Prior psychological or psychiatric evaluation reports',
        'Deposition transcripts, if applicable',
      ],
    },
    {
      heading: 'Relevant Background',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is [CURRENTLY EMPLOYED AS/FORMERLY EMPLOYED AS/CURRENTLY UNEMPLOYED SINCE]. The evaluee was referred in connection with [CONTEXT OF REFERRAL].',
        'The evaluee reported a [UNREMARKABLE/NOTABLE] developmental history. The evaluee was raised in [LOCATION] by [CAREGIVERS] and described the childhood home as [DESCRIPTION]. The evaluee [DENIED/ENDORSED] childhood physical abuse, sexual abuse, and other adverse childhood experiences. The evaluee completed [EDUCATION LEVEL] and has worked primarily as [OCCUPATIONAL HISTORY].',
        'Prior trauma history: The evaluee reported the following traumatic events prior to the index event: [LIST WITH APPROXIMATE DATES AND BRIEF DESCRIPTIONS]. The evaluee [DID/DID NOT] seek treatment following these events. The evaluee [DENIED/ENDORSED] prior symptoms of PTSD, anxiety, or depression following earlier traumatic exposure.',
        'Psychiatric history prior to the index event: The evaluee [DENIED/ENDORSED] prior mental health treatment. [IF ENDORSED: The evaluee was treated by PROVIDER for CONDITION from DATE to DATE. Treatment included INTERVENTIONS. The evaluee described the outcome as DESCRIPTION.] The evaluee [DENIED/ENDORSED] prior psychiatric hospitalizations, suicide attempts, and self-harm behavior.',
        'Substance use history: The evaluee reported [PRE-INCIDENT SUBSTANCE USE PATTERN]. Since the index event, the evaluee reported [CHANGE IN SUBSTANCE USE, IF ANY]. The evaluee [DENIED/ENDORSED] prior substance treatment.',
        'Current functioning: The evaluee described a typical day as [DESCRIPTION]. The evaluee reported [CURRENT OCCUPATIONAL STATUS, SOCIAL FUNCTIONING, SLEEP PATTERN, APPETITE, ENERGY LEVEL]. The evaluee described the impact of symptoms on daily functioning as [DESCRIPTION].',
      ],
    },
    {
      heading: 'Traumatic Event History',
      body: [
        'Index event: The evaluee described the following event as the primary traumatic experience at issue in this evaluation. On [DATE], the evaluee [DETAILED DESCRIPTION OF THE EVENT IN THE EVALUEE\'S OWN WORDS, WITH SPECIFIC SENSORY DETAILS AND EMOTIONAL REACTIONS]. The evaluee reported that during the event, the evaluee experienced [FEAR/HELPLESSNESS/HORROR/DISSOCIATION/OTHER PERITRAUMATIC REACTIONS]. The evaluee believed that [NATURE OF PERCEIVED THREAT: death, serious injury, sexual violence].',
        'Criterion A analysis: The described event [DOES/DOES NOT] meet DSM-5-TR Criterion A for PTSD. Specifically, the evaluee [WAS DIRECTLY EXPOSED TO/WITNESSED/LEARNED ABOUT/WAS REPEATEDLY EXPOSED TO AVERSIVE DETAILS OF] [ACTUAL OR THREATENED DEATH/SERIOUS INJURY/SEXUAL VIOLENCE]. The basis for this determination is [DESCRIPTION OF HOW THE EVENT MAPS TO CRITERION A, WITH REFERENCE TO CORROBORATING RECORDS WHERE AVAILABLE].',
        'The evaluee reported that symptoms began [IMMEDIATELY AFTER/WITHIN DAYS OF/WITHIN WEEKS OF/MONTHS AFTER] the index event. The first symptoms noticed were [DESCRIPTION]. The evaluee first sought treatment on [DATE], approximately [TIMEFRAME] after the event.',
      ],
    },
    {
      heading: 'Symptom Review',
      body: [
        'The following symptom review is organized by DSM-5-TR criteria for PTSD (309.81, F43.10). Each criterion cluster is assessed based on clinical interview, the CAPS-5, and corroborating self-report and record data.',
        'Criterion B, Intrusion symptoms (one or more required): The evaluee [ENDORSED/DENIED] recurrent, involuntary, and intrusive distressing memories of the event, occurring [FREQUENCY]. The evaluee [ENDORSED/DENIED] recurrent distressing dreams related to the event, occurring [FREQUENCY]. The evaluee [ENDORSED/DENIED] dissociative reactions (flashbacks) in which the evaluee feels or acts as if the event were recurring, occurring [FREQUENCY AND DESCRIPTION]. The evaluee [ENDORSED/DENIED] intense or prolonged psychological distress at exposure to cues resembling the event, triggered by [SPECIFIC CUES]. The evaluee [ENDORSED/DENIED] marked physiological reactions to such cues, including [SPECIFIC REACTIONS]. CAPS-5 Cluster B severity: [SCORE].',
        'Criterion C, Avoidance (one or more required): The evaluee [ENDORSED/DENIED] avoidance of distressing memories, thoughts, or feelings associated with the event. The evaluee [ENDORSED/DENIED] avoidance of external reminders (people, places, conversations, activities, objects, situations) that arouse such distress. Specific avoidance behaviors include [DESCRIPTION]. CAPS-5 Cluster C severity: [SCORE].',
        'Criterion D, Negative alterations in cognitions and mood (two or more required): The evaluee [ENDORSED/DENIED] inability to remember an important aspect of the event. The evaluee [ENDORSED/DENIED] persistent and exaggerated negative beliefs about oneself, others, or the world, specifically [DESCRIPTION]. The evaluee [ENDORSED/DENIED] persistent distorted cognitions about the cause or consequences of the event that lead to blame of self or others. The evaluee [ENDORSED/DENIED] persistent negative emotional state ([FEAR/HORROR/ANGER/GUILT/SHAME]). The evaluee [ENDORSED/DENIED] markedly diminished interest in significant activities, specifically [ACTIVITIES]. The evaluee [ENDORSED/DENIED] feelings of detachment or estrangement from others. The evaluee [ENDORSED/DENIED] persistent inability to experience positive emotions. CAPS-5 Cluster D severity: [SCORE].',
        'Criterion E, Alterations in arousal and reactivity (two or more required): The evaluee [ENDORSED/DENIED] irritable behavior and angry outbursts, described as [DESCRIPTION]. The evaluee [ENDORSED/DENIED] reckless or self-destructive behavior, including [DESCRIPTION]. The evaluee [ENDORSED/DENIED] hypervigilance, manifested as [DESCRIPTION]. The evaluee [ENDORSED/DENIED] exaggerated startle response, triggered by [STIMULI]. The evaluee [ENDORSED/DENIED] problems with concentration. The evaluee [ENDORSED/DENIED] sleep disturbance, including [DESCRIPTION OF SLEEP ONSET DIFFICULTY, MAINTENANCE DIFFICULTY, NIGHTMARES]. CAPS-5 Cluster E severity: [SCORE].',
        'Criterion F, Duration: Symptoms have been present for [DURATION], which [DOES/DOES NOT] exceed the one-month minimum required by DSM-5-TR.',
        'Criterion G, Functional impairment: Symptoms cause clinically significant distress and impairment in [SOCIAL, OCCUPATIONAL, AND/OR OTHER] functioning. Specific functional impairment includes [DESCRIPTION OF IMPAIRMENT IN WORK, RELATIONSHIPS, DAILY ACTIVITIES].',
        'Criterion H, Exclusion: The disturbance [IS/IS NOT] attributable to the physiological effects of a substance or another medical condition. [IF ALTERNATIVE EXPLANATIONS EXIST: DESCRIPTION AND REASONING].',
        'Dissociative subtype: The evaluee [DOES/DOES NOT] report persistent or recurrent experiences of depersonalization or derealization. [IF ENDORSED: DESCRIPTION OF EXPERIENCES].',
        'Delayed expression: The evaluee [DOES/DOES NOT] meet the delayed expression specifier (full criteria not met until at least six months after the event, though some symptoms may have begun immediately).',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN] the stated age of [AGE]. The evaluee was dressed in [ATTIRE] and was [GROOMING]. The evaluee was [COOPERATIVE/GUARDED/ANXIOUS] with the evaluation process.',
        'Speech was [RATE, VOLUME, RHYTHM]. The evaluee\'s voice [DID/DID NOT] become [STRAINED/QUIET/PRESSURED] when discussing the traumatic event. Mood was described as "[EVALUEE\'S WORDS]." Affect was [CONSTRICTED/BLUNTED/LABILE/APPROPRIATE], and the evaluee became visibly [TEARFUL/TENSE/AGITATED] when recounting [SPECIFIC TOPIC].',
        'Thought process was [LINEAR/CIRCUMSTANTIAL]. The evaluee [DENIED/ENDORSED] current suicidal ideation, homicidal ideation, and intent to harm self or others. There was no evidence of psychotic symptoms. Thought content was notable for [TRAUMA-RELATED PREOCCUPATIONS, GUILT, HYPERVIGILANT THEMES].',
        'The evaluee was oriented in all spheres. Attention and concentration were [DESCRIPTION], consistent with the evaluee\'s reported concentration difficulties. Insight into the relationship between symptoms and the traumatic event was [GOOD/PARTIAL/POOR]. Judgment appeared [INTACT/MILDLY IMPAIRED].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'Clinician-Administered PTSD Scale for DSM-5 (CAPS-5): The evaluee obtained a total severity score of [SCORE] (range 0-80). Cluster scores: B (Intrusion) = [SCORE], C (Avoidance) = [SCORE], D (Negative Cognitions/Mood) = [SCORE], E (Arousal/Reactivity) = [SCORE]. Using the DSM-5 diagnostic rule (at least one moderate or higher symptom in each required cluster), the evaluee [MEETS/DOES NOT MEET] CAPS-5 criteria for a PTSD diagnosis. The overall severity is in the [MILD/MODERATE/SEVERE/EXTREME] range.',
        'PTSD Checklist for DSM-5 (PCL-5): The evaluee obtained a total score of [SCORE] (range 0-80; clinical cutoff = 31-33). Cluster scores: B = [SCORE], C = [SCORE], D = [SCORE], E = [SCORE]. The self-report pattern is [CONSISTENT/INCONSISTENT] with the CAPS-5 interview findings.',
        'Detailed Assessment of Posttraumatic Stress (DAPS): The evaluee\'s profile was [VALID/INVALID] based on the Positive Bias (PB = [SCORE]T) and Negative Bias (NB = [SCORE]T) scales. Clinical scale findings: [RELEVANT ELEVATED SCALES AND T-SCORES]. The DAPS results [SUPPORT/DO NOT SUPPORT] a diagnosis of PTSD.',
        'Beck Depression Inventory-II (BDI-II): The evaluee obtained a total score of [SCORE], falling in the [MINIMAL/MILD/MODERATE/SEVERE] range of self-reported depressive symptoms. Items endorsed at the highest level include [SPECIFIC ITEMS].',
        'Miller Forensic Assessment of Symptoms Test (M-FAST): The evaluee obtained a total score of [SCORE] (clinical cutoff = 6). The score [DOES/DOES NOT] exceed the cutoff for possible malingering.',
        'Test of Memory Malingering (TOMM): The evaluee scored [TRIAL 1 SCORE]/50, [TRIAL 2 SCORE]/50, and [RETENTION TRIAL SCORE]/50. Scores at or above 45 on Trial 2 indicate adequate effort. The evaluee\'s performance [IS/IS NOT] consistent with adequate effort.',
      ],
    },
    {
      heading: 'Symptom Validity',
      body: [
        'The credibility of the evaluee\'s symptom presentation is a central issue in forensic PTSD evaluations, given the external incentives that may be present. In this case, the evaluee [HAS/DOES NOT HAVE] identifiable external incentives, specifically [DESCRIPTION].',
        'The evaluee\'s performance on dedicated validity measures was as follows: M-FAST = [SCORE] (below/above cutoff), TOMM Trial 2 = [SCORE] (at or above/below cutoff). The DAPS validity scales [DID/DID NOT] suggest over-reporting or under-reporting.',
        'Consistency of presentation: The evaluee\'s self-reported symptoms were [CONSISTENT/INCONSISTENT] across the clinical interview, the CAPS-5, and self-report measures. The evaluee\'s presentation during the interview was [CONSISTENT/INCONSISTENT] with the severity of symptoms reported on questionnaires. Record review revealed [CONSISTENT/INCONSISTENT] symptom reporting across time and providers.',
        'Based on the totality of validity evidence, the examiner considers the evaluee\'s symptom presentation to be [CREDIBLE/NOT FULLY CREDIBLE/NONCREDIBLE]. [IF NOT FULLY CREDIBLE: SPECIFIC BASIS FOR THIS DETERMINATION].',
      ],
    },
    {
      heading: 'Diagnostic Impression',
      body: [
        'Based on the data gathered in this evaluation, the following diagnostic impressions are offered:',
        '[PRIMARY DIAGNOSIS]: Posttraumatic Stress Disorder (309.81, F43.10), [WITH/WITHOUT] dissociative symptoms, [WITH/WITHOUT] delayed expression. Severity: [MILD/MODERATE/SEVERE] based on CAPS-5 total severity score and functional impairment. [OR: The evaluee does not currently meet full DSM-5-TR criteria for PTSD. Specifically, the evaluee does not meet criteria for Cluster [X] because REASONING.]',
        '[IF APPLICABLE, ADDITIONAL DIAGNOSES]: [DIAGNOSIS, CODE]. This condition is [COMORBID WITH/DIFFERENTIAL FROM] PTSD. The basis for this additional diagnosis is [DESCRIPTION].',
        '[IF APPLICABLE, RULE-OUTS]: The following diagnoses were considered and ruled out: [DIAGNOSES AND REASONING FOR EXCLUSION]. Specific differential considerations included Acute Stress Disorder (if within one month), Adjustment Disorder (if Criterion A not met), Major Depressive Disorder (overlapping but distinct symptoms), and Malingered PTSD (addressed in Symptom Validity section).',
      ],
    },
    {
      heading: 'Causation and Nexus',
      body: [
        '[THIS SECTION IS INCLUDED WHEN THE REFERRAL QUESTION REQUIRES A CAUSATION OPINION]',
        'The evaluee\'s current PTSD symptoms [ARE/ARE NOT] causally related to the index event of [DATE]. This opinion is based on the following analysis:',
        'Temporal relationship: Symptoms [BEGAN/WORSENED] within [TIMEFRAME] of the index event. Pre-incident functioning, as documented in [RECORDS], was [DESCRIPTION]. Post-incident functioning declined in the following areas: [DESCRIPTION].',
        'Pre-existing conditions: The evaluee [DID/DID NOT] have pre-existing psychiatric conditions. [IF YES: The evaluee carried a prior diagnosis of DIAGNOSIS, which was STABLE/ACTIVE at the time of the index event. The index event AGGRAVATED/DID NOT AGGRAVATE this pre-existing condition.] The concept of the "eggshell plaintiff" [IS/IS NOT] relevant to this case.',
        'Alternative causes: The examiner considered whether the current symptoms could be attributed to [OTHER TRAUMATIC EVENTS, SUBSTANCE USE, MEDICAL CONDITIONS, LIFE STRESSORS] rather than the index event. [ANALYSIS OF ALTERNATIVE CAUSES AND REASONING].',
        'Conclusion: To a reasonable degree of psychological certainty, the index event of [DATE] is [THE PRIMARY CAUSE/A SUBSTANTIAL CONTRIBUTING CAUSE/NOT A SUBSTANTIAL CAUSE] of the evaluee\'s current clinical presentation.',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, the examiner offers the following opinions:',
        '1. Diagnosis: {{PATIENT_NAME}} [DOES/DOES NOT] currently meet DSM-5-TR criteria for Posttraumatic Stress Disorder (309.81, F43.10). [SEVERITY AND SPECIFIERS].',
        '2. Causation: The claimed traumatic event of [DATE] [IS/IS NOT] a substantial contributing cause of the current clinical presentation. [BRIEF SUPPORTING RATIONALE].',
        '3. Functional impairment: The evaluee\'s symptoms result in [DESCRIPTION OF CURRENT FUNCTIONAL LIMITATIONS] in the areas of [OCCUPATIONAL, SOCIAL, DAILY FUNCTIONING].',
        '4. Prognosis: With appropriate evidence-based treatment, the prognosis is [GOOD/FAIR/GUARDED/POOR]. The basis for this prognosis is [CHRONICITY, COMPLEXITY, COMORBIDITIES, TREATMENT RESPONSE TO DATE].',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '1. Evidence-based PTSD treatment: The evaluee is a candidate for [Prolonged Exposure (PE) / Cognitive Processing Therapy (CPT) / Eye Movement Desensitization and Reprocessing (EMDR)], which are the treatments with the strongest empirical support for PTSD. Treatment should be delivered by a clinician trained in the specific protocol, with fidelity monitoring.',
        '2. Comorbid condition treatment: [IF APPLICABLE: Concurrent treatment for DIAGNOSIS is recommended, including SPECIFIC RECOMMENDATIONS].',
        '3. Psychiatric consultation: [IF APPLICABLE: A psychiatric evaluation for psychotropic medication management is recommended, targeting SPECIFIC SYMPTOMS].',
        '4. Functional rehabilitation: [IF APPLICABLE: Vocational rehabilitation, graduated return-to-work plan, or occupational therapy is recommended to address SPECIFIC FUNCTIONAL DEFICITS].',
        '5. Substance use treatment: [IF APPLICABLE: Treatment for substance use should be [INTEGRATED WITH/SEQUENTIAL TO] PTSD treatment].',
        '6. Follow-up evaluation: A re-evaluation in [TIMEFRAME] is recommended to assess treatment response, symptom trajectory, and updated functional status.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 6: ADHD Diagnostic Evaluation
// ---------------------------------------------------------------------------

const ADHD_TEMPLATE: ReportTemplate = {
  id: 'report_adhd_dx',
  evalType: 'ADHD Dx',
  title: 'ADHD Diagnostic Evaluation',
  subtitle: 'DSM-5-TR Attention-Deficit/Hyperactivity Disorder Assessment',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The referring party, {{REFERRING_PARTY}}, requested a diagnostic evaluation of {{PATIENT_NAME}} to determine whether the evaluee currently meets DSM-5-TR criteria for Attention-Deficit/Hyperactivity Disorder (ADHD), to specify the presentation type and severity, and to provide treatment and accommodation recommendations. The evaluation was requested in the context of [CLINICAL REFERRAL/ACADEMIC ACCOMMODATION REQUEST/WORKPLACE ACCOMMODATION REQUEST/DISABILITY DETERMINATION/FORENSIC REFERRAL]. This evaluation follows best practice guidelines for adult ADHD assessment, including the use of multi-method, multi-informant data collection.',
      ],
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        ...PROCEDURES_BOILERPLATE,
        'Administration of the Diagnostic Interview for ADHD in Adults, Version 5 (DIVA-5)',
        'Administration of the Conners Adult ADHD Rating Scales (CAARS-2), self-report and observer-report forms',
        'Administration of the Wechsler Adult Intelligence Scale, Fourth Edition (WAIS-IV), selected subtests',
        'Administration of the Conners Continuous Performance Test, Third Edition (CPT-3)',
        'Administration of the Wisconsin Card Sorting Test (WCST)',
        'Administration of the Trail Making Test, Parts A and B',
        'Administration of symptom validity measures',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Childhood school records and report cards from [SCHOOL/DISTRICT], grades [RANGE]',
        'Prior psychoeducational or psychological evaluation reports',
        'Prior psychiatric records from [PROVIDER]',
        'Academic accommodation records from [INSTITUTION], if any',
        'Medical records from [PROVIDER], including any neurological workup',
        'Self-report questionnaires completed by the evaluee',
        'Observer-report questionnaires completed by [INFORMANT NAME AND RELATIONSHIP]',
      ],
    },
    {
      heading: 'Developmental History',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [OCCUPATION/STUDENT STATUS]. The evaluee was born [FULL-TERM/PREMATURE] following [UNREMARKABLE/COMPLICATED] pregnancy and delivery. Early developmental milestones for walking, talking, and toilet training were reached [ON TIME/WITH DELAY].',
        'The evaluee reported that behavioral and attention difficulties were first noticed at approximately age [AGE], by [PARENT/TEACHER/SELF]. Specific childhood symptoms included [DESCRIPTION, e.g., difficulty staying seated, losing belongings, daydreaming, blurting out answers, difficulty waiting turns, difficulty completing homework]. Report cards from grades [RANGE] reflect [TEACHER COMMENTS, e.g., "does not work to potential," "needs to pay attention," "fidgets and distracts others"].',
        'The evaluee\'s childhood behavior at home was described as [DESCRIPTION]. The evaluee [WAS/WAS NOT] identified for special education or Section 504 services. The evaluee [WAS/WAS NOT] evaluated for ADHD as a child. [IF EVALUATED: The results of that evaluation were DESCRIPTION.] The evaluee [WAS/WAS NOT] prescribed stimulant medication as a child. [IF PRESCRIBED: The reported response was DESCRIPTION.]',
        'Family history of ADHD or learning difficulties: The evaluee reported that [FAMILY MEMBER(S)] [HAS/HAVE] been diagnosed with or shows symptoms of [ADHD/LEARNING DISABILITY/OTHER]. Family psychiatric history is notable for [DESCRIPTION].',
        'The evaluee described academic performance in [ELEMENTARY/MIDDLE/HIGH SCHOOL/COLLEGE] as [DESCRIPTION]. The evaluee reported [GRADE REPETITIONS/SUSPENSIONS/ACADEMIC PROBATION/STRONG GRADES WITH HIGH EFFORT, IF APPLICABLE]. Social functioning in childhood and adolescence was described as [DESCRIPTION].',
      ],
    },
    {
      heading: 'Current Presentation',
      body: [
        'The evaluee reported the following current symptoms of inattention: [SPECIFIC SYMPTOMS ENDORSED, e.g., difficulty sustaining attention during meetings, making careless errors on reports, difficulty organizing tasks and managing time, losing phone and keys frequently, being easily distracted by background noise, difficulty following through on tasks at work]. The evaluee rated these symptoms as [MILD/MODERATE/SEVERE] in their impact on daily functioning.',
        'The evaluee reported the following current symptoms of hyperactivity and impulsivity: [SPECIFIC SYMPTOMS ENDORSED, e.g., internal restlessness, difficulty remaining seated through meetings, talking excessively, interrupting colleagues, difficulty waiting in lines, making impulsive purchases]. The evaluee rated these symptoms as [MILD/MODERATE/SEVERE].',
        'Symptoms are present in the following settings: [HOME, WORK, SCHOOL, SOCIAL SITUATIONS]. Specific examples of cross-setting impairment include: at work, [EXAMPLE]; at home, [EXAMPLE]; in social situations, [EXAMPLE].',
        'The evaluee reported that symptoms have persisted [CONTINUOUSLY/WITH FLUCTUATION] since childhood. The evaluee identified [COMPENSATORY STRATEGIES, e.g., lists, alarms, partner reminders, hyperfocus on deadline pressure] that have partially masked the impact of symptoms. The evaluee reported that current demands have [EXCEEDED/NOT EXCEEDED] the compensatory capacity, specifically because [REASON, e.g., new job with more administrative demands, graduate school, remote work with less external structure].',
        'The evaluee [DENIED/ENDORSED] current depression, anxiety, and sleep disturbance. The evaluee reported current substance use as [DESCRIPTION]. The evaluee reported current caffeine consumption of [AMOUNT] and screen time of approximately [HOURS] per day.',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared the stated age of [AGE]. Grooming and hygiene were [DESCRIPTION]. The evaluee arrived [ON TIME/LATE] for the evaluation. The evaluee was [COOPERATIVE AND ENGAGED/RESTLESS/DISTRACTIBLE] throughout testing.',
        'Speech was [NORMAL RATE/RAPID/PRESSURED] and [NORMAL VOLUME/LOUD]. The evaluee [DID/DID NOT] frequently go off-topic or lose the thread of questions during the interview. Mood was described as "[EVALUEE\'S WORDS]." Affect was [FULL/CONSTRICTED] and [APPROPRIATE/ANXIOUS].',
        'Thought process was [LINEAR/TANGENTIAL/CIRCUMSTANTIAL]. The evaluee [DID/DID NOT] jump between topics. There was no evidence of psychotic symptoms. The evaluee [DENIED/ENDORSED] suicidal and homicidal ideation.',
        'Behavioral observations during testing: The evaluee [DESCRIPTION, e.g., frequently shifted position in the chair, asked to take breaks, looked around the room, needed questions repeated, lost track of multi-step instructions, maintained focus with visible effort, fidgeted with pen throughout]. The evaluee\'s sustained effort during the testing session was [ADEQUATE/VARIABLE/DECLINED OVER THE SESSION].',
      ],
    },
    {
      heading: 'Test Results',
      body: [
        'WAIS-IV Selected Subtests: The evaluee\'s performance on selected subtests was as follows: [SUBTEST NAMES AND SCALED SCORES]. The Working Memory Index (WMI) was estimated at [SCORE] (percentile = [PERCENTILE]). The Processing Speed Index (PSI) was estimated at [SCORE] (percentile = [PERCENTILE]). [INTERPRETATION: A pattern of WMI and PSI scores significantly below the evaluee\'s Verbal Comprehension and Perceptual Reasoning abilities IS/IS NOT present, which IS/IS NOT consistent with the attentional and processing efficiency weaknesses seen in ADHD.]',
        'Conners Continuous Performance Test, Third Edition (CPT-3): The evaluee\'s performance was characterized by [DESCRIPTION]. Key indices: Detectability (d\') = [T-SCORE] (measure of attentiveness), Omissions = [T-SCORE] (missed targets, suggesting inattention), Commissions = [T-SCORE] (false alarms, suggesting impulsivity), Hit Reaction Time = [T-SCORE], HRT Standard Error = [T-SCORE] (response consistency), Perseverations = [T-SCORE]. The overall pattern [IS/IS NOT] consistent with an ADHD-related attentional profile. [IMPORTANT NOTE: CPT performance alone is not diagnostic of ADHD and must be interpreted in context.]',
        'Wisconsin Card Sorting Test (WCST): The evaluee completed [NUMBER] categories and made [NUMBER] perseverative errors (T = [SCORE]). The error pattern [IS/IS NOT] consistent with executive dysfunction. [INTERPRETATION IN CONTEXT].',
        'Trail Making Test: Part A (processing speed and visual scanning) was completed in [SECONDS] (T = [SCORE]). Part B (cognitive flexibility and set-shifting) was completed in [SECONDS] (T = [SCORE]). The B:A ratio was [RATIO], which [IS/IS NOT] suggestive of executive functioning difficulty beyond simple processing speed.',
        'Conners Adult ADHD Rating Scales, Second Edition (CAARS-2): Self-report: Inattention/Memory Problems = [T-SCORE], Hyperactivity/Restlessness = [T-SCORE], Impulsivity/Emotional Lability = [T-SCORE], Problems with Self-Concept = [T-SCORE], ADHD Index = [T-SCORE]. Observer report (completed by [INFORMANT]): Inattention/Memory Problems = [T-SCORE], Hyperactivity/Restlessness = [T-SCORE], Impulsivity/Emotional Lability = [T-SCORE], ADHD Index = [T-SCORE]. Self and observer reports were [CONSISTENT/DISCREPANT], with [DESCRIPTION OF PATTERN].',
        'DIVA-5 (Diagnostic Interview for ADHD in Adults): The structured interview confirmed [NUMBER] of 9 inattention criteria and [NUMBER] of 9 hyperactivity-impulsivity criteria in adulthood. Childhood symptoms were corroborated by [EVALUEE REPORT/OBSERVER REPORT/SCHOOL RECORDS], confirming [NUMBER] of 9 inattention criteria and [NUMBER] of 9 hyperactivity-impulsivity criteria present before age 12.',
      ],
    },
    {
      heading: 'Symptom Validity',
      body: [
        'The base rate of ADHD symptom exaggeration in evaluations conducted for accommodation or disability purposes is estimated at 25-48% in research samples (Musso & Gouvier, 2014; Sullivan et al., 2007). Symptom validity assessment is therefore a standard and necessary component of this evaluation.',
        '[VALIDITY INSTRUMENT] was administered. The evaluee obtained a score of [SCORE], which [DOES/DOES NOT] exceed the cutoff for suspected feigning or exaggeration. [ADDITIONAL VALIDITY INSTRUMENT, IF USED]: The evaluee obtained a score of [SCORE], indicating [INTERPRETATION].',
        'Embedded validity indicators on the CAARS-2 (Inconsistency Index = [SCORE]) [DID/DID NOT] suggest inconsistent responding. The CPT-3 profile [DID/DID NOT] show patterns associated with poor effort (e.g., below-chance performance, unusually slow reaction times unrelated to the evaluee\'s cognitive profile).',
        'The evaluee\'s self-reported symptoms were [CONSISTENT/INCONSISTENT] with observer reports, school records, and behavioral observations during testing. Overall, the evaluee\'s symptom presentation is judged to be [CREDIBLE/NOT FULLY CREDIBLE/NONCREDIBLE] based on the convergence of validity evidence.',
      ],
    },
    {
      heading: 'Differential Diagnosis',
      body: [
        'The following conditions were considered as possible explanations for, or contributors to, the evaluee\'s attentional and organizational complaints:',
        'Major Depressive Disorder: The evaluee [DOES/DOES NOT] currently meet criteria for MDD. Depressive symptoms [ARE/ARE NOT] a more parsimonious explanation for the reported concentration difficulties. The evaluee\'s attentional complaints [PRECEDED/DID NOT PRECEDE] the onset of any depressive episodes, which [SUPPORTS/DOES NOT SUPPORT] a primary ADHD diagnosis.',
        'Generalized Anxiety Disorder: The evaluee [DOES/DOES NOT] report symptoms consistent with GAD. Anxiety-driven attentional fragmentation [IS/IS NOT] a more parsimonious explanation for the symptoms. [REASONING].',
        'Learning Disorders: Prior testing [DID/DID NOT] identify a specific learning disorder. Academic performance patterns [ARE/ARE NOT] consistent with a learning disability rather than ADHD. [REASONING].',
        'Sleep Disorders: The evaluee reported [SLEEP PATTERN]. The evaluee [HAS/HAS NOT] been evaluated for obstructive sleep apnea or other sleep disorders. Sleep deprivation [IS/IS NOT] an adequate explanation for the reported symptoms. [REASONING].',
        'Substance Use Disorders: Current and past substance use [IS/IS NOT] an adequate alternative explanation for the attentional complaints. [REASONING].',
        'Medical Conditions: The evaluee [DOES/DOES NOT] have medical conditions (e.g., thyroid disorder, anemia, chronic pain) that could account for attentional complaints. [REASONING].',
        'Normal Variation: The evaluee\'s complaints [ARE/ARE NOT] within the range of normal attentional variation under the evaluee\'s current life circumstances (e.g., high stress, sleep deprivation, demanding workload). [REASONING].',
      ],
    },
    {
      heading: 'Diagnostic Impression',
      body: [
        'Based on the totality of data gathered in this evaluation, the following diagnostic impressions are offered:',
        '[PRIMARY DIAGNOSIS]: Attention-Deficit/Hyperactivity Disorder, [Combined Presentation (F90.2) / Predominantly Inattentive Presentation (F90.0) / Predominantly Hyperactive-Impulsive Presentation (F90.1)], [Mild/Moderate/Severe]. This diagnosis is based on the following: (1) [NUMBER] inattention symptoms and [NUMBER] hyperactivity-impulsivity symptoms are currently present, exceeding the DSM-5-TR threshold of 5 for adults; (2) childhood onset before age 12 is supported by [EVIDENCE]; (3) symptoms are present in [SETTINGS]; (4) symptoms cause clinically significant impairment in [DOMAINS]; (5) symptoms are not better explained by [DIFFERENTIAL DIAGNOSES RULED OUT].',
        '[OR: The evaluee does not currently meet DSM-5-TR criteria for ADHD. Specifically, [CRITERIA NOT MET AND REASONING]. The evaluee\'s attentional complaints are better accounted for by [ALTERNATIVE EXPLANATION].]',
        '[IF APPLICABLE, COMORBID DIAGNOSES]: [DIAGNOSIS AND CODE]. The basis for this additional diagnosis is [DESCRIPTION]. The comorbid condition [DOES/DOES NOT] complicate the ADHD presentation.',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, the examiner offers the following opinions:',
        '1. Diagnosis: {{PATIENT_NAME}} [DOES/DOES NOT] currently meet DSM-5-TR criteria for ADHD. [PRESENTATION TYPE AND SEVERITY].',
        '2. Childhood onset: The evaluee\'s symptom history [IS/IS NOT] consistent with onset before age 12, as supported by [EVIDENCE].',
        '3. Functional impairment: The evaluee\'s symptoms result in [DESCRIPTION] impairment in [DOMAINS]. This impairment [IS/IS NOT] attributable to the ADHD diagnosis.',
        '4. Symptom credibility: The evaluee\'s symptom presentation [IS/IS NOT] credible based on multi-method validity assessment.',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '1. Psychiatric consultation: A psychiatric evaluation for stimulant or non-stimulant pharmacotherapy is recommended. First-line options include [METHYLPHENIDATE/AMPHETAMINE-BASED STIMULANTS/ATOMOXETINE], with the choice guided by the evaluee\'s medical history, comorbidities, and substance use risk. Medication response should be monitored with standardized follow-up measures.',
        '2. Psychotherapy: Cognitive-behavioral therapy (CBT) adapted for adult ADHD is recommended to address [SPECIFIC TARGETS, e.g., time management, organizational skills, emotional regulation, procrastination, self-esteem]. The Safren CBT for Adult ADHD protocol has the strongest empirical support.',
        '3. Academic accommodations [IF APPLICABLE]: The evaluee\'s diagnosis and functional limitations support the following accommodations under Section 504 or the ADA: [SPECIFIC ACCOMMODATIONS, e.g., extended time on examinations (1.5x), testing in a reduced-distraction environment, permission to audio-record lectures, note-taking assistance]. These accommodations are directly tied to the documented functional deficits and are not intended to provide an unfair advantage.',
        '4. Workplace accommodations [IF APPLICABLE]: The evaluee may benefit from [SPECIFIC ACCOMMODATIONS, e.g., written rather than verbal instructions, flexible scheduling, noise-reducing workspace modifications, structured check-ins with supervisor, use of organizational technology].',
        '5. Comorbid condition treatment [IF APPLICABLE]: Concurrent treatment for [DIAGNOSIS] is recommended, including [SPECIFIC RECOMMENDATIONS].',
        '6. Follow-up evaluation: A follow-up evaluation in [TIMEFRAME] is recommended to assess treatment response and the continued need for accommodations.',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Template 7: Malingering / Symptom Validity Assessment
// ---------------------------------------------------------------------------

const MALINGERING_TEMPLATE: ReportTemplate = {
  id: 'report_malingering',
  evalType: 'Malingering',
  title: 'Symptom Validity Assessment',
  subtitle: 'Evaluation of Feigned or Exaggerated Psychological Symptoms',
  sections: [
    HEADER_BLOCK,
    IDENTIFYING_INFO,
    {
      heading: 'Referral Question',
      body: [
        'The referring party, {{REFERRING_PARTY}}, requested an evaluation to determine whether {{PATIENT_NAME}}\'s reported psychological symptoms are consistent with a genuine clinical presentation or whether there is evidence of symptom fabrication, gross exaggeration, or insufficient effort that undermines the validity of the clinical data. The evaluation uses the Slick, Sherman, and Iverson (1999) criteria for Malingered Neurocognitive Dysfunction (MND), where neurocognitive complaints are at issue, and the Rogers (2008) model for detection of feigned psychiatric symptoms. No single test score or clinical observation is used as a sole determinant of a malingering conclusion.',
      ],
    },
    NOTICE_OF_NON_CONFIDENTIALITY,
    {
      heading: 'Procedures',
      body: [
        'The following procedures were used in the preparation of this report:',
        ...PROCEDURES_BOILERPLATE,
        'Administration of the Test of Memory Malingering (TOMM)',
        'Administration of the Word Memory Test (WMT) or Medical Symptom Validity Test (MSVT)',
        'Administration of the Structured Inventory of Malingered Symptomatology (SIMS)',
        'Administration of the Miller Forensic Assessment of Symptoms Test (M-FAST)',
        'Administration of the Structured Interview of Reported Symptoms, Second Edition (SIRS-2)',
        'Administration of the Minnesota Multiphasic Personality Inventory-3 (MMPI-3)',
        'Administration of the Personality Assessment Inventory (PAI)',
        'Review of embedded validity indicators across all cognitive and personality measures',
      ],
    },
    {
      heading: 'Records Reviewed',
      body: [
        'Prior psychological and psychiatric evaluation reports, including any prior validity testing results',
        'Medical records from treating providers, dated [RANGE]',
        'Mental health treatment records from [PROVIDER], dated [RANGE]',
        'Incident reports, police reports, or workplace injury reports related to the claimed event',
        'Surveillance video or investigative reports provided by the referring party, if any',
        'Deposition transcripts, if available',
        'Employment, academic, or military records documenting pre-claim functioning',
        'Social media content provided by the referring party, if any',
        'Prior claims history, if provided',
      ],
    },
    {
      heading: 'Relevant Background',
      body: [
        '{{PATIENT_NAME}} is a [AGE]-year-old [RACE/ETHNICITY] [GENDER] who is currently [EMPLOYED AS/UNEMPLOYED SINCE/ON DISABILITY SINCE]. The evaluee is being evaluated in connection with [CONTEXT, e.g., personal injury litigation, workers compensation claim, disability determination, criminal proceedings].',
        'The evaluee claims the following symptoms: [SUMMARY OF CLAIMED SYMPTOMS AND ALLEGED ONSET DATE]. The evaluee attributes these symptoms to [CLAIMED CAUSE]. Treatment to date has included [DESCRIPTION OF TREATMENT]. The evaluee reports [IMPROVEMENT/NO IMPROVEMENT/WORSENING] since treatment began.',
        'The evaluee\'s pre-claim functioning, as documented in [RECORDS], indicates [DESCRIPTION OF BASELINE FUNCTIONING]. Prior diagnoses include [DIAGNOSES, IF ANY]. The evaluee [DID/DID NOT] have pre-existing psychiatric or cognitive conditions.',
        'External incentives: At the time of this evaluation, the evaluee [HAS/DOES NOT HAVE] identifiable external incentives that could motivate symptom fabrication or exaggeration. Specifically: [DESCRIPTION, e.g., pending personal injury lawsuit with claimed damages of $X, workers compensation claim, disability application, criminal proceedings where a mental health defense has been raised, avoidance of military deployment, child custody proceeding].',
      ],
    },
    {
      heading: 'Presenting Complaints',
      body: [
        'The evaluee reported the following current symptoms during the clinical interview:',
        'Cognitive complaints: [DESCRIPTION, e.g., "I can\'t remember anything," "I can\'t concentrate for more than a few minutes," "I get confused all the time"]. The evaluee rated memory impairment as [SEVERITY] and concentration impairment as [SEVERITY]. The evaluee reported that these difficulties [DO/DO NOT] interfere with [SPECIFIC DAILY ACTIVITIES].',
        'Psychiatric complaints: [DESCRIPTION, e.g., depression, anxiety, PTSD symptoms, psychotic symptoms, dissociation]. The evaluee described the severity as [DESCRIPTION] and the frequency as [DESCRIPTION].',
        'Functional complaints: The evaluee reported being unable to [SPECIFIC CLAIMED LIMITATIONS, e.g., work, drive, manage finances, maintain household, care for children]. The evaluee described a typical day as [DESCRIPTION].',
        'Notably, the evaluee\'s self-reported functional limitations [ARE/ARE NOT] consistent with the evaluee\'s observed behavior during the evaluation, which included [SPECIFIC OBSERVATIONS, e.g., the evaluee navigated to the office without difficulty, managed a full day of testing, used a smartphone to check messages during breaks, recalled specific details of the evaluation schedule].',
      ],
    },
    {
      heading: 'Mental Status Examination',
      body: [
        '{{PATIENT_NAME}} presented as a [BUILD] [GENDER] who appeared [CONSISTENT WITH/OLDER THAN] the stated age. Grooming and hygiene were [DESCRIPTION]. The evaluee arrived [ON TIME/LATE] and was [COOPERATIVE/GUARDED/EVASIVE/DRAMATIC] throughout the evaluation.',
        'Speech was [DESCRIPTION]. The evaluee\'s conversational language ability appeared [CONSISTENT/INCONSISTENT] with claimed cognitive deficits. Mood was described as "[EVALUEE\'S WORDS]." Affect was [DESCRIPTION]. The evaluee\'s affective presentation [WAS/WAS NOT] consistent with the severity of claimed distress.',
        'Thought process was [DESCRIPTION]. The evaluee [DENIED/ENDORSED] hallucinations, describing them as [IF ENDORSED: DESCRIPTION, with attention to atypical features]. The evaluee [DENIED/ENDORSED] delusions. There was [NO EVIDENCE/EVIDENCE] of genuine psychotic symptoms based on behavioral observation and the pattern of reported experiences.',
        'Effort and engagement: The evaluee appeared to [PUT FORTH ADEQUATE EFFORT/DEMONSTRATE VARIABLE EFFORT/SHOW SIGNS OF POOR EFFORT] during testing. Specific behavioral indicators included [DESCRIPTION, e.g., answering quickly without appearing to consider the question, taking an unusually long time on simple items, appearing to deliberately select wrong answers, giving approximate but consistently incorrect responses].',
      ],
    },
    {
      heading: 'Performance Validity Findings',
      body: [
        'Performance validity tests (PVTs) assess whether the evaluee is putting forth adequate effort on cognitive testing. Below-chance or below-cutoff performance on PVTs does not, by itself, establish malingering, but it does indicate that the cognitive test results cannot be interpreted as valid reflections of the evaluee\'s true abilities.',
        'Test of Memory Malingering (TOMM): Trial 1 = [SCORE]/50, Trial 2 = [SCORE]/50, Retention Trial = [SCORE]/50. The recommended cutoff for adequate effort is 45/50 on Trial 2. The evaluee\'s performance [EXCEEDS/FALLS BELOW] this cutoff. [IF BELOW CUTOFF: This level of performance is lower than what is typically seen in individuals with moderate to severe traumatic brain injury, dementia, and intellectual disability, and is strongly associated with noncredible effort in research samples.]',
        'Word Memory Test (WMT) [OR Medical Symptom Validity Test (MSVT)]: Immediate Recognition = [SCORE]%, Delayed Recognition = [SCORE]%, Consistency = [SCORE]%. The evaluee\'s performance [PASSES/FAILS] the WMT validity criteria. [IF FAILS: The pattern of failure IS/IS NOT consistent with deliberate suppression of performance, as opposed to genuine cognitive impairment.]',
        '[ADDITIONAL PVTs, IF ADMINISTERED]: [INSTRUMENT] yielded a score of [SCORE], which [DOES/DOES NOT] exceed the cutoff for noncredible performance. Classification accuracy for this measure is [SENSITIVITY/SPECIFICITY].',
        'Summary of PVT findings: The evaluee [PASSED/FAILED] [NUMBER] of [NUMBER] stand-alone PVTs. [NUMBER] embedded PVT indicators across cognitive testing were [WITHIN/OUTSIDE] normal limits. The convergence of PVT findings indicates that the evaluee\'s effort on cognitive testing was [ADEQUATE/INADEQUATE], and the cognitive test results [CAN/CANNOT] be interpreted with confidence.',
      ],
    },
    {
      heading: 'Symptom Validity Findings',
      body: [
        'Symptom validity tests (SVTs) assess whether the evaluee\'s reported psychiatric and cognitive symptoms are consistent with known patterns of genuine psychopathology or whether they show features associated with fabrication or gross exaggeration.',
        'Structured Interview of Reported Symptoms, Second Edition (SIRS-2): The evaluee\'s profile was classified as [GENUINE/INDETERMINATE/FEIGNING] based on the primary scale decision model. Specific scale scores: Rare Symptoms (RS) = [SCORE], Symptom Combinations (SC) = [SCORE], Improbable or Absurd Symptoms (IA) = [SCORE], Reported vs. Observed Symptoms (RO) = [SCORE], Symptom Selectivity (SEL) = [SCORE]. The supplementary scales indicated [DESCRIPTION]. [INTERPRETATION OF PATTERN].',
        'Miller Forensic Assessment of Symptoms Test (M-FAST): Total score = [SCORE] (cutoff = 6). The evaluee\'s score [DOES/DOES NOT] exceed the screening cutoff for possible malingering.',
        'Structured Inventory of Malingered Symptomatology (SIMS): Total score = [SCORE] (cutoff = 14). Subscale scores: Psychosis = [SCORE], Neurologic Impairment = [SCORE], Amnestic Disorders = [SCORE], Low Intelligence = [SCORE], Affective Disorders = [SCORE]. The total score [DOES/DOES NOT] exceed the cutoff.',
        'MMPI-3 validity scales: F-r = [SCORE]T, Fp-r = [SCORE]T, Fs = [SCORE]T, FBS-r = [SCORE]T, RBS = [SCORE]T. The pattern of validity scale elevations [IS/IS NOT] consistent with over-reporting. [SPECIFIC INTERPRETATION OF THE PATTERN, e.g., "The combination of elevated Fp-r and Fs with relatively lower F-r suggests endorsement of rarely endorsed items rather than general psychological distress."]',
        'PAI validity scales: NIM = [SCORE]T, MAL = [SCORE]T, RDF = [SCORE], DEF = [SCORE]T, CDF = [SCORE]. The pattern [IS/IS NOT] consistent with over-reporting. [SPECIFIC INTERPRETATION].',
        'Summary of SVT findings: The evaluee\'s symptom presentation [IS/IS NOT] consistent with genuine psychopathology across multiple measures. The convergence of SVT findings indicates [CREDIBLE PRESENTATION/INDETERMINATE PRESENTATION/PROBABLE OVER-REPORTING/DEFINITE OVER-REPORTING].',
      ],
    },
    {
      heading: 'External Evidence',
      body: [
        'The following external evidence was considered in evaluating the consistency and credibility of the evaluee\'s claimed symptoms:',
        'Records consistency: The evaluee\'s symptom reports across time and providers have been [CONSISTENT/INCONSISTENT]. Specifically, [DESCRIPTION OF CONSISTENCY OR INCONSISTENCY ACROSS RECORDS, e.g., "The evaluee reported severe memory impairment to the current examiner but demonstrated intact memory during a deposition conducted three weeks prior"].',
        'Behavioral consistency: The evaluee\'s observed behavior during the evaluation [WAS/WAS NOT] consistent with the severity of claimed impairment. [SPECIFIC EXAMPLES, e.g., "The evaluee claimed inability to recall basic personal information but provided a detailed and chronologically organized account of the incident in question"].',
        'Surveillance or collateral observations: [IF AVAILABLE: Surveillance footage dated DATE showed the evaluee DESCRIPTION, which IS/IS NOT consistent with the evaluee\'s claimed functional limitations. IF NOT AVAILABLE: No surveillance or independent observational data was provided for review.]',
        'Social media content: [IF AVAILABLE: Social media posts reviewed showed DESCRIPTION, which IS/IS NOT consistent with claimed limitations. IF NOT AVAILABLE: No social media content was provided for review.]',
        'Treatment engagement: The evaluee [HAS/HAS NOT] engaged in recommended treatment. [IF NOT: The evaluee\'s failure to pursue treatment IS/IS NOT consistent with claimed severity of symptoms.]',
        'Incentive context: The evaluee has [DESCRIPTION OF EXTERNAL INCENTIVES]. The presence of external incentives does not prove malingering but does establish the necessary precondition of motive identified in the diagnostic frameworks used in this evaluation.',
      ],
    },
    {
      heading: 'Analysis',
      body: [
        'The following analysis integrates the performance validity, symptom validity, and external evidence findings using the applicable diagnostic framework.',
        '[IF NEUROCOGNITIVE CLAIMS]: Applying the Slick, Sherman, and Iverson (1999) criteria for Malingered Neurocognitive Dysfunction (MND):',
        'Criterion A (Presence of external incentive): [MET/NOT MET]. The evaluee has [DESCRIPTION OF INCENTIVE].',
        'Criterion B (Evidence from neuropsychological testing): [MET/NOT MET]. The evaluee [PERFORMED BELOW CHANCE ON/FAILED] [NUMBER] PVTs, which [MEETS/DOES NOT MEET] the threshold for Criterion B evidence. [SPECIFIC FINDINGS].',
        'Criterion C (Evidence from self-report): [MET/NOT MET]. The evaluee\'s self-reported symptoms [ARE/ARE NOT] substantially discrepant from known patterns of genuine dysfunction, behavioral observations, and documented functioning.',
        'Criterion D (Behaviors not fully accounted for): The above findings [ARE/ARE NOT] fully accounted for by psychiatric, neurological, or developmental factors. [REASONING].',
        'Classification: Based on the Slick criteria, the evaluee\'s presentation meets criteria for [DEFINITE MND/PROBABLE MND/DOES NOT MEET MND CRITERIA].',
        '[IF PSYCHIATRIC CLAIMS]: Applying the Rogers (2008) model for detection of feigned psychiatric symptoms:',
        'The evaluee\'s SIRS-2 profile was classified as [GENUINE/INDETERMINATE/FEIGNING]. The evaluee\'s MMPI-3 and PAI validity profiles [CONVERGE/DO NOT CONVERGE] with the SIRS-2 finding. The overall pattern [IS/IS NOT] consistent with a detection strategy of [RARE SYMPTOMS/SYMPTOM COMBINATIONS/INDISCRIMINANT SYMPTOM ENDORSEMENT/SYMPTOM SEVERITY]. [REASONING AND INTEGRATION].',
      ],
    },
    {
      heading: 'Opinion',
      body: [
        'To a reasonable degree of psychological certainty, the examiner offers the following opinions regarding the validity of {{PATIENT_NAME}}\'s symptom presentation:',
        '[SELECT ONE]:',
        'Credible Presentation: The evaluee\'s reported symptoms are consistent with genuine psychopathology. Performance and symptom validity testing did not reveal evidence of fabrication or gross exaggeration. The clinical test results can be interpreted with confidence.',
        'Indeterminate / Insufficient Effort: The evaluee\'s performance on validity testing was mixed, and the examiner cannot determine with confidence whether the clinical presentation is genuine. Specifically, [DESCRIPTION OF MIXED FINDINGS]. The cognitive and clinical test results [SHOULD BE INTERPRETED WITH CAUTION / CANNOT BE INTERPRETED WITH CONFIDENCE].',
        'Probable Feigning: The evaluee\'s presentation is more consistent with fabricated or grossly exaggerated symptoms than with genuine psychopathology. This conclusion is based on [MULTIPLE CONVERGING FINDINGS]. The evaluee meets Slick criteria for Probable MND [AND/OR] the SIRS-2 classification is Feigning. The clinical test results cannot be interpreted as valid reflections of the evaluee\'s true functioning.',
        'Definite Feigning: The evaluee\'s presentation is definitively inconsistent with genuine psychopathology. Performance on forced-choice PVTs was at or below chance levels, indicating deliberate suppression of performance. This conclusion is based on [SPECIFIC BELOW-CHANCE FINDINGS AND ADDITIONAL CONVERGING EVIDENCE].',
      ],
    },
    {
      heading: 'Caveats',
      body: [
        'The following caveats apply to the interpretation of this evaluation:',
        '1. Failure on validity testing does not automatically establish deliberate intent to deceive. Alternative explanations include genuine cognitive impairment (though current PVTs are designed to be passed even by severely impaired individuals), low motivation unrelated to secondary gain, cultural or linguistic factors affecting test performance, fatigue, and pain. The examiner considered each of these alternatives and determined that [THEY ARE/ARE NOT] adequate explanations for the observed pattern based on [REASONING].',
        '2. A finding of noncredible symptom presentation does not mean the evaluee has no genuine symptoms. It means the evaluee\'s self-reported symptoms cannot be taken at face value, and the specific degree of impairment claimed by the evaluee is not supported by the data. The evaluee may have genuine underlying symptoms that are being exaggerated for secondary gain.',
        '3. Malingering is not a mental disorder. It is a behavior that may occur in the context of genuine psychopathology, personality pathology, or in the absence of any mental health condition.',
        '4. This opinion is based on the data available at the time of the evaluation. If additional records, surveillance, or collateral information become available, the examiner reserves the right to supplement or modify these opinions.',
      ],
    },
    {
      heading: 'Recommendations',
      body: [
        '1. Interpretation of prior and concurrent evaluations: [IF NONCREDIBLE]: Prior evaluations that relied on the evaluee\'s self-reported symptoms without adequate validity testing should be interpreted with caution. Diagnoses based solely on the evaluee\'s uncorroborated self-report may not be reliable.',
        '2. Further evaluation: [IF INDETERMINATE]: A re-evaluation with additional validity measures, observation in a naturalistic setting, or collateral data collection is recommended to resolve the ambiguity in the current findings.',
        '3. Treatment implications: [IF CREDIBLE]: The evaluee would benefit from treatment for [DIAGNOSES]. [IF NONCREDIBLE]: Treatment recommendations cannot be meaningfully offered when the clinical presentation is not credible. If the evaluee seeks treatment independently, the treating clinician should be made aware of the validity findings in this report.',
        '4. Referring party: The referring party is advised that [SPECIFIC GUIDANCE ON HOW TO USE THESE FINDINGS IN THE APPLICABLE LEGAL/ADMINISTRATIVE CONTEXT].',
      ],
    },
    SIGNATURE_BLOCK,
  ],
}

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export const REPORT_TEMPLATES: readonly ReportTemplate[] = [
  CST_TEMPLATE,
  CUSTODY_TEMPLATE,
  RISK_ASSESSMENT_TEMPLATE,
  FFD_TEMPLATE,
  PTSD_TEMPLATE,
  ADHD_TEMPLATE,
  MALINGERING_TEMPLATE,
] as const

/**
 * Look up templates by the eval types the clinician selected in Step 7.
 * Templates whose eval type is not in the selection are excluded.
 */
export function templatesForEvalTypes(
  selected: readonly string[],
): readonly ReportTemplate[] {
  const set = new Set(selected)
  return REPORT_TEMPLATES.filter((t) => set.has(t.evalType))
}

/**
 * The full set of eval types the registry supports. Useful for UI.
 */
export const SUPPORTED_EVAL_TYPES: readonly EvalType[] = [
  'CST',
  'Custody',
  'Risk Assessment',
  'Fitness for Duty',
  'PTSD Dx',
  'ADHD Dx',
  'Malingering',
] as const
