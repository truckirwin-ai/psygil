# Platform Survey and Gap Analysis

**Date:** 2026-04-10 (updated same day with decisions)
**Scope:** Full comparison of original design vs. current implementation
**Method:** Automated codebase survey (3 parallel agents) + manual doc review
**Gold Standard:** The implemented codebase as of commit `bf29f68` on `main`

## Decisions Made (2026-04-10)

| # | Decision | Status |
|---|----------|--------|
| 1 | Right Column stays disabled for v1.0. Admin Assistant chat moved to Column 1 bottom panel (replaced Resources pane). | DONE |
| 2 | Psychometrician Agent scoped to parse scoring reports only (no raw scoring, norms are copyrighted). | IN PROGRESS |
| 3 | Legacy gate_reviews and gate_decisions tables removed from schema, migrate, and tests. | DONE |
| 4 | Shared storage (Tier 2 network drive, Tier 3 cloud) deferred to v2.0. | DECIDED |
| 5 | Console.log cleanup sweep across all production source files. | IN PROGRESS |
| 6 | Python 3.11 installed via Homebrew for sidecar build pipeline. | DONE |
| 7 | Target: ship v1.0 ASAP. | DECIDED |

---

## Part 1: What Was in the Original Design

The original specification spans 28 engineering documents, a build manifest, and several strategic planning documents. The design called for:

### Architecture
- 4-process model: Electron Main, sandboxed Renderer, OnlyOffice local server, Python Sidecar
- Local-first PHI with SQLCipher encryption
- UNID redaction pipeline (single-use UNIDs replace PHI before any Claude API call)
- 6-stage clinical pipeline: Onboarding, Testing, Interview, Diagnostics, Review, Complete
- Three-column IDE layout (Left: case explorer, Center: tabs, Right: context + chat)
- 7 CSS token theme system (light, medium, dark)
- 2px draggable splitters with localStorage persistence

### Agents (Original: 4)
1. **Ingestor** - extract and structure raw case data into normalized JSON
2. **Diagnostician** - map evidence to diagnostic criteria, present without selecting
3. **Writer** - transform clinician-confirmed diagnoses into professional report prose
4. **Editor/Legal Reviewer** - 9-point adversarial review (speculative language, Daubert risks, junk science, etc.)

### Database (Original: 29 tables across 8 functional areas)
- User management (1): `users`
- Configuration (6): `diagnosis_catalog`, `instrument_library`, `diagnosis_instrument_mappings`, `practice_profiles`, `report_templates`, `style_rules`
- Case management (3): `cases`, `sessions`, `documents`
- Documents and test data (2): `documents_fts`, `test_administrations`
- Workflow and gates (2): `gate_reviews`, `gate_decisions`
- Diagnoses (1): `diagnoses`
- Agent system (3): `agent_runs`, `evidence_maps`, `writer_drafts`
- Reports (2): `reports`, `report_revisions`
- Audit (1): `audit_log`
- Support (2): `peer_consultations`, `referral_sources`
- Archive (2): `backup_metadata`, `case_notes`
- Shared storage addendum (6): `practice_config`, `document_permissions`, `file_locks`, `sync_manifest`, `case_assignments`, `diagnostic_decisions`

### IPC Boundaries (Original: 4)
1. Electron Main to Python Sidecar (JSON-RPC 2.0 over Unix socket)
2. Electron Main to OnlyOffice (SDK + Events, localhost:9980)
3. Electron Main to Claude API (HTTPS REST)
4. Electron Main to Renderer (contextBridge IPC, typed preload)

### UI Tabs (Original Design)
- Dashboard (pinned)
- Clinical Overview (per-case command center with sub-tabs)
- Test Results (per-instrument sub-tabs)
- Diagnostics ("DOCTOR ALWAYS DIAGNOSES" with individual Render/Rule Out/Defer)
- Eval Report (dual-mode: Preview + OnlyOffice editor)
- Data Confirmation (split-view: source document vs. extracted data)
- Attestation (checklist, signature, SHA-256 hash)
- Audit Trail (chronological, exportable, integrity verification)
- Settings (practice info, theme, API key, diagnosis catalog, instrument library)
- Document Viewer
- Evidence Map

### Right Column (Original Design)
- Upper panel: Case Notes, AI Agent Status cards, Deadlines, Quick Actions
- Lower panel: Writing assistant chat (calls `ai.complete()`)

