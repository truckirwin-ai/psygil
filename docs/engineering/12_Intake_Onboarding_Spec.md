# Psygil — Intake & Clinical Onboarding Specification

**Document:** 12_Intake_Onboarding_Spec.md
**Version:** 1.0
**Date:** March 21, 2026
**Status:** Draft — Pending Truck Review

---

## 1. Overview

This document specifies the Intake and Clinical Onboarding workflow for Psygil. These are the first two steps in the case lifecycle — before any evaluation, testing, or AI agent involvement begins.

**Workflow Position:**
```
Intake → Onboarding (Self-Report) → Clinical Interview Verification → Case Created → [Existing Pipeline Begins]
```

**Key Principle:** All patient-facing forms use **narrative text input fields only** — no checkboxes, no dropdowns for clinical content. Research confirms that checkbox-based self-report forms produce significantly higher over-reporting rates (Anvari et al., 2023; PNAS 2024). Open-ended narrative responses reduce response-set bias and produce more accurate clinical baselines.

---

## 2. Intake Form

### 2.1 Purpose

Create a new case file with minimal required information. The Intake form is a modal popup (not a tab) — it overlays the main application. This is a short, focused form designed to be completed by front-desk staff or the patient in a waiting room.

### 2.2 Referral Source Toggle

The form begins with a referral source selection that conditionally shows different sections:

- **Referral (Court / Attorney / Physician)** — Shows referral-specific fields (referring party, court info, attorney, charges, supporting documents)
- **Self-Referred / Walk-in** — Shows self-report presenting concerns (primary complaint, onset, safety screening)

### 2.3 Intake Form Sections

#### Section A: Patient Contact Information
| Field | Type | Required |
|-------|------|----------|
| Last Name | text | Yes |
| First Name | text | Yes |
| Middle Name / Initial | text | No |
| Date of Birth | date | Yes |
| Age | text (auto-calc) | Yes |
| Gender | text | Yes |
| Street Address | text | Yes |
| City | text | Yes |
| State | text | Yes |
| ZIP | text | Yes |
| Phone | tel | Yes |
| Email | email | No |
| Preferred Contact Method | text | No |
| Emergency Contact Name & Relationship | text | Yes |
| Emergency Phone | tel | Yes |

#### Section B: Referral Information (Referral only)
| Field | Type | Required |
|-------|------|----------|
| Referring Party Type | text | Yes |
| Referring Party Name / Office | text | Yes |
| Referring Party Address | text | Yes |
| Referring Party Phone | tel | Yes |
| Referring Party Email | email | No |
| Court / Case Number | text | Conditional |
| Judge / Assigned Court | text | Conditional |
| Attorney of Record | text | Conditional |
| Attorney Phone | tel | Conditional |
| Attorney Email | email | Conditional |
| Reason for Referral / Evaluation Requested | textarea | Yes |
| Complaint / Charges / Legal Matter | textarea | Yes |
| Supporting Documents Received | textarea | Yes |
| Court Deadline / Due Date | date | No |
| Additional Notes from Referring Office | text | No |

#### Section C: Self-Referred Presenting Concerns (Walk-in only)
| Field | Type | Required |
|-------|------|----------|
| Primary Complaint — In Your Own Words | textarea | Yes |
| When Did These Concerns Begin? | textarea | Yes |
| Has Anything Made It Better or Worse? | textarea | No |
| Are You Currently Safe from Harm? | textarea | Yes |
| Previous Treatment or Evaluation | textarea | No |
| Who Recommended You Come In? | text | No |
| Primary Care Physician | text | No |

#### Section D: Insurance & Billing
| Field | Type | Required |
|-------|------|----------|
| Insurance Carrier | text | No |
| Policy / Member ID | text | No |
| Group Number | text | No |
| Policyholder Name (if not patient) | text | No |
| Relationship to Patient | text | No |

### 2.4 Intake Actions
- **Save Draft** — Persists to SQLCipher with status `draft`
- **Save & Continue to Onboarding** — Saves intake, creates case record, opens Onboarding modal

### 2.5 Data Model

