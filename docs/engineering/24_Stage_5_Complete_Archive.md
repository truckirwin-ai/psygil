# Stage 5: Complete & Archive
## Psygil — Report Delivery, Post-Delivery Activities, and Case Archival

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Production Specification
**References:** Case Lifecycle Spec (doc 18), Case Directory Schema (doc 16), UNID Redaction (doc 15), IPC API Contracts (doc 02)

---

## Overview

Stage 5 encompasses everything after the report is signed and finalized. This is where the clinical work concludes and the administrative, legal, and archival machinery engages. The stage includes report delivery (multiple methods), billing, testimony preparation, record management, and archival.

**Key principle: The signed report is immutable.** Once finalized and signed, the original report cannot be edited. Any changes, clarifications, or corrections come as separate addendum documents.

**Key principle: No automatic deletion.** Case files are preserved indefinitely unless the clinician explicitly initiates destruction in accordance with state law retention requirements.

**Key principle: Audit trail continues.** Every delivery, addendum, testimony activity, and archival action is logged.

---

## Stage Entry Criteria

A case advances to Complete (Stage 5) automatically when:
1. Report is finalized in Review stage
2. Digital signature applied with timestamp
3. `report/final/evaluation_report.docx` and `evaluation_report.pdf` created
4. `report_metadata.json` updated with status = "signed"

---

## Step 5.1: Report Delivery

### Overview

The signed report must reach the requesting party (court, attorney, referring physician, or insurance carrier). Psygil supports four primary delivery methods, each with distinct workflows, security requirements, and tracking mechanisms.

Clinicians may deliver the same report to multiple recipients using different methods (e.g., attorney via secure email, court via electronic filing, insurance via encrypted mail).

---

### 5.1.1 Print Delivery

**Use case:** Hand-delivery to attorney's office, courthouse filing, or local mailing.

**Workflow:**

1. Clinician opens case → Report → Final
2. Clicks "Print Report" button
3. App presents print dialog:
   - **Page range:** All pages (pre-selected)
   - **Number of copies:** Default 1 (clinician can adjust)
   - **Paper orientation:** Portrait (fixed)
   - **Margins:** 1 inch (fixed, per APA standard)
   - **Headers/Footers:**
     - Header: Case number, patient name initial + last name, evaluation date
     - Footer: Page number, filename, date printed
   - **Color:** Color if printer supports, grayscale fallback
4. Clinician confirms → printer dialog opens (OS standard)
5. Clinician prints to local printer or PDF printer
6. **Audit trail entry:** "Report printed. Method: Print. Recipient: [manual entry field]. Date: [timestamp]."

**PDF Export (for printing):**

The print-to-PDF export includes:
- **Cover page** — optional, includes:
  - Case number and evaluation type
  - Patient name (not initials — full name on cover)
  - Evaluator name and credentials
  - Date of report
  - Distribution restricted to: "This report is confidential and contains information protected by patient privacy law. It is intended for [recipient type] use only."
- **Content pages** — exactly as prepared in the editor, with page breaks preserved
- **Metadata** — PDF embedded metadata (Author: clinician name, Title: evaluation type + case number, Subject: "Forensic/Clinical Evaluation")

**Paper formatting standards:**
- Font: Times New Roman 12pt, 1.5 line spacing (standard in clinical reports)
- Justification: Full justification
- Headers and footers as described above
- Page break: New section starts on new page if space permits; clinical convention followed
- Footnotes/citations: Preserved with original numbering

**Delivery tracking:**
```json
{
  "deliveryId": "deliv_20260322_001",
  "caseNumber": "2026-0147",
  "reportVersion": "signed_v3",
  "method": "print",
  "deliveryDate": "2026-03-22T14:30:00Z",
  "recipient": "Adams Law Firm, ATTN: J. Roberts",
  "recipientType": "Attorney",
  "status": "logged",
  "notes": "Printed 1 copy for attorney. Hand-delivered March 22."
}
```

---

### 5.1.2 Secure Email Delivery

**Use case:** Electronic transmission to attorney, court (if e-mail filing accepted), referring physician, or insurance.

**Prerequisites:**
- Email configured in Setup (SMTP credentials or native mail client)
- Recipient email address in the referral contacts or manually entered
- SSL/TLS encryption for SMTP transmission

**Workflow:**

1. Clinician opens case → Report → Final
2. Clicks "Email Report"
3. App opens email compose dialog:
   - **Recipients:** Auto-populated from referral contacts (Referring Attorney, Court Administrative Officer, Referring Physician). Clinician can remove or add recipients.
   - **CC/BCC:** Optional fields
   - **Subject line:** Auto-populated template:
     ```
     Evaluation Report — [Patient Name Initial]. [Last Name] — Case #[Case Number] — [Evaluation Type] — [Clinician Name]
     Example: Evaluation Report — M. Johnson — Case #2026-0147 — CST — Dr. Truck Irwin
     ```
   - **Body:** Template-generated cover letter (customizable)
   - **Attachment:** Report PDF (auto-selected)
   - **Encryption:** Checkbox to encrypt PDF with password (optional)

4. **Default cover letter template:**
   ```
   [Recipient Name]:

   Attached is the evaluation report for [Patient Name, DOB: [DOB]]
   in the matter of [Case Description/Case Number].

   The evaluation was conducted on [Dates of Evaluation].

   This report is confidential and contains information protected by
   [HIPAA / patient privacy law / applicable law]. It is intended for
   your use in connection with [legal matter / medical care / insurance determination].

   Please contact me if you have questions or require clarification.

   [Clinician Name]
   [Clinician Title, License, Credentials]
   [Practice Name and Address]
   [Phone]
   [Email]
   ```

5. Clinician reviews and may edit:
   - Subject line
   - Cover letter
   - Recipient list
   - Attachment selection
6. Clicks "Send"
7. **If encryption enabled:**
   - App generates random password (12 characters, mixed case + numbers + symbols)
   - Password-protects the PDF before attaching
   - App generates second email to clinician with the password to share with recipient via separate channel (phone, SMS)
   - Clinician must confirm they will provide password separately
8. **Transmission:**
   - Via configured SMTP (local encryption via TLS)
   - OR via OS native mail client (which handles encryption per user settings)
   - App **does NOT store email password** in plaintext; uses OS secure credential storage or OAuth if available
9. **Confirmation:**
   - If SMTP: app receives send confirmation from server
   - If native client: user confirms send, app logs delivery after confirmation
10. **Audit trail entry:**
    ```json
    {
      "timestamp": "2026-03-22T15:45:00Z",
      "action": "report_delivered_email",
      "caseNumber": "2026-0147",
      "method": "email",
      "recipients": ["jroberts@adamslaw.com"],
      "cc": [],
      "recipientTypes": ["Attorney"],
      "encrypted": false,
      "status": "sent"
    }
    ```

**Security considerations:**
- Email transmission uses TLS (enforced in SMTP configuration)
- PDF password protection is optional (clinician decides if case sensitivity warrants it)
- App does not log the password in the audit trail
- Encrypted PDFs should be accompanied by a separate password communication (not in the same email)
- SMTP credentials stored in OS keychain, not in plain text

---

### 5.1.3 Electronic Court Filing

**Use case:** Submission to court e-filing systems (e.g., Colorado COURTS.US, PACER for federal).

**Note:** Psygil does NOT integrate directly with court e-filing APIs. This step is a documentation workflow — the clinician exports the report, then uploads it to the court system manually.

**Workflow:**

1. Clinician opens case → Report → Final
2. Clicks "Export for Court Filing"
3. App opens file export dialog:
   - Filename: `[CaseNumber]_[EvalType]_[EvaluatorInitials]_[Date].pdf`
   - Example: `2026-0147_CST_TI_2026-03-22.pdf`
   - Location: User chooses (typically Downloads)
   - Format: PDF (only option)
4. App exports report PDF with embedded metadata
5. App presents instructions panel:
   ```
   COURT FILING CHECKLIST

   Court system: [Clinician enters court name/case ID from referral]
   Filing deadline: [Populated from referral metadata]

   Next steps:
   1. Log in to [court e-filing URL] — user provides this
   2. Navigate to "File Document"
   3. Select document type: "Evaluator Report" or "Expert Report"
   4. Upload the PDF: [filename]
   5. Confirm filing and note the confirmation number
   6. Return here and enter the confirmation number to log delivery

   Filing confirmation number: [Text field]
   Filing date: [Date picker]
   [Log Delivery Button]
   ```
