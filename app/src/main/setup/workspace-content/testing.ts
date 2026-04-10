// =============================================================================
// Testing, scoring quick references for the instruments in the library
// =============================================================================
//
// These live under /Workspace/Testing/ and give the clinician a quick
// reference for validity cutoffs, interpretation ranges, and administration
// notes. The information is drawn from published manuals and peer-reviewed
// validation studies. This file is a working reference, not a substitute
// for the full test manual.
// =============================================================================

export interface TestingGuide {
  readonly filename: string
  readonly instrument: string
  readonly content: string
}

// ---------------------------------------------------------------------------
// MMPI-3
// ---------------------------------------------------------------------------

const MMPI3: TestingGuide = {
  filename: 'MMPI-3_Scoring_Quick_Reference.md',
  instrument: 'MMPI-3',
  content: `# MMPI-3 Scoring Quick Reference

The Minnesota Multiphasic Personality Inventory, 3 (Ben-Porath & Tellegen,
2020) is a 335-item self-report inventory with 52 substantive scales and
10 validity scales. This reference covers forensic-relevant scales and
cutoffs.

## Administration

- 335 true/false items
- Reading level: 4.5 grade
- Administration time: 25-50 minutes
- Age range: 18-80
- Paper, computer, or Q-global administration

## Validity Scales

| Scale | Name | Interpretation at elevated T |
|-------|------|-----------------------------|
| CNS | Cannot Say | >=15 items: profile interpretation questionable |
| VRIN-r | Variable Response Inconsistency | T>=80: random/inconsistent responding |
| TRIN-r | True Response Inconsistency | T>=80F (fixed false) or T>=80T (fixed true) |
| F-r | Infrequent Responses | T>=120: consider overreporting or severe psychopathology |
| Fp-r | Infrequent Psychopathology Responses | T>=100: strong indicator of overreporting |
| Fs | Infrequent Somatic Responses | T>=100: overreporting of somatic symptoms |
| FBS-r | Symptom Validity | T>=100: noncredible symptom reporting |
| RBS | Response Bias Scale | T>=100: overreporting of cognitive symptoms |
| L-r | Uncommon Virtues | T>=80: underreporting, defensive responding |
| K-r | Adjustment Validity | T>=70: defensive, T<=35: overreporting |

## Higher-Order Scales

- **EID** (Emotional/Internalizing Dysfunction)
- **THD** (Thought Dysfunction)
- **BXD** (Behavioral/Externalizing Dysfunction)

Elevations (T>=65) indicate dysfunction in the respective domain.

## Restructured Clinical Scales

- **RCd** (Demoralization)
- **RC1** (Somatic Complaints)
- **RC2** (Low Positive Emotions)
- **RC3** (Cynicism)
- **RC4** (Antisocial Behavior)
- **RC6** (Ideas of Persecution)
- **RC7** (Dysfunctional Negative Emotions)
- **RC8** (Aberrant Experiences)
- **RC9** (Hypomanic Activation)

Interpret T-scores:
- T<=38: Low (may reflect absence of problem or denial)
- T 39-64: Within normal limits
- T 65-79: Moderate elevation (clinically significant)
- T>=80: Marked elevation

## Specific Problems Scales

Organized into five domains: Somatic/Cognitive, Internalizing, Externalizing,
Interpersonal, and Interest. Consult the manual for individual scale
interpretation. Use in conjunction with the RC scales, not as stand-alone
interpretations.

## Personality Psychopathology Five (PSY-5)

- AGGR-r (Aggressiveness)
- PSYC-r (Psychoticism)
- DISC-r (Disconstraint)
- NEGE-r (Negative Emotionality/Neuroticism)
- INTR-r (Introversion/Low Positive Emotionality)

## Forensic Use Notes

- The MMPI-3 is routinely admissible in federal and state courts
- Score reports alone are not clinical interpretations; always integrate
  with interview, records, and collateral
- Validity scales are the first line of defense against feigning; do not
  interpret substantive scales without first clearing validity
- Be cautious with interpretation when CNS > 10 or when VRIN-r/TRIN-r T
  scores exceed 80
- Publisher: Pearson Clinical Assessments
`,
}

// ---------------------------------------------------------------------------
// PAI
// ---------------------------------------------------------------------------

