# Stage 1: Testing — Production Specification
## Psygil — Forensic Psychology Evaluation Platform

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Production Specification
**References:** Case Lifecycle Spec (doc 18), Agent Prompt Specs (doc 03), UNID Redaction Architecture (doc 15), Case Directory Schema (doc 16), IPC API Contracts (doc 02)

---

## Executive Overview

**Stage 1: Testing** is where the clinician selects, administers, scores, and validates the psychological test battery that forms the clinical foundation of the evaluation. This stage is clinically critical because:

- **Validity determines interpretability.** Tests administered to a patient who is feigning, not engaged, or unable to perform produce uninterpretable results. The Testing stage is where the clinician confirms validity or flags concerns.
- **Scores anchor diagnosis.** All subsequent diagnostic decisions in Stage 3 rely on validated test results. Invalid or incomplete test data cascades into the entire evaluation.
- **Forensic defensibility starts here.** The test battery selection, administration documentation, score import procedures, and validity assessment are the first targets in cross-examination. This stage must be bulletproof.

This specification covers every sub-step within Testing: battery selection, administration tracking, score import, validity assessment, and clinician review.

---

## Entry Conditions

A case enters Stage 1: Testing when:
1. Intake form is complete (all required fields)
2. Informed consent is on file (signed or draft)
3. At least one referral question is documented
4. Clinician clicks "Advance to Testing" OR administers the first test (auto-advances)

**Application behavior:**
- Directory `testing/` is created on disk (if not present)
- Subdirectories created: `testing/scores/`, `testing/imports/`, `testing/validity/`
- Case status in SQLCipher changes to `"Testing"` (purple indicator in UI)
- Audit trail logged: `"Case advanced to Testing"`

---

## Step 1.1: Test Battery Selection

### Purpose
The clinician selects which standardized psychological instruments to administer based on:
- The evaluation type (CST, Custody, Risk Assessment, PTSD, etc.)
- The specific referral questions
- The patient's clinical presentation
- The clinician's professional judgment

### Clinical Context
**Eval-Type-Specific Recommended Batteries:**

| Evaluation Type | Recommended Core Battery | Optional/Additional | Validity Instruments | Notes |
|---|---|---|---|---|
| **CST** (Competency to Stand Trial) | MMPI-3, PAI, WAIS-V | CVLT-II, Trail Making A/B | TOMM, SIRS-2, M-FAST | Malingering risk high; cognitive capacity critical |
| **Custody** | MMPI-3, MCMI-IV, PSI (Parent Stress Index) | Structured parenting interview, MMPI-A (if minor) | SIRS-2 (if substance abuse concerns) | Feigning risk moderate; personality stability relevant |
| **Risk Assessment** | PAI, HCR-20v3, Static-99R (if applicable), PCL-R | Structured violence risk interviews | SIRS-2, Brief Screen (malingering) | Actuarial instruments standard; clinical judgment documented |
| **PTSD** (non-litigant) | CAPS-5, PCL-5, MMPI-3 | CTQ (trauma history), SCID-5-CT | Brief malingering screen if litigation involved | Clinician-administered (CAPS-5) requires training |
| **PTSD (forensic)** | CAPS-5, PCL-5, MMPI-3 | CTQ, symptom validity tests | TOMM, SIRS-2 mandatory (feigning risk) | See Custody + PTSD requirements |
| **Insanity (PSI)** | MMPI-3, PAI, WAIS-V | CVLT-II, MSE-based cognition | TOMM, SIRS-2 | Cognitive + personality + malingering documentation required |
| **Disability** | WAIS-V or WISC-V, WMS-IV, CVLT-II | Academic screening (WJ-IV ACH) | TOMM (if litigated) | Cognitive specificity critical; state law variation |
| **Child Custody** | MMPI-A (age 14+), Structured observations | Parenting interviews, attachment-based measures | Validity depends on age/instrument | Age-appropriate instrument selection essential |

### Implementation: Battery Selection UI

**Step 1.1.1: Clinician Initiates Battery Selection**

1. Clinician opens case → clicks "Testing" in the case pipeline or Clinical Overview
2. UI displays:
   - **Evaluation type** (read-only, from intake)
   - **Recommended battery** for this eval type (displayed as suggestions, not requirements)
   - **Clinician's instrument library** (configured during Setup — doc 17)
   - **Selected instruments list** (starts empty)

**Step 1.1.2: Add Instruments to Battery**

1. Clinician searches/browses their configured instruments
2. For each instrument, UI shows:
   - Instrument name
   - Publisher
   - Administration format (paper vs. computer-based)
   - Scoring method (publisher vs. manual)
   - Validity flags (if known to be validity-relevant)
3. Clinician clicks "Add to Battery"
4. Instrument appears in selected list with:
   - Optional notes (e.g., "MMPI-3 computer-based via Q-global")
   - Status: "Not Administered"
   - Placeholder: `testing/scores/{instrument}_scores.json` (empty, awaiting scores)

**Step 1.1.3: AI Writing Assistant Optional Input**

If enabled, clinician can request:
- "Suggest instruments for a CST case with substance abuse concerns"
- "Is PAI or MMPI-3 better for this forensic custody case?"

The Writing Assistant (Column 3 chat):
- Provides peer-reviewed literature recommendations
- Never mandates an instrument
- Responds to the eval type + referral questions + clinician notes
- Example: "For CST with these charges and this history, literature supports MMPI-3 + PAI + WAIS-V + TOMM. Consider adding SIRS-2 given the substance abuse history."

**CRITICAL: The clinician is the decision-maker.** The AI provides information only.