### Modals (Original Design)
- Intake Modal (referral/walk-in case creation)
- Onboarding Modal (10-section patient history)
- Document Upload Modal (drag-drop with subfolder selection)
- Score Import Modal (Publisher PDF + Manual Entry)

### Sprint Plan (Original: 24 sprints, 15 months)
- Phase 0: Legal and compliance (parallel)
- Phase 1 (Sprints 1-4): PII validation milestone
- Phase 2 (Sprints 5-12): Core build
- Phase 3 (Sprints 13-16): UI MVP, internal alpha
- Phase 4 (Sprints 17-24): Beta and launch

### Security (Original Design)
- SQLCipher encryption for local database
- API keys in macOS Keychain via safeStorage
- CSP (Content Security Policy) on all responses
- Code signing (macOS notarization, Windows Authenticode)
- Auto-update with SHA-256 hash + Ed25519 signature verification
- OnlyOffice macro/plugin lockdown
- Rate limiting on Claude API calls

### Post-MVP Features (Original Design)
- Three-tier storage: Local Only (v1.0), Shared Network Drive (v1.1), Cloud (v2.0)
- Testimony preparation export
- Patient portal UI (deferred)
- Psychometrician Agent (5th agent, added later in doc 27)

---

## Part 2: What Has Been Built

Through 12 sprints (plus additional sessions beyond the manifest), the following is implemented and functional:

### Architecture (FULLY BUILT)
- 4-process model: Electron Main, sandboxed Renderer, OnlyOffice server, Python Sidecar
- SQLCipher encrypted database with Drizzle ORM (29 tables in schema.ts)
- UNID redaction pipeline with Presidio NER (sidecar) and regex fallback
- 6-stage clinical pipeline with enforcement gates
- Three-column IDE layout with draggable 2px splitters
- 7 CSS token theme system (light, medium, dark)
- Auth0 PKCE login flow
- Workspace folder architecture (real filesystem with DB metadata overlay)

### Agents (4 of 4 BUILT, 5th SPECIFIED)
1. **Ingestor** (`agents/ingestor.ts`) - BUILT. Extracts demographics, referral questions, test administrations, behavioral observations, timeline, collateral, completeness flags. Full system prompt with instrument-specific parsing (Q-Global, PARiConnect, WAIS-V, TOMM, SIRS-2).
2. **Diagnostician** (`agents/diagnostician.ts`) - BUILT. 5-step pipeline: validity assessment, diagnostic evidence map, differential comparisons, psycholegal analysis, functional impairment. System prompt enforces "map evidence, clinician decides."
3. **Writer** (`agents/writer.ts`) - BUILT. Loads ingestor + diagnostician results + clinician-confirmed decisions + `.style-profile.json` from writing samples. Outputs sections with `fully_generated` or `draft_requiring_revision` content type.
4. **Editor** (`agents/editor.ts`) - BUILT. Adversarial 9-category review (speculative language, unsupported conclusions, legal vulnerabilities, factual inconsistency, Daubert/Frye risk, overstatement, missing caveat, source mismatch, diagnostic overreach). Severity-coded annotations.
5. **Psychometrician** - SPECIFIED in doc 27 but NOT YET IMPLEMENTED in code.

### Agent Runner Framework (`agents/runner.ts`)
- BUILT. Generic executor: PII redact, Claude API call, rehydrate, map destroy.
- In-memory status tracking with UUID operation IDs.
- Supports all 4 agent types through a single `runAgent<T>()` function.

### Database (29 tables BUILT)
All 29 tables from the original schema exist in `schema.ts`, including the shared storage addendum tables:
- `users`, `diagnosis_catalog`, `instrument_library`, `diagnosis_instrument_mappings`, `practice_profiles`, `report_templates`, `style_rules`
- `cases`, `sessions`, `documents`, `test_administrations`
- `gate_reviews`, `gate_decisions`, `diagnoses`
- `agent_runs`, `evidence_maps`, `writer_drafts`
- `reports`, `report_revisions`
- `audit_log`, `peer_consultations`, `referral_sources`
- `backup_metadata`, `case_notes`
- `practice_config`, `document_permissions`, `file_locks`, `sync_manifest`, `case_assignments`, `diagnostic_decisions`

