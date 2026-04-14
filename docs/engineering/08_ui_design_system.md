# Psygil UI Design System

## Overview
Psygil UI follows a clean, minimal, Linear.app-inspired aesthetic with medical dashboard sensibilities. The system emphasizes clarity, keyboard navigation, and high information density (Bloomberg Terminal compact style) while maintaining elegance.

**Key Principles:**
- Linear, all the way — clean and fast
- Compact density — more information per pixel
- Darkly tinted sidebar with icon navigation
- Card-based layouts with soft rounded corners
- Themed throughout with CSS custom properties
- Single brand variable for future name changes

---

## Color System

### Light Theme
```css
--bg-page: #FAFBFC;
--bg-surface: #FFFFFF;
--bg-surface-secondary: #F9FAFB;
--bg-hover: #F3F4F6;

--text-primary: #1A1A2E;
--text-secondary: #4A4A68;
--text-tertiary: #8E8EA0;

--accent-primary: #0EA5E9;
--accent-primary-hover: #0284C7;
--accent-secondary: #06B6D4;

--status-success: #22C55E;
--status-warning: #F59E0B;
--status-error: #EF4444;
--status-info: #3B82F6;

--border-default: #E5E7EB;
--border-subtle: #F3F4F6;

--sidebar-bg: #F8F9FA;
--sidebar-border: #E5E7EB;
```

### Medium Theme
```css
--bg-page: #1E1E2E;
--bg-surface: #252536;
--bg-surface-secondary: #2C2C3E;
--bg-hover: #34344A;

--text-primary: #E4E4E7;
--text-secondary: #A1A1AA;
--text-tertiary: #71717A;

--accent-primary: #38BDF8;
--accent-primary-hover: #0EA5E9;
--accent-secondary: #06B6D4;

--status-success: #86EFAC;
--status-warning: #FBBF24;
--status-error: #F87171;
--status-info: #60A5FA;

--border-default: #3F3F50;
--border-subtle: #2D2D3F;

--sidebar-bg: #1A1A28;
--sidebar-border: #2D2D3F;
```

### Dark Theme
```css
--bg-page: #0F0F1A;
--bg-surface: #18182B;
--bg-surface-secondary: #20203A;
--bg-hover: #282844;

--text-primary: #F4F4F5;
--text-secondary: #A1A1AA;
--text-tertiary: #52525B;

--accent-primary: #38BDF8;
--accent-primary-hover: #0EA5E9;
--accent-secondary: #06B6D4;

--status-success: #4ADE80;
--status-warning: #FACC15;
--status-error: #F87171;
--status-info: #60A5FA;

--border-default: #2D2D3F;
--border-subtle: #1F1F35;

--sidebar-bg: #0F0F18;
--sidebar-border: #1F1F35;
```

### Theme-Agnostic Shadows
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

---

## Typography

### Font Stack
- **Primary:** Inter (sans-serif)
- **Monospace:** "SF Mono", "JetBrains Mono", monospace
  - Used for: Scores, codes, case IDs, numeric data

### Type Scale (compact for information density)

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| Page Title | 18px | 600 | 1.4 | Major screen headings |
| Section Header | 14px | 600 | 1.4 | Subsection titles |
| Body | 13px | 400 | 1.5 | Default paragraph text |
| Small/Label | 11px | 500 | 1.4 | Form labels, badges, figure captions |
| Monospace Data | 12px | 400 | 1.4 | Scores, codes, technical values |
| KPI Value | 24px | 700 | 1.2 | Large numeric data in cards |
| Monospace KPI | 20px | 700 | 1.2 | Large code/score values |

### Font Weights
- 400: Regular text
- 500: Labels, small UI text
- 600: Headings, emphasis
- 700: Large values, strong emphasis

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Tight, micro spacing |
| `--space-sm` | 6px | Small gaps |
| `--space-md` | 8px | Default spacing |
| `--space-lg` | 12px | Standard padding, gaps |
| `--space-xl` | 16px | Larger sections |
| `--space-2xl` | 24px | Major breaks |

