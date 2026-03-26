# Design Tokens — Quick Reference Card

## Token System Overview

All colors, spacing, and theme-aware values use CSS custom properties (variables).

```css
:root {
  --bg: #ffffff;              /* Main background */
  --panel: #f3f3f3;            /* Secondary background */
  --border: #e0e0e0;           /* Dividers, outlines */
  --text: #1e1e1e;             /* Primary text */
  --text-secondary: #666666;   /* Secondary text */
  --accent: #0078d4;           /* Interactive elements */
  --highlight: #e8f4fd;        /* Light highlights */
}
```

## Theme Palettes

### Light (Default)
| Token | Value |
|-------|-------|
| --bg | #ffffff |
| --panel | #f3f3f3 |
| --border | #e0e0e0 |
| --text | #1e1e1e |
| --text-secondary | #666666 |
| --accent | #0078d4 |
| --highlight | #e8f4fd |

### Medium
| Token | Value |
|-------|-------|
| --bg | #1e1e1e |
| --panel | #2d2d2d |
| --border | #3e3e3e |
| --text | #e0e0e0 |
| --text-secondary | #a0a0a0 |
| --accent | #0078d4 |
| --highlight | #264f78 |

### Dark
| Token | Value |
|-------|-------|
| --bg | #0d1117 |
| --panel | #161b22 |
| --border | #30363d |
| --text | #c9d1d9 |
| --text-secondary | #8b949e |
| --accent | #58a6ff |
| --highlight | #1f4b7c |

## Typography Scale

| Size | Usage | Font Weight |
|------|-------|-------------|
| 11px | Micro (labels, badges, panel headers) | 600 |
| 12px | Small (UI text, tabs, buttons) | 400-600 |
| 13px | Base (body copy, cards, tree nodes) | 400-500 |
| 14-15px | Subheading (section titles, h3) | 600 |
| 20px | Heading (h1, major sections) | 600 |

## Layout Dimensions

| Element | Height/Width | Notes |
|---------|-------------|-------|
| Titlebar | 36px | Fixed top |
| Statusbar | 24px | Fixed bottom |
| Left column | 280px (min 180, max 500) | Resizable |
| Right column | 320px (min 200, max 600) | Resizable |
| V-splitter | 2px | Draggable |
| H-splitter | 2px | Draggable |
| Panel header | 32px | Inside panels |
| Tab bar | 32px | Horizontal scroll |
| Scrollbar | 8px | Width/height |

## Component Quick Specs

### Panel Header
```
Height: 32px | Padding: 0 12px | Font: 11px 600 uppercase
Background: var(--panel) | Border bottom: 1px var(--border)
```

### Tree Node
```
Padding: 3px 0 | Margin-left: 8px + (16px × depth)
Icon/Chevron: 16x16 | Label: flex 1, ellipsis
Active: bg var(--accent), color white
Hover: bg var(--highlight)
```

### Tab
```
Height: 32px | Padding: 0 12px | Font: 12px
Active: 2px bottom border var(--accent), weight 500
Inactive: color var(--text-secondary)
Close button: opacity 0, opacity 1 on hover
```

### Card
```
Background: var(--panel) | Border: 1px var(--border)
Border-radius: 4px | Padding: 12px | Margin-bottom: 12px
Title: 13px 600 | Content: 13px 400 line-height 1.5
```

### Button
```
Primary: bg var(--accent), color white, padding 6px 12px
Secondary: bg var(--bg), border 1px var(--border)
Border-radius: 4px | Font: 12px 500 | Cursor: pointer
```

### Chat Bubble
```
Max-width: 88% | Padding: 8px 10px | Border-radius: 8px
User: bg var(--accent), color white, border-radius-br 2px
Assistant: bg var(--panel), color var(--text), border-radius-bl 2px
```

### Splitter
```
Vertical: width 2px, cursor col-resize
Horizontal: height 2px, cursor row-resize
Default: bg var(--border)
Hover/Active: bg var(--accent)
```

## Font Families

### UI Text (Inter)
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Code (JetBrains Mono)
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

## Color Usage Guide

| Element | Token | Opacity |
|---------|-------|---------|
| Main background | --bg | 100% |
| Panel/card background | --panel | 100% |
| Borders/dividers | --border | 100% |
| Body text | --text | 100% |
| Labels/meta | --text-secondary | 100% |
| Buttons/links/active | --accent | 100% |
| Hover background | --highlight | 100% |
| Disabled text | --text-secondary | 50% |
| Disabled buttons | --panel | 100% |

## CSS Implementation Skeleton

```css
/* Theme variables */
:root {
  --bg: #ffffff;
  --panel: #f3f3f3;
  --border: #e0e0e0;
  --text: #1e1e1e;
  --text-secondary: #666666;
  --accent: #0078d4;
  --highlight: #e8f4fd;
}

html[data-theme="medium"] {
  --bg: #1e1e1e;
  --panel: #2d2d2d;
  /* ... */
}

html[data-theme="dark"] {
  --bg: #0d1117;
  --panel: #161b22;
  /* ... */
}

/* Layout */
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.main-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.left-column { width: 280px; }
.center-column { flex: 1; }
.right-column { width: 320px; }

.v-splitter { width: 2px; cursor: col-resize; }
.h-splitter { height: 2px; cursor: row-resize; }

/* Scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}
```

## Customization Checklist

For a new product using this template:

- [ ] Change --accent color to brand color (light and dark themes)
- [ ] Update titlebar application name
- [ ] Define tree data structure (treeData array)
- [ ] Create content templates (getXxxContent() functions)
- [ ] Customize context panel sections
- [ ] Configure AI assistant role and prompt
- [ ] Define status bar content
- [ ] Add domain-specific workflow/gates (if applicable)
- [ ] Configure document editor toolbar (if applicable)
- [ ] Test all three themes
- [ ] Verify colors meet WCAG AA contrast ratios
- [ ] Add keyboard navigation (accessibility)
- [ ] Implement state persistence (localStorage)

## Performance Targets

- **Bundle size:** <20KB minified + gzip
- **First paint:** <1s
- **Splitter drag:** 60fps smooth
- **Tree render:** <100ms for 1000 nodes
- **Tab switch:** <50ms (no content re-render)
- **Theme switch:** <200ms (instant CSS update)

## Browser/Platform Support

- **Electron:** Primary target (all features supported)
- **Chrome/Edge:** Full support
- **Firefox:** Full support
- **Safari:** Full support (webkit prefixes included)
- **Mobile:** Not recommended (layout assumes large viewport)

---

**Quick Start:** 
1. Copy CSS custom property definitions
2. Copy component CSS classes
3. Copy JavaScript state and utility functions
4. Define tree data structure and content templates
5. Test theme switching and interactions
6. Deploy

**Last Updated:** March 20, 2026
