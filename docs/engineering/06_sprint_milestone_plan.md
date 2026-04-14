# Psygil MVP Sprint Milestone Plan

**Document Version:** 1.0
**Date:** 2026-03-19
**Status:** Engineering Roadmap
**Duration:** 15 months (March 2026 – June 2027)
**Total Sprints:** 24 sprints (2-week cadence)
**User Stories Mapped:** 68

---

## Executive Summary

This document maps 68 user stories from the Psygil MVP specification across four development phases and 24 two-week sprints. The plan establishes clear go/no-go decision points, prioritizes PII validation, and coordinates four AI agents (Ingestor, Diagnostician, Writer, Editor/Legal Reviewer) with three gates and OnlyOffice integration.

**Critical Path:**
- **PHASE 0** (Mar–May 2026): Legal & Compliance Foundation (parallel, CEO-led)
- **PHASE 1** (Mar 24–May 16): PII Validation Milestone (4 sprints)
- **PHASE 2** (May 19–Sep 5): Core Build & All 4 Agents Functional (8 sprints)
- **PHASE 3** (Sep 8–Oct 31): Beta & Market Readiness (4 sprints)
- **PHASE 4** (Nov 3–Jun 27, 2027): Launch & Growth (8 sprints)

**Go/No-Go Decision Points:**
1. **May 16** — PII/Safe Harbor validation complete (Milestone 0)
2. **Sep 5** — All 4 agents functional (Internal Alpha)
3. **Oct 31** — Beta cohort validates >50% time savings (Beta GO/NO-GO)
4. **Jun 27, 2027** — 100 paying users (Phase 4 milestone)

---

## PHASE 0: Legal & Compliance Foundation
### March – May 2026 (Parallel Track, CEO-Driven)

**Status:** Not sprint-based. Runs in parallel with engineering phases.
**Owner:** CEO with external counsel and advisory board.

### Legal Deliverables

| Task | Owner | Deadline | Status |
|------|-------|----------|--------|
| **FDA CDS Exemption Analysis** | External FDA counsel | Mar 25, 2026 | — |
| **BAA from Anthropic** | CEO | Mar 22, 2026 | Request submission |
| **BAA from OpenAI** | CEO | Mar 22, 2026 | Request submission |
| **APA DSM-5-TR Licensing Outreach** | CEO + clinical advisor | Mar 25, 2026 | Vendor contact |
| **EULA/ToS/Privacy Policy Draft** | General Counsel | Apr 30, 2026 | Legal review |
| **IP Counsel Review of Instrument Library** | IP Counsel | May 15, 2026 | Library audit |
| **E&O + Cyber Insurance (Bound)** | CEO + insurance broker | May 30, 2026 | Policy execution |
| **SBIR Phase I Submission** | CEO + technical lead | May 30, 2026 | Grant application |

### PHASE 0 – Dependencies & Blockers

- **SBIR Phase I Submission** is prerequisite for Phase II funding discussions.
- FDA exemption determination affects product positioning and regulatory messaging.
- BAAs must be in place before PII testing with real documents (Sprint 4).
- IP counsel review must be complete before public beta (Sprint 16).

---

## PHASE 1: Milestone 0 — PII Validation

### Sprint 1: Python Sidecar Scaffold
**Dates:** March 24 – April 4, 2026
**Duration:** 2 weeks
**Sprint Goal:** Establish Python microservice foundation with IPC communication and basic PII detection.

#### User Stories Included
- **Epic 12 (Security & Privacy):**
  - 12.1: PII Detection Before LLM Transmission

#### Tasks & Deliverables
1. **Python Project Structure**
   - Create `Psygil-sidecar/` repository with pyproject.toml, Poetry/Pipenv setup
   - Dependencies: Presidio, spaCy (en_core_web_sm), Whisper.cpp bindings, Flask or FastAPI
   - Docker containerization (optional for this sprint)

2. **IPC Communication Layer**
   - Implement Unix domain socket or named pipe listener
   - JSON-RPC 2.0 protocol for request/response
   - Request envelope: `{ method, params, id }`
   - Response envelope: `{ result/error, id }`

3. **Health Check Endpoint**
   - `GET /health` returns `{ status: "ok", version, dependencies_ok }`
   - Verify Presidio, spaCy, Whisper availability

4. **Basic PII Detection Endpoint**
   - `POST /detect-pii` accepts `{ text: string }`
   - Returns `{ entities: [{ type, value, start, end, confidence }] }`
   - Single-document mode (batch support deferred to Sprint 2)

#### Definition of Done
- [ ] Sidecar service starts and responds to health checks
- [ ] Single-document PII detection works for common entity types (NAME, EMAIL, PHONE, SSN)
- [ ] IPC bridge tested with simple Python client
- [ ] Unit tests for endpoint contracts
- [ ] README documents setup and API contract

#### Dependencies
- Python 3.9+ available on developer machines
- Presidio and spaCy models pre-downloaded or auto-downloaded on first run

#### Risk Flags
- ⚠️ **Whisper.cpp build complexity:** May delay audio integration; consider fallback to OpenAI API if compilation fails
- ⚠️ **IPC overhead:** Unix socket communication adds latency; benchmark early

#### Sprint Metrics
- Lines of code: ~500–700 (sidecar + tests)
- Code coverage target: >80% for core endpoints

---

### Sprint 2: PII Pipeline Hardening
**Dates:** April 7 – April 18, 2026
**Duration:** 2 weeks
**Sprint Goal:** Harden PII detection for HIPAA Safe Harbor compliance and batch processing.

#### User Stories Included
- **Epic 12 (Security & Privacy):**
  - 12.2: PHI Review Queue (Configurable)

#### Tasks & Deliverables
1. **Batch PII Detection**
   - `POST /detect-pii-batch` accepts `{ documents: [{ id, text }] }`
   - Returns `{ results: [{ id, entities }] }`
   - Parallel processing with configurable worker pool

2. **HIPAA Safe Harbor 18-Identifier Framework**
   - Implement validation for all 18 protected identifiers:
     1. Name (PII detector)
     2. Geographic subdivisions smaller than state (custom regex + geocoding)
     3. Dates (birth, death, admission, discharge, encounter)
     4. Phone numbers (PII detector)
     5. Fax numbers (custom regex)
     6. Email addresses (PII detector)
     7. SSN (custom regex)
     8. MRN (custom regex with configurable format)
     9. Health plan beneficiary numbers (custom regex)
     10. Account numbers (context-based heuristic)
     11. Vehicle ID numbers (custom regex)
     12. Device/implant serial numbers (manual flag)
     13. URLs (custom regex + domain filtering)
     14. IP addresses (custom regex)
     15. Biometric identifiers (text flags)
     16. Face photographs (document structure detection)
     17. Any other unique identifying number (human review queue)
     18. Combinations that identify individual (context rules)
   - Flag confidence thresholds per category

3. **Test Suite with Synthetic Forensic Documents**
   - Generate 100 synthetic evaluation documents (clinical notes, test reports, audio transcripts) with known PII
   - Create test cases covering each of 18 categories
   - Benchmark recall and false positive rate

4. **PHI Review Queue Prototype**
   - Flagged items stored in local queue (SQLite)
   - Human review interface (web UI stub for now)
   - Flag reasons and confidence scores

#### Definition of Done
- [ ] Batch endpoint processes 100+ documents without error
- [ ] All 18 HIPAA categories tested with >90% recall on synthetic data
- [ ] PHI queue stores and retrieves flagged items
- [ ] Integration test suite passes
- [ ] Documentation: Safe Harbor compliance matrix

#### Dependencies
- Synthetic forensic document corpus (generated or provided by clinical advisor)
- HIPAA Safe Harbor specification (reference: 45 CFR § 164.502(b))

#### Risk Flags
- ⚠️ **Recall vs. precision tradeoff:** Stricter filtering increases false positives (delays documents); calibration required
- ⚠️ **Context-based rules:** Categories 10, 17, 18 require domain heuristics; may need custom training

#### Sprint Metrics
- Synthetic test documents: 100+
- Safe Harbor category coverage: 18/18
- Average batch latency: <500ms for 10 documents

---

### Sprint 3: Whisper + Style Extraction
**Dates:** April 21 – May 2, 2026
**Duration:** 2 weeks
**Sprint Goal:** Add audio transcription and clinician style analysis endpoints.

#### User Stories Included
- **Epic 1 (Onboarding & Setup):**
  - 1.2: Writing Sample Upload & Style Extraction
- **Epic 3 (Document Ingestor Agent):**
  - 3.6: Audio Transcription (Whisper Integration)
- **Epic 7 (Writer Agent):**
  - 7.2: Voice-Matched Prose Using Style Rules

