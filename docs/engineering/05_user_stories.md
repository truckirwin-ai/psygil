# Psygil MVP User Stories

**Document Version:** 1.0
**Date:** 2026-03-19
**Status:** MVP Specification

---

## Overview

This document defines comprehensive user stories for the Psygil MVP, organized by Epic. Each story includes acceptance criteria in Given/When/Then format, priority designation (P0/P1/P2), and complexity estimation (S/M/L/XL).

**System Context:**
- Target Users: Forensic and Clinical Psychologists
- Architecture: Four AI Agents (Ingestor, Diagnostician, Writer, Editor/Legal Reviewer) + Three Gates + OnlyOffice Editor
- Data Handling: Local-first PHI, encrypted storage, offline-capable
- Goal: Streamline evaluation documentation from data ingestion through final attestation

---

## EPIC 1: Onboarding & Setup

### Story 1.1: First-Time Application Setup
**As a** clinical psychologist using Psygil for the first time
**I want to** complete initial onboarding in under 30 minutes
**So that** I can immediately begin evaluating cases

**Acceptance Criteria:**
- Given the Psygil application is launched for the first time
- When the user enters the onboarding flow
- Then a step-by-step wizard guides setup (no mandatory skips)
- And the wizard includes: practice profile selection, diagnosis catalog confirmation, instrument library setup, and report template selection
- And each step is completable in <3 minutes
- And upon completion, user can create and begin a new case
- And the entire flow is completable in <30 minutes

**Priority:** P0
**Complexity:** M

---

### Story 1.2: Writing Sample Upload & Style Extraction
**As a** psychologist
**I want to** upload a sample of my previous written evaluations
**So that** Psygil can extract and match my writing style

**Acceptance Criteria:**
- Given a user in onboarding or Settings > Style Configuration
- When they click "Upload Writing Samples"
- Then a file picker accepts .docx, .pdf, and .txt files
- And up to 5 samples can be uploaded (cumulative max 50MB)
- And the system extracts: tone, vocabulary, sentence structure, organizational patterns, and terminology preferences
- And extracted patterns are displayed for review/override
- And the user can approve or manually adjust style rules
- And these rules are stored and applied to future AI-generated sections

**Priority:** P0
**Complexity:** M

---

### Story 1.3: Practice Profile Selection
**As a** user completing onboarding
**I want to** select my primary practice context
**So that** Psygil configures diagnoses, templates, and language appropriately

**Acceptance Criteria:**
- Given the onboarding flow (Step 2)
- When the user reaches practice profile selection
- Then three options are presented: "Forensic Criminal", "Forensic Civil", "Clinical General"
- And each option shows a description of case types and legal standards
- And one profile can be selected (with ability to change in Settings later)
- And selecting a profile enables/disables relevant diagnosis categories (e.g., Criminal Responsibility, Competency only for Forensic Criminal)
- And default report templates are set per profile
- And the selection is stored and applied to all new cases by default

**Priority:** P0
**Complexity:** S

---

### Story 1.4: Diagnosis Catalog Configuration
**As a** user in onboarding or Settings
**I want to** configure which diagnoses are available for my cases
**So that** only relevant diagnoses appear in my diagnostic decision workflow

**Acceptance Criteria:**
- Given a user in Settings > Diagnosis Catalog
- When they view the diagnosis library
- Then all DSM-5-TR diagnoses are displayed with enable/disable toggles
- And by default, profile-relevant diagnoses are enabled (e.g., all Neurocognitive Disorders for Clinical, Insanity/Competency for Forensic Criminal)
- And user can manually enable/disable any diagnosis
- And user can add custom diagnoses with: name, criteria summary, associated instruments
- And changes are stored and take effect immediately for new cases
- And previously-created cases retain their configured diagnosis set

**Priority:** P0
**Complexity:** M

---

### Story 1.5: Instrument Library Configuration
**As a** user in onboarding or Settings
**I want to** specify which psychological instruments I use
**So that** Psygil imports test data efficiently and suggests relevant instruments

**Acceptance Criteria:**
- Given a user in Settings > Instrument Library
- When they view the instrument catalog
- Then standard instruments (WAIS-IV, MMPI-2-RF, PAI, etc.) are pre-configured
- And user can enable/disable each instrument
- And user can add custom instruments with: name, abbrev., subtest names, score types (standard, percentile, raw)
- And enabled instruments appear in "Import Test Scores" workflows
- And the system suggests diagnoses based on which instruments are administered
- And instrument list can be edited at any time (affects future cases only)

**Priority:** P0
**Complexity:** M

---

### Story 1.6: Report Template Selection & Customization
**As a** user in onboarding or Settings
**I want to** choose and customize my report template
**So that** generated reports follow my preferred organizational structure

**Acceptance Criteria:**
- Given a user in onboarding (Step 4) or Settings > Report Templates
- When they view available templates
- Then profile-default templates are highlighted (Forensic Criminal, Forensic Civil, Clinical General)
- And user can preview each template's section order
- And user can select a template to use
- And user can customize section order: drag-and-drop reordering
- And user can enable/disable optional sections (e.g., Cultural Context, Limitations)
- And customizations are stored as a "Personal Template"
- And the template is applied to all new cases by default
- And template can be changed per-case before generation

**Priority:** P1
**Complexity:** M

---

## EPIC 2: Case Management

### Story 2.1: Create New Case with Referral Document
**As a** psychologist
**I want to** create a new evaluation case with referral information
**So that** the evaluation context is established from the start

**Acceptance Criteria:**
- Given a user on the Cases dashboard
- When they click "New Case"
- Then a form appears requesting:
  - Evaluee name (required), DOB (required), age (auto-calculated)
  - Case ID/Reference # (optional)
  - Referral source/attorney name (required)
  - Evaluation type: Criminal Responsibility, Competency, Custody, Clinical Diagnostic, etc. (required)
  - Case description/questions for evaluation (optional text area)
  - Referral document upload (optional PDF/DOCX)
- And all required fields must be completed before case creation
- And a referral document, if uploaded, is parsed for embedded evaluation questions
- And extracted questions are displayed for confirmation
- And case is created with initial data and assigned a unique case ID
- And user is directed to the Case Dashboard for the new case

**Priority:** P0
**Complexity:** M

---

### Story 2.2: View Case Dashboard (Kanban Board)
**As a** psychologist
**I want to** see the status of a case at a glance
**So that** I understand which stage the evaluation is in and what actions are next

**Acceptance Criteria:**
- Given a user viewing a specific case
- When the case dashboard loads
- Then a 5-column Kanban board is displayed:
  - Column 1: Case Info (evaluee name, DOB, case type, referral source)
  - Column 2: Data Ingestion (shows number of sessions, documents uploaded)
  - Column 3: Gate 1 - Data Confirmation (status: pending, in progress, complete)
  - Column 4: Evidence Mapping (status: pending, in progress, complete)
  - Column 5: Report Generation (status: draft, in progress, complete)
- And a 6th column shows Gate 2 (Diagnostic Decision) and Gate 3 (Final Attestation) status
- And clicking each column shows detail and available actions
- And last-modified timestamp is visible
- And quick-actions buttons appear for most common next steps
- And case data (name, type, demographics) is editable from the dashboard

**Priority:** P0
**Complexity:** M

---

### Story 2.3: Multi-Session Case Handling
**As a** a psychologist conducting evaluation sessions over multiple days
**I want to** add multiple evaluation sessions to a single case
**So that** I can ingest data from all sessions into one comprehensive evaluation

**Acceptance Criteria:**
- Given a user on a case dashboard
- When they click "Add Session"
- Then a modal appears requesting:
  - Session date (required)
  - Session description/notes (optional)
  - Evaluee location/virtual/in-person indicator (optional)
  - Evaluator name (if different from primary clinician, optional)
- And a unique session ID is generated
- And multiple sessions can be added to a single case (no limit)
- And each session can have separate documents/test scores uploaded in Gate 1
- And session data is preserved and associated with the case record
- And the case dashboard shows total session count and dates
- And diagnostic decisions and report generation treat all sessions as a unified evaluation

**Priority:** P0
**Complexity:** S

---

### Story 2.4: Case Search and Filtering
**As a** a psychologist with many active cases
**I want to** search and filter cases quickly
**So that** I can find cases by status, evaluee name, date range, or case type

**Acceptance Criteria:**
- Given a user on the Cases list page
- When they use the search/filter interface
- Then the following filters are available:
  - Text search (evaluee name, case ID, referral source)
  - Status filter (Data Ingestion, Gate 1, Evidence Mapping, Report Draft, Finalized)
  - Case type filter (Criminal Responsibility, Competency, Custody, Clinical Diagnostic, etc.)
  - Date range (created, last modified)
  - Evaluator (if multi-user)