const PAI: TestingGuide = {
  filename: 'PAI_Scoring_Quick_Reference.md',
  instrument: 'PAI',
  content: `# PAI Scoring Quick Reference

The Personality Assessment Inventory (Morey, 1991, 2007) is a 344-item
self-report inventory with 22 non-overlapping scales. Widely used in
forensic practice.

## Administration

- 344 items on a 4-point scale (False, Slightly True, Mainly True, Very True)
- Reading level: 4th grade
- Administration time: 40-50 minutes
- Age range: 18+

## Validity Scales

| Scale | Name | Cutoff |
|-------|------|--------|
| ICN | Inconsistency | T>=73: inconsistent responding |
| INF | Infrequency | T>=75: random or careless |
| NIM | Negative Impression | T>=84: overreporting, consider feigning |
| PIM | Positive Impression | T>=68: defensive, underreporting |

Supplementary indices:
- **Rogers Discriminant Function (RDF)**: feigning of mental disorder
- **Malingering Index (MAL)**: feigning of psychiatric symptoms
- **Defensiveness Index (DEF)**: defensive profile

## Clinical Scales

Eleven clinical scales, grouped by content area:

**Neurotic Spectrum**
- SOM (Somatic Complaints), T>=70 clinically significant
- ANX (Anxiety)
- ARD (Anxiety-Related Disorders)
- DEP (Depression)

**Psychotic Spectrum**
- MAN (Mania)
- PAR (Paranoia)
- SCZ (Schizophrenia)

**Behavioral/Impulse Control**
- BOR (Borderline Features)
- ANT (Antisocial Features)
- ALC (Alcohol Problems)
- DRG (Drug Problems)

## Treatment Scales

- AGG (Aggression)
- SUI (Suicidal Ideation)
- STR (Stress)
- NON (Nonsupport)
- RXR (Treatment Rejection)

## Interpersonal Scales

- DOM (Dominance)
- WRM (Warmth)

## Interpretation Ranges

- T<60: Within normal limits
- T 60-69: Mild elevation
- T 70-84: Marked elevation, clinically significant
- T>=85: Severe elevation

## Forensic Use Notes

- The PAI's validity indices (NIM, PIM, RDF, MAL) make it a workhorse for
  forensic assessment
- The Morey Validity Indices should be consulted in every forensic PAI
- NIM elevations alone do not establish feigning; integrate with RDF, MAL,
  and external evidence
- Publisher: PAR, Inc.
`,
}

// ---------------------------------------------------------------------------
// TOMM
// ---------------------------------------------------------------------------

const TOMM: TestingGuide = {
  filename: 'TOMM_Scoring_Guide.md',
  instrument: 'TOMM',
  content: `# TOMM Scoring Guide

The Test of Memory Malingering (Tombaugh, 1996) is a 50-item visual
recognition test designed to discriminate between genuine memory impairment
and feigned memory impairment. It is a stand-alone performance validity
test and one of the most widely used PVTs in forensic practice.

## Administration

- 50 line drawings of common objects, presented twice (Trial 1 and Trial 2)
- Optional Retention Trial after 15-20 minute delay
- Forced-choice recognition: for each test item, the examinee picks between
  the studied item and a foil
- Administration time: about 15 minutes including the delay
- Age range: 16+

## Cutoffs

| Trial | Score | Interpretation |
|-------|-------|----------------|
| Trial 2 | <45 | Below chance-adjusted cutoff. Indicates possible feigning. |
| Trial 2 | 45-49 | Borderline; consider other PVTs and the full clinical picture |
| Trial 2 | 50 | No concerns on this measure |
| Retention | <45 | Same as Trial 2 |

The Trial 2 cutoff of <45 was derived from a normative sample including
patients with cognitive impairment. Genuine dementia patients typically
score at or above 45; performance below that level in the absence of
severe cognitive impairment raises validity concerns.

## Interpretation Principles

1. **Never rely on the TOMM alone.** A failed TOMM in isolation does not
   establish malingering. Use at least two PVTs before reaching a
   performance validity conclusion.

2. **Consider the clinical context.** Below-cutoff performance in a
   cooperative examinee with severe dementia may reflect genuine impairment.
   The Slick et al. (1999) criteria require external incentive and other
   evidence to support a definite determination.

3. **Chance-level or below-chance performance** (i.e., <25/50 on Trial 2)
   is strong evidence of non-credible performance. Random responding by an
   examinee attempting to appear impaired produces scores clustering at 25.

4. **Document verbatim.** Record the exact instructions given, any deviations
   from standard administration, and the examinee's behavior during the
   test.

## Forensic Use Notes

- Well-validated in forensic, neuropsychological, and disability samples
- Effort cutoffs are independent of education and most demographic factors
- Publisher: Multi-Health Systems (MHS)
- See Slick, Sherman, and Iverson (1999) for the full Malingered
  Neurocognitive Dysfunction criteria framework
`,
}

