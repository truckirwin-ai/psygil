# BUILD MANIFEST — Psygil (Psygil) MVP
# This file is the single source of truth for build execution.
# EVERY session, EVERY sub-agent, EVERY task MUST read this file first.
# Last updated: 2026-03-27 (Fang audit — Sprints 1+2 marked complete, Sprint 3 active)

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

**Sprint:** 6
**Goal:** AI Agent Pipeline — Ingestor, Diagnostician, Writer, Editor wired to live case data
**Dates:** Started 2026-03-29

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

### Sprint 6 Tasks 🔄 IN PROGRESS (AI Agent Pipeline)
| # | Task | Status | Assigned To | Notes |
|---|------|--------|-------------|-------|
| 6.1 | Agent runner framework | ✅ DONE | 2026-03-29 | runner.ts: AgentConfig → PII redact → Claude API → rehydrate → destroy map → AgentResult. agent-handlers.ts: IPC agent:run + agent:status. TS errors fixed (AgentType alignment). |
| 6.2 | Ingestor Agent | ✅ DONE | 2026-03-29 | ingestor.ts: gathers docs + case metadata → builds spec-compliant input payload → runAgent('ingestor') → saves IngestorOutput to agent_results table. IPC: ingestor:run + ingestor:getResult. Preload wired. |
| 6.3 | Diagnostician Agent | ✅ DONE | 2026-03-29 | diagnostician.ts: loads ingestor result → evidence-to-criteria mapping → DOCTOR DECIDES (AI presents, never selects). Saves to agent_results. |
| 6.4 | Writer Agent | ✅ DONE | 2026-03-29 | writer.ts: loads ingestor + diagnostician results → only CLINICIAN-CONFIRMED diagnoses → draft report sections. Saves to agent_results. |
| 6.5 | Editor/Legal Agent | ✅ DONE | 2026-03-29 | editor.ts: loads writer draft → 9-point review (speculative language, unsupported conclusions, Daubert/Frye risks, etc.) → annotation set with severity levels. Saves to agent_results. |
| 6.6 | Agent status panel in RightColumn | ✅ DONE | 2026-03-29 | Live agent status: 2s polling, color-coded dots (green/orange/gray/red), elapsed time, token usage. "Run Ingestor" button disabled while agents running. |
| 6.7 | Pipeline stage advancement | ✅ DONE | 2026-03-29 | pipeline/index.ts: checkStageAdvancement + advanceStage + getStageConditions. 6-stage conditions enforced (intake→docs→tests→ingestor→diagnostician→writer+editor+attestation). IPC: pipeline:check/advance/conditions. Preload wired. Legacy stage names handled. |

### Sprint 7–12 Tasks
[Populated when Sprint 6 agents are functional]

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
