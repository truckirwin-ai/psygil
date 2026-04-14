# UI Design Lock — Psygil Prototype v4

**Version:** 4.0
**Lock Date:** March 21, 2026
**File:** `Psygil_UI_Prototype_v4.html` (3,745 lines, 258KB)
**Status:** LOCKED — All visual and interaction decisions documented below. Do not deviate without Truck's explicit approval.

---

## 1. Global Architecture

### 1.1 Application Shell

The app is a **three-column IDE layout** inspired by Cursor and VS Code, not a medical dashboard. This was a deliberate pivot from the original medical dashboard concept — Truck's visual reference was "Linear, all the way. Compact like Bloomberg Terminal."

```
┌─────────────────────────────────────────────────────────────┐
│ TITLEBAR (36px) — PSYGIL branding left, controls right │
├──────────┬─────────────────────────────┬────────────────────┤
│          │  TABS BAR (32px)            │                    │
│ LEFT     │  Center Editor Area         │ RIGHT              │
│ COLUMN   │  (tab panes, scrollable)    │ COLUMN             │
│ (280px)  │                             │ (320px)            │
│          │                             │  Context (upper)   │
│ Tree     │                             │  ─ h-splitter ─    │
│ Panel    │                             │  Writing Asst      │
│          │                             │  (lower)           │
│          ├─────────────────────────────┤                    │
│          │ GATES PANEL (bottom)        │                    │
├──────────┴─────────────────────────────┴────────────────────┤
│ STATUS BAR (24px)                                           │
└─────────────────────────────────────────────────────────────┘
```

- **Left column:** 280px default width, contains CASES panel header + tree
- **Center column:** Flex 1 (fills remaining), tab bar + content + gates panel
- **Right column:** 320px default width, split vertically into Context (upper) and Writing Assistant (lower)
- **Splitters:** 2px vertical between columns, 2px horizontal in right column. ALL splitters are draggable with localStorage persistence.

### 1.2 Titlebar (36px)

```
PSYGIL    [Intake] [Onboarding]              [theme] [notifications] [?] [TI avatar]
```

- Left: "PSYGIL" in 14px Inter, weight 600, letter-spacing 0.5px
- Left links: "Intake" and "Onboarding" — clickable text (12px, text-secondary) that open modals
- Right icons: theme toggle (cycles light→medium→dark), notifications bell, help (?), user avatar (28px circle, accent background, initials "TI")
- Background: `var(--panel)`, bottom border: `1px solid var(--border)`

### 1.3 Splitter Behavior

- **Width:** 2px. Not 3px, not 4px. This is a non-negotiable design decision.
- **Default:** `var(--border)` color
- **Hover/Drag:** `var(--accent)` color, 0.15s transition
- **Cursor:** `col-resize` for vertical, `row-resize` for horizontal
- **During drag:** `body` gets `.col-resizing` or `.row-resizing` class, which sets `pointer-events: none` on all elements except the splitter itself and `user-select: none` on body
- **Persistence:** Widths saved to localStorage on drag end, restored on load
- **Min widths:** Left column 200px min, Right column 200px min

---

## 2. Theme System

### 2.1 Seven CSS Custom Properties

Every color in the app derives from exactly 7 tokens. No exceptions.

| Token | Light | Medium | Dark |
|-------|-------|--------|------|
| `--bg` | `#ffffff` | `#1e1e1e` | `#0d1117` |
| `--panel` | `#f3f3f3` | `#2d2d2d` | `#161b22` |
| `--border` | `#e0e0e0` | `#3e3e3e` | `#30363d` |
| `--text` | `#1e1e1e` | `#e0e0e0` | `#c9d1d9` |
| `--text-secondary` | `#666666` | `#a0a0a0` | `#8b949e` |
| `--accent` | `#0078d4` | `#58a6ff` | `#58a6ff` |
| `--highlight` | `#e8f4fd` | `#1f4b7c` | `#1f4b7c` |

- Theme set via `html[data-theme]` attribute: `"light"`, `"medium"`, `"dark"`
- Toggle cycles through all three
- No component should use hardcoded colors except status/severity pills (see §5)

### 2.2 Typography