**Step 1.1.4: Save Battery Configuration**

1. Clinician clicks "Finalize Battery"
2. Application validates:
   - At least one instrument selected (soft requirement; warning if none, but case can proceed)
   - No duplicate instruments in the battery
3. Battery saved to `testing/testing_summary.json`:

```json
{
  "caseNumber": "2026-0147",
  "evalType": "CST",
  "batteryCreatedDate": "2026-03-10T10:15:00Z",
  "batteryFinalizedDate": "2026-03-10T10:30:00Z",
  "instruments": [
    {
      "instrumentId": "mmpi3",
      "name": "MMPI-3",
      "publisher": "Pearson",
      "administrationFormat": "computer-based",
      "administrationPlatform": "Q-global",
      "scoringMethod": "publisher-automated",
      "validityRelevant": true,
      "notes": "Computer version, administered at office",
      "selectedDate": "2026-03-10T10:15:00Z",
      "status": "NotAdministered",
      "scoresImportedDate": null,
      "clinicianReviewedDate": null
    },
    {
      "instrumentId": "pai",
      "name": "PAI (Personality Assessment Inventory)",
      "publisher": "PAR",
      "administrationFormat": "paper",
      "administrationPlatform": null,
      "scoringMethod": "manual",
      "validityRelevant": true,
      "notes": "Paper form, hand-scored",
      "selectedDate": "2026-03-10T10:15:00Z",
      "status": "NotAdministered",
      "scoresImportedDate": null,
      "clinicianReviewedDate": null
    },
    {
      "instrumentId": "waisv",
      "name": "WAIS-V",
      "publisher": "Pearson",
      "administrationFormat": "in-person",
      "administrationPlatform": null,
      "scoringMethod": "manual",
      "validityRelevant": false,
      "notes": "In-person administration, manual scoring",
      "selectedDate": "2026-03-10T10:15:00Z",
      "status": "NotAdministered",
      "scoresImportedDate": null,
      "clinicianReviewedDate": null
    },
    {
      "instrumentId": "tomm",
      "name": "TOMM (Test of Memory Malingering)",
      "publisher": "Psychological Assessment Resources",
      "administrationFormat": "in-person",
      "administrationPlatform": null,
      "scoringMethod": "manual",
      "validityRelevant": true,
      "notes": "Standalone validity instrument",
      "selectedDate": "2026-03-10T10:15:00Z",
      "status": "NotAdministered",
      "scoresImportedDate": null,
      "clinicianReviewedDate": null
    },
    {
      "instrumentId": "sirs2",
      "name": "SIRS-2 (Structured Interview of Reported Symptoms-2)",
      "publisher": "Psychological Assessment Resources",
      "administrationFormat": "in-person",
      "administrationPlatform": null,
      "scoringMethod": "manual",
      "validityRelevant": true,
      "notes": "Malingering interview-based validity",
      "selectedDate": "2026-03-10T10:15:00Z",
      "status": "NotAdministered",
      "scoresImportedDate": null,
      "clinicianReviewedDate": null
    }
  ],
  "batteryNotes": "Standard CST battery with emphasis on malingering detection given substance abuse allegations",
  "clinicianName": "Dr. Truck Irwin",
  "status": "Finalized"
}
```

4. For each instrument in the battery, app creates a placeholder:
   - `testing/scores/{instrument_id}_scores.json` (empty, with schema comment)
   - Status field in `testing_summary.json` set to `"NotAdministered"`

5. Audit trail logged: `"Test battery finalized: [instruments]. Clinician: [name]."`

---

## Step 1.2: Test Administration

### Critical Principle: Outside the Application

**Psygil does NOT administer tests.** The clinician administers tests in the real world using one of three modalities:

1. **Paper-based** — Patient completes form with pencil/pen; clinician hand-scores
2. **Computer-based (publisher platform)** — Patient takes test via Q-global, PARiConnect, CNS Vital Signs, etc.; clinician retrieves score report from publisher
3. **Local testing software** — Patient takes test via office-based software; clinician exports results

### Implementation: Administration Tracking

The application provides minimal support for tracking administration, because the clinician owns this process:

**UI: Testing Status Dashboard**

```
Battery Status
├─ MMPI-3         [Not Administered] → [Schedule] [Admin Notes]
├─ PAI            [Not Administered] → [Schedule] [Admin Notes]
├─ WAIS-V         [Administered]     → [Date: 2026-03-12] [Notes: Patient cooperative]
├─ TOMM           [Not Administered] → [Schedule] [Admin Notes]
└─ SIRS-2         [Not Administered] → [Schedule] [Admin Notes]
```

For each instrument, clinician can:
1. Set administration status to "Administering" or "Administered"
2. Add notes: date, session duration, patient behavior, administration platform
3. Flag issues: "Patient fatigued, unable to complete WAIS-V subtests 7-11"

These notes are stored in `testing/testing_summary.json` as a `sessions` array:

```json
{
  "instrumentId": "waisv",
  "administrationSessions": [
    {
      "sessionDate": "2026-03-12",
      "sessionDuration": 90,
      "administrator": "Dr. Truck Irwin",
      "administrationFormat": "in-person",
      "notes": "Patient cooperative, alert, engaged throughout",
      "subtestsAdministered": ["Block Design", "Similarities", "Digit Span", "Matrix Reasoning", "Vocabulary", "Arithmetic", "Symbol Search", "Visual Puzzles", "Comprehension", "Letter-Number Sequencing"],
      "subtestsOmitted": [],
      "behavioralNotes": "Patient appeared motivated. No signs of fatigue or distress. Performance consistent with expected range for education level."
    }
  ]
}
```