6. Clinician completes filing outside of Psygil
7. Returns to the checklist and enters filing confirmation number
8. Clicks "Log Delivery"
9. **Audit trail entry:**
   ```json
   {
     "timestamp": "2026-03-22T16:20:00Z",
     "action": "report_delivered_court_filing",
     "caseNumber": "2026-0147",
     "method": "electronic_court_filing",
     "court": "Denver District Court",
     "caseId": "2023-CV-45678",
     "filingDate": "2026-03-22",
     "confirmationNumber": "ECF-2026-0147-001",
     "status": "delivered"
   }
   ```

**Exported file structure:**
- Single PDF file with embedded metadata (case number, evaluation type, evaluator name)
- Print-to-PDF workflow (same as print delivery, but saved to file)
- Filename template follows court naming conventions (case number, evaluator initials, date)

---

### 5.1.4 Fax Delivery

**Use case:** Transmission to courts, prosecutors, or attorneys that require facsimile (yes, courts still use fax).

**Two modes:**

#### Mode A: Local Fax Printer
Clinician has a fax-enabled printer/multifunction device on-site.

1. Clinician opens case → Report → Final
2. Clicks "Print Report"
3. In printer dialog, selects "[Printer Name] - Fax Enabled"
4. Enters fax number, confirmation dialog
5. Print job sent to fax printer queue
6. Clinician confirms send, hears fax transmission
7. Audit trail logged with fax number

#### Mode B: Digital Fax Service Integration (Planned, Post-MVP)
Integration with a digital fax service (e.g., Twilio Fax, eFax) for clinics without on-site fax.

1. Clinician clicks "Send Fax"
2. App opens fax dialog:
   - **Fax number:** Manual entry (with formatting validation)
   - **Cover sheet:** Optional, generated with case info
   - **Service:** Configured during setup (e.g., Twilio API key)
3. App generates PDF → sends to fax API
4. API returns tracking number and delivery status
5. Audit trail logs fax transmission with status

**Current implementation (MVP):** Mode A only (local fax printer). Mode B designed but deferred.

---

### 5.1.5 Records Package

**Use case:** Comprehensive case documentation bundle for attorney or court (beyond just the report).

**Workflow:**

1. Clinician opens case → Report → Final
2. Clicks "Create Records Package"
3. App presents checklist of what to include:
   - ✓ Final evaluation report (PDF) — included by default
   - ✓ Signed informed consent (PDF) — included by default
   - ☐ Intake form summary (PDF)
   - ☐ Test data summary (PDF: list of instruments, scores, validity indicators)
   - ☐ Collateral records index (PDF: list of documents reviewed with brief summaries)
   - ☐ Interview notes summary (PDF: session dates, hours, topics)
   - ☐ Diagnostic formulation (PDF)
   - ☐ Evidence matrix (PDF)
   - ☐ All test score reports (PDFs from publisher exports)
   - ☐ Audit trail summary (PDF: timeline of evaluation activities)
4. Clinician selects which documents to include
5. Clicks "Generate Package"
6. App creates `exports/records_package.zip` containing:
   ```
   records_package/
   ├── README.txt  (manifest listing contents)
   ├── 2026-0147_evaluation_report.pdf
   ├── 2026-0147_consent_signed.pdf
   ├── 2026-0147_intake_summary.pdf
   ├── 2026-0147_test_data.pdf
   ├── 2026-0147_collateral_index.pdf
   ├── 2026-0147_interview_summary.pdf
   ├── 2026-0147_audit_trail.pdf
   └── test_scores/
       ├── MMPI-3_qglobal_export.pdf
       ├── PAI_pariconnect_export.pdf
       └── WAIS-V_publisher_report.pdf
   ```
7. ZIP file saved to `exports/records_package.zip`
8. Clinician can:
   - Download to local disk
   - Email (triggers email workflow with ZIP attachment)
   - Print cover sheet
9. **Audit trail entry:**
   ```json
   {
     "timestamp": "2026-03-22T17:00:00Z",
     "action": "records_package_created",
     "caseNumber": "2026-0147",
     "contents": [
       "evaluation_report",
       "consent_signed",
       "intake_summary",
       "test_data",
       "collateral_index",
       "interview_summary",
       "test_scores"
     ],
     "packageSize": 12450000,
     "status": "created"
   }
   ```

**ZIP contents details:**

Each document in the package is a standalone PDF with:
- Cover page with case number, patient name, evaluation type, document title
- Document contents
- Footer with document type and case number

Documents are named for easy identification:
- `[CaseNumber]_[DocumentType].pdf`
- Example: `2026-0147_test_data.pdf`

README.txt manifest:
```
RECORDS PACKAGE MANIFEST
Case Number: 2026-0147
Patient: M. Johnson
Evaluation Type: CST
Evaluator: Dr. Truck Irwin, Psy.D., ABPP
Package Created: 2026-03-22

CONTENTS:
1. evaluation_report.pdf — Final signed evaluation report (22 pages)
2. consent_signed.pdf — Informed consent form signed by patient (2 pages)
3. intake_summary.pdf — Intake and demographic information (3 pages)
4. test_data.pdf — Summary of psychological test results (5 pages)
5. collateral_index.pdf — Index of collateral records reviewed (1 page)
6. interview_summary.pdf — Summary of clinical interview sessions (2 pages)
7. test_scores/ — Publisher exports and score reports (7 PDFs)

Total files: 13
Total pages: 42
Total size: 12.4 MB

This package is confidential and intended for [intended recipient use].
```

---

### 5.1.6 Delivery Tracking

Every delivery event is recorded in a delivery tracking record in SQLCipher and logged to the audit trail.

**Delivery tracking schema:**

```json
{
  "deliveryId": "deliv_20260322_001",
  "caseNumber": "2026-0147",
  "reportVersion": "signed_v3",
  "method": "email",
  "deliveryDateTime": "2026-03-22T15:45:00Z",
  "recipientName": "John Roberts, Esq.",
  "recipientType": "Attorney",
  "recipientEmail": "jroberts@adamslaw.com",
  "recipientAddress": null,
  "recipientPhone": null,
  "encryptionUsed": false,
  "documentsSent": [
    {
      "name": "evaluation_report.pdf",
      "pages": 22,
      "size": 1240000
    }
  ],
  "confirmationReceived": true,
  "confirmationDetails": "SMTP 250 OK",
  "notes": "Report sent per attorney request",
  "status": "delivered"
}
```

**Delivery tracking UI:**

In the case's Clinical Overview or Report section, a "Delivery History" tab shows:

| Delivery # | Date | Method | Recipient | Status | Actions |
|-----------|------|--------|-----------|--------|---------|
| 1 | 2026-03-22 | Email | J. Roberts (Attorney) | Delivered | Re-send |
| 2 | 2026-03-22 | Print | Adams Law Firm (addressed) | Logged | — |
| 3 | 2026-03-24 | E-Filing | Denver District Court | Delivered (ECF-001) | View confirmation |

Each delivery can be clicked to view full details and resend if necessary.

---

## Step 5.2: Billing & Invoicing

**Principle:** Psygil is not a billing system. But basic invoicing functionality saves clinicians from using a separate tool for straightforward time-based billing.

**Scope:** Time tracking across all sessions, invoice generation with itemized services, CPT code suggestions, PDF export.

**Out of scope:** Insurance claim submission (handled by external billing software), payment collection, AR aging reports.

---

### 5.2.1 Automatic Time Tracking

Time is tracked at two points:

**Point 1: Session creation**
When a clinician creates a testing or interview session, the session record includes:
```json
{
  "sessionId": "session_001",
  "type": "interview",
  "date": "2026-03-15",
  "startTime": "10:00",
  "endTime": "11:15",
  "durationMinutes": 75,
  "durationHours": 1.25,
  "billableMinutes": 75,
  "billableHours": 1.25,
  "activities": [
    "Clinical interview",
    "Mental status examination",
    "Behavioral observations"
  ]
}
```

