# Psygil UI Visual & Interaction Spec — v4 Prototype Reference
**Source:** `Psygil_UI_Prototype_v4.html` (4,711 lines, 382KB)
**Purpose:** Preserve every visual, layout, color, and interaction decision from the v4 prototype for engineering handoff. This is the authoritative reference for what the real Electron app must look and feel like.
**Last updated:** 2026-03-26

---

## 1. Design Philosophy

Psygil is an **IDE-style clinical desktop app**, not a SaaS dashboard. The visual reference is VS Code / Cursor — dense, information-rich, professional. Not consumer. Not flashy. Every pixel earns its place.

**Core principle carried into every UI decision:** THE DOCTOR ALWAYS DIAGNOSES. The UI must never imply that the software is making clinical decisions. Buttons, labels, and agent interactions are always framed as tools serving the clinician's judgment.

---

## 2. CSS Design Tokens (7 tokens — lock these in)

These 7 CSS variables drive the entire UI. All colors in the app reference these tokens. No hardcoded colors except pipeline stage colors (see §6).

```css
:root {
    --bg: #ffffff;
    --panel: #f3f3f3;
    --border: #e0e0e0;
    --text: #1e1e1e;
    --text-secondary: #666666;
    --accent: #0078d4;
    --highlight: #e8f4fd;
}
```

**These tokens change per theme. All three themes must be supported:**

| Token | Light | Medium (Warm Parchment) | Dark |
|-------|-------|------------------------|------|
| `--bg` | `#ffffff` | `#faf8f4` | `#0d1117` |
| `--panel` | `#f3f3f3` | `#e6ddd0` | `#161b22` |
| `--border` | `#e0e0e0` | `#cec4b5` | `#30363d` |
| `--text` | `#1e1e1e` | `#2c2418` | `#c9d1d9` |
| `--text-secondary` | `#666666` | `#6b5d4f` | `#8b949e` |
| `--accent` | `#0078d4` | `#8b5e3c` | `#58a6ff` |
| `--highlight` | `#e8f4fd` | `#f0e6d6` | `#1f4b7c` |

Theme is toggled by cycling `data-theme` attribute on `<html>`. All CSS references tokens only — zero hardcoded colors in components.

---

## 3. Typography

- **UI font:** Inter (Google Fonts) — 400, 500, 600, 700
- **Monospace (code/data):** JetBrains Mono — 400, 500 at 11px
- **Document editor:** Times New Roman 12pt (APA/legal standard)
- **Global base:** Inter, sans-serif

Font size scale used in UI:
- Panel headers: 11px, uppercase, 600 weight, 0.5px letter-spacing
- Tree labels: 13px, 400 weight
- Tab labels: 12px
- Body content: 13px
- Small/secondary labels: 11px, uppercase
- Statusbar: 11px

---

## 4. Application Chrome

### 4.1 Titlebar (height: 36px)

Three columns mirroring the three-column layout below:

| Column | Width | Content |
|--------|-------|---------|
| Col 1 (left) | 280px fixed | App logo SVG + "PSYGIL" wordmark (15px, 2px letter-spacing) |
| Col 2 (center) | flex: 1 | Nav links: **Setup · Intake · Onboarding · Docs** |
| Col 3 (right) | 320px fixed | Settings icon (⚙ 22px) · Theme toggle (☀) · User avatar (28px circle, initials "TI") · Username "Dr. Irwin" |

Titlebar uses `--panel` background with `--border` bottom border. Column boundaries have `--border` right borders.

**Nav link style (`.tb-link`):**
- 12px, `--text-secondary`, `font-weight: 500`
- Hover: `--accent` color + underline with `--accent`
- Cursor: pointer

**Icons (`.titlebar-icon`):**
- 18×18px, `--text-secondary`
- Hover: `--accent`

**User avatar:**
- 28×28px circle, `--accent` background, white text, 600 weight, 12px

### 4.2 Statusbar (height: 24px, bottom)

`--panel` background, `--border` top border, 11px font, `--text-secondary`.

Left side items (separated by 16px gap):
- `● Connected` (green dot `#4caf50`, 8×8px circle)
- `LLM: Claude Sonnet`
- `PHI: UNID Redaction ✓`
- `Storage: Local`

Right side items:
- `12 active cases`
- `v0.1.0-alpha`

---

