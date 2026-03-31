# BUILD MANIFEST — Psygil (Psygil) MVP
# This file is the single source of truth for build execution.
# EVERY session, EVERY sub-agent, EVERY task MUST read this file first.
# Last updated: 2026-03-29 (Sprint 12 complete — security hardening + 96/96 tests passing)

---

## EXECUTION RULES (NON-NEGOTIABLE)

### Rule 1: Read Before You Write
Before writing ANY code, read:
1. This manifest (current task, acceptance criteria, constraints)
2. The relevant spec section from `docs/engineering/11_MVP_Scope_Architecture_Spec.docx`
3. The relevant existing engineering doc (schema, IPC contracts, agent prompts, etc.)

### Rule 2: Stay In Your Lane
Each task has a SCOPE BOUNDARY. If you encounter a problem outside that boundary:
- DO NOT fix it
- DO NOT refactor around it
- Log it in the BLOCKERS section below
- Move on or stop and report

### Rule 3: Check Out Before Moving On
After completing any task, before starting the next:
1. Re-read this manifest
2. Verify your output matches the acceptance criteria listed for your task
3. Run the relevant tests
4. Update the task status below
5. Do NOT start the next task if the current one doesn't pass its acceptance criteria

### Rule 4: No Scope Creep
If something "would be nice" or "should probably also" — STOP. Check if it's in the spec.
- If it's in the spec for THIS sprint: do it
- If it's in the spec for a LATER sprint: don't touch it
- If it's NOT in the spec at all: don't touch it, log it in DEFERRED IDEAS below

### Rule 5: Time-Box Problem Solving
If you've spent more than 15 minutes (or ~10 conversation turns) on a single error:
- STOP
- Document the error, what you tried, and what failed
- Log it as a BLOCKER
- Move to the next task or stop and report to Truck

### Rule 6: The Spec Wins
If your code works but contradicts the spec, the code is wrong.
If the spec seems wrong, STOP and flag it for Truck. Do not "fix" the spec by writing different code.

---

## ARCHITECTURAL PRINCIPLES (ALWAYS ENFORCE)

- **THE DOCTOR ALWAYS DIAGNOSES** — AI never selects, recommends, or auto-accepts diagnoses
- **6-STAGE PIPELINE** — Onboarding → Testing → Interview → Diagnostics → Review → Complete (replaces old Gate 1/2/3 system)
- **NO ACCEPT ALL** — Diagnostics stage requires individual diagnostic decisions
- **TREE = FILESYSTEM** — Column 1 tree mirrors the actual workspace folder on disk. DB provides metadata overlay (colors, labels) ONLY. Never build tree from hardcoded stage logic. See LeftColumn.tsx header comment.
- **UNID REDACTION** — Every text sent to Claude API must pass through the UNID pipeline first; single-use UNIDs replace all PHI, maps destroyed after each operation (see doc 15)
- **LOCAL-FIRST PHI** — All patient data encrypted locally in SQLCipher; only UNID-redacted text leaves the app; reports are NEVER redacted
- **AUDIT EVERYTHING** — Every case action logged with timestamp and user
- **4 PROCESSES** — Electron Main, Renderer (sandboxed), OnlyOffice (local server), Python Sidecar
- **7 CSS TOKENS** — --bg, --panel, --border, --text, --text-secondary, --accent, --highlight
- **SPLITTERS ARE 2PX** — Not 4px, not 3px, not "auto"
- **PIPELINE STAGE COLORS** — Onboarding=#2196f3, Testing=#9c27b0, Interview=#e91e63, Diagnostics=#ff9800, Review=#ff5722, Complete=#4caf50

---

## CURRENT SPRINT

**Sprint:** 12 ✅ COMPLETE
**Goal:** Security Hardening — CSP, code signing, dependency audit, auto-update with Ed25519 verification, OnlyOffice lockdown
**Completed:** 2026-03-29

---

## TASK QUEUE