### Role Permissions

**Psychometrist Access (if multi-provider practice):**
- Can mark tests as "Administering"
- Can add administration notes
- CANNOT access or view scores until clinician imports them
- CANNOT advance the case to the next stage

**Clinician Access:**
- Can view all administration notes
- Can import scores
- Can advance to next stage

---

## Step 1.3: Score Import

### Entry Point
Clinician has completed test administration, received score reports from publisher or manually scored tests, and is ready to import scores into the case.

### Two Import Pathways

#### Pathway A: Publisher Export Import (Q-global, PARiConnect, etc.)

**What the clinician does:**
1. Logs into publisher platform (Q-global, PARiConnect, CNS Vital Signs, etc.)
2. Navigates to the patient's completed test
3. Downloads the score report as PDF
4. Saves locally (or uses browser download folder)

**What happens in Psygil:**

**Step 1.3.1: Clinician Initiates Import**
1. Opens case → Testing section
2. Clicks "Import Scores" → "From Publisher Export"
3. Dialog prompts: "Select PDF file" or "Drag and drop file here"
4. Selects the publisher PDF (e.g., `MMPI3_Report_2026-03-12.pdf`)

**Step 1.3.2: Ingestor Agent Parses PDF (UNID Pipeline)**

The PDF is sent through the UNID redaction pipeline:

1. **Redaction:** All PHI in the PDF (patient name, DOB, case number if present) is replaced with UNIDs
2. **Transmission:** Redacted PDF text sent to the **Ingestor Agent**
3. **Parsing:** Ingestor Agent extracts:
   - Instrument name (e.g., "MMPI-3")
   - Administration date
   - Raw scores
   - Scaled scores / T-scores / Percentiles (varies by instrument)
   - Validity indicators (instrument-specific)
   - Publisher interpretive text (e.g., "Moderate elevation on Depression scale")
4. **Output:** Structured JSON with all extracted scores
5. **Re-hydration:** UNIDs replaced with real PHI (dates, demographics)
6. **Map destruction:** UNID map discarded

**Step 1.3.3: Validation & Storage**

1. Application validates extracted scores against the instrument's expected ranges:
   - MMPI-3 T-scores: 30-100 (flag if outside)
   - PAI raw/T-scores: validate per scale
   - WAIS-V scaled scores: 1-19 (flag if outside)
   - TOMM: Trial 1 (0-50), Trial 2 (0-50), Retention (0-50) — typically pass/fail cutoff at 45
   - SIRS-2: Classified as pass/fail on multiple scales

2. **Validity indicators automatically extracted and flagged:**
   - MMPI-3: VRIN-T, TRIN-T, F, Fp, Fs, L, K (all extracted)
   - PAI: NIM (Negative Impression Mgmt), PIM (Positive Impression Mgmt), ICN (Inconsistency)
   - TOMM: Pass/Fail status (typically Fail = < 45 on Trial 2 or Retention)
   - SIRS-2: Scales extracted; Genuine/Probable Feigning/Definite Feigning classification

3. Scores saved to `testing/scores/{instrument_id}_scores.json`:

```json
{
  "instrumentId": "mmpi3",
  "instrumentName": "MMPI-3",
  "publisher": "Pearson",
  "administrationDate": "2026-03-12",
  "importDate": "2026-03-12T15:30:00Z",
  "importMethod": "publisher_export_pdf",
  "importSource": "Q-global",
  "sourceFile": "testing/imports/MMPI3_2026-03-12_Pearson.pdf",
  "clinicalScales": {
    "ANX": {
      "rawScore": 24,
      "tScore": 65,
      "percentile": 93,
      "classification": "Elevated"
    },
    "FRS": {
      "rawScore": 18,
      "tScore": 58,
      "percentile": 79,
      "classification": "Moderate"
    },
    "OBS": {
      "rawScore": 14,
      "tScore": 52,
      "percentile": 58,
      "classification": "Average"
    },
    "DEP": {
      "rawScore": 22,
      "tScore": 68,
      "percentile": 97,
      "classification": "Significantly elevated"
    },
    "HLT": {
      "rawScore": 20,
      "tScore": 62,
      "percentile": 88,
      "classification": "Elevated"
    },
    "BIZ": {
      "rawScore": 8,
      "tScore": 48,
      "percentile": 45,
      "classification": "Average"
    },
    "ANG": {
      "rawScore": 19,
      "tScore": 62,
      "percentile": 88,
      "classification": "Elevated"
    },
    "CYN": {
      "rawScore": 16,
      "tScore": 56,
      "percentile": 73,
      "classification": "Average to Moderate"
    },
    "ASP": {
      "rawScore": 17,
      "tScore": 61,
      "percentile": 86,
      "classification": "Elevated"
    },
    "TPA": {
      "rawScore": 14,
      "tScore": 54,
      "percentile": 65,
      "classification": "Average"
    },
    "LSE": {
      "rawScore": 21,
      "tScore": 71,
      "percentile": 98,
      "classification": "Significantly elevated"
    },
    "SOD": {
      "rawScore": 18,
      "tScore": 66,
      "percentile": 95,
      "classification": "Elevated"
    },
    "FAM": {
      "rawScore": 12,
      "tScore": 55,
      "percentile": 70,
      "classification": "Average"
    },
    "WRK": {
      "rawScore": 19,
      "tScore": 69,
      "percentile": 97,
      "classification": "Significantly elevated"
    },
    "TRT": {
      "rawScore": 11,
      "tScore": 50,
      "percentile": 50,
      "classification": "Average"
    }
  },
  "validityIndicators": {
    "VRINT": {
      "rawScore": 8,
      "tScore": 50,
      "percentile": 50,
      "interpretation": "Valid"
    },
    "TRINT": {
      "rawScore": 5,
      "tScore": 48,
      "percentile": 45,
      "interpretation": "Valid"
    },
    "F": {
      "rawScore": 12,
      "tScore": 55,
      "percentile": 70,
      "interpretation": "Valid"
    },
    "Fp": {
      "rawScore": 4,
      "tScore": 48,
      "percentile": 45,
      "interpretation": "Valid"
    },
    "Fs": {
      "rawScore": 3,
      "tScore": 45,
      "percentile": 35,
      "interpretation": "Valid"
    },
    "L": {
      "rawScore": 6,
      "tScore": 52,
      "percentile": 58,
      "interpretation": "Valid"
    },
    "K": {
      "rawScore": 14,
      "tScore": 54,
      "percentile": 65,
      "interpretation": "Average"
    }
  },
  "supItems": {
    "PS": {
      "rawScore": 28,
      "tScore": 61,
      "percentile": 86
    },
    "HPI": {
      "rawScore": 25,
      "tScore": 68,
      "percentile": 97
    },
    "RC1": {
      "rawScore": 4,
      "tScore": 46,
      "percentile": 38
    },
    "RC4": {
      "rawScore": 8,
      "tScore": 58,
      "percentile": 79
    }
  },
  "status": "Scored",
  "clinicianReviewStatus": "NotReviewed",
  "completeness": "complete",
  "flagsForReview": []
}
```

