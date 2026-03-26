# Psygil Stage 4: Review — Production Specification
## Complete Report Generation, Clinical Editing, Legal Review, and Finalization

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Production Specification
**References:** Case Lifecycle Spec (doc 18), Agent Prompt Specs (doc 03), UNID Redaction Architecture (doc 15), Case Directory Schema (doc 16), Pipeline Architecture (doc 14)

---

## Stage 4 Overview

**What Review Means Clinically**

The Review stage is where clinical judgment becomes professional documentation. The clinician has completed all evaluation work: history gathering, testing, interviewing, and diagnostic decision-making. The Review stage exists to transform those clinical conclusions into a defensible, legally sound, ethically grounded written report that can be filed with a court, sent to an attorney, or placed in a medical record.

The Review stage is iterative — the clinician may edit the report multiple times, request legal review, make changes based on legal feedback, and loop through editing again. The stage is complete only when the clinician signs the final report.

**Entry Conditions (Stage 3 Exit)**

A case enters Review when:
- All referral questions have been addressed in the clinical record
- At least one diagnosis has been confirmed (or "No diagnosis" explicitly documented)
- The clinician's clinical opinion/psycholegal conclusion has been written
- All diagnostic decisions (Confirm, Rule Out, Defer) are documented
- The case.json status is `Review` and `report/` directory exists

**Exit Conditions (Stage 4 Exit)**

A case exits Review (advances to Complete) only when:
- A final report has been generated and digitally signed by the clinician
- The report is saved in `report/final/evaluation_report.docx` and `report/final/evaluation_report.pdf`
- The signed report contains full PHI (patient names, dates, addresses — never redacted)
- The audit trail entry "report_signed" has been logged with version and timestamp

---

## Step 4.1: Case Record Assembly for Report

### Purpose

Before the Writer Agent can generate a report draft, the application must assemble a complete, validated case record from all prior stages. This record contains everything the clinician has documented from intake through diagnostics.

### Data Sources and Validation

The case record assembly pulls from these locations:

| Data Component | Source File(s) | Validation |
|---|---|---|
| Demographics | `intake/demographics.json` | First name, last name, DOB, age, gender all present |
| Referral info | `referral/referral_metadata.json` | Referral questions extracted, referral source, deadline, parties |
| Informed consent | `intake/consent_signed.pdf` exists | Boolean: consent on file (warns if not, doesn't block) |
| Biopsychosocial history | `intake/biopsychosocial.json` (cleaned version) | All 13 sections complete or marked as "not applicable" |
| Collateral records | `collateral/collateral_index.json` | Manifest of all collateral documents with summaries |
| Test battery | `testing/testing_summary.json` | List of instruments administered |
| Test scores | `testing/scores/{instrument}_scores.json` (all instruments) | All selected instruments scored and reviewed |
| Validity summary | `testing/validity/validity_summary.json` | Standalone validity tests passed/failed, embedded scales reviewed |
| Interview notes | `interviews/session_NNN/notes.json` (all sessions) | All session notes present, clinician verification complete |
| Mental Status Exam | `interviews/session_NNN/mental_status.json` (primary clinical session) | MSE domains documented: appearance, behavior, speech, mood, affect, etc. |
| Collateral interview summaries | `interviews/collateral_interviews/` | If applicable: summary of external contacts and their observations |
| Diagnostic formulation | `diagnostics/diagnostic_formulation.json` | Confirmed diagnoses with ICD-10 codes, clinician justification per diagnosis |
| Differential diagnoses | `diagnostics/differential_dx.json` | Ruled-out diagnoses with reasoning |
| Feigning assessment | `diagnostics/feigning_assessment.json` | If applicable: validity concerns and clinical interpretation |
| Clinical opinion | `diagnostics/` (from clinician entry) | Psycholegal opinion (forensic) or clinical recommendations (clinical) |

### Data Validation Before Draft Generation

Before sending the assembled record to the Writer Agent, the application validates:

```
1. COMPLETENESS:
   ✓ Intake form 100% complete (no required fields null)
   ✓ At least one test battery instrument scored
   ✓ At least one interview session documented
   ✓ At least one diagnosis confirmed OR "No diagnosis" documented
   ✓ Clinical opinion field is not empty
   ✗ Missing required field → error: "Cannot generate report. Missing [component]. Please complete this section."

2. DATA CONSISTENCY:
   ✓ Test instruments in testing_summary.json match scored items in testing/scores/
   ✓ Interview count in case.json matches session directories
   ✓ Validity summary includes validity status for all administered instruments
   ✓ Diagnosed conditions are clinician-selected, not AI-suggested
   ✗ Mismatch found → warning: "Test battery mismatch: [instrument] scored but not listed in testing_summary.json"

3. REFERRAL ALIGNMENT:
   ✓ Each referral question appears in the clinical record (addressed in interview notes, test results, or diagnostic section)
   ✗ Unanswered referral question → warning: "Referral question not addressed in clinical record. Clinician should add to interview notes or diagnostic formulation."

4. CONSENT STATUS:
   ✓ Signed consent on file
   ✗ No consent → warning: "No signed informed consent on file. Report cannot be finalized without consent. Scan the signed form and import it before finalizing."
```

If any validation fails, the application displays the failures and does not proceed with draft generation. The clinician must resolve them.

### Assembled Record Structure

The validated case record is organized as a JSON object containing:

```json
{
  "caseId": "2026-0147",
  "caseNumber": "2026-0147",
  "demographics": {
    "firstName": "Marcus",
    "lastName": "Johnson",
    "dateOfBirth": "1991-06-14",
    "age": 34,
    "gender": "M",
    "address": "1247 Elm Street, Denver, CO 80202",
    "phone": "(303) 555-0147",
    "ssn": "123-45-6789"
  },
  "referral": {
    "source": "Court",
    "referringParty": "Public Defender Sarah Mitchell",
    "referralDate": "2026-02-28",
    "deadline": "2026-04-15",
    "jurisdiction": "Denver District Court",
    "charges": "Assault 2 (F4), Menacing (M1)",
    "questions": [
      "Does defendant understand the charges?",
      "Can defendant assist in defense?",
      "What is defendant's mental health status?"
    ]
  },
  "evaluation": {
    "type": "CST",
    "evaluator": "Dr. Truck Irwin, Psy.D., ABPP",
    "licenseNumber": "PSY12345",
    "evaluationDate": "2026-03-22",
    "sessions": 3,
    "totalHours": 5.5
  },
  "consent": {
    "onFile": true,
    "signedDate": "2026-03-10",
    "filePath": "intake/consent_signed.pdf"
  },
  "biopsychosocial": {
    "familyHistory": "...",
    "educationHistory": "...",
    "employmentHistory": "...",
    "legalHistory": "...",
    "medicalHistory": "...",
    "psychiatricHistory": "...",
    "substanceUseHistory": "..."
  },
  "collateral": [
    {
      "name": "Court Order",
      "type": "Court Order",
      "receivedDate": "2026-02-28",
      "summary": "..."
    }
  ],
  "testing": {
    "instruments": [
      {
        "name": "MMPI-3",
        "administrationDate": "2026-03-12",
        "scores": { "raw": {...}, "scaled": {...}, "T": {...} },
        "validity": "valid",
        "clinicianReviewNotes": "Profile shows elevations on scales 4 and 6."
      }
    ]
  },
  "validity": {
    "overallStatus": "adequate",
    "effortTests": {
      "TOMM": "pass"
    },
    "mmpi3Validity": {
      "vrinT": 45,
      "trinT": 52,
      "fScale": 48,
      "interpretation": "Valid responding"
    },
    "summary": "All validity indicators acceptable. Test battery is interpretable."
  },
  "interviews": {
    "sessions": [
      {
        "sessionNumber": 1,
        "date": "2026-03-15",
        "duration": 2.0,
        "mentalStatus": {
          "appearance": "Well-groomed, casually dressed",
          "behavior": "Cooperative throughout",
          "speech": "Normal rate and volume",
          "mood": "Euthymic, reported as 'okay'",
          "affect": "Congruent with content",
          "thoughtProcess": "Logical, goal-directed",
          "thoughtContent": "No SI/HI, paranoid ideation present",
          "perception": "Denies hallucinations",
          "cognition": "Oriented x3, good memory",
          "insight": "Limited insight into psychiatric symptoms",
          "judgment": "Impaired re: legal consequences"
        },
        "notes": "..."
      }
    ],
    "collateralInterviews": [
      {
        "contact": "Defense Counsel Sarah Mitchell",
        "relationship": "Attorney",
        "date": "2026-03-18",
        "summary": "..."
      }
    ]
  },
  "diagnostics": {
    "confirmedDiagnoses": [
      {
        "icdCode": "F20.0",
        "name": "Schizophrenia, Paranoid Type",
        "justification": "Evidence includes paranoid ideation reported in interview, elevated thought process disturbances on MMPI-3, and collateral report of bizarre behavior.",
        "clinicianNotes": ""
      }
    ],
    "ruledOutDiagnoses": [
      {
        "icdCode": "F32.1",
        "name": "Major Depressive Disorder, Moderate",
        "reasoning": "While elevated mood disturbance on MMPI-3, clinical interview revealed no depressed mood, no anhedonia, and functional impairment attributable to psychotic symptoms rather than depression."
      }
    ],
    "clinicalOpinion": "Not competent to stand trial. Defendant demonstrates insufficient understanding of charges and inability to rationally assist counsel due to command hallucinations and paranoid ideation. Restoration of competency through psychiatric treatment is recommended."
  },
  "auditTrail": [
    {
      "timestamp": "2026-03-22T14:30:00Z",
      "action": "case_advanced_to_review",
      "details": "Diagnostics complete, ready for report generation"
    }
  ]
}
```

---

## Step 4.2: Writer Agent Draft Generation (UNID Redaction Point 2)

### Purpose

The Writer Agent transforms the structured, validated case record into professional prose organized in standard evaluation report format. The Writer Agent works exclusively with the clinician's decisions — diagnoses they confirmed, opinions they wrote — and does not introduce its own interpretations or recommendations.

### Input Preparation: UNID Redaction Point 2

Before sending the assembled case record to the Writer Agent:

1. **Fresh UNID Map Generation**
   - Create a new UNID mapping (not reused from any prior operation)
   - Type prefixes: PERSON_, DOB_, DATE_, ADDRESS_, PHONE_, SSN_, RECNUM_, LICENSE_, etc.
   - Each PHI element gets a unique, random UNID

2. **Redaction Pipeline**
   - Full-PHI case record passed to Python sidecar
   - Redaction includes:
     - Patient name, family member names, collateral contact names, attorney names, clinician name
     - Dates of birth, evaluation dates, session dates, referral dates
     - Addresses, phone numbers, email addresses
     - SSN, case number, medical record number, license numbers
     - Facility names that could identify the patient
     - Any other Safe Harbor identifiers
   - Does NOT redact:
     - Diagnoses, ICD-10 codes, DSM-5-TR criteria
     - Test scores, validity indicators, scale interpretations
     - Clinical observations, behavioral descriptions
     - Charges, legal questions, referral questions
     - Psycholegal analysis elements

3. **Transmission**
   - Redacted case record (with UNIDs) sent to Writer Agent via HTTPS
   - UNID map destroyed locally after transmission
   - Map is in-memory only, never written to disk

### Writer Agent Invocation

**Input Schema:**
```json
{
  "caseId": "CASE_[unid]",
  "evaluationType": "forensic_competency",
  "clinicianVoice": {
    "tone": "professional, direct, clinical",
    "preferences": "avoid florid language; focus on evidence"
  },
  "caseRecord": { /* full redacted case record */ },
  "reportTemplate": "forensic_competency",
  "section_preferences": {
    "opinion_length": "1-2 pages",
    "test_result_format": "prose with summary table",
    "diagnostic_detail_level": "comprehensive"
  }
}
```

### Report Structure Generated by Writer Agent

The Writer Agent produces a report with the following sections, each with specific content requirements and tone:

#### **1. Identifying Information & Referral**
**Content Type:** fully_generated (routine documentation)

Includes:
- Evaluee name, age, date of birth, address
- Referral source, referring party, referral date
- Evaluation type, evaluator name and credentials, evaluation dates
- Legal/clinical context: charges (if criminal), referring attorney/court, case number
- Purpose of evaluation restated as referral questions

Example prose:
> IDENTIFYING INFORMATION AND REFERRAL
>
> This evaluation was conducted with PERSON_a7f3c2, a [AGE]-year-old [GENDER] referred by [PERSON_b3e8c7], Public Defender, on DOB_f29c71 (Age [AGE]). The referral was received on DATE_d1e84b for evaluation of the defendant's competency to stand trial in the matter of State v. PERSON_a7f3c2, Case No. RECNUM_c5a912, regarding charges of Assault 2 (F4) and Menacing (M1).
>
> The specific referral questions addressed in this evaluation are:
> 1. Does the defendant understand the nature and consequences of the charges?
> 2. Is the defendant able to rationally assist counsel in his defense?
> 3. What is the defendant's current mental health status?

---

#### **2. Informed Consent & Evaluation Procedures**
**Content Type:** fully_generated (routine documentation)

Includes:
- Informed consent procedures followed (forensic consent differs from clinical)
- Patient advised of: purpose, scope, limits of confidentiality, who report will be shared with, lack of therapist-patient privilege
- Evaluation procedures: specific tests administered, interview duration, collateral records reviewed
- Any limitations on the evaluation (time constraints, records unavailable, etc.)

Example prose:
> INFORMED CONSENT AND EVALUATION PROCEDURES
>
> Prior to initiating the evaluation, PERSON_a7f3c2 was provided with an informed consent document explaining the nature and purpose of the evaluation, the evaluation procedures, the limits of confidentiality, and the fact that the evaluation is for forensic purposes and does not establish a therapist-patient relationship. The defendant signed the informed consent dated DATE_d1e84b.
>
> The evaluation consisted of three face-to-face sessions conducted on [dates]. The evaluation procedures included:
> - Comprehensive clinical interview (2.5 hours total)
> - Psychological testing (1.5 hours): MMPI-3, PAI, WAIS-V, TOMM, SIRS-2
> - Mental status examination
> - Review of collateral records: court order, police report, jail mental health records, prior evaluation dated DATE_d1e84b
> - Collateral interview with defense counsel regarding client's legal understanding

---

#### **3. Relevant History (Organized by Referral Questions)**
**Content Type:** fully_generated (routine documentation, organized per clinician needs)

This is the biopsychosocial narrative reorganized by referral question rather than chronologically. For example, if the referral questions are about competency, the history focuses on: education (ability to understand instructions), occupational history (adaptive functioning), psychiatric history (cognitive effects of mental illness), legal history (understanding consequences).

Includes:
- Family and developmental history
- Medical history (conditions, medications, surgeries affecting mental status)
- Psychiatric history (prior diagnoses, hospitalizations, treatments)
- Substance use history
- Educational/occupational history
- Legal history (arrests, convictions, incarcerations)
- Social/relationship history
- Timeline of events leading to current evaluation

The Writer Agent uses the clinician's cleaned biopsychosocial summary but may reorganize it to flow from history → current presentation → evaluation.

---

#### **4. Behavioral Observations & Mental Status Examination**
**Content Type:** fully_generated for routine observations; draft_requiring_revision for interpretive observations

Includes:
- Physical appearance (dress, grooming, physical anomalies, apparent age)
- General behavior (motor activity, cooperation, alertness, response to examiner)
- Speech (rate, volume, articulation, language use)
- Mood and affect (self-reported mood, observed emotional state, congruence)
- Thought process (logical vs. disorganized, goal-directed vs. tangential)
- Thought content (preoccupations, suicidal/homicidal ideation, delusions, paranoia)
- Perceptual experiences (hallucinations, illusions)
- Cognition (orientation, memory, attention, concentration)
- Insight (awareness of mental health condition, understanding of need for treatment)
- Judgment (ability to evaluate consequences, make sound decisions)

Example MSE prose:
> MENTAL STATUS EXAMINATION
>
> APPEARANCE: PERSON_a7f3c2 appeared his stated age of [AGE] years. He was casually but appropriately dressed in jeans and a blue button-up shirt. Grooming and hygiene were adequate. No visible scars, tattoos, or physical anomalies were noted.
>
> BEHAVIOR: The defendant was alert and oriented throughout the evaluation. He maintained good eye contact and was cooperative with the evaluator. Psychomotor activity was normal. No evidence of tremor, tics, or unusual movements.
>
> SPEECH: Speech was clear, coherent, and at a normal rate and volume. Grammar and vocabulary were consistent with reported education level.
>
> MOOD/AFFECT: The defendant reported his current mood as "okay" with a slightly constricted affect. Affect appeared somewhat incongruent with the severity of legal circumstances.

**Mandatory note in final report:**
> Note: Behavioral observations were made during the clinical interviews of [dates]. These observations reflect the defendant's presentation on those specific dates and times and may not generalize to other contexts or time periods.

---

#### **5. Test Results & Interpretation**
**Content Type:** fully_generated for validity reporting and score documentation; draft_requiring_revision for interpretation

This is the most substantial section.

**A. Validity and Effort Assessment (if applicable)**

Reported first. Includes:
- Standalone effort/validity tests (TOMM, SIRS-2, M-FAST, VSVT): pass/fail status
- Embedded validity scales (MMPI-3: VRIN-T, TRIN-T, F, Fp, Fs, L, K; PAI: NIM, PIM, ICN): scores and interpretation
- Overall interpretability of the test battery

Example:
> VALIDITY AND EFFORT ASSESSMENT
>
> Test validity is an essential prerequisite for interpreting psychological test results. Several measures within the test battery are specifically designed to detect inconsistent, random, or malingered responding.
>
> TOMM (Test of Memory Malingering): PERSON_a7f3c2 performed at 94% on Trial 1 and 96% on Trial 2, well above the cutoff of 45% (below which performance is considered invalid). This is interpreted as valid effort on memory testing.
>
> SIRS-2 (Structured Inventory of Reported Symptoms, 2nd Edition): Total score of 42, below the cutoff of 76 that suggests feigned mental illness. This score is consistent with authentic, non-malingered reporting.
>
> MMPI-3 Validity Scales: VRIN-T = 45, TRIN-T = 52, F-family scales within normal range. These scores indicate valid responding and consistency in test item endorsement. The MMPI-3 profile is interpretable for clinical and forensic purposes.
>
> Conclusion: All validity indicators suggest that PERSON_a7f3c2 responded authentically and put forth adequate effort throughout the test battery. The following test scores and interpretations are considered valid.

**B. Individual Test Score Reporting**

For each administered instrument, report:
- Test name, administration date, form/version
- All subtest or scale scores (raw scores, scaled scores, T-scores, percentiles as available per test)
- Publisher-provided interpretive classifications
- Cross-test comparisons (how this test's findings compare to others)

Example (MMPI-3):
> MMPI-3 (Minnesota Multiphasic Personality Inventory, 3rd Edition)
> Administration Date: DATE_d1e84b
> Form: Standard (567 items)
>
> MMPI-3 Validity Scales:
> [Table with VRIN-T, TRIN-T, F, Fp, Fs, L, K scores]
>
> MMPI-3 Content Scales:
> [Table with elevations and T-scores]
>
> MMPI-3 Profile Code: 4-6'-2', indicating elevated anger/hostility, potential interpersonal sensitivity, and possible depression.
>
> Interpretation: The MMPI-3 profile demonstrates elevations on scales consistent with impulsivity, interpersonal conflict, and possible depressive features. These findings are consistent with the defendant's reported legal troubles and current circumstances.

**C. Cross-Instrument Interpretation**

Synthesize patterns across tests. This section is draft_requiring_revision because it requires clinical judgment about what patterns mean.

Example:
> SUMMARY OF TEST FINDINGS
>
> Across the test battery, several consistent patterns emerge:
>
> 1. Cognitive Functioning: WAIS-V Full Scale IQ = [score], [classification]. Subtest scatter shows [specific pattern]. Interpretation: [clinician's words]
>
> 2. Emotional/Personality: Both MMPI-3 and PAI profiles show elevations on anger/hostility scales. This is consistent with [clinical observation from interview].
>
> 3. Effort and Validity: All validity indicators support authentic, non-malingered responding across all measures.
>
> These findings suggest [clinician's interpretation of what the tests collectively indicate about the referral questions].

---

#### **6. Clinical Formulation & Diagnosis**
**Content Type:** draft_requiring_revision (clinician must review and finalize)

Organize by referral question (for forensic) or by symptom domain (for clinical).

For each diagnosed condition:
- Criterion-by-criterion mapping of DSM-5-TR criteria met
- Evidence from test results, interviews, behavioral observations
- How this diagnosis explains the referral questions or presenting concerns
- Differential diagnosis discussion (why this diagnosis, not others)

Example (Competency evaluation):
> CLINICAL DIAGNOSIS AND FORMULATION
>
> Based on the clinical interview, psychological testing, and collateral information, the following diagnosis is offered:
>
> **Schizophrenia, Paranoid Type, F20.0**
>
> DSM-5-TR Criterion A (Active-Phase Symptoms): PERSON_a7f3c2 demonstrates the following active symptoms:
> - Delusions: Reported beliefs that law enforcement is monitoring him through surveillance equipment and that his attorney is working against him
> - Hallucinations: Reported command hallucinations telling him to act against others; denies hearing them during interview but reports they "come and go"
> - Disorganized speech: Occasional tangential thinking, though generally coherent
> - Negative symptoms: Restricted affect, social withdrawal
>
> Evidence includes:
> - Clinical interview: Spontaneous paranoid ideation emerged without prompting
> - MMPI-3: Paranoia scale (Pa) elevated at T=72
> - PAI: Persecution scale elevated, Unusual Thought Content scale elevated
> - Collateral interview with prior treatment provider: "Patient has long history of paranoid delusions and auditory hallucinations"
> - Jail mental health notes: "Reports command hallucinations; prescribed antipsychotic medication"
>
> DSM-5-TR Criterion B (Functional Decline): Onset of symptoms approximately [DATE_d1e84b], followed by decline in occupational functioning (job loss [DATE_d1e84b]) and legal consequences (arrests [DATE_d1e84b], [DATE_d1e84b]). Current incarceration prevents assessment of community functioning, but pre-incarceration history shows significant deterioration.
>
> Conclusion regarding competency to stand trial: The defendant's paranoid delusions and command hallucinations significantly impair his ability to understand the charges against him and to rationally assist his counsel in defense. He believes his attorney is part of a conspiracy against him, which prevents meaningful attorney-client collaboration.

---

#### **7. Psycholegal Opinion (Forensic) OR Clinical Recommendations (Clinical)**
**Content Type:** draft_requiring_revision (this is the clinician's conclusion, heavily revised by clinician)

**For forensic cases (CST, insanity, custody, civil commitment):**

The Writer Agent expands the clinician's stated opinion into 2-3 paragraphs of professional narrative. The clinician's conclusion is non-negotiable; the AI is drafting the surrounding prose.

Example (CST case):
> PSYCHOLEGAL OPINION: COMPETENCY TO STAND TRIAL
>
> [Clinician's stated opinion: "Not competent — recommend restoration treatment"]
>
> Based on the evaluation findings, it is the opinion of this evaluator that PERSON_a7f3c2 is not competent to stand trial in State v. PERSON_a7f3c2, Case No. RECNUM_c5a912.
>
> The legal standard for competency to stand trial requires that a defendant possess: (1) a factual understanding of the charges and court proceedings, (2) a rational understanding of those charges in relation to his own circumstances, and (3) the ability to assist his counsel in his own defense (Dusky v. United States, 1960).
>
> Based on clinical interview, the defendant demonstrates insufficient factual understanding of the charges. He cannot explain why he has been charged with Assault 2, confusing the current charges with prior legal incidents. More significantly, he lacks rational understanding due to paranoid delusions regarding his attorney — he states, "My lawyer is part of the setup against me." This fundamental distrust, rooted in psychiatric illness rather than rational skepticism, severely compromises his ability to work collaboratively with counsel.
>
> Regarding the ability to assist counsel: The defendant's command hallucinations ordering him to act against others, combined with limited insight into his psychiatric condition, create substantial risk of impulsive behavior during trial proceedings. He is unable to assist counsel in developing a coherent defense strategy because he attributes the charges to external persecution rather than his own actions.
>
> **Recommendation:** Competency restoration through psychiatric hospitalization and antipsychotic medication. The defendant is a candidate for restoration. Estimated timeline: 6-12 months of treatment in a secure psychiatric facility with competency-focused programming.

**For clinical cases:**

The Writer Agent formats the clinician's recommendations into structured prose.

Example (clinical evaluation):
> CLINICAL RECOMMENDATIONS
>
> Based on the diagnostic impressions and functional assessment, the following recommendations are offered:
>
> 1. **Psychiatric Treatment**: Referral to [type] psychiatrist for evaluation and management of Major Depressive Disorder. Consider antidepressant medication with combination psychotherapy approach.
>
> 2. **Psychotherapy**: Individual psychotherapy recommended, focusing on [specific targets per case]. Frequency: [recommendation] per week.
>
> 3. **Vocational Assessment**: Patient's occupational functioning is compromised by [specific impairments]. Referral to vocational rehabilitation for job coaching and workplace accommodations.
>
> 4. **Medical Evaluation**: Follow-up with primary care physician regarding [specific medical concerns].
>
> 5. **Family Support**: Family therapy recommended to address [specific dynamics].

---

#### **8. Recommendations**
**Content Type:** fully_generated for structured list; draft_requiring_revision for detailed recommendations

Lists all recommendations for the clinical, legal, or treatment setting. This section can be brief (bullets) or detailed depending on eval type.

---

### Response Re-hydration and Storage

After the Writer Agent returns the draft:

1. **Re-hydration Pipeline**
   - AI response contains UNIDs (e.g., "PERSON_a7f3c2 was evaluated on DATE_d1e84b")
   - Python sidecar re-hydrates: replace each UNID with original PHI
   - Result: full-PHI report text with patient names, dates, addresses
   - Re-hydrated text stored in SQLCipher and in `report/drafts/draft_v1.docx`

2. **UNID Map Destruction**
   - UNID map is overwritten from memory (not just dereferenced)
   - Cannot be recovered
   - Subsequent operations (if clinician requests another draft) will generate entirely new UNIDs

3. **Draft Storage**
   - Report saved as `report/drafts/draft_v1.docx` in OnlyOffice format
   - Contains FULL PHI — real names, dates, addresses
   - Draft status: "draft_v1" (version tracking begins)
   - Audit trail: "report_draft_generated" with version v1

---

## Step 4.3: Clinician Editing

### Purpose

The AI-generated draft is a scaffold with all clinical data correctly organized and presented. The clinician's work is to refine, revise, and personalize this draft to match their professional voice, clinical judgment, and legal precision.

### Report Opens in OnlyOffice Editor

The draft automatically opens in the OnlyOffice editor (column 2 main pane):

- Read-only mode initially (clinician must explicitly enable edit)
- Full formatting capabilities (fonts, styles, tables, highlighting)
- Track changes enabled (optional — clinician can see revisions or work without tracking)
- Side-by-side comparison with prior versions (if editing v2 or later)

### What Clinicians Typically Edit

Based on domain expertise and professional practice:

1. **Tone and Voice**
   - AI prose may be more formal than clinician's natural voice
   - Clinician adjusts for personal writing style
   - Emphasis adjusted based on what matters most for the case

2. **Clinical Nuance**
   - AI may miss subtle clinical observations
   - Clinician adds observations from interview: "Patient was visibly anxious when discussing the alleged offense" or "Affect became labile when discussing family loss"
   - Clinician refines interpretation of test results based on clinical judgment

3. **Evidence Weighting**
   - AI presents evidence neutrally; clinician emphasizes what most strongly supports their conclusions
   - Example: Clinical formulation section may be rewritten to give more weight to test findings vs. collateral information

4. **Legal Precision (Forensic Cases)**
   - Clinician ensures psycholegal opinion maps directly to the legal standard (Dusky, M'Naghten, etc.)
   - Clinician removes or softens any overstatements
   - Clinician strengthens causal reasoning: "This psychiatric condition impairs competency because..."

5. **Section Organization**
   - Clinician may reorder sections, expand some, condense others
   - Clinical formulation section may be substantially rewritten

6. **Scope and Limits**
   - Clinician explicitly acknowledges what they did NOT evaluate and why
   - Example: "This evaluation was limited to competency assessment and did not address treatment planning"

7. **Recommendations**
   - Clinician refines and personalizes recommendations based on local resources, patient needs, legal requirements

### Version Tracking

**Every save creates a new version:**

- `draft_v1.docx` → (clinician edits and saves) → `draft_v2.docx`
- `draft_v2.docx` → (clinician edits and saves) → `draft_v3.docx`
- Previous versions NEVER deleted
- All versions remain in `report/drafts/`

**Side-by-side Comparison:**

UI provides diff view comparing current version to previous version:
- Additions highlighted in green
- Deletions highlighted in red
- Unchanged text in black
- Clinician can revert individual changes or entire sections

**Audit Trail:**

Each save logged with:
- Timestamp
- Version number
- User (clinician)
- Estimated word count change
- Example: `"2026-03-22T16:30:00Z | Dr. Truck Irwin | draft_v2 saved | +450 words, -120 words"`

### When Clinician is Satisfied

Clinician clicks "Request Legal Review" to proceed to Step 4.4.

---

## Step 4.4: Editor/Legal Agent Review

### Purpose

The Editor/Legal Agent performs a comprehensive quality assurance review of the current report draft. It checks for:
- Daubert compliance (sufficient facts, reliable methods, reliable application)
- Internal consistency (test data supports diagnoses, diagnoses support opinions)
- Completeness (all referral questions addressed, all tests reported)
- Legal vulnerabilities (statements vulnerable to cross-examination)
- Ethical compliance (scope of practice, limits acknowledged)
- Professional quality (grammar, APA style, clinical terminology)

This is NOT a correction phase — it's a vulnerability assessment. The clinician decides whether to accept, modify, or dismiss each issue.

### Input Preparation: Fresh UNID Redaction Point 3

The current draft (e.g., draft_v2.docx) is sent through UNID redaction again:

1. **New UNID Map** — fresh UNIDs generated (not reused from Point 2)
2. **Redaction** — same Safe Harbor identifiers redacted
3. **Transmission** — redacted draft sent to Editor/Legal Agent
4. **Map Destruction** — UNID map destroyed after transmission

### Editor/Legal Agent Invocation

**Input Schema:**
```json
{
  "caseId": "CASE_[unid]",
  "evaluationType": "forensic_competency",
  "draftText": "REDACTED REPORT TEXT WITH UNIDS",
  "referralQuestions": ["Does defendant understand charges?", "Can assist counsel?"],
  "diagnosisConfirmed": "F20.0 Schizophrenia, Paranoid Type",
  "psycholegalOpinion": "Not competent — recommend restoration",
  "jurisdiction": "Colorado State Court",
  "legalStandard": "Dusky"
}
```

### Review Analysis

The Editor/Legal Agent performs four analysis streams:

#### **A. Daubert Compliance (Forensic Cases)**

The Daubert standard (from *Daubert v. Merrell Dow Pharmaceuticals*, 1993, and *General Electric Co. v. Joiner*, 1997) requires expert opinions to be based on:
1. Sufficient facts or data
2. Reliable principles and methods
3. Reliable application of principles/methods to the case facts

The agent checks:

**Sufficient Facts/Data:**
- Are all referral questions supported by interview, testing, or collateral data?
- Are opinions based on case-specific evidence or general principles alone?
- Example: Opinion states "defendant cannot assist counsel" — does draft cite specific behaviors, test results, or statements supporting this? Critical Issue if not.

**Reliable Methods:**
- Are tests described as reliable? Do they have published validity and reliability?
- Are interpretations based on test manuals or clinician's personal theories?
- Example: TOMM is a reliable, validated test of memory malingering. Clinician's "gut feeling" about feigning is not reliable. Flag if unsupported.

**Reliable Application:**
- Are test scores interpreted according to published cutoffs, not clinician's preferences?
- Is the legal standard correctly stated and applied?
- Example: Competency standard is Dusky. Does opinion map to Dusky elements (understanding of charges, rational understanding, ability to assist)? Or does it veer into culpability or mens rea?

**Output for Daubert Issues:**
```json
{
  "severity": "Critical|Warning|Suggestion",
  "location": "Section: Clinical Formulation, Paragraph 2",
  "issue": "Opinion states 'defendant cannot assist counsel' but provides no specific example of inability (e.g., refuses to discuss case, responds to hallucinations mid-interview, etc.). This may be vulnerable to cross-exam challenge: 'Doctor, did defendant actually refuse to discuss the case, or are you inferring?'",
  "recommendedRevision": "Add specific behavioral examples: 'When asked about his defense strategy, defendant stated, \"I can't work with Ms. Mitchell because she's part of the conspiracy.\" When asked to explain this, he became hostile and refused to continue. This demonstrates his inability to work rationally with counsel due to psychiatric delusions.'",
  "severity_code": "Critical"
}
```

#### **B. Internal Consistency**

**Test Data → Diagnosis:**
- Do test results support the confirmed diagnoses?
- Are there contradictions? Example: "Patient shows no signs of depression on MMPI-3 (T=45) but is diagnosed with MDD." Why?
- Example flag: "Warning: MMPI-3 shows no elevation on depression scales (scale 2 T=48), but diagnosis states Major Depressive Disorder. This inconsistency may be challenged on cross-exam. Consider: (1) Is the diagnosis correct? (2) Should clinical interview findings override test results? (3) Is depression present but manifesting differently than MMPI-3 captures?"

**Diagnosis → Opinion:**
- Do confirmed diagnoses support the stated opinion?
- Example: "Diagnosis is adjustment disorder, but opinion states 'not competent due to severe mental illness.' This is a significant logical leap. Adjustment disorder is generally mild and situational. Does it truly prevent competency?"
- Flag Severity: Warning

**Evidence Alignment:**
- Are citations consistent? If clinical formulation cites a test result, does that result appear in the test results section?
- Example: "Formulation mentions 'MMPI-3 elevation on scale 3' but test results section shows no elevation on scale 3. This is either an error or the scale needs to be identified correctly."
- Flag Severity: Critical

#### **C. Completeness**

**Referral Questions:**
- Does the report address every referral question from referral/referral_metadata.json?
- Example: Three questions asked (competency, mental illness, restoration candidacy). Opinion addresses competency and mental illness. Where is restoration candidacy addressed? Flag: Suggestion: "Add paragraph on restoration candidacy and estimated timeline."

**Tests Administered:**
- Does the report describe findings from every test listed in testing/testing_summary.json?
- Example: Battery includes MMPI-3, PAI, WAIS-V, TOMM, SIRS-2. Report describes MMPI-3, PAI, WAIS-V, and TOMM but omits SIRS-2. Flag: Critical: "SIRS-2 administered but not reported. Include: [brief summary of SIRS-2 findings]."

**All Diagnoses:**
- Are all confirmed diagnoses addressed in the diagnostic formulation? No "hidden" diagnoses?
- Does the report explain ruled-out diagnoses (differential diagnosis)?
- Flag if differential diagnosis section is missing.

**Consent:**
- Is there evidence that informed consent procedures were followed?
- Example: Missing: "Prior to initiation, patient was provided with informed consent document explaining..." Flag: Suggestion: "Add sentence confirming informed consent procedures at beginning of procedures section."

#### **D. Legal Vulnerabilities & Cross-Exam Risk**

The agent identifies language that could be attacked on cross-examination and scores vulnerability.

Common vulnerabilities:

| Vulnerable Language | Cross-Exam Attack | Suggested Revision | Vulnerability Score |
|---|---|---|---|
| "Clearly unable to assist counsel" | "Doctor, what did defendant say that clearly showed inability?" | "Defendant stated he could not work with his attorney because she was part of a conspiracy against him. When asked to give an example, he could not." | 8/10 |
| "Severe mental illness" | "You stated 'severe' — what makes it severe vs. moderate? What's your definition?" | Cite DSM-5-TR functional impact or specific behavioral severity indicators | 6/10 |
| "Obviously malingering" | "How is it 'obvious'? What test or behavior made it obvious?" | Cite specific SIRS-2 score, TOMM performance, inconsistency in self-report | 9/10 |
| "In my clinical experience" | "Is that based on research or your personal anecdote? Did you review the research on this?" | Cite published literature or controlled test findings | 5/10 |
| "Strongly suggests feigning" | "What percentage of cases with these scores are actually feigning? Isn't that overinterpreted?" | State base rates: "SIRS-2 elevations appear in X% of actual psychiatric conditions; this elevates concern but does not confirm feigning" | 7/10 |

**Output Example:**
```json
{
  "severity": "Warning",
  "location": "Psycholegal Opinion, Paragraph 3",
  "vulnerable_language": "\"Defendant is clearly unable to assist counsel in his defense.\"",
  "crossExamChallenge": "\"Doctor, you said 'clearly' — but isn't that your interpretation? What exact statement or behavior did defendant make that showed inability to assist?\"",
  "recommendedRevision": "Replace 'clearly unable' with specific evidence: \"When asked to discuss his defense strategy with his attorney present, defendant stated he could not work with her because 'she's part of the conspiracy against me.' He refused to continue the discussion and became hostile. This demonstrates his inability to rationally collaborate with counsel due to paranoid delusions.\"",
  "vulnerabilityScore": 7,
  "scoring_rationale": "High vulnerability because 'clearly' is subjective and vague. Specific behavioral examples make opinion harder to attack."
}
```

#### **E. Ethical Compliance**

**Scope of Practice:**
- Does the opinion stay within the evaluator's scope (psychology, not law or medicine)?
- Example: Forensic report should not state "defendant is legally insane." It should state "defendant meets criteria for [diagnosis] which, under M'Naghten standard, suggests [legal prong impact]."
- Example: Clinical opinion should not state "defendant should receive disability benefits." The evaluator can describe functional impairment, but benefits determination is legal/administrative.
- Flag: Suggestion: "Consider revising 'defendant should be admitted to state hospital' to 'defendant would benefit from inpatient psychiatric hospitalization' to avoid overstepping into treatment planning authority."

**Limits Acknowledged:**
- Does the report acknowledge what was NOT evaluated?
- Example: "This evaluation does not address [treatment planning / dangerousness / likelihood of reoffense / etc.]. Those determinations require [other evaluation type]."
- Flag if limits are missing.

**Alternative Explanations Considered:**
- Does the formulation address alternative diagnoses?
- Example: If paranoid delusions are cited, does the report acknowledge and rule out substance-induced psychosis, medical conditions, or personality disorder paranoia?
- Flag: Suggestion: "Consider adding differential diagnosis discussion of Paranoid Personality Disorder vs. Schizophrenia. What distinguishes this case?"

**Conflicts of Interest:**
- Does the report disclose any real or apparent conflicts?
- Example: "This evaluation was conducted at the request of the defense. The evaluator is not in a therapeutic relationship with defendant and has no financial interest other than this engagement."
- Flag if missing.

#### **F. Professional Quality (Grammar, Style, Citation Format)**

- Spelling, grammar, punctuation checked
- APA format for test citations (example: "MMPI-3, Minnesota Multiphasic Personality Inventory, 3rd Edition (Ben-Porath & Tellegen, 2020)")
- Proper use of diagnostic codes (ICD-10, not arbitrary)
- Consistent terminology (don't switch between "defendant" and "patient" mid-report)
- Tables formatted correctly
- Font, spacing, line numbers consistent

### Review Output Format

The Editor/Legal Agent returns a structured review containing one entry per issue:

```json
{
  "caseId": "CASE_2026-0147",
  "draftVersion": "v2",
  "reviewDate": "2026-03-22T14:45:00Z",
  "issueCount": 7,
  "issues": [
    {
      "issueId": 1,
      "severity": "Critical",
      "category": "Completeness",
      "location": "Test Results Section, Paragraph 5",
      "excerpt": "...[excerpt of problematic text]...",
      "finding": "SIRS-2 instrument was administered but no results reported. This validity instrument is essential for interpreting whether psychiatric symptoms are authentic or feigned.",
      "recommendation": "Add paragraph: 'SIRS-2 (Structured Inventory of Reported Symptoms, 2nd Edition): Total score 48, below cutoff of 76. This score suggests authentic reporting without feigned psychiatric symptoms.'",
      "crossExamVulnerability": 9,
      "clinicianAction": "pending"
    },
    {
      "issueId": 2,
      "severity": "Warning",
      "category": "DaubertCompliance",
      "location": "Psycholegal Opinion, Paragraph 2",
      "excerpt": "Defendant is clearly unable to assist counsel...",
      "finding": "Conclusion uses vague language ('clearly unable') without specific behavioral examples.",
      "recommendation": "Provide specific examples of inability: When asked X, defendant responded Y. This demonstrates inability to Z.",
      "crossExamVulnerability": 7,
      "clinicianAction": "pending"
    },
    {
      "issueId": 3,
      "severity": "Suggestion",
      "category": "ProfessionalQuality",
      "location": "Clinical Formulation, Paragraph 1",
      "excerpt": "The defendant has schizophrenia...",
      "finding": "Diagnostic code not mentioned in diagnostic formulation. DSM-5-TR requires ICD-10 code.",
      "recommendation": "Change to: 'Schizophrenia, Paranoid Type, ICD-10 code F20.0'",
      "crossExamVulnerability": 2,
      "clinicianAction": "pending"
    }
  ]
}
```

### Sidebar Review Panel

The UI displays the review in a sidebar panel alongside the draft report:

**Left pane:** Draft report (editable)
**Right pane:** Review issues list with:
- Issue number, severity (color-coded: red=Critical, yellow=Warning, blue=Suggestion)
- Category, location, brief finding
- Recommended revision text (clickable to insert into report)

### Clinician Disposition

For each issue, clinician chooses one of three dispositions:

#### **1. Accept**
Clinician clicks "Accept" → recommended revision is inserted into the report at the specified location → version increments (v2 → v3) → saved automatically → audit trail logs: "Editor review issue #3 accepted and incorporated"

#### **2. Modify**
Clinician edits the recommended text or writes their own revision → clicks "Modify" → custom text inserted → version increments → audit trail logs: "Editor review issue #3 modified by clinician: [original recommendation] → [clinician's modification]"

#### **3. Dismiss**
Clinician clicks "Dismiss" (with optional reasoning) → issue removed from review panel → audit trail logs: "Editor review issue #3 dismissed. Clinician reasoning: [optional text]"

Example dismissal reasoning:
> "This is a stylistic preference. The phrase 'clearly unable' is appropriate for this case and is grounded in specific observations. The cross-exam will benefit from detailed behavioral description, which is provided in the previous paragraph."

**All dismissals logged.** If challenged later in litigation, the dismissal record shows the clinician was aware of the issue and made a deliberate choice to keep the language.

### Repeat Legal Review

After clinician modifies the draft based on review issues:
- Clinician can request another legal review of the updated draft
- New redaction, new review cycle
- Issues may be re-flagged or new issues may appear depending on changes
- Typical pattern: 1-2 legal reviews before finalization

---

## Step 4.5: Pre-Finalization Checklist

Before clinician can click "Finalize Report," the application runs an automated checklist:

```
PRE-FINALIZATION CHECKLIST
═════════════════════════════════════════════════════════════

□ All Referral Questions Addressed
  ├─ Question 1: "Does defendant understand charges?"
  │  Status: ✓ Addressed in Psycholegal Opinion (paragraphs 2-3)
  ├─ Question 2: "Can defendant assist in defense?"
  │  Status: ✓ Addressed in Psycholegal Opinion (paragraph 3)
  └─ Question 3: "Current mental health status?"
     Status: ✓ Addressed in Clinical Formulation section

□ All Instruments Reported
  ├─ MMPI-3: ✓ Results section, page 7
  ├─ PAI: ✓ Results section, page 8
  ├─ WAIS-V: ✓ Results section, page 9
  ├─ TOMM: ✓ Validity section, page 6
  └─ SIRS-2: ✓ Validity section, page 6

□ Diagnosis Section Complete
  ├─ Confirmed diagnoses: ✓ F20.0 Schizophrenia, Paranoid Type
  ├─ Differential diagnoses addressed: ✓ Paranoid Personality Disorder ruled out
  └─ Functional impact described: ✓ "Limited occupational functioning, social withdrawal"

□ Opinion Section Complete
  ├─ Legal standard stated: ✓ "Dusky standard for competency"
  ├─ Opinion directly addresses standard: ✓ "Unable to understand charges and assist counsel"
  └─ Reasoning provided: ✓ "Due to paranoid delusions regarding counsel"

□ All Critical Editor/Legal Issues Resolved
  ├─ Critical Issue #1 (SIRS-2 missing): ✓ Accepted and added
  ├─ Critical Issue #2 (insufficient facts): ✓ Accepted and detailed
  └─ Any unresolved Critical issues: ✗ NONE

□ Informed Consent on File
  ├─ Consent signed by patient: ✓ 2026-03-10
  └─ Consent on file in case directory: ✓ intake/consent_signed.pdf

═════════════════════════════════════════════════════════════

RESULT: ✓ ALL CHECKS PASSED
Ready for finalization and signing.

[Finalize Report Button - ENABLED]
```

### If Checks Fail

If any critical check fails:

**Example Warning:**
> "Referral Question #3 ('What is defendant's mental health status?') is not addressed in the report. The Clinical Formulation section covers diagnosis, but does not directly answer whether there is a current mental health concern and what it is. Would you like to: (1) Add a paragraph addressing this question, or (2) Proceed anyway [warned]?"

If clinician chooses "Proceed anyway [warned]," the finalization proceeds but the audit trail logs: "Pre-finalization check failed: referral question unanswered. Clinician proceeded at own discretion."

---

## Step 4.6: Finalization & Signing

### Sequence

1. **Report Locked for Editing**
   - OnlyOffice session closes (cannot edit further without re-opening for revision)
   - All draft versions preserved in `report/drafts/`

2. **Digital Signature Dialog**
   - Clinician clicks "Finalize and Sign"
   - Dialog appears requesting:
     - Full name: (auto-populated from setup)
     - Credentials: Psy.D., Ph.D., M.D., etc. (auto-populated from setup)
     - License number: (auto-populated from setup)
     - License state(s): (auto-populated from setup)
     - Signature date: (auto-populated as today's date; can be changed)
     - Attestation statement (can be edited):
       > "I certify that I am licensed to practice as a clinical/forensic psychologist in [State(s)] and that this evaluation was conducted in accordance with professional standards. This report represents my professional opinion based on the evaluation procedures described herein."

3. **Signature Applied**
   - Signature metadata written to `report/report_metadata.json`
   - Signature appears in the final report document as:
     ```
     Respectfully submitted,


     ___________________________
     [Full Name]
     [Credentials]
     License #[Number], State of [State]
     [Date]

     ATTESTATION:
     [Attestation statement]
     ```

4. **Final Report Created**
   - Last draft version (e.g., `draft_v3.docx`) is finalized as `report/final/evaluation_report.docx`
   - **This report contains FULL PHI** — real names, dates, addresses, etc. (NEVER redacted)
   - This is the clinical/legal document that will be filed with the court or sent to the attorney

5. **PDF Export**
   - Application automatically generates PDF from the .docx
   - Saved as `report/final/evaluation_report.pdf`
   - PDF is a digital copy suitable for court filing, email transmission, or printing

6. **Audit Trail**
   - Entry logged: `"report_signed by Dr. Truck Irwin on 2026-03-22. Version: draft_v3. Pages: 22. Signature: [credentials]."`

### Report Storage

**Final report contains FULL PHI.** This is intentional — it is a clinical and legal document that identifies the patient and is intended to be filed with the court or placed in a medical record. It is never redacted.

```
report/
├── drafts/
│   ├── draft_v1.docx        (AI-generated initial draft, full PHI)
│   ├── draft_v2.docx        (Clinician-edited, full PHI)
│   └── draft_v3.docx        (Final version before signing, full PHI)
└── final/
    ├── evaluation_report.docx   (SIGNED FINAL REPORT, FULL PHI)
    └── evaluation_report.pdf    (PDF export, FULL PHI)
```

### Modifications After Signing

If clinician realizes an error after signing:
- Cannot edit the signed final report
- Must create an addendum (see Stage 5)
- Original report remains unchanged (immutable after signing)
- Both report and addendum are filed together

---

## Step 4.7: Automatic Advancement to Complete

Immediately after finalization and signing:

1. **exports/ Directory Created**
   - Application creates `report/exports/` directory for case delivery materials
   - Optional exports created on demand (not automatically)

2. **Case Status Changed**
   - `case.json` status field updated to `Complete`
   - Pipeline indicator in UI shows green "Complete"

3. **Audit Trail**
   - Entry logged: `"case_advanced_to_complete on 2026-03-22 by Dr. Truck Irwin. Report signed and filed."`

4. **Case Remains Active**
   - Case stays in active case list until clinician explicitly archives it
   - Clinician can still edit notes, add addenda, generate delivery documents
   - Case transitions to Complete stage only, not removed

---

## Step 4.8: Error Handling & Edge Cases

### **Scenario 1: Writer Agent Produces Poor Quality Draft**

**Problem:** Initial draft has significant issues — missing sections, poor organization, misrepresented test results.

**Solution:**
1. Clinician rejects draft without substantial editing
2. Clicks "Discard Draft and Regenerate"
3. Application discards `draft_v1.docx`
4. New UNID map generated (fresh redaction)
5. Writer Agent invoked again with same case record
6. New draft generated as `draft_v1.docx` (version resets because prior draft was discarded)
7. Audit trail logs: "draft_v1 discarded. New draft generated."

**Prevention:** Writer Agent prompt should include quality thresholds. If first draft fails quality checks, regeneration is faster than manual editing.

---

### **Scenario 2: Editor/Legal Agent Flags Critical Issues, Clinician Disagrees**

**Problem:** Editor flags vulnerability: "Opinion uses vague language 'clearly unable to assist counsel' without specific examples." Clinician wants to keep the language as-is, arguing "The behavioral examples are in the previous section; repeating them here is redundant."

**Solution:**
1. Clinician clicks "Dismiss" for the issue
2. Dialog appears: "Reason for dismissal?" (optional text field)
3. Clinician types: "Behavioral examples provided in previous paragraph. Repeating here is unnecessary repetition and weakens narrative flow."
4. Audit trail logs the dismissal with reasoning
5. Issue removed from review panel
6. Clinician can proceed to finalization

**Later (in litigation):** If opposing counsel attacks the vague language, the clinician's signed report and the audit trail demonstrate that they reviewed the vulnerability and made a deliberate choice. This strengthens the defense of the opinion.

---

### **Scenario 3: Clinician Wants to Revise Diagnosis During Review Stage**

**Problem:** After reviewing the report draft, clinician realizes the diagnosis should be F32.1 (Major Depressive Disorder) instead of F20.0 (Schizophrenia) because certain interview findings were misinterpreted.

**Solution:**

This requires reverting to Diagnostics stage (case does NOT automatically regress, but clinician can choose to go back):

1. Clinician clicks "Go Back to Diagnostics"
2. Warning dialog: "This will discard all report drafts (v1, v2, v3). You will need to confirm the diagnosis change and re-generate the report. Continue?"
3. If confirmed:
   - All drafts in `report/drafts/` moved to archive (not deleted)
   - Case status reverted to `Diagnostics`
   - Clinician returns to diagnostics interface
   - Updates diagnosis from F20.0 to F32.1 in `diagnostics/diagnostic_formulation.json`
   - Audit trail logs: "case_reverted_to_diagnostics on 2026-03-22. Diagnosis changed from F20.0 to F32.1."
   - Clinician re-advances to Review
   - New case record assembled with updated diagnosis
   - New UNID map generated
   - Writer Agent invoked again
   - New draft generated as `draft_v1.docx`

**Note:** The old drafts are not deleted; they're archived in `report/drafts/` with a timestamp marker. Audit trail shows the full history.

---

### **Scenario 4: Multiple Clinicians / Supervisory Review**

**Problem:** Practice has multiple providers. Senior clinician (Dr. Main) wants to review the report drafted by junior clinician (Dr. Assistant) before it's finalized.

**Solution (Post-MVP):**

In a multi-provider setup:
1. Dr. Assistant completes the report and saves draft_v2
2. Dr. Assistant assigns the case to Dr. Main for "supervisory review"
3. Dr. Main opens the case in Review mode
4. Dr. Main can edit drafts just as Dr. Assistant did
5. Dr. Main can request additional legal review
6. Dr. Main finalizes and signs the report
7. Audit trail shows: "draft_v2 created by Dr. Assistant. draft_v3 modified by Dr. Main. Report signed by Dr. Main."

For countersigning workflows (both providers' signatures on the final report):
- After Dr. Main signs, the signature block shows both names
- Both credentials and license numbers included
- Both UIC buttons required to finalize

**Note:** This requires access control setup in the application (which clinicians can view/edit which cases). Handled in Setup workflow.

---

### **Scenario 5: Report Needed Before Clinical Interviews Complete**

**Problem:** Court deadline is pressing. Clinician has completed intake, biopsychosocial, testing, but only 1 of 3 planned interviews. Court wants preliminary report.

**Solution:**
- Application allows advancement to Review even if interview count is low (validation warning only, not a block)
- Report clearly states: "This evaluation is preliminary, based on [X hours] of interview time. Additional clinical interview(s) scheduled for [date]. This opinion may be subject to revision after completion of evaluation."
- Recommendation: Schedule follow-up evaluation with addendum
- Audit trail logs: "case_advanced_to_review with incomplete interviews. Clinician confirmed preliminary report."

---

### **Scenario 6: Clinician Loses Power Mid-Report Editing**

**Problem:** Clinician is editing draft_v2.docx when power loss occurs. Changes not saved.

**Solution:**
- OnlyOffice has local autosave (should be configured in setup)
- On restart, application attempts to recover unsaved work
- If recovery fails: previous version (draft_v2.docx on disk) is intact
- Clinician resumes from last saved point
- Any lost edits must be re-done
- No audit trail gap (last successful save was logged at that time)

**Note:** This is a UX/reliability issue, not a workflow issue. Proper backup and autosave configuration mitigates.

---

## Step 4.9: IPC Contracts

New IPC channels for Stage 4 (extends doc 02):

```typescript
// Generate Writer Agent draft
ipcMain.handle('report:generateDraft', async (event, {
  caseNumber: string,
  reportTemplate: 'forensic_competency' | 'forensic_insanity' | 'forensic_custody' | 'clinical' | 'disability',
  clinicianVoice?: {
    tone?: string,
    preferences?: string
  }
}) => Promise<{
  draftPath: string,      // e.g., "report/drafts/draft_v1.docx"
  version: string,        // "v1"
  generatedAt: string,    // ISO timestamp
  sections: string[]      // List of sections generated
}>);

// Request legal/Daubert review of current draft
ipcMain.handle('report:requestLegalReview', async (event, {
  caseNumber: string,
  draftVersion: string    // e.g., "v2"
}) => Promise<{
  reviewId: string,
  issueCount: number,
  criticalCount: number,
  warningCount: number,
  suggestionsCount: number,
  issues: Array<{
    issueId: number,
    severity: string,
    location: string,
    finding: string,
    recommendation: string,
    vulnerabilityScore: number
  }>
}>);

// Clinician disposition for legal review issue
ipcMain.handle('report:disposeLegalIssue', async (event, {
  caseNumber: string,
  reviewId: string,
  issueId: number,
  disposition: 'accept' | 'modify' | 'dismiss',
  modifiedText?: string,        // If disposition='modify'
  dismissalReasoning?: string   // If disposition='dismiss'
}) => Promise<{
  applied: boolean,
  newVersion: string,           // Version incremented
  auditEntry: object
}>);

// Run pre-finalization checklist
ipcMain.handle('report:preFinalizationChecklist', async (event, {
  caseNumber: string,
  draftVersion: string
}) => Promise<{
  passed: boolean,
  checks: Array<{
    name: string,
    status: 'pass' | 'fail' | 'warning',
    details: string
  }>,
  readyToFinalize: boolean
}>);

// Finalize and sign report
ipcMain.handle('report:finalizeAndSign', async (event, {
  caseNumber: string,
  draftVersion: string,
  clinicianName: string,
  credentials: string,
  licenseNumber: string,
  licenseState: string,
  signatureDate?: string,         // Defaults to today
  attestationStatement?: string   // Custom or default
}) => Promise<{
  finalReportPath: string,        // "report/final/evaluation_report.docx"
  pdfReportPath: string,          // "report/final/evaluation_report.pdf"
  signatureMetadata: {
    signedBy: string,
    signedAt: string,
    credentials: string,
    licenseNumber: string
  },
  auditEntry: object
}>);

// Discard draft and regenerate
ipcMain.handle('report:discardAndRegenerate', async (event, {
  caseNumber: string,
  draftVersion: string
}) => Promise<{
  discarded: string,              // Version discarded
  archived: boolean,
  newDraftPath: string,           // New v1
  auditEntry: object
}>);

// Revert case from Review back to Diagnostics (for diagnosis change)
ipcMain.handle('case:revertToDiagnostics', async (event, {
  caseNumber: string,
  reason?: string
}) => Promise<{
  reverted: boolean,
  draftArchived: string[],        // Archived draft versions
  currentStage: string,
  auditEntry: object
}>);

// Export case for delivery (delivery report, testimony prep materials, etc.)
ipcMain.handle('case:exportForDelivery', async (event, {
  caseNumber: string,
  exportType: 'court' | 'attorney' | 'insurance' | 'records_package' | 'testimony_prep',
  format?: 'pdf' | 'docx' | 'zip'
}) => Promise<{
  exportPath: string,
  format: string,
  size: number,
  contents: string[]
}>);
```

---

## Step 4.10: Data Model

### report_metadata.json

Stored in `report/report_metadata.json`, tracks report versioning and signature:

```json
{
  "caseNumber": "2026-0147",
  "reportType": "forensic_competency",
  "status": "draft",
  "versions": [
    {
      "version": "v1",
      "createdAt": "2026-03-22T14:30:00Z",
      "createdBy": "writer_agent",
      "source": "initial_draft_generation",
      "wordCount": 4200,
      "pages": 18,
      "filePath": "draft_v1.docx"
    },
    {
      "version": "v2",
      "createdAt": "2026-03-22T15:45:00Z",
      "createdBy": "Dr. Truck Irwin",
      "source": "clinician_edit",
      "wordCount": 4350,
      "pages": 18,
      "editsFromPrior": "+150 words, -0 words",
      "filePath": "draft_v2.docx"
    },
    {
      "version": "v3",
      "createdAt": "2026-03-22T16:30:00Z",
      "createdBy": "Dr. Truck Irwin",
      "source": "legal_review_accepted",
      "wordCount": 4520,
      "pages": 19,
      "legalReviewIssuesResolved": 5,
      "filePath": "draft_v3.docx"
    }
  ],
  "legalReviews": [
    {
      "reviewId": "review_001",
      "reviewedAt": "2026-03-22T16:00:00Z",
      "draftVersion": "v2",
      "criticalIssues": 2,
      "warningIssues": 3,
      "suggestionIssues": 2,
      "dispositions": {
        "accepted": 5,
        "modified": 1,
        "dismissed": 1
      }
    }
  ],
  "finalReport": {
    "status": "signed",
    "finalVersion": "v3",
    "finalizedAt": "2026-03-22T17:00:00Z",
    "finalDocPath": "report/final/evaluation_report.docx",
    "finalPdfPath": "report/final/evaluation_report.pdf",
    "signature": {
      "signedBy": "Dr. Truck Irwin",
      "credentials": "Psy.D., ABPP",
      "licenseNumber": "PSY12345",
      "licenseState": "Colorado",
      "signedAt": "2026-03-22T17:00:00Z",
      "attestationStatement": "I certify that I am licensed to practice as a clinical/forensic psychologist in Colorado..."
    },
    "pageCount": 19,
    "wordCount": 4520
  },
  "preFinalizationChecklist": {
    "completedAt": "2026-03-22T16:55:00Z",
    "passed": true,
    "checks": {
      "referralQuestionsAddressed": true,
      "allInstrumentsReported": true,
      "diagnosisSectionComplete": true,
      "opinionSectionComplete": true,
      "criticalEditorIssuesResolved": true,
      "consentOnFile": true
    }
  }
}
```

### Legal Review Issue Record

Stored in SQLCipher `legal_review_issues` table or as `report/reviews/review_[reviewId].json`:

```json
{
  "reviewId": "review_001",
  "caseNumber": "2026-0147",
  "draftVersion": "v2",
  "reviewedAt": "2026-03-22T16:00:00Z",
  "reviewedBy": "editor_legal_agent",
  "issues": [
    {
      "issueId": 1,
      "severity": "Critical",
      "category": "Completeness",
      "location": "Test Results Section",
      "excerpt": "...",
      "finding": "SIRS-2 administered but not reported",
      "recommendation": "Add SIRS-2 results summary",
      "crossExamVulnerability": 9,
      "disposition": {
        "status": "accepted",
        "disposedAt": "2026-03-22T16:25:00Z",
        "disposedBy": "Dr. Truck Irwin",
        "action": "Recommendation inserted into draft"
      }
    }
  ]
}
```

---

## Summary Table: Stage 4 Steps and Responsibilities

| Step | Who | AI Involvement | Output | Audit Trail |
|------|-----|---|---|---|
| 4.1 | App | None | Assembled case record (validated) | "case_record_assembled" |
| 4.2 | Writer Agent | UNID Point 2, full case record transmission | draft_v1.docx (full PHI, re-hydrated) | "report_draft_generated" |
| 4.3 | Clinician | None (manual editing) | draft_v2, v3... (full PHI, iterated) | "draft_vN_saved" for each save |
| 4.4 | Editor/Legal Agent | UNID Point 3, fresh redaction | Review with issues (location, severity, vulnerability) | "legal_review_completed" |
| 4.4 | Clinician | None (issue disposition) | draft_vN updated per disposition | "legal_issue_[id]_[disposition]" |
| 4.5 | App | None | Checklist results | "pre_finalization_check_passed" or "_failed" |
| 4.6 | Clinician | None (signing) | Signed final report (evaluation_report.docx, .pdf) | "report_signed" |
| 4.7 | App | None | Case status → Complete, exports/ directory | "case_advanced_to_complete" |

---

## Key Principles and Invariants

1. **WRITER AGENT WRITES THE CLINICIAN'S OPINIONS, NOT ITS OWN.** The diagnoses, psycholegal conclusions, and recommendations are the clinician's. The Writer Agent drafts professional prose that presents them. The clinician always edits and finalizes.

2. **REPORTS CONTAIN FULL PHI — NEVER REDACTED.** The final evaluation report is a clinical/legal document that identifies the patient. It contains real names, dates of birth, addresses, case numbers. It is not redacted.

3. **UNID REDACTION POINT 2 FOR REPORT DRAFTING.** The case record sent to the Writer Agent is redacted with fresh UNIDs. The UNID map is destroyed after transmission. No PHI reaches the AI.

4. **UNID REDACTION POINT 3 FOR LEGAL REVIEW.** When the draft is sent for legal review, a new UNID map is generated (not reused). Same protocol.

5. **VERSION CONTROL — NO DRAFT IS EVER DELETED.** Every iteration is preserved in `report/drafts/`. The clinician can compare versions, revert changes, understand the evolution of the report.

6. **DAUBERT COMPLIANCE IS CRITICAL FOR FORENSIC REPORTS.** The Editor/Legal Agent specifically checks that opinions are based on sufficient facts, reliable methods, and reliable application.

7. **ALL DISPOSITIONS LOGGED.** If a clinician dismisses a legal review issue, that dismissal is logged with reasoning. This creates an audit trail that demonstrates clinician awareness and deliberate decision-making.

8. **SIGNED REPORT IS IMMUTABLE.** After signing, the final report cannot be edited. Changes require an addendum (handled in Stage 5).

---

## Relationship to Other Documents

| Document | Reference | Dependency |
|----------|-----------|-----------|
| Case Lifecycle Spec (doc 18) | Stage 4 subsection | Defines entry/exit conditions, pre/post-stage context |
| Agent Prompt Specs (doc 03) | Writer Agent (lines 1064-1180), Editor/Legal Agent spec (TBD) | Defines what agents do, input/output schemas |
| UNID Redaction Architecture (doc 15) | Redaction Points 2 & 3, map lifecycle | Technical implementation of PHI transmission |
| Case Directory Schema (doc 16) | report/ directory structure | Where all report files stored on disk |
| Pipeline Architecture (doc 14) | Stage 4 position in 6-stage pipeline | Where Review sits in the clinical workflow |
| IPC API Contracts (doc 02) | New IPC channels for report operations | How Electron ↔ Python communicate for report work |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-22 | Truck Irwin / Engineering | Initial production specification. Comprehensive coverage of report generation, editing, legal review, and finalization. |

---

**END OF DOCUMENT**

