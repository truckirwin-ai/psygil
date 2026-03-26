# Case Lifecycle — Referral Through Archive
## Psygil — Complete Evaluation Workflow Specification

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Product Specification
**References:** Pipeline Architecture (doc 14), Intake/Onboarding Spec (doc 12), Agent Prompt Specs (doc 03), UNID Redaction (doc 15), Case Directory Schema (doc 16), Setup Workflow (doc 17)

---

## Overview

This document describes the complete lifecycle of a forensic or clinical psychology evaluation case in Psygil, from the moment a referral arrives through final report delivery and case archival. Every step identifies who does the work (clinician, front desk, AI agent, or the application itself), what gets created, where it's stored, and what triggers advancement to the next stage.

The 6-stage pipeline (Onboarding → Testing → Interview → Diagnostics → Review → Complete) is the spine, but the real workflow has sub-steps within each stage, pre-pipeline steps (referral receipt), and post-pipeline steps (delivery, archive). This document covers all of it.

---

## Pre-Pipeline: Referral Receipt

### How a Case Begins

A case begins when the clinician receives a referral. This happens outside the application — a phone call, fax, email, or mailed court order. Psygil does not receive referrals electronically (no patient portal, no API intake). The clinician or front desk staff decides to accept the case, then creates it in the application.

**Typical referral sources and how they arrive:**

| Source | How It Arrives | What's Included |
|--------|---------------|----------------|
| Court Order | Fax, mail, or electronic court filing | Evaluation type, legal questions, defendant name, charges, deadline, attorney of record |
| Attorney | Phone call, email, or letter | Client name, case context, evaluation requested, retaining party, questions to address |
| Physician | Referral letter, fax, or EHR message | Patient name, clinical concerns, specific questions, relevant medical history |
| Insurance | Authorization letter, fax | Member info, authorized eval type, session limits, report format requirements |
| Self-Referral | Phone call, walk-in | Patient presents with concerns, no external documentation |

**What the clinician does before opening Psygil:**
1. Reviews the referral to determine if it's within their competency and scope
2. Confirms no conflicts of interest
3. Checks calendar availability against any deadline
4. Accepts the case (verbally or in writing to referring party)

**Then they open Psygil.**

---

## Stage 0: Onboarding

### Step 0.1 — Create New Case (Intake Form)

**Who:** Front desk staff or clinician
**Trigger:** Clinician clicks "Intake" in the titlebar
**What opens:** Intake modal (overlay, not a tab)

**What happens:**

The Intake form is a short, focused form designed to capture the minimum information needed to create a case. It's intentionally lightweight — the detailed history comes later in Onboarding.

1. **Referral source toggle** — selects "Referral" or "Self-Referred." This controls which form sections appear.
2. **Patient contact information** — name, DOB, address, phone, emergency contact. These are the fields that will be used to create the case directory name (`2026-0148_S.Williams`).
3. **Referral information** (if Referral) — referring party, court/case number, attorney, charges, referral reason, deadline, supporting documents already received.
4. **Presenting concerns** (if Self-Referred) — primary complaint in patient's own words, onset, safety screening.
5. **Insurance/billing** — carrier, policy ID, authorization (if applicable).

**What the application does when "Save & Continue" is clicked:**
1. Assigns the next sequential case number (e.g., `2026-0148`)
2. Creates the case directory on disk: `{project_root}/cases/2026-0148_S.Williams/`
3. Creates initial subdirectories: `intake/`, `referral/`, `audit/`
4. Writes `case.json` manifest with initial metadata
5. Saves structured intake data to `intake/intake_form.json`
6. Creates case record in SQLCipher `cases` table with status `Onboarding`
7. Logs to audit trail: "Case created"
8. Pipeline indicator shows: **Onboarding** (blue)
9. Case appears in the file tree (column 1) and the Dashboard case table

### Step 0.2 — Informed Consent

**Who:** Clinician (in person with patient)
**Trigger:** Case is created, patient is present for first appointment
**What happens in the real world:** The clinician reads or provides the informed consent document to the patient. The patient signs it. This is a legal and ethical requirement before any evaluation can begin.