**Point 2: Aggregation**
When the clinician opens the case → Overview → Billing tab, app auto-calculates:
- Total sessions: count of all testing and interview sessions
- Total billable hours: sum of all `billableHours` from all sessions
- Hours by activity type:
  - Testing administration hours
  - Psychological testing hours (psychometrist if separate)
  - Interview hours
  - Records review hours (if tracked)
  - Report writing hours (optional, manual entry)

```json
{
  "totalSessions": 5,
  "totalBillableHours": 8.75,
  "breakdown": {
    "testingAdministration": 2.5,
    "interview": 4.0,
    "collateralReview": 1.25,
    "reportWriting": 0.0
  }
}
```

**Report writing hours (optional):**
The clinician may optionally log report writing time:
- "Start Writing" button at the beginning of first edit session
- "Stop Writing" button when finished
- Time tracked and added to billable hours
- OR manual entry: "This report took 3 hours to write"

---

### 5.2.2 Invoice Generation

**Workflow:**

1. Clinician opens case → Report → Billing
2. Clicks "Generate Invoice"
3. App opens invoice generator dialog:
   - **Billable hours:** Auto-populated from session tracking
   - **Hourly rate:** Clinician enters (or pre-configured in practice settings)
   - **Evaluation type:** Auto-populated from case
   - **CPT codes:** Auto-suggested based on eval type (see below)
   - **Service breakdown:** Itemized by activity type
   - **Invoice date:** Default today, can be backdated
   - **Invoice number:** Auto-generated (format: [Year][Sequential], e.g., INV-2026-0147)
   - **Terms:** Net 30 (pre-set, not editable)
   - **Insurance billed?** Checkbox to indicate if billing insurance or self-pay
4. Clinician reviews and may edit:
   - Service descriptions
   - CPT codes
   - Hours per service
   - Rate
5. Clicks "Generate Invoice"
6. App creates PDF:
   ```
   INVOICE

   From:
   [Practice Name]
   [Address]
   [Phone]
   [Tax ID]

   Bill To:
   [Referring Party or Insurance Carrier]
   [Address]

   Invoice #: INV-2026-0147
   Invoice Date: 2026-03-22
   Due Date: 2026-04-22

   Patient: [Name] | Case #: [Number] | DOB: [DOB]

   Services Rendered:

   Date       Service                    CPT Code  Hours  Rate    Amount
   ─────────  ───────────────────────    ────────  ─────  ──────  ───────
   2026-03-10 Initial interview          90834     1.0    $300    $300
   2026-03-12 Psychological testing      90835     2.5    $250    $625
   2026-03-14 Collateral records review  90837     1.25   $250    $312.50
   2026-03-22 Report writing             90839     2.0    $300    $600

   ─────────────────────────────────────────────────────────────────────
   TOTAL:                                           6.75            $1,837.50

   Notes:
   [Clinician can add notes, e.g., "See attached authorization for insurance limits"]

   ---
   This invoice is for professional services rendered. Payment is due by the date above.
   Please remit payment to the address above or contact [contact] with questions.
   ```
7. Invoice saved to `exports/invoice_[date].pdf`
8. Clinician can:
   - Download PDF
   - Email to insurance carrier or patient
   - Print for records
9. **Audit trail entry:**
   ```json
   {
     "timestamp": "2026-03-22T17:30:00Z",
     "action": "invoice_generated",
     "caseNumber": "2026-0147",
     "invoiceNumber": "INV-2026-0147",
     "totalHours": 6.75,
     "totalAmount": 1837.50,
     "billedTo": "Insurance",
     "status": "generated"
   }
   ```

---

### 5.2.3 CPT Code Suggestions

CPT (Current Procedural Terminology) codes are billable procedure codes used by insurance companies. Psygil suggests codes based on evaluation type and services rendered.

**CPT code mapping by evaluation type and service:**

| Eval Type | Service | CPT Code | Description | Suggested Rate |
|-----------|---------|----------|-------------|-----------------|
| CST / Custody / Risk / Etc. | Initial clinical interview | 90834 | 45-50 min office visit | $300 |
| Any | Psychological testing (admin + scoring) | 90835 | Psychological testing (1 hour) | $250 |
| Any | Psychological testing (per additional hour) | 90836 | Psychological testing (each additional hour) | $250 |
| Forensic | Report writing/opinion | 90839 | Preparation of report | $300 |
| Forensic | Deposition/court testimony | 90844 | Behavioral health services; by a nonphysician | $350-500 (varies by jurisdiction) |
| Any | Collateral records review | [Custom] | Not a standard CPT code — enter as "Records Review" with custom rate | $250 |

**How suggestions work:**

When clinician opens invoice generator:
1. App looks at evaluation type from `case.json`
2. Looks at session types and hours from `interviews/` and `testing/`
3. Suggests CPT codes for each service
4. Clinician reviews and may substitute different codes (e.g., "I'll use 90834 instead of 90835 because I did more interviewing than testing")
5. Suggested rates appear as defaults but are editable

**Note on CPT codes:** Different insurance companies, states, and whether the evaluator is a psychologist vs. a psychiatrist vs. a social worker affect what codes are applicable. Psygil provides suggestions only; clinician is responsible for correct coding.

---

### 5.2.4 Insurance Billing Indicator

Clinician marks whether invoice is for insurance billing or self-pay:
- If **Insurance:** Invoice goes to the carrier address (from authorization in `referral/`)
- If **Self-pay/Patient:** Invoice goes to patient address
- If **Both:** Clinician creates two invoices (one to each party)

---

### 5.2.5 Invoice Storage

All invoices stored in `exports/`:
- Filename: `invoice_[date]_[invoiceNumber].pdf`
- Example: `invoice_2026-03-22_INV-2026-0147.pdf`
- Original in case directory, copy can be sent to billing system (external)
- Audit trail tracks when invoices were created and sent

---

## Step 5.3: Post-Delivery Activities

After the report is delivered, the case often remains active for follow-up activities: attorney questions, testimony preparation, or supplemental information requests.

---

### 5.3.1 Case Notes for Post-Delivery Questions

**Workflow:**

1. Clinician receives email/call from referring attorney: "Your report says the defendant showed anxiety on the interview. Can you clarify what specific behaviors you observed?"
2. Clinician opens case → Clinical Overview or case notes area
3. Clicks "Add Post-Delivery Note"
4. Opens text editor:
   ```
   Date: [Today]
   From: [Attorney name]
   Question: "Clarify anxiety behaviors observed in interview"

   Response:
   During the March 15 interview, the defendant exhibited the following:
   - Rapid speech rate (tachykinesis)
   - Frequent hand wringing and postural shifts
   - Reported subjective anxiety ("I'm very nervous about this")
   - Vital signs: HR 98 (baseline assumed ~70), BP slightly elevated

   These observations are consistent with situational anxiety in response
   to discussing the charged offenses. The anxiety was not present when
   discussing unrelated topics (e.g., family history, employment).

   See page 12 of the evaluation report for context.
   ```
5. Saves note to `report/` directory (not in final report, but linked)
6. Audit trail: "Post-delivery note added by Dr. Truck Irwin at [timestamp]"

**Storage:**
- File: `report/post_delivery_notes.json` (JSONL-style, appended)
- Each note includes date, source, question, response, timestamp
- Notes do NOT appear in the final report; they're internal reference material

---

### 5.3.2 Testimony Preparation

**When triggered:**
- Attorney contacts clinician: "We're deposing you next week. Can you prepare?"
- Clinician opens case → Report → Testimony Prep

**What's generated:**

**Document 1: One-Page Case Summary**
Auto-generated PDF summarizing the case for quick reference before deposition/trial:

```
CASE SUMMARY — For Expert Witness Preparation
Case #: 2026-0147
Patient: M. Johnson, DOB 6/14/1991
Charges: Assault 2, Menacing
Evaluation: Competency to Stand Trial (CST)
Evaluator: Dr. Truck Irwin, Psy.D., ABPP
Evaluation Dates: 3/10-3/22/2026
Report Signed: 3/22/2026

REFERRAL QUESTION:
Is the defendant competent to stand trial? Specifically, does he have:
(a) a sufficient present ability to consult with his lawyer with a
    reasonable degree of rational understanding, and
(b) a rational as well as factual understanding of the proceedings
    against him?

KEY FINDINGS:
- Diagnosis: Schizophrenia, Paranoid Type (F20.0)
- Severity: Moderate to Severe
- Current symptoms: Command hallucinations, paranoid ideation, poor
  insight into illness
- Relevance to CST: Deficits in understanding charges and functioning
  with attorney

BEHAVIORAL OBSERVATIONS:
- Cooperative during evaluation despite suspiciousness
- Interview lasted ~2 hours across 2 sessions
- Demonstrated ability to relate circumstances of alleged incidents
- Reported hearing "voices telling me to do bad things"
- Expressed belief that "the system is trying to set me up"

TESTING RESULTS:
Test Battery: MMPI-3, PAI, WAIS-V, TOMM, SIRS-2
Validity: Adequate
Key elevations: MMPI-3 F/Fb (overendorsement), Pa (paranoia)

CLINICAL OPINION:
The defendant is NOT COMPETENT to stand trial. He meets criteria for:
- Defect in rational understanding of the proceedings
- Defect in ability to consult with counsel
Restoration recommended through pharmacological management + individual
psychotherapy.

TIMELINE OF EVALUATION:
3/10/2026 - Initial interview, intake
3/12/2026 - Psychological testing (MMPI-3, PAI, WAIS-V)
3/14/2026 - Validity testing (TOMM, SIRS-2) + clinical interview
3/15/2026 - Collateral information review (prior records)
3/20/2026 - Report drafting
3/22/2026 - Report finalization and signature

---
Prepared for deposition: [Date]
```

**Document 2: Key Findings Quick Reference**

Single-page card with critical facts for witness stand:

```
CST EVALUATION QUICK REFERENCE

Patient: M. Johnson | Charges: Assault 2, Menacing | Case #: 2026-0147

LEGAL STANDARD (Dusky):
Must assess: (1) ability to consult with counsel + (2) rational
understanding of proceedings

MY OPINION: NOT COMPETENT

SUPPORTING EVIDENCE:
- Schizophrenia, Paranoid Type (ICD-10 F20.0)
- Command hallucinations: "Voices telling me to do bad things"
- Paranoid beliefs: "System is trying to set me up"
- MMPI-3 Pa elevation (T=78)
- Poor insight into illness

RATIONAL UNDERSTANDING DEFICITS:
- Difficulty articulating reasons for charges ("It's a setup")
- Cannot distinguish actual evidence from his interpretation
- Believes charges are result of conspiracy, not his actions

ABILITY TO CONSULT DEFICITS:
- Suspicious of attorney ("They're all working together")
- Demonstrates ability to relate to attorney on neutral topics
- But judgment impaired regarding legal strategy

CROSS-EXAMINATION VULNERABILITIES:
- Was defendant cooperative during eval? YES
- Did he understand questions? YES
- Could he articulate reasons for hospital visits? YES (partially)
- Is schizophrenia always incompetency? NO — depends on functional impact
  [Note: Be prepared to distinguish between diagnosis and functional capacity]

RESTORATION PLAN:
Antipsychotic medication + psychotherapy, likely 6-12 months to restore

```

**Document 3: Cross-Examination Preparation**

Generated from Editor/Legal Agent review notes. Synthesizes likely challenge questions and suggested responses:

```
ANTICIPATED CROSS-EXAMINATION QUESTIONS & RESPONSES

Q: "Doctor, the defendant was cooperative with you during the evaluation.
   If he's psychotic, how was he cooperative?"

A: "Cooperation during evaluation doesn't establish competency. He was
   cooperative in the sense that he answered questions. But competency
   requires the ability to understand charges and consult with counsel.
   His psychosis affected his judgment about the charges — he believes
   this is a setup, not based on evidence. He was suspicious of his
   attorney's motives."

Q: "Isn't it true that schizophrenia doesn't automatically make someone
   incompetent?"

A: "That's correct. Schizophrenia is a diagnosis, not a functional
   capacity determination. Many people with schizophrenia are competent.
   But in this case, the defendant's specific symptoms — command
   hallucinations and paranoid beliefs about the legal system —
   functionally impair his ability to understand charges and work
   with counsel."

Q: "You didn't speak to the defendant's prior competency evaluations.
   How do you know this is accurate?"

A: "I reviewed prior evaluations [list]. They showed similar patterns
   of paranoid thinking. The current evaluation was based on my own
   testing, interview, collateral records, and [prior eval details]."

Q: "Isn't your opinion about his beliefs just your interpretation?"

A: "His beliefs are documented by: (1) his own statements during
   interview, (2) corroboration in collateral records [cite specific
   records], (3) elevation on MMPI-3 Paranoia scale (T=78, well above
   normal range), (4) [other evidence]."

Q: "The defendant told you he was taking his medication. Why do you think
   he's still incompetent?"

A: "He reported taking medication, but [collateral source] indicates
   he's actually non-compliant. Moreover, even at his reported medication
   level, his current symptoms are prominent enough to impair
   understanding of charges."

[Continues with 8-10 additional anticipated questions and responses]

---
NOTE: This is preparation material for the expert witness. Actual testimony
should be truthful and based on your evaluation findings.
```

**Document 4: Deposition/Trial Materials Checklist**

Reminder list of materials to have available during testimony:

```
MATERIALS TO HAVE AVAILABLE AT DEPOSITION/TRIAL

Bring printed copies:
☐ Signed evaluation report (this document)
☐ Key findings card (quick reference)
☐ Test data summary sheet (page 5 of report)
☐ Notes on [specific issue] (from post-delivery notes, if applicable)

Have available electronically (for reference, may not use):
☐ Complete MMPI-3 score report + interpretation guide
☐ PAI manual (for validity scale interpretation)
☐ TOMM manual (for effort testing standards)
☐ DSM-5-TR (Section F20 for Schizophrenia diagnostic criteria)
☐ Prior evaluation reports (referenced in your report)
☐ Collateral documents you cited
☐ Notes on medication history (from patient report vs. collateral)

Do NOT bring/reference (protected work product):
☐ Draft reports or editing history
☐ Notes from legal review
☐ Communications with attorney
☐ Personal notes outside the report

Be prepared to explain:
- Why you selected your test battery
- How you administered each test
- What the scores mean (in lay terms)
- How you formed your opinion
- Why you rejected alternative diagnoses
- Basis for functional opinions (not just diagnosis)
```

**Storage:**

All testimony prep materials stored in `exports/`:
- `exports/case_summary_testimony.pdf`
- `exports/key_findings_card.pdf`
- `exports/deposition_questions.pdf`
- `exports/materials_checklist.txt`

**Workflow:**

1. Case → Report → Testimony Prep
2. Clinician clicks "Generate Testimony Materials"
3. App generates all four documents above
4. Clinician may:
   - Download and review locally
   - Print for testimony
   - Email to self or referring attorney
5. Materials are date-stamped: "Prepared for testimony: [date]"

---

## Step 5.4: Addendum Reports

**Core principle:** The signed final report is immutable. Any changes, corrections, or supplemental information come as a separate addendum document.

---

### 5.4.1 When Addenda Are Needed

**Typical scenarios:**

1. **Correction** — "I realized I misread the MMPI-3 profile. The T-score for Scale 4 is 62, not 52."
2. **Clarification** — "The court asked about the patient's understanding of potential sentences. Here's additional information based on follow-up questioning."
3. **New Information** — "New hospital records arrived showing a prior hospitalization I wasn't aware of during the evaluation. This information confirms my diagnosis but doesn't change my opinion."
4. **Supplemental Testing** — "The defense requested additional cognitive testing. Results are attached."
5. **Updated Information** — "The defendant has now been on antipsychotic medication for 6 weeks. His current symptoms have improved. Updated assessment attached."

---

### 5.4.2 Addendum Creation Workflow

**Step 1: Request Assessment**

Clinician receives request (via attorney, court, or own decision):
- Clicks "Create Addendum"
- Opens addendum dialog:
  ```
  ADDENDUM REPORT — NEW OR REVISION?

  Reason for addendum:
  ☐ Correction (error in original report)
  ☐ Clarification (more detail on existing conclusion)
  ☐ New information (information not available at time of report)
  ☐ Supplemental testing (additional evaluation)
  ☐ Updated information (follow-up evaluation)

  Brief description: [Text field]
  "The court requested clarification on the defendant's understanding
  of courtroom procedures. Additional structured interview on this topic
  conducted 3/25/2026."

  [Proceed to Editing]
  ```