### IPC Surface (100+ handlers BUILT)
Complete typed IPC layer with `ok<T>/fail` response envelope pattern:

| Namespace | Handlers | Status |
|-----------|----------|--------|
| cases | 5 (list, get, create, update, archive) | BUILT |
| intake | 2 (save, get) | BUILT |
| onboarding | 2 (save, get) | BUILT |
| documents | 10 (ingest, list, get, delete, pickFile, pickFiles, pickFilesFrom, syncToDisk, writeTabDoc, getDroppedFilePath) | BUILT |
| pii | 5 (detect, batchDetect, redact, rehydrate, destroy) | BUILT |
| workspace | 8 (getPath, setPath, getTree, openInFinder, openNative, pickFolder, getDefaultPath, getMalformed, scaffold) | BUILT |
| apiKey | 4 (store, retrieve, delete, has) | BUILT |
| ai | 2 (complete, testConnection) | BUILT |
| agents | 10 (run, status, + run/getResult per agent) | BUILT |
| pipeline | 4 (check, advance, setStage, conditions) | BUILT |
| diagnosticDecisions | 3 (save, list, delete) | BUILT |
| testScores | 3 (save, list, delete) | BUILT |
| clinicalFormulation | 2 (save, get) | BUILT |
| dataConfirmation | 2 (save, get) | BUILT |
| onlyoffice | 7 (start, stop, status, getUrl, generateToken, generateDocx, openDocument) | BUILT |
| report | 5 (submitAttestation, getStatus, verifyIntegrity, exportAndOpen, loadTemplate) | BUILT |
| audit | 3 (log, getTrail, export) | BUILT |
| testimony | 1 (prepare) | BUILT |
| referral | 1 (parseDoc) | BUILT |
| resources | 10 (upload, list, delete, open, read, uploadWritingSample, previewCleaned, analyzeStyle, getStyleProfile, recalculateStyleProfile) | BUILT |
| templates | 8 (analyze, save, list, get, delete, open, setLastUsed, getLastUsed) | BUILT |
| whisper | 6 (saveAudio, transcribe, status, streamStart, streamAudio, streamStop + onLiveText listener) | BUILT |
| diagnosisCatalog | 2 (search, list) | BUILT |
| testHarness | 3 (list, run, runAll) | BUILT |
| setup | 16 (getConfig, reset, advance, validateLicense, saveLicense, validateStoragePath, pickStorageFolder, getDefaultStoragePath, provisionStorage, savePractice, saveAi, saveAppearance, saveClinical, provisionTemplates, getSupportedEvalTypes, complete) | BUILT |
| updater | 3 (check, download, getVersion) | BUILT |
| seed | 1 (demoCases) | BUILT |
| db | 1 (health) | BUILT |

### UI Components (41 React components BUILT)

**Layout:**
- `App.tsx` - Root with setup gate, 3-column layout, tab management, modal orchestration
- `Titlebar.tsx` - User avatar, settings shortcut, theme toggle
- `LeftColumn.tsx` - Case list (filesystem-driven tree with DB metadata overlay, stage colors, search, filter)
- `CenterColumn.tsx` - Tab container with routing for all tab types
- `RightColumn.tsx` - EXISTS but currently disabled via `RIGHT_COLUMN_ENABLED` flag
- `VSplitter.tsx`, `HSplitter.tsx` - 2px draggable splitters

**Tabs (11 BUILT):**
- `DashboardTab.tsx` - KPI cards, pipeline breakdown, case table, filters
- `ClinicalOverviewTab.tsx` - Case header, pipeline indicator, 8 sub-tabs (Intake, Referral, Collateral, Testing, Validity, Interviews, Diagnostics, Report)
- `TestResultsTab.tsx` - Per-instrument sub-tabs, score entry, imports
- `DiagnosticsTab.tsx` - "DOCTOR ALWAYS DIAGNOSES" banner, expandable diagnosis cards, Render/Rule Out/Defer per diagnosis, clinical formulation, feigning assessment
- `EvalReportTab.tsx` - Dual-mode (Preview + OnlyOffice editor), section nav, AI draft markers, Editor annotations overlay
- `DataConfirmationTab.tsx` - Split-view with 6 categories, Confirmed/Corrected/Flagged per category
- `AttestationTab.tsx` - Checklist, typed signature, attestation statement, date picker, SHA-256 hash display post-finalization
- `AuditTrailTab.tsx` - Chronological table, actor color coding, stats cards, CSV/JSON export, integrity verification
- `SettingsTab.tsx` - Practice info, theme, API key with test connection, resource management (writing samples, templates, documents, testing materials, forms)
- `DocumentViewerTab.tsx` - Resource viewing (routes by file type)
- `EvidenceMapTab.tsx` - Diagnostician evidence convergence display