- And filters can be combined
- And results update in real-time as filters are applied
- And search results show case summary (evaluee name, type, status, last modified)
- And results are sortable by name, status, date, or type
- And filtered view can be saved and recalled

**Priority:** P1
**Complexity:** M

---

### Story 2.5: Case Archival
**As a** a psychologist managing completed cases
**I want to** archive old cases so they don't clutter the active case list
**So that** my current cases are easy to find and manage

**Acceptance Criteria:**
- Given a user viewing a case dashboard
- When they click "Archive Case" (in case menu)
- Then a confirmation dialog appears stating the case will be hidden from active list
- And archived cases are moved to an "Archived Cases" section
- And archived cases cannot be edited or modified
- And archived cases can be un-archived if needed
- And audit trail is locked when case is archived
- And search/filter interface includes an "Archived" toggle
- And archived cases can be exported before archival (optional)

**Priority:** P2
**Complexity:** S

---

## EPIC 3: Document Ingestion (Ingestor Agent)

### Story 3.1: Upload Documents (Multi-Format Support)
**As a** psychologist in Gate 1
**I want to** upload multiple types of evaluation documents
**So that** the Ingestor Agent can extract data from all available sources

**Acceptance Criteria:**
- Given a user in Gate 1 - Data Confirmation
- When they click "Upload Documents"
- Then a file picker allows selection of:
  - PDF files (Q-Global reports, PARiConnect reports, referral documents)
  - DOCX files (prior evaluations, narrative notes)
  - VTT files (transcripts from audio recording)
  - MP3/WAV audio files (direct recordings of evaluation sessions)
- And up to 20 files can be uploaded per session (max 500MB total)
- And upload progress is shown with percentage complete
- And files are queued for Ingestor processing
- And user is notified when processing begins and completes
- And document list shows uploaded files with upload timestamp
- And files can be deleted before Gate 1 completion (with confirmation)

**Priority:** P0
**Complexity:** M

---

### Story 3.2: Import Q-Global Score Report (PDF Parsing)
**As a** a psychologist with test data from Q-Global
**I want to** upload a Q-Global PDF report and have scores automatically extracted
**So that** I don't need to manually enter test data

**Acceptance Criteria:**
- Given a user uploads a Q-Global PDF report in Gate 1
- When the Ingestor processes the document
- Then the system extracts:
  - Test name and completion date
  - All subtest scores (T-scores, scaled scores, percentiles)
  - Composite/Index scores
  - Validity indicators (if present)
  - Test administration notes/flags
- And extracted data is presented in a structured format for Gate 1 confirmation
- And user can correct individual scores if parsing failed
- And corrected values override extracted values
- And extraction success rate is shown (e.g., "23/24 scores extracted")
- And any unparseable elements are flagged for manual entry

**Priority:** P0
**Complexity:** M

---

### Story 3.3: Import PARiConnect Score Report (PDF Parsing)
**As a** a psychologist with test data from PARiConnect
**I want to** upload a PARiConnect PDF report and have scores automatically extracted
**So that** I don't need to manually enter test data

**Acceptance Criteria:**
- Given a user uploads a PARiConnect PDF report in Gate 1
- When the Ingestor processes the document
- Then the system extracts:
  - Test name and completion date
  - All subtest scores (raw, T-scores, percentiles)
  - Composite/profile scores
  - Validity indices (VRIN, TRIN, F-family, etc. for MMPI-2-RF)
  - Test-specific interpretive notes
- And extracted data is presented in a structured format for Gate 1 confirmation
- And user can correct individual scores if parsing failed
- And extraction success rate is shown
- And any parsing errors are flagged for manual correction

**Priority:** P0
**Complexity:** M

---

### Story 3.4: Manual Test Score Entry
**As a** a psychologist with test data not in automated report format
**I want to** manually enter psychological test scores
**So that** all evaluation data is included in the assessment

**Acceptance Criteria:**
- Given a user in Gate 1 - Data Confirmation
- When they click "Enter Test Scores Manually"
- Then a form appears with:
  - Instrument name dropdown (populated from configured instrument library)
  - Test administration date
  - Individual subtest/scale fields (dynamically populated based on selected instrument)
  - Score type toggles (raw, standard, T-score, percentile, etc.)
  - Optional notes field
- And numeric validation prevents invalid score entry (e.g., T-scores must be 20-80)
- And form auto-saves after each entry
- And multiple tests can be entered for a single session
- And entered data is reviewed in Gate 1 confirmation view
- And user can edit/delete manually-entered scores

**Priority:** P0
**Complexity:** S

---

### Story 3.5: Referral Document Parsing (Extract Evaluation Questions)
**As a** a psychologist receiving a referral document
**I want to** have key evaluation questions automatically extracted from the referral
**So that** I ensure all referral questions are addressed in my report

**Acceptance Criteria:**
- Given a user uploads a referral document (PDF/DOCX) in Gate 1
- When the Ingestor processes the document
- Then the system identifies and extracts:
  - Explicit questions ("Is the defendant competent to stand trial?")
  - Implicit questions (inferred from legal context)
  - Case background information
  - Evaluation scope/limitations
- And extracted questions are presented as a checklist in Gate 1
- And user can confirm, edit, add, or remove questions
- And confirmed questions are tracked and cross-referenced in the final report
- And report generation ensures all referral questions receive explicit attention in diagnostic/conclusion sections

**Priority:** P0
**Complexity:** M

---

### Story 3.6: Audio Transcription (Whisper Integration)
**As a** a psychologist who records evaluation sessions
**I want to** upload audio files and have them automatically transcribed
**So that** behavioral observations and statements are captured without manual transcription

**Acceptance Criteria:**
- Given a user uploads an MP3 or WAV file in Gate 1
- When the Ingestor processes the audio
- Then the system:
  - Sends audio to Whisper transcription service
  - Shows progress indicator during transcription
  - Returns transcribed text with speaker labels (if detectable)
  - Flags uncertain sections with confidence indicators
- And transcribed text is saved as a VTT file and displayed in Gate 1
- And user can review and correct transcription errors
- And sections of transcript can be marked for inclusion in final report
- And behavioral observations from transcript are extracted by Diagnostician

**Priority:** P1
**Complexity:** M

---

### Story 3.7: Psychometrist Test Score Entry (Restricted Role)
**As a** a psychometrist
**I want to** enter test scores and upload test reports without seeing case narrative
**So that** I can contribute test administration data while respecting case confidentiality

**Acceptance Criteria:**
- Given a psychometrist has been invited to a case with restricted permissions
- When they log in
- Then they can only:
  - View evaluee name and DOB
  - Access "Upload Test Scores" in Gate 1
  - Upload PDF reports (Q-Global, PARiConnect)
  - Manually enter test scores
  - Add administration notes
- And they cannot:
  - View case narrative, referral questions, or diagnostic information
  - Access Gates 2-3 or report generation
  - View behavioral observations or clinical notes
- And psychometrist uploads are tracked in audit trail
- And psychometrist sign-off is recorded per test administered

**Priority:** P1
**Complexity:** M

---

## EPIC 4: Gate 1 — Data Confirmation

### Story 4.1: Review Extracted Data in Split View
**As a** a psychologist confirming ingested data
**I want to** see extracted data alongside original source documents
**So that** I can verify accuracy and completeness

**Acceptance Criteria:**
- Given a user in Gate 1 - Data Confirmation
- When they view extracted data
- Then a split-screen layout displays:
  - Left side: Original source document (PDF/image with scrolling)
  - Right side: Extracted data in structured format (test scores, behavioral observations, etc.)
- And data categories are labeled and color-coded (Test Scores, Behavioral Observations, Medical History, etc.)
- And clicking on an extracted field highlights the corresponding region in the source document
- And user can view one document at a time (selectable from upload list)
- And the view is responsive and usable on standard monitors
- And print functionality preserves the layout

**Priority:** P0
**Complexity:** M

---

### Story 4.2: Confirm/Correct Each Data Category
**As a** a psychologist in Gate 1
**I want to** confirm or correct each category of extracted data
**So that** the evaluation record is accurate before proceeding

**Acceptance Criteria:**
- Given a user viewing extracted data in Gate 1
- When they interact with each data category:
  - Test Scores: Confirm/edit individual subtest scores, add notes
  - Behavioral Observations: Confirm extracted observations, add additional observations
  - Medical/Psychiatric History: Confirm diagnoses, medications, relevant history
  - Substance Use History: Confirm timeline, substances, patterns
  - Referral Questions: Confirm extracted questions, add/remove as needed
- And each field shows confidence level or extraction accuracy
- And corrections are tracked (original value, corrected value, timestamp)
- And bulk confirmation allowed ("Confirm All Visible")
- And incomplete/uncertain sections are highlighted for required attention
- And user cannot proceed to next stage until all required categories are confirmed