#### Tasks & Deliverables
1. **Audio Transcription Endpoint**
   - `POST /transcribe` accepts `{ audio: file (WAV/MP3/OGG), language: "en" }`
   - Returns `{ transcript: string, segments: [{ start, end, text }], confidence }`
   - Whisper.cpp integration (local, offline-capable)
   - Support for up to 30-minute recordings

2. **Style Extraction Endpoint**
   - `POST /extract-style` accepts `{ documents: [{ text }] }`
   - Analyzes writing samples for:
     - Vocabulary complexity (avg word length, Flesch-Kincaid grade)
     - Sentence structure patterns (avg length, complexity ratio)
     - Domain terminology (psychology/neurology/forensic terms)
     - Tone indicators (formal, conversational, clinical)
     - Common phrases and transitions
   - Returns `{ vocabulary_profile, sentence_patterns, terminology_set, tone, examples }`
   - Stored for later Writer Agent use

3. **Integration Tests**
   - End-to-end: upload audio → transcribe → flag PII → confirm clean transcript
   - Style extraction: ingest sample document → extract style profile → validate JSON schema
   - Latency benchmarks: transcription per minute of audio

#### Definition of Done
- [ ] Audio transcription produces intelligible text from 30-minute clinical recording
- [ ] Style extraction identifies 5+ writing characteristics with examples
- [ ] PII detection applied to all transcripts before return
- [ ] Integration tests pass with >95% transcript accuracy on clean audio
- [ ] API documentation with examples

#### Dependencies
- Whisper.cpp build and model files (base model ~180MB)
- Sample clinical audio (provided by clinical advisor or synthetic TTS)
- Sample writing documents for style extraction

#### Risk Flags
- ⚠️ **Whisper accuracy on clinical terminology:** May require fine-tuning or custom model; plan fallback to OpenAI API
- ⚠️ **Style profile relevance:** Psychology writing may not be well-represented in Whisper training; validate with real samples
- ⚠️ **Audio privacy:** Ensure transcripts are stored securely and PII is flagged immediately

#### Sprint Metrics
- Transcription latency: <2x real-time on M1/x86 CPU
- Style profile accuracy: manual validation on 5+ sample documents
- API coverage: 3 new endpoints fully documented

---

### Sprint 4: Validation & GO/NO-GO Decision
**Dates:** May 5 – May 16, 2026
**Duration:** 2 weeks
**Sprint Goal:** Validate PII/Safe Harbor compliance against real de-identified forensic documents; gate decision.

#### User Stories Included
- **Epic 12 (Security & Privacy):**
  - 12.1: PII Detection Before LLM Transmission

#### Tasks & Deliverables
1. **Test Against Real De-Identified Forensic Documents**
   - Obtain 50+ real clinical evaluation documents from clinical advisor (de-identified per HIPAA)
   - Run full sidecar PII detection pipeline on corpus
   - Document any false positives / false negatives
   - Measure latency distribution

2. **Safe Harbor Compliance Audit**
   - Verify 100% recall on all 18 HIPAA categories across test corpus
   - Measure false positive rate (documents incorrectly flagged)
   - Create remediation plan for any gaps (e.g., custom ML model, stricter rules)
   - Document decision rules for ambiguous cases (Category 17, 18)

3. **Performance Benchmarking**
   - Latency per document (P50, P95, P99)
   - Memory usage and CPU utilization
   - Batch processing scalability (10, 50, 100 document batches)
   - Identify bottlenecks and optimization opportunities

4. **GO/NO-GO Readiness**
   - Safety review: Can we guarantee Safe Harbor compliance for Electron app?
   - Performance review: Can sidecar keep up with document ingest rate?
   - Security review: Are PII queues secure and audit-trailing?
   - Legal review: Any gaps between sidecar capabilities and BAA requirements?

#### Definition of Done
- [ ] 50+ real documents tested; recall ≥ 99% on Safe Harbor categories
- [ ] False positive rate < 2% (acceptable threshold for human review queue)
- [ ] Performance benchmarks document baseline
- [ ] GO/NO-GO decision recorded in meeting minutes
- [ ] If NO-GO: remediation plan with new deadline

#### Dependencies
- Clinical advisor provides 50+ real de-identified documents
- Legal counsel reviews compliance audit findings
- BAAs from Anthropic and OpenAI in place (or waiver granted)

#### Risk Flags
- 🚨 **CRITICAL: If compliance audit fails, Phase 1 extends until remediation complete**
- ⚠️ **Document availability:** Delay in receiving real documents delays testing

#### Sprint Metrics
- Test corpus size: 50+ documents
- Safe Harbor recall: ≥99%
- False positive rate: <2%
- **MILESTONE GATE:** PII Validation GO/NO-GO (May 16)

---

## PHASE 1 Summary

**Status:** Validates core security requirement (PII detection) before core build.
**Effort:** 4 sprints (8 weeks)
**Outcome:** Sidecar service ready for Electron integration or restart with remediation.
**User Stories Delivered:** 4 (partial; 1.2, 3.6, 7.2, 12.1, 12.2)

---

## PHASE 2: Core Build

### Sprint 5: Electron Shell + Storage
**Dates:** May 19 – May 30, 2026
**Duration:** 2 weeks
**Sprint Goal:** Establish secure Electron application foundation with encrypted local storage.

#### User Stories Included
- **Epic 1 (Onboarding & Setup):**
  - 1.1: First-Time Application Setup (onboarding flow scaffolding)
- **Epic 11 (Settings & Configuration):**
  - 11.7: Security & Privacy Settings (auth/lock setup)
- **Epic 12 (Security & Privacy):**
  - 12.3: Encrypted Local Storage (SQLCipher)
  - 12.4: Auto-Lock After Inactivity

#### Tasks & Deliverables
1. **Electron App Scaffold**
   - Create `Psygil-electron/` with webpack build, dev server, packaging
   - Security best practices hardened:
     - `nodeIntegration: false`
     - `contextIsolation: true`
     - `sandbox: true`
     - `enableRemoteModule: false`
   - Code signing preparation (macOS notarization, Windows Authenticode)

2. **SQLCipher Database Initialization**
   - Integrate `better-sqlite3` + SQLCipher plugin
   - Load schema from `/Psygil-schema.sql` (from Phase 1 documentation)
   - Create database file: `~/.Psygil/Psygil.db` (encrypted at rest)
   - Migrations framework for future schema updates

3. **Preload Scripts + IPC Bridge**
   - Define secure IPC channels for:
     - Database queries (wrapped in prepared statements)
     - Sidecar communication (PII detection, audio transcription)
     - Auth0 token refresh
     - App lifecycle (quit, relaunch)
   - Whitelist all allowed IPC methods in preload

4. **Auth0 Integration (Login/Logout/Token Refresh)**
   - Implement OAuth 2.0 PKCE flow for Auth0 tenant
   - Secure token storage in SQLCipher (encrypted)
   - Automatic token refresh before expiry
   - Logout clears tokens and local session

#### Definition of Done
- [ ] Electron app builds and runs without warnings
- [ ] SQLCipher database creates and encrypts successfully
- [ ] IPC channels tested for all defined methods
- [ ] Auth0 login flow completes and returns access token
- [ ] Code review passed (security focus)
- [ ] No console warnings or security violations

#### Dependencies
- Auth0 tenant configured (dev + production)
- SQLCipher plugin compiled for target platforms (macOS, Windows, Linux)
- `Psygil-schema.sql` delivered from Phase 1 or earlier planning

#### Risk Flags
- ⚠️ **SQLCipher compilation:** Platform-specific builds may fail; test all targets early
- ⚠️ **Auth0 config:** Tenant setup delays sign-in testing

#### Sprint Metrics
- App startup time: <2 seconds
- Database creation time: <100ms
- Auth0 PKCE flow latency: <3 seconds
- Code coverage: >70% (critical paths)

---

### Sprint 6: OnlyOffice + Case Management
**Dates:** June 2 – June 13, 2026
**Duration:** 2 weeks
**Sprint Goal:** Embed OnlyOffice editor and implement case CRUD + dashboard.

#### User Stories Included
- **Epic 1 (Onboarding & Setup):**
  - 1.3: Practice Profile Selection
  - 1.4: Diagnosis Catalog Configuration
  - 1.5: Instrument Library Configuration
  - 1.6: Report Template Selection & Customization
- **Epic 2 (Case Management):**
  - 2.1: Create New Case with Referral Document
  - 2.2: View Case Dashboard (Kanban Board)
  - 2.3: Multi-Session Case Handling
  - 2.4: Case Search and Filtering
  - 2.5: Case Archival

#### Tasks & Deliverables
1. **OnlyOffice Community Edition Embedding**
   - Deploy OnlyOffice Document Server (or use community edition Docker image)
   - Embed in Electron using `webview` with sandboxing
   - Document open/save lifecycle via OnlyOffice events
   - Callback URL for save events back to sidecar/database

