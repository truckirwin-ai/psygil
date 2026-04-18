# Psygil Mercury Reskin Implementation Plan
**Version:** 1.0
**Date:** April 18, 2026
**Status:** Ready for approval

---

## Objective

Apply Mercury's design language (white backgrounds, 1px borders, tight spacing, information-dense layout, minimal color, Inter font, monoline icon set) to the Psygil Electron app. Preserve every piece of functionality, every button, every dropdown, every expandable section. Change only the visual appearance.

Keep the Psygil logo (orange geometric SVG in Titlebar.tsx).

---

## Current State

| Metric | Value |
|---|---|
| CSS files | 5 (tokens.css, global.css, 3 module.css) |
| CSS lines | 732 |
| Inline style instances | ~1,845 across 30 components |
| Icon system | Emoji unicode (no library) |
| Themes | 3 (light, warm, dark) |
| Font | Inter (system fallback) + JetBrains Mono |
| Primary accent | #0078d4 (Microsoft blue) |

---

## Target State (Mercury Design Language)

### Color Token Changes

The reskin replaces token VALUES, not token NAMES. The existing `var(--*)` system stays intact. The theme mechanism stays intact. Only the hex values change.

**Light theme token remapping:**

| Token | Current (light) | Mercury Target | Rationale |
|---|---|---|---|
| `--bg` | #ffffff | #ffffff | Same (white) |
| `--panel` | #f3f3f3 | #fafafb | Lighter, less gray |
| `--border` | #e0e0e0 | #eaeaec | Slightly warmer gray |
| `--text` | #1e1e1e | #1a1a2e | Slightly navy-tinted |
| `--text-secondary` | #666666 | #5c5c70 | Mercury's medium gray |
| `--accent` | #0078d4 | #4f46e5 | Mercury indigo (biggest visual change) |
| `--highlight` | #e8f4fd | #f0eeff | Indigo-tinted instead of blue-tinted |
| `--bg-soft` | #e9ecef | #f5f5f7 | Mercury's off-white |
| `--accent-soft` | rgba(0,120,212,0.08) | rgba(79,70,229,0.08) | Match new accent |
| `--field-bg` | #ffffff | #ffffff | Unchanged |
| `--field-text` | #1e1e1e | #1a1a2e | Match text |
| `--danger` | #d32f2f | #dc2626 | Tailwind red-600 |
| `--warn` | #e65100 | #d97706 | Tailwind amber-600 |
| `--success` | #2e7d32 | #059669 | Tailwind emerald-600 |
| `--info` | #0277bd | #2563eb | Tailwind blue-600 |

**Warm theme:** keep as-is (cream palette is already distinct from Mercury)

**Dark theme token remapping:**

| Token | Current | Mercury Target |
|---|---|---|
| `--bg` | #2b2f36 | #1a1a2e | Darker, navy-tinted |
| `--panel` | #1f2329 | #12121e | Deeper |
| `--border` | #31363e | #2a2a3e | Navy-tinted border |
| `--text` | #c8ccd2 | #d4d4dc | Slightly brighter |
| `--text-secondary` | #7d8590 | #6e6e82 | Mercury gray for dark |
| `--accent` | #6b93db | #818cf8 | Indigo-400 |
| `--highlight` | #2d3340 | #2a2a40 | Navy-tinted |

**New token additions:** none needed. Existing tokens already cover all Mercury use cases.

---

### Icon System Change