**Priority:** P0
**Complexity:** M

---

### Story 4.3: Add Manual Behavioral Observations
**As a** a psychologist conducting the evaluation
**I want to** add behavioral observations that weren't automatically extracted
**So that** all relevant observations are included in the diagnostic assessment

**Acceptance Criteria:**
- Given a user in Gate 1 - Data Confirmation
- When they click "Add Behavioral Observation"
- Then a form appears with:
  - Observation category dropdown (Appearance, Affect, Speech, Thought Process, Insight, Judgment, etc.)
  - Free-text observation description
  - Optional tag/flag (e.g., "Notable", "Concerning", "Contradicts Assessment")
  - Optional reference to specific evaluation session
- And observations are stored and displayed in a list
- And observations can be edited or deleted
- And all observations are available for Diagnostician Agent processing
- And observations are preserved if documents are re-ingested

**Priority:** P0
**Complexity:** S

---

### Story 4.4: Flag Missing Data
**As a** a psychologist confirming data
**I want to** flag missing or incomplete data categories
**So that** I can identify what additional evaluation needs to occur

**Acceptance Criteria:**
- Given a user in Gate 1 - Data Confirmation
- When they identify missing or incomplete data
- Then they can click "Flag as Missing" on any data category
- And a modal allows them to specify:
  - What data is missing (free text)
  - Priority (Required for diagnosis, Would strengthen assessment, Optional)
  - Action needed (Re-test needed, Additional documentation, Clinical interview needed, etc.)
- And flagged items appear in a dedicated "Missing Data" section at bottom of Gate 1
- And missing data flags are carried forward to report generation
- And a summary of missing data is available in case dashboard
- And user cannot finalize Gate 1 if "Required" items are flagged (unless explicitly overridden)

**Priority:** P1
**Complexity:** S

---

### Story 4.5: Re-ingest with New Documents Added
**As a** a psychologist adding additional documents during Gate 1
**I want to** re-ingest documents without losing previous confirmations
**So that** I can incorporate new test data or documents without restarting Gate 1

**Acceptance Criteria:**
- Given a user has completed partial confirmations in Gate 1
- When they upload additional documents
- Then the system:
  - Processes new documents through Ingestor Agent
  - Displays new extracted data alongside existing confirmed data
  - Preserves all previous confirmations/corrections
  - Highlights newly-extracted categories for confirmation
- And user can selectively confirm new data without re-confirming existing data
- And if re-extraction refines previous data, user can accept new version or keep previous
- And document upload/re-ingest cycle can repeat until user is satisfied
- And "Complete Gate 1" button is only enabled when all current documents are confirmed

**Priority:** P1
**Complexity:** M

---

## EPIC 5: Evidence Mapping (Diagnostician Agent)

### Story 5.1: View Validity/Effort Assessment (Processed First)
**As a** a psychologist reviewing evidence
**I want to** see validity and effort assessment before diagnostic evidence
**So that** I understand the quality/reliability of the evaluation data

**Acceptance Criteria:**
- Given a user transitions from Gate 1 to Evidence Mapping
- When the Diagnostician Agent processes the case
- Then the first output displayed is:
  - Validity assessment: Test validity indices, emotional underreporting, overreporting indicators
  - Effort assessment: Performance validity indicators, symptom validity test results
  - Interpretation: "Valid protocol with high effort", "May contain underreporting", etc.
  - Clinical implications: How validity issues affect interpretation of subsequent scores
- And assessment is based on configured instruments' validity indicators
- And sources are cited (which tests provided which indicators)
- And clinician can flag concerns or add notes
- And validity assessment updates diagnostic recommendations below

**Priority:** P0
**Complexity:** M

---

### Story 5.2: View Evidence Map Per Potential Diagnosis
**As a** a psychologist in Evidence Mapping
**I want to** see structured evidence supporting or refuting each potential diagnosis
**So that** I have a clear foundation for diagnostic decisions in Gate 2

**Acceptance Criteria:**
- Given a user is in Evidence Mapping stage
- When they select a diagnosis from the configured diagnosis list
- Then the Evidence Map displays:
  - Diagnosis name and DSM-5-TR criteria
  - Supporting evidence section:
    - Which test scores align with diagnostic criteria
    - Behavioral observations consistent with diagnosis
    - Medical/psychiatric history factors
    - Each piece of evidence includes source (test name, observation date, document name)
  - Contradictory evidence section:
    - Test scores or observations inconsistent with diagnosis
    - Exclusionary criteria not met
  - Unresolved gaps: What additional data would strengthen/weaken diagnosis
- And evidence is organized by DSM-5-TR criterion
- And evidence items can be clicked to view source documentation
- And clinician can add clinical notes to any evidence item
- And evidence is weighted (strong/moderate/weak) based on test quality and criteria relevance

**Priority:** P0
**Complexity:** L

---

### Story 5.3: View Differential Diagnosis Comparisons
**As a** a psychologist
**I want to** compare evidence across potential diagnoses
**So that** I can make informed decisions about which diagnoses to render or rule out

**Acceptance Criteria:**
- Given a user in Evidence Mapping stage
- When they click "Compare Diagnoses"
- Then a comparison matrix displays:
  - Column headers: DSM-5-TR criteria (across multiple diagnoses)
  - Rows: Selected diagnoses (user chooses 2-5 diagnoses to compare)
  - Cell contents: Supporting/contradictory evidence for each diagnosis-criterion pair
  - Color coding: Green (supports), Red (contradicts), Yellow (unclear/mixed)
- And clicking a cell expands to show detailed evidence for that diagnosis-criterion pair
- And user can reorder diagnoses or criteria for clearer comparison
- And comparison matrix can be exported or saved to case record
- And differential diagnosis discussion highlights most likely, least likely, and uncertain diagnoses

**Priority:** P1
**Complexity:** L

---

### Story 5.4: View Psycho-Legal Analysis (Forensic Cases)
**As a** a forensic psychologist
**I want to** see psycho-legal analysis specific to forensic standards
**So that** my diagnostic conclusions align with legal standards of care

**Acceptance Criteria:**
- Given a user with a "Forensic Criminal" or "Forensic Civil" case
- When they view Evidence Mapping
- Then a "Psycho-Legal Analysis" section displays:
  - Applicable legal standards (e.g., Durham rule, ALI test, state-specific standards)
  - Analysis of how psychological findings map to legal criteria (e.g., inability to cooperate with defense → Competency to Stand Trial)
  - Causality analysis: Does identified disorder explain the behavior/capacity in question?
  - Malingering considerations and evidence
  - Alternative explanations for findings (substance use, medical conditions, etc.)
- And analysis is generated based on case type and jurisdiction (if captured)
- And clinician can add/edit legal analysis notes
- And section highlights potential challenges to conclusions

**Priority:** P1
**Complexity:** L

---

### Story 5.5: View Functional Impairment Summary (Clinical Cases)
**As a** a clinical psychologist
**I want to** see structured functional impairment assessment
**So that** I understand how diagnosed conditions affect daily functioning

**Acceptance Criteria:**
- Given a user with a "Clinical General" case
- When they view Evidence Mapping
- Then a "Functional Impairment" section displays:
  - Domains assessed: Occupational, Academic, Social, Domestic/Self-Care, Legal, Financial, etc.
  - Evidence of impairment: How test scores and observations support functional limitations
  - Severity rating per domain (None, Mild, Moderate, Severe)
  - Chronicity: Acute vs. chronic onset and course
  - Causality: How diagnosed condition(s) explain impairment in each domain
- And impairment summary is cross-referenced to relevant diagnoses
- And clinician can add context (e.g., "Patient accommodated in workplace")
- And section notes impact on diagnostic validity and differential diagnosis

**Priority:** P1
**Complexity:** M

---

## EPIC 6: Gate 2 — Diagnostic Decision

### Story 6.1: Review Evidence Map for Each Diagnosis
**As a** a psychologist making diagnostic decisions
**I want to** thoroughly review evidence for each potential diagnosis
**So that** my decisions are well-informed and defensible

**Acceptance Criteria:**
- Given a user enters Gate 2 - Diagnostic Decision
- When they select a diagnosis to decide upon
- Then the evidence map for that diagnosis is displayed with:
  - All supporting and contradictory evidence (from Epic 5)
  - Clinician's previous notes from Evidence Mapping stage
  - DSM-5-TR criteria checklist with evidence mapped to each criterion
  - Visual summary (e.g., "6/9 criteria met")
  - Related differential diagnoses and how this diagnosis compares
- And user can expand any evidence item to view source documentation
- And user can add/edit clinical notes specific to this diagnosis decision
- And evidence review is required before proceeding to decision buttons (not just a checkbox)

**Priority:** P0
**Complexity:** M

---

