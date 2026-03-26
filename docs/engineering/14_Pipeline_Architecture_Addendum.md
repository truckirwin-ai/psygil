# Pipeline Architecture Addendum
## Supersedes: Gate 1/2/3 System (MVP Spec §2.4)
## Date: 2026-03-21
## Status: LOCKED — Implemented in v4 Prototype

---

## 1. Pipeline Overview

The evaluation workflow uses a **6-stage clinical pipeline** that replaces the previous Gate 1/Gate 2/Gate 3 system. Each stage represents a clinically meaningful phase of a forensic or clinical psychological evaluation.

```
Onboarding → Testing → Interview → Diagnostics → Review → Complete
```

| Stage | Index | Color | Description |
|-------|-------|-------|-------------|
| Onboarding | 0 | #2196f3 (blue) | Patient intake, referral documentation, consent |
| Testing | 1 | #9c27b0 (purple) | Psychological test administration and scoring |
| Interview | 2 | #e91e63 (pink) | Clinical interviews, collateral contacts, behavioral observations |
| Diagnostics | 3 | #ff9800 (orange) | Diagnostic formulation — **DOCTOR ALWAYS DIAGNOSES** |
| Review | 4 | #ff5722 (red-orange) | Report drafting, legal review, attestation |
| Complete | 5 | #4caf50 (green) | Final report delivered, case closed |

Additional status: **Archived** (index 5, color #9e9e9e) — for cases removed from active view.

---

## 2. Stage-Appropriate Document Architecture

Case folder contents are dynamically generated based on pipeline stage. Documents only appear at the stage they are created, reflecting real clinical workflow.

### Document Availability by Stage

| Document | Onboarding (0) | Testing (1) | Interview (2) | Diagnostics (3) | Review (4) | Complete (5) |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| Clinical Overview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Intake Form | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Referral Documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Collateral Records | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Test Battery | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Validity Summary | | | ✓ | ✓ | ✓ | ✓ |
| Interview Notes | | | ✓ | ✓ | ✓ | ✓ |
| Diagnostics | | | | ✓ | ✓ | ✓ |
| Report (draft) | | | | | ✓ | |
| Report (final) | | | | | | ✓ |
| Audit Trail | | | | | | ✓ |

### Implementation: `buildTreeData()` with `STAGE_ORDER`

```javascript
const STAGE_ORDER = {
  Onboarding: 0, Testing: 1, Interview: 2,
  Diagnostics: 3, Review: 4, Complete: 5, Archived: 5
};
```

The tree builder checks `STAGE_ORDER[case.status]` and conditionally includes document nodes. This ensures the prototype and the production app always show only documents that would exist at the case's current stage.

---

## 3. Clinical Overview with Summary Tabs

The Clinical Overview is the primary case view, showing:

### Header Section
- Patient demographics (name, DOB, age, gender)
- Case metadata (case number, eval type, referral source)
- Pipeline stage indicator with colored pill
- Complaint and diagnosis status

### Summary Tabs (Dynamic)
Below the header, tabs appear based on the case's pipeline stage:

| Tab | Appears at Stage | Summary Data | Edit Action |
|-----|-----------------|--------------|-------------|
| Intake | 0+ | Referral type, date, source, complaint, demographics | Opens `makeCaseIntake()` in editor |
| Referral | 0+ | Referring party, court/agency, legal context | Opens `makeCaseReferral()` in editor |
| Collateral | 1+ | Record types received, sources, page counts | Opens `makeCaseCollateral()` in editor |
| Testing | 1+ | Tests administered with status indicators | Opens `makeCaseTests()` in editor |
| Validity | 2+ | Validity indicators, response style assessment | Opens `makeCaseValidity()` in editor |
| Interviews | 2+ | Interview sessions, formats, topics covered | Opens `makeCaseInterviews()` in editor |
| Diagnostics | 3+ | Diagnostic considerations, clinical formulation | Opens `makeCaseDiagnostics()` in editor |
| Report | 4+ | Report status (draft/final), sections, word count | Opens `makeCaseReport()` in editor |

Each tab has an **Edit** button (top-right) that opens the full form as a new tab in the Column 2 editor via `ovEdit()` → `openTab()`.

---

## 4. Case Data Model (CASE_DB)

Each case in the 50-case database contains:

```javascript
{
  id: 'c001',           // Unique identifier
  name: 'Last, First',  // Patient name
  status: 'Interview',  // Pipeline stage
  evalType: 'CST',      // Evaluation type
  complaint: '...',      // Presenting complaint
  dxStatus: 'Pending',  // Diagnosis status
  severity: 'High',     // Case severity
  hours: 4.2,           // Hours logged
  tests: ['MMPI-3', 'PAI', ...],  // Test battery
  dob: 'MM/DD/YYYY',    // Date of birth
  gender: 'M/F',        // Gender
  referralSource: '...', // Who referred
  caseNumber: 'FSI-2026-XXX' // Case number
}
```

### Evaluation Types
CST (Competency), Custody, Risk Assessment, Fitness for Duty, Disability, Immigration, Personal Injury, Diagnostic Assessment, Juvenile, Mitigation

### Diagnosis Statuses
Pending, In Progress, Confirmed, Deferred, Rule Out

### Distribution (50 cases)
- Onboarding: 8 cases
- Testing: 5 cases
- Interview: 6 cases
- Diagnostics: 7 cases
- Review: 6 cases
- Complete: 15 cases
- Archived: 3 cases

---

## 5. Content Generators

Eight parameterized content generators produce case-specific views:

| Function | Purpose | Key Data |
|----------|---------|----------|
| `makeCaseIntake(id)` | Intake form with referral details | Referral type, demographics, complaint, consent |
| `makeCaseReferral(id)` | Referral documentation | Referring party, legal context, questions |
| `makeCaseCollateral(id)` | Collateral records tracker | Record types, sources, page counts |
| `makeCaseTests(id)` | Test battery with status | Tests with Scored/Pending/Scheduled indicators |
| `makeCaseValidity(id)` | Validity assessment summary | Validity indicators, response style |
| `makeCaseInterviews(id)` | Interview notes | Session details, format, topics |
| `makeCaseDiagnostics(id)` | Diagnostic formulation | DSM-5 considerations, clinical reasoning |
| `makeCaseReport(id)` | Report status and sections | Draft/final, section outline, word count |
| `makeCaseAudit(id)` | Audit trail | Timestamped case actions log |

All generators use helper functions: `_pill()` for status pills, `_hdr()` for section headers, `_pipeline()` for stage indicators.

---

## 6. Mapping from Old to New Terminology

| Old Term | New Term | Notes |
|----------|----------|-------|
| Intake (status) | Onboarding | "Intake" still used as form name |
| Gate 1 | Testing + Interview | Split into two clinically distinct stages |
| Gate 2 | Diagnostics + Review | Split: formulation vs. report/attestation |
| Gate 3 | (removed) | Absorbed into Complete stage |
| Complete | Complete | Unchanged |
| "gate tabs" | Pipeline indicator | Visual 6-dot indicator with stage labels |

---

## 7. Prototype Reference

**Canonical file:** `Psygil_UI_Prototype_v4.html` (~3,745 lines, 258KB)
**Design lock:** `docs/engineering/13_UI_Design_Lock_v4.md` (15 sections, 28KB)
**Git commits:** 4 commits documenting progressive changes (repo at `/sessions/dreamy-nifty-cray/psygil-repo/`)