4. Publisher PDF stored for audit trail: `testing/imports/MMPI3_2026-03-12_Pearson.pdf`

5. Audit trail logged: `"Scores imported for MMPI-3 from Q-global. Method: publisher_export_pdf. Date: 2026-03-12. Status: Scored."`

---

#### Pathway B: Manual Score Entry

For paper-administered tests or when the publisher export is unavailable, clinician enters scores directly.

**Step 1.3.4: Manual Scoring Form**

1. Clinician clicks "Import Scores" → "Manual Entry"
2. Selects instrument from battery
3. UI displays a structured scoring form specific to that instrument

**Example: MMPI-3 Manual Scoring Form**

```
[Instrument: MMPI-3]
[Administration Date: ____] [Administrator: ____]

CLINICAL SCALES
ANX (Anxiety)       Raw: ____ [expected 0-42] T-Score: ____ [calc'd from table]
FRS (Fears)         Raw: ____ [expected 0-39]
OBS (Obsessiveness) Raw: ____ [expected 0-32]
DEP (Depression)    Raw: ____ [expected 0-42]
...

VALIDITY INDICATORS
VRIN-T              T: ____ [expected 30-100]
TRIN-T              T: ____ [expected 30-100]
F                   T: ____ [expected 30-100]
Fp                  T: ____ [expected 30-100]
Fs                  T: ____ [expected 30-100]
L                   T: ____ [expected 30-100]
K                   T: ____ [expected 30-100]

[Submit Scores] [Cancel]
```

2. As the clinician enters each score, the application:
   - Validates against expected range (red highlight if out of range)
   - Auto-calculates T-scores and percentiles from lookup tables
   - Displays immediately below raw entry

3. On "Submit Scores":
   - Validates all required fields completed
   - Stores in `testing/scores/{instrument}_scores.json` (same format as Pathway A)
   - Audit trail: `"Scores entered manually for MMPI-3. Date: [date]. Entered by: [clinician]."`

---

### Validity Auto-Check (Integrated)

As scores are imported or entered, the application automatically identifies validity-relevant information:

**Step 1.3.5: Validity Extraction**

1. **Standalone Validity Instruments:**
   - TOMM: Extract Trial 1, Trial 2, Retention scores → compare to cutoff (typically 45); classification: **Pass** or **Fail**
   - SIRS-2: Extract all scale scores → apply scoring rules → classification: **Genuine** / **Probable Feigning** / **Definite Feigning**
   - M-FAST: Extract total scores → compare to cutoff
   - VSVT (Victoria Symptom Validity Test): Extract pass/fail classification

2. **Embedded Validity Scales:**
   - MMPI-3: Extract VRIN-T, TRIN-T, F, Fp, Fs, L, K → compare to publisher cutoffs
   - PAI: Extract NIM, PIM, ICN → compare to cutoffs
   - MCMI-IV: Extract validity scales (Modifying Indices)
   - PARiConnect instruments: Apply instrument-specific validity rules

3. **Summary Stored** in `testing/validity/validity_summary.json`:

```json
{
  "caseNumber": "2026-0147",
  "evaluationType": "CST",
  "validityAssessmentDate": "2026-03-12T15:45:00Z",
  "overallValidityStatus": "adequate",
  "standaloneValidityInstruments": [
    {
      "instrumentName": "TOMM",
      "trialOneScore": 48,
      "trialTwoScore": 47,
      "retentionScore": 49,
      "cutoff": 45,
      "classification": "PASS",
      "interpretation": "Performance is consistent with genuine memory impairment. No indication of malingering."
    },
    {
      "instrumentName": "SIRS-2",
      "scales": {
        "SOM": 3,
        "NCP": 2,
        "CVL": 1,
        "COM": 1,
        "BL": 2,
        "SU": 2
      },
      "totalScore": 11,
      "classification": "GENUINE",
      "interpretation": "Symptom report is consistent with actual experiencing of reported symptoms."
    }
  ],
  "embeddedValidityScales": {
    "MMPI3": {
      "VRINT": {
        "tScore": 50,
        "cutoff": 79,
        "status": "VALID"
      },
      "TRINT": {
        "tScore": 48,
        "cutoff": 80,
        "status": "VALID"
      },
      "F": {
        "tScore": 55,
        "cutoff": 100,
        "status": "VALID"
      },
      "Fp": {
        "tScore": 48,
        "cutoff": 75,
        "status": "VALID"
      },
      "Fs": {
        "tScore": 45,
        "cutoff": 90,
        "status": "VALID"
      },
      "L": {
        "tScore": 52,
        "cutoff": 70,
        "status": "VALID"
      },
      "K": {
        "tScore": 54,
        "cutoff": null,
        "status": "INTERPRETABLE (no cutoff for K)"
      }
    }
  },
  "flagsTriggered": [],
  "concernsIdentified": [],
  "clinicianNeedAction": false
}
```

4. **Red Flags Triggering Clinician Alert:**

| Flag | Trigger | Display |
|------|---------|---------|
| Possible Feigning | SIRS-2 "Probable" or "Definite" | Yellow banner: "Validity concern detected. SIRS-2 classification suggests possible symptom overreporting." |
| Inconsistent Responding | MMPI-3 VRIN-T or TRIN-T elevated | Yellow banner: "Response consistency concern. VRIN-T elevated; review response pattern." |
| Invalid Profile | PAI NIM extremely elevated (>T120) | Red banner: "Extreme invalidity indicator detected. Profile may not be interpretable." |
| Multiple Concerns | 2+ validity issues across instruments | Red banner: "Multiple validity concerns identified. Review before interpreting clinical scales." |

---

## Step 1.4: Validity Assessment

### Clinical Significance

Validity assessment is the **gate** between raw scores and interpretation. A test with poor validity produces uninterpretable results, which cascade into invalid diagnoses, indefensible opinions, and failed cross-examinations.

**Three possible validity outcomes:**
1. **Valid/Adequate** — Scores can be interpreted; no concerns
2. **Questionable** — Scores can be interpreted with caution; document concerns
3. **Invalid/Uninterpretable** — Scores cannot be interpreted; do not use for diagnosis

### Implementation: Clinician Validity Review

**Step 1.4.1: Automatic Summary Generation**

After all scores for a test are imported, the application:
1. Compiles all validity indicators (standalone + embedded) into a summary
2. Applies standardized cutoffs per publisher guidelines
3. Generates a **Validity Summary** for that instrument (see sample in 1.3.5 above)

**Step 1.4.2: Clinician Reviews Validity**

Clinician opens the case → Testing section → "Validity Review"

UI displays for each instrument:
```
MMPI-3
├─ Status: Scored
├─ Validity Indicators:
│  ├─ VRIN-T: T=50 [VALID]
│  ├─ TRIN-T: T=48 [VALID]
│  ├─ F: T=55 [VALID]
│  └─ [All indicators VALID]
├─ Overall: VALID — No validity concerns
└─ [Mark as Reviewed] [Edit Notes] [Request Rescore]

TOMM
├─ Status: Scored
├─ Results:
│  ├─ Trial 1: 48 [PASS]
│  ├─ Trial 2: 47 [PASS]
│  └─ Retention: 49 [PASS]
├─ Overall: PASS — Performance consistent with genuine memory concerns
└─ [Mark as Reviewed] [Edit Notes]

SIRS-2
├─ Status: Scored
├─ Classification: GENUINE
├─ Scales: All within normal limits
├─ Overall: GENUINE — Symptom report consistent with actual experience
└─ [Mark as Reviewed] [Edit Notes]
```

**Step 1.4.3: Clinician Documentation**

For each instrument, clinician can add notes:
- "Validity accepted without concern."
- "VRIN-T slightly elevated, but within acceptable limits. Patient appeared genuine throughout testing."
- "TOMM Trial 2 on border of pass/fail cutoff (47 vs. 45). Patient fatigued by this point in testing. Recommend conservative interpretation."
- "SIRS-2 'Probable Feigning' classification. Conflict with TOMM pass result. Requires differential interpretation."

Notes stored in `testing/scores/{instrument}_scores.json` under `clinicianValidityNotes`.

**Step 1.4.4: Mark as Reviewed**

Clinician clicks "Mark as Reviewed" for each instrument:
- Status updates from "Scored" to "Reviewed"
- `clinicianReviewStatus` field updated in JSON
- Timestamp recorded
- Audit trail: `"MMPI-3 validity reviewed by Dr. Truck Irwin. Status: Reviewed. Validity: Adequate."`

---

## Step 1.5: Clinician Score Review & Interpretation Support

### Critical Principle: Doctor Always Interprets

**The AI provides summaries and pattern identification. The clinician interprets.**

### Implementation: Per-Instrument Review Interface

**Step 1.5.1: Clinician Opens Score Review**

From Clinical Overview → Testing tab, clinician clicks on an instrument (e.g., "MMPI-3"):

UI displays:
1. **Score Profile** — Graph/table of all scales with T-scores and percentiles
2. **Validity Summary** — Standalone + embedded validity status
3. **Pattern Summary** (AI-generated, optional)
4. **Clinician Notes** — Free-text field for clinical interpretation
5. **Cross-instrument Notes** — Link to patterns seen in other instruments

**Step 1.5.2: AI Writing Assistant Optional Pattern Summary**