### Standard Spacing Patterns
- Card padding: 12px
- Button padding: 6px 12px (vertical × horizontal)
- Grid gap: 8px
- Table row height: 32px
- Section vertical gap: 24px

---

## Sidebar Navigation

### Visual Specification
- **Width:** 56px (icon-only, fixed)
- **Background:** `var(--sidebar-bg)`
- **Border:** 1px right `var(--sidebar-border)`
- **Icon Size:** 20px
- **Icon Stroke:** 1.5px
- **Padding:** 12px vertical
- **Item Height:** 40px

### Active State
- Left border: 3px solid `var(--accent-primary)`
- Background: `var(--accent-primary)` with 8% opacity
- Icon color: `var(--accent-primary)`

### Hover State
- Background: `var(--bg-hover)` (light) / 8% opacity on current theme
- Icon color: `var(--text-primary)`

### Components
1. **Dashboard** – icon: home
2. **Cases** – icon: briefcase
3. **Reports** – icon: file-text
4. **Settings** – icon: settings
5. **Help** – icon: help-circle

Each nav item includes a tooltip (appears on hover, positioned to the right).

---

## Component Specifications

### Cards
```css
Border Radius: 8px
Border: 1px solid var(--border-default)
Background: var(--bg-surface)
Padding: 12px
Box Shadow: var(--shadow-sm)
```

### KPI Cards (Compact Variant)
- **Layout:** Label (top, 11px muted uppercase) → Value (24px/700 bold) → Optional sparkline (20px height) → Optional delta indicator
- **Structure:** Use flexbox, column direction, gap 4px
- **Delta Indicator:** Small badge showing +/- percentage with status color

### Tables
- **Row Height:** 32px
- **Alternating Background:** Rows alternate between `var(--bg-surface)` and `var(--bg-surface-secondary)`
- **Header:** Sticky, bold 600 weight, 11px uppercase, `var(--text-tertiary)` color
- **Monospace Columns:** Case #, ID, numeric fields use monospace font
- **Border:** 1px bottom `var(--border-subtle)` between rows
- **Hover:** Row background shifts to `var(--bg-hover)`

### Buttons

**Primary Button**
```css
Background: var(--accent-primary)
Text Color: #FFFFFF
Padding: 6px 12px
Border Radius: 6px
Font Size: 13px
Font Weight: 500
Cursor: pointer
```
Hover: opacity 0.9 or use `var(--accent-primary-hover)`
Disabled: opacity 0.5, cursor not-allowed

**Secondary Button**
```css
Background: transparent
Border: 1px solid var(--border-default)
Text Color: var(--text-primary)
Padding: 6px 12px
Border Radius: 6px
Font Size: 13px
```
Hover: Background `var(--bg-hover)`, Border `var(--text-secondary)`

**Ghost Button**
```css
Background: transparent
Border: none
Text Color: var(--text-primary)
Padding: 6px 12px
Border Radius: 6px
Font Size: 13px
```
Hover: Background `var(--bg-hover)`

### Input Fields
- **Height:** 32px
- **Border Radius:** 8px
- **Border:** 1px solid `var(--border-default)`
- **Padding:** 0 8px
- **Font Size:** 13px
- **Font Family:** Inter
- **Focus:** Border `var(--accent-primary)`, outline none

### Badges & Pills
- **Padding:** 4px 8px
- **Border Radius:** 10px (pills) / 4px (badges)
- **Font Size:** 11px
- **Font Weight:** 500
- **Background:** Status color at 15% opacity
- **Text Color:** Status color full opacity

**Status Pill Variants:**
- Ingestion: Info color
- Evidence Mapping: Warning color
- Writing: Primary accent
- Review: Secondary accent
- Complete: Success color