## 5. Three-Column Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  TITLEBAR (36px)                                                  │
├──────────┬──┬────────────────────────────┬──┬────────────────────┤
│          │  │                            │  │                    │
│  LEFT    │S │  CENTER                    │S │  RIGHT             │
│  280px   │P │  flex: 1                   │P │  320px             │
│          │L │                            │L │                    │
│  Case    │I │  Tab bar + Editor          │I │  Context +         │
│  Explorer│T │  + Pipeline bar            │T │  Writing Assistant │
│          │  │                            │  │                    │
├──────────┴──┴────────────────────────────┴──┴────────────────────┤
│  STATUSBAR (24px)                                                 │
└──────────────────────────────────────────────────────────────────┘
```

**Splitters:**
- Width: **2px exactly** (not 3, not 4)
- Color: `--border` at rest
- Color: `--accent` on hover and while dragging
- Cursor: `col-resize`
- During drag: `body.col-resizing` class prevents pointer events on all children except the active splitter

Same 2px rule applies to horizontal splitters (row splitters) — `cursor: row-resize`, `background: --border`, hover/drag → `--accent`.

---

## 6. Pipeline Stage Colors (immutable)

These 6 colors are hardcoded (not tokenized). They define the 6-stage clinical pipeline and must never change:

| Stage | Color |
|-------|-------|
| Onboarding | `#2196f3` (blue) |
| Testing | `#9c27b0` (purple) |
| Interview | `#e91e63` (pink) |
| Diagnostics | `#ff9800` (orange) |
| Review | `#ff5722` (deep orange) |
| Complete | `#4caf50` (green) |
| Archived | `#9e9e9e` (gray) |

These colors appear in: pipeline stage pills, case tree badge contexts, stage indicators in the evaluation pipeline bar, document-type labels.

**Pipeline pill rendering:**
- Past stages: opacity 0.5, stage color background, white text, `✓` prefix
- Current stage: full opacity, stage color background, white text, `●` prefix, font-weight 600
- Future stages: border-only pill, `--border` border, `--text-secondary` text, `○` prefix

---

## 7. Left Column — Case Explorer

### 7.1 Panel Header (32px)
`--panel` background, `--border` bottom border, 11px uppercase, 600 weight, 0.5px letter-spacing, `--text-secondary`.

Header for Cases panel includes right-aligned action buttons:
- `＋` New Case
- `⊞` Browse Cases
- `↑` Import Case

Buttons (`.panel-hdr-btn`): 20×20px, border-radius 3px, hover → `--highlight` background + `--accent` color.

### 7.2 Tree Nodes

```
[chevron 16px][icon 16px][label flex:1][badge optional]
```

- Padding: 3px vertical, `var(--indent, 8px)` left (set per-level via CSS variable)
- Font: 13px, `--text`
- Hover: `--highlight` background
- Active/selected: `--accent` background, white text (icon turns white too)
- Chevron: 10px, `--text-secondary`, rotated 90° when expanded, `hidden` when no children
- Icon: 14×14px SVG inside 16×16px container, `--text-secondary`
- Label: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Badge: `--accent` background, white, 10px, 600 weight, border-radius 3px, padding 1px 5px

**Collapse/expand:** `.tree-children` block → `.tree-children.collapsed` = `display: none`

### 7.3 Resources Panel

Sits below a horizontal splitter in the left column. Fixed at ~80px. Contains quick-access reference items (DSM-5-TR, statutes). 12px font, `--text-secondary`, pointer cursor, padding 8px 12px.

---

## 8. Center Column — Editor

### 8.1 Tab Bar (height: 32px)

`--panel` background, `--border` bottom border. Horizontally scrollable, no visible scrollbar.

**Tab (`.tab`):**
- Height: 32px, padding 0 12px
- `--border` right border between tabs
- 12px font, `--text-secondary`
- Hover: `--text` color, `--highlight` background
- Active: `--text` color, `--bg` background, **2px `--accent` bottom border**, 500 weight

**Tab close button (`.tab-close`):**
- 16×16px, opacity 0 at rest
- Appears (opacity 0.6) on tab hover or when tab is active
- Hover on close: opacity 1, `rgba(0,0,0,0.1)` background

### 8.2 Tab Content Area

Absolute-positioned panes (`position: absolute; top:0; left:0; right:0; bottom:0`). Only active pane has `display: block` — others `display: none`. Panes scroll internally.

Default pane padding: `20px 24px`.

### 8.3 Word/Document Editor Mode

When a tab has `isWord: true` (evaluation reports), the center column renders:

**Word toolbar** above the content area:
- Two rows: tab row (Home, Insert, Review, etc.) + tools row
- Tool buttons: 3px 6px padding, hover → `--highlight` + border
- Font select: small `<select>` with `--border` border
- Separator: 1px `--border` vertical line, 20px tall
- Toolbar tabs: 11px, active → `--accent` color + 2px accent underline

**Document editor area:**
- Max-width: 816px (8.5in at 96dpi)
- Margin: 20px auto (centered, scrollable background = `--panel`)
- Background: always `white` (not `--bg`) — it's a paper page
- Padding: 72px (1in margins)
- Min-height: 1056px (11in page)
- Font: Times New Roman 12pt, line-height 1.6
- Box-shadow: `0 1px 6px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)`

**AI draft sections** (AI-generated content awaiting clinician edit):
- Border: `2px dashed #ff9800`
- Background: `#fff8e1`
- Border-radius: 4px, padding 16px
- Label badge: `#ff9800` background, white text, uppercase, 10px, 700 weight

**Page ruler:**
- Max-width: 860px, height: 20px, `--panel` background
- 9px JetBrains Mono ticks

### 8.4 Pipeline Bar (height: 80px, bottom of center column)

`--panel` header (32px, uppercase "EVALUATION PIPELINE").

Stage pills row: `display: flex; gap: 4px; padding: 8px 12px; flex-wrap: wrap`.

Uses `.gate-tab` style:
- Default: `--panel` background, `--border` border, border-radius 4px, 12px font
- Active: `--accent` background, white text, `--accent` border

---

## 9. Right Column — Context + Writing Assistant

Split by horizontal splitter into two sections:

### 9.1 Upper — Context Panel (flex: 1, scrollable)

Panel header: "CONTEXT"

Three context sections (`.context-section`), each with `--border` bottom border, 12px padding:

1. **Case Notes** — Session notes with date/summary
2. **AI Agent Status** — 4 agents (Documenter, Diagnostician, Editor, Legal) with colored status dots
3. **Deadlines** — Court deadline, next action
4. **Quick Actions** — Buttons for primary case actions

Context section title: 11px, uppercase, 600 weight, `--text-secondary`, 0.3px letter-spacing.

### 9.2 Horizontal Splitter (2px, same rules as vertical)

### 9.3 Lower — Writing Assistant Chat (fixed height: 280px)

Panel header: "WRITING ASSISTANT" with clear (✕) button.

**Chat messages area (`.chat-messages`):**
- Flex column, gap 8px, padding 8px 10px
- Overflow-y: auto

**Message bubbles:**
- User: right-aligned, `--accent` background, white text, border-radius 8px / 2px bottom-right
- Assistant: left-aligned, `--panel` background, `--text`, border-radius 8px / 2px bottom-left
- Max-width: 88%, padding 8px 10px, 12px font, 1.5 line-height

**Input area:**
- `--panel` background, `--border` top border, padding 8px 10px
- Label row: "Writing Assistant" (10px uppercase) + send button (right-aligned)
- Textarea: `--bg` background, `--border` border, 12px font, 3 rows, border-radius 4px
- Textarea focus: `--accent` border
- Enter (no shift): sends message
- Send button: 32×32px, `--accent` background, white, border-radius 4px

---

## 10. Modal System

Four modals: Setup, Intake, Onboarding, Docs.

**Overlay (`.modal-overlay`):**
- `display: none` → `display: flex` when `.visible`
- `position: fixed; top:0; left:0; width:100%; height:100%`
- `background: rgba(0,0,0,0.55)` backdrop
- `z-index: 9999`
- `justify-content: center; align-items: flex-start; padding-top: 32px`
- Click outside container = close (only if `event.target === overlay`)
- Escape key = close

**Container (`.modal-container`):**
- `--panel` background, `--border` border, border-radius 8px
- Max-width: 880px (720px for Setup), width: 90%
- Max-height: `calc(100vh - 64px)`, overflow-y: auto
- Box-shadow: `0 12px 40px rgba(0,0,0,0.3)`

**Header:**
- Sticky (position: sticky, top: 0), `--panel` background, z-index 1
- 14px 600-weight title
- Close button: ✕, 18px, hover → `--border` background

---

## 11. Intake Form

**Referral type toggle:** Court-Ordered / Attorney-Referred / Self-Referred / Walk-In  
Toggle style: bordered button group, active = `--accent` background + white text.

