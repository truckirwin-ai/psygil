# Case Directory Schema
## Psygil — On-Disk Case Structure

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Architectural Specification
**References:** Shared Storage Architecture (doc 09), Pipeline Architecture (doc 14), UNID Redaction (doc 15), IPC API Contracts (doc 02)

---

## Core Principle

Every case is a directory on disk. The file tree in the UI reads the actual filesystem — not an in-memory array. The SQLCipher database stores structured metadata (case status, demographics, test batteries, diagnostic decisions, audit trail). The case directory stores the actual document files.

---

## Directory Naming Convention

```
{case_number}_{first_initial}.{last_name}/
```

**Examples:**
```
2026-0147_M.Johnson/
2026-0152_J.Martinez/
2026-0158_S.Williams/
2026-0161_W.Chen/
2026-0165_Y.Okafor/
```

**Rules:**
- Case number is zero-padded to 4 digits after the year prefix (e.g., `2026-0003`, not `2026-3`)
- First initial is uppercase, single character
- Last name is as-entered (preserving capitalization: `O'Brien`, `de la Cruz`, `Kim`)
- Separator between case number and name is underscore `_`
- Separator between initial and last name is period `.`
- No spaces in directory name — spaces in last names become hyphens (e.g., `Van Horn` → `Van-Horn`)
- If a name contains characters invalid for the filesystem (`/ \ : * ? " < > |`), they are stripped

**Why this format:**
- Case number prefix keeps directories sortable chronologically
- Name suffix lets the clinician find a case visually in Finder/Explorer without memorizing numbers
- The combination is unique — two patients named S.Williams will have different case numbers

---

## Project Root Structure

The project root is the storage path configured in Setup (local path, network share, or cloud mount point):

```
{project_root}/
├── .psygil/                    # App metadata (hidden)
│   ├── psygil.db               # SQLCipher database
│   ├── config.json                  # Practice configuration
│   └── audit.log                    # Global audit trail
│
├── cases/
│   ├── 2026-0147_M.Johnson/
│   ├── 2026-0152_J.Martinez/
│   ├── 2026-0158_S.Williams/
│   └── .../
│
├── templates/                       # Report templates, letterheads
│   ├── report_cst.docx
│   ├── report_custody.docx
│   ├── letterhead.docx
│   └── consent_forms/
│       ├── consent_forensic.docx
│       └── consent_clinical.docx
│
└── resources/                       # Reference materials (read-only)
    ├── dsm5-tr/
    ├── statutes/
    └── scoring_manuals/
```

---

## Case Directory Structure

Each case directory mirrors the 6-stage clinical pipeline. Subdirectories are created as the case progresses — an Onboarding-stage case will not have a `diagnostics/` or `report/` directory yet.

```
2026-0147_M.Johnson/
│
├── case.json                        # Case metadata manifest
│
├── intake/                          # Stage 0: Onboarding
│   ├── intake_form.json             # Structured intake data
│   ├── consent_signed.pdf           # Signed informed consent
│   ├── biopsychosocial.json         # Onboarding/history form
│   └── demographics.json            # Contact & demographics
│
├── referral/                        # Created at intake
│   ├── referral_order.pdf           # Court order / referral letter
│   ├── authorization.pdf            # Insurance authorization (if applicable)
│   └── referral_metadata.json       # Parsed referral questions, source, deadline
│
├── collateral/                      # Stage 1+: Testing
│   ├── court_order.pdf
│   ├── police_report.pdf
│   ├── medical_records_county_jail.pdf
│   ├── prior_evaluation_2024.pdf
│   ├── school_records.pdf
│   └── collateral_index.json        # Manifest: name, status, pages, summary per doc
│
├── testing/                         # Stage 1: Testing
│   ├── scores/
│   │   ├── mmpi3_scores.json        # Raw + scaled scores
│   │   ├── pai_scores.json
│   │   └── wais_v_scores.json
│   ├── imports/                     # Publisher exports (Q-global, PARiConnect)
│   │   ├── mmpi3_qglobal_export.pdf
│   │   └── pai_pariconnect_export.pdf
│   ├── validity/
│   │   ├── validity_summary.json    # Aggregated validity indicators
│   │   └── tomm_results.json        # Standalone validity instrument results
│   └── testing_summary.json         # Instruments administered, dates, status
│
├── interviews/                      # Stage 2: Interview
│   ├── session_001/
│   │   ├── notes.json               # Structured session notes
│   │   ├── transcript.vtt           # If recorded/transcribed
│   │   └── mental_status.json       # MSE observations
│   ├── session_002/
│   │   ├── notes.json
│   │   └── competency_assessment.json  # Eval-type-specific structured data
│   ├── collateral_interviews/
│   │   └── session_003_defense_counsel/
│   │       └── notes.json
│   └── interview_summary.json       # Sessions, hours, topics per session
│
├── diagnostics/                     # Stage 3: Diagnostics
│   ├── diagnostic_formulation.json  # Clinician's diagnostic decisions
│   ├── criteria_mapping.json        # DSM-5-TR criteria met/not met (clinician-confirmed)
│   ├── differential_dx.json         # Considered and ruled-out diagnoses
│   ├── evidence_matrix.json         # Cross-reference: diagnosis × supporting evidence
│   └── feigning_assessment.json     # If applicable: validity concerns, indicators
│
├── report/                          # Stage 4-5: Review & Complete
│   ├── drafts/
│   │   ├── draft_v1.docx            # AI-generated initial draft (re-hydrated from UNIDs)
│   │   ├── draft_v2.docx            # Clinician-edited revision
│   │   └── draft_v3_final.docx      # Final version before signing
│   ├── final/
│   │   ├── evaluation_report.docx   # Signed final report (full PHI — NEVER redacted)
│   │   └── evaluation_report.pdf    # PDF export for filing
│   └── report_metadata.json         # Status, version history, sign-off timestamp
│
├── audit/                           # Created at case creation, appended continuously
│   └── audit_trail.jsonl            # Append-only log: every action with timestamp + user
│
└── exports/                         # On-demand exports
    ├── case_summary.pdf             # One-page case summary for quick reference
    └── records_package.zip          # Bundled records for attorney/court transmission
```