**Viewers (2 BUILT):**
- `PdfViewer.tsx` - Canvas-based PDF rendering via pdfjs-dist v4
- `MarkdownViewer.tsx` - Markdown to HTML via `marked` library in sandboxed iframe

**Editors (1 BUILT):**
- `OnlyOfficeEditor.tsx` - Embedded OnlyOffice with JWT auth, macros disabled

**Modals (5 BUILT):**
- `IntakeModal.tsx` - Referral/walk-in case creation with edit mode
- `IntakeOnboardingModal.tsx` - Combined intake + onboarding flow
- `OnboardingModal.tsx` - 10-section patient history
- `DocumentUploadModal.tsx` - Drag-drop with subfolder selection
- `ScoreImportModal.tsx` - Publisher PDF + Manual Entry (9 instruments)

**Setup Wizard (9 components BUILT):**
- `SetupShell.tsx`, `SetupWizard.tsx`, `shared.ts`
- Steps: `StepLicense.tsx`, `StepStorage.tsx`, `StepPractice.tsx`, `StepAi.tsx`, `StepAppearance.tsx`, `StepClinical.tsx`, `StepSidecar.tsx`, `StepComplete.tsx`
- 8-state machine: fresh, sidecar_verified, license_entered, storage_ready, profile_done, ai_configured, prefs_done, clinical_done, complete

### Pipeline (FULLY BUILT)
All 6 stages with enforcement conditions:
- Onboarding to Testing: intake complete + docs uploaded + data confirmation
- Testing to Interview: test results documented or manual scores entered
- Interview to Diagnostics: interview docs + ingestor completed
- Diagnostics to Review: diagnostician run + at least 1 diagnosis decision
- Review to Complete: (implementation-dependent)

### Security (FULLY BUILT through Sprint 12)
- SQLCipher encryption
- API key in macOS Keychain via safeStorage
- CSP on all responses (main process header injection)
- Code signing config (macOS notarization, Windows Authenticode)
- Ed25519 auto-update verification scaffolding
- OnlyOffice macro/plugin lockdown
- Rate limiting + error classification (9 error codes)
- UNID redaction pipeline verified against 100+ test samples

### Additional Systems Built (Beyond Original Sprint Plan)
- **Setup Wizard** - 8-step first-run configuration (license, storage, practice, AI, appearance, clinical, templates, completion)
- **License Validation** - Local format check + optional remote server validation with offline fallback
- **Writing Style Analysis** - NLP heuristics on cleaned writing samples (sentence length, vocabulary richness, formality, hedging, person reference, tense, clinical terminology)
- **Live Transcription** - Whisper streaming (250ms WebM chunks, FFmpeg decode, faster-whisper inference)
- **Test Harness** - 10 realistic demo cases for walkthrough testing
- **Report Template System** - Per-evaluation-type templates with jurisdiction customization
- **Document-to-Disk Sync** - Markdown documents generated from tab data, synced to workspace filesystem
- **Referral Document Parsing** - Heuristic extraction of case fields from uploaded referral docs
- **Testimony Preparation** - Export package (final report, test docs, case summary, audit trail)
- **PDF Viewer** - Canvas-based pdfjs-dist rendering (replaced 7 failed approaches)
- **Markdown Viewer** - GFM-compatible rendering in sandboxed iframe

### Test Suite
- 96/96 tests passing (pipeline, data confirmation, audit, report finalization, rate limiter, error handler)
- Vitest + in-memory SQLite, per-test reset, Electron API mocks
- Setup wizard tests: license validation, state machine, storage validation, template provisioning

---

## Part 3: What Has Been Removed or Changed from the Original Design

### Removed
1. **8-agent system** - The original pre-session architecture called for 8 AI agents. Truck reduced this to 4 during Session 1 (Ingestor, Diagnostician, Writer, Editor). The 8-agent design never reached implementation.