// ---------------------------------------------------------------------------
// HCR-20v3
// ---------------------------------------------------------------------------

const HCR20: TestingGuide = {
  filename: 'HCR-20v3_Item_Summary.md',
  instrument: 'HCR-20v3',
  content: `# HCR-20v3 Item Summary

The Historical Clinical Risk Management-20, Version 3 (Douglas, Hart,
Webster, & Belfrage, 2013) is a structured professional judgment tool for
violence risk assessment. It organizes risk factors into three domains
and produces a qualitative summary judgment rather than a numerical
probability.

## Scoring

Each of the 20 items is rated on three dimensions:

- **Presence:** N (not present), P (possibly present), Y (yes, present)
- **Relevance:** N, P, Y (the relevance of the item to THIS examinee's
  risk in THIS context)
- **Sub-indicators:** any item may have specific sub-items the examiner
  documents

The HCR-20v3 does NOT produce a total score. The examiner forms a
summary risk judgment after considering all items, case formulation, and
scenario planning.

## Historical Items (H1-H10)

Unchanging, retrospective factors.

1. **H1 Violence**, History of violence (including childhood)
2. **H2 Other antisocial behavior**, Non-violent criminal behavior
3. **H3 Relationships**, Pattern of relationship instability
4. **H4 Employment**, Pattern of employment problems
5. **H5 Substance use**, History of substance use problems
6. **H6 Major mental disorder**, History of psychosis, mood disorder, etc.
7. **H7 Personality disorder**, History of personality disorder with
   violence-relevant features (antisocial, psychopathic, borderline)
8. **H8 Traumatic experiences**, Victimization, adverse childhood experiences
9. **H9 Violent attitudes**, History of attitudes supportive of violence
10. **H10 Treatment or supervision response**, History of poor response

## Clinical Items (C1-C5)

Current, dynamic factors reflecting the examinee's present clinical
state.

1. **C1 Insight**, Into illness, into risk, into need for treatment
2. **C2 Violent ideation or intent**, Current fantasies or plans
3. **C3 Symptoms of major mental disorder**, Current active symptoms
4. **C4 Instability**, Emotional, behavioral, cognitive instability
5. **C5 Treatment or supervision response**, Current engagement

## Risk Management Items (R1-R5)

Prospective factors in the anticipated living situation.

1. **R1 Professional services and plans**, Availability and adequacy
2. **R2 Living situation**, Stability, safety
3. **R3 Personal support**, Quality and availability
4. **R4 Treatment or supervision response**, Expected response
5. **R5 Stress or coping**, Stressors in anticipated environment

## Case Formulation

The examiner develops a case formulation integrating the rated items to
answer:

1. Who is at risk? (specific victims or categories)
2. What kind of violence? (instrumental, reactive, sexual, etc.)
3. When and where? (context-dependent)
4. How severe? (likely physical harm)

## Summary Risk Judgment

The examiner makes a qualitative judgment of risk for the specified time
frame and setting, classified as:

- **Low**: Routine management sufficient
- **Moderate**: Enhanced monitoring and intervention warranted
- **High**: Intensive management, treatment, and monitoring

The judgment must be tied to the formulation. A numerical score alone is
NOT the product of an HCR-20v3 assessment.

## Forensic Use Notes

- The HCR-20v3 is a structured professional judgment instrument; it does
  not produce actuarial probabilities
- Training in the instrument is required for competent use
- Admissible in most jurisdictions under Daubert and Frye as a generally
  accepted structured risk assessment approach
- Publisher: Mental Health Law and Policy Institute, Simon Fraser University
`,
}

// ---------------------------------------------------------------------------
// CAPS-5
// ---------------------------------------------------------------------------