If enabled, clinician can click "Get AI Summary":
- Writing Assistant (Column 3) receives redacted test scores via UNID pipeline
- Generates a pattern summary: "MMPI-3 shows elevations on scales ANX (T=65), DEP (T=68), LSE (T=71), WRK (T=69) and SOD (T=66). These elevations suggest a profile consistent with significant anxiety, depressive symptoms, low self-esteem, and social withdrawal. The pattern aligns with internalized distress rather than behavioral acting-out."

**CRITICAL WORDING:** The AI says "suggests" and "consistent with" — never "indicates" or "shows." The AI is presenting patterns, not making clinical statements.

**Step 1.5.3: Clinician Interprets**

The clinician, having seen the test profile and the AI pattern summary, writes their own interpretation. Examples:

- "MMPI-3 profile is consistent with significant depressive and anxiety symptoms. Validity indicators are adequate. The elevations on LSE are consistent with the patient's stated lack of confidence in managing competency-related tasks (e.g., understanding charges, assisting counsel). This finding supports the clinical impression of depression affecting his functional capacity."

- "PAI shows elevations on AGG (Aggression) and ANT (Antisocial). This is consistent with the violence history and the charges. Validity indicators are valid. These personality factors are relevant to risk assessment and should be integrated with the HCR-20 structured professional judgment."

- "WAIS-V shows a Global Cognitive Index of 78 (T-score, 7th percentile, well below average). Processing speed is particularly impaired (PSI = 72). This is consistent with the cognitive impairment reported by the patient and observed during testing. These deficits directly impact his understanding of legal proceedings."

Clinician types/dictates these interpretations directly in the "Clinician Interpretation" field.

**Step 1.5.4: Cross-Instrument Pattern Identification**

Clinician can view "Cross-Instrument Patterns" (optional AI summary):
- "MMPI-3 depression elevations (T=68) align with PAI DEP elevations (T=71). Both instruments show consistent personality pattern."
- "WAIS-V processing speed deficit (PSI=72) correlates with patient's interview notes: slow speech, delayed responses, difficulty tracking questions."

Again, these are **observations**, not diagnoses.

**Step 1.5.5: Review Status**

For each instrument, clinician sets:
- **Status:** "Reviewed"
- **Clinician Interpretation:** [free text or dictated notes]
- **Validity Status:** "Valid" / "Questionable" / "Invalid"
- **Clinical Notes:** Any additional context or caveats

Saved to `testing/scores/{instrument}_scores.json` under:
```json
{
  "clinicianReviewStatus": "Reviewed",
  "clinicianReviewDate": "2026-03-13T14:30:00Z",
  "clinicianInterpretation": "[clinician's text]",
  "validityStatus": "Valid",
  "additionalNotes": "[any caveats or context]"
}
```

---

## Step 1.6: Advancement to Interview

### Validation Criteria

Before a case can advance from Testing to Interview, the application validates:

1. **All instruments in the battery have been scored**
   - Every instrument in `testing/testing_summary.json` has a corresponding `testing/scores/{instrument}_scores.json` file
   - Status field is "Scored" (minimally) or "Reviewed" (preferably)

2. **Validity assessment complete for each instrument**
   - Each `testing/scores/{instrument}_scores.json` has `clinicianReviewStatus` = "Reviewed"
   - Validity status documented (Valid / Questionable / Invalid)

3. **At least one instrument reviewed**
   - Soft requirement; warns if none reviewed, but doesn't block

4. **Optional: Clinician interpretation provided**
   - Best practice, but not required for advancement

### Manual Advancement

Clinician clicks "Advance to Interview" in the Testing section:

1. Application runs validation checks (above)
2. If all pass:
   - `interviews/` directory created on disk
   - Case status changed to "Interview" (pink indicator)
   - Audit trail logged: `"Case advanced to Interview. Test battery scored: [count]. Validity status: [summary]. Clinician: [name]."`
3. Case becomes visible in the Interview view

### Automatic Advancement (Optional)

Alternatively, when the clinician marks the **final instrument as reviewed**, the application can auto-advance:
- Popup: "All instruments scored and reviewed. Advance to Interview?"
- Clinician clicks "Yes" or dismisses popup (manual advancement still available)

---

## Step 1.7: Edge Cases & Error Handling

### Edge Case 1: Incomplete Test Battery (Patient Cannot Complete)

**Scenario:** Patient began WAIS-V but became fatigued; clinician stopped testing. Clinician wants to proceed with the remaining tests.

**Implementation:**
1. Clinician documents in `testing/testing_summary.json`:
   - Status for WAIS-V: "Incomplete"
   - Reason: "Patient fatigued; unable to complete subtests 7-11"
   - Instruction to Ingestor/Diagnostician: "Do not use WAIS-V in diagnostic reasoning due to incompleteness"

2. On advancement check, application warns: "WAIS-V is marked Incomplete. You can still advance, but note this in your clinical opinion."

3. Case advances, but Diagnostician Agent is instructed (via case metadata) to exclude incomplete tests from evidence mapping.

---

### Edge Case 2: Failed Validity (Uninterpretable Results)

**Scenario:** MMPI-3 validity indicators are out of range (VRIN-T T=95, F T=110). SIRS-2 classification is "Definite Feigning." Clinician cannot use these results.

**Implementation:**
1. Clinician marks MMPI-3 and SIRS-2 status as "Invalid"
2. Adds notes: "Patient appears to be feigning psychological symptoms. MMPI-3 profile is uninterpretable. SIRS-2 classification indicates definite feigning."
3. Case can still advance to Interview, but:
   - Clinician must conduct additional interviews to clarify genuine vs. feigned symptoms
   - Diagnostician Agent is instructed: "Primary validity instruments indicate feigning. Clinical diagnoses must account for this validity concern."
   - Report will include: "Validity concern: Primary validity instruments (SIRS-2, MMPI-3 validity scales) suggest symptom overreporting or malingering. Interpretations must be limited."