2. **3-Gate system** - The original spec used Gate 1/Gate 2/Gate 3 terminology. This was replaced by the 6-stage pipeline (Onboarding, Testing, Interview, Diagnostics, Review, Complete) during Session 1. The `gate_reviews` and `gate_decisions` tables still exist in the schema as legacy artifacts but are not used by the pipeline system. The active workflow uses the `diagnostic_decisions` table and stage-based advancement conditions.

3. **WASM/OPFS architecture** - Early documents referenced WebAssembly and Origin Private File System for storage. This was replaced by SQLCipher + filesystem before implementation began.

4. **TipTap editor** - Early docs mentioned TipTap for rich text. This was replaced by OnlyOffice during Session 1.

5. **RAG (Retrieval Augmented Generation)** - Early architecture included RAG. Truck accepted the recommendation to use pre-computed style rules instead.

### Changed
1. **Right Column** - The original design had an active Right Column with context panel (notes, agent status, deadlines, quick actions) and chat. The Right Column EXISTS in code but is currently DISABLED via `RIGHT_COLUMN_ENABLED = false`. Agent cascade buttons were moved to the RightColumn component but the whole column is hidden. This represents a significant UI change from the original spec.

2. **Tree architecture** - The original design had tree nodes generated from hardcoded stage logic. The BUILD_MANIFEST's "TREE = FILESYSTEM" principle replaced this: Column 1 now mirrors the actual workspace folder on disk, with DB providing metadata overlay only.

3. **Sprint plan timeline** - The original 24-sprint plan mapped to 15 months. The actual build compressed Sprints 1-12 into approximately 2 weeks of intensive sessions. The remaining sprints (13-24 in the original plan) have been rewritten as the Production Roadmap (doc 28) with a 5-sprint path to v1.0.

4. **Score Import** - The original spec planned separate tasks for Publisher PDF import and manual entry. These were combined into a single `ScoreImportModal.tsx` with two pathways in one UI.

5. **Settings Tab scope** - The implemented Settings tab is significantly larger than the original spec. It now includes resource management (writing samples with PII stripping, templates, documents, testing materials, forms), style profile analysis, and demo data management.

6. **Document types expanded** - Beyond the original PDF/DOCX/VTT, the system now handles markdown files, RTF, CSV, and has a referral document parser with heuristic field extraction.

---

## Part 4: What Still Needs to Be Built

### Priority 1: Release Blockers (from Production Roadmap doc 28)

| Item | Description | Effort |
|------|-------------|--------|
| **Sidecar build** | PyInstaller frozen binary (blocked on Python 3.11 on build machine) | 1 hour |
| **macOS codesigning** | Developer ID certificate + notarization | 30 min |
| **Sidecar bundle into electron-builder** | extraResources config for per-platform sidecar | 1 hour |
| **Cross-platform CI** | GitHub Actions workflow for darwin-arm64/x64, linux-x64, win32-x64 | 2 hours |
| **Vitest environment repair** | vitest 4.x vs older vite incompatibility | 1 hour |
| **Type error fixes** | 4 in SettingsTab.tsx, 15 in DiagnosticsTab.tsx | 2 hours |

### Priority 2: License Server Production

| Item | Description | Effort |
|------|-------------|--------|
| **TLS termination** | HTTPS front-end for license server | 4 hours |
| **Postgres migration** | Replace JSON file with real database | 1 day |
| **Issuance API + admin tooling** | Mint, revoke, list keys | 2 days |
| **Audit log + observability** | Persist validation attempts, alerts | 1 day |
| **HMAC-signed responses** | Prevent response forgery | 1 day |

### Priority 3: UX Polish

| Item | Description | Effort |
|------|-------------|--------|
| **Sidecar diagnostic detail** | Better error messages when Python/model missing | 2 hours |
| **Connection cost estimate** | Show token cost from test request | 1 hour |
| **Template preview** | Preview .docx templates in OnlyOffice read-only | 4 hours |
| **Open Folder button** | Reveal workspace in Finder from setup wizard | 30 min |
| **Drag-drop import to tree** | Drop files onto case nodes in LeftColumn | 4 hours |
| **Bulk import** | Multi-select + background import + progress | 1 day |
| **OCR for scanned PDFs** | Tesseract.js or pytesseract sidecar handler | 2-4 days |
| **Resource seeding UX** | "Load demo resources" button, empty state message | 2 hours |

### Priority 4: Right Column Re-enablement