**Step 2: Prepare Addendum Text**

App opens OnlyOffice editor with addendum template:

```
ADDENDUM REPORT

Case Number: 2026-0147
Patient: M. Johnson, DOB 6/14/1991
Original Report Date: March 22, 2026
Addendum Date: March 25, 2026
Evaluator: Dr. Truck Irwin, Psy.D., ABPP

REFERENCE TO ORIGINAL REPORT:
This addendum is supplemental to the Competency to Stand Trial
evaluation completed on March 22, 2026 (report attached as reference).

REASON FOR ADDENDUM:
The court requested clarification regarding the defendant's current
understanding of courtroom procedures, specifically:
- Who the judge is and their role
- Who the prosecutor/defense counsel are and their roles
- What a verdict is and how it differs from sentencing
- Consequences of conviction in his specific case

ADDITIONAL EVALUATION CONDUCTED:
Date: March 25, 2026
Time: 2 hours
Location: [Location]
Conditions: [In person / By video / Other]
Defendant's demeanor: [Cooperative / Guarded / Other]

FINDINGS:
[Clinician types or dictates findings]

IMPACT ON ORIGINAL OPINION:
The original opinion stated: "[Quote from original report]"

After this additional evaluation, my opinion: [Updated/Unchanged/Modified]
- If unchanged: "This additional information is consistent with my
  original opinion that the defendant is not competent to stand trial."
- If modified: "This information reveals additional deficits not fully
  apparent in the original evaluation. My opinion remains that..."

CONCLUSION:
[Clinician's final statement about how this addendum relates to original
report and opinion]

Respectfully submitted,

[Digital signature]
Dr. Truck Irwin, Psy.D., ABPP
[License number, credentials]
[Date]
```

**Step 3: Legal Review (Optional)**

Clinician may request Editor/Legal Agent review:
- Clicks "Run Legal Review" on addendum draft
- Agent reviews for:
  - Consistency with original report
  - Support for any changed opinions
  - Daubert compliance
  - Clarity and professionalism
- Issues presented to clinician
- Clinician addresses issues before signing

**Step 4: Sign Addendum**

1. Clinician clicks "Finalize Addendum"
2. App runs pre-finalization checklist:
   - Does addendum reference original report?
   - Is the reason for addendum clear?
   - Is the opinion section complete?
   - Have critical legal issues been resolved (if reviewed)?
3. Clinician applies digital signature
4. File saved as `report/final/addendum_YYYY-MM-DD.docx`
5. PDF export generated: `report/final/addendum_YYYY-MM-DD.pdf`
6. **ORIGINAL REPORT REMAINS UNCHANGED** — it stays as `evaluation_report.docx`

---

### 5.4.3 Addendum Storage & Immutability

**File structure:**

```
report/final/
├── evaluation_report.docx    # Original — NEVER modified
├── evaluation_report.pdf     # Original PDF export — NEVER modified
├── addendum_2026-03-25.docx  # First addendum
├── addendum_2026-03-25.pdf   # PDF export
├── addendum_2026-04-10.docx  # Second addendum (if needed)
└── addendum_2026-04-10.pdf
```

**Versioning:**

