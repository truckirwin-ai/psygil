# Psygil — Stage 0: Onboarding Production Specification

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Production-Ready Specification
**References:** Case Lifecycle Spec (doc 18), Intake/Onboarding Spec (doc 12), Case Directory Schema (doc 16), UNID Redaction (doc 15), Agent Prompt Specs (doc 03)

---

## Table of Contents

1. [Stage Overview](#stage-overview)
2. [Step 0.1: Referral Receipt & Case Creation](#step-01-referral-receipt--case-creation)
3. [Step 0.2: Informed Consent](#step-02-informed-consent)
4. [Step 0.3: Biopsychosocial History (Onboarding Form)](#step-03-biopsychosocial-history-onboarding-form)
5. [Step 0.4: Collateral Document Upload](#step-04-collateral-document-upload)
6. [Step 0.5: Advancement to Testing](#step-05-advancement-to-testing)
7. [Error Handling & Edge Cases](#error-handling--edge-cases)
8. [IPC Contracts](#ipc-contracts)
9. [Data Model](#data-model)

---

## Stage Overview

### What Onboarding Means Clinically

Stage 0: Onboarding is the pre-evaluation phase where the clinician establishes the case, obtains informed consent, and gathers baseline psychosocial history. No formal evaluation work occurs in this stage — no testing is administered, no formal interviews are conducted, no diagnostic formulations are made. The stage comprises five discrete steps:

1. Referral receipt and case creation (Intake form)
2. Informed consent documentation
3. Biopsychosocial history collection (Onboarding form)
4. Collateral document receipt and import
5. Validation and advancement to Testing stage

### What Onboarding Accomplishes

By the end of Stage 0, the clinician has:
- Created a formal case file with patient identification and referral context
- Obtained signed informed consent from the patient
- Collected comprehensive psychosocial history from the patient
- Verified accuracy of reported history against clinical observation
- Stored all necessary pre-evaluation documentation

### Entry Condition

A case enters Onboarding when:
- The clinician has received a referral (externally) or the patient has presented for evaluation
- The clinician has decided to accept the case (competency, availability, no conflicts confirmed)
- The clinician opens the application and creates the case via the Intake form

### Exit Condition

A case exits Onboarding and enters Testing when:
- The Intake form is complete and signed consent is on file
- The Biopsychosocial history has been completed (patient self-report) and clinician-verified
- All referral questions have been documented
- The clinician clicks "Advance to Testing" or administers the first test

### Pipeline Indicator

While a case is in Stage 0, the pipeline indicator in the UI displays "Onboarding" with a blue background.

---

## Step 0.1: Referral Receipt & Case Creation

### Overview

This step captures the initial referral information and creates the case file in the application. The Intake form is a lightweight modal designed to be completed quickly by front desk staff or the clinician, capturing only the information necessary to establish a case and schedule the first appointment.

### How the Intake Modal Works

**Trigger:** Clinician or front desk staff clicks "Intake" in the titlebar

**Modal Properties:**
- Overlay modal (not a tab)
- Renders on top of the main application
- Max width: 880px
- Scrollable body
- Sticky header with form title ("New Case Intake") and X close button
- Background overlay darkens the main application (z-index management)
- Closes via: X button, Escape key, or "Save & Continue" button

**Modal Behavior:**
- Patient can close without saving via X or Escape (draft data not persisted)
- "Save Draft" button persists form state to SQLCipher with status `draft`
- "Save & Continue to Onboarding" saves the intake, creates the case, and opens the Onboarding modal automatically

### Referral Source Toggle

The first interactive element in the Intake form is a toggle that determines which subsequent sections appear:

| Toggle State | Sections Shown | Sections Hidden |
|--------------|----------------|-----------------|
| **Referral** (Court / Attorney / Physician / Insurance) | Section A (Patient Contact), Section B (Referral Info), Section D (Insurance) | Section C (Self-Report Concerns) |
| **Self-Referred / Walk-in** | Section A (Patient Contact), Section C (Presenting Concerns), Section D (Insurance) | Section B (Referral Info) |

**Default state:** "Referral" (most cases)

**Why the toggle:** The referral source determines what contextual information is needed. A court-ordered CST evaluation needs different documentation than a patient who walks in with depression concerns.

### Section A: Patient Contact Information

All fields required unless marked Optional.

| Field | Type | Validation | Required | Notes |
|-------|------|-----------|----------|-------|
| Last Name | text (50 chars) | Non-empty, alphanumeric + hyphens/apostrophes | Yes | Used in directory naming (hyphens replace spaces) |
| First Name | text (50 chars) | Non-empty | Yes | Used in directory naming |
| Middle Name / Initial | text (50 chars) | Alphanumeric + apostrophes | No | Stored for identification but not used in directory name |
| Date of Birth | date picker | ISO 8601, past date only, not before 1900 | Yes | Used to calculate age; validated against today's date |
| Age | number (read-only, auto-calculated) | Calculated from DOB | Yes | Displays as integer years |
| Gender | dropdown or radio | "Male", "Female", "Non-binary", "Decline" | Yes | Single selection; affects consent language slightly |
| Street Address | text (100 chars) | Non-empty | Yes | Stored for contact and case records |
| City | text (50 chars) | Non-empty | Yes | Required for full address; not redacted in final reports |
| State | dropdown (US states) | Standard state abbreviation | Yes | Two-character state code |
| ZIP | text (10 chars) | Format: 5 digits or 5+4 format (12345 or 12345-6789) | Yes | Validated before save |
| Phone | tel | Format: (XXX) XXX-XXXX or 10-digit equivalent | Yes | Primary contact; validated for 10-digit US number |
| Email | email | Standard email format | No | Optional contact method |
| Preferred Contact Method | dropdown | "Phone", "Email", "Letter", "No Preference" | No | Guidance for scheduling next appointment |
| Emergency Contact Name | text (50 chars) | Non-empty | Yes | Full name of emergency contact person |
| Emergency Contact Relationship | text (20 chars) | E.g., "Spouse", "Sister", "Friend" | Yes | Relationship to patient |
| Emergency Contact Phone | tel | Format: (XXX) XXX-XXXX | Yes | Validated as 10-digit US number |

**Validation Behavior:**
- Required fields display an asterisk (*) and are validated on form submission
- Date of Birth picker prevents selection of future dates and dates before 1900
- Phone numbers are parsed to extract 10-digit component and validate; stored in database as entered
- ZIP code must be 5 or 9 digits (format validated but not validated against US database)
- Form cannot be submitted until all required fields have non-empty values
- If validation fails, the first invalid field is focused and an inline error message appears

### Section B: Referral Information (Conditional — Referral Mode Only)

Appears only when toggle is set to "Referral". All fields conditional on referral source type except Referring Party Type and Name.

| Field | Type | Validation | Required if Referral | Notes |
|-------|------|-----------|--------|-------|
| Referring Party Type | dropdown | "Court", "Attorney", "Physician", "Insurance", "Other" | Yes | Controls conditional display of subsequent fields |
| Referring Party Name / Office | text (100 chars) | Non-empty | Yes | Judge's name, law office name, hospital name, insurance company name |
| Referring Party Address | text (100 chars) | Non-empty | Yes | Full mailing address for future report delivery |
| Referring Party Phone | tel | (XXX) XXX-XXXX | Yes | For communication and follow-up |
| Referring Party Email | email | Standard format | No | Optional contact method |
| Court / Case Number | text (50 chars) | Non-empty | Conditional if Court | Required if "Court" selected; stored for later reference |
| Judge / Assigned Court | text (50 chars) | Non-empty | Conditional if Court | Judge's name or court designation |
| Attorney of Record | text (50 chars) | Non-empty | Conditional if Attorney | Attorney name; may be different from referring party |
| Attorney Phone | tel | (XXX) XXX-XXXX | Conditional if Attorney | Contact for defense/prosecution |
| Attorney Email | email | Standard format | No | Optional |
| Reason for Referral / Evaluation Requested | textarea (1000 chars) | Non-empty, should describe evaluation type and legal question | Yes | E.g., "CST evaluation re: charges of assault; defendant has history of delusions" |
| Complaint / Charges / Legal Matter | textarea (1000 chars) | Non-empty | Yes | Specific charges or legal issue; used in referral questions section later |
| Supporting Documents Already Received | textarea (500 chars) | Optional text describing documents | No | E.g., "Court order, arrest report, prior evaluation"; helps track completeness |
| Court Deadline / Due Date | date picker | Future date from today | No | When report is due; may trigger internal deadline reminders |
| Additional Notes from Referring Office | text (500 chars) | Optional | No | Any context from the referring party |

**Conditional Logic:**
- If Referring Party Type = "Court": Court/Case Number, Judge/Assigned Court fields become required
- If Referring Party Type = "Attorney": Attorney Name, Attorney Phone fields become required
- If Referring Party Type = "Physician": These fields are hidden; Insurance/billing fields become more prominent
- If Referring Party Type = "Other": All attorney/court fields are hidden

### Section C: Self-Referred Presenting Concerns (Conditional — Self-Referred Mode Only)

Appears only when toggle is set to "Self-Referred / Walk-in".

| Field | Type | Validation | Required | Notes |
|-------|------|-----------|----------|-------|
| Primary Complaint — In Your Own Words | textarea (1000 chars) | Non-empty | Yes | Patient's chief complaint in their own language; will be incorporated into referral questions |
| When Did These Concerns Begin? | textarea (500 chars) | Non-empty | Yes | Timeline and onset; critical context for evaluation |
| Has Anything Made It Better or Worse? | textarea (500 chars) | Optional | No | Factors that modify symptoms; helps with functional assessment |
| Are You Currently Safe from Harm? | textarea (500 chars) | Non-empty | Yes | Safety screening; if patient indicates active suicidality or homicidality, trigger warning in UI and require clinician review before proceeding |
| Previous Treatment or Evaluation | textarea (500 chars) | Optional | No | Prior mental health care, hospitalizations, prior evals |
| Who Recommended You Come In? | text (100 chars) | Optional | No | Referring party name (PCP, therapist, family member) |
| Primary Care Physician Name | text (50 chars) | Optional | No | For medical history coordination |

**Safety Screening:**
If the patient's response to "Are You currently safe from harm?" contains keywords like "suicidal", "kill myself", "harm", "overdose", "cut", "jump", the form displays a prominent warning: "⚠️ Safety Concern Flagged. Clinician review required before proceeding." The form can still be saved, but a flag is set in the database and the clinician receives a notification on next login.

### Section D: Insurance & Billing

Available in both Referral and Self-Referred modes.

| Field | Type | Validation | Required | Notes |
|-------|------|-----------|----------|-------|
| Insurance Carrier | text (50 chars) | Non-empty | No | Insurance company name; optional (many evaluations self-pay) |
| Policy / Member ID | text (50 chars) | Non-empty | Conditional | Required if Insurance Carrier provided |
| Group Number | text (50 chars) | Non-empty | No | Optional; helps with insurance verification |
| Policyholder Name (if not patient) | text (50 chars) | Non-empty | No | Parent, spouse, or other responsible party |
| Relationship to Patient | dropdown or text | E.g., "Parent", "Spouse", "Self" | Conditional | Required if Policyholder Name provided |

### Case Number Generation Algorithm

When "Save & Continue" is clicked and all validation passes:

1. Query SQLCipher `cases` table for the maximum `case_number` for the current year (YYYY)
2. Extract the numeric portion (after the hyphen): `2026-0147` → extract `0147`
3. Increment by 1: `0147` → `0148`
4. Zero-pad to 4 digits: `0148` (already 4 digits, no change; if 47 → 0047)
5. Prepend year and hyphen: `2026-0148`

**Algorithm Pseudocode:**
```
maxCaseNumber = SELECT MAX(case_number) FROM cases WHERE case_number LIKE '2026-%'
if maxCaseNumber is NULL:
    nextNum = '2026-0001'
else:
    numericPart = extract digits after hyphen from maxCaseNumber
    nextNum = '2026-' + zero_pad_to_4(parse_int(numericPart) + 1)

return nextNum
```

**Example Sequence:**
```
2026-0001, 2026-0002, ..., 2026-0147, 2026-0148
```

When the calendar year changes (Jan 1, 2027), a new sequence begins: `2027-0001`.

### Case Directory Creation Sequence

After case number is generated, the following operations occur atomically (all or none):

1. **Generate directory name:**
   - Format: `{case_number}_{first_initial}.{last_name}`
   - Example: `2026-0148_S.Williams`
   - Rules:
     - Case number: as generated above
     - First initial: uppercase single character from First Name
     - Last name: as entered in form, preserving capitalization and apostrophes
     - Spaces in last name replaced with hyphens: `Van Horn` → `Van-Horn`
     - Invalid filesystem characters (`/ \ : * ? " < > |`) stripped entirely
   - Result: `2026-0148_S.Williams` (or `2026-0165_Y.O'Brien` if applicable)

2. **Create case directory structure on disk:**
   ```
   {project_root}/cases/2026-0148_S.Williams/
   ├── intake/
   ├── referral/
   └── audit/
   ```
   - Parent directory: `{project_root}/cases/`
   - Creates three subdirectories: `intake/`, `referral/`, `audit/`
   - Permissions: owner read/write/execute, group/others read only (configurable per practice)
   - If directory already exists (collision, extremely rare), throw error and show user: "Case directory already exists. Contact administrator."

3. **Write `case.json` manifest:**
   ```json
   {
     "caseNumber": "2026-0148",
     "directoryName": "2026-0148_S.Williams",
     "created": "2026-03-22T14:30:00Z",
     "lastModified": "2026-03-22T14:30:00Z",
     "patient": {
       "firstName": "Samantha",
       "middleInitial": "L",
       "lastName": "Williams",
       "dateOfBirth": "1989-07-15",
       "age": 36,
       "gender": "Female"
     },
     "evaluation": {
       "type": null,
       "referralSource": "Court",
       "referralDate": "2026-03-20",
       "deadline": "2026-04-30",
       "jurisdiction": "Denver District Court",
       "charges": "DUI (.15 BAC)",
       "referringParty": "Public Defender's Office"
     },
     "pipeline": {
       "currentStage": "Onboarding",
       "stageHistory": [
         {"stage": "Onboarding", "entered": "2026-03-22T14:30:00Z", "completed": null}
       ]
     },
     "clinical": {
       "sessions": 0,
       "totalHours": 0,
       "severity": null,
       "diagnosis": null,
       "diagnosticCode": null,
       "feigning": null,
       "opinion": null
     },
     "testing": {
       "instruments": [],
       "scoringComplete": false,
       "validityStatus": null
     },
     "report": {
       "status": null,
       "currentVersion": null,
       "evaluator": null,
       "signedDate": null
     }
   }
   ```
   - File location: `{project_root}/cases/2026-0148_S.Williams/case.json`
   - Formatted as valid JSON (indented for readability, not minified)
   - All null fields are explicitly null, not omitted

4. **Create SQLCipher case record:**
   Insert into `cases` table:
   ```sql
   INSERT INTO cases (
     id, case_number, directory_name, patient_first_name, patient_last_name,
     patient_dob, patient_age, patient_gender,
     referral_type, referral_source, referral_date, court_deadline,
     referral_reason, charges_complaints, referring_party_name,
     court_case_number, judge_court, attorney_name, attorney_phone,
     insurance_carrier, policy_id,
     evaluation_type, current_stage, status,
     created_at, updated_at
   ) VALUES (
     'auto-uuid', '2026-0148', '2026-0148_S.Williams', 'Samantha', 'Williams',
     '1989-07-15', 36, 'Female',
     'referral', 'Court', '2026-03-20', '2026-04-30',
     'DUI evaluation', 'DUI (.15 BAC)', 'Public Defender Office',
     '2026-CV-001234', 'Denver District Court', 'Sarah Mitchell', '(720) 555-0123',
     NULL, NULL,
     NULL, 'Onboarding', 'active',
     datetime('now'), datetime('now')
   );
   ```
   - `id`: auto-generated UUID (SQLite `lower(hex(randomblob(16)))`)
   - All contact information from Intake form stored in case record
   - `current_stage`: always 'Onboarding' at creation
   - `status`: always 'active' (cases never deleted, only archived)

5. **Initialize audit trail:**
   Create `{project_root}/cases/2026-0148_S.Williams/audit/audit_trail.jsonl`
   - Start with first entry:
   ```json
   {"timestamp":"2026-03-22T14:30:00Z","user":"Dr. Truck Irwin","action":"case_created","details":{"caseNumber":"2026-0148","directoryName":"2026-0148_S.Williams","referralSource":"Court","referralType":"referral"}}
   ```
   - File format: JSONL (JSON Lines — one JSON object per line, newline-delimited)
   - Append-only: all subsequent actions appended to this file
   - Entries include: timestamp (ISO 8601 UTC), user (from practice profile), action, details object

6. **Create intake record in SQLCipher:**
   Insert into `patient_intake` table:
   ```sql
   INSERT INTO patient_intake (
     id, case_id, referral_type,
     last_name, first_name, middle_name, dob, age, gender,
     street_address, city, state, zip, phone, email,
     preferred_contact, emergency_contact, emergency_phone,
     referring_party_type, referring_party_name, referring_party_address,
     referring_party_phone, referring_party_email,
     court_case_number, judge_court, attorney_name, attorney_phone, attorney_email,
     referral_reason, complaint_charges, supporting_docs, court_deadline, referral_notes,
     insurance_carrier, policy_id, group_number,
     status, created_at, updated_at
   ) VALUES (
     'auto-uuid', {case_id}, 'referral',
     'Williams', 'Samantha', 'L', '1989-07-15', 36, 'Female',
     '1456 Oak Street', 'Denver', 'CO', '80204', '(720) 555-0147', 'samantha.williams@email.com',
     'Phone', 'Robert Williams (brother)', '(720) 555-0200',
     'Court', 'Public Defender Office', '123 Justice Center Blvd, Denver, CO',
     '(720) 555-0150', 'defender@pd.denver.gov',
     '2026-CV-001234', 'Judge Patricia Gomez', 'Sarah Mitchell', '(720) 555-0123', 'smitchell@pd.denver.gov',
     'DUI evaluation per court order', 'DUI with .15 BAC', 'Court order received via fax 3/20/2026', '2026-04-30', NULL,
     'Aetna', '987654321', NULL,
     'complete', datetime('now'), datetime('now')
   );
   ```

### UI Behavior After Case Creation

Immediately after "Save & Continue" button succeeds:

1. **Intake modal closes**
2. **Case appears in file tree (Column 1):**
   - New entry added at the appropriate alphabetical position under case list
   - Display: "Williams, Samantha L. #2026-0148"
   - Icon: folder icon with case badge
   - Clickable to expand and show case contents
3. **Case appears in Dashboard:**
   - New row in "Active Cases" table
   - Displays: Case #, Patient Name, Referral Source, Status (Onboarding), Created Date
4. **Onboarding modal automatically opens:**
   - Demographics fields pre-populated from intake (First Name, Last Name, DOB, Address, etc.)
   - Patient sees the Biopsychosocial form ready to fill out
   - Clinician can cancel and save draft, or continue

---

## Step 0.2: Informed Consent

### Overview

Before any evaluation activity occurs, the clinician must obtain informed consent from the patient. This is a legal and ethical requirement. The informed consent document must be specific to the evaluation type and must address the limits of confidentiality in the forensic or clinical context.

### Template Generation from Practice Profile

When the clinician clicks "Consent" in the case tree or when proceeding through the Onboarding workflow, the application generates a pre-populated consent form:

1. **Application retrieves consent template:**
   - Templates stored at: `{project_root}/templates/consent_forms/`
   - Two templates available:
     - `consent_forensic.docx` — for forensic evaluations (CST, custody, risk assessment, etc.)
     - `consent_clinical.docx` — for clinical evaluations (diagnostic assessment without legal component)
   - Template selected based on Evaluation Type in `case.json` (determined later during Testing stage, but template choice can be made by clinician in Onboarding)

2. **Application pre-populates merge fields:**
   - Patient name (First, Last, DOB)
   - Case number
   - Evaluation type (if known)
   - Referral source type
   - Scope of evaluation (from referral reason)
   - Clinician name and credentials (from practice profile)
   - Practice address and contact information
   - Date of generation
   - All from SQLCipher `cases` and `patient_intake` records

3. **Evaluation-Type-Specific Consent Language:**

   **Forensic Consent** includes:
   - Explicit statement that this is a forensic evaluation (not therapeutic)
   - Clear statement of who retained the evaluator
   - Explanation of limited confidentiality (legal mandate to produce report, discoverable)
   - Statement that information will be shared with referring attorney/court
   - No doctor-patient privilege
   - Patient's right to decline (but consequences noted)
   - Explanation of what will be done with the evaluation (report, possible testimony)
   - Warning that results may be adverse to patient's interests

   **Clinical Consent** includes:
   - Explanation of evaluation purpose (diagnostic assessment)
   - Limits of confidentiality (mandated reports for danger to self/others, abuse)
   - Patient's right to access records
   - HIPAA authorization (if applicable)
   - Information sharing practices
   - Fees and payment responsibility

4. **Limits of Confidentiality Section:**
   - Forensic: "This is not a confidential communication. Results will be disclosed to [referring party]. The evaluation is subject to discovery and may be used in legal proceedings."
   - Clinical: "Confidentiality is protected with these exceptions: (1) duty to protect if you are at imminent risk of harm, (2) duty to warn if someone else is at risk, (3) court order or legal mandate, (4) abuse of children/vulnerable adults."
   - Both templates include state-specific language (varies by jurisdiction configured in setup)

5. **Document Storage and Editing:**
   - Generated consent document opens in the OnlyOffice editor (column 2)
   - Clinician can review and make any edits (e.g., adding practice-specific language, clarifying fee structure)
   - Document not yet saved to case directory

### Print, Sign, Scan, Import Workflow

The physical signature process:

1. **Clinician prints the consent form:**
   - From the OnlyOffice menu: File → Print
   - Or: generates PDF for printing: File → Export as PDF
   - Printed copy given to patient in person at the first appointment

2. **Patient reads and signs:**
   - Clinician reviews key points with patient (optional but recommended)
   - Patient signs and dates the consent form
   - Clinician may countersign (practice policy)
   - Clinician keeps signed original in case file

3. **Clinician scans or photographs the signed consent:**
   - Scanner: high-quality PDF or image file (recommended)
   - Photo: smartphone photo saved as JPG/PNG (acceptable if legible)
   - File stored temporarily on clinician's device

4. **Clinician imports the signed consent into the case:**
   - Within the case (File Tree → Case → Consent), clinician clicks "Import Signed Consent"
   - File browser opens; clinician selects the scanned/photographed PDF or image
   - Application moves the file to:
     - `{project_root}/cases/2026-0148_S.Williams/intake/consent_signed.pdf`
   - Updates `case.json`:
     ```json
     "consent": {
       "consentDate": "2026-03-22",
       "consentType": "forensic",
       "onFile": true,
       "uploadedDate": "2026-03-22T15:45:00Z"
     }
     ```
   - Audit trail entry:
     ```json
     {"timestamp":"2026-03-22T15:45:00Z","user":"Dr. Truck Irwin","action":"consent_uploaded","details":{"file":"consent_signed.pdf","fileName":"Consent_Signed_Williams_S_2026-0148.pdf"}}
     ```

### Consent Status Tracking

In SQLCipher `cases` table, add field:
- `consent_on_file` (boolean, default false)
- `consent_date` (date, nullable)
- `consent_type` (text: 'forensic' | 'clinical' | null)

In file tree UI:
- If `consent_on_file = false`, a warning badge appears next to the case name: "⚠️ No Consent"
- In Clinical Overview, a warning banner appears: "Informed consent not yet on file. Obtain consent before proceeding with evaluation."

### Warning Behavior If Consent Missing

When clinician attempts to advance from Onboarding to Testing:

1. Application checks: `cases.consent_on_file = true`
2. If false, modal dialog appears:
   ```
   ⚠️ Informed Consent Not on File

   You are attempting to advance this case to Testing without signed
   informed consent. While Psygil does not prevent this (evaluations
   can proceed with oral consent in some circumstances), best practice is
   to obtain written consent before testing.

   [Cancel] [Proceed Without Consent] [Go Back to Consent]
   ```
3. If "Proceed Without Consent": case advances, but audit trail records:
   ```json
   {"timestamp":"...","action":"case_advanced_no_consent","details":{"fromStage":"Onboarding","toStage":"Testing","consentStatus":"missing"}}
   ```
4. If "Cancel" or "Go Back to Consent": returns to case without advancing

**Clinical Note:** The warning exists to encourage best practice. Psygil does not prevent evaluation without consent because in some circumstances (e.g., court-ordered evaluation where patient refuses to sign), evaluation can proceed with documented refusal. The audit trail records the clinician's decision.

---

## Step 0.3: Biopsychosocial History (Onboarding Form)

### Overview

The Biopsychosocial History form is the comprehensive patient history collection aligned with AAPL Forensic Assessment Guidelines and standard clinical intake standards. This is the longest form in the application, designed for patient self-report and clinician verification.

### Key Design Principle: Narrative Text Only

All patient-facing clinical questions use **narrative text input fields only**. No checkboxes, no radio buttons, no dropdowns for clinical content.

**Why:** Research demonstrates that checkbox-based self-report produces significantly higher over-reporting rates (Anvari et al., 2023; PNAS 2024). Open-ended narrative responses reduce response-set bias and produce more accurate clinical baselines. A patient asked "Do you have a family history of depression?" via checkbox will over-endorse compared to being asked "Describe your family's mental health history in your own words."

**Application:** When designing UI forms for patient input, all clinical content must use textarea fields (multi-line text). Demographic fields (age, gender, education level) can use dropdowns or radio buttons because they are factual, not interpretive.

### Mode 1: Patient Self-Report

**Initial state:** Form displays in Patient Self-Report mode.

**Instructions:** At the top of the form:
"Please provide narrative descriptions of your background and history. Take your time to be thorough and accurate. There are no right or wrong answers — we want to understand your story in your own words. You can save your progress and come back later if needed. When you've completed the form, your clinician will review your responses with you."

**Sections (10 major sections):**

#### Section 1: Demographics & Contact (Auto-populated, Review Only)
- Name (read-only, from intake)
- Date of birth (read-only, from intake)
- Age (read-only, auto-calculated)
- Gender (read-only, from intake)
- Current address (read-only, from intake)
- **New fields to add:**
  - Marital / Relationship Status (dropdown: Single, Married, Divorced, Widowed, Partnered, Other)
  - Number of dependents / children (text: "0", "2", "3 children ages 4, 7, 12")
  - Current living situation (textarea: "Live alone", "Live with spouse and two children", "Live in group home", etc.)
  - Primary language (dropdown: English, Spanish, Vietnamese, Arabic, Other)
  - Language interpreter needed? (yes/no)

#### Section 2: Primary & Secondary Complaints
- **Primary Complaint — Describe in Detail** (textarea, required)
  - Prompt: "What is the main concern that brings you in for evaluation today? Describe it in your own words."
  - Example patient response: "I've been experiencing episodes where I feel like people are watching me and I can't trust anyone around me. It started about a year ago and has been getting worse."

- **Secondary Concerns** (textarea, optional)
  - Prompt: "Are there other concerns or issues you'd like the evaluator to know about?"
  - Example: "I also have trouble sleeping and I've been having a hard time at work."

- **Onset & Timeline** (textarea, required)
  - Prompt: "When did these concerns start? What was going on in your life at that time?"
  - Example: "It started last March, right after I lost my job. At first I thought it was just stress, but it didn't get better."

#### Section 3: Family History
- **Family of Origin** (textarea, required)
  - Prompt: "Describe your family background — where you grew up, who raised you, what your family was like."
  - Example: "I grew up in Chicago with my mom and two younger brothers. My parents divorced when I was 8. I stayed with my mom. We didn't have a lot of money but we were close."

- **Family Mental Health History** (textarea, required)
  - Prompt: "Has anyone in your family ever had mental health problems, psychiatric treatment, or been hospitalized for mental health reasons? Please describe who and what happened."
  - Example: "My uncle had depression and was hospitalized twice in the 90s. My grandmother drank a lot. My mom sees a therapist for anxiety."

- **Family Medical History** (textarea, optional)
  - Prompt: "Are there any serious medical illnesses that run in your family? Any surgeries, chronic conditions, or health problems?"
  - Example: "My dad had a heart attack at 62. My grandmother had diabetes. I don't think there's any cancer in the family."

- **Current Family Relationships** (textarea, optional)
  - Prompt: "How do you get along with your family now? Who are you close to? Who do you not get along with?"
  - Example: "I'm close to my mom and one brother. I don't talk to my dad much — he was never around after the divorce."

#### Section 4: Education History
- **Highest Level of Education** (dropdown: "Less than high school", "High school diploma", "Some college", "Associate's degree", "Bachelor's degree", "Master's degree", "Doctorate or professional degree")

- **Schools Attended** (textarea, optional)
  - Prompt: "What schools did you attend? Do you remember the names and approximate years?"
  - Example: "Lincoln Elementary (K-5, Chicago), Roosevelt Middle (6-8), Washington High (2005-2009)"

- **Academic Experience** (textarea, required)
  - Prompt: "How were you as a student? How did you do in school? Any difficulties, suspensions, or notable achievements?"
  - Example: "I did okay in elementary school, maybe B's and C's. In middle school I started skipping classes and got suspended once for fighting. I dropped out of high school in 10th grade."

#### Section 5: Employment & Work History
- **Current Employment Status** (dropdown: "Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Disabled/on disability", "Retired", "Student", "Other")

- **Current / Most Recent Employer & Role** (textarea, optional)
  - Prompt: "Where do you work (or most recently worked)? What is your job title and how long have you been there?"
  - Example: "I work at Home Depot as a cashier. I've been there for 2 years."

- **Work History Summary** (textarea, required)
  - Prompt: "Tell me about your work history. What jobs have you had? How long did you stay in each job? How did you get along with coworkers and supervisors?"
  - Example: "I've worked retail since I was 18. I started at Walmart, worked there for 3 years, then moved to Best Buy, got fired after a conflict with my manager, worked at Target for a year, then Home Depot. I usually get along okay but I've had some conflicts."

- **Military Service** (textarea, optional)
  - Prompt: "Did you ever serve in the military? If so, when? What branch? What was your rank? Any combat experience?"
  - Example: "I served in the Army Reserve from 2008-2014. I was a mechanic. Never deployed."

#### Section 6: Medical & Health History
- **Current Medical Conditions** (textarea, required)
  - Prompt: "Do you have any medical illnesses or conditions right now? Are you being treated for anything?"
  - Example: "I have high blood pressure and my doctor says I'm prediabetic. I take medication for both."

- **Current Medications** (textarea, required)
  - Prompt: "What medications are you taking right now? Include the name, dose, and how often you take it."
  - Example: "Lisinopril 10mg once daily for blood pressure. Metformin 500mg twice daily for blood sugar."

- **Surgeries & Hospitalizations** (textarea, optional)
  - Prompt: "Have you ever had surgery or been hospitalized? What for? When?"
  - Example: "Had my appendix out when I was 12. Broke my arm in a car accident at 19 and was in the hospital for 3 days."

- **Head Injuries / Traumatic Brain Injury (TBI)** (textarea, optional)
  - Prompt: "Have you ever had a significant head injury, concussion, or been knocked unconscious? If so, describe."
  - Example: "I was in a car accident at 19 and hit my head hard. I was unconscious briefly and had a bad headache for weeks."

- **Sleep Quality** (dropdown: "Excellent", "Good", "Fair", "Poor") + optional narrative (textarea):
  - Prompt: "How is your sleep? Do you fall asleep easily? Do you sleep through the night?"
  - Example: "I have a lot of trouble falling asleep. It takes me 1-2 hours. I wake up multiple times."

- **Appetite / Eating Patterns** (textarea, optional)
  - Prompt: "Has your appetite changed? Do you eat regular meals? Any difficulty with eating?"
  - Example: "My appetite has been poor for the last few months. Sometimes I forget to eat. I've lost about 10 pounds."

#### Section 7: Mental Health History
- **Previous Mental Health Treatment** (textarea, required)
  - Prompt: "Have you ever seen a therapist, counselor, or psychiatrist? When? For how long? What did you see them for?"
  - Example: "I saw a therapist in college for a few months because I was depressed. Later I saw a psychiatrist for anxiety in 2015-2016."

- **Previous Diagnoses** (textarea, required)
  - Prompt: "Has a doctor or mental health professional ever told you that you had a specific diagnosis? What was it? When?"
  - Example: "A therapist said I had depression. A psychiatrist said anxiety and maybe bipolar, but I'm not sure about that."

- **Psychiatric Medications Past & Present** (textarea, required)
  - Prompt: "Have you ever taken psychiatric medications (like antidepressants, anti-anxiety meds, antipsychotics, mood stabilizers)? List each one, the dose, how long you took it, and why you took it."
  - Example: "Prozac 20mg (2008-2009, for depression), Xanax as needed (2015-2020, for anxiety), Wellbutrin 300mg (2020-present, for depression)."

- **History of Self-Harm or Suicidal Thoughts** (textarea, required)
  - Prompt: "Have you ever had thoughts of hurting yourself or ending your life? Have you ever actually hurt yourself? Please describe."
  - Example: "I've thought about it a few times when I was really depressed, but I never actually tried. I cut my arm once when I was 16, but that was just once."

- **History of Violence or Harm to Others** (textarea, required)
  - Prompt: "Have you ever physically hurt someone else, gotten into fights, or had violent incidents? Please describe."
  - Example: "I got in fights in high school a few times. I've been in one serious altercation with a coworker."

#### Section 8: Substance Use History
- **Alcohol Use** (textarea, required)
  - Prompt: "Do you drink alcohol? If so, how much, how often, and when did you start drinking? Have you ever had problems related to drinking?"
  - Example: "I drink beer on weekends with friends, maybe 3-4 beers. I drink more when I'm stressed. Never had a DUI or anything, but my mom says I drink too much."

- **Drug / Substance Use** (textarea, required)
  - Prompt: "Have you ever used drugs like marijuana, cocaine, heroin, methamphetamine, opioids, or other substances? If so, describe: what you used, how much, how often, and when."
  - Example: "I smoked marijuana in high school and college, pretty regularly. I tried cocaine a few times in my 20s but didn't like it. I don't use hard drugs now."

- **Treatment for Substance Use** (textarea, optional)
  - Prompt: "Have you ever received treatment for substance use? What kind? Was it helpful?"
  - Example: "I went to AA for a few months in 2015 but I didn't stick with it."

#### Section 9: Legal & Forensic History
- **Prior Arrests & Convictions** (textarea, required)
  - Prompt: "Have you ever been arrested or convicted of a crime? Please list each incident: what you were arrested for, when, what happened (convicted, charges dropped, etc.), and any sentence you received."
  - Example: "Arrested for shoplifting at age 18, charges dropped. Arrested for DUI in 2022, pled guilty, got 6 months probation."

- **Incarceration History** (textarea, required)
  - Prompt: "Have you ever been in jail or prison? If so, for how long and for what?"
  - Example: "No jail time, just probation."

- **Probation / Parole** (textarea, optional)
  - Prompt: "Are you currently on probation or parole? If so, what are your conditions and who is your PO?"
  - Example: "I'm on probation until March 2025. My PO is James Rodriguez. I have to do random drug tests."

- **Protective Orders / Restraining Orders** (textarea, optional)
  - Prompt: "Has anyone ever gotten a protective order or restraining order against you? Has anyone threatened to?"
  - Example: "No."

#### Section 10: Recent History Leading to This Assessment
- **Describe the Events or Circumstances** (textarea, required)
  - Prompt: "What happened that led to you coming in for evaluation? For referrals: What is the specific incident or event related to the legal matter?"
  - Example: "I was arrested for DUI after I was pulled over at 2 AM. I had been drinking but I didn't think I was impaired. The officer did a breathalyzer and I blew a .15."

- **Current Stressors** (textarea, required)
  - Prompt: "What is stressing you out right now? What are the main pressures or problems in your life?"
  - Example: "The legal case is stressing me out. I might lose my job. My relationship is falling apart."

- **Goals for This Evaluation** (textarea, required)
  - Prompt: "What do you hope will come from this evaluation? What would you like the evaluator to know or understand?"
  - Example: "I want people to understand that I'm not a bad person. I made a mistake. I want to get my life back on track."

#### Additional Fields

- **Additional Information** (textarea, optional)
  - Prompt: "Is there anything else you'd like to tell the evaluator that we haven't asked about?"
  - Example: "I should mention that I recently started seeing a new therapist who has been really helpful."

### Mode 2: Clinician Interview Review Mode

**How to access:** Toggle switch at top of form: "Patient Self-Report" → "Clinician Interview Review"

**What changes:**
1. All patient-response fields become read-only (display as light gray background, non-editable)
2. Each section (1-10) now displays a **Clinician Verification Notes** field underneath
3. Section headers change from "Patient-Reported" badge to "Under Review" badge
4. Verification fields are full-width textareas for clinician note-taking

**Clinician Verification Notes** — One field per section:

| Section | Verification Field Label | Example Entry |
|---------|--------------------------|----------------|
| 1 | Demographics Verification | "Confirmed all demographics during intake interview. Patient reported age 36, confirmed DOB 7/15/1989." |
| 2 | Complaints Verification | "Patient elaborated on primary complaint during interview. Describes paranoid thoughts recurring several times per day, mostly at work. Affect became noticeably anxious when discussing this." |
| 3 | Family History Verification | "Significant discrepancy: Patient reported mother "has some anxiety," but during interview admitted mother has been psychiatrically hospitalized twice for depression. Patient initially downplayed this." |
| 4 | Education Verification | "Consistent with self-report. Confirmed dropped out in 10th grade. Some history of academic struggle evident in narrative." |
| 5 | Employment Verification | "Current employment status consistent with intake. Patient terminated from Target per narrative; appears to minimize conflict with supervisor." |
| 6 | Medical History Verification | "Patient reports high BP and prediabetes, both confirmed by review of recent labs (copies in collateral folder). Medications match patient self-report." |
| 7 | Mental Health Verification | "Therapy history broadly consistent. Patient minimizing prior psychiatric hospitalizations — mentioned as "just one time" in interview but hospital records (collateral) show 2 admissions." |
| 8 | Substance Use Verification | "Patient minimizes alcohol use ("just weekends"). During interview, wife later states he drinks daily. Needs clarification at next session." |
| 9 | Legal History Verification | "Detailed interview on arrests. Patient consistent on dates and charges. No additional incidents reported." |
| 10 | Recent History Verification | "Patient provides detailed account of DUI event; consistent with police report (collateral). High situational stress evident. Goals for eval reasonable." |

**Clinician Actions in Review Mode:**
1. Can add verification notes without editing patient responses
2. Can mark sections as "Reviewed & Consistent", "Reviewed with Discrepancies", or "Needs Follow-up"
3. Can edit patient response text (if needed for clarification during interview) — edit logged in audit trail
4. Can add footnotes to any specific response
5. "Save Verification Notes" button persists all notes to database

**Marking a Section as Reviewed:**
Each section displays a status indicator:
- None (default) — "Not yet reviewed"
- Green checkmark — "Reviewed & Consistent"
- Orange warning — "Reviewed with Discrepancies Noted"
- Blue info — "Needs Follow-up"

Clinician selects status after adding notes.

### AI Cleanup Flow: UNID Redaction Point 1

**When:** After the clinician completes the biopsychosocial history (patient self-report completed, clinician has reviewed and verified), the clinician clicks a button: "Clean Up & Finalize History"

**Flow:**

1. **Application gathers raw narrative text:**
   - Extracts all patient self-report textarea fields (Sections 2-10)
   - Combines into a single text document (maintains section headers)
   - Includes clinician verification notes if any were added

2. **UNID Redaction (see doc 15 for full details):**
   - Application calls Python sidecar via IPC: `pii:redact`
   - Sidecar uses Presidio + spaCy to detect all Protected Health Information (PHI)
   - Generates fresh UNID map (example: "Marcus Johnson" → PERSON_a7f3c2)
   - Returns redacted text with UNIDs replacing PHI
   - UNID map held in-memory on sidecar, not transmitted

3. **Send to Ingestor Agent:**
   - Application calls Claude API with redacted text and system prompt (Agent 1 from doc 03)
   - Ingestor Agent receives UNID-redacted narrative
   - Agent does NOT interpret or diagnose; instead:
     - Standardizes formatting (corrects spelling, grammar, abbreviations)
     - Structures timeline events chronologically
     - Extracts key dates and life events
     - Identifies completeness gaps
     - Flags inconsistencies or concerning statements
   - Agent returns cleaned text with UNIDs intact (no real PHI in output)

4. **Re-hydrate UNIDs back to real PHI:**
   - Application sends Ingestor Agent output to Python sidecar via IPC: `pii:rehydrate`
   - Sidecar replaces each UNID with original PHI value from the map
   - Example: "PERSON_a7f3c2 reported" → "Marcus Johnson reported"
   - Returns full-PHI cleaned text

5. **UNID Map Destruction:**
   - After re-hydration, Python sidecar destroys the UNID map (zeros memory, cannot be recovered)
   - Any subsequent request for UNID translation fails (UNID is no longer valid)

6. **Clinician Reviews Cleaned Version:**
   - Cleaned, re-hydrated text displayed in a read-only viewer in column 2
   - Alongside original patient self-report (for comparison)
   - Clinician can:
     - Review for accuracy
     - Make final edits (all edits logged)
     - Approve or request re-cleaning
   - Click "Approve Cleaned Version" button

7. **Three Versions Stored:**

   **a) Raw (patient self-report, unedited):**
   - Stored in SQLCipher `patient_onboarding` table, field `raw_text`
   - Never deleted, preserved for audit purposes
   - Not displayed in normal workflow (for audit/legal discovery only)

   **b) Clinician-Reviewed (with verification notes):**
   - Stored in SQLCipher as `clinician_reviewed_text`
   - Includes section-by-section verification notes from Step 0.3 Mode 2
   - Used internally for case management

   **c) AI-Cleaned (grammar corrected, re-hydrated):**
   - Stored as `intake/biopsychosocial.json` in case directory
   - This is the version used in report generation and clinical workflow
   - Contains full PHI (after re-hydration), encrypted at rest in SQLCipher

8. **Structured Data Extraction:**
   - As Ingestor Agent cleans the text, it also extracts structured data:
     - Timeline events (dates, events, sources)
     - Medications (name, dose, dates)
     - Family members mentioned (names, relationships)
     - Prior diagnoses mentioned (not confirmed, just what patient reported)
     - Key dates (hospitalizations, arrests, etc.)
   - Stored in `intake/demographics.json`:
   ```json
   {
     "timeline": [
       {"date": "1991-06-14", "event": "Patient born", "source": "patient_report"},
       {"date": "1999-03-15", "event": "Appendectomy", "source": "patient_report"},
       {"date": "2008-01-20", "event": "Started Prozac for depression", "source": "patient_report"},
       {"date": "2022-05-10", "event": "DUI arrest", "source": "patient_report"}
     ],
     "medications_mentioned": [
       {"name": "Lisinopril", "dose": "10mg", "frequency": "daily", "indication": "high blood pressure"},
       {"name": "Metformin", "dose": "500mg", "frequency": "twice daily", "indication": "blood sugar"}
     ],
     "family_members": [
       {"name": "PERSON_a7f3c2", "relationship": "mother", "notes": "has anxiety"},
       {"name": "PERSON_d1e84b", "relationship": "brother", "notes": "close relationship"},
       {"name": "PERSON_f29c71", "relationship": "uncle", "notes": "history of depression, hospitalized"}
     ],
     "prior_diagnoses_reported": [
       {"diagnosis": "Depression", "source": "therapist", "year": "2008"},
       {"diagnosis": "Anxiety", "source": "psychiatrist", "year": "2015"}
     ]
   }
   ```

9. **Audit Trail Entry:**
   ```json
   {"timestamp":"2026-03-22T16:30:00Z","user":"Dr. Truck Irwin","action":"biopsychosocial_cleaned","details":{"entityCount":14,"typeBreakdown":{"PERSON":8,"DATE":3,"PHONE":1,"ADDRESS":2},"uaidMapLifetimeMs":4200,"version":"cleaned_v1"}}
   ```

### Summary: Three Versions of Biopsychosocial History

| Version | Storage | Access | Purpose |
|---------|---------|--------|---------|
| **Raw (unedited)** | SQLCipher `patient_onboarding.raw_text` | Audit/discovery only | Proves what patient actually reported (forensically important) |
| **Clinician-Reviewed** | SQLCipher `patient_onboarding.clinician_reviewed_text` | Case management | Includes clinician verification notes and discrepancy flags |
| **AI-Cleaned (re-hydrated)** | `intake/biopsychosocial.json` + SQLCipher encrypted | Report generation, clinical workflow | Professional, formatted version with full PHI for use in report and case notes |

### Onboarding Form Actions

**Save Draft:** Persists current form state (patient self-report mode only) without triggering cleanup
- Status: `draft`
- Patient can return later and resume filling out form
- Email notification (optional) to clinician that intake is pending

**Clean Up & Finalize:** (After patient completes form and clinician reviews)
- Triggers UNID redaction → Ingestor Agent → re-hydration flow
- Opens cleanup review panel for clinician approval
- Status: `finalized`
- Case can now advance to Testing

---

## Step 0.4: Collateral Document Upload

### Overview

Collateral records are documents from external sources — court orders, medical records, prior evaluations, school records, police reports. These arrive throughout the case, often asynchronously. Psygil provides a flexible import and indexing system.

### Import Workflow

**Trigger:** Case is created or already in Onboarding stage; clinician or front desk staff receives a collateral document

**Process:**

1. **Click "Import Document":**
   - Located in file tree under Case → Collateral Records section
   - Or via Case menu: "Import Collateral Document"
   - File browser opens

2. **Select file from disk:**
   - Accepts: PDF, scanned images (JPG, PNG), Word docs (.docx)
   - File size limit: 50 MB per document
   - Multiple files can be selected at once

3. **For each document:**

   a) **Name the document:**
   - Pre-fill: filename from selected file (e.g., "Court_Order_2026.pdf")
   - Can be edited: dropdown list of standard names or custom text
   - Standard names (dropdown):
     - "Court Order"
     - "Medical Records"
     - "Prior Psychological Evaluation"
     - "School Records"
     - "Police Report"
     - "Jail Records"
     - "Witness Statement"
     - "Attorney Letter"
     - "Hospital Discharge Summary"
     - "Medication List"
     - "Custom..."

   b) **Categorize:**
   - Dropdown: "Court Document", "Medical Records", "Prior Evaluation", "School Records", "Police / Criminal", "Witness Statement", "Other"
   - Used for file tree organization

   c) **Set status:**
   - Dropdown: "Received", "Requested", "Pending"
   - If "Requested": clinician notes what was requested and when; triggers reminder if not received by deadline
   - If "Pending": similar reminder system

4. **File is copied to case directory:**
   - Path: `{project_root}/cases/2026-0148_S.Williams/collateral/`
   - Filename: standardized to avoid conflicts
   - Example: `Court_Order_2026-0148.pdf`, `MedicalRecords_County_Hospital_2026.pdf`

5. **Collateral index is updated:**
   - `collateral/collateral_index.json`:
   ```json
   {
     "collateral_documents": [
       {
         "documentId": "doc_abc123",
         "fileName": "Court_Order_2026-0148.pdf",
         "displayName": "Court Order",
         "category": "Court Document",
         "uploadDate": "2026-03-22T10:30:00Z",
         "status": "Received",
         "source": "Counsel's office (email 3/22)",
         "fileSize": 245623,
         "pages": 3,
         "summary": null,
         "extracted_data": null
       }
     ]
   }
   ```

### Document Categorization

| Category | Typical Documents | Special Handling |
|----------|------------------|-----------------|
| Court Document | Court orders, subpoenas, writs, judgments | Highest priority; deadline often associated |
| Medical Records | Hospital discharge summaries, progress notes, medication lists | May contain extensive PHI; UNID handled at extraction |
| Prior Evaluation | Prior psychological/psychiatric evaluations, prior testing | Critical for comparison; typically extracted by Ingestor Agent |
| School Records | Report cards, disciplinary records, IEP documents | May clarify developmental history |
| Police / Criminal | Police reports, arrest reports, incident summaries | Legal context; dates/charges extracted |
| Witness Statement | Letters from family, employers, treatment providers | Collateral opinions; may be summarized for interview prep |
| Other | Anything else | Indexed but not automatically processed |

### Optional Ingestor Agent Extraction

**Clinician choice:** For each collateral document, clinician can opt to run the Ingestor Agent to extract structured data

**Process (if clinician clicks "Extract Data"):**

1. Application converts PDF/image to text (PDF text extraction or OCR for images)
2. Applies UNID redaction (Redaction Point 1)
3. Sends redacted text to Ingestor Agent with request: "Extract structured data: dates, diagnoses, medications, test results, key facts"
4. Ingestor returns structured JSON
5. Re-hydrates UNIDs
6. Stores extracted data in `collateral/collateral_index.json` field: `extracted_data`
7. Extracted data becomes available for reference in Case Overview and interview prep

**Example Extraction Output:**
```json
{
  "documentId": "doc_abc123",
  "extractedData": {
    "dates": [
      {"date": "2023-05-15", "event": "Hospital admission for suicidal ideation"},
      {"date": "2023-05-22", "event": "Hospital discharge"}
    ],
    "diagnoses": ["Major Depressive Disorder", "Generalized Anxiety Disorder"],
    "medications": [
      {"name": "Sertraline", "dose": "100mg", "frequency": "daily"}
    ],
    "key_facts": [
      "Patient admitted for SI after argument with spouse",
      "No prior psychiatric history",
      "Discharged on outpatient therapy and meds"
    ]
  }
}
```

### Collateral Upload Timing

**Important:** Collateral upload is NOT gated to a specific stage. Documents can be imported:
- During Onboarding (pre-testing) when referral documents arrive
- During Testing as additional records trickle in
- During Interview when hospital records become available
- Throughout the case lifecycle

The clinician manages when documents arrive and when to import them. The application simply stores and indexes them.

### File Tree Display

In Column 1 (File Tree), collateral documents appear under the case:

```
📁 Johnson, Marcus D. #2026-0147
  📄 Clinical Overview
  📁 Collateral Records
    📄 Court Order (received)
    📄 Medical Records — County Hospital (received)
    📄 Hospital Discharge 2023 (received)
    📄 Prior Evaluation 2024 (requested)
  📁 Interviews
  ...
```

---

## Step 0.5: Advancement to Testing

### Overview

When the clinician determines that enough intake and referral information exists to begin formal evaluation, they advance the case from Onboarding to Testing. This triggers directory creation, status changes, and audit logging.

### Validation Rules

Before advancement is allowed, the application checks:

1. **Intake form is complete:**
   - All required fields in Sections A, B (or C if self-referred), D have values
   - Status in database: `patient_intake.status = 'complete'`
   - Validation: form can be saved even if incomplete; advancement requires completion

2. **Consent is on file (soft warning, not hard gate):**
   - Check: `cases.consent_on_file = true`
   - If false, warning modal appears (see Step 0.2 "Warning Behavior if Consent Missing")
   - Clinician can override with documented justification

3. **At least one referral question is documented:**
   - Check: `referral_questions` table has at least 1 row for this case
   - Referral questions can be inferred from:
     - Intake form: `referral_reason` field (auto-creates a referral question)
     - Clinician can add additional questions manually via Case → "Edit Referral Questions"
   - If none exist, warning: "Please document referral questions before advancing."

### Hard Gates vs Soft Warnings

| Validation | Type | Behavior |
|-----------|------|----------|
| Intake complete | Hard gate | Cannot advance without completion |
| Referral question documented | Hard gate | Cannot advance without at least 1 question |
| Consent on file | Soft warning | Warning modal, but clinician can override |

### Directory Creation on Advancement

When "Advance to Testing" is clicked and all validations pass:

1. **New directories created on disk:**
   ```
   {project_root}/cases/2026-0148_S.Williams/
   ├── collateral/              # (new)
   └── testing/                 # (new)
       └── scores/              # (new)
   ```

2. **Create testing_summary.json:**
   ```json
   {
     "testingStartDate": "2026-03-22",
     "testBattery": [],
     "instruments": [],
     "status": "battery_not_yet_selected"
   }
   ```

3. **Update case.json:**
   ```json
   "pipeline": {
     "currentStage": "Testing",
     "stageHistory": [
       {"stage": "Onboarding", "entered": "2026-03-22T14:30:00Z", "completed": "2026-03-22T17:00:00Z"},
       {"stage": "Testing", "entered": "2026-03-22T17:00:00Z", "completed": null}
     ]
   }
   ```

### Status Change and Audit Trail

1. **Update SQLCipher:**
   ```sql
   UPDATE cases
   SET current_stage = 'Testing', updated_at = datetime('now')
   WHERE case_number = '2026-0148';
   ```

2. **Audit trail entry:**
   ```json
   {"timestamp":"2026-03-22T17:00:00Z","user":"Dr. Truck Irwin","action":"case_advanced","details":{"fromStage":"Onboarding","toStage":"Testing","referralQuestions":1,"consentOnFile":true}}
   ```

3. **UI update:**
   - Pipeline indicator changes from "Onboarding" (blue) to "Testing" (purple)
   - File tree case expands to show Testing section
   - Dashboard updates case status

---

## Error Handling & Edge Cases

### Incomplete Intake Saved as Draft

**Scenario:** Clinician or patient starts Intake form but doesn't complete it

**Behavior:**
1. Intake modal's "Save Draft" button persists partial form state to SQLCipher
2. Status: `patient_intake.status = 'draft'`
3. Case is NOT created (no case directory, no case.json, no case record in `cases` table)
4. Next time clinician clicks "Intake", if a draft exists, option to "Resume Draft" appears
5. Draft exists until:
   - Clinician saves as complete (progress to case creation)
   - Clinician deletes the draft
   - Clinician creates a new case (old draft abandoned)

### Patient Leaves Before Completing Onboarding

**Scenario:** Patient completes intake and signs consent, but doesn't complete biopsychosocial form before leaving

**Behavior:**
1. Case is created (intake is complete)
2. Biopsychosocial form is saved as draft (patient_onboarding.status = 'draft')
3. Clinician receives reminder: "Incomplete onboarding for S. Williams (case #2026-0148)"
4. At next appointment, clinician opens Onboarding form and patient resumes filling it out
5. No data loss; patient's prior responses are pre-populated

### Duplicate Case Detection

**Scenario:** Clinician accidentally creates a case for a patient already in the system

**Behavior:**
1. During intake, after clinician enters name/DOB, JavaScript checks SQLCipher for cases with matching name and DOB (within 1 year tolerance)
2. If match found: warning appears: "⚠️ A similar case already exists: Williams, Samantha D. (#2026-0147, created 3/22/2026). Is this the same patient?"
3. Options:
   - "Yes, go to existing case" — closes intake, navigates to existing case
   - "No, this is a different person" — allows new case creation (must confirm)
   - "Cancel" — closes intake

### Missing Referral Documents

**Scenario:** Court-ordered evaluation; court order not yet received

**Behavior:**
1. Intake form allows "Supporting Documents Received" field to be empty
2. During advancement validation, if field is empty, soft warning: "No referral documents received. You can proceed, but recommend obtaining court order before beginning evaluation."
3. Clinician can add documents later (import at any time)

### Consent Refusal

**Scenario:** Patient refuses to sign informed consent

**Behavior:**
1. Clinician does not import a signed consent (consent_on_file remains false)
2. Clinician documents refusal in case notes: Case → "Case Notes" → "Patient declined consent"
3. Audit trail records: `{"action":"consent_refusal","details":{"reason":"Patient declined to sign"}}`
4. Clinician can proceed to Testing (soft warning will appear)
5. Evaluation can proceed in specific circumstances (court-ordered, patient in custody, etc.) with documented refusal

**Note:** Clinician's judgment is respected — this is a tool, not an enforcer.

---

## IPC Contracts

### IPC Channels Used During Stage 0

These are the Electron IPC (inter-process communication) channels invoked during Stage 0 operations. Full IPC contract specification is in doc 02; these are the subset relevant to Onboarding.

#### File Operations (from doc 16)

```typescript
// Create a new case directory with initial subdirectories
ipcMain.handle('case:create', async (event, {
  caseNumber: string,
  firstName: string,
  lastName: string,
  middleInitial?: string,
  evalType: string,
  referralSource: string
}) => Promise<{
  directoryName: string,
  fullPath: string,
  created: string[]
}>);

// Advance a case to the next pipeline stage
ipcMain.handle('case:advance', async (event, {
  caseNumber: string,
  toStage: 'Testing' | 'Interview' | 'Diagnostics' | 'Review' | 'Complete'
}) => Promise<{
  created: string[],
  caseJson: object
}>);

// Import a file into a case subdirectory
ipcMain.handle('case:importFile', async (event, {
  caseNumber: string,
  subdirectory: string,
  sourcePath: string,
  targetName?: string
}) => Promise<{
  importedPath: string,
  size: number
}>);

// Read case.json metadata
ipcMain.handle('case:readManifest', async (event, {
  caseNumber: string
}) => Promise<CaseManifest>);
```

#### PHI Redaction (from doc 15)

```typescript
// Redact full-PHI text for AI transmission
ipcMain.handle('pii:redact', async (event, {
  text: string,
  operationId: string,
  context: 'intake' | 'report' | 'review' | 'diagnostics'
}) => Promise<{
  redactedText: string,
  entityCount: number,
  typeBreakdown: Record<string, number>
}>);

// Re-hydrate UNIDs back to full-PHI
ipcMain.handle('pii:rehydrate', async (event, {
  text: string,
  operationId: string
}) => Promise<{
  fullText: string,
  unidsReplaced: number
}>);

// Destroy UNID map explicitly
ipcMain.handle('pii:destroy', async (event, {
  operationId: string
}) => Promise<{ destroyed: boolean }>);
```

#### Database Operations (implicit, via SQLCipher)

These are handled by the Electron main process directly, not via IPC:

```typescript
// Insert new case
INSERT INTO cases (case_number, directory_name, patient_first_name, patient_last_name, ...) VALUES (...);

// Insert intake record
INSERT INTO patient_intake (case_id, referral_type, last_name, first_name, ...) VALUES (...);

// Insert onboarding record
INSERT INTO patient_onboarding (case_id, intake_id, mode, ...) VALUES (...);

// Update case status
UPDATE cases SET current_stage = 'Testing' WHERE case_number = ?;

// Query for case number generation
SELECT MAX(case_number) FROM cases WHERE case_number LIKE '2026-%';
```

---

## Data Model

### New Tables for Stage 0

All tables use SQLCipher encryption at rest.

#### Table: `patient_intake`

```sql
CREATE TABLE patient_intake (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  case_id TEXT NOT NULL REFERENCES cases(id),

  -- Referral source
  referral_type TEXT NOT NULL CHECK (referral_type IN ('referral', 'self_referred')),

  -- Patient Contact Information
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  dob TEXT NOT NULL,  -- ISO 8601 date (YYYY-MM-DD)
  age INTEGER,
  gender TEXT,
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,  -- 2-character state code
  zip TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact TEXT,  -- "Phone", "Email", "Letter", "No Preference"
  emergency_contact TEXT NOT NULL,
  emergency_phone TEXT NOT NULL,

  -- Referral Information (referral_type = 'referral')
  referring_party_type TEXT,  -- "Court", "Attorney", "Physician", "Insurance", "Other"
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
  court_deadline TEXT,  -- ISO 8601 date
  referral_notes TEXT,

  -- Self-Referred Information (referral_type = 'self_referred')
  primary_complaint TEXT,
  onset_timeline TEXT,
  better_worse TEXT,
  safety_screening TEXT,  -- Full text of response; flagged if concerning keywords present
  safety_flag BOOLEAN DEFAULT FALSE,  -- Set to true if response contains "suicidal", "kill", etc.
  previous_treatment TEXT,
  who_recommended TEXT,
  pcp_name TEXT,

  -- Insurance & Billing
  insurance_carrier TEXT,
  policy_id TEXT,
  group_number TEXT,
  policyholder_name TEXT,
  policyholder_relationship TEXT,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (case_id) REFERENCES cases(id)
);

CREATE INDEX idx_patient_intake_case_id ON patient_intake(case_id);
CREATE INDEX idx_patient_intake_status ON patient_intake(status);
```

#### Table: `patient_onboarding`

```sql
CREATE TABLE patient_onboarding (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  case_id TEXT NOT NULL REFERENCES cases(id),
  intake_id TEXT NOT NULL REFERENCES patient_intake(id),

  -- Mode
  mode TEXT DEFAULT 'self_report' CHECK (mode IN ('self_report', 'clinician_review')),

  -- Demographics (carry-over + additions)
  marital_status TEXT,
  dependents TEXT,
  living_situation TEXT,
  primary_language TEXT,
  language_interpreter_needed BOOLEAN DEFAULT FALSE,

  -- Section 2: Presenting Complaints
  primary_complaint TEXT NOT NULL,
  secondary_concerns TEXT,
  onset_timeline TEXT NOT NULL,

  -- Section 3: Family History
  family_origin TEXT NOT NULL,
  family_mental_health TEXT NOT NULL,
  family_medical TEXT,
  family_current TEXT,

  -- Section 4: Education
  education_level TEXT,
  schools_attended TEXT,
  academic_experience TEXT NOT NULL,

  -- Section 5: Employment
  employment_status TEXT,
  current_employer TEXT,
  work_history TEXT NOT NULL,
  military_service TEXT,

  -- Section 6: Medical
  medical_conditions TEXT NOT NULL,
  medications TEXT NOT NULL,
  surgeries_hospitalizations TEXT,
  head_injuries TEXT,
  sleep_quality TEXT,
  appetite TEXT,

  -- Section 7: Mental Health
  previous_mh_treatment TEXT NOT NULL,
  previous_diagnoses TEXT NOT NULL,
  psychiatric_medications TEXT NOT NULL,
  self_harm_history TEXT NOT NULL,
  violence_history TEXT NOT NULL,

  -- Section 8: Substance Use
  alcohol_use TEXT NOT NULL,
  drug_use TEXT NOT NULL,
  substance_treatment TEXT,

  -- Section 9: Legal History
  arrests_convictions TEXT NOT NULL,
  incarceration TEXT NOT NULL,
  probation_parole TEXT,
  protective_orders TEXT,

  -- Section 10: Recent History
  recent_events TEXT NOT NULL,
  current_stressors TEXT NOT NULL,
  evaluation_goals TEXT NOT NULL,

  -- Additional
  additional_information TEXT,

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

  -- Raw, reviewed, and cleaned versions
  raw_text TEXT,  -- Original patient self-report (unedited)
  clinician_reviewed_text TEXT,  -- With clinician verification notes
  ai_cleaned_text TEXT,  -- After Ingestor Agent processing and re-hydration

  -- Metadata
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'patient_complete', 'clinician_verified', 'finalized')),
  ai_cleanup_timestamp TEXT,  -- ISO 8601 datetime when cleanup completed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (case_id) REFERENCES cases(id),
  FOREIGN KEY (intake_id) REFERENCES patient_intake(id)
);

CREATE INDEX idx_patient_onboarding_case_id ON patient_onboarding(case_id);
CREATE INDEX idx_patient_onboarding_status ON patient_onboarding(status);
```

### Additions to Existing `cases` Table

```sql
-- Add these columns to the existing cases table
ALTER TABLE cases ADD COLUMN consent_on_file BOOLEAN DEFAULT FALSE;
ALTER TABLE cases ADD COLUMN consent_date TEXT;  -- ISO 8601 date
ALTER TABLE cases ADD COLUMN consent_type TEXT CHECK (consent_type IN ('forensic', 'clinical', NULL));
ALTER TABLE cases ADD COLUMN safety_flag BOOLEAN DEFAULT FALSE;  -- Set if safety concerns from intake
```

### JSON Files in Case Directory

#### `case.json`

Full structure documented in doc 16. Updated during Stage 0:

```json
{
  "caseNumber": "2026-0148",
  "directoryName": "2026-0148_S.Williams",
  "created": "2026-03-22T14:30:00Z",
  "lastModified": "2026-03-22T17:00:00Z",
  "patient": {
    "firstName": "Samantha",
    "middleInitial": "L",
    "lastName": "Williams",
    "dateOfBirth": "1989-07-15",
    "age": 36,
    "gender": "Female"
  },
  "evaluation": {
    "type": null,
    "referralSource": "Court",
    "referralDate": "2026-03-20",
    "deadline": "2026-04-30",
    "jurisdiction": "Denver District Court",
    "charges": "DUI (.15 BAC)",
    "referringParty": "Public Defender's Office"
  },
  "consent": {
    "consentDate": "2026-03-22",
    "consentType": "forensic",
    "onFile": true,
    "uploadedDate": "2026-03-22T15:45:00Z"
  },
  "pipeline": {
    "currentStage": "Testing",
    "stageHistory": [
      {"stage": "Onboarding", "entered": "2026-03-22T14:30:00Z", "completed": "2026-03-22T17:00:00Z"},
      {"stage": "Testing", "entered": "2026-03-22T17:00:00Z", "completed": null}
    ]
  }
}
```

#### `intake/biopsychosocial.json`

Cleaned, AI-processed version of onboarding form:

```json
{
  "version": "1.0",
  "caseNumber": "2026-0148",
  "generatedAt": "2026-03-22T16:30:00Z",
  "cleanedByIngestor": true,
  "ingestorVersion": "1.0",
  "sections": {
    "primaryComplaint": "Patient reports experiencing paranoid thoughts focusing on coworkers and perceived surveillance...",
    "familyHistory": "Patient grew up in Chicago with mother and two brothers. Parents divorced when patient was 8 years old...",
    "educationHistory": "Highest education level: High school dropout (10th grade). Attended Lincoln Elementary (K-5, Chicago), Roosevelt Middle (6-8)...",
    "employmentHistory": "Current employment: Part-time at Home Depot as cashier (2 years). Prior work history includes Walmart (3 years), Best Buy (1 year), Target (1 year)...",
    "medicalHistory": "Current medical conditions: Hypertension (on Lisinopril 10mg daily), prediabetes (on Metformin 500mg twice daily)...",
    "mentalHealthHistory": "Prior psychiatric treatment: Therapist (college, depression, 2008-2009). Psychiatrist (2015-2016, anxiety)...",
    "substanceUseHistory": "Alcohol use: Drinks beer on weekends, approximately 3-4 beers, frequency increases with stress. No DUI. Drug use: Marijuana regularly in high school and college. Cocaine experimented with in 20s; did not continue...",
    "legalHistory": "Prior arrests: Shoplifting at age 18 (charges dropped). DUI in 2022 (pled guilty, 6 months probation). Currently on probation until March 2025..."
  }
}
```

#### `intake/demographics.json`

Structured data extracted by Ingestor Agent:

```json
{
  "timeline": [
    {"date": "1989-07-15", "event": "Patient born", "source": "patient_report"},
    {"date": "1997-03-15", "event": "Appendectomy", "source": "patient_report"},
    {"date": "2005-09-15", "event": "High school dropout, 10th grade", "source": "patient_report"},
    {"date": "2008-01-20", "event": "Started Prozac for depression", "source": "patient_report"}
  ],
  "medications": [
    {"name": "Lisinopril", "dose": "10mg", "frequency": "daily", "indication": "hypertension"},
    {"name": "Metformin", "dose": "500mg", "frequency": "twice daily", "indication": "blood glucose control"}
  ],
  "familyMembers": [
    {"name": "PERSON_a7f3c2", "relationship": "mother", "notes": "sees therapist for anxiety"},
    {"name": "PERSON_d1e84b", "relationship": "brother (younger)", "notes": "close relationship"}
  ],
  "priorDiagnoses": [
    {"diagnosis": "Major Depressive Disorder", "informant": "therapist", "year": "2008", "treatment": "Prozac 20mg"},
    {"diagnosis": "Anxiety", "informant": "psychiatrist", "year": "2015"}
  ]
}
```

#### `referral/referral_metadata.json`

Parsed referral information:

```json
{
  "referralDate": "2026-03-20",
  "referralSource": "Court",
  "referralSourceType": "Court",
  "referringParty": "Public Defender's Office",
  "referringPartyContact": "(720) 555-0150",
  "attorney": "Sarah Mitchell",
  "attorneyPhone": "(720) 555-0123",
  "caseNumber": "2026-CV-001234",
  "judge": "Judge Patricia Gomez",
  "jurisdiction": "Denver District Court",
  "charges": "DUI (.15 BAC)",
  "evaluationType": null,
  "referralQuestions": [
    {
      "questionId": "q001",
      "question": "What is the patient's capacity for competency to stand trial?",
      "source": "intake_form",
      "priority": "primary"
    }
  ],
  "courtDeadline": "2026-04-30",
  "documentsReceived": "Court order (faxed 3/20/2026)"
}
```

#### `audit/audit_trail.jsonl`

Append-only log of all actions. Example entries for Stage 0:

```json
{"timestamp":"2026-03-22T14:30:00Z","user":"Dr. Truck Irwin","action":"case_created","details":{"caseNumber":"2026-0148","directoryName":"2026-0148_S.Williams","referralType":"referral"}}
{"timestamp":"2026-03-22T14:35:00Z","user":"Dr. Truck Irwin","action":"consent_uploaded","details":{"file":"consent_signed.pdf"}}
{"timestamp":"2026-03-22T16:30:00Z","user":"Dr. Truck Irwin","action":"biopsychosocial_cleaned","details":{"entityCount":14,"typeBreakdown":{"PERSON":8,"DATE":3,"PHONE":1,"ADDRESS":2},"unidMapLifetimeMs":4200}}
{"timestamp":"2026-03-22T17:00:00Z","user":"Dr. Truck Irwin","action":"case_advanced","details":{"fromStage":"Onboarding","toStage":"Testing","referralQuestions":1,"consentOnFile":true}}
```

---

## Summary: What an Engineer Needs to Build Stage 0

### UI Components

1. **Intake Modal** — Form with referral source toggle, sections A-D, validation, draft/save buttons
2. **Informed Consent Editor** — Opens in OnlyOffice, displays pre-populated template, import signed copy
3. **Onboarding Modal** — Large multi-section form with patient self-report mode and clinician review mode
4. **Collateral Upload Interface** — File browser, naming/categorization, status tracking
5. **Case Advancement Validation** — Modal dialogs for missing consent/questions, confirmation
6. **File Tree Updates** — Display cases, collateral documents, show Onboarding status

### Backend/Database

1. **SQLCipher schema** — New tables: `patient_intake`, `patient_onboarding`; alter `cases` table for consent fields
2. **Case number generation** — Query max, increment, format with year prefix
3. **Case directory creation** — Atomic operation creating directory structure, case.json, audit trail initialization
4. **IPC handlers** — `case:create`, `case:advance`, `case:importFile`, `case:readManifest`, `pii:redact`, `pii:rehydrate`, `pii:destroy`
5. **Audit trail logging** — Append-only JSONL file, every action recorded

### AI Integration

1. **Ingestor Agent integration** — Send redacted biopsychosocial text, receive cleaned text with UNIDs, re-hydrate and store
2. **UNID pipeline** — Python sidecar calls to Presidio/spaCy for redaction/re-hydration
3. **Claude API calls** — System prompt per Agent 1 in doc 03, proper error handling

### Validation & Error Handling

1. **Form validation** — Required fields, date ranges, phone/email formats, safety screening detection
2. **Duplicate case detection** — Name/DOB matching with user confirmation
3. **Draft persistence** — Save partial intake, resume later
4. **Consent warnings** — Soft gate on advancement, override with justification

### Testing Focus Areas

1. **Case number generation** — Correct incrementing, year rollover, zero-padding
2. **Directory creation** — All subdirectories created, case.json written correctly, no collisions
3. **UNID redaction/re-hydration** — PHI correctly replaced with UNIDs, re-hydrated accurately, map destroyed
4. **Audit trail** — Every action logged with timestamps and details
5. **Modal lifecycle** — Proper open/close, data persistence, transitions between forms
6. **Concurrent uploads** — Multiple collateral documents imported without race conditions

---

## References

- **Doc 18:** Case Lifecycle Spec — Complete workflow context
- **Doc 12:** Intake/Onboarding Spec — Form design and data model
- **Doc 16:** Case Directory Schema — On-disk structure and IPC contracts
- **Doc 15:** UNID Redaction Architecture — PHI security and re-hydration
- **Doc 03:** Agent Prompt Specs — Ingestor Agent specifications

**End of Stage 0 Production Specification**