New table: `patient_intake`
```sql
CREATE TABLE patient_intake (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    case_id TEXT NOT NULL REFERENCES cases(id),
    referral_type TEXT NOT NULL CHECK (referral_type IN ('referral', 'self_referred')),
    -- Patient Contact
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    dob TEXT,
    age TEXT,
    gender TEXT,
    street_address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    email TEXT,
    preferred_contact TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    -- Referral Fields
    referring_party_type TEXT,
    referring_party_name TEXT,
    referring_party_address TEXT,
    referring_party_phone TEXT,
    referring_party_email TEXT,
    court_case_number TEXT,
    judge_court TEXT,
    attorney_name TEXT,
    attorney_phone TEXT,
    attorney_email TEXT,
    referral_reason TEXT,
    complaint_charges TEXT,
    supporting_docs TEXT,
    court_deadline TEXT,
    referral_notes TEXT,
    -- Self-Referred Fields
    primary_complaint TEXT,
    onset_timeline TEXT,
    better_worse TEXT,
    safety_screening TEXT,
    previous_treatment TEXT,
    who_recommended TEXT,
    pcp_name TEXT,
    -- Insurance
    insurance_carrier TEXT,
    policy_id TEXT,
    group_number TEXT,
    policyholder_name TEXT,
    policyholder_relationship TEXT,
    -- Meta
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 3. Onboarding Form (Biopsychosocial Self-Report)

### 3.1 Purpose

Comprehensive patient history collection following the biopsychosocial model aligned with AAPL Forensic Assessment Guidelines. This form serves dual purposes:

1. **Patient Self-Report Mode** — Patient fills out narrative fields
2. **Clinician Interview Review Mode** — Clinician reviews patient-reported data during initial clinical interview, adds verification notes, flags discrepancies

### 3.2 Mode Toggle

The form has a toggle at the top:
- **Patient Self-Report** — Default mode. Clinician verification fields are hidden.
- **Clinician Interview Review** — Shows verification note fields under each section. Section badges change from "Patient-Reported" to "Under Review".

### 3.3 Onboarding Form Sections

#### Section 1: Demographics & Contact (Carried Over)
Auto-populated from Intake. Plus:
- Marital / Relationship Status
- Dependents / Children
- Current Living Situation
- Primary Language

#### Section 2: Primary & Secondary Complaints
- Primary Complaint — Describe in Detail (textarea)
- Secondary Concerns (textarea)
- Onset & Timeline (textarea)

#### Section 3: Family History
- Family of Origin (textarea)
- Family Mental Health History (textarea)
- Family Medical History (textarea)
- Current Family Relationships (textarea)

#### Section 4: Education History
- Highest Level of Education (text)
- Schools Attended (text)
- Academic Experience (textarea)

#### Section 5: Employment & Work History
- Current Employment Status (text)
- Current / Most Recent Employer & Role (text)
- Work History Summary (textarea)
- Military Service (textarea)

#### Section 6: Medical & Health History
- Current Medical Conditions (textarea)
- Current Medications (textarea)
- Surgeries & Hospitalizations (textarea)
- Head Injuries / TBI (textarea)
- Sleep Quality (text)
- Appetite / Eating Patterns (text)

#### Section 7: Mental Health History
- Previous Mental Health Treatment (textarea)
- Previous Diagnoses (textarea)
- Psychiatric Medications Past & Present (textarea)
- History of Self-Harm or Suicidal Thoughts (textarea)
- History of Violence or Harm to Others (textarea)

#### Section 8: Substance Use History
- Alcohol Use (textarea)
- Drug / Substance Use (textarea)
- Treatment for Substance Use (textarea)

#### Section 9: Legal & Forensic History
- Prior Arrests & Convictions (textarea)
- Incarceration History (textarea)
- Probation / Parole (textarea)
- Protective Orders / Restraining Orders (textarea)

#### Section 10: Recent History Leading to This Assessment
- Describe the Events or Circumstances (textarea)
- Current Stressors (textarea)
- Goals for This Evaluation (textarea)

### 3.4 Clinician Verification Notes

Each section (2-10) has a collapsible "Clinician Verification Notes" field that appears in Interview Review mode. The clinician documents:
- Discrepancies between patient self-report and clinical observation
- Corrections or clarifications
- Additional information gathered during interview
- Clinical impressions related to that domain

### 3.5 Onboarding Actions
- **Save Draft** — Persists current state
- **Generate Clinical Overview** — Triggers the data translation pipeline (see §4)
- **Complete Onboarding** — Marks form complete, creates case file

### 3.6 Data Model

New table: `patient_onboarding`
```sql
CREATE TABLE patient_onboarding (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    case_id TEXT NOT NULL REFERENCES cases(id),
    intake_id TEXT NOT NULL REFERENCES patient_intake(id),
    mode TEXT DEFAULT 'self_report' CHECK (mode IN ('self_report', 'clinician_review')),
    -- Demographics (carryover + additions)
    marital_status TEXT,
    dependents TEXT,
    living_situation TEXT,
    primary_language TEXT,
    -- Presenting Complaints
    primary_complaint TEXT,
    secondary_concerns TEXT,
    onset_timeline TEXT,
    -- Family History
    family_origin TEXT,
    family_mental_health TEXT,
    family_medical TEXT,
    family_current TEXT,
    -- Education
    education_level TEXT,
    schools_attended TEXT,
    academic_experience TEXT,
    -- Employment
    employment_status TEXT,
    current_employer TEXT,
    work_history TEXT,
    military_service TEXT,
    -- Health
    medical_conditions TEXT,
    medications TEXT,
    surgeries_hospitalizations TEXT,
    head_injuries TEXT,
    sleep_quality TEXT,
    appetite TEXT,
    -- Mental Health
    previous_mh_treatment TEXT,
    previous_diagnoses TEXT,
    psychiatric_medications TEXT,
    self_harm_history TEXT,
    violence_history TEXT,
    -- Substance Use
    alcohol_use TEXT,
    drug_use TEXT,
    substance_treatment TEXT,
    -- Legal
    arrests_convictions TEXT,
    incarceration TEXT,
    probation_parole TEXT,
    protective_orders TEXT,
    -- Recent History
    recent_events TEXT,
    current_stressors TEXT,
    evaluation_goals TEXT,
    -- Clinician Verification Notes (one per section)
    clinician_note_demographics TEXT,
    clinician_note_complaints TEXT,
    clinician_note_family TEXT,
    clinician_note_education TEXT,
    clinician_note_employment TEXT,
    clinician_note_health TEXT,
    clinician_note_mental TEXT,
    clinician_note_substance TEXT,
    clinician_note_legal TEXT,
    clinician_note_recent TEXT,
    -- Meta
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'patient_complete', 'clinician_verified', 'overview_generated')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 4. Data Translation Pipeline (Self-Report → Clinical Overview)