- **Body:** Inter, 13px (font-size on individual elements, not body)
- **Code/Mono:** JetBrains Mono, 11px
- **Panel headers:** 11px, weight 600, uppercase, letter-spacing 0.5px, `var(--text-secondary)`
- **Tree nodes:** 13px Inter
- **Tab labels:** 12px Inter, weight 500

---

## 3. Left Column — Case Explorer Tree

### 3.1 Panel Header

```
CASES    [+] [grid] [↑]
```

- "CASES" in panel-header style (11px uppercase)
- Action icons: New case (+), grid view toggle, collapse all (↑)
- Height: 32px

### 3.2 Tree Nodes

Each node has: chevron (16px) + icon (16px) + label (flex 1) + optional badge

- **Indent:** 8px base + 16px per depth level (`--indent` CSS var)
- **Chevron:** ▸ (collapsed) / ▾ (expanded), 10px, `var(--text-secondary)`. Hidden (visibility:hidden) for leaf nodes.
- **Icon:** Emoji-based (📁 folder, 📄 document, 📊 chart, 🎙 interview, ⚖ diagnostics, ✍ attestation, 📋 audit, 📝 report, ⚙ settings, 💬 notes)
- **Label:** Text overflow ellipsis, nowrap
- **Badge:** Blue pill (`var(--accent)` bg, white text, 10px font, 3px radius) — shows case number (e.g., "#2026-0147")
- **Hover:** `var(--highlight)` background
- **Active:** `var(--accent)` background, white text and icon

### 3.3 Tree Structure

The tree is **dynamically generated** from `CASE_DB` via `buildTreeData()`:

```
📊 Dashboard
📁 Johnson, Marcus D. — CST  [#2026-0147]  (expanded, full detail)
    📄 Clinical Overview
    📁 Collateral Records (expanded)
        📄 Court Order
        📄 Hospital Records
        📄 Police Report
        📄 Jail Medical Records
        📄 Prior Evaluation
    📁 Interviews (expanded)
        🎙 Session 1 — Initial Interview
        🎙 Session 2 — Psych Testing
        🎙 Session 3 — Cognitive Testing
    📁 Test Results (expanded)
        📊 Summary
        📊 MMPI-3
        📊 PAI
        📊 WAIS-V
        📊 TOMM
        📊 SIRS-2
    🗺 Evidence Map
    📝 CST Evaluation Report
    📁 Gates
        ⚖ Diagnostics
        ✍ Review & Attestation
    📋 Audit Trail
    💬 Review Notes
📁 [49 other cases — stage-appropriate children]
⚙ Settings
```

### 3.4 Dynamic Case Trees (Non-Johnson)

Every case except Johnson (c001) gets dynamically generated children based on pipeline stage. The logic in `buildTreeData()`:

| Stage Reached | Children Added |
|--------------|----------------|
| All stages | Clinical Overview (always) |
| Onboarding (0+) | Onboarding folder → Intake Form, Referral Documents |
| Testing (1+) | + Collateral Records in Onboarding; Testing folder → Test Battery |
| Interview (2+) | + Validity Summary in Testing; Interviews folder → Interview Notes |
| Diagnostics (3+) | + Diagnostics node |
| Review (4+) | + [EvalType] Report (marked "draft" at stage 4) |
| Complete (5) | + Report (final, isWord=true); Audit Trail |

Folders at the current stage show "(in progress)" label suffix.

---

## 4. Center Column — Tab System

### 4.1 Tab Bar

- Height: 32px, background `var(--panel)`, bottom border
- Active tab: `var(--bg)` background, `var(--accent)` top border (2px), bold weight
- Inactive tabs: `var(--panel)` background, hover shows lighter background
- Close button (×): 14px, visible on hover, `var(--text-secondary)`, hover `var(--text)`
- Overflow: horizontal scroll with gradient fade

### 4.2 Tab Pane Content

- Full-height scrollable area
- Padding varies by content type (16px for standard content, 0 for word-processor panes)
- Word-processor panes (isWord=true) get white background with centered content area

### 4.3 Key Tab Types