### Sprint 1 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 1.1 | Electron scaffold with Vite bundling | ✅ DONE | Pre-2026-03-27 | electron-vite, 4-process architecture, psygil:// protocol registered |
| 1.2 | SQLCipher database with Drizzle ORM | ✅ DONE | Pre-2026-03-27 | 29 tables (schema.ts), migrate.ts (920 lines), migrations/index.ts, psygil.db exists, better-sqlite3-multiple-ciphers |
| 1.3 | Auth0 PKCE login flow | ✅ DONE | Pre-2026-03-27 | auth/login.ts (full PKCE), logout.ts, auth0-config.ts, user.ts, safeStorage for tokens |
| 1.4 | Three-column layout from v4 prototype | ✅ DONE | Pre-2026-03-27 | LeftColumn (602L), CenterColumn (308L), RightColumn (267L), VSplitter (2px), HSplitter, Titlebar, Statusbar, 3 themes, persistent widths |
| 1.5 | contextBridge + typed IPC preload | ✅ DONE | Pre-2026-03-27 | preload/index.ts (114L), full typed API: cases, intake, onboarding, db, auth, config, documents, pii, workspace — nodeIntegration=false, contextIsolation=true |
| 1.6 | Sprint 1 integration test | ⚠️ PARTIAL | — | App structure complete; formal integration test suite not yet written |

### Sprint 2 Tasks ✅ LARGELY COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 2.1 | Python sidecar JSON-RPC server | ✅ DONE | Pre-2026-03-27 | sidecar/server.py (271L), asyncio Unix socket, JSON-RPC 2.0, Presidio + spaCy init |
| 2.2 | Presidio + spaCy PII detection | ✅ DONE | Pre-2026-03-27 | pii/pii_detector.ts (117L) + sidecar/server.py; Presidio AnalyzerEngine with en_core_web_lg |
| 2.3 | Sidecar lifecycle management | ✅ DONE | Pre-2026-03-27 | main/sidecar/index.ts (137L) — spawn, health check, auto-restart, graceful shutdown |
| 2.4 | PyInstaller frozen build | ⚠️ NOT STARTED | — | requirements.txt exists, test_server.py exists; PyInstaller bundle not built |
| 2.5 | PII integration tests | ⚠️ NOT STARTED | — | test_server.py exists but full 50+ test corpus not written |

### Sprint 3 Tasks 🔄 IN PROGRESS