**What happens in Psygil:**
1. Clinician opens the case, clicks "Consent" in the case tree (or the Onboarding button)
2. App generates a pre-populated consent form from the template in `{project_root}/templates/consent_forms/`:
   - Patient name, DOB, case number auto-filled from intake
   - Eval type, referral source, and scope of evaluation auto-filled
   - Limits of confidentiality language (varies by eval type — forensic consent is materially different from clinical consent)
   - Fee structure, estimated session count, cancellation policy
3. Clinician reviews, makes any edits in the OnlyOffice editor
4. Prints the consent form for in-person signature
5. After patient signs: clinician scans the signed copy (or takes a photo) and imports it into the case
6. App stores: `intake/consent_signed.pdf`
7. Consent status flag set in `case.json`

**HARD GATE:** The application warns (but does not prevent) proceeding past Onboarding without a signed consent on file. The warning appears in the Clinical Overview and on any attempt to advance the pipeline stage. Ethically, no evaluation should proceed without informed consent — but Psygil is a tool, not an enforcer.

### Step 0.3 — Biopsychosocial History (Onboarding Form)

**Who:** Patient (self-report) then Clinician (review)
**Trigger:** Clinician clicks "Onboarding" in the titlebar
**What opens:** Onboarding modal

**What happens:**

The Onboarding form is the comprehensive patient history — the biopsychosocial self-report aligned with AAPL Forensic Assessment Guidelines. This is the longest form in the application.

**Mode 1: Patient Self-Report**
The form is designed to be completed by the patient (on a tablet, laptop, or printed). All fields use **narrative text input only** — no checkboxes, no dropdowns for clinical content. This is a deliberate design decision based on research showing checkbox-based self-report produces higher over-reporting rates.

Sections:
1. Demographics & Contact (auto-populated from Intake)
2. Primary & Secondary Complaints (narrative)
3. Family History — family of origin, mental health history, medical history, relationships (all narrative)
4. Education History
5. Employment History
6. Military History (if applicable)
7. Legal History — arrests, convictions, incarcerations, pending charges (narrative)
8. Medical History — conditions, surgeries, medications, allergies (narrative)
9. Psychiatric History — prior diagnoses, hospitalizations, treatments, medications (narrative)
10. Substance Use History (narrative)
11. Social History — relationships, living situation, support systems (narrative)
12. Developmental History (for child/adolescent evals)
13. Additional Information — anything the patient wants to add

**Mode 2: Clinician Interview Review**
After the patient completes the form, the clinician toggles to review mode. Each section now shows a clinician verification field where the clinician can:
- Confirm accuracy ("Consistent with interview")
- Flag discrepancies ("Patient reported 2 prior hospitalizations; records show 4")
- Add clinical observations ("Patient became visibly distressed when discussing family history")

**AI involvement — UNID Redaction Point 1:**
When the clinician clicks "Clean Up & Finalize":
1. App takes the raw narrative text from all sections
2. Sends it to the Python sidecar for UNID redaction (all PHI replaced with single-use UNIDs)
3. Redacted text sent to the **Ingestor Agent** for cleanup:
   - Standardizes formatting
   - Fixes grammar and spelling
   - Resolves abbreviations
   - Extracts structured data (timeline events, medication lists, etc.)
   - Flags completeness gaps
4. Agent returns cleaned text with UNIDs intact
5. App re-hydrates UNIDs back to real PHI
6. Clinician reviews the cleaned version, makes any final edits
7. Final version saved to `intake/biopsychosocial.json`

**What the application does:**
1. Stores raw patient self-report (unedited original)
2. Stores clinician-reviewed version with verification notes
3. Stores AI-cleaned version (after re-hydration)
4. All three versions preserved — audit trail tracks which version is current
5. Structured data extracted by Ingestor stored in `intake/demographics.json`

### Step 0.4 — Collateral Document Upload

**Who:** Front desk staff or clinician
**Trigger:** Documents arrive from referring office, court, hospitals, schools, etc.
**What happens:**

Collateral records trickle in throughout the case — they don't all arrive at once. The clinician or staff imports them as they're received.

1. Click "Import Document" in the case tree or collateral section
2. Select files from disk (PDFs, scanned images, Word docs)
3. For each document:
   - Name it (or accept auto-detected name from filename)
   - Categorize it (Court Order, Medical Records, Prior Evaluation, School Records, Police Report, etc.)
   - Set status (Received, Requested, Pending)