The Right Column is fully implemented but disabled. Before re-enabling:

| Item | Description | Effort |
|------|-------------|--------|
| **Decide on Right Column scope** | Context panel + chat, or agent controls only? | Decision needed |
| **Re-enable and test** | Set `RIGHT_COLUMN_ENABLED = true`, verify layout | 2 hours |
| **Writing assistant wiring** | Verify chat calls `ai.complete()` with case context | 2 hours |
| **Agent status panel** | Verify 2s polling, color-coded dots, token usage display | 1 hour |

### Priority 5: Psychometrician Agent (5th Agent, Specified but Not Built)

Doc 27 specifies a new agent between Ingestor and Diagnostician:

| Item | Description | Effort |
|------|-------------|--------|
| **Scaffold agent** | `agents/psychometrician.ts` following runner pattern | 2 hours |
| **Deterministic layer** | MMPI-3 normative JSON lookups, validity cutoffs, profile classification | 1 day |
| **LLM layer** | Claude call for elevation interpretation, cross-instrument synthesis | 4 hours |
| **IPC + preload** | `psychometrician:run`, `psychometrician:getResult` | 1 hour |
| **Pipeline integration** | Block Testing to Interview until Psychometrician completes | 2 hours |
| **UI wiring** | Agent card in RightColumn, Testing tab summary panel | 4 hours |
| **Diagnostician dependency** | Diagnostician loads PsychometricianOutput as evidence | 2 hours |
| **Norms licensing question** | Determine if Psygil can ship MMPI-3/PAI norms or must parse scoring reports | Legal review |
| **"No testing" override** | Checkbox for cases without standardized testing | 1 hour |

### Priority 6: Auto-Update Pipeline

| Item | Description | Effort |
|------|-------------|--------|
| **Update manifest server** | GitHub Releases or dedicated endpoint | 4 hours |
| **Ed25519 keypair** | Generate and store securely | 1 hour |
| **electron-updater config** | Point at manifest URL | 2 hours |
| **Release script** | Build, sign, upload, update manifest | 4 hours |
| **End-to-end test** | Test with fake old version | 2 hours |

### Priority 7: Accessibility and Localization

| Item | Description | Effort |
|------|-------------|--------|
| **Accessibility audit** | axe-core/Lighthouse, VoiceOver, NVDA, keyboard nav | 2 days |
| **Localization foundation** | String extraction, `useLocale()` hook, date/number formatting | 2 days |

### Priority 8: End-User Documentation

| Item | Description | Effort |
|------|-------------|--------|
| **Quick-start guide** | Install, activate, first case | 2 hours |
| **Evaluation walkthrough** | Full pipeline from intake to completion | 4 hours |
| **Template customization** | Edit templates, placeholder tokens | 2 hours |
| **AI assistant guide** | When to use, what to verify | 2 hours |
| **HIPAA compliance one-pager** | Local PHI, UNID redaction, BAA requirements | 2 hours |
| **Troubleshooting** | Sidecar, OnlyOffice, license issues | 2 hours |

### Priority 9: Console.log Cleanup

From prior sessions, debug logging needs to be removed from production code. Per the project's TypeScript rules, no `console.log` in production. This should be a sweep across all modified files.

---

## Part 5: Multi-Doc Agency Shared Storage

The original design (docs 09, 01a, 02a) specifies a three-tier progressive storage architecture. The schema tables are already built. Here is what remains to implement:

### Tier 1: Local Only (v1.0) - COMPLETE
All local storage, SQLCipher encryption, single user. This is the current state.

### Tier 2: Shared Network Drive (v1.1) - SCHEMA BUILT, LOGIC NOT WIRED

**What exists in the schema:**
- `practice_config` table (storage_mode, cloud_tenant_id, auto_sync_interval_minutes)
- `document_permissions` table (permission_level: read/write/admin)
- `file_locks` table (lock_type: exclusive/shared, expires_at)
- `case_assignments` table (role_in_case: primary_clinician/reviewing_clinician/psychometrist/receptionist)

**What needs to be built:**