### Story 6.2: Select Diagnosis Decision (Render / Rule Out / Defer)
**As a** a psychologist
**I want to** make a clear decision for each potential diagnosis
**So that** the report reflects my clinical judgment

**Acceptance Criteria:**
- Given a user reviewing evidence for a specific diagnosis in Gate 2
- When they have reviewed sufficient evidence
- Then they can select ONE of three decision buttons:
  - "Render Diagnosis": Clinician believes criteria are met and will include in report
  - "Rule Out": Clinician believes criteria are not met and diagnosis is excluded
  - "Defer": Clinician believes insufficient evidence to decide (will not appear in report)
- And the decision button is prominently located and color-coded
- And clicking a button opens a decision confirmation modal showing:
  - Selected decision
  - Summary of key evidence
  - Prompt for optional clinical notes justifying decision
- And user can type optional justification notes (1-500 characters)
- And decision is recorded with timestamp and any notes
- And user can return to this diagnosis to review/change decision until Gate 2 is finalized

**Priority:** P0
**Complexity:** S

---

### Story 6.3: NO "Accept All" — Individual Diagnosis Decisions Required
**As a** a psychologist ensuring clinical accountability
**I want to** make deliberate individual decisions about each diagnosis
**So that** I maintain clinical responsibility and cannot skip decisions

**Acceptance Criteria:**
- Given a user in Gate 2 - Diagnostic Decision
- When they view the diagnosis list
- Then:
  - NO "Accept All", "Apply Default", or bulk-decision buttons exist
  - Each diagnosis requires an explicit individual decision (Render/Rule Out/Defer)
  - Gate 2 cannot be completed until all enabled diagnoses have a decision
  - A checklist clearly shows: ☐ Diagnosis A [Pending], ☐ Diagnosis B [Decided], etc.
  - Disabled diagnoses (from configuration) do not require decisions
- And "Complete Gate 2" button is disabled until all decisions are made
- And confirmation modal shows decision summary before allowing progression

**Priority:** P0
**Complexity:** S

---

### Story 6.4: Add Clinical Notes Per Decision
**As a** a psychologist
**I want to** record clinical reasoning for each diagnostic decision
**So that** my attestation and legal defensibility are strengthened

**Acceptance Criteria:**
- Given a user making a diagnostic decision in Gate 2
- When they select Render/Rule Out/Defer
- Then a modal appears with:
  - Decision summary (diagnosis name + chosen decision)
  - Text field for clinical notes (supports 0-2000 characters)
  - Guidance text showing what notes are helpful (e.g., "For Rule Out: Why doesn't this diagnosis fit?" vs "For Render: Which criteria are most compelling?")
  - Optional checkbox: "Flag for additional review" (marks for legal reviewer)
- And notes are optional but encouraged
- And decision cannot proceed without explicitly confirming (clicking "Confirm Decision" button)
- And notes are stored and appear in final report supporting sections
- And notes are included in audit trail

**Priority:** P0
**Complexity:** S

---

### Story 6.5: Revisit and Modify Decisions (Non-Linear Workflow)
**As a** a psychologist during diagnostic decision-making
**I want to** revisit earlier decisions as I move through diagnoses
**So that** I can adjust decisions based on comparative diagnostic thinking

**Acceptance Criteria:**
- Given a user in Gate 2 - Diagnostic Decision
- When they click on a previously-decided diagnosis
- Then they can:
  - View the prior decision and justification notes
  - Click "Modify Decision" to change the decision (Render ↔ Rule Out ↔ Defer)
  - Edit the clinical notes
  - Confirm the updated decision
  - See timestamp of original and modified decisions in audit trail
- And user can navigate to any diagnosis in any order (no forced linear sequence)
- And completed decisions do not lock automatically (can always be revisited)
- And "Complete Gate 2" confirmation shows current state of all decisions
- And modifications are tracked in audit trail with before/after values

**Priority:** P1
**Complexity:** M

---

## EPIC 7: Report Generation (Writer Agent)

### Story 7.1: Generate Report Sections (Streaming with Progress)
**As a** a psychologist generating a report
**I want to** see real-time progress as the Writer Agent generates report sections
**So that** I understand what's being written and can intervene if needed

**Acceptance Criteria:**
- Given a user in Report Generation stage after Gate 2 completion
- When they click "Generate Report"
- Then:
  - Generation begins immediately
  - A progress indicator shows sections being generated in real-time
  - Each section appears in the document as it's completed (streaming)
  - Section generation order matches template order
  - User can see estimated time remaining
  - A log shows which sections are complete, in progress, or queued
- And user can pause generation (with ability to resume)
- And user can cancel generation (with confirmation and option to keep generated sections)
- And generation errors are displayed with context (e.g., "Unable to generate Personality Assessment—insufficient personality test data")
- And upon completion, user is notified and document is ready for editing

**Priority:** P0
**Complexity:** M

---

### Story 7.2: Voice-Matched Prose Using Style Rules
**As a** a psychologist
**I want to** report sections written in my voice/style
**So that** AI-generated sections seamlessly integrate with my clinical writing

**Acceptance Criteria:**
- Given a user has uploaded writing samples in onboarding (Story 1.2)
- When the Writer Agent generates report sections
- Then each section is written using:
  - Extracted tone patterns (clinical, accessible, formal, etc.)
  - Vocabulary preferences (technical jargon level, terminology choices)
  - Sentence structure patterns (simple vs. complex, active vs. passive voice preference)
  - Organizational style (narrative vs. bulleted, how evidence is integrated)
- And style rules are applied consistently across all generated sections
- And clinician can review and override style rules in Settings
- And comparison view shows original style vs. AI-generated style (optional)
- And style matching improves with more writing samples (if 5+ samples provided)

**Priority:** P1
**Complexity:** L

---

### Story 7.3: Content Type Indicators (Fully Generated vs. Draft Requiring Revision)
**As a** a psychologist reviewing generated report
**I want to** see which sections are fully generated vs. which need clinician revision
**So that** I can prioritize editing and understand AI limitations

**Acceptance Criteria:**
- Given a user views the generated report in editing stage
- When report sections are displayed
- Then each section or paragraph includes a content type indicator:
  - "Fully Generated": Section drafted by Writer Agent and ready for clinician review
  - "Draft - Review Required": Section generated but flagged by Writer as needing clinician enhancement
  - "Placeholder": Section requires clinician input (Writer Agent cannot generate due to missing data)
  - "Clinician-Written": Section written directly by clinician (in OnlyOffice)
- And indicators appear as subtle badges (not distracting)
- And clicking an indicator shows explanation (e.g., why revision is needed)
- And indicators are removed after clinician edits (becomes "Clinician-Modified")
- And final report shows only "Finalized" status (indicators removed)

**Priority:** P1
**Complexity:** M

---

### Story 7.4: Behavioral Observations from Transcripts Marked for Revision
**As a** a psychologist reviewing report sections with behavioral observations
**I want to** see which observations came from audio transcript vs. clinical notes
**So that** I can verify accuracy and add clinical context

**Acceptance Criteria:**
- Given a report is generated with behavioral observations from audio transcript
- When the clinician reviews the Behavioral Observations section
- Then observations sourced from transcript are marked:
  - Inline color-coding or badges (e.g., "From transcript: [timestamp]")
  - Linked to source audio timestamp for easy verification
  - Flagged with "Review for Accuracy" badge
- And each transcript-sourced observation includes optional revision field
- And clinician can edit observations or add clinical context without losing source attribution
- And clinician notes (from Gate 1) are clearly distinguished from transcript excerpts
- And all behavioral observations are editable and citable

**Priority:** P1
**Complexity:** M

---

### Story 7.5: Diagnostic Section Writes ONLY Clinician's Gate 2 Selections
**As a** a psychologist
**I want to** ensure the Diagnostic/Impressions section reflects only my decided diagnoses
**So that** the report doesn't include ruled-out diagnoses or incomplete thinking

**Acceptance Criteria:**
- Given a report is generated after Gate 2 completion
- When the Diagnostic/Impressions section is written
- Then the Writer Agent:
  - Includes ONLY diagnoses where clinician selected "Render Diagnosis" in Gate 2
  - Writes clinical summary for each rendered diagnosis (criteria met, severity, onset, course)
  - Excludes any diagnoses marked "Rule Out" or "Defer"
  - Includes clinician notes from Gate 2 decisions as supporting text
  - Does NOT speculate about ruled-out or deferred diagnoses
- And section follows template structure (numbered diagnoses, supporting evidence summary, etc.)
- And section is editable to allow clinician refinement
- And final report accurately reflects clinical judgment from Gate 2

**Priority:** P0
**Complexity:** M

---

## EPIC 8: Report Editing (OnlyOffice)

### Story 8.1: Edit Report in Full Word-Compatible Editor
**As a** a psychologist finalizing a report
**I want to** edit the entire report in a Word-compatible interface
**So that** I can refine wording, add sections, and prepare for submission