4. App copies the file into `collateral/` in the case directory
5. Updates `collateral/collateral_index.json` manifest
6. Ingestor Agent can be invoked to extract structured data from PDFs (via UNID pipeline)

**No stage advancement required.** Collateral upload continues throughout all stages. The collateral section in the file tree grows as documents arrive.

### Step 0.5 — Advance to Testing

**Who:** Clinician
**Trigger:** Clinician determines enough intake and referral information exists to begin evaluation
**What happens:**
1. Clinician clicks "Advance to Testing" (or the pipeline stage advances automatically when the first test is administered)
2. App validates:
   - Intake form is complete (all required fields)
   - Consent is on file (warns if not, doesn't block)
   - At least one referral question is documented
3. App creates `testing/` directory and subdirectories
4. Case status changes to **Testing** (purple)
5. Audit trail: "Case advanced to Testing"

---

## Stage 1: Testing

### Step 1.1 — Select Test Battery

**Who:** Clinician
**Where:** Testing section of the case, or Clinical Overview → Testing tab
**What happens:**

The clinician selects which instruments to administer based on the referral questions and eval type. Psygil suggests a recommended battery based on eval type, but the clinician makes the final decision.

**AI involvement (optional):** The Writing Assistant (column 3 chat panel) can suggest instruments based on the referral questions: "For a CST evaluation with these charges and this history, you might consider: MMPI-3, PAI, TOMM, SIRS-2, WAIS-V." The clinician adds or removes instruments.

1. Clinician opens the test battery configuration
2. Instruments from the clinician's library are available (configured during setup)
3. Clinician selects instruments → battery saved to `testing/testing_summary.json`
4. Each selected instrument gets a placeholder in `testing/scores/`

### Step 1.2 — Administer Tests

**Who:** Clinician or psychometrist (in person with patient)
**Where:** This happens OUTSIDE the application. The clinician administers tests in the office using paper forms, computer-based testing platforms (Q-global, PARiConnect, CNS Vital Signs), or local testing software.

Psygil does not administer tests. It manages the results.

### Step 1.3 — Import Test Scores

**Who:** Clinician or psychometrist
**Trigger:** Testing is complete, score reports are available
**What happens:**

1. **Publisher export import:** Clinician downloads the score report from the publisher platform (Q-global PDF, PARiConnect PDF, etc.) and imports it into the case
   - App stores the publisher export in `testing/imports/`
   - **Ingestor Agent** (via UNID pipeline) parses the PDF and extracts structured scores: raw, scaled, T-scores, percentiles, validity indicators
   - Extracted scores stored in `testing/scores/{instrument}_scores.json`

2. **Manual score entry:** For paper-administered tests, the clinician enters scores directly
   - Scoring form per instrument with the appropriate scale structure
   - App validates scores against expected ranges (flags impossible values)

3. **Validity auto-check:** As scores are entered/imported, app automatically identifies validity-relevant instruments:
   - Standalone validity tests (TOMM, SIRS-2, M-FAST, VSVT): pass/fail status extracted
   - Embedded validity scales (MMPI-3 VRIN-T/TRIN-T/F-family, PAI NIM/PIM/ICN): extracted and evaluated against publisher cutoffs
   - Results compiled in `testing/validity/validity_summary.json`

4. **Scoring status tracked per instrument:** Not Started → Administered → Scored → Reviewed

### Step 1.4 — Clinician Reviews Scores

**Who:** Clinician
**Where:** Clinical Overview → Testing tab, or individual test score documents in editor
**What happens:**

The clinician reviews each instrument's results:
1. Confirms validity indicators are within acceptable ranges
2. Reviews clinical scale elevations
3. Notes any unusual patterns or inconsistencies across instruments
4. Marks each instrument as "Reviewed"

**AI involvement (optional):** The Writing Assistant can summarize score patterns: "MMPI-3 shows elevations on scales 4 and 6, suggesting impulsivity and interpersonal sensitivity. PAI AGG and ANT scales are elevated. These patterns are consistent across both instruments." The clinician uses this as a starting point for their own interpretation — **THE DOCTOR ALWAYS INTERPRETS.**

### Step 1.5 — Advance to Interview

**Who:** Clinician
**Trigger:** All selected instruments are scored and reviewed
**What happens:**
1. App validates: all instruments in the battery have status "Reviewed"
2. App creates `interviews/` directory
3. Case status changes to **Interview** (pink)
4. Audit trail: "Case advanced to Interview. Test battery: [list]. Validity status: [summary]"

---

## Stage 2: Interview

### Step 2.1 — Clinical Interview(s)

**Who:** Clinician (in person with patient)
**Where:** This happens in the real world. The clinician conducts one or more face-to-face clinical interviews with the patient.

**What happens in Psygil during/after interviews:**

For each interview session:
1. Clinician creates a new session in `interviews/session_NNN/`
2. **Before the interview:** App generates a session prep sheet based on:
   - Referral questions not yet addressed
   - Gaps flagged by the Ingestor from the biopsychosocial
   - Test results requiring clarification
   - Collateral record discrepancies
3. **During the interview (optional):** If the clinician records the session:
   - Audio file stored locally (never sent to AI)
   - Python sidecar runs Whisper transcription locally
   - Transcript stored in `interviews/session_NNN/transcript.vtt`
4. **After the interview:** Clinician enters session notes
   - Structured Mental Status Examination (MSE) form: appearance, behavior, speech, mood, affect, thought process, thought content, perception, cognition, insight, judgment
   - Narrative session notes (free-text)
   - Behavioral observations
   - Clinician verification notes on biopsychosocial claims
5. Session notes saved to `interviews/session_NNN/notes.json` and `interviews/session_NNN/mental_status.json`

### Step 2.2 — Collateral Interviews

**Who:** Clinician (by phone or in person with collateral contacts)
**Where:** Clinician calls attorneys, family members, treatment providers, employers, etc.

**What happens in Psygil:**
1. Clinician creates a collateral interview session in `interviews/collateral_interviews/`
2. Records: who was contacted, their relationship to patient, date, duration
3. Notes: what the contact reported, any discrepancies with patient self-report
4. Stored in `interviews/collateral_interviews/session_NNN_contact_name/notes.json`

### Step 2.3 — Advance to Diagnostics

**Who:** Clinician
**Trigger:** Clinician determines sufficient data has been gathered for diagnostic formulation
**What happens:**
1. App validates: at least one interview session is documented
2. App creates `diagnostics/` directory
3. Case status changes to **Diagnostics** (orange)
4. Audit trail: "Case advanced to Diagnostics. Sessions: [count]. Total hours: [total]."

---

## Stage 3: Diagnostics

**THIS IS THE MOST CRITICAL STAGE. THE DOCTOR ALWAYS DIAGNOSES.**

### Step 3.1 — Diagnostician Agent Prepares Evidence Map

**Who:** AI (Diagnostician Agent)
**Trigger:** Case reaches Diagnostics stage
**What happens:**

1. App assembles the full case record: demographics, referral questions, test scores, validity indicators, interview notes, collateral summaries, biopsychosocial history
2. **UNID redaction** — all PHI replaced with single-use UNIDs (new map, not reused from any prior operation)
3. Redacted case record sent to the **Diagnostician Agent**
4. Agent returns:
   - **Validity Assessment** — overall interpretability of the test battery
   - **Diagnostic Evidence Map** — for each potentially relevant diagnosis, criterion-by-criterion analysis with supporting and contradicting evidence
   - **Differential Comparisons** — structured comparisons between overlapping diagnoses
   - **Psycholegal Analysis** (forensic only) — evidence mapped to legal standards (Dusky, M'Naghten, etc.)
   - **Functional Impairment Summary** (clinical only)
5. Response re-hydrated (UNIDs replaced with real PHI)
6. UNID map destroyed
7. Evidence map stored in `diagnostics/evidence_matrix.json`
8. Criteria mapping stored in `diagnostics/criteria_mapping.json`

**CRITICAL: The Diagnostician Agent NEVER selects a diagnosis.** It presents evidence. Every diagnosis entry has status `"evidence_presented"` — never `"confirmed"` or `"recommended"`. The agent does not say "the patient has MDD." It says "Evidence supporting MDD includes..."

### Step 3.2 — Clinician Reviews Evidence Map

**Who:** Clinician
**Where:** Clinical Overview → Diagnostics tab, or Evidence Map document in editor
**What happens:**

The clinician reviews the AI-generated evidence map:
1. Opens the Evidence Map — sees each potential diagnosis with criterion-by-criterion evidence
2. Reviews differential comparisons between overlapping diagnoses
3. Reviews psycholegal analysis (forensic cases)
4. Identifies any missing evidence or gaps
5. May request additional testing, another interview session, or more collateral records (case can temporarily move backward in the pipeline for additional data gathering — stage doesn't regress, but the clinician can add more data)

### Step 3.3 — Clinician Makes Diagnostic Decisions

**Who:** Clinician — and ONLY the clinician
**Where:** Diagnostics section of the case
**What happens:**

This is the step where the doctor diagnoses. The UI presents the evidence map and requires the clinician to make explicit, individual decisions:

1. **For each potential diagnosis presented by the Diagnostician Agent:**
   - **Confirm** — "I agree this diagnosis is supported by the evidence" → clinician selects ICD-10 code, adds clinical justification
   - **Rule Out** — "The evidence does not support this diagnosis" → clinician documents reasoning
   - **Defer** — "I need more information before deciding" → flags what's needed

2. **NO "Accept All" BUTTON.** Every diagnostic decision is individual. The clinician cannot bulk-accept the AI's evidence presentation. This is not a speed optimization — it's an ethical and legal mandate. The clinician's independent judgment on each diagnosis is what makes the evaluation defensible in court.

3. **Clinician can add diagnoses not suggested by the AI.** The AI only presents diagnoses it found evidence for. The clinician may identify a diagnosis based on clinical judgment, pattern recognition, or information the AI couldn't access (e.g., behavioral observations during testing that weren't in the notes).

4. **Clinical opinion formulation:** After all diagnostic decisions are made, the clinician writes (or dictates) their clinical opinion — the summary statement that will anchor the report. For forensic cases, this is the psycholegal opinion (e.g., "Not competent to stand trial — recommend restoration treatment").

**What gets saved:**
- `diagnostics/diagnostic_formulation.json` — confirmed diagnoses with ICD-10 codes and clinician justification
- `diagnostics/differential_dx.json` — ruled-out diagnoses with reasoning
- `diagnostics/feigning_assessment.json` — if validity concerns exist
- Audit trail: "Diagnosis confirmed: [code] [name] by [clinician] at [timestamp]" — one entry per diagnosis

### Step 3.4 — Advance to Review

**Who:** Clinician
**Trigger:** At least one diagnosis confirmed (or "No diagnosis" explicitly documented), clinical opinion written
**What happens:**
1. App validates: all presented diagnoses have been addressed (Confirm, Rule Out, or Defer — none left in "Pending")
2. App validates: clinical opinion is not empty
3. App creates `report/` and `report/drafts/` directories
4. Case status changes to **Review** (red-orange)
5. Audit trail: "Case advanced to Review. Diagnoses: [list]. Opinion: [summary]."

---

## Stage 4: Review

### Step 4.1 — Writer Agent Generates Draft Report

**Who:** AI (Writer Agent)
**Trigger:** Case reaches Review stage, clinician clicks "Generate Draft Report"
**What happens:**

1. App assembles the complete case record: everything from Intake through Diagnostics, including:
   - Demographics, referral questions
   - Biopsychosocial history (cleaned version)
   - Test battery with scores, validity, and clinician review notes
   - Interview notes with MSE observations
   - Collateral record summaries
   - Diagnostic formulation (clinician's confirmed diagnoses, not the AI's evidence map)
   - Clinical opinion (clinician's words)
2. **UNID redaction** — fresh UNID map generated, all PHI replaced
3. Redacted case record + eval type + report template structure sent to the **Writer Agent**
4. Writer Agent generates a complete evaluation report draft:
   - **Identifying Information & Referral** — who, what, why, when
   - **Informed Consent & Evaluation Procedures** — what the patient was told, what instruments were administered, what interviews were conducted
   - **Relevant History** — biopsychosocial narrative organized by the evaluation's referral questions
   - **Behavioral Observations & Mental Status** — compiled from interview session MSE data
   - **Test Results & Interpretation** — each instrument's results described in professional prose (scores, interpretation, cross-instrument patterns)
   - **Validity & Effort Assessment** — if applicable, standalone and embedded validity findings
   - **Clinical Formulation & Diagnosis** — the clinician's diagnostic decisions presented in narrative form with supporting evidence
   - **Psycholegal Opinion** (forensic) or **Clinical Recommendations** (clinical) — the clinician's opinion expanded into professional language
   - **Recommendations** — treatment recommendations, follow-up, restrictions
5. Agent returns the draft with UNIDs intact
6. App re-hydrates UNIDs → full PHI report text
7. UNID map destroyed
8. Draft saved as `report/drafts/draft_v1.docx` (OnlyOffice format)

**CRITICAL: The Writer Agent writes the CLINICIAN'S opinions, not its own.** The diagnoses, clinical opinion, and psycholegal conclusions are the clinician's — the AI is drafting the prose that presents them. If the clinician wrote "Not competent — recommend restoration," the Writer Agent produces 2-3 paragraphs of professional language explaining that opinion. The AI does not edit the substance of the opinion.

### Step 4.2 — Clinician Edits Draft Report

**Who:** Clinician
**Where:** Report opens in the OnlyOffice editor (column 2 main editor pane)
**What happens:**

This is where the clinician does their real writing work. The AI draft is a starting point — a scaffold with all the data organized correctly. The clinician:

1. Reads through the entire draft
2. Edits language, tone, emphasis to match their professional voice
3. Adds clinical observations and insights the AI couldn't capture
4. Strengthens the logical thread from evidence → diagnosis → opinion
5. Adjusts section emphasis based on what matters most for this case
6. Reviews test interpretation language for accuracy
7. Reviews psycholegal opinion for legal precision
8. Adds or removes sections as needed
9. Saves revisions as `report/drafts/draft_v2.docx`, `draft_v3.docx`, etc.

**Versioning:** Every save creates a new version. The clinician can compare versions side-by-side. Previous versions are never deleted.

### Step 4.3 — Editor/Legal Agent Reviews Draft

**Who:** AI (Editor/Legal Reviewer Agent)
**Trigger:** Clinician clicks "Run Legal Review" on a draft
**What happens:**

1. Current draft text sent through **UNID pipeline** (fresh UNIDs)
2. Redacted draft sent to the **Editor/Legal Reviewer Agent**
3. Agent analyzes for:
   - **Daubert compliance** — are opinions based on sufficient facts/data, reliable principles/methods, and reliably applied to the case?
   - **Internal consistency** — does the test data support the stated diagnoses? Do the diagnoses support the opinions?
   - **Missing evidence** — are there referral questions not addressed? Evidence cited in one section but missing from another?
   - **Legal vulnerabilities** — statements that could be challenged on cross-examination, overstatements of certainty, unsupported causal claims
   - **Ethical compliance** — appropriate scope of practice, limits of opinion acknowledged, alternative explanations considered
   - **Grammar, formatting, professional standards** — APA style, proper citation of instruments, correct use of clinical terminology
4. Agent returns a structured review with:
   - Issue severity (Critical / Warning / Suggestion)
   - Specific location in the report
   - Recommended revision language
   - Cross-examination vulnerability assessment
5. Re-hydrated and presented as a sidebar review panel alongside the report
6. Clinician addresses each issue: accept revision, modify, or dismiss with reasoning
7. Dismissed issues logged in audit trail with clinician's justification

### Step 4.4 — Clinician Finalizes and Signs

**Who:** Clinician
**Trigger:** Clinician is satisfied with the report after editing and legal review
**What happens:**

1. Clinician clicks "Finalize Report"
2. App runs a pre-finalization checklist:
   - All referral questions addressed in the report? ✓/✗
   - All administered tests reported? ✓/✗
   - Diagnosis section complete? ✓/✗
   - Opinion section complete? ✓/✗
   - All Editor/Legal Agent critical issues resolved? ✓/✗ (warns if unresolved)
   - Consent on file? ✓/✗
3. If all checks pass (or clinician overrides warnings):
   - Report locked for editing
   - Clinician's digital signature applied (name, credentials, license number, date, attestation statement)
   - Final report saved as `report/final/evaluation_report.docx`
   - PDF export generated: `report/final/evaluation_report.pdf`
   - The report contains **FULL PHI** — real names, dates, addresses. Reports are NEVER redacted.
4. Audit trail: "Report finalized and signed by [clinician] at [timestamp]. Version: [v#]."

### Step 4.5 — Advance to Complete

**Who:** Application (automatic after finalization)
**Trigger:** Report is finalized and signed
**What happens:**
1. App creates `exports/` directory
2. Case status changes to **Complete** (green)
3. Audit trail: "Case completed."
4. Case remains in the active case list until archived

---

## Stage 5: Complete

### Step 5.1 — Report Delivery

**Who:** Clinician or front desk staff
**Where:** Case → Report → Final
**What happens:**

The signed report needs to be delivered to the requesting party. Psygil supports multiple delivery methods:

1. **Print** — clinician prints the PDF from the application (for hand-delivery or mailing)
2. **Secure email** — app generates an encrypted email attachment with the PDF
   - Clinician selects recipient(s) from the referral contacts
   - App composes the email with a cover letter template
   - PDF attached
   - Sent via the clinician's configured email (SMTP or native mail client integration)
   - Audit trail: "Report transmitted to [recipient] via [method] at [timestamp]"
3. **Electronic filing** — for courts with electronic filing systems, clinician exports the PDF for upload to the court's portal (done outside the application, but the export is logged)
4. **Records package** — for complex cases, clinician can generate a full records package:
   - Report PDF
   - Consent form
   - Test data summary
   - Collateral record index
   - Bundled as `exports/records_package.zip`

**Delivery tracking:** Each delivery event is logged with recipient, method, date, and delivery confirmation (if available).

### Step 5.2 — Post-Delivery Activities

**Who:** Clinician
**What happens after the report is delivered:**

1. **Attorney/court questions** — if the referring party has questions, clinician can add notes to the case
2. **Testimony preparation** — if the clinician is called to testify, Psygil provides:
   - One-page case summary (generated from `case.json`)
   - Key findings quick reference
   - Cross-examination preparation notes (from Editor/Legal Agent review)
   - These are generated on demand, stored in `exports/`
3. **Addendum reports** — if new information comes to light after the report is filed:
   - Clinician creates an addendum document
   - Original report remains unchanged (immutable after signing)
   - Addendum stored in `report/final/addendum_YYYY-MM-DD.docx`
   - Audit trail: "Addendum created at [timestamp]. Reason: [reason]."

### Step 5.3 — Archive

**Who:** Clinician or admin
**Trigger:** Case is complete, report delivered, no pending activities
**What happens:**

1. Clinician clicks "Archive Case"
2. App confirms: "This will remove the case from your active case list. All files are preserved. You can restore it at any time."
3. Case status changes to **Archived** (gray)
4. Case disappears from the default Dashboard view (but appears when "Show Archived" filter is enabled)
5. Case directory remains on disk, unchanged
6. SQLCipher record retained with all metadata
7. Audit trail: "Case archived by [clinician] at [timestamp]."

**Retention:**
- Case files are never automatically deleted. Clinical records retention follows state law (typically 7 years after last contact for adults, until age 25 for minors).
- The clinician is responsible for retention compliance. Psygil can display a "Retention warning" for cases approaching their retention deadline.
- Archived cases can be restored to active status at any time (e.g., if the clinician is called to testify years later).

---

## Cross-Cutting: What Happens at Every Stage

### Audit Trail

Every action is logged to `audit/audit_trail.jsonl` — an append-only JSONL file:
```json
{"timestamp":"2026-03-22T14:30:00Z","user":"Dr. Truck Irwin","action":"case_created","details":{"caseNumber":"2026-0148","evalType":"CST"}}
{"timestamp":"2026-03-22T14:35:00Z","user":"Dr. Truck Irwin","action":"consent_uploaded","details":{"file":"consent_signed.pdf"}}
{"timestamp":"2026-03-24T10:00:00Z","user":"Dr. Truck Irwin","action":"test_scored","details":{"instrument":"MMPI-3","validity":"valid"}}
{"timestamp":"2026-03-28T16:00:00Z","user":"Dr. Truck Irwin","action":"diagnosis_confirmed","details":{"dx":"F20.0","name":"Schizophrenia, Paranoid Type"}}
{"timestamp":"2026-03-30T14:00:00Z","user":"Dr. Truck Irwin","action":"report_signed","details":{"version":"v3","pages":22}}
```

The audit trail is forensically important — it demonstrates the clinician's independent judgment at every step. If challenged, the clinician can show: "I reviewed the evidence map at 3:42 PM, made my diagnostic decisions at 4:15 PM, edited the report draft for 2.5 hours, and signed at 6:45 PM." This establishes that the clinician — not the AI — drove the evaluation.

### Writing Assistant (Column 3 Chat)

Available at every stage. The clinician can ask questions:
- "What instruments are typical for a CST evaluation?"
- "Summarize the collateral records for this case"
- "What's the Dusky standard criteria?"
- "Help me word this opinion about competency restoration"

Every chat interaction goes through the UNID pipeline if it references case data. The Writing Assistant never makes diagnostic decisions or clinical judgments — it's a research and drafting tool.

### Collaboration (Shared Practice Only)

In a multi-provider practice:
- **Case assignment:** Admin or supervising psychologist assigns cases to providers
- **Psychometrist access:** Psychometrist can enter test scores but cannot access interview notes, diagnostics, or report
- **Supervisory review:** Supervising psychologist can review and countersign reports
- **Case transfer:** If a provider leaves the practice, their cases can be reassigned
- **All actions attributed:** Every action in the audit trail shows which user performed it

---

## Summary: Who Does What

| Step | Who | AI Involvement | Output |
|------|-----|---------------|--------|
| Referral receipt | Clinician (outside app) | None | Decision to accept case |
| Create case (Intake) | Front desk / Clinician | None | Case directory, intake record |
| Informed consent | Clinician + Patient | None (template generation) | Signed consent PDF |
| Biopsychosocial history | Patient → Clinician | Ingestor Agent (cleanup via UNID) | Structured history |
| Upload collateral records | Front desk / Clinician | Ingestor Agent (extraction, optional) | Collateral files + index |
| Select test battery | Clinician | Writing Assistant (suggestions) | Test battery config |
| Administer tests | Clinician / Psychometrist | None (outside app) | — |
| Import scores | Clinician / Psychometrist | Ingestor Agent (PDF parsing) | Structured scores |
| Review scores | Clinician | Writing Assistant (summaries) | Reviewed scores |
| Clinical interviews | Clinician + Patient | Whisper transcription (optional, local) | Session notes, MSE |
| Collateral interviews | Clinician + Contacts | None | Collateral interview notes |
| Generate evidence map | AI (Diagnostician Agent) | UNID pipeline, full case submission | Evidence matrix |
| Review evidence map | Clinician | None (reads AI output) | Clinician notes on evidence |
| Make diagnostic decisions | **Clinician ONLY** | **None — doctor diagnoses** | Confirmed diagnoses |
| Write clinical opinion | Clinician | None | Clinical/psycholegal opinion |
| Generate report draft | AI (Writer Agent) | UNID pipeline, full case submission | Draft report (re-hydrated) |
| Edit report | Clinician | None (manual editing) | Revised draft |
| Legal review | AI (Editor/Legal Agent) | UNID pipeline | Review with issues |
| Address review issues | Clinician | None | Resolved issues |
| Finalize & sign | Clinician | None | Signed final report (full PHI) |
| Deliver report | Clinician / Front desk | None | Delivery record |
| Testimony prep | Clinician | Writing Assistant (on demand) | Prep materials |
| Archive | Clinician / Admin | None | Archived status |

---

## Relationship to Existing Documents

| Document | What It Covers | What This Document Adds |
|----------|---------------|----------------------|
| Doc 14 (Pipeline Architecture) | 6 stages, stage-appropriate documents, UI behavior | Complete sub-step workflow within each stage |
| Doc 12 (Intake/Onboarding Spec) | Form fields, data model, mode toggle | Where intake/onboarding fits in the full lifecycle |
| Doc 03 (Agent Prompt Specs) | 4 agent system prompts and schemas | When and how each agent is invoked during the lifecycle |
| Doc 15 (UNID Redaction) | Redaction mechanism and lifecycle | Which lifecycle steps trigger UNID redaction |
| Doc 16 (Case Directory Schema) | Directory naming and structure | When each subdirectory is created during the lifecycle |
| Doc 17 (Setup Workflow) | Application configuration | Prerequisite — app must be set up before any case work |