---

### Edge Case 3: Re-Administration Needed

**Scenario:** After reviewing test results, clinician determines TOMM score is on the borderline of pass/fail and wants to re-administer to clarify.

**Implementation:**
1. Clinician can create a new session in the battery:
   - `testing/testing_summary.json` tracks multiple administrations of the same instrument
   - Each administration has separate import date, scores, validity
2. Clinician imports second TOMM administration
3. Both results documented; clinician notes which one to use for interpretation
4. Both results appear in the evidence matrix, but clinician specifies which is "primary"

---

### Edge Case 4: Publisher Export Format Changes / PDF Parsing Failure

**Scenario:** Publisher updates their PDF export format. The Ingestor Agent cannot reliably parse the new format and flags it as "unable to extract."

**Implementation:**
1. Ingestor returns: `{ "status": "parsing_failed", "reason": "Unable to identify MMPI-3 score tables in provided PDF. Format may have changed." }`
2. Application alerts clinician: "Publisher export could not be parsed automatically. Please enter scores manually."
3. Clinician falls back to Pathway B (manual entry)
4. Audit trail: `"MMPI-3 import failed due to unrecognized PDF format. Manual entry used instead."`

---

### Edge Case 5: Psychometrist Permissions (Multi-Provider Practice)

**Scenario:** Practice has a psychometrist who administers tests and enters scores. Clinician reviews and interprets.

**Implementation:**
1. **Psychometrist role:**
   - Can import scores (Pathway A or B)
   - Can mark instruments as "Administered" with session notes
   - CANNOT see validity assessment or clinical interpretation fields
   - CANNOT advance case to next stage

2. **Clinician role:**
   - Views all imported scores
   - Reviews validity
   - Writes interpretation
   - Advances to next stage

3. **Audit trail distinguishes:** `"MMPI-3 scores imported by Jane Smith (Psychometrist)."` vs. `"MMPI-3 validity reviewed by Dr. Truck Irwin (Clinician)."`

---

## Data Model: Testing Stage Tables (SQLCipher)

### Table: `test_instruments`

Stores metadata for each instrument in the clinician's library (configured during Setup):

```sql
CREATE TABLE test_instruments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  publisher TEXT,
  administration_format TEXT,
  scoring_method TEXT,
  validity_relevant BOOLEAN,
  eval_type_recommended TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

### Table: `case_test_battery`

Stores the battery for each case:

```sql
CREATE TABLE case_test_battery (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL FOREIGN KEY,
  instrument_id TEXT NOT NULL FOREIGN KEY,
  selected_date TIMESTAMP,
  status TEXT CHECK (status IN ('NotAdministered', 'Administering', 'Administered', 'Scored', 'Reviewed')),
  scores_imported_date TIMESTAMP,
  clinician_reviewed_date TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (case_number) REFERENCES cases(case_number),
  FOREIGN KEY (instrument_id) REFERENCES test_instruments(id)
);
```

---

### Table: `test_scores`

Stores scored results for each instrument per case:

```sql
CREATE TABLE test_scores (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL,
  instrument_id TEXT NOT NULL,
  administration_date DATE,
  import_date TIMESTAMP,
  import_method TEXT CHECK (import_method IN ('publisher_export', 'manual_entry')),
  source_file TEXT,
  raw_scores JSONB,         -- { "scale_name": number, ... }
  scaled_scores JSONB,      -- { "scale_name": number, ... }
  t_scores JSONB,           -- { "scale_name": number, ... }
  percentiles JSONB,        -- { "scale_name": number, ... }
  validity_indicators JSONB, -- { "indicator_name": value, ... }
  clinician_review_status TEXT CHECK (clinician_review_status IN ('NotReviewed', 'Reviewed')),
  clinician_review_date TIMESTAMP,
  clinician_interpretation TEXT,
  validity_status TEXT CHECK (validity_status IN ('Valid', 'Questionable', 'Invalid')),
  additional_notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (case_number) REFERENCES cases(case_number),
  FOREIGN KEY (instrument_id) REFERENCES test_instruments(id)
);
```

---

### Table: `validity_assessment`

Aggregated validity status for the case:

```sql
CREATE TABLE validity_assessment (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  assessment_date TIMESTAMP,
  overall_validity_status TEXT CHECK (overall_validity_status IN ('Valid', 'Questionable', 'Invalid', 'Pending')),
  standalone_validity_results JSONB,  -- { "TOMM": {...}, "SIRS-2": {...}, ... }
  embedded_validity_results JSONB,    -- { "MMPI-3": {...}, "PAI": {...}, ... }
  flags_triggered JSONB,              -- [ { "flag": "...", "severity": "..." }, ... ]
  clinician_notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (case_number) REFERENCES cases(case_number)
);
```

---

## IPC Contracts: Testing Stage

### New IPC Channels (extends doc 02)

```typescript
// Import scores from publisher export PDF
ipcMain.handle('testing:importPublisherExport', async (event, {
  caseNumber: string,
  filePath: string,            // Local path to PDF
  instrumentId: string
}) => Promise<{
  instrumentName: string,
  scoresExtracted: number,
  validityIndicators: string[],
  importDate: string,
  storageLocation: string
}>);