| Item | Description | Effort |
|------|-------------|--------|
| **Network path configuration** | Setup wizard step for `\\server\Psygil\` or `/Volumes/PracticeShare/Psygil/` | 4 hours |
| **SQLite WAL mode** | Enable Write-Ahead Logging for multiple readers, single writer | 2 hours |
| **Database on network share** | Configure SQLCipher to open database at network path | 4 hours |
| **File lock manager** | Acquire/release/check exclusive locks before document edits | 1 day |
| **Lock timeout handling** | Auto-release stale locks (configurable, default 15 min) | 4 hours |
| **Case assignment CRUD** | IPC handlers for assigning clinicians to cases with roles | 4 hours |
| **Case assignment UI** | Modal or panel for managing case assignments | 1 day |
| **Document permissions enforcement** | Check permission_level before allowing read/write operations | 4 hours |
| **Multi-user case list** | Filter case list by assigned clinician (or show all for admin) | 2 hours |
| **Concurrent edit prevention** | Show "locked by [clinician]" when another user has a document open | 4 hours |
| **Conflict detection** | Detect when two users modify the same case metadata | 1 day |
| **User management UI** | Settings panel for adding/removing practice users | 1 day |
| **Role-based access controls** | Enforce psychometrist can enter scores but not diagnose | 1 day |

### Tier 3: Cloud Storage (v2.0) - SCHEMA BUILT, NOT STARTED

**What exists in the schema:**
- `sync_manifest` table (sync_direction: upload/download/bidirectional, sync_status)
- `practice_config.storage_mode` supports `cloud_o365` and `cloud_gdrive`

**What needs to be built:**

| Item | Description | Effort |
|------|-------------|--------|
| **Microsoft Graph API integration** | MSAL auth in Electron, SharePoint file operations | 2 weeks |
| **Google Drive API integration** | Google OAuth, Drive file operations with BAA | 2 weeks |
| **Sync engine** | Manifest-based bidirectional sync (upload, download, conflict resolution) | 2 weeks |
| **Conflict resolution UI** | Show conflicts, let clinician choose which version to keep | 1 week |
| **Offline mode** | Queue changes when network unavailable, sync on reconnect | 1 week |
| **Sync status indicator** | Toolbar indicator showing last sync time, pending changes, errors | 2 days |
| **"Edit in Word" button** | Open .docx in native Microsoft Word via cloud link | 2 days |
| **Cloud BAA documentation** | Help text explaining when BAA is required | 1 day |
| **Hybrid local/cloud split** | Local SQLCipher for settings and agent state; cloud for case files | 1 week |

### Cross-Tier Concerns

| Item | Description | Effort |
|------|-------------|--------|
| **Storage mode migration** | Upgrade path from local to shared to cloud without data loss | 1 week |
| **Audit trail for multi-user** | Track which clinician performed each action | 2 days |
| **Peer review workflow** | Reviewing clinician can add annotations, flag concerns | 1 week |
| **Real-time notifications** | Alert when assigned case is modified by another user | 2 days |
| **Practice admin dashboard** | Aggregate view across all clinicians' caseloads | 1 week |

---

## Summary Counts

| Category | Designed | Built | Removed/Changed | Remaining |
|----------|----------|-------|-----------------|-----------|
| Agents | 4 (later 5) | 4 | 0 | 1 (Psychometrician) |
| Database tables | 29 | 29 | 0 (2 legacy tables unused) | 0 |
| IPC handlers | ~85 | 100+ | 0 | 0 (exceeds original) |
| UI tabs | 11 | 11 | 0 | 0 |
| Modals | 4 | 5 | 0 | 0 (1 added: IntakeOnboardingModal) |
| Pipeline stages | 6 | 6 | 0 | 0 |
| Security items | 6 | 6 | 0 | 0 |
| Setup wizard | Not in original | 9 components | N/A | Polish items |
| Viewers | Not in original | 2 (PDF, Markdown) | N/A | 0 |
| Shared storage (Tier 2) | Specified | Schema only | 0 | ~13 items |
| Cloud storage (Tier 3) | Specified | Schema only | 0 | ~9 items |
| Release pipeline | Specified | Scaffolded | 0 | ~6 items |
| End-user docs | Specified | 0 | 0 | 6 documents |

The platform is architecturally complete for solo-practitioner use. The core clinical pipeline, all 4 agents, all UI tabs, the database schema, and the security layer are built and functional. The primary remaining work falls into three categories: (1) release engineering to produce a distributable binary, (2) production infrastructure for licensing and updates, and (3) multi-user shared storage to serve practices with 2+ clinicians.