Key fields: Patient Last/First/MI, DOB, Gender (M/F/NB/Other), Eval Type dropdown, Referral Source, Presenting Complaint (textarea), Jurisdiction, Charges (if applicable), Attorney, Report Deadline.

Draft save + Submit buttons at bottom.

---

## 12. Onboarding Form (Biopsychosocial History)

**Mode toggle (top of form):**
- Patient Self-Report | Clinician Interview Review
- Toggle = bordered button group, active = `--accent`

**9 tabbed sections:**
1. Contact & Personal *(carried over from intake — readonly)*
2. Presenting Complaints *(narrative only, no checklists)*
3. Family History
4. Education & Employment
5. Medical & Health
6. Mental Health History
7. Substance Use
8. Legal History
9. Recent Events

**Per-section pattern:**
- Section title: 13px, uppercase, 600 weight, `--accent` color
- Verified badge (top right): "Patient-Reported" (yellow pill) → "Under Review" in clinician mode
- Input fields: `--bg` background, `--border` border, 7px 10px padding, 13px font
- Textarea: `resize: vertical`, min-height 72px
- Clinician verification note (hidden in self-report mode, visible in clinician mode): `--panel` background, `--accent` left border, label in `--accent`

**Navigation:** "Save Draft" + "Save & Continue →" buttons per section. Last section: "Save Draft" + "Generate Clinical Overview" + "Complete Onboarding".

**Data fidelity notice** (prominent, shown at top):
> "Patient-reported information will be cleaned for grammar and spelling, then translated to clinical language for the case overview. Every reported element (a, b, x, y, z) will be preserved in the clinical notes — nothing is omitted or summarized away."

---

## 13. Clinical Overview Tab

This is the primary view that opens when clicking a case name in the tree.

### Header section (always shown):
- Case name + evaluation type as H1 (16px, 600 weight)
- Pipeline indicator row (past stages = 50% opacity, current = full + 600 weight, future = border-only)
- Metadata row: Case #, Eval Type, Status pill, Severity pill, Sessions count + hours
- Diagnosis line (if diagnosed): dx name + ICD-10 code
- Opinion block (if opinion rendered): left-bordered panel, `--accent` 3px left border, `--panel` background

### Tabbed sub-sections (`.ov-tabs`):

Tabs: 12px, 500 weight, `--text-secondary`, active = `--accent` + 2px bottom border, hover = `--text`.

Tab content varies by pipeline stage. Standard tabs:
- **Summary** — demographics grid + referral details
- **Collateral** — document list with status (Received/Requested) + page counts + summary text
- **Testing** — test battery table (instrument, category, items, time, description, score status)
- **Interview** — session list with title, duration, topics, interview notes
- **Diagnostics** — dx formulation (visible at stage 3+)
- **Opinion** — final forensic opinion (visible at stage 4+)

Edit buttons (`.ov-edit-btn`): float right, 11px, `--accent` background, white, border-radius 3px — open full form in new center tab.

**Info grid** (2-column, for demographic/referral data):
- `--highlight` background cells, border-radius 4px, 8px padding
- Label: 11px `--text-secondary`, Value: 13px 500 weight

---

## 14. Diagnostics Stage UI

The Diagnostics view (`getGate2Content`) renders per DSM-5-TR diagnostic category.

**Each diagnostic consideration:**
- Category header (DSM-5-TR category)
- Diagnosis name + ICD-10 code
- Evidence summary mapped from test results + interview data
- **Decision buttons: Confirm / Rule Out / Defer / Modify**
- **NO "Accept All" button — this is hardcoded in the spec and must never appear**
- Reasoning textarea (required before confirming)

This is the most safety-critical UI in the app. The framing must always present the AI as organizing evidence, never as recommending a diagnosis.

---

## 15. Settings Modal

Accessible via ⚙ icon in titlebar or Cmd+,

Tabs:
- Storage (Local / Shared Drive / Cloud)
- AI / API Keys (stored in macOS Keychain)
- Diagnosis Catalog (custom eval types)
- Themes (preview + select)
- Audit Trail (Decision Record Only vs. Full Record)
- About / Version

---

## 16. Dashboard (first tree item)

KPI cards row + pipeline stage breakdown.

**KPI cards (4 cards):**
- Active Cases, Diagnostics Stage, Overdue, Completed This Month
- `--panel` background, `--border` border, border-radius 4px, padding 12px