**Acceptance Criteria:**
- Given a report is generated and ready for editing
- When the user clicks "Edit in OnlyOffice"
- Then:
  - OnlyOffice Document Editor opens embedded in Psygil interface
  - Report is displayed in full Word format (.docx)
  - All formatting, styles, and structure are preserved
  - Full editing toolbar is available: font styles, lists, tables, images, etc.
  - All standard Word editing features work (find/replace, undo/redo, zoom, etc.)
  - Report is editable with full cursor control
  - OnlyOffice interface takes up 70-80% of screen with Psygil sidebar (15-20%) showing case info and document structure
- And document can be edited freely without restrictions
- And editing is responsive and performs smoothly
- And document auto-saves every 30 seconds (with visible indicator)

**Priority:** P0
**Complexity:** L

---

### Story 8.2: Track Changes Showing AI vs. Clinician Edits
**As a** a psychologist and potential legal reviewer
**I want to** see which edits were made by AI vs. clinician
**So that** change attribution is clear for audit trail and testimony

**Acceptance Criteria:**
- Given a user is editing a report in OnlyOffice
- When they edit AI-generated content
- Then:
  - "Track Changes" mode can be enabled (toggle in toolbar)
  - AI-generated sections have distinct formatting/background color (light blue)
  - Clinician edits to AI-generated sections are tracked with:
    - Change highlighting (red underline for additions, strikethrough for deletions)
    - Author attribution ("Clinician" or specific clinician name)
    - Timestamp of each change
  - Clinician-written sections (e.g., added paragraphs) are marked as "Clinician-Authored"
  - Additions to clinician sections are tracked separately
- And Track Changes mode can be toggled on/off
- And change tracking is preserved throughout editing
- And final report can display changes or show "clean" final version

**Priority:** P1
**Complexity:** M

---

### Story 8.3: Editor/Legal Reviewer Flags as Word Comments
**As a** a legal reviewer or Editor Agent
**I want to** flag concerns about report content as Word comments
**So that** clinician can address specific issues before finalization

**Acceptance Criteria:**
- Given a report is generated and assigned to Editor/Legal Reviewer (if multi-user)
- When the Editor/Legal Reviewer reviews sections
- Then they can:
  - Select text in the document
  - Add a comment (inline Word comment feature)
  - Flag type: "Legal Concern", "Clinical Concern", "Missing Evidence", "Clarity Issue", "Potential Challenge", etc.
  - Severity: "Critical", "High", "Medium", "Low"
  - Comment text describing the issue
- And comments are visible as Word comment bubbles (standard Office interface)
- And clinician can respond to comments with "Addressed" status
- And comments are preserved through editing
- And comment resolution status is tracked (unresolved, addressed, dismissed)

**Priority:** P1
**Complexity:** M

---

### Story 8.4: Manual Edits Preserved Across Agent Re-runs
**As a** a psychologist re-generating sections
**I want to** update generated sections while keeping my manual edits
**So that** I don't have to re-do customizations

**Acceptance Criteria:**
- Given a clinician has manually edited generated sections
- When they click "Regenerate Section" or re-run Writer Agent
- Then:
  - System identifies clinician edits vs. original AI generation
  - Regeneration updates baseline AI content
  - Clinician edits are preserved and re-integrated
  - If regenerated content conflicts with edits, user is alerted to review differences
  - Merged result prioritizes clinician edits (clinician content takes precedence)
- And clinician can review side-by-side comparison of old vs. new generation
- And clinician can accept new generation fully, keep old, or manually merge
- And Track Changes shows conflict resolution process

**Priority:** P1
**Complexity:** L

---

### Story 8.5: Auto-Save Every 30 Seconds
**As a** a psychologist editing a report
**I want to** know my edits are automatically saved
**So that** I don't lose work due to unexpected interruptions

**Acceptance Criteria:**
- Given a user is editing a report in OnlyOffice
- When they make edits to the document
- Then:
  - Auto-save occurs every 30 seconds automatically
  - A subtle save indicator appears briefly (e.g., "Saving..." → "Saved at 2:45 PM")
  - User is notified if save fails (e.g., "Unable to save—connection lost")
  - Unsaved changes are never lost (browser close triggers final save attempt)
  - Last saved timestamp is visible in document status bar
  - Version history is maintained (user can revert to earlier saves if needed)
- And auto-save is transparent and non-disruptive (does not interrupt editing)

**Priority:** P0
**Complexity:** S

---

## EPIC 9: Gate 3 — Final Attestation

### Story 9.1: Review All Editor/Legal Reviewer Flags
**As a** a psychologist finalizing a report
**I want to** see all flags from legal review and address each one
**So that** the report is legally sound before attestation

**Acceptance Criteria:**
- Given a user is ready to enter Gate 3 - Final Attestation
- When they click "View Legal Flags" or access Gate 3
- Then a sidebar or panel displays:
  - All Editor/Legal Reviewer flags (from Story 8.3)
  - Flag severity: Critical (red), High (orange), Medium (yellow), Low (blue)
  - Flag type: Legal Concern, Clinical Concern, etc.
  - Original text excerpt where flag was placed
  - Reviewer comments
  - Clinician response field (if addressed)
- And flags are grouped by severity and type
- And user can filter/sort by severity or type
- And clicking a flag highlights the corresponding location in the document
- And unaddressed critical flags block progression to attestation (with override option)

**Priority:** P0
**Complexity:** M

---

### Story 9.2: Accept/Dismiss/Modify Each Flag
**As a** a clinician responding to legal review flags
**I want to** evaluate each flag and take action
**So that** concerns are either addressed or justified

**Acceptance Criteria:**
- Given a clinician reviewing a flag in Gate 3
- When they view the flag details
- Then they can select ONE action per flag:
  - "Accepted - Modified": Clinician modified the report to address the concern (shows what was changed)
  - "Accepted - Will Monitor": Clinician acknowledges concern but believes current text is appropriate (e.g., clinical judgment override)
  - "Dismissed - Not Applicable": Clinician disagrees that the concern is valid (must explain why)
  - "Requires Discussion": Flag requires conversation with reviewer (marks for follow-up)
- And action selection opens a response field (100-500 characters)
- And clinician's response is recorded with timestamp
- And reviewer can see clinician's response and agreement status
- And all flags must receive a response before Gate 3 completion

**Priority:** P0
**Complexity:** M

---

### Story 9.3: Sign Attestation
**As a** a psychologist
**I want to** sign a digital attestation affirming the report
**So that** the report becomes legally binding and sealed

**Acceptance Criteria:**
- Given all flags are addressed (or dismissed with justification)
- When clinician is ready to finalize
- Then they click "Sign Attestation"
- And an attestation dialog appears showing:
  - Full attestation text: "I affirm that this evaluation was conducted according to professional standards, and my opinions in this report are based on the evaluation findings and professional analysis. I take responsibility for the content and conclusions herein."
  - Evaluee name and case ID for confirmation
  - Evaluator name and credentials (read-only, based on user profile)
  - Digital signature field (Psygil generates cryptographically signed timestamp)
  - Checkbox: "I confirm I have reviewed all sections and legal flags"
- And signing requires explicit confirmation (not auto-sign)
- And signature creates a digital timestamp and signature block
- And attestation is recorded in audit trail

**Priority:** P0
**Complexity:** M

---

### Story 9.4: Finalize Report (Lock, Hash, Sealed PDF)
**As a** a psychologist protecting the integrity of a finalized report
**I want to** lock the report and create a sealed, unmodifiable version
**So that** the report cannot be altered after submission

**Acceptance Criteria:**
- Given a clinician has signed the attestation
- When they click "Finalize Report"
- Then the system:
  - Generates a cryptographic hash of the final document
  - Creates a sealed PDF version (locked for editing, signed with Psygil certificate)
  - Locks the .docx in Psygil (no further editing allowed)
  - Records finalization timestamp and clinician signature
  - Assigns a unique Report ID and seal number
  - Stores sealed PDF and hash in encrypted storage
- And finalized report cannot be edited (even by clinician)
- And attempting to edit shows: "Report is finalized and locked for legal integrity"
- And seal information is displayed: "Report Sealed: [Date] [Hash] [Seal #]"
- And seal can be verified by viewing seal information (hash provided for independent verification)

**Priority:** P0
**Complexity:** L

---

### Story 9.5: Export .docx and PDF
**As a** a psychologist submitting a report
**I want to** export the finalized report in .docx and PDF formats
**So that** I can submit to court, referral source, or client

**Acceptance Criteria:**
- Given a report is finalized
- When clinician clicks "Export Report"
- Then they can select export format:
  - Export as .docx (Word document, editable in Word but sealed integrity warning on open)
  - Export as PDF (read-only, includes digital signature and seal information)
  - Export both (creates both files as zip archive)