Original report has no version number in filename (it's the reference). Addenda are identified by date only. If two addenda are created on the same day, timestamp included:

- `addendum_2026-03-25_0900.docx` (9:00 AM)
- `addendum_2026-03-25_1430.docx` (2:30 PM)

**Audit Trail:**

```json
{
  "timestamp": "2026-03-25T14:30:00Z",
  "action": "addendum_created",
  "caseNumber": "2026-0147",
  "reason": "Clarification on understanding of courtroom procedures",
  "originalReportDate": "2026-03-22",
  "addendumVersion": "2026-03-25",
  "status": "signed",
  "evaluator": "Dr. Truck Irwin"
}
```

---

### 5.4.4 Addendum Delivery

Addenda follow the same delivery mechanisms as the original report (print, email, court filing, fax). Each delivery is tracked separately:

```json
{
  "deliveryId": "deliv_20260326_001",
  "caseNumber": "2026-0147",
  "reportVersion": "addendum_2026-03-25",
  "method": "email",
  "deliveryDate": "2026-03-26",
  "recipient": "Denver District Court",
  "recipientType": "Court",
  "documentsSent": ["addendum_2026-03-25.pdf"],
  "status": "delivered"
}
```

---

## Step 5.5: Case Summary & Statistics

---

### 5.5.1 One-Page Case Summary

Auto-generated summary for clinician's records and practice analytics:

**Content (one page PDF):**

```
CASE SUMMARY

Case #: 2026-0147
Patient: M. Johnson, DOB 6/14/1991, Age 34
Evaluation Type: Competency to Stand Trial (CST)
Referral Source: Court (Public Defender)
Charges: Assault 2 (F4), Menacing (M1)
Evaluation Dates: March 10-22, 2026
Deadline: April 15, 2026
Jurisdiction: Denver District Court

CLINICAL FINDINGS:
Primary Diagnosis: Schizophrenia, Paranoid Type (F20.0)
Severity: Moderate-Severe
Key Symptoms: Command hallucinations, paranoid ideation, poor insight
Validity: Adequate (passed TOMM, SIRS-2)
Feigning: Not Indicated

OPINION:
NOT COMPETENT to stand trial.
Deficits in rational understanding of charges and ability to consult
with counsel due to active psychotic symptoms.
Recommendation: Restoration treatment (antipsychotic medication + therapy)

STATISTICS:
Sessions: 5 (2 testing, 2 interview, 1 collateral)
Total Hours: 8.75 billable hours
Test Battery: MMPI-3, PAI, WAIS-V, TOMM, SIRS-2
Collateral Documents Reviewed: 12 (prior hospitalization, police report,
  prior evaluations)

TURNAROUND TIME:
Referral to Signed Report: 22 days
Within deadline? Yes (deadline was April 15)

REPORT DELIVERED:
Date: March 22, 2026
Recipients: Public Defender (email), Court (electronic filing)

INSURANCE/BILLING:
Billed to: Court-Ordered (Self-Pay)
Total Billable Hours: 8.75 @ $300/hr = $2,625
Invoice Sent: [Date]

CASE STATUS: Completed and Delivered
```

**Storage:**
- File: `exports/case_summary.pdf`
- Auto-generated from `case.json` + session data + delivery records
- Can be regenerated at any time

---

### 5.5.2 Practice Statistics Contribution

When a case is complete, clinician may opt to contribute anonymized data to practice dashboard (feature deferred to Post-MVP):

**What's collected (anonymized):**
- Evaluation type
- Total hours
- Turnaround time (referral to report)
- Diagnosis categories (broadl: psychotic vs. personality vs. other)
- Validity status
- Opinion type (competent, not competent, deferred, etc.)
- No patient name, no details, no identifiers

**Use case:**
Practice dashboard shows trends over time:
- "CST evaluations average 8.2 hours, completed in 18 days"
- "Validity concerns in 12% of cases"
- "Opinion distribution: competent 45%, not competent 40%, restoration possible 15%"

---

## Step 5.6: Archive

---

### 5.6.1 When to Archive

A case becomes eligible for archival when:
1. Report is signed and delivered (Stage 5 entry criteria met)
2. All post-delivery activities are complete (no pending questions)
3. All relevant deadlines (trial, sentencing, appeal) have passed, OR
4. Clinician manually decides case is no longer active

**No automatic archival.** Clinician decides when to archive.

---

### 5.6.2 Archive Workflow

**Step 1: Request Archive**

Clinician opens case and clicks "Archive Case" (in case menu or Overview)

**Step 2: Confirmation Dialog**

```
ARCHIVE CASE?

Case: 2026-0147_M.Johnson — CST Evaluation

You are about to move this case to archived status. This will:
✓ Remove it from your active case list
✓ Make it searchable with "Show Archived" filter
✓ Preserve all files and metadata on disk
✓ Keep it accessible if you're called to testify

All files remain intact. You can restore the case at any time.

Reason for archival (optional):
☐ Report delivered, case complete
☐ Trial/deposition completed
☐ Defendant restored to competency
☐ Case dismissed
☐ Other: [Text field]

[Archive] [Cancel]
```

**Step 3: Status Change**

1. Case status in SQLCipher changes to `"archived"`
2. Case disappears from default Dashboard view
3. Case remains fully searchable (SQL query, file search)
4. All files remain on disk unchanged
5. Audit trail logged: "Case archived by Dr. Truck Irwin, Reason: [text], at [timestamp]"

---

### 5.6.3 Archived Case Visibility

**Dashboard:**
- Default view shows active cases only
- Checkbox filter: "Show Archived Cases"
- When enabled, displays all archived cases with gray background
- Can click to view, but cannot edit

**File Tree:**
- Archived cases can be collapsed or hidden
- Icon indicates archived status (gray folder icon)
- Can expand and view all files
- Report can be opened read-only

**Search:**
- Case search includes archived cases by default
- Can filter: "Active cases only" or "Archived only"

---

### 5.6.4 Restore from Archive

**Scenario:** Clinician is called to testify years later. Case needs to be active again.

**Workflow:**

1. Clinician opens archived case
2. Clicks "Restore to Active"
3. Confirmation: "This will move the case back to your active case list."
4. Case status reverts to "Complete"
5. Case reappears in Dashboard and file tree
6. Audit trail: "Case restored to active status, Reason: [e.g., 'Called to testify'], at [timestamp]"

---

## Step 5.7: Records Retention

---

### 5.7.1 Retention Requirements

**Legal requirement:** State law determines how long clinical records must be retained.

**Typical retention standards:**
- **Adults:** 7 years after last contact (most states)
- **Minors:** Until age 25 OR 7 years after last contact (whichever is longer)
- **Forensic cases:** Longer retention sometimes required (check jurisdiction)

**Psygil's approach:**
- App calculates retention deadline based on patient DOB and evaluation date
- Tracks deadline in SQLCipher
- Warns clinician as deadline approaches
- Clinician decides if/when to destroy records

---

### 5.7.2 Retention Deadline Calculation

**For adult patients (≥18 at evaluation):**

```
RetentionDeadline = EvaluationDate + 7 years (per state law)
Example: Evaluation date 3/22/2026 → Retain until 3/22/2033
```

**For minor patients (<18 at evaluation):**

```
RetentionDeadline = max(
  PatientDOB + 25 years,         // Until age 25
  EvaluationDate + 7 years       // OR 7 years after eval
)
Example: Patient DOB 6/14/2008, Eval date 3/22/2026
  Age 25 date: 6/14/2033
  7-year deadline: 3/22/2033
  Retention deadline: 6/14/2033 (later date applies)
```

**Applied at case creation:**
- App calculates deadline from patient DOB and stores in `case.json` and SQLCipher
- Example case.json entry:
  ```json
  {
    "retention": {
      "deadline": "2033-03-22",
      "retentionYears": 7,
      "patientAgeAtEval": 34,
      "basis": "7 years from evaluation date (adult)"
    }
  }
  ```

---

### 5.7.3 Retention Deadline Warnings

**Dashboard alert (warning system):**

As the deadline approaches, case appears with colored indicator:

| Days Until Deadline | Background Color | Warning Label |
|-------------------|------------------|--------------|
| 0-30 days | RED | "RETENTION DEADLINE: [Date]" |
| 31-90 days | YELLOW | "Retention deadline: [Date]" |
| 91-365 days | GRAY | "Retention: [Date]" |
| 365+ days | None | (No warning) |

**Clicking the warning:**
- Opens case → Overview → Retention tab
- Shows: deadline date, days remaining, retention basis (7 years, age 25, etc.)
- Button: "I need to keep this case longer" (extends deadline 1 year)
- Button: "Destroy Records" (triggers destruction workflow)

---

### 5.7.4 Record Destruction

**No automatic deletion.** Clinician explicitly initiates destruction.

**Workflow:**

1. Clinician clicks "Destroy Records" on case with expired retention deadline
2. Confirmation dialog:
   ```
   DESTROY RECORDS?

   Case: 2026-0147_M.Johnson
   Retention deadline: 2026-03-22 (EXPIRED — [Days] ago)

   This action will:
   ✓ PERMANENTLY DELETE all files in the case directory
   ✓ REMOVE the case from SQLCipher database
   ✓ GENERATE a destruction certificate for your records
   ✓ This action CANNOT be undone

   Reason for destruction:
   ☐ Retention deadline reached
   ☐ Court order to destroy
   ☐ Patient request
   ☐ Other: [Text field]

   Clinician name: [Auto-populated]
   Date of destruction: [Today]

   [I understand - destroy records] [Cancel]
   ```

3. **If confirmed:**
   - App generates destruction certificate (PDF)
   - Case directory deleted from disk
   - Case record marked "destroyed" in SQLCipher (not deleted, flagged)
   - Audit trail: "Case records destroyed by Dr. Truck Irwin, Reason: [reason], at [timestamp], Certificate: [PDF filename]"

4. **Destruction certificate:**
   ```
   RECORD DESTRUCTION CERTIFICATE

   Date of Destruction: March 22, 2033
   Destroyed by: Dr. Truck Irwin, Psy.D., ABPP
   Case Number: 2026-0147
   Patient: M. Johnson, DOB 6/14/1991
   Evaluation Type: CST
   Evaluation Date: March 22, 2026
   Original Retention Deadline: March 22, 2033
   Reason for Destruction: Retention deadline reached

   This certifies that the above-referenced clinical records were
   permanently destroyed in accordance with [State] law regarding
   retention of clinical records. All files, electronic data, and
   physical documents have been securely erased.

   Record of destruction has been retained in Psygil audit trail
   as required by law.

   [Clinician signature]
   [License number]
   [Date]
   ```

   Stored in `exports/destruction_certificate_2033-03-22.pdf`

---

### 5.7.5 Preservation for Legal Holds

**Scenario:** Case is subject to subpoena or litigation hold.

**Workflow:**

1. Clinician receives subpoena or legal notice
2. Clicks "Place Legal Hold" on case
3. Dialog:
   ```
   PLACE LEGAL HOLD

   Case: 2026-0147_M.Johnson

   This will prevent automatic/manual record destruction until the hold
   is lifted.

   Reason for hold: [Text field]
   "Subpoena received from ABC Law Firm in deposition of M. Johnson v.
   State of Colorado, 2033-CV-12345"

   Hold effective date: [Today]
   Expected hold duration: [Text field]
   "Until resolution of appellate case, expected 2-3 years"

   [Place Hold] [Cancel]
   ```

4. Case marked with legal hold flag in SQLCipher
5. Retention deadline is automatically extended past hold expiration
6. "Destroy Records" button becomes unavailable while hold is in place
7. Audit trail: "Legal hold placed on case, Reason: [reason], at [timestamp]"

**Lifting the hold:**
- Clinician receives notice that litigation/subpoena is resolved
- Clicks "Remove Legal Hold"
- Retention deadline reverts to original (7 years from eval date)
- Record destruction becomes available again if deadline has passed

---

## Step 5.8: Case Export & Migration

---

### 5.8.1 Full Case Export

**Use case:** Clinician is retiring, changing practice, moving to another clinic, or backing up a case.

**Workflow:**

1. Clinician opens case → Case menu → "Export Case"
2. Export dialog:
   ```
   EXPORT CASE FOR MIGRATION

   Case: 2026-0147_M.Johnson

   Export format:
   ☑ Directory ZIP (contains all case files + manifest)
   ☐ Database backup (SQLCipher records only)

   What to include:
   ☑ All case files (intake, testing, interviews, diagnostics, report)
   ☑ Collateral documents
   ☑ All versions of report drafts
   ☑ Audit trail
   ☑ case.json manifest

   Destination: [Choose folder]

   [Export] [Cancel]
   ```

3. App creates ZIP file:
   ```
   2026-0147_M.Johnson_export.zip

   Contains:
   ├── case.json                          # Full manifest
   ├── README.txt                         # Export date, purpose, contents
   ├── intake/
   │   ├── intake_form.json
   │   ├── consent_signed.pdf
   │   └── biopsychosocial.json
   ├── referral/
   │   ├── referral_order.pdf
   │   └── referral_metadata.json
   ├── collateral/
   │   ├── [all collateral files]
   │   └── collateral_index.json
   ├── testing/
   │   ├── scores/
   │   ├── imports/
   │   ├── validity/
   │   └── testing_summary.json
   ├── interviews/
   │   ├── session_001/
   │   ├── session_002/
   │   └── interview_summary.json
   ├── diagnostics/
   │   ├── diagnostic_formulation.json
   │   ├── criteria_mapping.json
   │   ├── differential_dx.json
   │   └── evidence_matrix.json
   ├── report/
   │   ├── drafts/
   │   │   ├── draft_v1.docx
   │   │   ├── draft_v2.docx
   │   │   └── [all versions]
   │   ├── final/
   │   │   ├── evaluation_report.docx
   │   │   ├── evaluation_report.pdf
   │   │   └── [any addenda]
   │   └── report_metadata.json
   ├── exports/
   │   ├── invoices/
   │   └── [any case summaries, testimony prep materials]
   └── audit/
       └── audit_trail.jsonl
   ```

4. ZIP file saved to location clinician chose
5. File size reported: "Export file size: 45.3 MB"
6. Audit trail: "Case exported, Format: ZIP, Size: 45.3 MB, at [timestamp]"

---

### 5.8.2 Import into Another Instance

**Scenario:** Clinician moves to new clinic that also uses Psygil.

**Prerequisite:** New instance must be set up with same storage configuration (or migrated separately).

**Workflow:**

1. In new Psygil instance, clinician clicks: File → Import Case
2. Dialog:
   ```
   IMPORT CASE FROM ZIP

   [Select ZIP file exported from previous instance]

   Importing will:
   ✓ Recreate the case directory structure
   ✓ Restore all files and metadata
   ✓ Create case.json in new location
   ✓ Add case to SQLCipher database
   ✓ Verify all files present

   Case to import: 2026-0147_M.Johnson
   Original export date: 2026-04-15
   Files in ZIP: 47
   Total size: 45.3 MB

   [Import] [Cancel]
   ```

3. App validates ZIP structure
4. App copies all files to new case directory: `{new-project-root}/cases/2026-0147_M.Johnson/`
5. App creates new case record in SQLCipher (new timestamps, but preserving original evaluation dates)
6. Audit trail in new instance: "Case imported from ZIP, Original location: [previous clinician/clinic], Import date: [today]"

---

### 5.8.3 Backup Export

**Use case:** Clinician wants to back up an important case.

**Same workflow as 5.8.1** — the ZIP file serves as a complete backup. Clinician can store on external drive, cloud storage, or send to another clinician.

---

## Step 5.9: Error Handling & Edge Cases

---

### 5.9.1 Delivery Failures

**Email bounce:**
- SMTP server returns error (e.g., recipient address invalid)
- App captures error and presents to clinician:
  ```
  EMAIL DELIVERY FAILED

  Recipient: jroberts@adamslaw.com
  Error: "550 5.1.2 The email account that you tried to reach does not exist"

  Options:
  ☐ Try again
  ☐ Edit recipient address and retry
  ☐ Try different delivery method (print, court filing)
  ☐ Log as failed and move on

  [Take Action]
  ```
- Audit trail logs failure: "Email delivery to jroberts@adamslaw.com failed at [timestamp], Error: [error code]"

**Fax transmission failure:**
- Fax printer offline or error
- App logs error and clinician receives notification
- Clinician can retry or use alternative method

**Court filing system unavailable:**
- Clinician exports PDF but court portal is down
- Clinician retries later
- When filing succeeds, clinician logs delivery with confirmation number

---

### 5.9.2 Court Requests Original Test Data

**Scenario:** Prosecutor requests the actual MMPI-3 answer sheet or PAI raw data, not just the interpretation in the report.

**Clinician's decision:**
- This is outside Psygil's scope — Psygil manages report delivery, not discovery/subpoena compliance
- Clinician handles per legal guidance (may involve consult with attorney)
- Psygil can log this as a note:
  ```
  Post-delivery note added: "Prosecutor requested raw test data (MMPI-3
  answer sheet). Per attorney guidance, will provide under protective
  order signed by court. Documents not included in Psygil records
  package (external handling)."
  ```

---

### 5.9.3 Case Reopened for Additional Evaluation

**Scenario:** During trial, additional questions arise. Clinician needs to conduct supplemental testing.

**Workflow:**
1. Clinician clicks "Reopen Case for Additional Evaluation"
2. Case status reverts to "Review" (so report/addendum can be created)
3. OR, more likely: clinician creates an addendum (Section 5.4) documenting the additional findings

**Alternative:** Case remains archived; clinician creates a *separate* case for the supplemental evaluation if the new evaluation is substantial enough to warrant its own report.

---

### 5.9.4 Clinician Retires / Leaves Practice

**Scenario:** Dr. Smith retires. Another clinician needs access to her cases.

**Workflow:**
1. Clinic administrator or new clinician opens Dr. Smith's cases
2. Clicks "Transfer Case Ownership"
3. Dialog:
   ```
   TRANSFER CASE OWNERSHIP

   From: Dr. Sarah Smith
   To: Dr. Michael Chen

   This will:
   ✓ Change evaluator/owner in case.json
   ✓ Update SQLCipher records
   ✓ Log ownership transfer in audit trail
   ✓ Preserve all original evaluation data

   Cases to transfer: [Checkbox list of Dr. Smith's open cases]
   ☑ 2026-0095_J.Williams — CST (Report signed)
   ☑ 2026-0103_L.Garcia — Custody (Report signed)
   ☑ 2026-0118_D.Brown — Risk Assessment (Report signed)

   Reason for transfer: [Text field]
   "Dr. Smith has retired. Dr. Chen is taking over client relationships."

   [Transfer] [Cancel]
   ```
4. Audit trail adds: "Case transferred from Dr. Sarah Smith to Dr. Michael Chen, Reason: [reason], at [timestamp]"
5. New clinician can now access case, answer questions, prepare for testimony, generate addenda

---

### 5.9.5 Malpractice Claim

**Scenario:** Patient sues clinician claiming the evaluation was negligent.

**Clinician's obligation:**
- Notify malpractice insurance
- Consult with attorney
- Place legal hold on case (Section 5.7.5)
- Preserve all files and audit trail
- Do not alter or delete any records

**Psygil's role:**
- Case marked with "Legal Hold" status (prevents destruction)
- Audit trail is forensically valuable — demonstrates clinician's independent judgment at each step
- All work product (drafts, reviews, edits) is preserved
- Case can be exported in full for attorney review

---

### 5.9.6 Subpoena for Case Records

**Scenario:** Opposing counsel subpoenas all case materials.

**Clinician's obligation:**
- Work with attorney to determine what's discoverable
- Provide records per legal guidance (may involve redaction of attorney-client communications, if applicable)
- Place legal hold to prevent destruction (Section 5.7.5)

**Psygil's support:**
- Case can be exported as full ZIP (Section 5.8)
- Audit trail demonstrates clinician's independence (valuable for defense)
- All files are preserved and traceable

---

## Step 5.10: Cross-Cutting Concerns

### Audit Trail (Continued from Section 5)

Every action in Stage 5 is logged:

```json
{"timestamp":"2026-03-22T15:45:00Z","action":"report_delivered_email","caseNumber":"2026-0147","method":"email","recipients":["jroberts@adamslaw.com"],"status":"sent"}
{"timestamp":"2026-03-22T17:30:00Z","action":"invoice_generated","caseNumber":"2026-0147","invoiceNumber":"INV-2026-0147","totalHours":6.75,"totalAmount":1837.50}
{"timestamp":"2026-03-25T14:30:00Z","action":"addendum_created","caseNumber":"2026-0147","reason":"Clarification on understanding of courtroom procedures"}
{"timestamp":"2026-03-26T10:00:00Z","action":"addendum_delivered_email","caseNumber":"2026-0147","addendumDate":"2026-03-25","recipient":"Denver District Court"}
{"timestamp":"2026-04-15T11:00:00Z","action":"case_archived","caseNumber":"2026-0147","reason":"Trial completed"}
{"timestamp":"2033-03-22T09:00:00Z","action":"case_records_destroyed","caseNumber":"2026-0147","reason":"Retention deadline reached","certificate":"destruction_cert_2033-03-22.pdf"}
```

---

## IPC Contracts for Stage 5

**New channels (extends doc 02):**

```typescript
// Report delivery methods
ipcMain.handle('report:printToPDF', async (event, {
  caseNumber: string,
  includesCover: boolean
}) => Promise<{ pdfPath: string, pageCount: number }>;

ipcMain.handle('report:sendEmail', async (event, {
  caseNumber: string,
  recipients: Array<{name: string, email: string}>,
  subject: string,
  body: string,
  encryptPDF: boolean,
  encryptionPassword?: string
}) => Promise<{ sent: boolean, status: string, timestamp: string }>;

ipcMain.handle('report:createRecordsPackage', async (event, {
  caseNumber: string,
  includedDocuments: string[]  // ["report", "consent", "tests", ...]
}) => Promise<{ zipPath: string, fileCount: number, totalSize: number }>;

// Invoicing
ipcMain.handle('invoice:generate', async (event, {
  caseNumber: string,
  hourlyRate: number,
  itemizedServices: Array<{type: string, hours: number, rate: number, cptCode: string}>
}) => Promise<{ pdfPath: string, invoiceNumber: string, totalAmount: number }>;

// Addendum
ipcMain.handle('report:createAddendum', async (event, {
  caseNumber: string,
  reason: string,
  templateType: 'correction' | 'clarification' | 'new_info' | 'supplemental' | 'updated'
}) => Promise<{ docxPath: string }>;

ipcMain.handle('report:signAddendum', async (event, {
  caseNumber: string,
  addendumPath: string
}) => Promise<{ signed: boolean, pdfPath: string, timestamp: string }>;

// Archive
ipcMain.handle('case:archive', async (event, {
  caseNumber: string,
  reason: string
}) => Promise<{ archived: boolean, timestamp: string }>;

ipcMain.handle('case:restore', async (event, {
  caseNumber: string,
  reason: string
}) => Promise<{ restored: boolean, timestamp: string }>;

// Records retention
ipcMain.handle('case:placeHold', async (event, {
  caseNumber: string,
  reason: string,
  expectedDuration: string
}) => Promise<{ held: boolean, holdDate: string }>;

ipcMain.handle('case:destroyRecords', async (event, {
  caseNumber: string,
  reason: string
}) => Promise<{ destroyed: boolean, certificate: string }>;

// Export/Import
ipcMain.handle('case:export', async (event, {
  caseNumber: string,
  format: 'zip' | 'backup'
}) => Promise<{ exportPath: string, fileSize: number, fileCount: number }>;

ipcMain.handle('case:import', async (event, {
  zipPath: string
}) => Promise<{ caseNumber: string, filesRestored: number, status: string }>;
```

---

## Data Model — Stage 5 Additions

### delivery_events table

```sql
CREATE TABLE delivery_events (
  id INTEGER PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  reportVersion TEXT,
  deliveryMethod TEXT,  -- 'email', 'print', 'court_filing', 'fax', 'records_package'
  deliveryDateTime TIMESTAMP,
  recipientName TEXT,
  recipientType TEXT,  -- 'attorney', 'court', 'physician', 'insurance', 'other'
  recipientEmail TEXT,
  recipientAddress TEXT,
  recipientPhone TEXT,
  encryptionUsed BOOLEAN,
  documentsSent TEXT,  -- JSON array
  confirmationReceived BOOLEAN,
  confirmationDetails TEXT,
  notes TEXT,
  status TEXT,  -- 'sent', 'delivered', 'failed', 'logged'
  createdAt TIMESTAMP,
  FOREIGN KEY (caseNumber) REFERENCES cases(caseNumber)
);
```

### invoices table

```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  invoiceNumber TEXT UNIQUE,
  caseNumber TEXT NOT NULL,
  invoiceDate DATE,
  dueDate DATE,
  totalHours DECIMAL(8, 2),
  hourlyRate DECIMAL(8, 2),
  totalAmount DECIMAL(10, 2),
  itemizedServices TEXT,  -- JSON array of {type, hours, rate, cptCode}
  billedTo TEXT,  -- 'insurance', 'patient', 'court'
  status TEXT,  -- 'generated', 'sent', 'paid'
  createdAt TIMESTAMP,
  sentAt TIMESTAMP,
  FOREIGN KEY (caseNumber) REFERENCES cases(caseNumber)
);
```

### addenda table

```sql
CREATE TABLE addenda (
  id INTEGER PRIMARY KEY,
  caseNumber TEXT NOT NULL,
  addendumDate DATE,
  reason TEXT,  -- 'correction', 'clarification', 'new_info', 'supplemental', 'updated'
  description TEXT,
  docxPath TEXT,
  pdfPath TEXT,
  signed BOOLEAN,
  signedDate TIMESTAMP,
  signedBy TEXT,
  status TEXT,  -- 'draft', 'signed', 'delivered'
  createdAt TIMESTAMP,
  FOREIGN KEY (caseNumber) REFERENCES cases(caseNumber)
);
```

### archive_status table

```sql
CREATE TABLE archive_status (
  id INTEGER PRIMARY KEY,
  caseNumber TEXT NOT NULL UNIQUE,
  status TEXT,  -- 'active', 'archived', 'destroyed'
  archivedDate TIMESTAMP,
  archivedReason TEXT,
  restoredDate TIMESTAMP,
  restoredReason TEXT,
  retentionDeadline DATE,
  retentionBasis TEXT,  -- '7_years', 'age_25', 'custom'
  legalHold BOOLEAN,
  legalHoldReason TEXT,
  legalHoldDate TIMESTAMP,
  destroyedDate TIMESTAMP,
  destroyedReason TEXT,
  destroyCertificatePath TEXT,
  FOREIGN KEY (caseNumber) REFERENCES cases(caseNumber)
);
```

---

## Summary: Stage 5 Workflows at a Glance

| Activity | Trigger | Input | Output | Status Tracking |
|----------|---------|-------|--------|-----------------|
| **Report Delivery** | Report signed | Recipient info | Delivery logged, audit trail | delivery_events table |
| **Billing & Invoice** | End of case | Hours + rate + CPT | PDF invoice | invoices table |
| **Testimony Prep** | Clinician requests | Case summary | PDF materials (4 docs) | exports/ directory |
| **Addendum** | New info / correction | Addendum text | Signed addendum PDF | addenda table |
| **Archive** | Clinician decides | Archive reason | Status changed, hidden from active view | archive_status table |
| **Destruction** | Retention deadline | Destruction reason | Files deleted, certificate | archive_status + audit trail |
| **Export** | Migration / backup | Export type | ZIP file with full case | exports/ directory |

---

## Relationship to Existing Documents

| Document | What It Covers | Reference in This Doc |
|----------|---------------|----------------------|
| Doc 18 (Case Lifecycle) | Stage 5 overview with high-level steps | Detailed implementation of each step |
| Doc 16 (Directory Schema) | `exports/` directory structure | Files created in exports/ at each stage 5 step |
| Doc 15 (UNID Redaction) | Redaction pipeline | Not applicable (reports contain full PHI) |
| Doc 02 (IPC Contracts) | Basic API channels | New Stage 5 IPC contracts defined here |
| BUILD_MANIFEST.md | Sprint task assignments | Sprint 5 tasks implement this spec |

---

## Key Invariants (Stage 5)

1. **No automatic report changes.** Once signed, the report is immutable. Changes require addenda.
2. **No automatic destruction.** Records are never deleted without explicit clinician action.
3. **Full audit trail.** Every delivery, addendum, and archival action is logged with timestamp and user.
4. **Multiple delivery methods supported.** Same report can go to multiple recipients via different methods.
5. **Invoicing is lightweight.** Psygil generates invoices but is not a full billing system.
6. **Legal holds prevent destruction.** Subpoenaed cases are protected from accidental deletion.
7. **Export enables migration.** Cases can be migrated between Psygil instances via ZIP export/import.
8. **Retention deadlines are calculated, not guessed.** App tracks retention deadline per case based on patient age and state law.

---

## Version History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-22 | 1.0 | Truck Irwin | Initial comprehensive specification for Stage 5 |