### Tabs
- **Style:** Underline (horizontal alignment)
- **Active Indicator:** 2px bottom border in `var(--accent-primary)`
- **Font Size:** 13px
- **Font Weight:** 500
- **Padding:** 8px 12px
- **Gap Between Tabs:** 12px
- **Inactive Text Color:** `var(--text-secondary)`
- **Active Text Color:** `var(--text-primary)` + `var(--accent-primary)` underline

---

## Layout Patterns

### App Shell (Master Layout)
```
┌─────────────────────────────────────────────────┐
│  [ Sidebar (56px fixed) ] [ Top Bar (sticky) ]  │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │        Main Content Area             │
│ (icon    │      (scrollable)                    │
│  nav)    │                                      │
│          │                                      │
│          │                                      │
└──────────┴──────────────────────────────────────┘
```

### Top Bar
- **Height:** 48px
- **Background:** `var(--bg-surface)`
- **Border Bottom:** 1px `var(--border-subtle)`
- **Left:** Breadcrumb navigation (13px)
- **Center:** Search input
- **Right:** Theme toggle + Psygil branding

### Dashboard Layout
```
KPI Cards Row (4 columns, 8px gap)
├─ Active Cases
├─ Pending Reviews
├─ Reports This Month
└─ Avg Time/Report

Case List Table (full width below, 8px margin top)
├─ Sticky header
├─ 8–10 rows (32px each)
└─ Clickable rows (hover state)
```

### Case Detail Layout
```
Breadcrumb + Title Bar (sticky)

Two-Column Grid (gap: 16px)
├─ Left Panel (280px, scrollable independently)
│  ├─ Patient Info Card
│  ├─ Conditions/Diagnoses Pills
│  ├─ Documents List
│  └─ Gate Progress Stepper
│
└─ Right Panel (flex: 1, scrollable)
   ├─ Tabbed Interface (Overview, Documents, Evidence Map, Report, Audit Trail)
   └─ Tab Content (full width)
```

### Gate 2 Layout (Diagnostic Decision)
```
Red Callout Banner (full width, background: --status-error @ 10% opacity)

Validity Assessment Card (amber/warning if concerns)
├─ TOMM Results
├─ MMPI-3 Validity Scales
└─ Effort Summary

Diagnosis Cards (expandable, one per diagnosis)
├─ Header (diagnosis name + DSM-5-TR code)
├─ Evidence Bar (visual % criteria met)
├─ Decision Radio Buttons (No Decision, Render, Rule Out, Defer)
└─ Expanded Section (criterion-by-criterion table, if expanded)

Submit Button (bottom, full width or right-aligned)
```

---

## Branding

### Psygil Logo/Text
- **Location:** Top bar, far right
- **Style:** Clean sans-serif text, `--text-primary` color
- **Font Size:** 13px, 600 weight
- **Spacing:** 16px from right edge
- **Variable:** `--brand-name` (set to "Psygil"; can be changed globally)

---

## Interactions

### Keyboard Navigation
- **Tab:** Navigate through interactive elements (buttons, inputs, links, sidebar items)
- **Enter:** Activate buttons/links
- **Space:** Toggle checkboxes/radio buttons
- **Arrow Keys:** Navigate tabs, stepper steps
- **Escape:** Close modals/dropdowns

### Focus Indicators
- **Focus Ring:** 2px solid `var(--accent-primary)`, 2px offset
- **All interactive elements:** Must have visible focus state

### Hover States
- **Buttons:** Slight background shift or opacity change
- **Table Rows:** Background to `var(--bg-hover)`
- **Sidebar Items:** Background to 8% accent opacity
- **Links:** Color shift to `var(--accent-primary)`, underline on hover

### Transitions
- **Duration:** 150ms (fast, Linear-like)
- **Easing:** `ease-in-out`
- **Properties:** background-color, color, border-color, opacity, transform

---

