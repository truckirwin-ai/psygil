# Stage 3: Diagnostics — Production Specification
## Psygil — The Diagnostic Gate and Clinical Decision Architecture

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Production Specification
**References:** Case Lifecycle Spec (doc 18), Agent Prompt Specs (doc 03), UNID Redaction Architecture (doc 15), Case Directory Schema (doc 16), IPC API Contracts (doc 02), Pipeline Architecture (doc 14)

---

## CRITICAL PRINCIPLE: THE DOCTOR ALWAYS DIAGNOSES

**This principle is architecturally non-negotiable and enforced at every layer of Stage 3.**

The Diagnostician Agent presents evidence. The clinician — and ONLY the clinician — makes every diagnostic decision. This is not a UI convenience feature or a workflow guideline. It is a legal, ethical, and scientific mandate that shapes the system architecture, the IPC contracts, the audit trail, and the UI interaction model.

### Why This Principle Matters

**Daubert Compliance:** In expert testimony, the clinician's opinion is defensible only if the clinician — not an algorithm — made each diagnostic decision. If opposing counsel can show "the AI recommended this diagnosis and the clinician just accepted it," the entire opinion is vulnerable to exclusion under Daubert v. Merrell Dow. The clinician's **independent judgment** on each diagnosis is what survives cross-examination.

**Ethical Obligation:** The APA Ethical Principles and Code of Conduct (Standard 2.01, Boundaries of Competence) require that psychologists maintain responsibility for conclusions drawn in evaluations. An AI recommendation that the clinician passively accepts violates this standard. The clinician must actively deliberate on each diagnostic formulation.

**Clinical Validity:** Diagnostic decisions are not technical outputs—they are clinical judgments that integrate pattern recognition, context, contraindications, and clinical intuition. No AI system can replicate the clinician's embodied understanding of a patient's presentation. The AI's job is to organize evidence; the clinician's job is to decide.

**Liability Protection:** If an AI system selects a diagnosis and the clinician fails to question it, the malpractice exposure is severe. If the clinician's audit trail shows independent deliberation on each diagnosis, malpractice defense is much stronger.

### Architectural Enforcement of THE DOCTOR ALWAYS DIAGNOSES

1. **No "Accept All" Button** — ever. The UI explicitly prohibits bulk-accepting the AI's evidence presentation.
2. **Every Diagnosis Is Individual** — each diagnosis the clinician confirms, rules out, or defers is recorded as a separate audit trail entry with the clinician's name and timestamp.
3. **AI Output Is Always `evidence_presented`** — never `confirmed`, `recommended`, or `suggested`. The status field is immutable; only the clinician can move a diagnosis to confirmed status.
4. **The Clinician Can Override the AI** — if the clinician sees a diagnosis the AI missed or disagrees with every diagnosis the AI presented, the clinician can add diagnoses and proceed without AI consensus.
5. **Diagnostic Justification Is Mandatory** — when a clinician confirms a diagnosis, they must provide clinical justification (free text). This justification, paired with the clinician's name and timestamp, establishes the clinician's deliberation.

---

## 1. Stage 3 Overview

### Clinical Context: What "Diagnostics" Means

After the clinician has completed the biopsychosocial intake, administered a test battery, conducted clinical interviews, gathered collateral information, and verified the validity of test data, the case enters Stage 3: Diagnostics. This is the stage where clinical hypothesis becomes diagnosis.

The case has been moving forward progressively—each stage has built information. By the Diagnostics stage, the clinician has hours of assessment time, multiple objective measures, clinical observations, and collateral context. Now the clinician synthesizes all of this into diagnostic formulation.

### Why This Is the Most Sensitive Stage

Diagnostics is not a routine workflow step. It is **the hinge between assessment and opinion**—the moment where:
- Clinical test data becomes diagnosis
- Diagnostic formulation becomes psycholegal opinion
- The clinician's independent judgment is on record forever

A diagnosis in a forensic evaluation is testimony. It will be challenged. It will be cross-examined. If the clinician's decision-making process cannot withstand scrutiny, the diagnosis does not survive Daubert challenge and the entire opinion is at risk.

This is why THE DOCTOR ALWAYS DIAGNOSES is not a guideline—it is an architectural constraint.

### Entry Conditions for Stage 3

A case advances to Diagnostics when all of the following are true:

1. **Case is in Interview stage** — all prior stages (Onboarding, Testing) are complete
2. **At least one clinical interview session is documented** — the clinician has conducted at least one face-to-face interview with the patient
3. **Test battery is complete and reviewed** — all selected instruments are scored, reviewed, and marked as "Reviewed"
4. **Validity assessment exists** — the testing validity summary shows whether the test battery is interpretable
5. **Clinician explicitly advances the stage** — "Advance to Diagnostics" is a deliberate action, not automatic

**Application behavior:**
- App validates the five conditions above
- If any condition is unmet, the advance button is disabled and displays the missing requirement
- Upon valid advance: app creates `diagnostics/` directory, sets case status to **Diagnostics**, logs audit trail entry

### Exit Conditions for Stage 3

A case advances from Diagnostics to Review only when:

1. **All presented diagnoses are addressed** — every diagnosis from the evidence map has been explicitly addressed (Confirmed, Ruled Out, or Deferred)
2. **Clinical opinion is written** — the clinician has provided a written clinical/psycholegal opinion
3. **If deferred diagnoses exist** — the clinician has documented what additional data is needed to make a decision
4. **At least one diagnosis is confirmed OR "No diagnosis" is explicitly documented** — the case cannot have an empty diagnosis section

**Application behavior:**
- Pre-advancement checklist validates all four conditions
- If unmet, the advance button is disabled with clear messaging about what's missing
- Upon valid advance: app creates `report/`, `report/drafts/` directories, sets case status to **Review**, logs audit trail entry

---

## 2. THE DOCTOR ALWAYS DIAGNOSES — Full Specification

### 2.1 What THE DOCTOR ALWAYS DIAGNOSES Means

**The Diagnostician Agent Does NOT:**
- Select a "best-fit" diagnosis
- Recommend a diagnosis to the clinician
- Suggest a probability that a diagnosis is "correct"
- Present a diagnosis with language implying certainty (e.g., "the patient has MDD")
- Produce output with fields like `selected_diagnosis`, `recommended_diagnosis`, or `suggested_diagnosis`
- Use language like "we recommend," "the diagnosis is," or "the clinician should consider"

**The Diagnostician Agent DOES:**
- Organize evidence systematically against each DSM-5-TR diagnosis relevant to the referral
- Present criterion-by-criterion analysis: which criteria are met, which are not, which lack sufficient data
- Flag contradicting evidence for each diagnosis
- Present differential comparisons showing how overlapping diagnoses differ
- Identify gaps in the evidence record (what additional information would help)
- Map evidence to legal standards (for forensic evaluations)
- Frame all output in the language of evidence: "Evidence supporting MDD includes... Evidence contradicting MDD includes..."
- Every diagnosis in the output has status: `"evidence_presented"` — never `"confirmed"` or `"recommended"`