**Pipeline stage cards (6 cards, one per stage):**
- Background = stage color at low opacity
- Stage name + count from `CASE_DB`

---

## 17. Interaction Rules (clickthrough preservation)

| Interaction | Behavior |
|-------------|----------|
| Tree node click | Opens content in new center tab (if not already open) or activates existing tab |
| Tree node re-click | Switches to existing open tab |
| Tab close (✕) | Closes tab, activates previous tab or blank state |
| Splitter drag | Resizes adjacent columns; `col-resizing` class on body during drag blocks pointer events on all children except splitter |
| Theme toggle (☀) | Cycles Light → Medium → Dark → Light via `data-theme` on `<html>` |
| Modal open | Renders content dynamically into modal body (not pre-rendered) |
| Modal close | Click ✕, click backdrop, or press Escape |
| Onboarding tab nav | `obTab()` — deactivates all tabs/panes, activates clicked tab + corresponding pane |
| Clinical overview sub-tabs | `ovTab()` — same deactivate/activate pattern |
| Edit button in overview | Opens full form as new center tab |
| Pipeline stage tabs | `.gate-tab` active/inactive toggle |
| Writing assistant send | Enter (no shift) or click send button; appends user bubble + AI response bubble |
| Chat clear | Replaces chat messages container with welcome message |

---

## 18. Scroll Behavior

- All scrollable areas: custom scrollbar, 8×8px, `--border` track, `--bg` background, `--text-secondary` thumb on hover, border-radius 4px
- `body { overflow: hidden }` — no full-page scroll; all scrolling is within individual panels
- Document editor area: full overflow-y scroll within content area

---

## 19. Keyboard Shortcuts (planned)

| Shortcut | Action |
|----------|--------|
| ⌘N | New Case |
| ⌘I | Open Intake Form |
| ⌘O | Open Onboarding Form |
| ⌘W | Close Active Tab |
| ⌘1 / ⌘2 / ⌘3 | Focus Column 1/2/3 |
| ⌘, | Settings |
| ⌘K | Command Palette |
| ⌘E | Export Report (.docx) |
| Esc | Close Modal / Cancel |

---

## 20. Table Styling

```css
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: --panel; padding: 6px 10px; text-align: left; 600 weight; border: 1px solid --border; }
td { padding: 6px 10px; border: 1px solid --border; }
tr:nth-child(even) td { background: --highlight; }
```

Elevated rows (for critical flagged data): `--accent` background, white text, 500 weight.

---

## 21. Severity Pill Colors

| Severity | Color |
|----------|-------|
| Low | `#4caf50` |
| Moderate | `#ff9800` |
| High | `#f44336` |
| Very High | `#9c27b0` |

---

## 22. AI Agent Status Indicators

Four agents shown in Context panel. Status dot colors:
- Idle: `#4caf50` (green)
- Active/Working: `#2196f3` (blue)
- Awaiting Input: `#ff9800` (orange)
- Error: `#f44336` (red)

Status dot: 8×8px circle, `display: inline-block`, `margin-right: 4px`.

---

## 23. Logo

Custom SVG polygon logo included in titlebar. The logo renders at 22×22px inline. It's a stylized face/mask shape in orange (`#E8650A`), deep orange (`#D45A00`), amber (`#F5A623`), with dark (`#1a1a2e`) detail polygons and white eye highlights. The SVG is embedded directly (no external file required for the titlebar).

Standalone logo SVG is at `psygil_logo.svg` in the project root.

---

## 24. What Must NOT Change

These decisions are locked. Do not debate or "improve" them in Sprint 1:

1. **Splitters are 2px.** Not 3. Not 4. Not "auto." 2px.
2. **7 CSS tokens only.** No new color variables without updating all 3 themes.
3. **Pipeline stage colors are fixed.** The 6 hex values above are the brand.
4. **No "Accept All" in Diagnostics.** Ever. Not as a convenience feature. Not as a power-user option.
5. **Document editor background is always white** (`#ffffff`), regardless of theme. It's a paper page.
6. **THE DOCTOR ALWAYS DIAGNOSES.** No UI element suggests the AI is making clinical decisions.
7. **Three themes required from day one.** Light, Medium, Dark. They are all in scope for Sprint 1.4.
8. **Right column width: 320px.** Left column: 280px. These match the titlebar column widths exactly.

---

*This document was generated from full source analysis of `Psygil_UI_Prototype_v4.html`. Keep it updated as the prototype evolves.*
