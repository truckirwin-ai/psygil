# Walkthrough

What this covers: a stage-by-stage explanation of the six-stage clinical pipeline, what you do at each stage, what blocks advancement, and how the final report is published and archived.

---

## The Six-Stage Pipeline

Every case in Psygil moves through six stages in sequence:

```
Onboarding -> Testing -> Interview -> Diagnostics -> Review -> Complete
```

The colored pill next to the case name in the Dashboard shows the current stage. The folder tree shows only documents that exist at the current stage; prior-stage documents remain visible as the case advances.

---

## Stage 0: Onboarding

**What you do:** Gather initial case information and document informed consent.

The Clinical Overview shows the case header with demographics, evaluation type, and referral source. From here you work through:

- **Intake form:** Patient demographics, referral question, presenting complaint, and basic biopsychosocial history.
- **Referral documents:** Upload the court order, referral letter, or attorney request. Supported formats are PDF, DOCX, and plain text.
- **Consent form:** Upload or mark the signed informed consent as on file.

The Ingestor agent can parse uploaded documents and populate structured fields. Review extracted data before accepting it.

**What blocks advancement:** Patient name, date of birth, evaluation type, referral question, and at least one uploaded document.

---

## Stage 1: Testing

**What you do:** Record the psychological test battery, upload score reports, and confirm validity.

For each instrument in your battery:

1. Click Add Test in the Test Battery panel.
2. Select the instrument from your configured library.
3. Enter the administration date and upload the publisher score report (PDF or text export from Q-global, PARiConnect, etc.).
4. Mark the test as scored and reviewed.

Complete the validity summary before advancing.

**What blocks advancement:** At least one instrument scored and reviewed; validity summary complete or marked not applicable.

---

## Stage 2: Interview

**What you do:** Document clinical interviews, behavioral observations, and collateral contacts.

Add session notes for each clinical interview. The Mental Status Exam form is linked to the primary session. Document collateral contacts (family, attorneys, prior providers) in the Collateral Interviews section. If you use Whisper transcription, transcripts appear here for review.

**What blocks advancement:** At least one session with Mental Status Exam fields complete or marked not applicable.

---

## Stage 3: Diagnostics

**What you do:** Review the Diagnostician agent's evidence summary, then make and sign every diagnostic decision yourself.

**The clinician always diagnoses. The Diagnostician agent presents evidence. You decide.**

The agent maps test scores, validity data, and interview observations against diagnostic criteria. It presents candidate diagnoses with supporting evidence. Status is always `evidence_presented` until you act.

For each candidate diagnosis, you must choose one of three dispositions:

- **Confirm:** You accept this diagnosis. A free-text justification field is required. Your name and the timestamp are recorded in the audit trail.
- **Rule out:** You reject this diagnosis. A brief reason is required.
- **Defer:** You are reserving judgment. You may return to this diagnosis before advancing.

You can also add diagnoses the agent did not present. There is no "Accept All" button. Every decision is individual.

When all referral questions are addressed and at least one diagnosis is confirmed (or "No diagnosis" documented), the Advance Stage button becomes available.

**Why this matters:** In forensic settings, your diagnostic opinion is testimony subject to Daubert challenge. The audit trail of your individual, timestamped decisions establishes that you, not an algorithm, made the call.

---

## Stage 4: Review

**What you do:** Generate a draft report, edit it, run the Editor agent's review, and sign the final report.

Click Generate Draft in the Report panel. The Writer agent assembles the full case record, redacts PHI before sending it to the API, and returns a structured draft. Every section carries a `revision_notes` field. Sections with a `draft_requiring_revision` flag are highlighted in yellow.

Edit the draft as you would any document. Run the Editor agent at any time for a nine-category adversarial check: factual consistency, logical coherence, legal adequacy, ethical compliance, testimony defensibility, formatting, completeness, internal consistency, and bias indicators.

When ready: click Finalize Report, then Sign Report. The app validates that all required sections are present and `draft_requiring_revision` flags are resolved, then applies your digital signature and computes an integrity hash. The signed report is read-only. Further changes require a separate addendum.

**What blocks advancement:** A final, signed report must exist. The app will not advance the case to Complete without it.

---

## Stage 5: Complete

**What you do:** Deliver the report, record delivery, and archive the case.

The case folder contains `report/final/evaluation_report.docx` and `evaluation_report.pdf`. Deliver by your preferred method and record the delivery method and recipient in the Delivery Log. Cases are never automatically deleted. Use Archive to remove a case from the active view without destroying data.

### Audit Trail Export

The full audit trail is available via the Audit Trail tab in the Clinical Overview. Each row records the action type, actor, timestamp, and a cryptographic hash linking it to the prior row. Any modification to a past row breaks the chain.

Click Export Audit Trail to download a CSV with all rows and hash values, suitable for legal review or compliance documentation.

---

## See Also

- [quick-start.md](./quick-start.md): Installation and first case setup
- [ai-assistant.md](./ai-assistant.md): Detailed explanation of each agent's role and outputs
- [hipaa.md](./hipaa.md): How the audit trail, encryption, and PHI redaction work
- [templates.md](./templates.md): Customizing report templates