**The Clinician DOES:**
- Read the evidence map
- Deliberate on each diagnosis individually
- For each diagnosis: decide Confirm, Rule Out, or Defer (with documented reasoning)
- Write clinical justification for each confirmed diagnosis (explaining why the clinician believes the diagnosis is supported)
- Document reasoning for ruled-out diagnoses
- Identify gaps (if the evidence map is missing critical information)
- Add diagnoses the AI did not present (if the clinician's clinical judgment identifies a diagnosis the AI missed)
- Write the clinical/psycholegal opinion (the clinician's clinical voice, not the AI's)

### 2.2 Daubert and Cross-Examination Defense

In forensic contexts, the clinician's diagnostic formulation must survive Daubert scrutiny. Daubert requires:

1. **Sufficient facts or data** — The clinician has gathered comprehensive assessment data (test battery, interviews, collateral)
2. **Reliable principles and methods** — DSM-5-TR diagnostic criteria are the accepted standard in psychology
3. **Reliable application to the case** — The clinician has applied those criteria carefully and documented their reasoning
4. **Testimony is relevant** — The diagnostic formulation is responsive to the referral questions and legal standard

THE DOCTOR ALWAYS DIAGNOSES supports Daubert defensibility by:

- **Creating an audit trail of deliberation** — For each diagnosis, the clinician's name, timestamp, and explicit decision (Confirm/Rule Out/Defer) are recorded. This demonstrates the clinician, not an algorithm, made the decision.
- **Requiring clinical justification** — When the clinician confirms a diagnosis, they write their reasoning. This reasoning becomes the basis for Daubert testimony: "Here's why I believe this diagnosis is supported."
- **Preventing passive acceptance** — The UI prohibits "Accept All," forcing the clinician to actively engage with each diagnosis.
- **Documenting disagreement** — If the clinician rules out a diagnosis the AI presented evidence for, they explain why. This shows the clinician reviewed the evidence, weighed it, and made an independent judgment.

Under cross-examination:

> Q: "Dr. Irwin, did the AI system recommend this diagnosis for your patient?"
> A: "The system presented evidence that could support that diagnosis. I reviewed that evidence systematically. I considered whether my patient met each criterion. I concluded he did not meet criterion B, and therefore I ruled out the diagnosis. My reasoning is documented here [points to clinical notes]."

This testimony is defensible. This testimony shows the clinician's independent judgment.

Compare to:

> Q: "Did the AI system recommend this diagnosis?"
> A: "Yes, and I accepted the recommendation."
> Q: "Did you evaluate whether the recommendation was correct?"
> A: "Not really—I trusted the system."

This testimony is indefensible and opens the opinion to Daubert challenge.

### 2.3 NO "Accept All" Button — Architectural Non-Negotiable

**This is absolute. The UI must never, under any circumstance, provide a mechanism to bulk-accept the AI's evidence presentation.**

Why:
- Bulk acceptance collapses clinical deliberation into a single click
- The audit trail cannot distinguish between the clinician who carefully reviewed each diagnosis and the clinician who clicked "Accept All"
- Opposing counsel can challenge: "You didn't actually evaluate each diagnosis—you just accepted the system's recommendation"
- Malpractice exposure becomes severe if the clinician bulk-accepted a diagnosis and failed to notice critical contradicting evidence

The UI for diagnostic decisions must require:
- **Individual decisions** — For each diagnosis in the evidence map, the clinician must explicitly decide Confirm, Rule Out, or Defer
- **Documented reasoning** — If Confirming, the clinician writes justification. If Ruling Out, the clinician explains why. If Deferring, the clinician specifies what's needed.
- **Sequential review** — The UI should not allow the clinician to skip diagnoses. Every diagnosis must be addressed before the case can advance to Review.

---

## 3. Step 3.1: Case Record Assembly and Data Completeness Check

### 3.1.1 What Gets Assembled

When the case enters Diagnostics, the application assembles the full case record from all prior stages:

**From Onboarding:**
- Intake form (demographics, referral questions, referral source, deadline)
- Biopsychosocial history (structured narrative)
- Informed consent status (signed/unsigned)
- Age, gender, education, employment, family history, psychiatric history, substance use history

**From Testing:**
- Test battery configuration (instruments selected)
- Raw scores for each instrument (raw scores, scaled scores, T-scores, percentiles, where applicable)
- Validity indicators:
  - Standalone validity tests (TOMM pass/fail, SIRS-2 total score, M-FAST score)
  - Embedded validity scales (MMPI-3 validity profile, PAI validity scales)
  - Publisher cutoff determinations (valid/questionable/invalid)
- Clinician review notes on each instrument
- Validity summary assessment (overall interpretability: Full / Caution / Invalid)

**From Interviews:**
- Mental Status Examination (MSE) data for each session: appearance, behavior, speech, mood, affect, thought process, thought content, perception, cognition, insight, judgment
- Narrative session notes (full text)
- Interview dates and duration
- Total hours of clinical contact
- Behavioral observations during testing
- Clinician's verification notes on biopsychosocial claims (discrepancies noted)

**From Collateral:**
- Collateral interview summaries (who was contacted, what they reported, discrepancies with patient self-report)
- Collateral document summaries (what was in medical records, prior evaluations, court documents)
- Timeline corroboration (events reported by patient vs. records)

**From Referral:**
- Referral questions (exact language from court order or attorney)
- Legal standard applicable (Dusky, M'Naghten, best interests, etc.)
- Jurisdiction
- Charges (if applicable)
- Deadline

### 3.1.2 Data Completeness Check

Before the case record is sent to the Diagnostician Agent, the application performs a completeness validation:

```
COMPLETENESS VALIDATION:
✓ Intake form: all required fields present
✓ Biopsychosocial history: at least 500 words of narrative content
✓ At least one clinical interview session with MSE data
✓ Test battery: at least 2 instruments administered and scored
✓ Validity assessment: validity indicators present for all administered instruments
✓ Referral questions: at least one documented
✓ Age, gender, education documented
```

If all checks pass: proceed to UNID redaction and Diagnostician Agent submission.

If any check fails: **Missing Data Handling (see 3.1.3)**

### 3.1.3 Missing Data Handling

If the completeness validation fails, the application presents a dialog to the clinician:

```
⚠️ INCOMPLETE DATA FOR DIAGNOSTICS

The following required information is missing:
- Test battery: Only 1 instrument scored (recommend ≥2 for diagnostic clarity)
- Validity assessment: No validity scales administered

You can:
1. Go back and complete missing data (returns to Testing/Interview stage to add data)
2. Proceed with diagnostic formulation despite missing data (clinician accepts responsibility)

If you proceed, you will document what information is missing and how it affects your diagnostic confidence.
```

**Clinician options:**
- **Go Back** — Case status stays Diagnostics, clinician can add more data, then return to this screen
- **Proceed Despite Missing Data** — Clinician confirms they understand the limitation, case proceeds to Diagnostician Agent submission, and a note is attached to the evidence map: "This diagnostic formulation is based on limited data: [specific gaps]. Additional [testing/interviews] recommended before finalization."

**Audit trail entry:**
```json
{
  "timestamp": "2026-03-22T14:45:00Z",
  "action": "incomplete_data_acknowledged",
  "details": {
    "missing": ["validity_assessment_for_PAI"],
    "clinician_statement": "Proceeding with diagnostic assessment despite missing PAI validity indicators. Will recommend retesting if diagnostic clarity requires."
  }
}
```

---

## 4. Step 3.2: Diagnostician Agent Invocation via UNID Pipeline

### 4.2.1 UNID Redaction of Assembled Case Record

The full case record is assembled in-memory with all real PHI (names, dates of birth, addresses, phone numbers, SSNs, case numbers, medical record numbers, etc.). This in-memory record is **never sent to the AI**.

Instead, the application invokes the UNID redaction pipeline:

1. **Generate UNID Map** — The Python sidecar creates a fresh UNID map for this operation:
   - Every PHI entity (name, DOB, address, etc.) is assigned a cryptographically random UNID
   - Example: `"Marcus Johnson" → PERSON_a7f3c2`, `"03/15/1988" → DOB_d29c71`
   - Map stored in-memory only (never written to disk or database)

2. **Redact Full Case Record** — Using Presidio + spaCy pipeline:
   - All names replaced with `PERSON_[unid]`
   - All dates of birth replaced with `DOB_[unid]`
   - All addresses replaced with `ADDRESS_[unid]`
   - (All other Safe Harbor identifiers similarly replaced)
   - Result: redacted case record with only UNIDs and clinical content

3. **Validate No PHI Escapes** — The application asserts:
   ```
   assert no known_phi_values in redacted_text
   ```
   If any real PHI is detected in the redacted text, the operation fails and the clinician is notified.

4. **Submit to Diagnostician Agent** — The redacted case record (with UNIDs, clinical content, test scores, interview notes, etc.) is sent to the Claude API.

### 4.2.2 What Gets Sent to the Diagnostician Agent

The Diagnostician Agent receives:

```json
{
  "case_record": {
    "patient": {
      "name": "PERSON_a7f3c2",
      "age": 34,
      "gender": "M",
      "education": "High school diploma",
      "employment": "Unemployed for 2 months"
    },
    "evaluation": {
      "type": "CST",
      "referral_questions": ["Is patient competent to stand trial?"],
      "charges": "Assault 2, Menacing",
      "legal_standard": "Dusky"
    },
    "test_battery": {
      "instruments": [
        {
          "name": "MMPI-3",
          "validity": "valid",
          "clinical_scales": {
            "scale_4_pd": {"t_score": 78, "percentile": 98},
            "scale_6_pa": {"t_score": 85, "percentile": 99},
            ...
          }
        },
        {
          "name": "PAI",
          "validity": "valid",
          ...
        }
      ]
    },
    "interview_data": {
      "sessions": 2,
      "total_hours": 3.5,
      "mse": {
        "appearance": "Disheveled, poor hygiene, wore same shirt both sessions",
        "behavior": "Restless, paranoid, avoided eye contact, suspicious of evaluator",
        ...
      },
      "narrative_notes": "Patient reports hearing voices commanding him to harm others. Reports beliefs that neighbors are conspiring against him. States he acted in self-defense when he assaulted the victim..."
    },
    "collateral": {
      "interviews": [
        "Mother reports patient has been increasingly paranoid over past 6 months. Stopped taking psychiatric medications 3 months ago."
      ],
      "documents": [
        "Prior psychiatric hospitalization 2022 for psychosis. Discharged on antipsychotic medication."
      ]
    },
    "validity_summary": "Test battery is interpretable. MMPI-3 and PAI validity profiles are acceptable. No effort validity concerns."
  }
}
```

**The Diagnostician Agent sees:**
- Demographic and evaluation information (with UNIDs replacing names, addresses, SSNs, case/med record numbers)
- Clinical content (test scores, MSE observations, interview notes, collateral summaries)
- Legal context (charges, referral questions, legal standard)
- Validity assessment

**The Diagnostician Agent DOES NOT see:**
- Patient's real name (replaced with UNID)
- Patient's DOB (replaced with UNID)
- Any other Safe Harbor identifier

### 4.2.3 Diagnostician Agent Processing Steps

The Diagnostician Agent receives the redacted case record and processes it in the exact sequence defined in the Agent Prompt Spec (doc 03, lines 508-707):

**STEP 1: VALIDITY ASSESSMENT (ALWAYS FIRST)**
- Extracts validity test results (TOMM, SIRS-2, CVLT-II forced choice)
- Evaluates MMPI-3 validity scales (VRIN-T, TRIN-T, F, Fp, Fs) against publisher standards
- Evaluates PAI validity scales (NIM, PIM, ICN)
- Determines overall interpretability: Full / Caution / Invalid
- Documents impact on reliability of clinical scales

Output schema:
```json
{
  "validity_assessment": {
    "effort_tests": [
      {"test_name": "TOMM", "status": "pass", "impact": "Full"},
      {"test_name": "SIRS-2", "status": "pass", "impact": "Full"}
    ],
    "mmpi3_validity": {
      "overall_validity": "Valid",
      "summary": "All MMPI-3 validity scales are within acceptable ranges. Test is fully interpretable."
    },
    "summary": "Test battery is fully interpretable. No validity concerns."
  }
}
```

**STEP 2: DIAGNOSTIC EVIDENCE MAP**
For each DSM-5-TR diagnosis relevant to the referral questions and presenting symptoms:

- Criterion-by-criterion analysis
  - For each criterion (A, B, C, etc.): supporting evidence, contradicting evidence, insufficient data
  - Source citations back to case record (e.g., "test_administrations[0].mmpi3_scales[4].t_score")
- Onset and course (when did symptoms appear? are they consistent with this diagnosis?)
- Functional impact (how does this diagnosis account for the referral questions?)

Example: Major Depressive Disorder

```json
{
  "major_depressive_disorder": {
    "icd_code": "F32.1",
    "status": "evidence_presented",
    "criteria_analysis": {
      "criterion_a_five_or_more_symptoms": {
        "description": "Five or more symptoms present during same 2-week period, representing change from baseline",
        "met_status": "insufficient_data",
        "supporting_evidence": [
          {
            "source": "interview_narrative",
            "evidence": "Patient reported feeling 'empty' and unable to enjoy things he used to",
            "strength": "moderate"
          },
          {
            "source": "mse.sleep",
            "evidence": "Clinician observed patient reports sleeping 12+ hours daily for past month",
            "strength": "strong"
          }
        ],
        "contradicting_evidence": [
          {
            "source": "interview_narrative",
            "evidence": "Patient denies suicidal ideation, denies hopelessness, reports engagement in work tasks",
            "strength": "moderate"
          }
        ],
        "source_citations": ["interview_data.narrative_notes[125-150]", "interview_data.mse.sleep"]
      },
      "criterion_b_clinically_significant_distress": {
        ...
      }
      ... (all DSM-5-TR criteria for this diagnosis)
    },
    "onset_and_course": "Symptoms began approximately 6 months ago...",
    "functional_impact": "If MDD is present, it does not directly account for the acute psychotic symptoms reported during incident.",
    "probability_estimate": "Informational only — not used for diagnosis selection"
  }
}
```

The Diagnostician Agent produces an evidence map for each diagnosis that is clinically relevant to this case. The number of diagnoses varies: a CST evaluation might have 20-30 diagnoses in the DSM-5-TR that are relevant enough to warrant an evidence map.

**STEP 3: DIFFERENTIAL COMPARISONS**
For overlapping or confusing diagnoses, the Agent produces side-by-side comparisons:

```json
{
  "differential_comparisons": [
    {
      "diagnosis_pair": "Schizophrenia, Paranoid Type vs. Delusional Disorder, Persecutory Type",
      "key_distinguishing_features": [
        {
          "feature": "Presence of hallucinations",
          "evidence_for_diagnosis_1": "Patient reports hearing voices commanding harm. Clinician observed behavioral response consistent with hallucinatory experience during interview.",
          "evidence_for_diagnosis_2": "Patient denies hallucinations. Collateral reports no prior hallucinatory behavior."
        },
        {
          "feature": "Duration and onset",
          "evidence_for_diagnosis_1": "Acute onset approximately 2 weeks ago, coinciding with medication cessation",
          "evidence_for_diagnosis_2": "Delusional systems more stable over months/years, less responsive to medication changes"
        }
      ],
      "clinical_clarification": "Patient's acute presentation with prominent auditory hallucinations and behavioral disorganization aligns more closely with Schizophrenia. Delusional Disorder would be more consistent with longer history of stable paranoia without hallucinations."
    }
  ]
}
```

**STEP 4: PSYCHOLEGAL ANALYSIS (FORENSIC ONLY)**
For forensic evaluations, the Agent maps evidence to the relevant legal standard:

For CST (Dusky standard):

```json
{
  "psycholegal_analysis": {
    "legal_standard": "Dusky v. United States (1960)",
    "jurisdiction": "Federal / State",
    "standard_elements": [
      {
        "element": "Factual understanding of charges, court process, consequences",
        "evidence_map": [
          {
            "support": "Patient can articulate charges (Assault 2, Menacing), court role, expected trial process",
            "source": "interview_data.competency_assessment_notes"
          },
          {
            "contradiction": "Patient's paranoid beliefs about judge and prosecutor may undermine rational understanding of their roles",
            "source": "interview_narrative"
          }
        ]
      },
      {
        "element": "Rational understanding (not just factual)",
        "evidence_map": [...]
      },
      {
        "element": "Ability to assist counsel",
        "evidence_map": [...]
      }
    ],
    "critical_gaps": "No formal competency assessment instrument administered (e.g., MacArthur Competency Assessment Tool). Recommend MCAT administration for comprehensive competency evaluation.",
    "clinical_findings_applicable_to_legal_standard": "Patient's acute psychotic symptoms (paranoia, command hallucinations) and medication non-compliance significantly impair his ability to rationally understand the proceedings and assist counsel..."
  }
}
```

**STEP 5: FUNCTIONAL IMPAIRMENT SUMMARY (CLINICAL ONLY)**
For clinical (non-forensic) evaluations, the Agent synthesizes functional impact:

```json
{
  "functional_impairment_summary": {
    "work_academic": "Patient unable to work due to psychotic symptoms and paranoia. Previously employed, now unemployed × 2 months.",
    "social_relationships": "Patient reports withdrawal from friends and family. Reports conflict with mother regarding medication compliance.",
    "self_care": "Poor hygiene evident. Reports inconsistent eating. Sleep severely disrupted.",
    "safety_risk": "Command hallucinations directing patient to harm others. History of acting on command hallucinations (current charges).",
    "overall_impairment_level": "Severe"
  }
}
```

### 4.2.4 Agent Response Re-hydration and UNID Map Destruction

The Diagnostician Agent returns the complete evidence map structure with all UNIDs intact:

```json
{
  "validity_assessment": { ... },
  "diagnostic_evidence_map": {
    "schizophrenia_paranoid_type": { ... contains PERSON_a7f3c2, DOB_d29c71, etc. ... },
    ...
  },
  "differential_comparisons": [ ... ],
  "psycholegal_analysis": { ... }
}
```

The application now:

1. **Re-hydrate UNIDs** — The Python sidecar walks the entire response and replaces each UNID with the original PHI:
   - `PERSON_a7f3c2` → `Marcus Johnson`
   - `DOB_d29c71` → `03/15/1988`
   - All UNIDs reversed to real values

2. **Destroy UNID Map** — After re-hydration is complete, the UNID map is overwritten in memory and cannot be recovered. Future operations will generate completely new UNIDs.

3. **Store Re-hydrated Evidence Map** — The full-PHI evidence map is stored in `diagnostics/evidence_matrix.json`

### 4.2.5 Storage: evidence_matrix.json and criteria_mapping.json

Two files are created in the `diagnostics/` directory:

**`evidence_matrix.json`** — The complete Diagnostician Agent response (re-hydrated, full PHI):

```json
{
  "generated_timestamp": "2026-03-22T14:50:00Z",
  "case_number": "2026-0147",
  "valid": "Valid",
  "validity_assessment": { ... },
  "diagnostic_evidence_map": {
    "schizophrenia_paranoid_type_f20_0": {
      "icd_code": "F20.0",
      "status": "evidence_presented",
      "criteria_analysis": { ... },
      "onset_and_course": { ... },
      "functional_impact": "..."
    },
    ... (every diagnosis presented)
  },
  "differential_comparisons": [ ... ],
  "psycholegal_analysis": { ... },
  "audit_trail_reference": "This evidence map was generated at [timestamp] and re-hydrated from UNID-redacted version. UNID map destroyed per protocol."
}
```

**`criteria_mapping.json`** — Clinician's confirmed criteria (created later, in Step 3.7):

```json
{
  "confirmed_diagnoses": [
    {
      "icd_code": "F20.0",
      "name": "Schizophrenia, Paranoid Type",
      "confirmed_by": "Dr. Truck Irwin",
      "confirmed_timestamp": "2026-03-22T15:30:00Z",
      "clinical_justification": "Patient meets Criterion A (two+ psychotic symptoms including prominent command hallucinations and paranoid delusions). Criterion B met: symptoms present for 2 weeks, with functional decline evident. Criterion C: no medical condition or substance use explains symptoms. Supports both psychiatric and psycholegal formulation.",
      "criteria_met": [
        {"criterion": "A_characteristic_symptoms", "met": true, "evidence": "Auditory hallucinations and persecutory delusions confirmed during two interviews"},
        {"criterion": "B_duration", "met": true, "evidence": "Symptoms present for approximately 2 weeks"},
        {"criterion": "C_exclusions", "met": true, "evidence": "No medical condition or active substance use identified"}
      ]
    }
  ],
  "ruled_out_diagnoses": [
    {
      "icd_code": "F32.1",
      "name": "Major Depressive Disorder",
      "ruled_out_by": "Dr. Truck Irwin",
      "ruled_out_timestamp": "2026-03-22T15:35:00Z",
      "reasoning": "While patient reports anhedonia and sleep disturbance, these are secondary to acute psychotic symptoms. Prominent paranoia and command hallucinations are not typical of MDD. Patient meets criteria for Schizophrenia with greater clinical coherence."
    }
  ],
  "deferred_diagnoses": [
    {
      "icd_code": "F20.81",
      "name": "Schizotypal Personality Disorder",
      "deferred_by": "Dr. Truck Irwin",
      "deferred_timestamp": "2026-03-22T15:40:00Z",
      "needed_for_decision": "Longitudinal data on personality features outside of acute psychotic episode. Recommend reassessment 6+ months post-treatment for mood/psychotic stabilization."
    }
  ]
}
```

---

## 5. Step 3.3: Validity Assessment Review

### 5.3.1 Presenting Validity Findings to the Clinician

After the evidence map is generated and stored, the clinician sees the **Validity Assessment Review** screen. This is the first diagnostic decision checkpoint.

The UI displays:

```
VALIDITY & TEST INTERPRETABILITY ASSESSMENT

Overall Interpretability: VALID ✓

Effort/Performance Validity Tests:
  • TOMM (Trial Making Test): PASS ✓
  • SIRS-2: PASS ✓

Standardized Validity Scales:
  • MMPI-3 Validity Profile: VALID
    - VRIN-T (Variable Response Inconsistency): T=48 (acceptable)
    - TRIN-T (True Response Inconsistency): T=52 (acceptable)
    - F (Infrequency): T=65 (elevated but within acceptable range)
    - Fs (Infrequency-Psychopathology): T=70 (consistent with genuine psychosis)

  • PAI Validity Scales: VALID
    - NIM (Negative Impression Management): 5 (acceptable)
    - PIM (Positive Impression Management): 3 (acceptable)

Test Interpretability Summary:
This test battery is fully interpretable. All validity indicators are acceptable. No evidence of malingering, coaching, or random responding. Elevated F and Fs on MMPI-3 are consistent with genuine psychotic symptoms, not test invalidity.

Clinician Decision:
  [ ] Accept validity assessment
  [ ] Question validity findings (requires justification)
  [ ] Invalidate battery (declare tests uninterpretable; requires strong justification)
```

### 5.3.2 Impact on Test Interpretability

If the validity assessment is "VALID" or "CAUTION":
- Test scores can be interpreted clinically
- Diagnostic hypotheses can be developed based on test patterns
- Proceed to diagnostic evidence map review

If the validity assessment is "INVALID":
- The entire test battery is unreliable
- The clinician must decide: proceed with non-test-based assessment, or request re-testing
- The evidence map will have reduced weight for test data

### 5.3.3 Feigning and Malingering Indicators

The validity assessment includes specific flags for effort and honesty:

```json
{
  "feigning_assessment": {
    "standalone_tests": {
      "test_name": "TOMM",
      "result": "Pass",
      "clinical_implication": "No evidence of malingering on forced-choice memory task"
    }
  },
  "embedded_scales": {
    "mmpi3_fs_score": 70,
    "clinical_implication": "Elevated Fs suggests genuine psychopathology, not malingering. Fs elevations are typical in acute psychosis."
  },
  "behavior_during_testing": {
    "observation": "Patient demonstrated effort on all tasks. No evidence of obvious avoidance or coaching.",
    "clinician_note": "During TOMM administration, patient appeared paranoid about the evaluator's intent but complied with instructions."
  },
  "overall_feigning_conclusion": "No evidence of malingering. Test battery is valid."
}
```

### 5.3.4 Clinician Validity Decision

The clinician must make an explicit decision:

**Option 1: Accept Validity Assessment**
- Clinician agrees validity findings are accurate
- Tests are interpretable, proceed to diagnostic evidence map
- Audit trail: "Validity assessment accepted by [clinician]"

**Option 2: Question Validity Findings**
- Clinician believes validity assessment is incorrect or incomplete
- Clinician writes reasoning: "MMPI-3 profile shows elevation on Fs, which the assessment attributed to genuine psychosis. However, [clinician observation] suggests patient may be exaggerating symptoms."
- Validity flag set for clinical opinion: "Validity concerns noted by clinician despite agent assessment"
- Audit trail: "Validity assessment questioned by [clinician]: [reasoning]"

**Option 3: Invalidate Battery**
- Clinician declares the entire test battery uninterpretable
- Requires strong justification: "Patient was clearly not making effort. Failed SIRS-2 (score 94, well above cutoff). Showed inconsistent performance patterns across instruments."
- Case status: test battery marked invalid, all scores flagged as unreliable
- Proceed to diagnostic formulation based on clinical interview and collateral only
- Audit trail: "Test battery invalidated by [clinician]: [reasoning]"

---

## 6. Step 3.4: Evidence Map Review

### 6.4.1 UI for Presenting Criterion-by-Criterion Evidence

The clinician opens the **Evidence Map Review** and sees each potential diagnosis with detailed evidence presentation:

```
DIAGNOSTIC EVIDENCE MAP

Diagnosis 1: Schizophrenia, Paranoid Type (ICD-10: F20.0)
Status: evidence_presented

Evidence Summary:
Patient meets criteria A and B. Strong evidence supports prominent psychotic symptoms (command hallucinations, paranoid delusions) with functional decline.

[EXPAND FOR DETAILED CRITERIA ANALYSIS]

Criterion A: Characteristic Symptoms — TWO OR MORE:
  ✓ MET

  Supporting Evidence:
    STRONG: "Hears voices commanding him to harm others" (interview session 1, 2026-03-20)
            Source: interview_data.narrative_notes, patient quote
    STRONG: "Beliefs that neighbors are conspiring against him" (interview session 1, 2026-03-20)
            Source: interview_data.narrative_notes, patient self-report
    MODERATE: MSE observation: "Appeared to respond to internal stimuli; stopped mid-sentence to listen"
              Source: interview_data.mse.perception, clinician observation (2026-03-20)
    MODERATE: MMPI-3 Pa scale (Paranoia): T=85 (99th percentile)
              Source: testing/scores/mmpi3_scores.json, clinical scale elevation

  Contradicting Evidence:
    WEAK: Patient denies hallucinations on first screening (though later acknowledged them)
          Source: intake/biopsychosocial.json (initial patient self-report)

  Criterion Met Status: ✓

Criterion B: Duration — 1+ MONTHS (or less with rapid progression):
  ✓ MET

  Supporting Evidence:
    STRONG: Symptoms began 2 weeks ago after stopping medication
            Source: collateral/mother_interview_notes.json, corroborated family history
    STRONG: Behavioral decline observable across two interviews (2 weeks apart)
            Source: interview_data.mse, clinician observations

  Contradicting Evidence:
    None

  Criterion Met Status: ✓

Criterion C: Exclusion — NOT due to medical condition, substance use, or medication:
  ✓ MET

  Supporting Evidence:
    MODERATE: No medical condition documented that explains psychotic symptoms
              Source: intake/biopsychosocial.json, medical history review
    STRONG: Patient discontinued psychiatric medications 3 months ago; symptoms accelerated 2 weeks after discontinuation
            Source: collateral/mother_interview.json, collateral corroboration
    MODERATE: Urine drug screen: negative
              Source: testing/medical_records.pdf, recent medical evaluation

  Contradicting Evidence:
    WEAK: Patient's substance use history (marijuana use reported 5 years ago) — but pattern does not explain current presentation
          Source: intake/biopsychosocial.json

  Criterion Met Status: ✓

Overall Assessment:
Patient meets all three major criteria for Schizophrenia, Paranoid Type. Diagnostic evidence is coherent across test data, interview observations, and collateral history.
```

### 6.4.2 Supporting vs. Contradicting Evidence Display

For each criterion, evidence is organized as:

**Supporting Evidence:**
```
[STRENGTH RATING: STRONG / MODERATE / WEAK]
[EVIDENCE DESCRIPTION]
[SOURCE CITATION WITH RETRIEVABLE LINK]
```

**Strength Ratings:**

- **STRONG** — Direct evidence from multiple sources, objective findings, behavioral observation, or patient/collateral report that clearly supports the criterion
  - Example: "TOMM pass" for effort/validity
  - Example: "Direct patient quote acknowledging command hallucinations during interview"

- **MODERATE** — Evidence that supports the criterion but with caveats (single source, somewhat indirect, or requires inference)
  - Example: "MSE observation of internal focus, consistent with hallucinations"
  - Example: "Elevated MMPI-3 Paranoia scale"

- **WEAK** — Evidence that is tangentially related or requires substantial inference
  - Example: "Patient expresses guardedness, which *could* reflect paranoia but could also reflect normal evaluation anxiety"

**Contradicting Evidence:**

Displayed with equal prominence. The clinician sees both the evidence supporting the diagnosis AND evidence against it.

```
Contradicting Evidence:
  MODERATE: Patient denies current suicidal ideation, reports engagement in daily activities
            Source: interview_data.narrative_notes (may argue against severe functional impairment in Criterion B of MDD)
```

### 6.4.3 Source Citations Back to Case Record

Every evidence statement includes a citation that allows the clinician to drill down to the source:

```
Source: interview_data.session_001.mental_status.perception
        [CLICK TO VIEW FULL CONTEXT]
```

Clicking the citation opens the source in the editor (column 2), showing the exact location in the case file where that evidence appears. This enables the clinician to:
- Verify the evidence is accurately represented in the evidence map
- Re-read the original context (which might include nuance)
- Form their own judgment about the evidence's weight

### 6.4.4 Navigating Complex Evidence Maps

For a forensic evaluation with 20+ potential diagnoses, the evidence map could be extremely long. The UI provides navigation:

1. **Diagnosis Index** — List of all diagnoses in the evidence map, with brief summaries
2. **Filter by Criterion Met Status** — Show only diagnoses where criterion A is met, etc.
3. **Sort by Evidence Strength** — Show diagnoses with strongest supporting evidence first
4. **Full Text Search** — Search for specific symptoms, test names, or evidence statements
5. **Collapse/Expand Sections** — Clinician can collapse individual diagnoses to focus on a subset

---

## 7. Step 3.5: Differential Diagnosis Review

### 7.5.1 Side-by-Side Comparison of Overlapping Diagnoses

For pairs of similar diagnoses, the evidence map presents explicit comparisons:

```
DIFFERENTIAL: Schizophrenia vs. Bipolar I Disorder (Most Recent Episode Manic)

Key Distinguishing Features:

FEATURE 1: History of Manic/Hypomanic Episodes

  Evidence Supporting Schizophrenia:
    • No reported episodes of elevated mood lasting days/weeks
    • No history of decreased need for sleep associated with high energy
    • Acute onset of psychotic symptoms in context of medication non-compliance (2 weeks ago)
    • Family history of psychosis (mother's cousin diagnosed with schizophrenia) vs. no family history of bipolar disorder

  Evidence Supporting Bipolar I:
    • NONE
    • Patient denies any history of mania or hypomania
    • Collateral (mother) denies any prior manic episodes

  Clinical Clarification:
    Patient's acute presentation without prior manic episodes argues against Bipolar I. His psychotic symptoms appear primary (not secondary to a manic episode), supporting Schizophrenia diagnosis.

FEATURE 2: Duration and Onset

  Evidence Supporting Schizophrenia:
    • Acute onset (2 weeks) following medication discontinuation
    • Schizophrenia onset typically in late adolescence/early adulthood (patient is 34, late-onset but not uncommon)
    • Progressive course if untreated, which matches patient's trajectory

  Evidence Supporting Bipolar I:
    • Bipolar I typically shows episodic course with periods of normal mood between episodes
    • No prior episodes documented

  Clinical Clarification:
    Schizophrenia presents as more consistent with acute-to-chronic course. If patient had prior manic episode, timeline would shift toward Bipolar I.

FEATURE 3: Response to Treatment

  Evidence Supporting Schizophrenia:
    • Patient was stabilized on antipsychotic (not mood stabilizer) for prior hospitalization
    • Decompensation occurred with antipsychotic discontinuation

  Evidence Supporting Bipolar I:
    • Would expect mood stabilizer treatment vs. antipsychotic monotherapy

  Clinical Clarification:
    Prior treatment with antipsychotic alone (without mood stabilizer) suggests psychotic disorder rather than bipolar.

OVERALL DIFFERENTIAL ASSESSMENT:
Schizophrenia, Paranoid Type is more consistent with this patient's presentation. Bipolar I is ruled out based on absence of manic history and prior treatment response pattern.
```

### 7.5.2 Clinician Notes on Differential Diagnoses

The clinician can add notes to any differential comparison:

```
[CLINICIAN NOTES ON THIS DIFFERENTIAL]

"I agree with this analysis. The acute onset and prior response to antipsychotic without mood stabilizer clearly point to Schizophrenia. However, I will recommend long-term mood monitoring because late-onset Bipolar I can present with prominent psychosis initially. But current evidence supports Schizophrenia diagnosis."

[SAVE NOTES]
```

These notes are stored in `diagnostics/differential_dx.json` and appear in the final diagnostic formulation.

---

## 8. Step 3.6: Psycholegal Analysis Review (Forensic Only)

### 8.6.1 Evidence Mapped to Legal Standards

For forensic cases, the evidence map includes explicit mapping to the applicable legal standard.

**CST (Competency to Stand Trial) Example:**

```
PSYCHOLEGAL ANALYSIS: COMPETENCY TO STAND TRIAL (Dusky Standard)

Jurisdiction: Colorado District Court
Legal Standard: Dusky v. United States (1960)

The Dusky standard requires:
1. Factual understanding of charges, court process, and consequences
2. Rational understanding of charges (understanding how it applies to oneself)
3. Ability to assist counsel in one's defense

ELEMENT 1: Factual Understanding

Evidence Supporting Competency:
  STRONG: Patient accurately states charges (Assault 2, Menacing)
          Source: interview_data.competency_assessment.charges_understanding
  STRONG: Patient can name his attorney (Sarah Mitchell) and describe her role
          Source: interview_data.competency_assessment.attorney_understanding
  MODERATE: Patient understands general trial process (plea options, judge role)
            Source: interview_data.competency_assessment.trial_process

Evidence Against Competency:
  MODERATE: Patient's understanding is accurate but fragmented. He loses the thread of explanation at times.
            Source: interview_data.mse.thought_process
  MODERATE: Patient's paranoia about the judge and prosecutor may affect his rational reliance on legal system
            Source: interview_data.narrative_notes, patient beliefs about judge bias

Conclusion on Element 1: Patient demonstrates factual understanding with significant caveats regarding emotional/paranoid interference.

ELEMENT 2: Rational Understanding

Evidence Supporting Competency:
  WEAK: Patient intellectually grasps that charges apply to him
        Source: interview_data.competency_assessment.personal_understanding

Evidence Against Competency:
  STRONG: Patient's paranoid delusions prevent rational understanding. He believes the judge and prosecutor are conspiring against him unjustly.
          Source: interview_data.narrative_notes, interview_data.mse.thought_content
  STRONG: Patient's psychotic symptoms (command hallucinations) are ongoing and untreated. He is not taking psychiatric medications.
          Source: interview_data.narrative_notes, collateral/mother_interview.json
  MODERATE: Patient's command hallucinations direct him to harm others, which affects his ability to rationally work with counsel on legal strategy
            Source: interview_data.narrative_notes, collateral history

Conclusion on Element 2: Patient demonstrates impaired rational understanding due to active psychotic symptoms and paranoid delusions.

ELEMENT 3: Ability to Assist Counsel

Evidence Supporting Competency:
  WEAK: Patient is oriented and maintains attention during interview (largely)
        Source: interview_data.mse.cognition

Evidence Against Competency:
  STRONG: Patient's paranoia and distrust extend to his own attorney. He expresses belief that attorney may be "working with" the prosecutor.
          Source: interview_data.narrative_notes
  STRONG: Patient's command hallucinations and paranoid preoccupation would prevent rational planning and communication with counsel
          Source: interview_data.narrative_notes, behavioral observation
  MODERATE: Patient has been psychiatrically hospitalized in the past for psychosis but has not engaged in outpatient treatment
            Source: collateral/prior_hospitalization_records.pdf

Conclusion on Element 3: Patient is unable to assist counsel rationally due to paranoia and active psychotic symptoms.

CRITICAL GAPS IN EVIDENCE:
- No formal competency assessment instrument administered (recommend MacArthur Competency Assessment Tool for structured evaluation)
- No evaluation of patient's response to antipsychotic medication (would inform restoration potential)
- Limited assessment of patient's understanding of consequences (incarceration, felony record, etc.)

CLINICAL FINDINGS APPLICABLE TO LEGAL STANDARD:

Patient's acute psychotic illness (Schizophrenia, Paranoid Type) directly impairs all three Dusky elements:

1. His factual understanding is adequate but fragmented.
2. His rational understanding is severely impaired by paranoid delusions about the court system and conspiracy beliefs.
3. His ability to assist counsel is compromised by paranoia toward his attorney and intrusive command hallucinations.

Patient is NOT COMPETENT to stand trial as currently presenting. Competency restoration through psychiatric stabilization (antipsychotic medication, inpatient treatment) is indicated and recommended.
```

### 8.6.2 Legal Standard Criteria with Evidence For/Against

For each element of the legal standard, the evidence map presents:

- **Evidence for the criterion** — facts that support competency/insanity/danger/etc.
- **Evidence against the criterion** — facts that argue against it
- **Gaps** — what information would strengthen the assessment

### 8.6.3 Gap Identification

The psycholegal analysis explicitly identifies gaps:

```
GAPS IN EVIDENCE NEEDED FOR COMPLETE COMPETENCY ASSESSMENT:

1. FORMAL COMPETENCY ASSESSMENT INSTRUMENT
   Current: Clinical interview-based assessment
   Recommended: MacArthur Competency Assessment Tool (MacCAT-CA)
   Why: Provides structured scoring on factual/rational understanding and ability to assist counsel
   Impact: Would clarify borderline areas and provide legally defensible quantification

2. MEDICATION RESPONSE TRIAL
   Current: Patient has not been on psychiatric medication for 3 months
   Needed: Trial of antipsychotic medication to assess restoration potential
   Why: Competency restoration depends on whether patient's symptoms improve with treatment
   Impact: Essential for recommendation regarding fitness to proceed vs. restoration

3. DETAILED CONSEQUENCES UNDERSTANDING
   Current: Limited assessment of patient's understanding of potential incarceration, felony record impact
   Needed: Explicit evaluation of long-term consequences understanding
   Why: Dusky includes consequences understanding
   Impact: May reveal additional competency deficits or strengths

4. COLLATERAL CONTACTS (ATTORNEY AND TREATING PSYCHIATRIST)
   Current: Limited contact with patient's public defender
   Needed: Direct interview with attorney regarding her assessment of patient's ability to assist in defense
   Why: Attorney's observations of patient's participation in case preparation are relevant
   Impact: Provides behavioral evidence of actual courtroom ability to function
```

---

## 9. Step 3.7: Clinician Diagnostic Decisions

### 9.7.1 The Critical UI: Individual Diagnostic Decisions

After reviewing the evidence map, validity assessment, differential comparisons, and (if forensic) psycholegal analysis, the clinician enters the **Diagnostic Decisions** screen.

This is where the clinician makes the actual diagnosis. This is THE DOCTOR ALWAYS DIAGNOSES in action.

The UI presents each diagnosis from the evidence map:

```
DIAGNOSTIC DECISIONS

You have reviewed the evidence map for 23 potential diagnoses. For each diagnosis, you must make an individual decision: CONFIRM, RULE OUT, or DEFER.

NO "ACCEPT ALL" BUTTON. Every diagnosis requires an individual decision.
───────────────────────────────────────────────────────────

DIAGNOSIS 1 of 23: Schizophrenia, Paranoid Type (F20.0)

Evidence Summary:
  Patient meets Criterion A (two+ characteristic symptoms), Criterion B (duration >1 month), Criterion C (exclusions met).
  Key evidence: Command hallucinations, paranoid delusions, acute onset after medication discontinuation, prior hospitalization for psychosis.
  [VIEW FULL EVIDENCE MAP]

Your Decision (required):

  ○ CONFIRM — I agree this diagnosis is supported by the evidence
             → [SELECT ICD-10 CODE: F20.0 ▼]
             → [WRITE CLINICAL JUSTIFICATION (required, 100+ characters):
                "Patient clearly meets DSM-5-TR criteria for Schizophrenia, Paranoid Type. Acute onset of two characteristic symptoms (auditory hallucinations and paranoid delusions) following medication discontinuation. Clear functional decline. Consistent with prior psychiatric history and current presentation."]
             → [SAVE DIAGNOSIS]

  ○ RULE OUT — The evidence does not support this diagnosis
              → [DOCUMENT REASONING (required):
                 Why don't you think this diagnosis applies? What evidence contradicts it?]
              → [SAVE DECISION]

  ○ DEFER — I need more information before deciding
           → [SPECIFY WHAT'S NEEDED (required):
              "Need formal competency assessment instrument (MacCAT-CA) to clarify factual vs. rational understanding deficits before finalizing competency-related diagnoses."]
           → [SAVE DECISION]

────────────────────────────────────────────────────────────

DIAGNOSIS 2 of 23: Major Depressive Disorder, Severe (F32.2)

[Next diagnosis in same format...]
```

### 9.7.2 The "CONFIRM" Decision

When the clinician chooses CONFIRM:

1. **ICD-10 Code Selection** — Dropdown list of all relevant ICD-10 codes for this diagnosis
   - Schizophrenia, Paranoid Type → F20.0
   - Schizophrenia, Disorganized Type → F20.1
   - Etc.

2. **Clinical Justification (Required)** — Free-text field. Clinician writes WHY they believe the diagnosis is supported. This is not optional. Minimum 100 characters.

   Example:
   ```
   "Patient meets all DSM-5-TR criteria for Schizophrenia, Paranoid Type:
    - Criterion A: Two characteristic symptoms present (command auditory hallucinations and persecutory delusions with paranoid content)
    - Criterion B: Symptoms have been present for 2 weeks, meeting the 1-month criterion when accounting for prodromal symptom onset
    - Criterion C: No medical condition or substance use disorder explains the symptoms
    - Criterion D: Functional decline evident (unemployed, poor self-care, social withdrawal)

    Clinical coherence: Acute onset following medication non-compliance, prior hospitalization for psychotic episode, family history of psychosis. Test data (MMPI-3 elevations on Paranoia and Psychasthenia scales) corroborate clinical presentation."
   ```

3. **Save Diagnosis** — Diagnosis is recorded with clinician name, timestamp, and justification.

**Audit Trail Entry:**
```json
{
  "timestamp": "2026-03-22T15:30:00Z",
  "action": "diagnosis_confirmed",
  "details": {
    "icd_code": "F20.0",
    "diagnosis_name": "Schizophrenia, Paranoid Type",
    "clinician": "Dr. Truck Irwin",
    "justification": "Patient meets all DSM-5-TR criteria for Schizophrenia, Paranoid Type... [full text]"
  }
}
```

### 9.7.3 The "RULE OUT" Decision

When the clinician chooses RULE OUT:

1. **Reasoning (Required)** — Clinician documents why the diagnosis does NOT apply. This establishes that the clinician reviewed and rejected the evidence.

   Example:
   ```
   "While patient exhibits some depressive symptoms (anhedonia, sleep disturbance), these are secondary to acute psychotic symptoms and do not constitute a primary mood disorder. MDD would require a depressive episode as the primary presentation; here, psychosis is primary. Additionally, patient's elevated mood during hypomanic-like periods would be inconsistent with MDD presentation. Schizophrenia diagnosis is more clinically coherent and explains all primary symptoms."
   ```

2. **Save Decision** — Diagnosis is recorded as "ruled_out" with reasoning.

**Audit Trail Entry:**
```json
{
  "timestamp": "2026-03-22T15:35:00Z",
  "action": "diagnosis_ruled_out",
  "details": {
    "icd_code": "F32.1",
    "diagnosis_name": "Major Depressive Disorder, Moderate",
    "clinician": "Dr. Truck Irwin",
    "reasoning": "While patient exhibits some depressive symptoms... [full text]"
  }
}
```

### 9.7.4 The "DEFER" Decision

When the clinician chooses DEFER:

1. **Specification of What's Needed (Required)** — Clinician documents what additional information would help finalize the diagnosis.

   Example:
   ```
   "Schizotypal Personality Disorder: This diagnosis requires assessment of longstanding personality traits outside of acute psychotic episodes. Current presentation is dominated by acute-onset Schizophrenia. Recommend reassessment 6+ months post-acute-treatment for mood/psychotic stabilization to determine if Schizotypal traits persist. At that time, can assess for magical thinking, unusual beliefs/perceptions, and interpersonal deficits in non-psychotic context."
   ```

2. **Save Decision** — Diagnosis is recorded as "deferred" with specification.

3. **Note in Clinical Opinion** — Deferred diagnoses appear in the clinical opinion as requiring follow-up.

**Audit Trail Entry:**
```json
{
  "timestamp": "2026-03-22T15:45:00Z",
  "action": "diagnosis_deferred",
  "details": {
    "icd_code": "F21",
    "diagnosis_name": "Schizotypal Personality Disorder",
    "clinician": "Dr. Truck Irwin",
    "needed_for_decision": "Reassessment after acute treatment... [full text]"
  }
}
```

### 9.7.5 Adding Diagnoses Not Suggested by the AI

The clinician is not limited to the diagnoses the Diagnostician Agent presented. The clinician can add diagnoses based on:
- Clinical judgment
- Pattern recognition
- Information the AI couldn't access
- Behavioral observations during testing

**UI Element:**

```
[+ ADD DIAGNOSIS NOT IN EVIDENCE MAP]

Search or select from DSM-5-TR catalog:
  [Type diagnosis name... ▼]

Or browse by category:
  • Neurodevelopmental Disorders
  • Schizophrenia Spectrum and Other Psychotic Disorders
  • Bipolar and Related Disorders
  • Depressive Disorders
  • Anxiety Disorders
  ...

Selected: Adjustment Disorder with Depressed Mood (F43.21)

Clinical Justification (required):
"Patient also presents with depressive symptoms (sadness, anhedonia) in response to legal charges and pending trial. While primary diagnosis is Schizophrenia, the reactive depressive component warrants Adjustment Disorder diagnosis to capture the full clinical picture and guide treatment approach (antipsychotic + antidepressant)."

[SAVE DIAGNOSIS]
```

This diagnosis is treated identically to AI-presented diagnoses: recorded with ICD-10 code, justification, clinician name, timestamp.

**Audit Trail Entry:**
```json
{
  "timestamp": "2026-03-22T15:50:00Z",
  "action": "diagnosis_confirmed",
  "details": {
    "icd_code": "F43.21",
    "diagnosis_name": "Adjustment Disorder with Depressed Mood",
    "source": "clinician_added_not_in_evidence_map",
    "clinician": "Dr. Truck Irwin",
    "justification": "Patient also presents with depressive symptoms... [full text]"
  }
}
```

### 9.7.6 Tracking Progress Through Diagnoses

The UI shows progress:

```
DIAGNOSTIC DECISIONS PROGRESS

COMPLETED: 18 of 23 diagnoses addressed
  ✓ Confirm (8)
  ✓ Rule Out (7)
  ↗ Defer (3)

REMAINING: 5 diagnoses need decisions

[Current: Diagnosis 19 of 23]
  Diagnosis 19: Histrionic Personality Disorder (F60.4)
  [Pending your decision...]

[< PREVIOUS]  [NEXT >]
[SAVE PROGRESS AND RETURN LATER] [CONTINUE TO COMPLETION]
```

The clinician can:
- Return to specific diagnoses to review/modify decisions
- Save and return later (draft diagnostic decisions)
- Skip forward to remaining diagnoses
- View all decisions in a summary table

### 9.7.7 Completion Check Before Advancement

When the clinician has addressed all diagnoses (no pending decisions), the UI shows:

```
✓ ALL DIAGNOSTIC DECISIONS COMPLETE

Summary:
  ✓ Diagnoses confirmed: 9
  ✓ Diagnoses ruled out: 11
  ↗ Diagnoses deferred: 3 (with follow-up specified)

Next Step: Write your clinical opinion
```

---

## 10. Step 3.8: Clinician Opinion Formulation

### 10.8.1 The Clinical Opinion Is The Clinician's Words

After all diagnostic decisions are made, the clinician writes their clinical opinion. This is NOT AI-generated. This is the clinician's voice, their clinical judgment synthesized into a summary statement.

**For forensic evaluations:** The opinion is a psycholegal opinion.

Example:
```
CLINICAL OPINION — COMPETENCY TO STAND TRIAL

Marcus Johnson presents with Schizophrenia, Paranoid Type in acute exacerbation. He meets all DSM-5-TR diagnostic criteria with prominent auditory hallucinations commanding violence and persecutory delusions centered on belief that the legal system is conspiring against him.

In the context of the Dusky standard for competency to stand trial, Mr. Johnson demonstrates:

1. Adequate factual understanding of the charges, court process, and potential consequences. He can articulate his charges, identify his attorney, and describe the general trial process.

2. Severely impaired rational understanding of the charges in the context of his personal situation. His paranoid delusions about the judge and prosecutor preclude rational understanding that the court is a neutral forum designed to determine his guilt or innocence.

3. Markedly impaired ability to assist his counsel in his defense. His paranoia extends to his own attorney. His intrusive command hallucinations (commanding him to harm others) and distractibility would prevent coherent participation in trial preparation and testimony.

CONCLUSION: Marcus Johnson is NOT COMPETENT to stand trial as currently presenting.

RECOMMENDATION: The defendant should be committed for psychiatric evaluation and treatment focused on antipsychotic medication optimization, with follow-up competency evaluation after acute symptom stabilization (estimated 4-8 weeks of inpatient psychiatric treatment). Competency restoration is reasonably achievable given the acute nature of his presentation and prior response to psychiatric treatment (hospitalization in 2022 with antipsychotic medication).
```

**For clinical evaluations:** The opinion focuses on diagnosis, functional impact, and treatment recommendations.

Example:
```
CLINICAL OPINION

Jane Smith presents with Major Depressive Disorder, Severe, with prominent anxiety features. She meets full DSM-5-TR criteria with depressed mood, anhedonia, sleep disturbance, concentration difficulty, and passive suicidal ideation (thoughts that she "would be better off dead" but without specific plan). She reports onset 6 months ago following termination of a 5-year romantic relationship.

Her depression is causing significant functional impairment across work, social, and self-care domains. She has taken a leave of absence from her position, has withdrawn from friendships, and reports neglecting personal hygiene and nutrition.

Personality assessment indicates no evidence of personality disorder. She demonstrates intact insight and capacity for therapeutic alliance.

RECOMMENDATIONS:
1. Immediate psychiatric evaluation for antidepressant medication (SSRI first-line, given her profile)
2. Individual psychotherapy (cognitive-behavioral therapy recommended) 2x/week for 12 weeks
3. Safety monitoring for suicidal risk, with explicit crisis plan and 24-hour hotline number
4. Follow-up psychiatric evaluation in 4 weeks to assess treatment response
```

### 10.8.2 Storing the Clinical Opinion

The clinical opinion is stored as a separate document in `diagnostics/diagnostic_formulation.json`:

```json
{
  "clinical_opinion": {
    "formulation_type": "CST_competency_opinion",
    "opinion_text": "Marcus Johnson presents with Schizophrenia, Paranoid Type... [full opinion text]",
    "written_by": "Dr. Truck Irwin",
    "written_timestamp": "2026-03-22T16:00:00Z",
    "revision_number": 1,
    "word_count": 847
  }
}
```

The clinician can revise the opinion multiple times before advancing to Review. Each revision is versioned.

---

## 11. Step 3.9: Advancement to Review Stage

### 11.9.1 Advancement Validation

Before the case can advance from Diagnostics to Review, the application validates:

1. **All diagnoses addressed** — Every diagnosis from the evidence map has a status (Confirmed, Ruled Out, or Deferred). No diagnoses left in "Pending" status.
2. **At least one diagnosis confirmed OR "No diagnosis" documented** — The case cannot advance with an empty diagnostic formulation.
3. **Clinical opinion written** — The opinion field is not empty and contains at least 200 characters.
4. **Deferred diagnoses have specification** — If any diagnoses are deferred, the clinician has documented what's needed.

**Validation Code (Pseudocode):**

```
if (confirmed_diagnoses.length > 0 OR no_diagnosis_documented):
  AND (all_evidence_map_diagnoses.every(dx => dx.clinician_decision != null)):
  AND (clinical_opinion.text.length >= 200):
  AND (deferred_diagnoses.every(dx => dx.needed_for_decision.length > 0)):
  THEN: enable ADVANCE button
ELSE: disable ADVANCE button, display which requirement is missing
```

### 11.9.2 Advancement Checklist

The UI displays a pre-advancement checklist:

```
ADVANCE TO REVIEW STAGE

Pre-Advancement Checklist:

✓ All presented diagnoses have clinician decisions (Confirm/Rule Out/Defer)
✓ At least one diagnosis confirmed (9 confirmed)
✓ Clinical opinion written (847 words)
✓ All deferred diagnoses have specification of what's needed (3 deferred)
✓ Validity assessment reviewed and accepted

[ ADVANCE TO REVIEW STAGE ]

This action will:
• Move case from Diagnostics to Review stage
• Create report/ and report/drafts/ directories
• Enable report generation and editing
• Lock diagnostic decisions from further changes (audit trail remains mutable for clinician notes, but diagnosis status is immutable)
```

### 11.9.3 Advancement Action

When the clinician clicks "Advance to Review":

1. **Directory Creation** — App creates `report/` and `report/drafts/` subdirectories in the case directory
2. **Case Status Update** — Case status changes to **Review** (red-orange) in the pipeline indicator
3. **Database Update** — SQLCipher `cases` table updated with new status and timestamp
4. **case.json Update** — `case.json` file updated with new stage information:
   ```json
   {
     "pipeline": {
       "currentStage": "Review",
       "stageHistory": [
         ...
         {"stage": "Diagnostics", "entered": "2026-03-18T12:00:00Z", "completed": "2026-03-22T16:15:00Z"},
         {"stage": "Review", "entered": "2026-03-22T16:15:00Z", "completed": null}
       ]
     }
   }
   ```
5. **Audit Trail Entry** — Comprehensive entry recording the advancement:
   ```json
   {
     "timestamp": "2026-03-22T16:15:00Z",
     "action": "case_advanced",
     "details": {
       "from_stage": "Diagnostics",
       "to_stage": "Review",
       "diagnoses_confirmed": [
         {"code": "F20.0", "name": "Schizophrenia, Paranoid Type"},
         {"code": "F43.21", "name": "Adjustment Disorder with Depressed Mood"}
       ],
       "diagnoses_ruled_out": 11,
       "diagnoses_deferred": 3,
       "clinical_opinion_length": 847,
       "clinician": "Dr. Truck Irwin"
     }
   }
   ```

---

## 12. Error Handling and Edge Cases

### 12.1 Diagnostician Agent Returns Unexpected Diagnoses

**Scenario:** The Diagnostician Agent presents 25 diagnoses, including diagnoses not clinically relevant to the case (e.g., childhood autism spectrum disorders for a 52-year-old forensic competency evaluation).

**Handling:**
- The clinician reviews the evidence map and sees some diagnoses with NO supporting evidence
- The clinician RULES OUT those diagnoses with explanation: "This diagnosis is not clinically relevant to this presentation. No evidence for any criterion."
- The UI allows ruling out diagnoses even with zero supporting evidence
- Audit trail captures the clinician's decision to rule out irrelevant diagnoses

### 12.2 Clinician Disagrees With All AI-Presented Diagnoses

**Scenario:** The Diagnostician Agent presents evidence for Schizophrenia, Schizoaffective, Substance-Related Psychosis, etc. The clinician reviews and believes none of these diagnoses fit. Instead, the clinician believes the patient has a brief psychotic disorder secondary to severe stress.

**Handling:**
- The clinician RULES OUT all AI-presented diagnoses with clear reasoning: "Patient's psychotic symptoms began abruptly in response to [specific stressor]. Symptoms are expected to remit within 4 weeks. DSM-5-TR criterion for Brief Psychotic Disorder met."
- The clinician ADDS Brief Psychotic Disorder (F23) from the DSM-5-TR catalog
- Writes clinical justification for the added diagnosis
- Case advances normally with zero AI-agreement and full clinician-driven diagnosis
- Audit trail shows all AI-presented diagnoses ruled out and one clinician-added diagnosis confirmed

### 12.3 Insufficient Data for Diagnosis (Defer All)

**Scenario:** The clinician reviews the evidence map and realizes that the case lacks sufficient test data, interview depth, or collateral information to make reliable diagnostic decisions. The clinician wants to go back to Testing or Interview for more data.

**Handling:**
- The clinician DEFERS all diagnoses with specification: "Insufficient data for any reliable diagnosis. Need: (1) formal competency assessment instrument (MacCAT-CA), (2) collateral contact with treating psychiatrist, (3) additional interview session focused on childhood/developmental history."
- Case STAYS in Diagnostics (does not advance to Review)
- Clinician can add more interviews, request more collateral, or administer additional tests
- Case CAN move backward in the pipeline (Diagnostics → Interview to conduct more interviews, or Diagnostics → Testing to administer additional instruments)
- Once additional data is gathered, the case returns to Diagnostics for re-assessment

**Application Behavior:**
```
⚠️ ALL DIAGNOSES DEFERRED — INSUFFICIENT DATA

You have deferred all 23 diagnoses. This means the case cannot advance to Review without additional assessment data.

You can:
1. Go back to Interview stage to conduct additional sessions
2. Go back to Testing stage to administer additional instruments
3. Request additional collateral records or contacts
4. Assign case to [supervisory clinician] for consultation

Choose your next action:
  [ RETURN TO INTERVIEW STAGE ]
  [ RETURN TO TESTING STAGE ]
  [ STAY IN DIAGNOSTICS AND REQUEST CONSULTATION ]
```

### 12.4 Complex Comorbidity (Multiple Confirmed Diagnoses)

**Scenario:** The clinician confirms 5 diagnoses: Schizophrenia, Paranoid Type (primary), Alcohol Use Disorder (moderate), Adjustment Disorder with Depressed Mood, Insomnia Disorder, and Unspecified Neurocognitive Disorder.

**Handling:**
- The application handles multiple confirmed diagnoses without issue
- The clinical opinion explains the relationship between diagnoses: "Mr. Johnson presents with primary Schizophrenia, Paranoid Type, complicated by chronic alcohol use disorder and adjustment responses to legal consequences. Insomnia appears secondary to psychotic symptoms and substance use. Neurocognitive screening suggests mild deficits, warrant further neuropsychological evaluation if academic/occupational functioning concerns arise."
- The diagnostic formulation lists all confirmed diagnoses in priority order (primary → secondary → tertiary)
- Audit trail shows each diagnosis confirmed separately with timestamp and justification

### 12.5 Malingering/Feigning Confirmed

**Scenario:** The clinician reviews the validity assessment and behavioral observations, and concludes that the patient was malingering (faking or exaggerating symptoms to appear more psychologically disturbed).

**Handling:**
- The validity assessment is updated: `feigning: true`
- The clinical opinion addresses this explicitly: "Ms. Williams demonstrates clear evidence of malingering on effort-based testing (failed TOMM, scored >95 on SIRS-2, coached language in interview). Her self-reported symptoms are not credible. Test interpretability is INVALID. Based on observation and collateral report, no significant psychiatric illness is evident."
- The clinician may DEFER or RULE OUT all psychiatric diagnoses with explanation: "Symptoms are feigned/exaggerated. No genuine psychiatric disorder identified."
- A separate `feigning_assessment.json` file documents the malingering findings with detail
- Audit trail notes the malingering assessment, which is critical in forensic contexts (defense attorneys may challenge diagnoses based on feigning)

### 12.6 Case Needs to Go Back for More Data

**Scenario:** During diagnostic review, the clinician identifies a significant gap: "I need to know whether the patient has a history of childhood psychosis. The mother mentioned something about 'weird episodes' when he was 12, but I didn't ask for details. That's critical for Schizophrenia vs. Adjustment Disorder distinction."

**Handling:**
- The clinician DEFERS relevant diagnoses: "Need collateral contact with mother to clarify childhood psychiatric history. This will determine whether early psychosis was present."
- The clinician clicks "Go Back to Interview" and the case status reverts to Interview
- The clinician schedules a collateral interview with the mother, documents the new information
- When sufficient data is gathered, the case re-enters Diagnostics and the diagnostic process continues with updated evidence map

**Application Flow:**
```
CASE DIAGNOSTICS IN PROGRESS

You are reviewing diagnostic evidence. You can:

1. Continue reviewing evidence and making diagnostic decisions
2. Go back to Interview stage to conduct additional interviews
3. Go back to Testing stage to administer additional instruments
4. Request collateral documents or contacts (stays in Diagnostics, but documents request)

[ CONTINUE WITH DIAGNOSTICS ]
[ GO BACK TO INTERVIEW STAGE ]
[ GO BACK TO TESTING STAGE ]
[ REQUEST ADDITIONAL COLLATERAL ]
```

---

## 13. IPC Contracts — Diagnostician Agent Invocation

### 13.1 Main Channel: Invoke Diagnostician Agent

```typescript
// Invoke the Diagnostician Agent to generate evidence map
ipcMain.handle('diagnostics:generateEvidenceMap', async (event, {
  caseNumber: string,
  caseRecord: object,           // Full case data from all prior stages
  evalType: 'forensic' | 'clinical',
  legalStandard?: string        // e.g., "Dusky", "M'Naghten" (forensic only)
}) => Promise<{
  evidence_matrix: object,      // Full Diagnostician Agent response
  validity_assessment: object,
  diagnostic_evidence_map: object,
  differential_comparisons: array,
  psycholegal_analysis?: object, // forensic only
  functional_impairment_summary?: object, // clinical only
  generated_timestamp: string,
  operation_id: string          // Matches UNID redaction operation
}>);
```

### 13.2 UNID Pipeline Channels (from doc 15)

Invoked before agent submission:

```typescript
// Redact: send full-PHI case record, receive redacted with UNIDs
ipcMain.handle('pii:redact', async (event, {
  text: string,           // Case record serialized to JSON string
  operationId: string,    // Unique ID for this redaction
  context: 'diagnostics'
}) => Promise<{
  redactedText: string,
  entityCount: number,
  typeBreakdown: Record<string, number>
}>);

// Re-hydrate: send AI response with UNIDs, receive full-PHI
ipcMain.handle('pii:rehydrate', async (event, {
  text: string,           // Evidence map JSON with UNIDs
  operationId: string     // Must match redact operationId
}) => Promise<{
  fullText: string,
  unidsReplaced: number
}>);
```

### 13.3 Storage Channels

```typescript
// Save evidence map to case directory
ipcMain.handle('case:saveEvidenceMap', async (event, {
  caseNumber: string,
  evidence_matrix: object
}) => Promise<{
  saved_path: string,
  file_size: number
}>);

// Update case.json with diagnostic stage progress
ipcMain.handle('case:updateDiagnosticProgress', async (event, {
  caseNumber: string,
  confirmed_diagnoses: array,   // [{code, name, justification}]
  ruled_out_diagnoses: array,
  deferred_diagnoses: array,
  clinical_opinion: string
}) => Promise<{
  updated: boolean,
  case_json: object
}>);
```

---

## 14. Data Model — Diagnostic Formulation Schema

### 14.1 diagnostic_formulation.json

Complete diagnostic decisions and clinical opinion:

```json
{
  "case_number": "2026-0147",
  "diagnostics_stage": {
    "entered": "2026-03-18T12:00:00Z",
    "in_progress_since": "2026-03-22T14:30:00Z"
  },

  "validity_assessment": {
    "status": "valid",
    "clinician_reviewed": true,
    "clinician_decision": "accepted",
    "clinician_decision_timestamp": "2026-03-22T14:35:00Z",
    "clinician_notes": null
  },

  "confirmed_diagnoses": [
    {
      "position": 1,
      "icd_code": "F20.0",
      "diagnosis_name": "Schizophrenia, Paranoid Type",
      "confirmed_by": "Dr. Truck Irwin",
      "confirmed_timestamp": "2026-03-22T15:30:00Z",
      "clinical_justification": "Patient meets all DSM-5-TR criteria for Schizophrenia, Paranoid Type. Criterion A: Two characteristic symptoms present (auditory hallucinations commanding harm, persecutory delusions about neighbors/legal system). Criterion B: Duration >1 month (acute onset 2 weeks ago, but prodromal symptoms for 3 months). Criterion C: Not attributable to medical condition, substance use, or medication (discontinuation of psychiatric meds led to decompensation). Criterion D: Functional decline evident across work, social, self-care. Criterion E: Symptoms not attributable to another diagnosis or cultural factor.",
      "criteria_met": [
        {"criterion": "A_characteristic_symptoms", "met": true},
        {"criterion": "B_duration", "met": true},
        {"criterion": "C_exclusions", "met": true},
        {"criterion": "D_functional_decline", "met": true},
        {"criterion": "E_not_attributable_to_other", "met": true}
      ],
      "evidence_sources": [
        "interview_data.session_001.narrative_notes",
        "interview_data.mse.perception",
        "testing/scores/mmpi3_scores.json",
        "collateral/mother_interview.json"
      ]
    },
    {
      "position": 2,
      "icd_code": "F43.21",
      "diagnosis_name": "Adjustment Disorder with Depressed Mood",
      "confirmed_by": "Dr. Truck Irwin",
      "confirmed_timestamp": "2026-03-22T15:50:00Z",
      "clinical_justification": "Patient demonstrates depressive symptoms (anhedonia, sadness, reduced engagement in activities) in response to legal charges and pending trial. Onset closely related to awareness of legal consequences. Meets DSM-5-TR criteria for Adjustment Disorder. Secondary diagnosis to Schizophrenia but important for comprehensive treatment planning.",
      "criteria_met": [...]
    }
  ],

  "ruled_out_diagnoses": [
    {
      "icd_code": "F32.1",
      "diagnosis_name": "Major Depressive Disorder, Moderate",
      "ruled_out_by": "Dr. Truck Irwin",
      "ruled_out_timestamp": "2026-03-22T15:35:00Z",
      "reasoning": "While patient exhibits some depressive symptoms (anhedonia, sleep disturbance), these are secondary to acute psychotic illness. Primary symptoms are psychotic (auditory hallucinations, delusions), not mood symptoms. MDD would be primary diagnosis if mood symptoms were predominant. Schizophrenia diagnosis accounts for full symptom picture more parsimoniously."
    },
    {
      "icd_code": "F20.81",
      "diagnosis_name": "Schizophreniform Disorder",
      "ruled_out_by": "Dr. Truck Irwin",
      "ruled_out_timestamp": "2026-03-22T15:40:00Z",
      "reasoning": "Schizophreniform duration is 1 month to 6 months. Patient's symptoms have been present for approximately 3+ months (prodromal period), meeting criteria for Schizophrenia (>6 months including prodrome and active phase). Additionally, patient's prior hospitalization for psychotic disorder and relapse upon medication discontinuation indicates chronic schizophrenic process rather than brief schizophreniform presentation."
    }
  ],

  "deferred_diagnoses": [
    {
      "icd_code": "F21",
      "diagnosis_name": "Schizotypal Personality Disorder",
      "deferred_by": "Dr. Truck Irwin",
      "deferred_timestamp": "2026-03-22T15:45:00Z",
      "reasoning": "Schizotypal Personality Disorder requires assessment of longstanding (since early adulthood) pattern of magical thinking, unusual beliefs, perceptual distortions in non-psychotic context. Currently, patient's odd beliefs and perceptual experiences are attributable to active psychosis. Personality assessment cannot be reliably conducted during acute psychotic episode. Recommend reassessment 6+ months post-psychiatric stabilization.",
      "needed_for_decision": "Reassessment after psychiatric stabilization. Personality testing (e.g., MMPI-3 PT scale) in non-psychotic state. Longitudinal history from collateral sources regarding personality traits in pre-psychotic periods."
    }
  ],

  "clinical_opinion": {
    "opinion_type": "cst_competency",
    "opinion_text": "Marcus Johnson is a 34-year-old male referred by the Public Defender's Office for competency-to-stand-trial evaluation regarding charges of Assault 2 and Menacing. He presents with Schizophrenia, Paranoid Type in acute exacerbation, complicated by Adjustment Disorder with Depressed Mood secondary to legal consequences.\n\nMR. JOHNSON'S MENTAL STATUS:\nMr. Johnson meets full DSM-5-TR criteria for Schizophrenia, Paranoid Type. He experiences command auditory hallucinations directing him to harm others, and persecutory delusions centered on beliefs that neighbors and legal system officials are conspiring against him. These symptoms began approximately 2-3 weeks ago following discontinuation of psychiatric medications he had been taking since a prior hospitalization in 2022 for psychotic episodes.\n\nPSYCHOLOGICAL TESTING:\nPsychological testing reveals a valid MMPI-3 profile with marked elevations on Paranoia (T=85, 99th percentile), Psychasthenia (T=78, 98th percentile), and other scales consistent with active psychosis. PAI results similarly support significant psychotic symptoms. Validity testing (TOMM, SIRS-2) indicates full effort and genuine psychiatric presentation (not malingering). Test data coherently supports clinical impression of Schizophrenia.\n\nCOMPETENCY ASSESSMENT (DUSKY STANDARD):\nUnder the Dusky v. United States (1960) standard, competency requires: (1) factual understanding of charges and trial process, (2) rational understanding of charges in context of one's situation, and (3) ability to assist counsel.\n\nElement 1 - Factual Understanding: ADEQUATE\nMr. Johnson can accurately state his charges (Assault 2, Menacing), name his attorney (Sarah Mitchell), and describe general trial process. He demonstrates adequate factual understanding.\n\nElement 2 - Rational Understanding: SEVERELY IMPAIRED\nMr. Johnson's paranoid delusions prevent rational understanding of the legal proceedings. He believes the judge and prosecutor are \"working together\" against him and that his attorney may be \"helping them.\" He cannot rationally understand that the court is a neutral forum designed to determine guilt or innocence. His paranoia fundamentally compromises his ability to rationally apprehend how legal proceedings apply to him.\n\nElement 3 - Ability to Assist Counsel: MARKEDLY IMPAIRED\nMr. Johnson's paranoia toward his own attorney, combined with intrusive command hallucinations and perceptual distortions, prevents him from coherently participating in his defense. He would be unable to reliably communicate with counsel, participate in trial preparation, or testify coherently.\n\nCOMPETENCY CONCLUSION:\nMr. Johnson is NOT COMPETENT to stand trial as currently presenting. His acute psychotic illness directly and substantially impairs all three Dusky elements, particularly rational understanding and ability to assist counsel.\n\nRESTORATION POTENTIAL:\nMr. Johnson has favorable prognosis for competency restoration. His psychosis is acute-onset, medication-responsive (prior successful treatment in 2022), and attributable to medication non-compliance. With psychiatric stabilization via antipsychotic medication and inpatient treatment, he could be expected to regain competency within 4-8 weeks.\n\nRECOMMENDATIONS:\n1. Commitment for inpatient psychiatric evaluation and treatment\n2. Trial of antipsychotic medication (consider continuation of prior effective medication if possible)\n3. Psychiatric stabilization for 4-8 weeks minimum\n4. Follow-up competency evaluation after acute symptom remission\n5. If competency is restored, consider structured re-education on legal process, given his paranoid concerns about system bias",
    "written_by": "Dr. Truck Irwin, Psy.D., ABPP",
    "written_timestamp": "2026-03-22T16:00:00Z",
    "revision_number": 1,
    "word_count": 1247
  },

  "audit_trail": [
    {
      "timestamp": "2026-03-22T14:30:00Z",
      "action": "case_advanced_to_diagnostics",
      "details": {"from_stage": "Interview"}
    },
    {
      "timestamp": "2026-03-22T14:35:00Z",
      "action": "validity_assessment_reviewed",
      "details": {"decision": "accepted", "clinician": "Dr. Truck Irwin"}
    },
    {
      "timestamp": "2026-03-22T15:30:00Z",
      "action": "diagnosis_confirmed",
      "details": {"code": "F20.0", "clinician": "Dr. Truck Irwin"}
    },
    ... (full diagnostic audit trail)
  ]
}
```

### 14.2 evidence_matrix.json

The complete Diagnostician Agent response (re-hydrated):

```json
{
  "generated_timestamp": "2026-03-22T14:50:00Z",
  "case_number": "2026-0147",
  "operation_id": "op_diagnostics_20260322_145000",
  "redaction_status": "re-hydrated_and_unid_map_destroyed",

  "validity_assessment": {
    "effort_tests": [
      {"test_name": "TOMM", "status": "pass", "impact_on_interpretability": "Full"},
      {"test_name": "SIRS-2", "status": "pass", "impact_on_interpretability": "Full"}
    ],
    "mmpi3_validity": {
      "overall_validity": "Valid",
      "validity_scales": {
        "vrin_t": {"score": 48, "status": "acceptable"},
        "trin_t": {"score": 52, "status": "acceptable"},
        "f": {"score": 65, "status": "elevated_consistent_with_psychosis"},
        "fs": {"score": 70, "status": "elevated_consistent_with_psychosis"}
      },
      "interpretation_impact": "All clinical scales fully interpretable. Elevations on F and Fs consistent with genuine psychotic symptoms."
    },
    "summary": "Test battery is fully interpretable. No evidence of malingering or effort problems."
  },

  "diagnostic_evidence_map": {
    "f20_0_schizophrenia_paranoid": {
      "icd_code": "F20.0",
      "status": "evidence_presented",
      "criteria_analysis": {
        "criterion_a": {
          "description": "Two or more characteristic symptoms: hallucinations, delusions, disorganized speech/behavior, negative symptoms, cognitive symptoms",
          "met_status": "met",
          "supporting_evidence": [
            {
              "source": "interview_narrative",
              "evidence": "Patient reports 'voices commanding him to harm others' and 'beliefs that neighbors are conspiring'",
              "strength": "strong"
            },
            {
              "source": "mse_observation",
              "evidence": "Clinician observed patient stopping mid-sentence to listen, consistent with auditory hallucinations",
              "strength": "strong"
            },
            {
              "source": "mmpi3_paranoia_scale",
              "evidence": "T-score 85 (99th percentile), supporting paranoid ideation",
              "strength": "moderate"
            }
          ],
          "contradicting_evidence": [],
          "source_citations": [
            "interview_data.session_001.narrative_notes[line 45-67]",
            "interview_data.mse.perception[line 12-18]",
            "testing/scores/mmpi3_scores.json"
          ]
        },
        ... (all criteria A, B, C, D, E)
      },
      "onset_and_course": "Acute onset 2-3 weeks ago, preceded by 2+ months of prodromal symptoms (social withdrawal, suspiciousness). Precipitated by discontinuation of psychiatric medications.",
      "functional_impact": "Explains acute behavioral incident (assault charges). Accounts for observed paranoia, hallucinations, disorganized behavior.",
      "probability_estimate": "Not used for diagnosis selection — informational only"
    },
    ... (20+ more potential diagnoses)
  },

  "differential_comparisons": [
    {
      "diagnosis_pair": "Schizophrenia vs. Schizoaffective Disorder",
      "key_distinguishing_features": [
        {
          "feature": "Mood episode prominence",
          "evidence_for_diagnosis_1": "Mood symptoms (anhedonia, depressed mood) are secondary to and minor compared to psychotic symptoms",
          "evidence_for_diagnosis_2": "No prominent mood episode meeting full criterion. Brief depressive reaction to legal charges does not constitute major depressive episode."
        }
      ],
      "clinical_clarification": "Patient's presentation aligns with Schizophrenia. Mood features are secondary to psychosis."
    }
  ],

  "psycholegal_analysis": {
    "legal_standard": "Dusky v. United States (1960)",
    "jurisdiction": "Colorado District Court",
    "standard_elements": [
      {
        "element": "Factual understanding of charges, court process, consequences",
        "evidence_map": [
          {
            "support": "Patient accurately names charges and describes trial process",
            "source": "interview_competency_questions"
          },
          {
            "contradiction": "Patient's paranoia may affect confidence in system despite factual knowledge",
            "source": "interview_paranoia_content"
          }
        ]
      },
      {
        "element": "Rational understanding (in context of self)",
        "evidence_map": [
          {
            "support": null,
            "contradiction": "Patient's belief that judge and prosecutor are 'conspiring' prevents rational understanding",
            "source": "interview_narrative"
          }
        ]
      },
      {
        "element": "Ability to assist counsel",
        "evidence_map": [
          {
            "support": null,
            "contradiction": "Patient expresses paranoia toward attorney and has command hallucinations",
            "source": "interview_narrative, mse"
          }
        ]
      }
    ],
    "critical_gaps": "No formal competency assessment instrument administered (MacCAT-CA recommended). No structured evaluation of medication response potential.",
    "clinical_findings_applicable_to_legal_standard": "Patient's Schizophrenia, Paranoid Type with active command hallucinations and persecutory delusions directly impairs Dusky elements, particularly rational understanding and ability to assist counsel."
  }
}
```

---

## 15. Summary: Stage 3 Guardrails and Principles

### The Architecture Enforces THE DOCTOR ALWAYS DIAGNOSES

Every architectural layer in Stage 3 is designed to enforce that the clinician — and only the clinician — makes diagnostic decisions:

| Layer | Enforcement |
|-------|------------|
| **UI** | No "Accept All" button. Every diagnosis requires individual action (Confirm/Rule Out/Defer). |
| **IPC** | No channel to auto-select diagnoses. Clinician input channels only. |
| **Data Model** | Every confirmed diagnosis has `clinician_name` and `timestamp`. No batch operations. |
| **Audit Trail** | Every diagnostic action is logged separately. Cannot bulk-confirm 10 diagnoses in one audit entry. |
| **Agent Behavior** | Agent status is always `"evidence_presented"`, never `"recommended"`. Agent output is passive (evidence), not directive. |
| **Storage** | Diagnostic formulation is separate from evidence map. Clinician decisions are authoritative; AI evidence is supporting. |

### Legal Defensibility

Stage 3's architecture produces an audit trail that survives Daubert scrutiny:

1. **Clinician's independent deliberation is documented** — For each diagnosis, there's a timestamp, clinician name, and explicit decision (Confirm/Rule Out/Defer)
2. **Clinical justification is required** — When confirming, the clinician writes why. This becomes testimony-ready reasoning.
3. **AI evidence is presented, not recommended** — The Diagnostician Agent is a research tool, not a decision-maker.
4. **The clinician can disagree** — The UI allows ruling out every AI-presented diagnosis and adding clinician-originated diagnoses.
5. **Deferred diagnoses are explicit** — If data is insufficient, the clinician documents what's needed and can go back for more data.

### Clinical Validity

Stage 3 acknowledges that diagnosis is a clinical judgment, not a technical output:

- The clinician has spent hours with the patient (interviews, testing, observation)
- The clinician has embodied knowledge of the patient's presentation
- The clinician can weigh evidence that the AI cannot access (clinical intuition, subtle behavioral observations, contextual understanding)
- The AI's job is to organize the evidence systematically; the clinician's job is to decide

---

## End of Stage 3 Specification

**Version 1.0 — March 22, 2026**
**Status:** Production-Ready
**Next Document:** Stage 4 (Review) Specification — forthcoming