---

## case.json — Case Metadata Manifest

Every case directory contains a `case.json` at the root. This is the bridge between the filesystem and the SQLCipher database — both contain case metadata, but `case.json` travels with the directory (important for backup, migration, and shared storage).

```json
{
  "caseNumber": "2026-0147",
  "directoryName": "2026-0147_M.Johnson",
  "created": "2026-03-10T08:30:00Z",
  "lastModified": "2026-03-22T14:15:00Z",

  "patient": {
    "firstName": "Marcus",
    "middleInitial": "D",
    "lastName": "Johnson",
    "dateOfBirth": "1991-06-14",
    "age": 34,
    "gender": "M"
  },

  "evaluation": {
    "type": "CST",
    "referralSource": "Court",
    "referralDate": "2026-02-28",
    "deadline": "2026-04-15",
    "jurisdiction": "Denver District Court",
    "charges": "Assault 2 (F4), Menacing (M1)",
    "referringParty": "PD Sarah Mitchell"
  },

  "pipeline": {
    "currentStage": "Diagnostics",
    "stageHistory": [
      {"stage": "Onboarding", "entered": "2026-03-10T08:30:00Z", "completed": "2026-03-10T10:00:00Z"},
      {"stage": "Testing", "entered": "2026-03-10T10:00:00Z", "completed": "2026-03-14T16:00:00Z"},
      {"stage": "Interview", "entered": "2026-03-14T16:00:00Z", "completed": "2026-03-18T12:00:00Z"},
      {"stage": "Diagnostics", "entered": "2026-03-18T12:00:00Z", "completed": null}
    ]
  },

  "clinical": {
    "sessions": 3,
    "totalHours": 5.5,
    "severity": "High",
    "diagnosis": "Schizophrenia, Paranoid Type",
    "diagnosticCode": "F20.0",
    "feigning": false,
    "opinion": "Not competent — recommend restoration treatment"
  },

  "testing": {
    "instruments": ["MMPI-3", "PAI", "WAIS-V", "TOMM", "SIRS-2"],
    "scoringComplete": true,
    "validityStatus": "adequate"
  },

  "report": {
    "status": "draft",
    "currentVersion": 2,
    "evaluator": "Dr. Truck Irwin, Psy.D., ABPP",
    "signedDate": null
  }
}
```

---

## Stage-Gated Directory Creation

Directories are created only when the case reaches the corresponding pipeline stage. This enforces the stage-appropriate documents principle at the filesystem level.

| Pipeline Stage | Directories Created |
|---------------|-------------------|
| Onboarding | `intake/`, `referral/`, `audit/` |
| Testing | `collateral/`, `testing/` |
| Interview | `interviews/` |
| Diagnostics | `diagnostics/` |
| Review | `report/`, `report/drafts/` |
| Complete | `report/final/`, `exports/` |