2. **Document Lifecycle (Open/Save/Auto-Save)**
   - Auto-save to SQLCipher every 30 seconds (non-blocking)
   - Version tracking (optional snapshot on save)
   - Conflict resolution if re-ingestion adds new content
   - Close-without-save confirmation

3. **Case CRUD**
   - Create: referral document upload → parse case metadata (patient age/gender, reason for evaluation, court/clinical)
   - Read: list all cases with filtering (status, date range, clinician, diagnosis)
   - Update: case metadata (practice context, notes)
   - Archive: soft-delete case (recoverable)

4. **Kanban Dashboard**
   - Columns: Not Started → Gate 1 (Data Confirm) → Gate 2 (Diagnostic Decision) → Gate 3 (Attestation) → Complete
   - Read-only display (workflow state driven by agent progress)
   - Card layout: case ID, patient age/gender, primary referral question, last modified
   - Click to open case in full editor view

#### Definition of Done
- [ ] OnlyOffice editor loads and accepts text input
- [ ] Document saves to database every 30 seconds
- [ ] Create case flow works end-to-end
- [ ] Kanban shows all cases with correct status
- [ ] Search/filter returns expected results
- [ ] Archive case removes from active view but preserves data

#### Dependencies
- OnlyOffice Community Edition available (Docker or standalone)
- OnlyOffice API documentation reviewed for callback patterns
- Case schema finalized in database

#### Risk Flags
- ⚠️ **OnlyOffice licensing:** Community Edition has feature limitations; Community Server required for production
- ⚠️ **Webview sandboxing:** May prevent OnlyOffice from accessing clipboard or file system; test with real files

#### Sprint Metrics
- Case creation time: <5 seconds
- Kanban rendering: <1 second for 50 cases
- Auto-save latency: unnoticeable (<50ms added to user interactions)

---

### Sprint 7: Ingestor Agent
**Dates:** June 16 – June 27, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement document upload, parsing, and Ingestor Agent integration.

#### User Stories Included
- **Epic 3 (Document Ingestor Agent):**
  - 3.1: Upload Documents (Multi-Format Support)
  - 3.2: Import Q-Global Score Report (PDF Parsing)
  - 3.3: Import PARiConnect Score Report (PDF Parsing)
  - 3.4: Manual Test Score Entry
  - 3.5: Referral Document Parsing (Extract Evaluation Questions)

#### Tasks & Deliverables
1. **Document Upload UI**
   - Drag-and-drop zone for PDF, DOCX, VTT, audio files
   - File validation (size limits, format whitelist)
   - Progress indicator for upload
   - Stores uploaded files in encrypted storage (`~/.Psygil/cases/<caseId>/documents/`)

2. **Q-Global PDF Parser**
   - Extract MMPI-3 (Minnesota Multiphasic Personality Inventory-3) summary scores
   - Recognized sections: validity indicators, clinical scales, content scales, supplementary scales
   - Handle different report formats (standard vs. extended)
   - Confidence score for extracted values
   - Flag any unrecognized sections

3. **PARiConnect PDF Parser**
   - Extract PAI (Personality Assessment Inventory) summary scores
   - Recognized sections: validity indices, clinical scales, treatment considerations scales
   - Handle report variations
   - Confidence scoring

4. **Referral Document Parser**
   - Extract and structure evaluation questions from referral letter/form
   - NLP-based extraction of question text and context
   - Organize by legal question vs. clinical question
   - Fallback to manual extraction if confidence too low

5. **Ingestor Agent Prompt Integration**
   - Claude API integration to structure extracted data
   - Prompt: "Given these documents, extract and organize: [documents]. Return JSON: { case_context, referral_questions, test_scores, behavioral_notes }"
   - Handle multi-document cases (tests on different dates, multiple referrals)
   - Structured output validation

#### Definition of Done
- [ ] Upload UI works with 5+ file types
- [ ] Q-Global parser extracts all MMPI-3 summary scores with >95% accuracy
- [ ] PARiConnect parser extracts all PAI scores with >95% accuracy
- [ ] Referral parser identifies evaluation questions (manual validation on 10+ samples)
- [ ] Ingestor Agent generates valid JSON for structured case record
- [ ] Integration test: upload 3 documents → receive structured case JSON

#### Dependencies
- Sample Q-Global and PARiConnect PDF reports (from clinical advisor)
- Claude API key and rate limit allocation
- PDF parsing library (`pdfplumber` or `pypdf`)

#### Risk Flags
- ⚠️ **PDF parsing fragility:** Different report formats may break parsers; consider OCR fallback (Tesseract)
- ⚠️ **Claude API costs:** Each Ingestor run costs tokens; budget for 100+ test runs during development

#### Sprint Metrics
- Document upload latency: <5 seconds per file
- Parser accuracy (Q-Global, PARiConnect): >95%
- Ingestor Agent JSON valid on first attempt: >90%

---

### Sprint 8: Gate 1 + Psychometrist Role
**Dates:** June 30 – July 11, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement Gate 1 data confirmation UI and psychometrist test score entry role.

#### User Stories Included
- **Epic 3 (Document Ingestor Agent):**
  - 3.7: Psychometrist Test Score Entry (Restricted Role)
- **Epic 4 (Gate 1 – Data Confirmation):**
  - 4.1: Review Extracted Data in Split View
  - 4.2: Confirm/Correct Each Data Category
  - 4.3: Add Manual Behavioral Observations
  - 4.4: Flag Missing Data
  - 4.5: Re-ingest with New Documents Added

#### Tasks & Deliverables
1. **Gate 1 UI: Split-View Data Confirmation**
   - Left pane: original documents (PDF, DOCX viewer embedded)
   - Right pane: extracted structured data in editable form
   - Data categories: case context, referral questions, test scores, behavioral observations
   - Side-by-side scrolling (optional synchronization)

2. **Checklist with Confirm/Correct/Flag-Missing Workflow**
   - Checkbox per data category: `[✓] Confirmed` | `[ ] Needs Correction` | `[!] Missing`
   - Click to edit extracted value or add missing entry
   - Validation rules per field (e.g., age must be 18-100, diagnosis code must be valid ICD-10)
   - Cannot proceed to Gate 2 until all items confirmed or explicitly marked "Not Applicable"

3. **Manual Observation Entry**
   - Free-text input for observed behavioral characteristics during evaluation
   - "Add Observation" button to append entries
   - Observations stored alongside ingestor-extracted data

4. **Psychometrist Restricted View**
   - User role: `psychometrist` (vs. `clinician` or `editor`)
   - Psychometrist sees only test score section
   - Cannot view referral questions, behavioral observations, or case notes
   - Can update test scores; changes audit-logged
   - Cannot proceed past Gate 1

5. **Re-ingestor Workflow**
   - "Add More Documents" button in Gate 1
   - Upload new tests or documents without resetting existing data
   - Merge new extracted scores with existing scores (no overwrite unless confirmed)
   - Audit trail: which documents added when

#### Definition of Done
- [ ] Split view renders both documents and form without lag
- [ ] Confirm/Correct/Flag workflow enforces completion
- [ ] Psychometrist role restricts view to test scores only
- [ ] Re-ingest merges new documents without data loss
- [ ] Audit log records all edits and additions
- [ ] All validation rules enforce data quality

#### Dependencies
- Gate 1 UI framework (React, Vue, or custom components)
- PDF/DOCX viewer library for left pane
- Role-based access control (RBAC) system in authentication

#### Risk Flags
- ⚠️ **UX complexity:** Split-view with many data fields may overwhelm users; user research/testing recommended
- ⚠️ **Validation rules:** Overly strict rules may block legitimate edge cases; calibrate with clinical input

#### Sprint Metrics
- Gate 1 completion time (5-case average): <15 minutes per case
- Psychometrist role test score entry time: <3 minutes per case
- Data confirmation accuracy: >98% (validated against human review)

---

### Sprint 9: Diagnostician Agent
**Dates:** July 14 – July 25, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement validity assessment, evidence mapping, and diagnostic analysis.

#### User Stories Included
- **Epic 5 (Diagnostician Agent):**
  - 5.1: View Validity/Effort Assessment (Processed First)
  - 5.2: View Evidence Map Per Potential Diagnosis
  - 5.3: View Differential Diagnosis Comparisons
  - 5.4: View Psycho-Legal Analysis (Forensic Cases)
  - 5.5: View Functional Impairment Summary (Clinical Cases)