**Dashboard** — See §6
**Clinical Overview (stub cases)** — See §7
**Clinical Overview (Johnson)** — 10 internal tabs with rich clinical content (Demographics, Presenting, MSE, Neurovegetative, Treatment, Safety, Alcohol, Substances, Legal, Stressors)
**Test Results** — Score tables, interpretation, flagging
**Evaluation Report** — Word-processor style with OnlyOffice placeholder
**Gate Views** — Diagnostic decision interface, attestation
**Intake/Onboarding** — Modal forms (see §8)

---

## 5. Color Constants (Non-Theme)

### 5.1 Pipeline Stage Colors

| Stage | Color | Hex |
|-------|-------|-----|
| Onboarding | Blue | `#2196f3` |
| Testing | Purple | `#9c27b0` |
| Interview | Pink | `#e91e63` |
| Diagnostics | Orange | `#ff9800` |
| Review | Deep Orange | `#ff5722` |
| Complete | Green | `#4caf50` |
| Archived | Grey | `#9e9e9e` |

### 5.2 Severity Colors

| Severity | Color | Hex |
|----------|-------|-----|
| Low | Green | `#4caf50` |
| Moderate | Orange | `#ff9800` |
| High | Red | `#f44336` |
| Very High | Purple | `#9c27b0` |

### 5.3 Evaluation Type Colors (Dashboard)

| Type | Hex |
|------|-----|
| CST | `#2196f3` |
| Custody | `#9c27b0` |
| Risk | `#f44336` |
| PTSD Dx | `#ff9800` |
| ADHD Dx | `#4caf50` |
| Malingering | `#795548` |
| Fitness | `#607d8b` |
| Capacity | `#00bcd4` |

### 5.4 Status Pills

Rendered as `<span>` with colored background, white text, 3px border-radius, 11px font, 2px 8px padding. Used in dashboard table, clinical overview header, and KPI cards.

### 5.5 Severity Pills

Same styling as status pills but using severity color palette.

---

## 6. Dashboard

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Practice Dashboard                     As of March 21, 2026 │
├──────────┬──────────┬──────────┬──────────────────────────── │
│ Active   │ Completed│ High Sev │ Avg Hours                   │  ← 4 KPI cards
├────┬─────┬────┬─────┬─────┬────────────────────────────────  │
│ 6  │  5  │  6 │  7  │  6  │  20                             │  ← 6 pipeline cards
│Onb │Test │Int │Diag │Rev  │Complete                          │
├──────────┬──────────┬──────────────────────────────────────  │
│ Status   │ By Type  │ Upcoming Deadlines                     │  ← 3 charts row
│ Bar Chart│ Dot List │ (within 30 days)                       │
├─────────────────────────────────────────────────────────────  │
│ Filter: [Type ▾] [Status ▾] [Severity ▾] [Search........]  │
│ 50 of 50 cases                                              │
├──────────────────────────────────────────────────────────────│
│ Case # │ Client │ Type │ Severity │ Deadline │ Status │ Dx  │  ← Sortable table
│ ...    │ ...    │ ...  │ ...      │ ...      │ ...    │ ... │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 KPI Cards Row (4 cards, grid 4×1)

- Active Cases (accent), Completed (green), High Severity (red), Avg Hours (text)
- 26px number, 700 weight, 10px subtitle

### 6.3 Pipeline Breakdown Row (6 cards, grid 6×1)

- One card per stage, centered, 8px padding
- 20px number in stage color, 10px label

### 6.4 Charts Row (3 cards, grid 3×1)

- **Cases by Status:** Pure CSS bar chart (flexbox, heights as percentage of max count)
- **Cases by Type:** Colored dot list with counts
- **Upcoming Deadlines:** Sorted list, days remaining, red if ≤7 days

### 6.5 Filter Controls