### 4.1 Fidelity Protocol

**CRITICAL:** Every element the patient reports MUST appear in the clinical overview. The pipeline cleans and translates — it does NOT filter, summarize, or omit.

**What the pipeline does:**
- Corrects spelling, grammar, and punctuation errors
- Converts patient language to clinical terminology (e.g., "I feel like people are watching me" → "Patient reports persecutory ideation")
- Structures content into standard clinical note sections
- Preserves every discrete fact, complaint, date, person, and event mentioned

**What the pipeline does NOT do:**
- Remove or omit any reported element
- Interpret or diagnose based on self-report
- Add information not provided by the patient
- Summarize multiple distinct complaints into a single statement

### 4.2 Translation Flow

```
Patient Self-Report (raw text per section)
    ↓ PII Detection (Python sidecar)
    ↓ De-identification
    ↓ Send to Claude API: "Translate to clinical language. Preserve every element."
    ↓ Re-identification (map PII tokens back)
    ↓ Generate structured clinical overview document
    ↓ Write as .docx sections in case overview
    ↓ Open in OnlyOffice for clinician review
```

### 4.3 Clinical Overview Document Structure

The generated overview document maps directly to the onboarding sections:

1. **Identifying Information** — from intake demographics
2. **Referral Information** — from intake referral fields
3. **Presenting Complaints** — primary and secondary, with timeline
4. **Family History** — origin, mental health, medical, current relationships
5. **Educational History** — schooling, academic performance
6. **Employment & Military History** — work, service
7. **Medical History** — conditions, medications, surgeries, TBI, sleep, appetite
8. **Mental Health History** — prior treatment, diagnoses, medications, self-harm, violence
9. **Substance Use History** — alcohol, drugs, treatment
10. **Legal & Forensic History** — arrests, incarceration, supervision, orders
11. **Recent History & Precipitating Events** — what led to this assessment
12. **Patient-Stated Goals** — what the patient wants from the evaluation

Each section includes a field for clinician notes added during the initial interview.

### 4.4 Clinician Interview Verification

During the initial clinical interview, the clinician:

1. Opens the Onboarding form in **Clinician Interview Review** mode
2. Reviews each section of patient-reported data
3. Adds verification notes where:
   - Patient elaborates on or corrects self-report
   - Clinician observes discrepancies (affect, presentation, etc.)
   - Additional history is gathered through clinical questioning
4. Can edit the patient-reported fields directly (edits are logged in audit trail)
5. Marks sections as verified
6. Triggers re-generation of clinical overview incorporating verification notes

---

## 5. UI Implementation

### 5.1 Modal Popups

Both Intake and Onboarding forms render as **modal popups** overlaying the main IDE layout:

- Triggered by titlebar links ("Intake" and "Onboarding")
- Full-width modal (max 880px) with scrollable body
- Close via X button, clicking backdrop, or Escape key
- Sticky header with form title and close button

### 5.2 Form Continuity

"Save & Continue to Onboarding →" on the Intake form closes the Intake modal and opens the Onboarding modal with demographics pre-populated.

### 5.3 Visual Reference

See `Psygil_UI_Prototype_v4.html` — both forms are implemented as working modal prototypes.

---

## 6. Sprint Integration

These forms integrate into the existing sprint plan:

| Sprint | Tasks Added |
|--------|------------|
| Sprint 3 | Intake form UI component, patient_intake table migration |
| Sprint 3 | Onboarding form UI component, patient_onboarding table migration |
| Sprint 5 | Data translation pipeline (uses Claude API + PII pipeline from Sprint 4) |
| Sprint 5 | Clinical overview document generation (uses OnlyOffice from Sprint 7) |
| Sprint 8 | Clinician interview verification mode |

---

## 7. Research References

- AAPL Practice Guideline for the Forensic Assessment (2015) — Standard domains for forensic intake
- Anvari, F. et al. (2023). "Bias in Self-Reports: An Initial Elevation Phenomenon." Social Psychological and Personality Science.
- PNAS (2024). "A solution to the pervasive problem of response bias in self-reports."
- APA Division 31 — Mental Health Intake & Evaluation Forms
- ICANotes — Biopsychosocial Assessment Template domains
- Forensic Evaluations in Psychiatry (PMC3890920) — Required assessment sections