const CAPS5: TestingGuide = {
  filename: 'CAPS-5_Administration_Guide.md',
  instrument: 'CAPS-5',
  content: `# CAPS-5 Administration Guide

The Clinician-Administered PTSD Scale for DSM-5 (Weathers et al., 2013) is
a 30-item structured interview that is the gold-standard assessment for
PTSD diagnosis and severity.

## Structure

- 30 items corresponding to the 20 DSM-5 PTSD symptoms plus four associated
  features (dissociation, guilt, trauma-related dissociation, etc.)
- Prompts elicit both frequency and intensity for each symptom
- Administration time: 45-60 minutes
- Training is required for reliable administration

## Rating Scale

Each symptom is rated on a 5-point severity scale:

- **0** Absent
- **1** Mild (minimal effect on functioning)
- **2** Moderate (clearly present, some impact)
- **3** Severe (marked impact)
- **4** Extreme (pervasive, incapacitating)

Severity ratings combine frequency and intensity. A rating of 2 or higher
on a given symptom is considered clinically significant for diagnostic
scoring.

## Diagnostic Scoring

A symptom is "endorsed" for diagnostic purposes when:
- Severity >= 2, AND
- The symptom meets DSM-5 duration and functional impairment criteria

PTSD diagnosis requires:
- Criterion A: direct exposure to qualifying traumatic event
- Criterion B: >=1 intrusion symptom (items 1-5)
- Criterion C: >=1 avoidance symptom (items 6-7)
- Criterion D: >=2 negative alterations in cognition and mood (items 8-14)
- Criterion E: >=2 alterations in arousal and reactivity (items 15-20)
- Criterion F: duration >1 month
- Criterion G: clinically significant distress or impairment
- Criterion H: not attributable to substance or medical condition

## Severity Score Ranges

CAPS-5 total severity (sum of all item severity scores):

| Range | Interpretation |
|-------|----------------|
| 0-19 | Asymptomatic / few symptoms |
| 20-39 | Mild PTSD / subthreshold |
| 40-59 | Moderate PTSD |
| 60-79 | Severe PTSD |
| 80+ | Extreme PTSD |

These ranges are approximate and should be interpreted in context. Use the
diagnostic scoring rules, not the total severity score, to determine
diagnostic status.

## Subtype Specifiers

- **With dissociative symptoms:** Endorsement of either item 29
  (depersonalization) or item 30 (derealization) at severity >=2, in
  addition to meeting full PTSD criteria
- **With delayed expression:** Full diagnostic criteria not met until at
  least six months after the trauma

## Forensic Use Notes

- The CAPS-5 is the most widely accepted PTSD diagnostic instrument in
  forensic practice
- Administer ONCE the index trauma has been clearly identified; running
  the full interview with no identified Criterion A event is inappropriate
- Always combine with a validated symptom validity measure (PCL-5 plus MMPI-3
  validity scales, for example) in forensic contexts
- Available free of charge from the National Center for PTSD to qualified
  professionals at ptsd.va.gov
- Specific training videos and scoring workshops are available through the
  National Center for PTSD
`,
}

// ---------------------------------------------------------------------------
// PCL-R (Hare Psychopathy Checklist - Revised)
// ---------------------------------------------------------------------------

const PCLR: TestingGuide = {
  filename: 'PCL-R_Scoring_Criteria.md',
  instrument: 'PCL-R',
  content: `# PCL-R Scoring Criteria

The Psychopathy Checklist, Revised (Hare, 2003) is a 20-item rating scale
for the assessment of psychopathy. It is scored from a semi-structured
interview and a thorough record review. It is NOT a self-report instrument.

## Administration

- Requires formal training (typically a 2-3 day workshop)
- Semi-structured interview (1-2 hours)
- Extensive collateral record review is REQUIRED; scoring without records
  is not permitted per the manual
- Administration + scoring time: 3-6 hours

## Items and Factors

The 20 items load onto four facets organized in two factors plus two items
that do not load on a factor.

### Factor 1: Interpersonal/Affective

**Facet 1: Interpersonal**
- Item 1 Glibness/Superficial Charm
- Item 2 Grandiose Sense of Self-Worth
- Item 4 Pathological Lying
- Item 5 Conning/Manipulative

**Facet 2: Affective**
- Item 6 Lack of Remorse or Guilt
- Item 7 Shallow Affect
- Item 8 Callous/Lack of Empathy
- Item 16 Failure to Accept Responsibility

### Factor 2: Social Deviance

**Facet 3: Lifestyle**
- Item 3 Need for Stimulation/Proneness to Boredom
- Item 9 Parasitic Lifestyle
- Item 13 Lack of Realistic, Long-Term Goals
- Item 14 Impulsivity
- Item 15 Irresponsibility

**Facet 4: Antisocial**
- Item 10 Poor Behavioral Controls
- Item 12 Early Behavioral Problems
- Item 18 Juvenile Delinquency
- Item 19 Revocation of Conditional Release
- Item 20 Criminal Versatility

### Items Not Loading on a Factor
- Item 11 Promiscuous Sexual Behavior
- Item 17 Many Short-Term Marital Relationships

## Scoring

Each item is rated:
- **0** Does not apply
- **1** Applies to some extent
- **2** Definitely applies

Total score range: 0-40

## Interpretation

The PCL-R does NOT produce a categorical diagnosis. It produces a
dimensional score reflecting the presence and severity of psychopathic
features.

Common cutoffs:
- **30 or higher**: Research cutoff for classification as "psychopathic"
  in North American samples; used in most PCL-R research
- **25 or higher**: Sometimes used in European samples
- **0-19**: Generally non-psychopathic range
- **20-29**: Intermediate/"mixed" range

Cutoffs should NEVER be applied mechanically in forensic reports. Present
the total and facet scores, describe the items that were rated as present,
and offer an interpretation in the specific context of the psycho-legal
question.

## Forensic Use Notes

- Highly admissible under Daubert and Frye
- Frequently used in sexually violent predator proceedings, parole
  decisions, and treatment planning
- Training and supervision are essential; the manual requires raters to
  establish interrater reliability before independent use
- The PCL:SV (Screening Version) is available for shorter assessments but
  produces a less reliable score
- Publisher: Multi-Health Systems (MHS)
- Score interpretation should be cautious, especially at the high end; a
  high PCL-R score does not by itself predict future violence
`,
}

