# Task 1.4 — Three-Column Layout (Cole)

## YOUR ROLE
You are Cole, a full-stack engineer agent. Build the three-column IDE-style layout for Psygil.

## PROJECT LOCATION
`/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil`

## MANDATORY: READ FIRST
Before writing any code, read:
1. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/BUILD_MANIFEST.md`
2. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/25_UI_Visual_Spec_v4.md` — THIS IS YOUR PRIMARY REFERENCE. Read every section.
3. `/Users/truckirwin/Desktop/Foundry SMB/Products/Psygil/docs/engineering/13_UI_Design_Lock_v4.md` — Design lock document

## DEPENDENCY
Task 1.1 (scaffold) must be done first. `app/src/renderer/` must exist.

## YOUR TASK: Task 1.4 — Three-column layout from v4 prototype

## ACCEPTANCE CRITERIA
- Layout matches prototype exactly: 280px left / flex center / 320px right
- All 3 themes work: Light, Medium, Dark (7 CSS tokens only — see spec §2)
- Splitters are exactly 2px, draggable, turn --accent on hover/drag
- 6 pipeline stage colors render correctly in the pipeline bar
- Titlebar matches: logo + nav links left, settings/theme/avatar right
- Statusbar renders at bottom
- No broken layouts, no hardcoded colors (tokens only)

## WHAT TO BUILD
Replace `app/src/renderer/src/App.tsx` with the full layout:

```
app/src/renderer/src/
  App.tsx                   (root layout component)
  styles/
    tokens.css              (7 CSS tokens, all 3 themes via data-theme)
    global.css              (reset, body, scrollbars)
  components/
    layout/
      Titlebar.tsx
      Statusbar.tsx
      LeftColumn.tsx        (placeholder tree panel + resources panel)
      CenterColumn.tsx      (placeholder tab bar + content area + pipeline bar)
      RightColumn.tsx       (placeholder context panel + chat panel)
      VSplitter.tsx         (draggable 2px vertical splitter)
      HSplitter.tsx         (draggable 2px horizontal splitter)
```

## DESIGN CONSTRAINTS (non-negotiable — from spec §24)
1. Splitters are 2px EXACTLY. Not 3. Not 4.
2. 7 CSS tokens only: --bg, --panel, --border, --text, --text-secondary, --accent, --highlight
3. Pipeline stage colors are hardcoded hex (not tokenized): #2196f3, #9c27b0, #e91e63, #ff9800, #ff5722, #4caf50
4. No "Accept All" button anywhere
5. Document editor background always white regardless of theme
6. Left column: 280px. Right column: 320px. These match titlebar column widths.
7. Three themes required: Light, Medium, Dark — all values in spec §2

## LAYOUT DIMENSIONS (from spec §4-5)
- Titlebar height: 36px
- Statusbar height: 24px
- Tab bar height: 32px
- Panel headers: 32px
- Pipeline bar: 80px
- Font: Inter (UI), JetBrains Mono (mono/code)

## SPLITTER BEHAVIOR
- Drag to resize adjacent columns
- `body.col-resizing` class during drag — blocks pointer events on children (except splitter)
- Cursor: col-resize during drag
- Persist column widths in localStorage

## THEMES
Theme cycles Light → Medium → Dark on ☀ icon click in titlebar.
Set `data-theme` attribute on `<html>` element.
All 3 theme token values are in spec §2 — use them exactly.

## PANELS (placeholders for Sprint 1)
- Left column: show "CASES" panel header + empty tree area + "RESOURCES" section
- Center column: show tab bar (empty) + content area (show "Open a case to begin") + pipeline bar with 6 stage tabs
- Right column: show "CONTEXT" panel (empty) + splitter + "WRITING ASSISTANT" panel with chat input

## CONSTRAINTS
- Placeholder content only — no real data, no case loading logic
- Do NOT build any modal, form, or business logic
- Do NOT touch main process, preload, or database
- TypeScript + React 19

## DONE WHEN
App renders the full three-column layout. Theme cycling works. Splitters are draggable. Pipeline bar shows 6 stages with correct colors. No layout breaks on resize.

## NOTIFY WHEN DONE
When completely finished, run:
`openclaw system event --text "Task 1.4 done: three-column layout, 3 themes, 2px splitters, pipeline bar" --mode now`