When a case advances to the next stage, the app creates the new subdirectories. The file tree in the UI reflects exactly what exists on disk — no phantom directories.

---

## File Tree ↔ Filesystem Mapping

The column 1 file tree in the UI maps directly to the case directory:

```
UI Tree Node                          Filesystem Path
─────────────                          ───────────────
📁 Johnson, Marcus D. #2026-0147      cases/2026-0147_M.Johnson/
  📄 Clinical Overview                 → generated from case.json (not a file)
  📁 Collateral Records                cases/2026-0147_M.Johnson/collateral/
    📄 Court Order                     collateral/court_order.pdf
    📄 Hospital Records                collateral/medical_records_county_jail.pdf
    📄 Police Report                   collateral/police_report.pdf
  📁 Interviews                        cases/2026-0147_M.Johnson/interviews/
    📄 Session 1 — Initial Interview   interviews/session_001/notes.json
    📄 Session 2 — Psych Testing       (testing session — testing/testing_summary.json)
    📄 Session 3 — Cognitive Testing   interviews/session_002/notes.json
  📁 Test Results                      cases/2026-0147_M.Johnson/testing/
    📄 Summary                         testing/testing_summary.json
    📄 MMPI-3                          testing/scores/mmpi3_scores.json
    📄 PAI                             testing/scores/pai_scores.json
  📄 Evidence Map                      → generated from diagnostics/evidence_matrix.json
  📄 CST Evaluation Report             report/drafts/draft_v2.docx (or final/)
  📁 Gates                             (legacy — maps to diagnostics/)
    📄 Audit Trail                     audit/audit_trail.jsonl
    📄 Review Notes                    diagnostics/diagnostic_formulation.json
```

The Clinical Overview and Evidence Map are computed views — not files on disk. Everything else maps to a real path.

---

## IPC Contract: File Operations

New IPC channels for case directory operations (extends doc 02):

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
  directoryName: string,   // e.g., "2026-0147_M.Johnson"
  fullPath: string,        // e.g., "/project-root/cases/2026-0147_M.Johnson"
  created: string[]        // Subdirectories created: ["intake", "referral", "audit"]
}>);

// Advance a case to the next pipeline stage (creates new subdirectories)
ipcMain.handle('case:advance', async (event, {
  caseNumber: string,
  toStage: 'Testing' | 'Interview' | 'Diagnostics' | 'Review' | 'Complete'
}) => Promise<{
  created: string[],       // New subdirectories created
  caseJson: object         // Updated case.json
}>);

// List contents of a case subdirectory
ipcMain.handle('case:listFiles', async (event, {
  caseNumber: string,
  subdirectory: string     // e.g., "collateral", "testing/scores"
}) => Promise<{
  files: Array<{
    name: string,
    path: string,
    size: number,
    modified: string,
    type: string           // "pdf", "json", "docx", etc.
  }>
}>);

// Read case.json metadata
ipcMain.handle('case:readManifest', async (event, {
  caseNumber: string
}) => Promise<CaseManifest>);

// Import a file into a case subdirectory (e.g., uploading a collateral PDF)
ipcMain.handle('case:importFile', async (event, {
  caseNumber: string,
  subdirectory: string,
  sourcePath: string,      // Path to file being imported
  targetName?: string      // Optional rename
}) => Promise<{
  importedPath: string,
  size: number
}>);
```

---

## Relationship to Storage Modes

This directory schema works identically across all three storage tiers from doc 09:

| Storage Mode | Project Root | Notes |
|-------------|-------------|-------|
| Local Only | `/Users/truck/Psygil/` | All on local disk |
| Shared Network | `\\server\Psygil\` or `/Volumes/PracticeShare/Psygil/` | Same structure on network mount |
| Cloud (future) | Local SQLCipher + cloud document sync | `case.json` serves as sync manifest |

The directory naming convention (`{case_number}_{initial}.{last}`) is human-readable across all three modes — whether a clinician is browsing their local drive, a network share, or a cloud storage folder.

---

## Migration from Prototype

When transitioning from the HTML prototype to production:

1. `CASE_DB` array → SQLCipher `cases` table + individual `case.json` files
2. Synthetic tree nodes → `case:listFiles` IPC reading actual filesystem
3. In-memory document content → Real files in case subdirectories
4. `makeCaseOverview()` → Reads `case.json` + aggregates from subdirectory manifests
5. `openTab()` with generated HTML → Opens actual `.docx`/`.pdf`/`.json` files in OnlyOffice or viewer

The prototype's `CASE_DB` structure maps almost 1:1 to `case.json` — this was intentional to minimize the migration gap.
