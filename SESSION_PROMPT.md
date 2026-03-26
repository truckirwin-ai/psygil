# Psygil (Psygil) — Session Resumption Prompt

**Copy and paste this entire prompt when starting a new working session on the Psygil project.**

---

## Prompt

You are resuming work on **Psygil (Psygil)**, an AI-powered writing tool for forensic and clinical psychologists, built by **Foundry SMB** (CEO: Truck Irwin). The project folder is at: `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

### Step 1: Read the Soul Document

Before doing anything else, read `CLAUDE.md` in the project root. This contains:
- Who Truck is and how he works (decides fast, artifacts over conversation, all-caps = non-negotiable)
- The working methodology we've established
- The BYOB framework
- What existed before and what was built
- Communication rules

### Step 2: Read the Project Dashboard

Open `Psygil_Project_Dashboard.html` — this is the living source of truth. Check:
- KPI cards (documentation status, dev readiness, legal blockers)
- Gantt timeline (what phase are we in?)
- Dev Readiness tab (any red/amber items?)
- Task Tracker (what's next?)
- Risk Register (any new blockers?)

### Step 3: Understand the Architecture

The revised technical specification is `Psygil_Technical_Functional_Analysis.docx`. Key principles:
1. **THE DOCTOR ALWAYS DIAGNOSES. NEVER THE AI.** This is Principle Zero. Enforced at agent design, pipeline design, and audit trail levels.
2. **6-Stage Clinical Pipeline:** Onboarding → Testing → Interview → Diagnostics → Review → Complete (replaces old Gate 1/2/3 system).
3. **Local-first PHI.** Python sidecar for PII detection. No PHI leaves the device.
4. **Four agents:** Ingestor Agent, Diagnostician Agent, Writer Agent, Editor/Legal Reviewer Agent.
5. **OnlyOffice** embedded in Electron for full Word-compatible editing.
6. **SQLCipher** for encrypted local storage. OPFS + SQLite.
7. **Stage-appropriate documents** — case tree contents match pipeline stage; documents only appear at the stage they're created.
8. **Configurable audit trail** — "Decision Record Only" by default. Never log rejected diagnoses.
9. **Forensic + Clinical** from day one. 10-diagnosis catalog, 30+ instrument library, extensible via Settings.

### Step 4: Know What Exists

**Engineering Specs (docs/engineering/):**
- `01_database_schema.sql` — Complete SQLCipher schema
- `02_ipc_api_contracts.md` — All 4 communication boundaries
- `03_agent_prompt_specs.md` — Production-ready prompts for all 4 agents
- `04_ui_wireframes.md` — ASCII wireframes, component hierarchy, state management
- `05_user_stories.md` — 68 stories across 13 epics
- `06_sprint_milestone_plan.md` — 24 sprints, 15 months, 4 phases
- `07_informed_consent_template.md` — 3 versions (forensic, clinical, verbal)
- `08_ui_design_system.md` — Colors, typography, spacing, components (3 themes)
- `12_Intake_Onboarding_Spec.md` — Intake and onboarding form specifications
- `13_UI_Design_Lock_v4.md` — **CRITICAL** 15-section UI design lock with all visual decisions
- `14_Pipeline_Architecture_Addendum.md` — 6-stage pipeline architecture (supersedes Gate system)

**Legal Docs (docs/legal/):**
- `01_FDA_CDS_Exemption_Analysis.md` — Drafted, pending counsel review
- `02_EULA_ToS_Privacy_Policy.md` — Drafted, pending counsel review
- `03_HIPAA_Safe_Harbor_Validation.md` — Drafted, pending engineering validation + counsel review

**Review Documents (project root):**
- `Panel_Review_Clinical_Forensic.md` — 5 clinical psychologist archetypes
- `Legal_Panel_Review.md` — 6 attorney archetypes
- `Executive_PM_Review.md` — PM + funding executive

**UI:**
- `Psygil_UI_Prototype.html` — Working 3-column IDE layout (Cursor-style), 3 themes, draggable splitters with localStorage persistence

**Original Strategic Docs (docs/):**
- 19 .docx documents covering vision through execution (Truck's pre-existing work)

### Step 5: Check What's Next

Look at the sprint milestone plan (`06_sprint_milestone_plan.md`). We're in Phase 0/1:
- **Phase 0 (Legal):** FDA, BAAs, APA licensing, EULA, insurance — runs in parallel
- **Phase 1 (Milestone 0):** PII validation — the GO/NO-GO gate before anything else
- **Phase 2 (Core Build):** Electron shell, 4 agents, 3 gates, OnlyOffice integration

### Step 6: Update the Dashboard

After completing any work, update `Psygil_Project_Dashboard.html`:
- Mark completed tasks in the Gantt and Task Tracker
- Update KPI cards if metrics change
- Move items from amber to green as they're resolved
- Add new risks if discovered

### Language Rules (Legal/Marketing)

- **NEVER** use: "diagnose," "diagnostic tool," "clinical decision support" in any external-facing material
- **ALWAYS** use: "writing tool," "documentation assistant," "evidence organizer"
- **NEVER** quantify AI contribution as a percentage ("writes 80% of the report")
- **ALWAYS** say: "automates time-consuming documentation tasks"
- **NEVER** store publisher-proprietary normative data (score cutoffs, norms)
- **ALWAYS** parse publisher-generated score reports (Q-global, PARiConnect PDFs)

### Working Style

- Truck decides fast. Present options concisely. He'll pick one and move on.
- Artifacts over conversation. Every discussion produces a file.
- When Truck uses ALL CAPS, it's a non-negotiable principle — enforce it everywhere.
- Update the dashboard after every significant deliverable.
- Be honest. Truck hired me to stress-test, not validate.

---

## Quick Reference: Current Status (March 21, 2026 — Session 2)

| Item | Status |
|------|--------|
| Documentation | 30+ complete |
| Engineering specs | 11/11 complete (includes design lock + pipeline addendum) |
| Legal docs | 3/3 drafted (pending counsel) |
| UI Prototype | v4 — 50-case DB, 6-stage pipeline, stage-appropriate trees, overview tabs |
| Pipeline | Onboarding → Testing → Interview → Diagnostics → Review → Complete |
| Sprint phase | Pre-Phase 1 (ready to start) |
| Next action | PII validation (Milestone 0) OR legal counsel engagement |
| Critical blockers | FDA counsel review, EULA counsel review, HIPAA validation |

---

*Update this prompt's Quick Reference section whenever the project status changes materially.*
