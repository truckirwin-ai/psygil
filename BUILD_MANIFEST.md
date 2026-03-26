# BUILD MANIFEST — Psygil (Psygil) MVP
# This file is the single source of truth for build execution.
# EVERY session, EVERY sub-agent, EVERY task MUST read this file first.
# Last updated: 2026-03-21 (Session 2 — Pipeline rename, stage-appropriate docs, overview tabs)

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
- **STAGE-APPROPRIATE DOCUMENTS** — Case tree contents match pipeline stage; documents only appear at the stage they're created
- **UNID REDACTION** — Every text sent to Claude API must pass through the UNID pipeline first; single-use UNIDs replace all PHI, maps destroyed after each operation (see doc 15)
- **LOCAL-FIRST PHI** — All patient data encrypted locally in SQLCipher; only UNID-redacted text leaves the app; reports are NEVER redacted
- **AUDIT EVERYTHING** — Every case action logged with timestamp and user
- **4 PROCESSES** — Electron Main, Renderer (sandboxed), OnlyOffice (local server), Python Sidecar
- **7 CSS TOKENS** — --bg, --panel, --border, --text, --text-secondary, --accent, --highlight
- **SPLITTERS ARE 2PX** — Not 4px, not 3px, not "auto"
- **PIPELINE STAGE COLORS** — Onboarding=#2196f3, Testing=#9c27b0, Interview=#e91e63, Diagnostics=#ff9800, Review=#ff5722, Complete=#4caf50

---

## CURRENT SPRINT

**Sprint:** 1
**Goal:** Electron Shell + Database + Auth
**Dates:** [TBD]

---

## TASK QUEUE

### Sprint 1 Tasks

| # | Task | Status | Assigned To | Spec Reference | Acceptance Criteria |
|---|------|--------|-------------|----------------|-------------------|
| 1.1 | Electron scaffold with Vite bundling | NOT STARTED | — | MVP Spec §2.1, §2.2 | App launches, shows empty window, main/renderer/preload structure correct |
| 1.2 | SQLCipher database with Drizzle ORM | NOT STARTED | — | MVP Spec §2.5, Schema doc 01 | All 14 tables created, seed data loaded, encryption verified |
| 1.3 | Auth0 PKCE login flow | NOT STARTED | — | MVP Spec §2.6 Boundary 4 | Login/logout works, token stored in safeStorage, license check passes |
| 1.4 | Three-column layout from v4 prototype | NOT STARTED | — | UI Design Lock v4 (doc 13), v4 HTML | Layout matches prototype, 3 themes work, splitters are 2px and draggable, 6-stage pipeline colors render correctly |
| 1.5 | contextBridge + typed IPC preload | NOT STARTED | — | MVP Spec §2.6 Boundary 1, IPC doc 02 | All MVP IPC endpoints typed, renderer cannot access Node.js |
| 1.6 | Sprint 1 integration test | NOT STARTED | — | — | App launches, login works, DB encrypts, layout matches v4, IPC round-trips |

### Sprint 2 Tasks
| # | Task | Status | Assigned To | Spec Reference | Acceptance Criteria |
|---|------|--------|-------------|----------------|-------------------|
| 2.1 | Python sidecar JSON-RPC server | NOT STARTED | — | MVP Spec §2.3 Process 4, IPC doc 02a | Server starts, responds to health check, Unix socket communication works |
| 2.2 | Presidio + spaCy PII detection | NOT STARTED | — | MVP Spec §2.7, HIPAA doc 03 | 18 HIPAA identifiers detected, ≥99% recall on synthetic corpus |
| 2.3 | Sidecar lifecycle management | NOT STARTED | — | MVP Spec §2.3 | Spawn, health check (30s), auto-restart on failure, graceful shutdown |
| 2.4 | PyInstaller frozen build | NOT STARTED | — | MVP Spec §2.3 | Sidecar runs without Python installed, macOS universal binary |
| 2.5 | PII integration tests | NOT STARTED | — | HIPAA Safe Harbor doc 03 | 50+ test cases, Safe Harbor 18-identifier coverage, <2% false positive |

### Sprint 3 Tasks
| # | Task | Status | Assigned To | Spec Reference | Acceptance Criteria |
|---|------|--------|-------------|----------------|-------------------|
| 3.1 | Case CRUD | NOT STARTED | — | MVP Spec §2.5 (cases table) | Create, list, open, archive cases; data persists in SQLCipher |
| 3.2 | Document upload + text extraction | NOT STARTED | — | MVP Spec §2.4 Step 1 | PDF (pdf-parse) and DOCX (mammoth) text extraction works |
| 3.3 | Case explorer tree component | NOT STARTED | — | UI Design Lock v4 §3, v4 HTML | Recursive tree, expand/collapse, file click opens tab, stage-appropriate document nodes per buildTreeData() logic |
| 3.4 | Tab management system | NOT STARTED | — | UI Design Lock v4 §4, v4 HTML | Open/close/switch tabs, active state, close button, overflow scroll, Clinical Overview with summary tabs |
| 3.5 | File storage in SQLCipher | NOT STARTED | — | MVP Spec §2.5 (case_documents) | Binary blobs stored encrypted, retrieved correctly |
| 3.6 | Intake form modal UI component | NOT STARTED | — | Intake Spec §2, v4 HTML | Modal popup, referral/walk-in toggle, all fields per spec, save draft works |
| 3.7 | patient_intake table migration | NOT STARTED | — | Intake Spec §2.5 | Table created, all columns, constraints, draft/complete status |
| 3.8 | Onboarding form modal UI component | NOT STARTED | — | Intake Spec §3, v4 HTML | Modal popup, 10 sections, mode toggle (self-report/clinician), save works |
| 3.9 | patient_onboarding table migration | NOT STARTED | — | Intake Spec §3.6 | Table created, all columns, clinician note fields, status workflow |

### Sprint 4 Tasks
| # | Task | Status | Assigned To | Spec Reference | Acceptance Criteria |
|---|------|--------|-------------|----------------|-------------------|
| 4.1 | PII pipeline integration | NOT STARTED | — | MVP Spec §2.4 Step 2 | Extract → detect → de-identify → store both versions, pipeline works end-to-end |
| 4.2 | Claude API integration | NOT STARTED | — | MVP Spec §2.6 Boundary 3 | API calls succeed, TLS pinned, responses parsed |
| 4.3 | API key in macOS Keychain | NOT STARTED | — | MVP Spec §2.7 | safeStorage API stores/retrieves key, not in config files |
| 4.4 | De-identification verification | NOT STARTED | — | MVP Spec §2.7 | Assert: no PHI in any outbound API request (test suite) |
| 4.5 | Rate limiting + error handling | NOT STARTED | — | MVP Spec §2.6 | Retry logic, rate limit backoff, user-facing error messages |
| 4.6 | **GO/NO-GO GATE** | NOT STARTED | Truck | — | PII: ≥99% recall, <2% FP on test corpus. PASS → Sprint 5. FAIL → extend. |

### Sprint 5–12 Tasks
[Populated when Sprint 4 GO/NO-GO passes]

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