// ---------------------------------------------------------------------------
// WAIS-V
// ---------------------------------------------------------------------------

const WAIS: TestingGuide = {
  filename: 'WAIS-V_Subtest_Reference.md',
  instrument: 'WAIS-V',
  content: `# WAIS-V Subtest Reference

The Wechsler Adult Intelligence Scale, Fifth Edition is the standard
individually administered measure of adult cognitive functioning for
examinees aged 16 years through 90.

## Composite Scores

The WAIS-V produces a Full Scale IQ (FSIQ) and five index scores:

- **VCI** Verbal Comprehension Index
- **VSI** Visual Spatial Index
- **FRI** Fluid Reasoning Index
- **WMI** Working Memory Index
- **PSI** Processing Speed Index

Composite score mean = 100, SD = 15.

## Classification (by composite score)

| Range | Classification |
|-------|----------------|
| 130+ | Extremely High |
| 120-129 | Very High |
| 110-119 | High Average |
| 90-109 | Average |
| 80-89 | Low Average |
| 70-79 | Very Low |
| <=69 | Extremely Low |

Report both the standard score and the 95% confidence interval. Never
report an FSIQ without also reporting the index scores and commenting on
index variability.

## Subtest Scores

Subtest scores have mean = 10, SD = 3. Classification:

| Range | Classification |
|-------|----------------|
| 16+ | Well above average |
| 13-15 | Above average |
| 8-12 | Average |
| 5-7 | Below average |
| <=4 | Well below average |

## Core Subtests by Index

**VCI**
- Similarities (abstract verbal reasoning)
- Vocabulary (word knowledge, verbal concepts)
- Information (general fund of knowledge), supplemental in some protocols

**VSI**
- Block Design (spatial problem-solving, visual motor)
- Visual Puzzles (mental rotation, spatial reasoning)

**FRI**
- Matrix Reasoning (nonverbal inductive reasoning)
- Figure Weights (quantitative reasoning without reading)

**WMI**
- Digit Span (working memory, attention)
- Picture Span (visual working memory) or Letter-Number Sequencing

**PSI**
- Symbol Search (visual scanning, speed)
- Coding (visual-motor speed, sustained attention)

## Forensic Use Notes

- Use the WAIS-V when a formal IQ assessment is needed for intellectual
  disability determination, competency evaluations involving cognitive
  concerns, or disability claims
- The Flynn effect should be considered in death penalty cases; consult
  the manual and recent case law
- Performance validity testing is required when test results will be used
  forensically; the WAIS-V has embedded validity indicators but should be
  paired with a stand-alone PVT such as the TOMM
- Cultural and linguistic factors matter; use the administration manual's
  guidance for non-native English speakers
- Publisher: Pearson Clinical Assessments
`,
}

export const TESTING_GUIDES: readonly TestingGuide[] = [
  MMPI3,
  PAI,
  TOMM,
  HCR20,
  CAPS5,
  PCLR,
  WAIS,
] as const