- And exported files include:
  - Attestation signature block and date
  - Digital seal information (for verification)
  - Hash value (for integrity verification)
  - Psygil branding/footer noting "Generated with Psygil"
- And files are downloaded to user's computer
- And export is logged in audit trail (what was exported, when, by whom)
- And exported files can be opened and printed normally
- And PDF version is ideal for court submission (non-editable, sealed appearance)

**Priority:** P0
**Complexity:** M

---

## EPIC 10: Audit Trail

### Story 10.1: Configurable Granularity (Decision Record Only vs. Full Detail)
**As a** a psychologist managing audit trail sensitivity
**I want to** configure how much detail is logged about my work
**So that** the audit trail is appropriate for my practice and legal requirements

**Acceptance Criteria:**
- Given a user in Settings > Audit Trail Configuration
- When they view audit trail settings
- Then they can select audit granularity level:
  - Level 1 - "Decision Record Only": Logs only major decisions (Gate 1 completion, Gate 2 decisions, Gate 3 finalization). No intermediate edits or deliberation steps logged. Minimal file size.
  - Level 2 - "Standard Detail": Logs major decisions + section generation/regeneration + document uploads. Moderate file size.
  - Level 3 - "Full Detail": Logs every action including individual field confirmations, edits, cursor movements. Large file size. Not recommended for large practices.
- And selected granularity applies to future cases (existing cases retain their granularity)
- And default is Level 1
- And granularity choice is displayed on each case for reference
- And audit trail export respects granularity setting

**Priority:** P1
**Complexity:** S

---

### Story 10.2: View Audit Log for a Case
**As a** a clinician or legal professional reviewing a case
**I want to** view a complete audit log of all actions on the case
**So that** I can understand the evaluation process and timeline

**Acceptance Criteria:**
- Given a user views a finalized case
- When they click "View Audit Log" (in case menu)
- Then an audit log interface displays:
  - Chronological list of actions (oldest first or newest first, user selectable)
  - Each entry shows: Timestamp, User/Role, Action Type, Details, Status
  - Action types logged:
    - Document uploaded: [filename, type, size]
    - Data confirmed: [category, items confirmed count]
    - Gate completed: [gate name, completion timestamp]
    - Diagnosis decision: [diagnosis name, decision, notes summary]
    - Report section generated: [section name, length, generation time]
    - Report edited: [section, edit summary]
    - Flag addressed: [flag type, clinician response]
    - Report finalized: [seal info, hash]
  - Expandable entries showing full details
  - Filter by action type, date range, or user
  - Export as CSV or PDF
- And log is read-only (no modifications possible)
- And log respects configured granularity (Story 10.1)

**Priority:** P0
**Complexity:** M

---

### Story 10.3: Testimony Preparation Export
**As a** a psychologist preparing for deposition or court testimony
**I want to** export structured case audit trail and timeline
**So that** I can reference my evaluation process under oath

**Acceptance Criteria:**
- Given a user has a finalized case
- When they click "Prepare for Testimony" or "Export for Legal Defense"
- Then a document is generated showing:
  - Executive summary: Case overview, evaluation timeline, final diagnoses
  - Detailed timeline: Chronological log of all major decisions and actions
  - Gate decision log: What was decided at each gate, dates, user signatures
  - Document ingestion log: What documents were uploaded, when, from what source
  - Evidence summary: How evidence was compiled and considered per diagnosis
  - Challenge log: Any "flags" or concerns raised and how they were addressed
  - Professional standards notation: Representation that evaluation followed professional standards
  - Supplementary materials checklist: What can be provided if requested
- And export format is professional legal document (well-formatted .docx or PDF)
- And export is read-only
- And export includes relevant excerpts from full audit trail but filters sensitive/irrelevant details
- And export is protected and not stored in cloud (local only)

**Priority:** P1
**Complexity:** L

---

### Story 10.4: Date-Based Timestamps (Not Minute-Level by Default)
**As a** a psychologist concerned about excessive timestamp granularity
**I want to** have timestamps recorded at day or hour level by default
**So that** audit trail shows general timeline without excessive temporal precision

**Acceptance Criteria:**
- Given audit trail is configured (Story 10.1)
- When actions are logged
- Then timestamps are recorded at:
  - Level 1 (Decision Record Only): Date only (e.g., "March 19, 2026") or half-day (AM/PM)
  - Level 2 (Standard Detail): Hour level (e.g., "March 19, 2026, 2 PM") with 30-min granularity
  - Level 3 (Full Detail): Minute level (e.g., "March 19, 2026, 2:35 PM")
- And user can view more precise timestamps if needed (click to expand)
- And exported audit trail uses configured granularity
- And default granularity is professional-appropriate (not excessive precision)

**Priority:** P2
**Complexity:** S

---

### Story 10.5: Never Logs Rejected Diagnostic Options
**As a** a psychologist
**I want to** ensure ruled-out or deferred diagnoses are not logged in audit trail
**So that** no record exists of diagnostic options I explicitly rejected

**Acceptance Criteria:**
- Given a clinician is making diagnostic decisions in Gate 2
- When they select "Rule Out" or "Defer" for a diagnosis
- Then:
  - Decision is recorded (diagnosis name, decision type, justification notes, timestamp)
  - BUT the audit trail entry for "Rule Out" / "Defer" shows only:
    - "Diagnosis decision recorded [date]"
    - NOT which diagnosis was ruled out or deferred
    - NOT any clinical justification for ruling out (to prevent adverse inference in legal proceedings)
- And "Render Diagnosis" decisions ARE fully logged with supporting evidence
- And full decision information (including ruled-out diagnoses) is stored but NOT visible in audit trail
- And audit trail export excludes ruled-out diagnoses
- And only clinician (not legal reviewer) can access full decision record if needed for their own records

**Priority:** P1
**Complexity:** M

---

## EPIC 11: Settings & Configuration

### Story 11.1: Profile Settings
**As a** a user
**I want to** manage my clinician profile information
**So that** my name, credentials, and contact information are correct in reports

**Acceptance Criteria:**
- Given a user accesses Settings > Profile
- When they view profile settings
- Then the following editable fields are available:
  - Full name (required)
  - Professional credentials (PhD, PsyD, MD, etc.)
  - Licensure state(s) and license numbers
  - Specializations/areas of expertise (multi-select)
  - Email address
  - Contact phone (optional)
  - Mailing address (for report letterhead)
  - Preferred practice profile (Forensic Criminal, Forensic Civil, Clinical General)
- And all fields are validated for format/completeness
- And changes are saved to user profile and applied to future reports
- And clinician information is included in report letterhead and signature block

**Priority:** P0
**Complexity:** S

---

### Story 11.2: Diagnosis Catalog Settings
**As a** a user in Settings
**I want to** manage my diagnosis configuration
**So that** my preferred diagnoses are available for cases

**Acceptance Criteria:**
- Given a user accesses Settings > Diagnosis Catalog
- When they view the diagnosis configuration interface
- Then they can:
  - View all available DSM-5-TR diagnoses in a searchable list
  - Toggle enable/disable for each diagnosis
  - Add custom diagnosis with: name, criteria summary, associated instruments, notes
  - Edit existing custom diagnoses
  - Delete custom diagnoses (with confirmation)
  - Search diagnoses by code, name, or keyword
  - Filter by category (Neurocognitive, Personality, Mood, Psychotic, Substance-Related, etc.)
- And enabled/disabled status is applied to new cases immediately
- And changes don't affect existing cases
- And custom diagnoses are stored per-user (not shared with other clinicians)

**Priority:** P0
**Complexity:** M

---

### Story 11.3: Instrument Library Settings
**As a** a user in Settings
**I want to** manage my psychological instrument configuration
**So that** I can control which instruments appear in test score entry

**Acceptance Criteria:**
- Given a user accesses Settings > Instrument Library
- When they view the instrument configuration interface
- Then they can:
  - View pre-configured standard instruments (WAIS-IV, MMPI-2-RF, PAI, etc.)
  - Toggle enable/disable for each standard instrument
  - Add custom instruments with: name, abbreviation, subtest names, score types, validity indicators (if applicable)
  - Edit existing custom instruments
  - Delete custom instruments (with confirmation)
  - View instrument metadata (publication year, latest edition, key validity indicators)
  - Search instruments by name or abbreviation
- And enabled instruments appear in test score entry workflows
- And disabled instruments can still be viewed in completed cases (historical data preserved)
- And instrument changes apply to new cases immediately

**Priority:** P0
**Complexity:** M

---

### Story 11.4: Report Template Settings
**As a** a user in Settings
**I want to** manage and customize report templates
**So that** generated reports follow my preferred structure