// Import scores via manual entry
ipcMain.handle('testing:importManualScores', async (event, {
  caseNumber: string,
  instrumentId: string,
  scores: object                // { "scale_name": value, ... }
}) => Promise<{
  instrumentName: string,
  storageLocation: string,
  calculatedValues: object      // Auto-calculated T-scores, percentiles
}>);

// Get validity assessment for instrument
ipcMain.handle('testing:getValidityAssessment', async (event, {
  caseNumber: string,
  instrumentId?: string         // Optional: single instrument or all
}) => Promise<{
  overallStatus: string,
  standaloneSummary: object,
  embeddedSummary: object,
  flagsTriggered: Array<object>,
  clinicianNeedAction: boolean
}>);

// Get test battery for case
ipcMain.handle('testing:getBattery', async (event, {
  caseNumber: string
}) => Promise<{
  instruments: Array<{
    instrumentId: string,
    name: string,
    status: string,
    scoresImportedDate?: string,
    reviewedDate?: string
  }>,
  completionStatus: string      // "NotStarted" | "Partial" | "Complete"
}>);

// Advance case from Testing to Interview
ipcMain.handle('testing:advanceToInterview', async (event, {
  caseNumber: string
}) => Promise<{
  success: boolean,
  newStage: string,
  directoriesCreated: string[],
  auditEntry: object
}>);

// Get test scores for clinician review
ipcMain.handle('testing:getScoresForReview', async (event, {
  caseNumber: string,
  instrumentId: string
}) => Promise<{
  instrumentName: string,
  scoreProfile: object,
  validityIndicators: object,
  clinicianInterpretation?: string,
  validityStatus: string
}>);
```

---

## Audit Trail Entries

Every action in the Testing stage is logged:

```json
{"timestamp":"2026-03-10T10:30:00Z","action":"test_battery_finalized","caseNumber":"2026-0147","instruments":["MMPI-3","PAI","WAIS-V","TOMM","SIRS-2"],"clinician":"Dr. Truck Irwin"}
{"timestamp":"2026-03-12T15:45:00Z","action":"test_scores_imported","caseNumber":"2026-0147","instrument":"MMPI-3","method":"publisher_export","source":"Q-global","validityStatus":"Valid"}
{"timestamp":"2026-03-12T16:00:00Z","action":"test_validity_assessed","caseNumber":"2026-0147","instrument":"MMPI-3","overallStatus":"Adequate","flagsCount":0}
{"timestamp":"2026-03-13T14:30:00Z","action":"test_reviewed","caseNumber":"2026-0147","instrument":"MMPI-3","clinician":"Dr. Truck Irwin","validityStatus":"Valid"}
{"timestamp":"2026-03-13T14:45:00Z","action":"test_battery_complete","caseNumber":"2026-0147","totalInstruments":5,"allReviewed":true,"clinician":"Dr. Truck Irwin"}
{"timestamp":"2026-03-13T15:00:00Z","action":"case_advanced","caseNumber":"2026-0147","fromStage":"Testing","toStage":"Interview","directoriesCreated":["interviews"],"clinician":"Dr. Truck Irwin"}
```

---

## Relationship to Existing Documents

| Document | What It Covers | What This Document Adds |
|----------|---------------|------------------------|
| Doc 18 (Case Lifecycle) | Testing stage overview; steps 1.1–1.6 at high level | Detailed implementation: UI flows, data structures, score schemas, edge cases |
| Doc 03 (Agent Specs) | Ingestor Agent role and output schema | How Ingestor is invoked for PDF parsing and manual entry validation |
| Doc 15 (UNID Redaction) | UNID mechanism and lifecycle | Applied at Redaction Point 1 (Intake) and Point 2 (Report); not used for score imports |
| Doc 16 (Case Directory) | testing/ directory structure | Populated during Testing stage; this doc specifies what's written and when |
| Doc 02 (IPC Contracts) | Electron ↔ Python communication | New channels for score import, validity assessment, battery management |

---

## Glossary

- **Battery:** The set of standardized instruments selected for a given case
- **Validity:** Degree to which test results are interpretable; affected by response consistency, effort, and genuineness
- **Standalone Validity Instrument:** A test designed specifically to assess malingering/feigning (TOMM, SIRS-2, M-FAST, VSVT)
- **Embedded Validity Scales:** Validity indicators built into the test itself (MMPI-3 VRIN-T, PAI NIM, etc.)
- **T-Score:** Standard score (M=50, SD=10); allows comparison across instruments
- **Percentile:** Percentage of the norm group scoring at or below a given score
- **UNID:** Unique Non-Identifying Descriptor; temporary PHI replacement during AI transmission
- **Ingestor Agent:** Claude-based agent that parses documents and extracts structured data

---

## Implementation Checklist

- [ ] Create `testing/` directory structure on case advancement
- [ ] Implement battery selection UI (add/remove instruments)
- [ ] Build manual scoring form generator (instrument-specific)
- [ ] Integrate Ingestor Agent for PDF parsing (via UNID pipeline)
- [ ] Implement automatic validity checking and flag system
- [ ] Build clinician review interface with pattern summaries
- [ ] Create `test_instruments`, `case_test_battery`, `test_scores`, `validity_assessment` SQLCipher tables
- [ ] Implement IPC channels for score import and validity assessment
- [ ] Build advancement validation (all instruments scored + reviewed)
- [ ] Add audit trail logging for all Testing stage actions
- [ ] Test edge cases: incomplete battery, failed validity, re-administration, psychometrist permissions

---

**Document Status:** Ready for development. No blockers identified.
**Next Phase:** Stage 2: Interview Specification (doc 21)