**Current:** Emoji unicode characters (📋, 📄, 📁, etc.)
**Target:** Lucide React icons (same family as Cursor, similar to VS Code's Codicons)

**Why Lucide:**
- 1,400+ icons, monoline/stroke style matching Mercury screenshots
- React component library (`lucide-react`) with tree-shaking
- 24x24 default, easily scaled to 16x16 or 14x14
- MIT license
- Used by shadcn/ui, Vercel, and Cursor-adjacent projects
- Size: ~3KB per icon (tree-shaken), ~15KB total for our usage

**Installation:** `npm i lucide-react` in `app/`

**Icon mapping (emoji to Lucide):**

| Location | Current Emoji | Lucide Icon | Component Name |
|---|---|---|---|
| **Settings sidebar** | | | |
| Practice | 🏥 | `Building2` | Settings nav |
| Data & Storage | 💾 | `HardDrive` | Settings nav |
| Writing Samples | ✍ | `PenTool` | Settings nav |
| Style Guide | 📐 | `Ruler` | Settings nav |
| Templates | 📋 | `FileText` | Settings nav |
| Documentation | 📖 | `BookOpen` | Settings nav |
| Appearance | 🎨 | `Palette` | Settings nav |
| AI & Models | 🤖 | `Brain` | Settings nav |
| Instruments | 🧪 | `FlaskConical` | Settings nav |
| Privacy | 🔒 | `Shield` | Settings nav |
| About | ℹ | `Info` | Settings nav |
| **File tree (LeftColumn)** | | | |
| Folder closed | 📁 | `Folder` | Tree node |
| Folder open | 📂 | `FolderOpen` | Tree node |
| Intake subfolder | 📋 | `ClipboardList` | Tree subfolder |
| Referral subfolder | 📄 | `FileText` | Tree subfolder |
| Testing subfolder | 📊 | `BarChart3` | Tree subfolder |
| Interviews subfolder | 🎙 | `Mic` | Tree subfolder |
| Diagnostics subfolder | ⚖ | `Scale` | Tree subfolder |
| Reports subfolder | 📝 | `FileEdit` | Tree subfolder |
| Archive subfolder | 📦 | `Archive` | Tree subfolder |
| PDF file | (extension) | `FileType` | Tree leaf |
| DOCX file | (extension) | `FileText` | Tree leaf |
| **Main nav (Titlebar/sidebar)** | | | |
| Home/Dashboard | -- | `Home` | Nav item |
| Cases | -- | `Briefcase` | Nav item |
| Pipeline | -- | `GitBranch` | Nav item |
| Reports | -- | `FileCheck` | Nav item |
| Audit Trail | -- | `ScrollText` | Nav item |
| Settings | -- | `Settings` | Nav item |
| **Tab icons** | | | |
| Close tab | × (text) | `X` | Tab close button |
| **Topbar** | | | |
| Search | text | `Search` | Search box |
| New Case | text | `Plus` | Button prefix |
| **Modals** | | | |
| Upload | various | `Upload` | Upload buttons |
| Document | 📄 | `File` | Document references |

---

### Spacing & Density Changes

These changes happen in `global.css` and inline styles:

**Panel headers (global.css `.panel-header`):**
- Height: 32px (keep)
- Font-size: 11px (keep)
- Padding: 0 12px -> 0 10px (tighter)

**Scrollbar (global.css):**
- Width: 8px -> 4px (Mercury-thin)
- Thumb radius: 4px -> 2px
- Thumb color: var(--border) -> #d0d0d8

**Title bar (Titlebar.tsx):**
- Keep existing Psygil SVG logo
- Reduce height from 36px to 32px if feasible (test with traffic lights on macOS)
- Font-size for nav links: 12px -> 12px (keep)
- Background: var(--panel) (keep, token value will change)

**Tab bar:**
- Tab padding: current -> 8px 14px
- Font-size: current -> 12px
- Active underline: var(--accent) (color changes via token)
- Add subtle bottom border on tab bar container

**Left column (LeftColumn.tsx):**
- Tree node padding: tighten to 4px 8px
- Tree node font-size: keep 12px
- Subfolder indent: keep current
- Replace emoji icons with Lucide components (14px size)

**Cards (inline styles across all tabs):**
- Border-radius: 4px -> 6px
- Padding: 12px -> 12px 16px (horizontal breathing room)
- Border: var(--border) (color changes via token)

---

### Specific Component Changes

#### 1. tokens.css (5 min)
- Update hex values for light theme (12 values)
- Update hex values for dark theme (8 values)
- Keep warm theme unchanged
- No structural changes

#### 2. global.css (10 min)
- Scrollbar: thinner (4px), subtler thumb
- `.panel-header`: tighter horizontal padding
- Form inputs focus: keep outline pattern but change color via token
- Add `.tab-bar` bottom border style

#### 3. Titlebar.tsx (15 min)
- Keep Psygil SVG logo untouched
- Replace text nav labels with Lucide icons + text
- Tighten padding
- Keep drag region behavior
- Keep alignment logic (left/right column width sync)

#### 4. LeftColumn.tsx (30 min)
- Replace all emoji icons with Lucide components
- Keep tree structure, expand/collapse, drag-drop, file watching
- Tighten node padding
- Keep stage color dots (left border or dot indicator)
- Keep click handlers, context menu, all interactivity

#### 5. CenterColumn.tsx (45 min, largest file)
- Replace tab button styling with Mercury tab pattern
- Replace emoji in tab labels with Lucide icons
- Tighten grid gaps
- Notes panel border-left: 1px solid var(--border)
- Notes panel background: var(--bg) instead of var(--panel)
- Keep ALL tab routing, notes panel wrapping, save logic
- 432 inline styles: most will auto-adjust via token changes; ~30 need manual padding/radius tweaks

#### 6. SettingsTab.tsx (20 min)
- Replace emoji section icons with Lucide components
- Keep all section content, all inputs, all handlers
- Sidebar nav items: apply Mercury nav-item pattern (6px 8px padding, 6px radius)
- Card styles: adjust radius/padding where inline

#### 7. DashboardTab.tsx (20 min)
- Pipeline stage cards: adjust to Mercury pipeline style (tighter, 6px radius)
- Kanban cards: tighter padding, thinner borders
- Chart colors: update to use new accent
- Keep all drag-drop, all click handlers, all data binding

#### 8. DiagnosticsTab.tsx (20 min)
- Warning banner: keep red, tighten padding
- Decision pills: adjust to Mercury pill style
- Validity card: green tint stays
- Diagnosis cards: adjust expand/collapse header styling
- Keep ALL decision logic, save handlers, expand state
- DSM-5-TR Reference panel: adjust colors

#### 9. EvalReportTab.tsx (15 min)
- Toolbar buttons: Mercury button style
- Phase buttons: adjust colors to match new tokens
- Consistency badge: already Mercury-style
- Export buttons: already Mercury-style
- Report preview: keep white background (report tokens)
- Annotation styling: adjust severity colors

#### 10. TestResultsTab.module.css (10 min)
- Sub-tab bar: adjust to Mercury tab pattern
- Tables: adjust header/row styling
- Score cards: adjust radius/spacing

#### 11. EvidenceMapTab.module.css (10 min)
- Diagnosis sections: adjust header/body styling
- Evidence tables: adjust to Mercury table pattern
- Confidence bars: update colors

#### 12. DocumentViewerTab.module.css (5 min)
- Document selector: adjust to Mercury select style
- Document body: adjust spacing

#### 13. Other components (30 min total)
- AttestationTab.tsx: adjust card/form styling
- AuditTrailTab.tsx: adjust table styling
- ClinicalOverviewTab.tsx: adjust info grid styling
- DataConfirmationTab.tsx: adjust checkbox/status styling
- RightColumn.tsx: adjust notes panel styling
- All modals: adjust border-radius, button styles
- ScoreImportModal.tsx: replace emoji
- DocumentUploadModal.tsx: replace emoji

---

## Files Changed (exhaustive list)

### Must Change (16 files):

| File | Change Type | Effort |
|---|---|---|
| `styles/tokens.css` | Token values | 5 min |
| `styles/global.css` | Scrollbar, panel-header, inputs | 10 min |
| `app/theme.ts` | Dark theme preview colors | 5 min |
| `layout/Titlebar.tsx` | Nav icons, padding | 15 min |
| `layout/LeftColumn.tsx` | File tree emoji -> Lucide | 30 min |
| `layout/CenterColumn.tsx` | Tab styling, notes panel | 45 min |
| `tabs/SettingsTab.tsx` | Section icons, nav items | 20 min |
| `tabs/DashboardTab.tsx` | Kanban cards, pipeline | 20 min |
| `tabs/DiagnosticsTab.tsx` | Cards, decision controls | 20 min |
| `tabs/EvalReportTab.tsx` | Toolbar, phase buttons | 15 min |
| `tabs/AuditTrailTab.tsx` | Table styling | 10 min |
| `tabs/ClinicalOverviewTab.tsx` | Info grids | 10 min |
| `tabs/AttestationTab.tsx` | Form styling | 10 min |
| `tabs/TestResultsTab.module.css` | Tables, tabs | 10 min |
| `tabs/EvidenceMapTab.module.css` | Diagnosis sections | 10 min |
| `tabs/DocumentViewerTab.module.css` | Selector, body | 5 min |

### Likely Change (8 files):

| File | Change Type | Effort |
|---|---|---|
| `tabs/DataConfirmationTab.tsx` | Status styling | 5 min |
| `layout/RightColumn.tsx` | Notes panel bg | 5 min |
| `modals/IntakeOnboardingModal.tsx` | Form styling | 10 min |
| `modals/ScoreImportModal.tsx` | Emoji, buttons | 5 min |
| `modals/DocumentUploadModal.tsx` | Emoji, buttons | 5 min |
| `setup/FirstRunModal.tsx` | Button styling | 5 min |
| `settings/BrandingPanel.tsx` | Card styling | 5 min |
| `settings/DangerZone.tsx` | Button styling | 5 min |

### New File (1):

| File | Purpose |
|---|---|
| `package.json` | Add `lucide-react` dependency |

### Not Changed:

- Psygil logo SVG in Titlebar.tsx (preserved)
- All IPC handlers, data flow, save logic
- All agent integration
- All modal behavior
- Preload/main process code
- All 48 component structures (only styles within them)
- Theme toggle mechanism (3 themes stay)

---

## Execution Sequence

**Phase 1: Foundation (tokens + global + icons)** -- 30 min
1. `npm i lucide-react` in app/
2. Update tokens.css light theme values
3. Update tokens.css dark theme values
4. Update global.css (scrollbar, panel-header, inputs)
5. Update theme.ts preview colors
6. Build, verify: app renders with new colors, no broken layouts

**Phase 2: Layout shell (titlebar + sidebar + tabs)** -- 1.5 hr
7. Titlebar.tsx: add Lucide imports, replace nav icons, tighten padding
8. LeftColumn.tsx: replace emoji map with Lucide components
9. CenterColumn.tsx: tab button styling, notes panel styling
10. Build, verify: sidebar renders with icons, tabs look correct, notes panel border correct

**Phase 3: Tab content (heaviest phase)** -- 2 hr
11. DashboardTab.tsx: pipeline cards, kanban cards
12. DiagnosticsTab.tsx: cards, decision controls, validity card
13. EvalReportTab.tsx: toolbar, phase buttons
14. SettingsTab.tsx: section icons, nav items
15. AuditTrailTab.tsx: table styling
16. ClinicalOverviewTab.tsx: info grids
17. AttestationTab.tsx: form styling
18. Build after each file, verify no broken layouts

**Phase 4: Module CSS + modals** -- 30 min
19. TestResultsTab.module.css
20. EvidenceMapTab.module.css
21. DocumentViewerTab.module.css
22. All modals: styling adjustments
23. DangerZone, BrandingPanel adjustments

**Phase 5: Polish + verify** -- 30 min
24. Full build
25. Cycle through all 3 themes
26. Open every tab, verify rendering
27. Test expand/collapse, buttons, dropdowns
28. Commit + push + deploy

**Total estimated time: 5 hours**

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Inline styles override CSS tokens | Most inline styles already use `var(--*)`. The token value change handles ~70% of the reskin automatically. Remaining ~30% are direct hex values that need manual replacement. |
| Lucide bundle size | Tree-shaking ensures only imported icons ship. Expected ~15-20KB additional. |
| Dark theme contrast issues | Test every screen in dark theme after token changes. The dark palette needs the most tuning. |
| Stage colors (onboarding/testing/etc.) are hardcoded | These are intentionally distinct from the accent color and should be preserved as-is. |
| Warm theme may clash with Mercury palette | Warm theme is intentionally cream/parchment; do not Mercury-ify it. Only light and dark get the Mercury treatment. |
| CenterColumn.tsx is 2000+ lines | Work carefully, change only style-related properties. Build after every file. |

---

## What Does NOT Change

- Psygil SVG logo
- 3-column layout with resizable splitters
- Tab routing logic
- Notes panel 70/30 split
- All IPC handlers and data persistence
- All agent integration (ingestor, diagnostician, writer, editor)
- Pipeline stage progression and gate logic
- Drag-and-drop in kanban
- All modal behavior
- File watcher / workspace sync
- Authentication flow
- License validation
- Audio transcription
- Theme toggle (still 3 themes)
- Warm theme palette

---

*This plan changes the paint, not the plumbing.*