**Acceptance Criteria:**
- Given a user accesses Settings > Report Templates
- When they view template management interface
- Then they can:
  - View available default templates (Forensic Criminal, Forensic Civil, Clinical General)
  - Select a base template
  - Drag-and-drop reorder sections
  - Enable/disable optional sections (Cultural Context, Limitations, Recommendations, etc.)
  - Add custom sections with templates (header, footer, placeholder text)
  - Edit section titles and introductory text
  - Create multiple custom templates (e.g., "Custody Detailed", "Competency Brief")
  - Set one template as default for new cases
  - Preview full template structure
  - Delete custom templates (cannot delete defaults)
- And template changes apply to new cases immediately
- And existing cases retain their original template
- And custom templates are stored per-user

**Priority:** P1
**Complexity:** M

---

### Story 11.5: Writing Style Configuration
**As a** a user in Settings
**I want to** manage the writing style applied to AI-generated sections
**So that** generated text matches my clinical voice

**Acceptance Criteria:**
- Given a user accesses Settings > Writing Style
- When they view style configuration interface
- Then they can:
  - Upload additional writing samples (story 1.2 interface, but from settings)
  - View extracted style attributes: Tone, Vocabulary Level, Sentence Complexity, Organizational Pattern, Key Terminology
  - Manually override style rules:
    - Tone selector: Clinical/Formal, Clinical/Accessible, Academic, Conversational, etc.
    - Vocabulary level: Technical, Standard, Accessible, Mixed
    - Sentence complexity: Simple (8-15 words avg), Moderate (15-25 words avg), Complex (25+ words avg)
    - Organizational pattern: Narrative, Bulleted, Mixed
  - Save custom style profile
  - Reset to defaults
  - Compare current style with a previous version
- And style rules are applied to all Writer Agent output
- And style can be updated anytime (applies to future generations)
- And previous style rules are archived (for audit trail reference)

**Priority:** P1
**Complexity:** M

---

### Story 11.6: Audit Trail Granularity Settings
**As a** a user
**I want to** configure how detailed my audit logs are
**So that** the audit trail is appropriate for my practice