| # | Task | Status | Assigned To | Notes |
|---|------|--------|-------------|-------|
| 3.1 | Case CRUD | ✅ DONE | — | main/cases/index.ts (278L) — createCase, listCases, getCaseById, archiveCase, saveIntake, getIntake, saveOnboardingSection, getOnboardingSections; disk folder structure (7 subfolders) |
| 3.2 | Document upload + text extraction | ✅ DONE | — | main/documents/index.ts (217L) — PDF (pdf-parse) + DOCX (mammoth) + plaintext; files stay on disk, metadata+text in DB |
| 3.3 | Case explorer tree component | ⚠️ PARTIAL | — | LeftColumn.tsx (602L) exists with tree UI; verify stage-appropriate buildTreeData() logic wired to live cases |
| 3.4 | Tab management system | ✅ DONE | — | App.tsx tabState, openTab/closeTab/setActiveTab, CenterColumn renders tabs with open/close/switch |
| 3.5 | File storage in SQLCipher | ✅ DONE | — | Documents stored as metadata+text in encrypted DB; files live on disk per workspace architecture doc 26 |
| 3.6 | Intake form modal UI component | ✅ DONE | — | IntakeModal.tsx (410L) — referral/walk-in toggle, all fields, draft save |
| 3.7 | patient_intake table migration | ✅ DONE | — | In schema.ts + migrate.ts; full columns, constraints, draft/complete status |
| 3.8 | Onboarding form modal UI component | ✅ DONE | — | OnboardingModal.tsx (440L) — 10 sections, mode toggle, save works |
| 3.9 | patient_onboarding table migration | ✅ DONE | — | In schema.ts + migrate.ts; clinician note fields, status workflow |
| **3.10** | **Wire case tree to live DB data** | **✅ DONE** | 2026-03-27 | LeftColumn fetches real cases via window.psygil.cases.list; tree nodes open tabs with real case IDs |
| **3.11** | **Case creation flow (New Case button → Intake → open case)** | **✅ DONE** | 2026-03-27 | "+" in LeftColumn + Titlebar → IntakeModal (create mode) → cases.create() → refresh tree → open Overview tab; IntakeModal now supports both create and edit modes via optional caseId prop |
| **3.12** | **Clinical Overview tab content** | **✅ DONE** | 2026-03-27 | ClinicalOverviewContent replaced: real header (name, case#, eval type, stage pill, referral, date); 6 sub-tabs (Intake, Referral, Testing, Interviews, Diagnostics, Reports); Intake shows real data or "No intake data yet"; Edit on Intake opens IntakeModal pre-populated; other Edit buttons console.log placeholder |
| **3.13** | **Wire case click → open Clinical Overview tab** | **✅ DONE** | 2026-03-27 | CaseNode chevron→expand/collapse only; name/stage area→opens overview:caseId tab; no duplicate tabs (openTab deduplicates by id) |

### Sprint 4 Tasks ✅ COMPLETE
| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 4.1 | PII pipeline integration (UNID) | ✅ DONE | 2026-03-29 | sidecar: pii/redact, pii/rehydrate, pii/destroy. TS client: redact(), rehydrate(), destroyMap(). IPC + preload wired. Crypto-random UNIDs, in-memory maps, proper destruction. |
| 4.2 | Claude API integration | ✅ DONE | 2026-03-29 | ai/claude-client.ts: native fetch, TLS enforced, typed responses. ai-handlers.ts: ai:complete + ai:testConnection IPC. No external deps. |
| 4.3 | API key in macOS Keychain | ✅ DONE | 2026-03-29 | ai/key-storage.ts: safeStorage encrypt/decrypt, file at userData/psygil-api-key.enc. IPC: apiKey:store/retrieve/delete/has. Preload wired. |
| 4.4 | De-identification verification | ✅ DONE | 2026-03-29 | test_deidentification.py: 46 pytest tests. test_corpus.py: 44 samples, 226 PHI entities. Covers all 18 HIPAA types, rehydration, map lifecycle, edge cases. |
| 4.5 | Rate limiting + error handling | ✅ DONE | 2026-03-29 | rate-limiter.ts: exponential backoff + sliding window. error-handler.ts: 9 error codes with user-facing messages. request-logger.ts: in-memory ring buffer. 32 unit tests. |
| 4.6 | GO/NO-GO gate harness | ✅ DONE | 2026-03-29 | gate_verification.py: standalone runner. gold_standard_corpus.py: 100 samples, 604 PHI entities across 7 forensic domains. Measures recall + FP rate. JSON + terminal output. |

### Sprint 5 Tasks ✅ COMPLETE (UI MVP)
| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 5.1 | Dashboard tab component | ✅ DONE | 2026-03-29 | KPI cards, pipeline breakdown, case table with row-click navigation. Pinned as permanent first tab. |
| 5.2 | Clinical Overview tab rewrite | ✅ DONE | 2026-03-29 | Case header, pipeline progress indicator, 8 sub-tabs (Intake/Referral/Collateral/Testing/Validity/Interviews/Diagnostics/Report) |
| 5.3 | Test Results tab | ✅ DONE | 2026-03-29 | Sub-tabs per instrument (MMPI-3, PAI, WAIS-V, TOMM, SIRS-2), score tables, interpretations |
| 5.4 | Diagnostics tab | ✅ DONE | 2026-03-29 | Red "DOCTOR ALWAYS DIAGNOSES" banner, individual accept/reject, clinical formulation, feigning assessment |
| 5.5 | Eval Report tab | ✅ DONE | 2026-03-29 | Word processor layout with toolbar, page ruler, AI draft sections (orange dashed border) |
| 5.6 | Attestation tab | ✅ DONE | 2026-03-29 | Completion checklist, digital signature, submit gated on all items |
| 5.7 | Audit Trail tab | ✅ DONE | 2026-03-29 | Chronological event table, actor ID (clinician/AI/system), status dots |
| 5.8 | Settings tab | ✅ DONE | 2026-03-29 | Practice info, theme control, API key mgmt with test connection |
| 5.9 | Document Viewer + Evidence Map tabs | ✅ DONE | 2026-03-29 | Collateral/interview viewer, evidence convergence display |
| 5.10 | Pipeline Panel component | ✅ DONE | 2026-03-29 | Bottom bar shows current stage with ✓/●/○ indicators |
| 5.11 | LeftColumn rewrite as clinical tree | ✅ DONE | 2026-03-29 | Stage-appropriate children, stage color circles, filter dropdown (stage + eval type) |
| 5.12 | RightColumn with AI writing assistant | ✅ DONE | 2026-03-29 | Context panel (notes, agent status, deadlines, quick actions) + chat that calls ai.complete() |
| 5.13 | Full CenterColumn integration | ✅ DONE | 2026-03-29 | All 11 tab components routed, tab type definitions updated, App.tsx props wired |
| 5.14 | Dashboard pinned + filter UX | ✅ DONE | 2026-03-29 | Dashboard always open, no close button, stage circles in tree, CASES filter dropdown |
| 5.15 | Tree-filesystem sync fix | ✅ DONE | 2026-03-29 | LeftColumn rewritten: tree now reads from workspace.getTree() (real filesystem) with DB as metadata overlay. Chokidar auto-refresh wired. Enforcement comments added. |

### Sprint 6 Tasks ✅ COMPLETE (AI Agent Pipeline)
| # | Task | Status | Assigned To | Notes |
|---|------|--------|-------------|-------|
| 6.1 | Agent runner framework | ✅ DONE | 2026-03-29 | runner.ts: AgentConfig → PII redact → Claude API → rehydrate → destroy map → AgentResult. agent-handlers.ts: IPC agent:run + agent:status. TS errors fixed (AgentType alignment). |
| 6.2 | Ingestor Agent | ✅ DONE | 2026-03-29 | ingestor.ts: gathers docs + case metadata → builds spec-compliant input payload → runAgent('ingestor') → saves IngestorOutput to agent_results table. IPC: ingestor:run + ingestor:getResult. Preload wired. |
| 6.3 | Diagnostician Agent | ✅ DONE | 2026-03-29 | diagnostician.ts: loads ingestor result → evidence-to-criteria mapping → DOCTOR DECIDES (AI presents, never selects). Saves to agent_results. |
| 6.4 | Writer Agent | ✅ DONE | 2026-03-29 | writer.ts: loads ingestor + diagnostician results → only CLINICIAN-CONFIRMED diagnoses → draft report sections. Saves to agent_results. |
| 6.5 | Editor/Legal Agent | ✅ DONE | 2026-03-29 | editor.ts: loads writer draft → 9-point review (speculative language, unsupported conclusions, Daubert/Frye risks, etc.) → annotation set with severity levels. Saves to agent_results. |
| 6.6 | Agent status panel in RightColumn | ✅ DONE | 2026-03-29 | Live agent status: 2s polling, color-coded dots (green/orange/gray/red), elapsed time, token usage. "Run Ingestor" button disabled while agents running. |
| 6.7 | Pipeline stage advancement | ✅ DONE | 2026-03-29 | pipeline/index.ts: checkStageAdvancement + advanceStage + getStageConditions. 6-stage conditions enforced (intake→docs→tests→ingestor→diagnostician→writer+editor+attestation). IPC: pipeline:check/advance/conditions. Preload wired. Legacy stage names handled. |

### Sprint 7 Tasks ✅ COMPLETE (Wire Agent Pipeline to Live UI)
**Goal:** Connect all 4 agent backends to the existing UI tab shells so data flows end-to-end: Ingestor output → Clinical Overview, Diagnostician output → DiagnosticsTab, Writer output → EvalReportTab, Editor output → annotations. Add diagnostic decision persistence (the DOCTOR ALWAYS DIAGNOSES UI).

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 7.1 | Ingestor output → Clinical Overview wiring | ✅ DONE | 2026-03-29 | ClinicalOverviewTab.tsx full rewrite (~550 lines): proper React JSX, loads IngestorOutput via getResult(), sub-tabs: Intake, Referral, Collateral, Testing, Interviews, Timeline, Completeness, Diagnostics, Report. Falls back to basic data when no ingestor output. |
| 7.2 | Diagnostician output → DiagnosticsTab wiring | ✅ DONE | 2026-03-29 | DiagnosticsTab.tsx full rewrite (~450 lines): loads DiagnosticianOutput, expandable diagnosis cards with criteria badges (met/not_met/insufficient_data), evidence, differentials, psycholegal analysis, functional impairment. Render/Rule Out/Defer per diagnosis — NO ACCEPT ALL. |
| 7.3 | Diagnostic decision persistence | ✅ DONE | 2026-03-29 | New decisions/ module: diagnostic_decisions table (SQLite), CRUD (save/list/delete), IPC handlers registered. DiagnosticsTab loads saved decisions on mount, saves on clinician action, deletes on clear. Pipeline can check decisions exist. |
| 7.4 | Writer output → EvalReportTab wiring | ✅ DONE | 2026-03-29 | EvalReportTab.tsx full rewrite (~450 lines): loads WriterOutput sections, section nav sidebar, draft indicators (orange dots), AI draft sections with orange dashed border + "AI DRAFT — CLINICIAN REVIEW REQUIRED" label, sources + confidence per section. |
| 7.5 | Editor output → annotation overlay | ✅ DONE | 2026-03-29 | Combined with 7.4 in EvalReportTab: loads EditorOutput, review banner with flag counts by severity, inline annotations under each section with severity-colored borders, dismiss button per annotation, revision priorities section. |
| 7.6 | Agent cascade triggers in RightColumn | ✅ DONE | 2026-03-29 | RightColumn rewrite: 4 agent run buttons (Ingestor→Diagnostician→Writer→Editor) with prerequisite checks. Each button enabled only when prior agent has persisted results. Result presence checked via getResult() on case change + after agent completion. |
| 7.7 | Pipeline stage advancement UI | ✅ DONE | 2026-03-29 | PipelinePanel upgraded: "Advance to [Next Stage] →" button. Calls pipeline:check first — shows reason if blocked. Confirm/Cancel inline dialog. On success, calls onStageAdvanced callback to refresh case data. CenterColumn passes caseId + onRefreshCases. |

### Sprint 8 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 8.1 | Drag-and-drop document upload modal | ✅ DONE | 2026-03-29 | DocumentUploadModal.tsx (~380 lines): drag-and-drop via webUtils.getPathForFile() (Electron 33 sandboxed renderer), native file picker fallback, per-file subfolder selector (7 subfolders), batch upload with sequential processing + status tracking. |
| 8.2 | Score import modal (Publisher PDF + Manual Entry) | ✅ DONE | 2026-03-29 | ScoreImportModal.tsx (~550 lines): two pathways — Publisher PDF (file picker → Testing subfolder → prompts Ingestor run) and Manual Entry (9 instruments incl. "Other", date picker, clinical scales table, validity indicators table, notes). Combined tasks 8.2+8.4. |
| 8.3 | Ingestor prompt enhanced for Q-Global/PARiConnect | ✅ DONE | 2026-03-29 | ingestor.ts system prompt updated with specific scale-by-scale extraction for MMPI-3, PAI, WAIS-V, TOMM, SIRS-2. mapDocType() enhanced with filePath param to detect Testing subfolder → test_score_report. |
| 8.4 | Manual test score entry form | ✅ DONE | 2026-03-29 | Combined with 8.2. ScoreTable sub-component: dynamic add/remove rows, scaleName + rawScore + tScore + percentile + classification per row. |
| 8.5 | Re-ingest workflow | ✅ DONE | 2026-03-29 | No new code needed — existing architecture supports re-running (each run creates new agent_results row, getLatest reads most recent, "Re-run" button already in cascade UI). |

### Sprint 9 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 9.1 | Data Confirmation split-view tab | ✅ DONE | 2026-03-29 | DataConfirmationTab.tsx (~480 lines): left panel = source document text with selector, right panel = extracted data with confirmation controls. 6 data categories with per-category Confirmed/Corrected/Flagged status. ExtractedDataDisplay recursively renders JSON as readable cards. |
| 9.2 | Confirm/Correct/Flag workflow per category | ✅ DONE | 2026-03-29 | Combined with 9.1. ConfirmationControls: 3 status buttons + notes textarea. "Ready to Advance" indicator when all required categories (Demographics, Referral Questions) confirmed. State persisted to SQLite via IPC. |
| 9.3 | Manual behavioral observation entry | ✅ DONE | 2026-03-29 | Combined with 9.1. BehavioralObservationsPane includes manual observation textarea for clinician to add observations not captured in transcripts. |
| 9.4 | Pipeline gate: block advance past Onboarding until confirmed | ✅ DONE | 2026-03-29 | data-confirmation.ts module: saveDataConfirmation/getDataConfirmation/isDataConfirmationComplete. IPC handlers + preload + types wired. Pipeline onboarding condition checks isDataConfirmationComplete() — blocks advancement if required categories not confirmed/corrected. DataConfirmationTab saves to DB via IPC. |

### Sprint 10 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 10.1 | OnlyOffice Document Server lifecycle manager | ✅ DONE | 2026-03-29 | onlyoffice/index.ts (291 lines): Docker container orchestration (psygil-onlyoffice on port 9980), JWT auth with safeStorage, health polling (2s interval, 120s timeout), start/stop/status/getUrl. No external JWT dependency — built-in crypto HMAC-SHA256. |
| 10.2 | DOCX generation from Writer Agent output | ✅ DONE | 2026-03-29 | onlyoffice/docx-generator.ts (358 lines): WriterOutput → .docx via docx package. Professional title page, H1/H2 section hierarchy, AI DRAFT markers (yellow highlight) on draft_requiring_revision sections, sources as italic footnotes, Editor annotations appendix with severity-coded flags. Versioned drafts (draft_v1.docx, draft_v2.docx). |
| 10.3 | OnlyOffice IPC handlers + preload + types | ✅ DONE | 2026-03-29 | 7 IPC handlers: start, stop, status, getUrl, generateToken, generateDocx, openDocument. Preload onlyoffice namespace wired. Full type definitions in ipc.ts. Response envelope pattern (ok/fail). |
| 10.4 | OnlyOffice editor component (iframe embed) | ✅ DONE | 2026-03-29 | editors/OnlyOfficeEditor.tsx (403 lines): Dynamic API script loading, DocsAPI.DocEditor initialization with JWT auth, desktop mode, comments + review enabled, autosave, editor destroy on unmount. Server status detection with "Start Server" fallback button. |
| 10.5 | Replace EvalReportTab with dual-mode editor | ✅ DONE | 2026-03-29 | EvalReportTab.tsx full rewrite (947 lines): dual-mode — Preview (existing HTML renderer) and Editor (OnlyOffice iframe). "Generate DOCX" button creates report from Writer+Editor agent outputs. Mode toggle. 75/25 split layout (editor/sidebar). Section nav + editor flags summary in right sidebar. Existing HTML preview preserved as ReportPreview sub-component. |
| 10.6 | Track changes + Editor Agent comments | ✅ DONE | 2026-03-29 | docx-generator inserts Editor annotations as Word comments with severity color coding (critical/high/medium/low). OnlyOffice config enables track changes + comments. Review mode available for clinician to accept/reject AI edits. |

### Sprint 11 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 11.1 | Gate 3 flag review wired to real Editor Agent output | ✅ DONE | 2026-03-29 | AttestationTab checklist now validates real data: tests via documents.list, interviews via documents, diagnostics via diagnosticDecisions.list, report via writer.getResult, Daubert via editor.getResult. Pipeline bug fixed: review stage now queries audit_log (was incorrectly querying non-existent case_audit_log). |
| 11.2 | Attestation with digital signature capture | ✅ DONE | 2026-03-29 | AttestationTab.tsx full rewrite (748 lines): typed signature input, editable attestation statement with default template, date picker. submitAttestation IPC → reports/index.ts validates review stage, copies final draft, generates PDF, computes SHA-256, locks report, logs to audit_log. Post-finalization: read-only state with hash display. |
| 11.3 | Report lock + SHA-256 hash + sealed PDF generation | ✅ DONE | 2026-03-29 | reports/index.ts (355 lines): SHA-256 via crypto.createHash on final DOCX, stored in reports.integrity_hash. PDF via LibreOffice headless CLI (soffice --convert-to pdf) with graceful fallback. reports.is_locked=1 after signing. verifyIntegrity() recomputes hash for forensic verification. |
| 11.4 | Comprehensive audit trail logging | ✅ DONE | 2026-03-29 | audit/index.ts (139 lines): logAuditEntry inserts to audit_log table with actor type/id, action_type, details JSON. getAuditTrail returns chronological entries. exportAuditTrail generates CSV or JSON. AuditTrailTab.tsx rewrite (523 lines): real IPC data, 10s auto-refresh, actor color coding, stats cards, CSV/JSON export as blob downloads, integrity verification button. |
| 11.5 | Testimony preparation export | ✅ DONE | 2026-03-29 | testimony/index.ts (160 lines): prepareTestimonyPackage creates exports/testimony_{date}/ directory, collects final report (DOCX+PDF), test score docs, generates case_summary.md (metadata + diagnoses + top 10 audit entries), exports audit trail CSV. AttestationTab has "Prepare Testimony" button post-finalization. |

### Sprint 12 Tasks ✅ COMPLETE

| # | Task | Status | Completed | Notes |
|---|------|--------|-----------|-------|
| 12.1 | Content Security Policy (CSP) | ✅ DONE | 2026-03-29 | index.html: comprehensive CSP (default-src 'self', script-src 'self', connect-src Anthropic API + OnlyOffice, frame-src localhost:9980, object-src 'none', form-action 'none', frame-ancestors 'none'). Main process: session.webRequest.onHeadersReceived injects CSP headers on all responses. |
| 12.2 | Code signing (macOS + Windows) | ✅ DONE | 2026-03-29 | electron-builder.yml: multi-platform config (macOS dmg/zip arm64+x64, Windows NSIS x64, Linux AppImage/deb). entitlements.mac.plist: hardened runtime. scripts/notarize.js: Apple notarization via @electron/notarize. scripts/sign-win.js: Authenticode via signtool. All env-var driven for CI. |
| 12.3 | Dependency audit in CI | ✅ DONE | 2026-03-29 | scripts/audit-deps.sh: npm audit + pip-audit/safety for Python sidecar. .github/workflows/security-audit.yml: runs on push/PR/weekly schedule. Validates Electron security settings (contextIsolation, nodeIntegration, CSP). |
| 12.4 | Auto-update with Ed25519 verification | ✅ DONE | 2026-03-29 | updater/index.ts: checks update server for manifest, downloads binary, verifies SHA-256 hash + Ed25519 signature before install. No external JWT/crypto deps. Periodic check (30s delay, 4hr interval). IPC handlers: check/download/getVersion. |
| 12.5 | OnlyOffice macro/plugin lockdown | ✅ DONE | 2026-03-29 | Container env: WOPI_ENABLED=false. getSecureEditorConfig(): macros=false, macrosMode='disable', plugins=false, fillForms=false. OnlyOfficeEditor.tsx applies lockdown in DocsAPI config. openDocument handler merges secure config. |

### Test Suite ✅ 96/96 PASSING

| Module | Tests | Coverage |
|--------|-------|----------|
| Pipeline stage advancement | 24 | All 6 stages, 15 gates, full lifecycle Onboarding→Complete |
| Data confirmation gate | 16 | Save/get/upsert, required category validation, status combos |
| Audit trail | 14 | Log/query/export (CSV+JSON), actor mapping, ordering |
| Report finalization | 10 | Status tracking, integrity hash, version management, transitions |
| AI rate limiter + error handler | 32 | Pre-existing tests (retry, classification, logging) |

Infrastructure: Vitest + in-memory SQLite (sql.js adapter), full schema, per-test reset, Electron API mocks.

---

## BLOCKERS
<!-- Log problems that are outside current task scope -->
<!-- Format: [Date] [Task #] Description of blocker -->

(none yet)

---

## DEFERRED IDEAS
<!-- Things that "would be nice" but are NOT in the current sprint spec -->
<!-- Format: [Date] [Suggested by] Idea description → Earliest possible sprint -->

- [2026-03-21] [Practice Leader / Truck] **Patient Portal UI** — Clean, simplified intake/onboarding interface for patient self-service (waiting room kiosk or emailed link). Separate from practice IDE. → Post-MVP or Sprint 10+

---

## COMPLETED TASKS
<!-- Move tasks here when done, with completion date -->

### Pre-Sprint: UI Prototype & Design (March 21, 2026)

| # | Task | Completed | Notes |
|---|------|-----------|-------|
| P.1 | 50-case forensic psychology database (CASE_DB) | 2026-03-21 | 50 cases with full metadata: eval type, complaint, diagnosis status, severity, test batteries, demographics |
| P.2 | Data-driven dashboard with KPI cards | 2026-03-21 | 4 summary KPIs + 6 pipeline stage breakdown cards, all computed from CASE_DB |
| P.3 | 6-stage clinical pipeline (renamed from Gate 1/2/3) | 2026-03-21 | Onboarding→Testing→Interview→Diagnostics→Review→Complete with stage-specific colors |
| P.4 | Stage-appropriate document trees | 2026-03-21 | buildTreeData() generates case folder contents matching pipeline stage. 8 content generators. |
| P.5 | Clinical Overview with tabbed summaries | 2026-03-21 | Overview shows header + dynamic tabs (Intake, Referral, Collateral, Testing, etc.) with Edit buttons that open full forms |
| P.6 | UI Design Lock document (13_UI_Design_Lock_v4.md) | 2026-03-21 | 15-section comprehensive reference locking every UI decision for engineering handoff |

---

## SUB-AGENT INSTRUCTIONS

When spawning a sub-agent for any task, include this preamble in the agent prompt:

```
BEFORE WRITING ANY CODE:
1. Read /mnt/Psygil/BUILD_MANIFEST.md — find your assigned task and acceptance criteria
2. Read the spec reference listed for your task (especially 13_UI_Design_Lock_v4.md for any UI work)
3. Your scope is ONLY the task assigned. Do not fix, refactor, or improve anything outside your task boundary.
4. If you hit a blocker, document it and stop. Do not work around it.
5. When done, verify your output against the acceptance criteria.
6. The pipeline is: Onboarding → Testing → Interview → Diagnostics → Review → Complete. Never use "Gate 1/2/3" terminology.
```

---

## SESSION STARTUP CHECKLIST

At the start of every new conversation/session:
1. Read BUILD_MANIFEST.md (this file)
2. Read CLAUDE.md (project context)
3. Check: what sprint are we in? What tasks are NOT STARTED or IN PROGRESS?
4. Ask Truck: "We're in Sprint [X]. Next task is [Y]. Ready to proceed?"
5. Do NOT start coding until Truck confirms