- Dropdowns for Type, Status (6 active stages), Severity
- Text search (searches name, case #, eval type, diagnosis)
- Count display: "X of 50 cases"
- All filters re-render the dashboard pane via `dashFilterChange()`

### 6.6 Case Table

- Columns: Case #, Client, Type, Severity (pill), Deadline, Status (pill), Diagnosis
- Sorted by referral date (newest first)
- Overdue deadlines: red text with ⚠ prefix
- Row click: `activateCaseFromDashboard(caseId)` — expands case in tree, opens Clinical Overview

---

## 7. Clinical Overview (Stub Cases)

### 7.1 Header Section

```
Clinical Overview — Last, First MI.

[✓ Onboarding] [✓ Testing] [● Interview] [○ Diagnostics] [○ Review] [○ Complete]

Case #2026-0187  Type CST  Status [Interview]  Severity [Moderate]  Sessions 1 (2 hrs)

Diagnosis: [pending or actual]
Opinion: [if exists, in accent-bordered card]
```

- Pipeline indicator: completed stages at 0.5 opacity with ✓, current stage bold with ●, future stages outlined with ○
- Metadata: flex-wrap row of labeled values
- Diagnosis: shown if present, otherwise italic "Diagnosis pending"
- Opinion: shown in `var(--panel)` card with `var(--accent)` left border if present

### 7.2 Summary Tabs

Below the header, a tab bar shows stage-appropriate summary tabs. Each tab:
- Only appears if that stage has been reached
- Shows key summary data (2-4 fields)
- Has an **Edit button** (top-right, accent background, white text, 11px) that opens the full form as a new tab in the editor

| Tab | Content | Edit Opens |
|-----|---------|------------|
| **Intake** | Name, Age/Gender, Eval Type, Referred, Deadline | Intake Form |
| **Referral** | Source, Referring Party, Jurisdiction, Charges | Referral Docs |
| **Collateral** | Document count, document list | Collateral Records |
| **Testing** | Instrument count/status, instrument list, validity flags | Test Battery |
| **Validity** | Valid/Flagged banner, validity instruments | Validity Summary |
| **Interviews** | Session count, total hours, avg duration | Interview Notes |
| **Diagnostics** | Diagnosis, ICD-10 code, feigning flags | Diagnostics view |
| **Report** | Draft/Final status, opinion, type | Evaluation Report |

### 7.3 Tab Styling (`.ov-*` classes)

- Tab bar: `border-bottom: 1px solid var(--border)`, margin-top 20px
- Tabs: 12px, weight 500, 7px 14px padding, 2px bottom border (accent when active)
- Disabled tabs: `var(--border)` color, cursor default
- Panes: 12px 0 padding, display none / block toggle
- Edit button: `.ov-edit-btn` — float right, 11px, 3px 10px padding, accent bg, white text, 3px radius
- Field rows: `.ov-field` — flex, 6px gap, 5px margin-bottom
- Field label: `.ov-field-lbl` — text-secondary, 120px min-width
- Field value: `.ov-field-val` — text color, weight 500

### 7.4 Edit Button Behavior

`ovEdit(caseId, fnName)` calls `openTab()` with:
- Tab ID: `caseId + '-' + fnName` (e.g., "c026-makeCaseTests")
- Label: mapped from function name (e.g., "Test Battery", "Interview Notes")
- Content function: the actual content generator, called with caseId

This opens the full form view as a new tab in the center editor, allowing the clinician to see summary data in the overview while editing the full form alongside.

---

## 8. Modal Forms

### 8.1 Intake Form

Triggered from titlebar "Intake" link. Modal overlay with form inside.

**Top-level tabs:** Contact Information | Referral Information | Presenting Concerns | Insurance & Billing

- Radio buttons at top: "Referral" / "Walk-in" — toggles which tabs are visible
- Referral selected: shows Referral Information tab (hides Presenting Concerns)
- Walk-in selected: shows Presenting Concerns tab (hides Referral Information)
- Contact Information and Insurance & Billing always visible

**Referral Information sub-tabs:** Referring Party | Court & Attorney | Evaluation & Documents

Tab switching functions: `intakeMainTab()` for primary tabs, `intakeRefTab()` for sub-tabs

### 8.2 Onboarding Form

Triggered from titlebar "Onboarding" link. Modal overlay.

**9 sequential tabs:** Contact | Complaints | Family | Education & Work | Health | Mental Health | Substance Use | Legal | Recent Events

- Navigation: "Save & Continue →" button at bottom of each tab advances to next
- Tab switching: `obTab()` and `obNext()` functions
- "Demographics" removed from title — now "Contact & Personal Information (Carried Over)"
- **No checkboxes on patient forms** — narrative text input only (ARCHITECTURAL PRINCIPLE)

---

## 9. Right Column

### 9.1 Context Panel (Upper)

Four collapsible sections:

1. **Case Notes** — Session-by-session summaries (date, duration, key findings)
2. **AI Agent Status** — Documenter, Diagnostician, Editor, Legal — each with colored dot (green=Idle, orange=Awaiting, blue=Active)
3. **Deadlines** — Court deadline with days remaining, next action item
4. **Quick Actions** — "Open Evaluation Report" (primary button), "Go to Diagnostics" (secondary button)

### 9.2 Writing Assistant (Lower)

- Prompt text: "How can I help you draft sections, check citations, or review for compliance."
- Input field with submit button
- Scrollable response area

### 9.3 Gates Panel (Bottom of Center Column)

Header: "EVALUATION PIPELINE"
Six pipeline stage indicators in a flex row:

```
[✓ Onboarding] [✓ Testing] [✓ Interview] [● Diagnostics] [○ Review] [○ Complete]
```

- Completed: stage color at 0.5 opacity, ✓ prefix
- Current: stage color at full, ● prefix, active class
- Future: outlined, ○ prefix

---

## 10. Case Database (CASE_DB)

### 10.1 Schema

Each case object in `CASE_DB` array:

```javascript
{
    id: 'c001',              // Unique ID
    num: '2026-0147',        // Case number (display)
    last: 'Johnson',         // Last name
    first: 'Marcus',         // First name
    mi: 'D',                 // Middle initial (optional)
    age: 34,                 // Age
    gender: 'M',             // M/F
    evalType: 'CST',         // Evaluation type
    referral: 'Court',       // Referral source: Court, Attorney, Insurance, Physician, Self
    status: 'Diagnostics',   // Pipeline stage
    severity: 'High',        // Low, Moderate, High, Very High
    gate: 3,                 // Numeric gate (0-5)
    sessions: 3,             // Number of clinical sessions
    totalHrs: 6.5,           // Total hours of direct contact
    referralDate: '2026-02-28',  // ISO date
    deadline: '2026-04-15',      // ISO date
    dx: 'Schizophrenia...',      // Diagnosis (empty if pending)
    dxCode: 'F20.9',            // ICD-10 code
    jurisdiction: 'Denver...',   // Court jurisdiction (empty for non-court)
    charges: 'Assault 1st...',   // Criminal charges (empty for civil/clinical)
    attorney: 'ADA Rachel...',   // Attorney or referring party name
    tests: ['MMPI-3','PAI',...], // Test instruments administered
    feigning: false,             // Malingering flag
    opinion: 'IST — ...',       // Clinical opinion (empty if pending)
}
```

### 10.2 Distribution (50 Cases)

| Dimension | Breakdown |
|-----------|-----------|
| **Status** | Onboarding: 6, Testing: 5, Interview: 6, Diagnostics: 7, Review: 6, Complete: 20 |
| **Eval Type** | CST: 16, Risk: 6, PTSD Dx: 5, Custody: 4, Malingering: 4, Fitness: 4, Capacity: 4, ADHD Dx: 2 |
| **Severity** | Low: 5, Moderate: 18, High: 22, Very High: 2 |
| **Feigning** | 3 cases flagged (all Malingering type or detected during testing) |
| **Referral** | Court: ~30, Attorney: ~12, Insurance: 1, Physician: 2, Self: 2 |
| **Gender** | M: ~30, F: ~20 |

### 10.3 Test Battery Alignment

All cases past Onboarding have appropriate test batteries:
- **Testing stage:** Partial battery (1-2 instruments, testing in progress)
- **Interview+:** Full battery appropriate to eval type
- **CST:** MMPI-3, PAI, WAIS-V, TOMM (sometimes SIRS-2)
- **Custody:** MMPI-3, MCMI-IV, PAI
- **Risk:** MMPI-3, PAI, HCR-20 or PCL-R (sometimes SARA, Static-99R, VRAG-R)
- **PTSD Dx:** MMPI-3, CAPS-5, PCL-5 (sometimes TSI-2, DES-II)
- **ADHD Dx:** CAARS, CPT-3, WAIS-V
- **Malingering:** MMPI-3, SIRS-2, TOMM, M-FAST (sometimes FBS, SIMS)
- **Fitness:** MMPI-3, BAI or BDI-II, WAIS-V
- **Capacity:** MoCA, WAIS-V, Trail Making, Clock Drawing

---

## 11. Content Generators

### 11.1 Johnson (c001) — Full Detail

Johnson has hardcoded, richly detailed content for every document type. These serve as the gold-standard reference for what production content should look like:

- **Clinical Overview:** 10-tab interface with Demographics, Presenting Concerns, Mental Status Exam, Neurovegetative & Somatic Functioning, Prior Treatment History, Safety & Risk Assessment, Alcohol Use, Drug & Substance Use, Criminal History, Psychosocial Stressors
- **Collateral Records:** 5 documents with full text content
- **Interviews:** 3 session transcripts with detailed clinical observations
- **Test Results:** Full MMPI-3, PAI, WAIS-V, TOMM, SIRS-2 score reports with tables and interpretations
- **Evidence Map:** Visual summary of converging evidence
- **Evaluation Report:** Word-processor formatted CST report
- **Gates:** Diagnostic decision interface, attestation interface
- **Audit Trail:** Full event log with timestamps and agent/user attribution

### 11.2 Stub Cases (c002-c050) — Dynamic Content

All other cases use parameterized content generators that pull from `CASE_DB`:

| Function | Purpose | Data Used |
|----------|---------|-----------|
| `makeCaseOverview(caseId)` | Pipeline indicator, metadata, summary tabs | All fields |
| `makeCaseIntake(caseId)` | Contact/demographics, referral info, legal info | name, age, gender, referral, attorney, jurisdiction, charges |
| `makeCaseReferral(caseId)` | Referral source, authorization, court info | referral, attorney, jurisdiction, charges, dates |
| `makeCaseCollateral(caseId)` | Document checklist by eval type | evalType, referral, status (determines received/requested) |
| `makeCaseTests(caseId)` | Test battery with scored/in-progress status | tests[], feigning, status |
| `makeCaseValidity(caseId)` | Validity assessment summary | tests[], feigning |
| `makeCaseInterviews(caseId)` | Session list with duration | sessions, totalHrs, status |
| `makeCaseDiagnostics(caseId)` | Diagnostic formulation | dx, dxCode, feigning, tests, sessions, opinion |
| `makeCaseReport(caseId)` | Report with draft/final status | evalType, opinion, dx, dxCode, status |
| `makeCaseAudit(caseId)` | Generated audit trail from case data | All fields, generates events per stage |

### 11.3 Helper Functions

| Function | Purpose |
|----------|---------|
| `_pill(label, color)` | Renders colored status/severity pill |
| `_hdr(c)` | Opens content wrapper div (16px padding, 13px font) |
| `_pipeline(c)` | Renders 6-stage pipeline indicator with current position |
| `ovTab(caseId, btn, paneId)` | Switches overview summary tabs |
| `ovEdit(caseId, fnName)` | Opens full form in new editor tab |

---

## 12. Interaction Patterns

### 12.1 Tree → Tab Navigation

1. User clicks tree node
2. If node has children: toggle expanded/collapsed
3. If node has `contentFn`: call the function, open result as tab
4. If node has `caseId`: pass caseId to contentFn (for parameterized generators)
5. Active tree node highlighted with accent background

### 12.2 Dashboard → Case Navigation

1. User clicks row in dashboard case table
2. `activateCaseFromDashboard(caseId)` fires
3. Finds case node in treeData, sets expanded=true
4. If case has Clinical Overview child, opens it as tab
5. Tree re-renders with case node expanded and active

### 12.3 Overview Edit → Form Tab

1. User clicks "Edit" button on overview summary tab
2. `ovEdit(caseId, fnName)` fires
3. Looks up the full content generator function by name
4. Opens a new tab with the full form content
5. Original overview tab remains open (user can see summary alongside full form)

### 12.4 Filter → Re-render

1. User changes any dashboard filter (dropdown or text)
2. `dashFilterChange()` reads all filter values from DOM
3. Stores in module-level vars: `dashFilterType`, `dashFilterStatus`, `dashFilterSeverity`, `dashSearch`
4. Re-renders entire dashboard pane HTML via `getDashboardContent()`

---

## 13. CSS Class Index

### Layout
- `.app` — Root flex column, 100vh
- `.main-layout` — Flex row, flex 1
- `.left-column`, `.center-column`, `.right-column` — Column containers
- `.v-splitter`, `.h-splitter` — Draggable dividers
- `.titlebar` — Top bar
- `.panel-header` — Section headers (CASES, CONTEXT, etc.)

### Tree
- `.tree-node` — Individual tree item
- `.tree-node.active` — Selected node
- `.tree-chev` — Expand/collapse chevron
- `.tree-icn` — Node icon
- `.tree-label` — Node text
- `.tree-badge` — Blue pill badge
- `.tree-children` — Child container
- `.tree-children.collapsed` — Hidden children

### Tabs
- `.tab-bar` — Tab strip
- `.tab-btn` — Individual tab
- `.tab-btn.active` — Active tab
- `.tab-pane` — Tab content area

### Cards
- `.card` — Generic card container
- `.card-title` — Card header
- `.card-content` — Card body

### Overview Tabs
- `.ov-wrap` — Overview tab wrapper
- `.ov-tabs` — Tab bar
- `.ov-tab` / `.ov-tab.active` — Tab buttons
- `.ov-pane` / `.ov-pane.active` — Tab content
- `.ov-edit-btn` — Edit button
- `.ov-field` — Label/value pair
- `.ov-field-lbl` — Field label
- `.ov-field-val` — Field value

### Clinical Overview (Johnson)
- `.co` — Clinical overview wrapper
- `.co-tabs` / `.co-tab` — Internal tab system
- `.co-field` / `.co-field-lbl` — Form fields
- `.co-field-row` — Multi-column field layout
- `.co-divider` — Section heading separator

### Intake Form
- `.intake-form` — Form wrapper
- `.in-tabs` / `.in-tab` / `.in-pane` — Primary tabs
- `.ref-tabs` / `.ref-tab` / `.ref-pane` — Referral sub-tabs

### Gates
- `.gate-tab` / `.gate-tab.active` — Pipeline stage indicators
- `.gates-panel` — Bottom panel

### Status Bar
- `.statusbar` — Bottom bar

---

## 14. Architectural Principles Enforced in UI

1. **THE DOCTOR ALWAYS DIAGNOSES** — Diagnostics view shows red warning banner. AI suggestions labeled "for reference only." No "Accept All" button.
2. **No checkboxes on patient forms** — All clinical data captured via narrative text inputs.
3. **Audit everything** — Every case has an audit trail (complete cases show full trail, in-progress cases show it in tree).
4. **6-stage pipeline replaces gates** — Onboarding → Testing → Interview → Diagnostics → Review → Complete. More clinically meaningful than Gate 1/2/3.
5. **Stage-appropriate documents** — Tree contents match pipeline stage exactly. No document appears before its stage is reached.
6. **Edit-in-place pattern** — Overview shows summaries with Edit buttons that open full forms as tabs. Clinician never loses context.

---

## 15. Known Limitations (Prototype Only)

These are intentional prototype simplifications, NOT bugs:

1. **Embedded data** — CASE_DB is a JavaScript array in the HTML. Production uses SQLCipher.
2. **No persistence** — Changes to forms/filters don't persist (except splitter widths). Production uses SQLCipher.
3. **Johnson-only detail** — Only c001 has full richcontent. Other cases use parameterized generators. Production will have full content for all cases.
4. **No OnlyOffice** — Report tabs show HTML content, not embedded OnlyOffice editor. Production embeds OnlyOffice.
5. **No PII detection** — No Python sidecar in prototype. Production has full Presidio pipeline.
6. **No real auth** — Avatar shows "TI" statically. Production uses Auth0 PKCE.
7. **Single HTML file** — Everything in one file for portability. Production is Electron + React + TypeScript.
8. **No responsive design** — Fixed minimum widths assume desktop. This is a desktop-only application.

---

*This document is the definitive reference for implementing the production UI. Every pixel, every interaction, every color is documented above. When in doubt, open `Psygil_UI_Prototype_v4.html` in a browser and match it exactly.*