## Iconography

### Icon Library
Use **Lucide Icons** (https://lucide.dev) — open source, clean, consistent with Linear aesthetic.

### Icon Specifications
- **Default Size:** 20px
- **Stroke Width:** 1.5px
- **Color:** Inherit from parent text color or use status color
- **Spacing:** 6px from adjacent text

### Common Icons
- Dashboard: `home`
- Cases: `briefcase`
- Reports: `file-text`
- Settings: `settings` / `gear`
- Help: `help-circle`
- Success: `check-circle`
- Warning: `alert-circle`
- Error: `x-circle`
- Expand: `chevron-down`
- Close: `x`
- Menu: `menu`
- Search: `search`
- Calendar: `calendar`
- Clock: `clock`
- Document: `file`
- Download: `download`

---

## Responsive Design

### Breakpoints
- **Mobile:** < 640px (not in scope for v1, but reserved)
- **Tablet:** 640px – 1024px
- **Desktop:** > 1024px (primary target)

### Desktop Behavior (Current)
- Sidebar always visible (56px collapsed)
- Two-column layouts stack at < 1200px content area
- Tables scroll horizontally if needed
- Cards remain at fixed widths, container width adjusts

---

## Accessibility

### Color Contrast
- **Text/Background:** Minimum 4.5:1 (WCAG AA)
- **UI Components:** Minimum 3:1 (WCAG AA)
- **Do not rely on color alone** — always pair status colors with icons or text

### ARIA Attributes
- `aria-label` on icon-only buttons
- `aria-current="page"` on active navigation item
- `aria-expanded` on expandable sections
- `role="tablist"`, `role="tab"`, `role="tabpanel"` on tabbed interfaces
- `aria-live="polite"` on dynamic content updates

### Semantic HTML
- Use `<button>`, `<input>`, `<select>` for form controls
- Use `<table>` for tabular data (not divs)
- Use `<nav>` for navigation
- Use `<main>` for primary content
- Use `<header>`, `<section>`, `<article>` appropriately

---

## Animation & Motion

### Fade Transitions
- Open/close modals: 150ms fade-in/out
- Tab switches: 150ms cross-fade between content

### Expand/Collapse
- Cards expand: 200ms height animation + fade
- Dropdowns: 150ms slide-down animation

### Loading States
- Spinner: Simple rotating icon, 1s per rotation
- Skeleton: Shimmer animation on card backgrounds (optional, v1 may skip)

### Disabled States
- Opacity: 0.5
- Cursor: `not-allowed`
- No hover effects

---

## Design Tokens (CSS Custom Properties)

### Root Scope (Light Theme Default)
All tokens listed above under "Color System" and "Spacing Scale" are defined on `:root`.

### Theme Switching
```css
:root { /* light theme */ }
:root[data-theme="medium"] { /* medium theme */ }
:root[data-theme="dark"] { /* dark theme */ }
```

JavaScript reads `data-theme` attribute and switches all dependent custom properties instantly.

---

## Implementation Notes

1. **All colors use custom properties** — no hardcoded hex values in components
2. **Typography defined in utility classes** — font sizing, weight, line height
3. **Spacing uses token variables** — maintain consistency
4. **Sidebar is fixed, content scrolls** — sidebar never leaves viewport
5. **Focus visible on all interactive elements** — accessibility first
6. **No external icon library** — Lucide icons loaded from CDN (lightweight)
7. **Dark mode doesn't invert images** — handle images separately if needed
8. **Smooth theme transitions** — CSS properties animate when theme changes

---

## Future Considerations

- High contrast mode support (additional theme or ARIA attribute)
- RTL layout support (bidi text)
- Print styles (minimize sidebars, optimize for paper)
- Mobile responsive variant (drawer sidebar, bottom nav options)
- Custom theme editor (allow users to adjust accent color, font scale)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-19
**Maintained By:** Psygil Product & Engineering