**Acceptance Criteria:**
- Given a user accesses Settings > Audit Trail
- When they view audit trail configuration
- Then they can:
  - Select audit granularity level (Story 10.1): Decision Record Only, Standard Detail, Full Detail
  - View description of each level and implications (file size, what's logged)
  - Select timestamp granularity: Date-only, Date + Hour, Date + Minute
  - Toggle whether "rejected diagnoses" are logged (normally disabled per Story 10.5)
  - View current storage usage (audit log size on disk)
  - Export historical audit logs (for archive/backup)
- And configuration applies to future cases
- And existing cases retain their original granularity
- And default is "Decision Record Only" with "Date-only" timestamps

**Priority:** P1
**Complexity:** M

---

### Story 11.7: Security & Privacy Settings
**As a** a user concerned about data protection
**I want to** configure security and privacy options
**So that** my PHI is protected according to my preferences

**Acceptance Criteria:**
- Given a user accesses Settings > Security & Privacy
- When they view security configuration
- Then they can:
  - Enable/disable PII/PHI detection (Story 12.1)
  - Configure PHI Review Queue granularity: Off, Flagged-Only, Mandatory-Review (Story 12.2)
  - View encryption status: "Local storage encrypted with SQLCipher ✓"
  - Configure auto-lock timeout: 5 min, 15 min, 30 min, 1 hour, Never
  - Toggle offline mode: Enabled/Disabled
  - View offline grace period: 7 days before server sync required
  - Configure allowed data export formats (none, PDF only, PDF+DOCX)
  - Enable/disable cloud backup (if feature added)
  - View security audit log (encryption key rotations, access attempts, etc.)
- And all settings are honored immediately upon change

**Priority:** P1
**Complexity:** M

---

## EPIC 12: Security & Privacy

### Story 12.1: PII Detection Before LLM Transmission
**As a** a system protecting patient privacy
**I want to** detect and flag PII before sending any content to the AI
**So that** sensitive patient data is not transmitted to external LLM services

**Acceptance Criteria:**
- Given the system is processing documents or generating report sections
- When content is about to be sent to an external LLM (Writer Agent, Diagnostician Agent)
- Then:
  - A PII detection scan runs on all content
  - Detects: SSN, insurance numbers, medical record numbers, account numbers, phone numbers (full), addresses, additional identifying details
  - Flags detected PII elements (highlighted, listed)
  - Prevents transmission until PII is redacted or explicitly overridden by clinician
  - Shows user what will be redacted before proceeding
  - Replaces PII with placeholders (e.g., "[DOB]", "[Address]") that are re-inserted in final report
- And PII detection is configurable (Story 12.2 PHI Review Queue)
- And detection errors are reported to user (false positives/negatives)
- And detection is logged in audit trail

**Priority:** P0
**Complexity:** M

---

### Story 12.2: PHI Review Queue (Configurable)
**As a** a clinician managing LLM data exposure
**I want to** control whether and how PHI is reviewed before LLM transmission
**So that** I maintain oversight of what's sent to external services

**Acceptance Criteria:**
- Given a user has configured PHI Review in Settings > Security
- When content is about to be sent to external LLM
- Then based on configuration:
  - Mode 1 (Off): No review; PII is redacted automatically, content sent as-is
  - Mode 2 (Flagged-Only): System auto-redacts obvious PII; content is sent
  - Mode 3 (Mandatory-Review): All content flagged before transmission; clinician must review and approve
- And in Mandatory-Review mode:
  - A review interface shows: Original content, detected PII, proposed redactions, AI operation being performed
  - Clinician can: Accept redactions, manually edit redactions, reject transmission
  - Review is logged in audit trail
  - Content is not transmitted until approved
- And configuration is applied to all external LLM calls (Report generation, Evidence Mapping, etc.)
- And user can change mode at any time

**Priority:** P0
**Complexity:** M

---

### Story 12.3: Encrypted Local Storage (SQLCipher)
**As a** a user concerned about local data security
**I want to** know all case data is encrypted at rest
**So that** unauthorized access to my computer doesn't expose patient information

**Acceptance Criteria:**
- Given Psygil is installed
- When case data is stored locally
- Then:
  - All local database (SQLite) is encrypted using SQLCipher with AES-256
  - Encryption key is derived from user login credentials (not stored in plain text)
  - All files at rest are encrypted (cases, documents, audit logs)
  - Encryption is transparent to user (happens automatically)
  - User cannot disable encryption
  - Encryption status is verified on startup (shown in Security settings)
  - If encryption fails, user is alerted and case data is protected (not accessible)
- And encryption is FIPS-compliant if needed for regulated environments
- And encryption key rotation is supported (from Settings)

**Priority:** P0
**Complexity:** M

---

### Story 12.4: Auto-Lock After Inactivity
**As a** a clinician concerned about unattended access
**I want to** have the application auto-lock after inactivity
**So that** if I leave my computer unattended, cases aren't exposed

**Acceptance Criteria:**
- Given a user is logged into Psygil
- When they configure auto-lock timeout (Settings > Security)
- Then after that period of inactivity (no keyboard/mouse activity):
  - Application locks and returns to login screen
  - All case data is cleared from memory
  - User must enter password to unlock
  - Unlocking is fast (resume session within 10 seconds)
  - Auto-lock can be disabled (not recommended for security-sensitive practices)
  - Default timeout: 30 minutes
- And auto-lock is logged in audit trail (time locked, user who locked it)
- And timer resets with any user activity

**Priority:** P1
**Complexity:** M

---

### Story 12.5: Offline Mode (7-Day Grace Period)
**As a** a clinician in areas with unreliable internet
**I want to** work offline and sync later
**So that** I'm not blocked by internet outages

**Acceptance Criteria:**
- Given a user has enabled Offline Mode (Settings > Security)
- When internet connection is lost
- Then:
  - Psygil detects offline status and continues to function
  - All case work (Gates 1-3) operates locally
  - Documents are stored locally (encrypted)
  - Audit trail is recorded locally
  - User is notified: "Working Offline - Last Sync: [date]"
  - 7-day grace period countdown is visible
- And upon reconnection:
  - Sync is initiated automatically
  - All offline work is uploaded to secure server
  - Conflicts are flagged (if case was modified elsewhere) with manual merge required
  - Sync is logged in audit trail
- And if offline for >7 days:
  - User is warned: "Offline for 7+ days—sync required to continue"
  - Work is protected (not lost) but sync must occur within 14 days
- And offline mode can be disabled from Settings

**Priority:** P2
**Complexity:** L

---

## EPIC 13: Cultural Context & Informed Consent

### Story 13.1: Cultural/Linguistic Context Fields on Cases
**As a** a culturally-aware clinician
**I want to** record cultural and linguistic context for each evaluation
**So that** diagnostic decisions account for cultural factors

**Acceptance Criteria:**
- Given a user is creating a new case (Story 2.1)
- When they complete case setup
- Then they can optionally enter:
  - Evaluee's primary language(s)
  - Language proficiency (evaluee and interpreter, if applicable)
  - Cultural background/ethnicity (open-text, not required)
  - Immigration/acculturation status (if relevant)
  - Religious/spiritual context (if clinically relevant)
  - Socioeconomic/educational background
  - Relevant cultural considerations (e.g., "Victim of human trafficking", "Refugee")
- And these fields are also editable in case dashboard
- And Diagnostician Agent considers cultural context when interpreting test scores and behaviors
- And cultural considerations are documented in final report (optional section in template)
- And cultural context is never auto-populated (must be clinician-entered)

**Priority:** P1
**Complexity:** M

---

### Story 13.2: Informed Consent Template Insertion
**As a** a clinician ensuring informed consent
**I want to** insert a standardized informed consent statement in my report
**So that** the evaluation process and client rights are documented

**Acceptance Criteria:**
- Given a user is generating or editing a report
- When they access the report template or click "Insert Informed Consent"
- Then:
  - A template library of informed consent statements is available
  - Default templates include: Clinical Evaluation IC, Forensic Criminal IC, Forensic Civil IC, etc.
  - Each template includes sections: Purpose of evaluation, procedures, risks/benefits, confidentiality limits, fees, rights to refuse, etc.
  - User can select a template and customize:
    - Insert evaluee name, evaluator name, date
    - Edit specific paragraphs
    - Add practice-specific language
  - Customized IC is inserted into report (typically at beginning or appendix)
  - User can review before finalizing report
  - IC is included in final sealed report

**Priority:** P1
**Complexity:** M

---

### Story 13.3: Peer Consultation Documentation
**As a** a clinician valuing peer consultation
**I want to** document peer consultation that occurred during the evaluation
**So that** the process is transparent and collegial input is recorded

**Acceptance Criteria:**
- Given a user is working on a case
- When they access case dashboard or settings
- Then they can click "Document Peer Consultation"
- And a form appears requesting:
  - Consultant name and credentials (required)
  - Consultation date/time
  - Topic(s) discussed (free text or categories: Diagnostic question, Test interpretation, Cultural context, Legal standards, Ethical concern, etc.)
  - Key points from consultation (text field)
  - Recommendations made by consultant (text field)
  - Clinician's response/integration of consultation (text field)
  - Optional checkbox: "Include in report" (allows transparency about consultation process)
- And consultation record is stored in case audit trail
- And multiple consultations can be documented
- And selected consultations appear in final report (e.g., "This evaluation benefited from peer consultation with [consultant] regarding [topic]")

**Priority:** P2
**Complexity:** M

---

## Summary Tables

### User Stories by Epic

| Epic | Title | Story Count | Priority Distribution | Complexity Distribution |
|------|-------|------|--|--|
| 1 | Onboarding & Setup | 6 | P0: 4, P1: 1, P2: 0 | S: 1, M: 5, L: 0 |
| 2 | Case Management | 5 | P0: 3, P1: 2, P2: 1 | S: 2, M: 3, L: 0 |
| 3 | Document Ingestion (Ingestor Agent) | 7 | P0: 5, P1: 2, P2: 0 | S: 1, M: 6, L: 0 |
| 4 | Gate 1 — Data Confirmation | 5 | P0: 2, P1: 3, P2: 0 | S: 1, M: 4, L: 0 |
| 5 | Evidence Mapping (Diagnostician Agent) | 5 | P0: 1, P1: 4, P2: 0 | S: 0, M: 2, L: 3 |
| 6 | Gate 2 — Diagnostic Decision | 5 | P0: 3, P1: 2, P2: 0 | S: 2, M: 3, L: 0 |
| 7 | Report Generation (Writer Agent) | 5 | P0: 2, P1: 3, P2: 0 | S: 0, M: 3, L: 2 |
| 8 | Report Editing (OnlyOffice) | 5 | P0: 1, P1: 4, P2: 0 | S: 1, M: 2, L: 2 |
| 9 | Gate 3 — Final Attestation | 5 | P0: 2, P1: 3, P2: 0 | S: 0, M: 3, L: 2 |
| 10 | Audit Trail | 5 | P0: 1, P1: 3, P2: 1 | S: 1, M: 2, L: 2 |
| 11 | Settings & Configuration | 7 | P0: 2, P1: 5, P2: 0 | S: 1, M: 6, L: 0 |
| 12 | Security & Privacy | 5 | P0: 3, P1: 2, P2: 0 | S: 0, M: 5, L: 0 |
| 13 | Cultural Context & Informed Consent | 3 | P0: 0, P1: 2, P2: 1 | S: 0, M: 3, L: 0 |
| | **TOTAL** | **68** | **P0: 29, P1: 31, P2: 3** | **S: 9, M: 44, L: 15** |

---

### Priority Breakdown

| Priority | Count | Percentage | MVP Must-Have |
|----------|-------|-----------|---|
| P0 (Beta) | 29 | 43% | Yes - foundational features |
| P1 (Launch) | 31 | 46% | Yes - complete experience |
| P2 (Post-Launch) | 3 | 4% | No - nice-to-have for v1.1+ |

---

### Complexity Breakdown

| Complexity | Count | Percentage | Est. Sprint Allocation |
|----------|-------|-----------|---|
| S (Small: 1-3 days) | 9 | 13% | 9 days |
| M (Medium: 3-8 days) | 44 | 65% | 220 days |
| L (Large: 8-21 days) | 15 | 22% | 225 days |
| | **TOTAL** | **100%** | **~454 story-days** |

---

### Critical Path for MVP (P0 Stories)

**Phase 1: Foundation (Weeks 1-3)**
- EPIC 1.1, 1.3: Onboarding setup, practice profile selection
- EPIC 2.1: Create new case
- EPIC 3.1, 3.2: Document upload, Q-Global parsing

**Phase 2: Data Workflow (Weeks 4-5)**
- EPIC 4.1, 4.2: Gate 1 data confirmation
- EPIC 3.4: Manual test score entry
- EPIC 2.2: Case dashboard

**Phase 3: Diagnostic Workflow (Weeks 6-8)**
- EPIC 5.1: Validity assessment
- EPIC 6.1, 6.2: Gate 2 diagnostic decisions
- EPIC 5.2: Evidence mapping (core version)

**Phase 4: Report & Finalization (Weeks 9-11)**
- EPIC 7.1: Report generation with streaming
- EPIC 8.1, 8.5: OnlyOffice editing + auto-save
- EPIC 9.1, 9.3, 9.4: Gate 3 attestation and finalization

**Phase 5: Cross-Cutting (Weeks 10-12)**
- EPIC 12: Security & Privacy (encryption, PII detection)
- EPIC 10.1, 10.2: Audit trail configuration and viewing

---

### Non-Functional Requirements Addressed by Stories

- **Performance**: Auto-save every 30 seconds (8.5), streaming report generation (7.1)
- **Usability**: <30 min onboarding target (1.1), split-view data confirmation (4.1), Kanban dashboard (2.2)
- **Security**: SQLCipher encryption (12.3), PII detection (12.1), auto-lock (12.4), audit trail (10.1-10.5)
- **Privacy**: PHI review queue (12.2), rejected diagnoses not logged (10.5)
- **Reliability**: Offline mode (12.5), error handling in document parsing (3.2-3.3)
- **Compliance**: Digital attestation (9.3), sealed/hashed reports (9.4), audit trail for legal defense (10.3)
- **Accessibility**: Cultural context fields (13.1), informed consent templates (13.2)

---

## Glossary

**Gate**: A workflow stage where clinician reviews and confirms system output before proceeding.
- Gate 1: Data Confirmation (verify extracted/ingested data)
- Gate 2: Diagnostic Decision (render/rule out diagnoses)
- Gate 3: Final Attestation (review flags, sign, finalize, seal)

**Agent**: AI component performing specialized tasks.
- Ingestor: Extracts data from documents
- Diagnostician: Maps evidence to diagnoses
- Writer: Generates report prose
- Editor/Legal Reviewer: Flags concerns (human role, not AI)

**PHI**: Protected Health Information (patient identifiable information)

**PII**: Personally Identifiable Information (broader than PHI)

**MVP**: Minimum Viable Product for beta launch

**P0/P1/P2**: Priority levels (0=beta, 1=launch, 2=post-launch)

**S/M/L/XL**: Complexity/sizing (Small, Medium, Large, Extra-Large)

---

**End of Document**

**Next Steps**:
1. Review user stories with product and engineering teams
2. Identify dependencies and sequencing constraints
3. Estimate individual stories and create sprint planning
4. Define acceptance test cases for each story
5. Create design mockups for UI/UX stories