#### Tasks & Deliverables
1. **Validity/Effort Assessment Layer**
   - Process first before other diagnostician outputs
   - Extract and analyze validity scales:
     - MMPI-3: F, F-back, Fp scales, Response Bias Scale
     - PAI: Inconsistency, Infrequency, Negative Impression, Positive Impression
     - TOMM (Test of Memory Malingering): Trial 1, Trial 2, Retention
     - SIRS-2 (Structured Interview of Reported Symptoms): Primary and supplementary scales
   - Flag low effort, inconsistent responding, or symptom exaggeration
   - Decision output: Valid → Proceed | Invalid → Flag for review

2. **Evidence Map Generation**
   - For each potential diagnosis in case referral:
     - Criterion-by-criterion mapping (DSM-5-TR)
     - Supporting evidence (test scores, behavioral observations, historical data)
     - Conflicting evidence or alternative explanations
     - Confidence level (strong, moderate, weak, insufficient)
   - Evidence map stored as structured JSON

3. **Differential Diagnosis Comparisons**
   - If multiple diagnoses are ruled in, generate comparison matrix:
     - Diagnosis A vs. Diagnosis B
     - Distinguishing features
     - Which test scores discriminate between them
   - Organized by diagnostic clarity (highest confidence first)

4. **Psycho-Legal Analysis (Forensic Cases)**
   - Detect case type: forensic vs. clinical (from referral context)
   - If forensic:
     - Dusky competency analysis (if applicable): deficits in understanding charges, assisting counsel, appreciating situation
     - M'Naghten rule analysis (criminal responsibility): knowledge of wrongfulness, ability to conform conduct
     - Best interests of child (custody/dependency): parenting capacity, risk factors
     - Generate structured legal opinion framework

5. **Functional Impairment Summary (Clinical Cases)**
   - If clinical case:
     - GAF (Global Assessment of Functioning) / WHODAS estimation
     - Impairments across domains: social, occupational, cognitive, emotional, physical
     - Prognosis and treatment recommendations

#### Definition of Done
- [ ] Validity scales extracted from test scores with 100% coverage
- [ ] Evidence map generates structured JSON for 5+ diagnoses
- [ ] Differential diagnosis comparison ranks diagnoses by confidence
- [ ] Psycho-legal analysis (Dusky, M'Naghten) templates render correctly
- [ ] Functional impairment summary populated for clinical cases
- [ ] Integration test: Gate 1 data → Diagnostician Agent → valid JSON output

#### Dependencies
- DSM-5-TR diagnostic criteria (hardcoded or fetched from database)
- Forensic legal frameworks (Dusky, M'Naghten, best interests) documented
- Claude API integration for complex reasoning tasks
- Test score validity thresholds calibrated with clinical advisor

#### Risk Flags
- ⚠️ **Legal liability:** Psycho-legal analyses are expert-opinion-adjacent; must be clearly marked as decision support, not legal advice
- ⚠️ **Validity threshold calibration:** Too strict → blocks legitimate cases; too lenient → allows low-confidence data

#### Sprint Metrics
- Evidence map generation latency: <10 seconds per case
- Validity assessment false negative rate: <2% (must catch low-effort cases)
- Differential diagnosis ranking matches clinical advisor input: >90%

---

### Sprint 10: Gate 2 — Diagnostic Decision
**Dates:** July 28 – August 8, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement Gate 2 UI for clinician diagnostic decisions.

#### User Stories Included
- **Epic 6 (Gate 2 – Diagnostic Decision):**
  - 6.1: Review Evidence Map for Each Diagnosis
  - 6.2: Select Diagnosis Decision (Render / Rule Out / Defer)
  - 6.3: NO "Accept All" — Individual Diagnosis Decisions Required
  - 6.4: Add Clinical Notes Per Decision
  - 6.5: Revisit and Modify Decisions (Non-Linear Workflow)

#### Tasks & Deliverables
1. **Gate 2 UI: Evidence Map Display**
   - Display evidence map generated in Sprint 9 (read-only summary)
   - Expandable diagnosis cards showing:
     - Diagnostic name and ICD-10 code
     - Confidence level (strong/moderate/weak/insufficient)
     - Supporting evidence (bullet list with source: test score, observation, etc.)
     - Conflicting evidence
     - Clinician's decision controls (below, see #2)

2. **Decision Controls: Render / Rule Out / Defer / No Decision**
   - Radio buttons or button group per diagnosis:
     - `[Render]` — Include in final report
     - `[Rule Out]` — Exclude from report
     - `[Defer]` — Insufficient data; note for future evaluation
     - `[No Decision]` — Default (cannot advance without selecting one)
   - **NO "Accept All" button** — Each diagnosis requires explicit clinician decision
   - Prevents accidental wholesale acceptance

3. **Clinical Notes Per Decision**
   - Text input below each diagnosis decision
   - Clinician rationale for selection
   - Examples: "ADHD: strong evidence from CPT, but patient denies childhood symptoms" / "MDD: ruled out due to high Positive Impression scale"
   - Auto-save notes to database

4. **Validity Assessment Banner (Top of Gate 2)**
   - Display validity verdict (Valid → Proceed | Invalid → Review Flagged)
   - If invalid: highlight which validity scales are concerning
   - Allow clinician to override and proceed (override logged)

5. **Psycho-Legal Analysis Panel (Forensic Cases Only)**
   - Collapsible section showing Dusky/M'Naghten/best interests analysis
   - Read-only; used to inform diagnostic decisions
   - Does not block Gate 2 completion

#### Definition of Done
- [ ] Evidence map renders fully with all diagnoses visible
- [ ] Decision controls work for each diagnosis (radio buttons required)
- [ ] NO "Accept All" button exists anywhere in Gate 2
- [ ] Clinical notes save automatically
- [ ] Clinician can revisit and modify decisions (non-linear)
- [ ] Validity banner displays clearly at top
- [ ] Cannot proceed to Gate 3 until all diagnoses have explicit decisions

#### Dependencies
- Evidence map JSON structure from Sprint 9
- Validity assessment results from Sprint 9
- UI framework and styling consistent with Electron app

#### Risk Flags
- ⚠️ **Decision opacity:** If evidence map reasoning is unclear, clinician may make inappropriate decisions; strong UX and examples critical
- ⚠️ **Legal review needed:** Psycho-legal analysis may require attorney/legal advisor review for liability

#### Sprint Metrics
- Gate 2 completion time (5-case average): <10 minutes per case
- Clinician notes thoroughness: >80% of decisions have explanatory notes
- Override frequency (validity banner): <5% of cases

---

### Sprint 11: Writer Agent + Editor/Legal Reviewer
**Dates:** August 11 – August 22, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement report writing with AI agents and human review integration.

#### User Stories Included
- **Epic 7 (Writer Agent):**
  - 7.1: Generate Report Sections (Streaming with Progress)
  - 7.2: Voice-Matched Prose Using Style Rules
  - 7.3: Content Type Indicators (Fully Generated vs. Draft Requiring Revision)
  - 7.4: Behavioral Observations from Transcripts Marked for Revision
  - 7.5: Diagnostic Section Writes ONLY Clinician's Gate 2 Selections
- **Epic 8 (Editor/Legal Reviewer Agent):**
  - 8.1: Edit Report in Full Word-Compatible Editor
  - 8.2: Track Changes Showing AI vs. Clinician Edits
  - 8.3: Editor/Legal Reviewer Flags as Word Comments

#### Tasks & Deliverables
1. **Writer Agent Prompt Integration**
   - Claude API endpoint: structured case data (Gate 1 + Gate 2) → report sections
   - Streaming response: display report generation in real-time (progress bar per section)
   - Sections: Background, Referral Questions, Behavioral Observations, Test Results, Diagnostic Impressions, Recommendations
   - Apply extracted style rules (from Sprint 3) to generated prose

2. **Style Rule Application**
   - Use clinician's writing profile (vocabulary, sentence structure, tone)
   - Prompt includes style guidance: "Use vocabulary grade level 14, clinical tone with conversational transitions, common phrases like [examples]"
   - Post-process generated text to enforce style consistency

3. **Content Type Indicators**
   - Flag sections as `fully_generated` or `draft_requiring_revision`
   - Fully generated: structured test data, straightforward diagnostic impressions
   - Revision needed: behavioral observations from transcripts (subjective), psycho-legal analysis (legal liability), recommendations (high-stakes)
   - Display in OnlyOffice as highlighting or comments

4. **Behavioral Observations from Transcripts**
   - Extract from audio transcripts (Sprint 3)
   - Writer Agent incorporates with `draft_requiring_revision` flag
   - Clinician must review and edit before finalization

5. **Diagnostic Section Discipline**
   - Writer Agent ONLY includes diagnoses that clinician selected `[Render]` in Gate 2
   - Excludes `[Ruled Out]` and `[Defer]` diagnoses
   - Respects clinician's clinical judgment

6. **Editor/Legal Reviewer Agent Integration**
   - Claude API: review generated report sections
   - Check for: legal liability language, unsupported claims, missing citations, clinical accuracy
   - Output: flags as Word comments in OnlyOffice document
   - Examples: "This statement about test validity needs citation" / "Legal concern: avoid 'definitive proof' language"

#### Definition of Done
- [ ] Writer Agent generates report sections with streaming progress visible
- [ ] Style rules applied to generated text (manual validation on 3+ cases)
- [ ] Content type indicators (`fully_generated` vs. `draft_requiring_revision`) accurate on >95% of sections
- [ ] Only `[Render]` diagnoses appear in diagnostic section
- [ ] Editor/Legal Reviewer Agent identifies 80%+ of obvious legal concerns (validated against human review)
- [ ] Track changes shows AI edits vs. clinician edits in OnlyOffice

#### Dependencies
- Writer Agent prompt design (requires careful iteration and testing)
- Style rules JSON format from Sprint 3
- Editor/Legal Reviewer prompt design (legal liability focus)
- OnlyOffice API for comment/track changes integration
- Claude API rate limit allocation for 100+ test runs

#### Risk Flags
- 🚨 **Legal liability:** Generated report content may contain unsupported claims or liability-creating language; Editor Agent must be rigorous
- ⚠️ **Style transfer quality:** AI-generated prose may not match clinician's voice authentically; user research critical
- ⚠️ **Claude API costs:** Writer + Editor agents run on every case; budget accordingly

#### Sprint Metrics
- Report generation latency: <30 seconds for full report (streaming)
- Style consistency: clinician-validated on 5+ cases
- Editor Agent false negative rate: <5% (must catch legal issues)
- Content type accuracy: >95%

---

### Sprint 12: Gate 3 + Audit Trail
**Dates:** August 25 – September 5, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement Gate 3 final sign-off, attestation, and comprehensive audit trail.

#### User Stories Included
- **Epic 9 (Gate 3 – Attestation & Finalization):**
  - 9.1: Review All Editor/Legal Reviewer Flags
  - 9.2: Accept/Dismiss/Modify Each Flag
  - 9.3: Sign Attestation
  - 9.4: Finalize Report (Lock, Hash, Sealed PDF)
  - 9.5: Export .docx and PDF
- **Epic 10 (Audit Trail):**
  - 10.1: Configurable Granularity (Decision Record Only vs. Full Detail)
  - 10.2: View Audit Log for a Case
  - 10.3: Testimony Preparation Export
  - 10.4: Date-Based Timestamps (Not Minute-Level by Default)
  - 10.5: Never Logs Rejected Diagnostic Options

#### Tasks & Deliverables
1. **Gate 3 UI: Flag Review List**
   - Display all Editor/Legal Reviewer flags as list or inline comments
   - For each flag:
     - `[✓ Accept]` — flag addressed, no change needed
     - `[✗ Dismiss]` — flag not applicable, remove
     - `[Edit]` — modify text directly to resolve flag
   - Cannot finalize until all flags addressed (accept/dismiss/modify)

2. **Attestation Statement & Digital Sign-Off**
   - Attestation template: "I hereby certify that this evaluation is accurate, complete, and reflects my professional opinion based on the documented evidence. This report was generated using Psygil, an AI-assisted clinical documentation tool. All final diagnostic conclusions reflect my independent clinical judgment."
   - Clinician's signature (e-signature library: DocuSign or Electron-native signing)
   - Timestamp and date
   - Stored with report

3. **Report Finalization**
   - Lock document: no further edits allowed
   - Generate cryptographic hash (SHA-256) of final document
   - Create sealed PDF (tamper-evident, hash embedded)
   - Store finalized report in secure storage

4. **Audit Trail Implementation**
   - Log all case modifications:
     - Gate 1: data entry, confirmation, corrections
     - Gate 2: diagnosis decisions, clinical notes
     - Gate 3: flag review, attestation, report finalization
   - Configurable granularity:
     - `decision_record_only`: record Gate 1 confirmations, Gate 2 decisions, Gate 3 sign-off only
     - `full_detail`: record every keystroke, change, edit, flag review
   - Timestamps: date-level by default (not minute-level) to avoid re-identification risk
   - **Never log rejected diagnostic options** (e.g., ruled-out diagnoses not stored in audit trail)

5. **Testimony Preparation Export**
   - Export report + audit trail summary in format suitable for deposition
   - Include: diagnostic timeline, decision rationale, validity assessment, evidence map
   - Excludes internal notes/flags (clinician-privileged)
   - Formatted for legal review

#### Definition of Done
- [ ] Gate 3 flag review UI renders all flags and allows accept/dismiss/modify
- [ ] Attestation statement pre-filled with clinician name and captures signature
- [ ] Report locks successfully; no further edits possible
- [ ] Hash embedded in sealed PDF; integrity verifiable
- [ ] Audit trail logs all interactions per granularity setting
- [ ] Testimony export generates valid document
- [ ] Audit trail never includes rejected diagnoses
- [ ] Integration test: Case through all 3 gates → audit log complete → report sealed

#### Dependencies
- Audit trail schema designed (tables: case_events, event_type, timestamp, user, data)
- Digital signature library integrated (DocuSign SDK or Electron-native)
- PDF sealing/integrity libraries

#### Risk Flags
- ⚠️ **Audit trail size:** Full detail mode may generate large logs over time; database optimization needed
- ⚠️ **Timestamp granularity:** Date-level timestamps sacrifice forensic granularity for privacy; verify acceptable with legal advisor

#### Sprint Metrics
- Gate 3 completion time (5-case average): <5 minutes (mostly flag review)
- Report finalization latency: <2 seconds
- Audit trail size: <10MB per 100 cases (full detail mode)
- **MILESTONE: INTERNAL ALPHA — ALL 4 AGENTS FUNCTIONAL (Sep 5)**

---

## PHASE 2 Summary

**Status:** Core product complete; all four agents (Ingestor, Diagnostician, Writer, Editor/Legal Reviewer) integrated with three gates and audit trail.
**Effort:** 8 sprints (16 weeks)
**Outcome:** Internal alpha ready for closed testing.
**User Stories Delivered:** 45+ (includes all Epics 1–10)
**MILESTONE:** Internal Alpha (Sep 5, 2026)

---

## PHASE 3: Beta

### Sprint 13: Security Hardening
**Dates:** September 8 – September 19, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement advanced security controls and prepare for external penetration testing.

#### User Stories Included
- **Epic 12 (Security & Privacy):**
  - 12.3: Encrypted Local Storage (SQLCipher) — validation
  - 12.4: Auto-Lock After Inactivity — hardening

#### Tasks & Deliverables
1. **Content Security Policy (CSP) Implementation**
   - Define CSP headers for Electron app:
     - `default-src 'self'` (block external resources)
     - `script-src 'self'` (block inline scripts, external CDNs)
     - `style-src 'self'` (CSS only from app bundle)
     - `connect-src` whitelist for Auth0, Claude API, Stripe (only necessary origins)
   - Test CSP violations in dev console

2. **Code Signing**
   - **macOS:** Notarization with Apple Developer account (required for Gatekeeper)
   - **Windows:** Authenticode certificate and signing pipeline in CI/CD
   - Auto-update verification uses code signatures (Ed25519)

3. **npm/pip Dependency Audit in CI**
   - Add `npm audit` / `pip audit` checks to GitHub Actions
   - Fail CI if high/critical vulnerabilities detected
   - Establish SLA: fix or patch within 7 days
   - Generate SBOM (Software Bill of Materials) for compliance

4. **Auto-Update with Ed25519 Signature Verification**
   - Implement update checker (weekly background check)
   - Download new version from CDN (Cloudflare or similar)
   - Verify Ed25519 signature before installation
   - User prompted: "Update available. Install now?" (no forced updates)

5. **OnlyOffice Plugin/Macro/External Resource Lockdown**
   - Disable OnlyOffice macro execution
   - Disable external plugin loading
   - Whitelist allowed external resources (none, if possible)
   - OnlyOffice in "view + edit text only" mode (no formula/script execution)

6. **Penetration Test Engagement**
   - RFP and contract with security firm
   - Scope: Electron app, sidecar, encrypted storage, IPC, Auth0 integration
   - Timeline: 2-week assessment + 1-week remediation
   - Targeted start: mid-September (post-hardening)

#### Definition of Done
- [ ] CSP headers set and tested (no console violations)
- [ ] macOS notarization pipeline working
- [ ] Windows code signing integrated into build
- [ ] CI/CD runs `npm audit` and `pip audit` on every push
- [ ] Auto-update checks signature before installation
- [ ] OnlyOffice macro and plugin execution disabled
- [ ] Penetration test engagement contract signed

#### Dependencies
- Apple Developer account (cost: $99/year)
- Windows Authenticode certificate (cost: $100–300/year)
- Security firm RFP and contracting
- Ed25519 key generation and rotation policy

#### Risk Flags
- ⚠️ **Penetration test timeline:** Security firm availability may delay testing; book early
- ⚠️ **Remediation scope:** If pentest reveals critical flaws, remediation may extend timeline

#### Sprint Metrics
- CSP violations in dev console: 0
- Code signing success rate: 100%
- CI/CD audit checks latency: <30 seconds
- Penetration test kickoff: Sep 15 (targeting)

---

### Sprint 14: Backend + Billing
**Dates:** September 22 – October 3, 2026
**Duration:** 2 weeks
**Sprint Goal:** Implement subscription billing and license server for production deployment.

#### User Stories Included
- *New user stories not in original 68; scope addition for Phase 3*

#### Tasks & Deliverables
1. **Stripe Billing Integration**
   - Stripe account setup (production + test mode)
   - Customer creation on first sign-up (Auth0 ID linked to Stripe Customer)
   - Subscription creation: tier selection (Starter: $50/mo, Professional: $150/mo)
   - Subscription management UI (change plan, pause, cancel)
   - Webhook handlers: `invoice.paid`, `charge.failed`, `customer.subscription.deleted`

2. **License Server Deployment**
   - Simple HTTP service (Node.js or Python Flask)
   - Endpoint: `/validate-license` accepts `{ customer_id, app_version }`
   - Returns: `{ valid: true/false, license_type, expiry_date, entitlements }`
   - Deployed on Fly.io (global edge deployment, <100ms latency)
   - Offline cache: Electron app caches license valid for 7 days (grace period)

3. **Stripe Customer Portal Link**
   - "Account Settings" button in Electron app navigates to Stripe Billing Portal
   - Clinician manages payment method, subscription, invoice history
   - Updates reflected in Psygil within 1 minute (webhook-triggered)

4. **OnlyOffice Developer Edition License Purchased & Integrated**
   - Purchase OnlyOffice Developer Edition license (if Community Edition insufficient)
   - Integrate license key into OnlyOffice deployment
   - Verify license activation in CI/CD

#### Definition of Done
- [ ] Stripe account configured with products and pricing
- [ ] Customer creation tested in test mode
- [ ] Subscription CRUD operations working (create, update, cancel)
- [ ] License server deployed to Fly.io and accessible <100ms
- [ ] Offline grace period (7-day cache) tested
- [ ] Stripe webhooks trigger license updates
- [ ] Customer Portal link works end-to-end

#### Dependencies
- Stripe account and API keys
- Fly.io account and deployment configuration
- OnlyOffice licensing terms reviewed

#### Risk Flags
- ⚠️ **Stripe webhook delays:** Webhooks may arrive out of order or be delayed; implement idempotency
- ⚠️ **License server downtime:** If license server unreachable, fallback to cached license (7-day grace)

#### Sprint Metrics
- License validation latency: <100ms
- Stripe webhook processing latency: <5 seconds
- Offline grace period tested: ✓

---

### Sprint 15: Support + Onboarding
**Dates:** October 6 – October 17, 2026
**Duration:** 2 weeks
**Sprint Goal:** Build customer support infrastructure and enhance onboarding experience.

#### User Stories Included
- **Epic 1 (Onboarding & Setup):**
  - 1.1: First-Time Application Setup (enhanced)
- **Epic 13 (Cultural Competency & Consent):**
  - 13.1: Cultural/Linguistic Context Fields on Cases
  - 13.2: Informed Consent Template Insertion
  - 13.3: Peer Consultation Documentation

#### Tasks & Deliverables
1. **Knowledge Base (GitBook)**
   - Hosted knowledge base with guides and FAQs
   - Sections: Getting Started, Case Management, Each Gate, Report Writing, Settings, Troubleshooting, FAQ
   - Search functionality
   - Version control for documentation updates

2. **Intercom Integration with Fin AI Agent**
   - Embed Intercom chat widget in Electron app
   - Fin AI agent responds to common questions (powered by Claude)
   - Fallback to human support team for escalations
   - Chat history attached to case (for context)

3. **StatusPage.io Setup**
   - Monitor app availability, API uptime, license server status
   - Public status page showing incident history
   - Automated alerts for service degradation

4. **Sample Forensic Case Pre-Loaded**
   - Include realistic de-identified forensic case as demo/tutorial
   - Demonstrates Dusky competency evaluation workflow
   - Case includes: referral, test scores, psycho-legal analysis
   - Clinician can work through case to learn all gates
   - Cannot be modified or saved (read-only demo)

5. **Guided Onboarding Walkthrough**
   - Interactive tutorial (using Tour.js or Shepherd)
   - Step-by-step: create case, upload documents, confirm data, set diagnoses, review report, finalize
   - Skip-able but encouraged
   - Example case (forensic or clinical based on user preference)

6. **Cultural/Linguistic Context Fields**
   - Case metadata fields: patient cultural background, primary language, clinical considerations for cultural context
   - Psygil prompts Writer Agent to consider cultural factors in language and assessment interpretation

7. **Informed Consent Template System**
   - Library of informed consent templates (standard clinical + forensic variants)
   - Clinician can insert template into case documents
   - Template text matches Psygil's disclosure (patient understands AI-assisted report)

8. **Peer Consultation Documentation**
   - Case field: "Peer Consultants" (name, role, consultation date, summary)
   - Audit trail logs peer consultation additions
   - Testimony Preparation export includes peer consultation summary

#### Definition of Done
- [ ] Knowledge base deployed and accessible
- [ ] Intercom widget embedded and Fin AI agent responds to 5+ common queries
- [ ] StatusPage.io configured and monitoring active
- [ ] Sample forensic case included in app package (read-only)
- [ ] Guided onboarding walkthrough completes in <10 minutes
- [ ] Cultural context fields appear in case form and are passed to Writer Agent
- [ ] Informed consent templates available in template system
- [ ] Peer consultation field logged in audit trail

#### Dependencies
- GitBook or similar documentation platform
- Intercom API integration
- StatusPage.io account
- Sample case content (clinical advisor)

#### Risk Flags
- ⚠️ **Documentation scope creep:** Ensure knowledge base covers only MVP features, not future roadmap
- ⚠️ **Fin AI performance:** AI-powered support may require careful prompt tuning

#### Sprint Metrics
- Knowledge base article count: 15+
- Intercom response time: <30 seconds (AI agent)
- Onboarding walkthrough completion rate: >80% of new users
- Informed consent template usage: >70% of cases

---

### Sprint 16: Beta Cohort
**Dates:** October 20 – October 31, 2026
**Duration:** 2 weeks
**Sprint Goal:** Recruit beta users, deploy app, collect feedback, achieve go/no-go decision.

#### User Stories Included
- All previous epics; focus on stability and bug triage

#### Tasks & Deliverables
1. **Recruit 10 Beta Clinicians**
   - Work with clinical advisor to identify and contact 10 forensic/clinical psychologists
   - Mix of specialties: forensic competency evaluations, ADHD, mood disorders
   - Formal beta testing agreement (NDA, feedback consent)
   - Compensation: free 6-month subscription or $1000 stipend

2. **Beta Deployment**
   - Release v0.1.0-beta to selected cohort
   - Signed Electron app packages (macOS, Windows)
   - Beta installation guide and support email
   - In-app feedback survey after each case completion

3. **Bug Triage & Hotfix Pipeline**
   - Daily triage of reported bugs (P0: app crash, P1: feature broken, P2: UX issue)
   - Hotfix deployment for P0/P1 within 24 hours
   - Rolling updates via auto-update mechanism (Sprint 13)
   - Maintain beta release notes

4. **Feedback Collection**
   - In-app survey: "Time saved vs. traditional process?" / "Likelihood to recommend (NPS)?" / "Top 3 improvements?"
   - Exit survey on app close: UX feedback
   - Weekly check-in call with clinical advisor (representative user)
   - Bug reports captured via Intercom

5. **Go/No-Go Decision: >50% Time Savings**
   - Measure average time per case: baseline vs. Psygil
   - Baseline: 4–6 hours per forensic evaluation (documented in prior research)
   - Target: <2 hours per case with Psygil
   - Decision criteria:
     - ✅ GO: >50% time savings demonstrated, NPS >30, <5 P0 bugs outstanding
     - ❌ NO-GO: <50% time savings, NPS <20, or >5 P0 bugs blocking use
   - Decision recorded in meeting minutes (Oct 31)

#### Definition of Done
- [ ] 10 beta users onboarded and signed agreements
- [ ] Beta deployment successful (app installs, runs, connects to license server)
- [ ] Bug triage process established; P0/P1 hotfixes deployed within 24 hours
- [ ] Feedback collection mechanisms working (survey, NPS, Intercom)
- [ ] >50% time savings validated across 3+ beta users (5+ cases per user)
- [ ] NPS calculated (target: >30)
- [ ] GO/NO-GO decision recorded

#### Dependencies
- Clinical advisor outreach and recruitment
- Beta users with diverse case loads (forensic + clinical)
- Support process established (email, Intercom)
- Baseline time data (prior research or logged from pilot)

#### Risk Flags
- 🚨 **CRITICAL: If time savings <50% or NPS <20, Phase 4 launch delayed**
- ⚠️ **User attrition:** Beta users may stop using app due to bugs; rapid iteration critical
- ⚠️ **Feedback bias:** Small cohort (10 users) may not be representative; consider regional/specialty variation

#### Sprint Metrics
- Beta user onboarding completion: 100% (10/10)
- Average time per case (Psygil): <2 hours (target)
- Time savings vs. baseline: >50% (go/no-go threshold)
- NPS (Net Promoter Score): >30 (target)
- P0 bugs: <5 outstanding
- **MILESTONE: BETA GO/NO-GO DECISION (Oct 31)**

---

## PHASE 3 Summary

**Status:** Product hardened, billing live, and beta-validated for market readiness.
**Effort:** 4 sprints (8 weeks)
**Outcome:** Go/no-go decision on public launch.
**User Stories Delivered:** 13 (cultural competency, support, billing-adjacent)
**MILESTONE:** Beta GO/NO-GO (Oct 31, 2026)

---

## PHASE 4: Launch & Growth

### Sprint 17: Launch Preparation
**Dates:** November 3 – November 14, 2026
**Duration:** 2 weeks
**Sprint Goal:** Finalize public launch assets and resolve beta feedback.

#### User Stories Included
- All previous (stability focus)

#### Tasks & Deliverables
1. **Marketing Website + Download CDN**
   - Website: landing page with product overview, use cases (forensic + clinical), testimonials (beta users), pricing table, FAQ
   - Download page: direct links to macOS and Windows signed installers
   - CDN: Cloudflare distribution for fast global downloads
   - Website analytics: Plausible or similar (privacy-preserving)

2. **Beta Feedback Fixes**
   - Prioritize and resolve top 5 pain points from beta feedback
   - Regression test against beta case files
   - Release v0.1.0 (production) with resolved issues

3. **Public Launch**
   - Announce on Product Hunt, psychologist forums, forensic psychology networks
   - Email invites to beta users' networks
   - Press release (optional; depends on funding/PR strategy)
   - Monitor support channels for launch traffic

#### Definition of Done
- [ ] Marketing website deployed and live
- [ ] Download CDN working; latency <500ms globally
- [ ] macOS and Windows installers signed and available
- [ ] Beta feedback fixes tested
- [ ] v0.1.0 released
- [ ] Launch announcement posted

#### Dependencies
- Marketing collateral (screenshots, testimonials, use case copy)
- Cloudflare account and CDN configuration
- Domain and SSL certificate

#### Risk Flags
- ⚠️ **CDN cost:** Cloudflare usage may scale with popularity; monitor costs
- ⚠️ **First-day support load:** Incoming support volume may spike; ensure team capacity

#### Sprint Metrics
- Website load time: <2 seconds
- Download latency (CDN): <500ms
- Launch day user sign-ups: tracked

---

### Sprints 18–24: Post-Launch (8 sprints, Nov 17 – Jun 27, 2027)

**Dates:** November 17, 2026 – June 27, 2027
**Duration:** 32 weeks (8 two-week sprints)
**Sprint Goal:** Ongoing stability, feature iteration, academic validation, and user growth.

#### Continuous Activities Across All Post-Launch Sprints

1. **Ongoing Bug Fixes & Stability**
   - P0 (app crash): fixed within 4 hours
   - P1 (feature broken): fixed within 24 hours
   - P2 (UX issue): fixed within 1 week
   - Weekly patch releases (v0.1.1, v0.1.2, etc.)

2. **Conference Preparation**
   - **AAFP (American Academy of Family Physicians):** May 2027
     - Booth with demo instances
     - Poster or oral presentation on time savings
   - **APA Div 41 (Psychopharmacology/Clinical Hypnosis):** Mar/Apr 2027
     - Workshop or panel on AI in clinical practice
     - User testimonials

3. **Peer-Reviewed Validation Study**
   - Partner with academic institution (university psychology department)
   - Study design: RCT or observational comparison (Psygil vs. traditional)
   - Outcomes: time savings, report quality (blinded peer review), clinician satisfaction
   - Timeline: Start Nov 2026, publish by Q4 2027
   - Funding: SBIR Phase II or institutional support

4. **Senior Engineer Hire**
   - Recruit experienced full-stack engineer (Python, Node.js, Electron, SQL)
   - Support reliability, feature development, architecture decisions
   - Start date: target Jan 2027

5. **Feature Iteration Based on User Feedback**
   - Monthly feature requests review
   - Prioritize requests by user count and impact
   - Roadmap: potential features (not committed)
     - Multi-case batch processing
     - Integration with EHR systems (Epic, Cerner)
     - Expanded diagnostic frameworks (ICD-11, international instruments)
     - Peer consultation workflow (real-time video/chat)

6. **Scale to 75–150 Users**
   - User acquisition strategy: targeted outreach, word-of-mouth, conference presence
   - Churn rate target: <5% monthly
   - Retention metrics: weekly active users, average cases per user
   - Support efficiency: <2-hour response time

7. **SBIR Phase II Application**
   - If Phase I successful: prepare Phase II proposal (early 2027)
   - Phase II: $1M+ for market expansion, additional validation, B2B integrations
   - Submission deadline: typically Jun/Sep 2027
   - Funding decision: 6–12 months after submission

#### Sprint 18: Post-Launch Stabilization (Nov 17 – Nov 28)
- Focus: P0/P1 bug fixes, user support ramp-up
- Metrics: user sign-up rate, support ticket volume, crash rate

#### Sprint 19–20: Feature Iteration & Conference Prep (Dec 1 – Jan 15)
- Focus: AAFP conference preparation, minor UX improvements
- Deliverable: AAFP booth setup and presentation materials

#### Sprint 21: Academic Study Launch (Jan 18 – Feb 1)
- Focus: Finalize study protocol, recruit study sites, begin enrollment
- Deliverable: Study kick-off meeting with academic partner

#### Sprint 22: Senior Engineer Onboarding (Feb 4 – Feb 15)
- Focus: Knowledge transfer, architecture review, roadmap planning
- Deliverable: New engineer productive on backlog

#### Sprint 23: SBIR Phase II Preparation (Feb 18 – Mar 4)
- Focus: Gather Phase I results, draft Phase II proposal
- Deliverable: Phase II proposal submitted

#### Sprint 24: Q2 Milestone & Roadmap Planning (Mar 7 – Jun 27)
- Focus: Hit 100 paying users milestone, plan next phase
- Deliverable: 2027 H2 roadmap, updated business plan

#### Phase 4 Metrics (End of Jun 27, 2027)
- **User Growth:** 100 paying users (target milestone for Mar 2027, achieved by Jun 27)
- **Retention:** >95% of users active at least monthly
- **NPS:** >40 (target)
- **Uptime:** >99.9% (app availability)
- **Support Response Time:** <2 hours for P1 issues
- **Conference Presence:** 2+ presentations (AAFP, APA Div 41)
- **Validation Study:** Enrollment complete, analysis in progress
- **Code Quality:** >80% test coverage, 0 critical security vulnerabilities

---

## Critical Path Summary

### Timeline Overview
```
PHASE 0 (Mar–May 2026): Legal & Compliance Foundation [PARALLEL]
    ↓
PHASE 1 (Mar 24–May 16): PII Validation [4 sprints]
    ↓ [GO/NO-GO May 16]
PHASE 2 (May 19–Sep 5): Core Build [8 sprints]
    ↓ [ALPHA Sep 5]
PHASE 3 (Sep 8–Oct 31): Beta [4 sprints]
    ↓ [GO/NO-GO Oct 31]
PHASE 4 (Nov 3–Jun 27, 2027): Launch & Growth [8 sprints]
    ↓
[100 Users Target: Mar 2027]
```

### Go/No-Go Decision Points

| Gate | Date | Criteria | Outcome |
|------|------|----------|---------|
| **PII Validation** | May 16 | Safe Harbor compliance ≥99% recall; <2% false positive rate | GO → Phase 2 |
| **Internal Alpha** | Sep 5 | All 4 agents functional; internal testing complete | ALPHA → Phase 3 |
| **Beta GO/NO-GO** | Oct 31 | >50% time savings; NPS >30; <5 P0 bugs | GO → Public Launch |
| **100 Paying Users** | Jun 27, 2027 | Growth milestone; validation study in progress | PHASE 4 SUCCESS |

### Critical Dependencies & Risks

#### Critical Path Blockers
1. **FDA Exemption (Phase 0, due Mar 25):** If exemption denied, must pivot regulatory strategy
2. **BAAs from Claude (Phase 0, due Mar 22):** Required for PII testing with real documents
3. **Safe Harbor Validation (Sprint 4, May 16):** If <99% recall, Phase 1 extends
4. **Beta Time Savings (Sprint 16, Oct 31):** If <50%, launch delayed to 2027
5. **Security Penetration Test (Sprint 13):** If critical flaws found, remediation may block Phase 3 completion

#### Key Assumptions
- Python sidecar can achieve 99% recall on Safe Harbor categories (Presidio + spaCy + custom rules)
- Claude API consistently generates clinically relevant evidence maps and diagnostic impressions
- OnlyOffice Community Edition suffices for document editing (may need Developer Edition for production)
- 10 beta clinicians provide representative feedback for time savings validation
- No major regulatory changes to telemedicine or AI use in clinical practice

#### Risk Mitigation
- **API Cost Overruns:** Implement usage caching and batch processing; monitor Claude API costs weekly
- **Penetration Test Delays:** Schedule pentest early (mid-Sep); hire backup security firm as contingency
- **Clinician Recruitment:** Start outreach for beta users by Jun 2026 (before Phase 1 completion)
- **Time Savings Uncertainty:** Run pilot with 2–3 clinicians in Sep 2026 (pre-beta) to validate measurement methodology

---

## User Stories Mapping by Phase

### PHASE 1: PII Validation (Sprints 1–4)
- **1.2** Writing Sample Upload & Style Extraction
- **3.6** Audio Transcription (Whisper Integration)
- **7.2** Voice-Matched Prose Using Style Rules
- **12.1** PII Detection Before LLM Transmission
- **12.2** PHI Review Queue (Configurable)

### PHASE 2: Core Build (Sprints 5–12)
- **Epic 1 (Onboarding & Setup):** 1.1, 1.3, 1.4, 1.5, 1.6 (5 stories)
- **Epic 2 (Case Management):** 2.1, 2.2, 2.3, 2.4, 2.5 (5 stories)
- **Epic 3 (Ingestor Agent):** 3.1, 3.2, 3.3, 3.4, 3.5, 3.7 (6 stories)
- **Epic 4 (Gate 1):** 4.1, 4.2, 4.3, 4.4, 4.5 (5 stories)
- **Epic 5 (Diagnostician Agent):** 5.1, 5.2, 5.3, 5.4, 5.5 (5 stories)
- **Epic 6 (Gate 2):** 6.1, 6.2, 6.3, 6.4, 6.5 (5 stories)
- **Epic 7 (Writer Agent):** 7.1, 7.3, 7.4, 7.5 (4 stories; 7.2 in Phase 1)
- **Epic 8 (Editor Agent):** 8.1, 8.2, 8.3, 8.4, 8.5 (5 stories)
- **Epic 9 (Gate 3):** 9.1, 9.2, 9.3, 9.4, 9.5 (5 stories)
- **Epic 10 (Audit Trail):** 10.1, 10.2, 10.3, 10.4, 10.5 (5 stories)
- **Epic 11 (Settings):** 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7 (7 stories)
- **Epic 12 (Security):** 12.3, 12.4, 12.5 (3 stories; 12.1, 12.2 in Phase 1)

**Total Phase 2:** 60 stories

### PHASE 3: Beta (Sprints 13–16)
- **Epic 13 (Cultural Competency & Consent):** 13.1, 13.2, 13.3 (3 stories)

### PHASE 4: Launch & Growth (Sprints 17–24)
- Ongoing feature iterations (not in original 68)

---

## Definition of Done (Global)

All sprints adhere to this DoD:

- [ ] User stories have passing acceptance tests
- [ ] Code review completed by non-author (peer review)
- [ ] Unit test coverage ≥80% for new code
- [ ] Integration test passing for story interactions
- [ ] Documentation updated (README, API docs, user guides)
- [ ] No console warnings or lint errors
- [ ] Security review completed (if sensitive code)
- [ ] Performance benchmarks meet targets
- [ ] No regression in existing features (verified via test suite)
- [ ] Changelog entry documented

---

## Effort & Capacity Planning

### Total Effort
- **Total Sprints:** 24 (2-week cadence)
- **Total Duration:** 15 months (Mar 2026 – Jun 2027)
- **Team Size (Estimated):** 3–4 engineers + 1 clinical advisor
  - **Sprint 1–4:** 2 engineers (sidecar, PII)
  - **Sprint 5–12:** 3–4 engineers (Electron, agents, gates)
  - **Sprint 13–16:** 3–4 engineers (security, beta support)
  - **Sprint 17–24:** 3 engineers (maintenance, iterations) + 1 new hire (Jan 2027)

### Velocity Estimate
- **Sprint Velocity:** 20–25 story points (assuming M = 5pt, L = 8pt, XL = 13pt)
- **User Story Complexity Mix:**
  - P0/P1 (Sprints 1–12): ~60% medium, 30% large, 10% XL
  - P2 (Sprints 13–24): ~70% small, 20% medium, 10% large

### Budget Implications (Rough)
- **Engineering Cost:** 3.5 FTE × 15 months × $150k/yr = ~$656k
- **Infrastructure (Fly.io, Cloudflare, AWS, etc.):** ~$500–1k/month = ~$9k total
- **Third-Party Services (Auth0, Stripe, Intercom, OnlyOffice Developer Edition):** ~$300–500/month = ~$5.4k total
- **Penetration Testing:** ~$15k
- **Legal/Compliance (FDA counsel, IP review, BAAs):** ~$20k
- **Total Phase 0–4 Budget:** ~$705k–715k (engineering + ops)

---

## Success Metrics

### Phase 1: PII Validation
- ✅ Safe Harbor compliance audit: ≥99% recall, <2% false positive
- ✅ Sidecar API latency: <500ms for batch of 10 documents

### Phase 2: Core Build
- ✅ All 4 agents functional and integrated
- ✅ Internal alpha testers (3–5 internal users) complete full cases
- ✅ App stability: <1 crash per 10 hours of use

### Phase 3: Beta
- ✅ 10 beta users onboarded
- ✅ Time savings >50% vs. baseline (2 hours/case target)
- ✅ NPS >30
- ✅ <5 P0 bugs outstanding

### Phase 4: Launch & Growth
- ✅ 100 paying users by Jun 27, 2027 (target: Mar 2027)
- ✅ NPS >40
- ✅ Uptime >99.9%
- ✅ Monthly churn <5%
- ✅ Conference presentations completed (AAFP, APA Div 41)
- ✅ Peer-reviewed validation study published or in press

---

## Appendix: Legend & Abbreviations

| Term | Definition |
|------|-----------|
| **PII** | Personally Identifiable Information (name, SSN, email, phone) |
| **PHI** | Protected Health Information (clinical records, test scores) |
| **MRN** | Medical Record Number |
| **HIPAA** | Health Insurance Portability and Accountability Act |
| **Safe Harbor** | 45 CFR § 164.502(b) de-identification standard (18 identifiers) |
| **MMPI-3** | Minnesota Multiphasic Personality Inventory-3 |
| **PAI** | Personality Assessment Inventory |
| **Q-Global** | Pearson's online assessment platform |
| **PARiConnect** | PAI digital reporting platform |
| **TOMM** | Test of Memory Malingering |
| **SIRS-2** | Structured Interview of Reported Symptoms-2 |
| **Dusky** | *Dusky v. U.S.* standard for competency to stand trial |
| **M'Naghten** | M'Naghten rule for criminal responsibility (insanity standard) |
| **DSM-5-TR** | Diagnostic and Statistical Manual of Mental Disorders, 5th Edition, Text Revision |
| **ICD-10** | International Classification of Diseases, 10th Revision |
| **GAF** | Global Assessment of Functioning (0–100 scale) |
| **WHODAS** | World Health Organization Disability Assessment Schedule |
| **RFP** | Request for Proposal |
| **SBIR** | Small Business Innovation Research (SBIR Phase I/II) |
| **BAA** | Business Associate Agreement (HIPAA) |
| **E&O** | Errors & Omissions insurance |
| **CSP** | Content Security Policy (HTTP header) |
| **Ed25519** | Elliptic Curve cryptographic signature algorithm |
| **JWT** | JSON Web Token (Auth0) |
| **NPS** | Net Promoter Score (0–100 scale) |
| **P0/P1/P2** | Priority levels (0 = critical, 1 = high, 2 = medium) |
| **DoD** | Definition of Done |
| **MVP** | Minimum Viable Product |

---

**Document Approved By:** [CEO/Engineering Lead]
**Last Updated:** 2026-03-19
**Next Review:** 2026-05-01 (post-Phase 0 legal review)
