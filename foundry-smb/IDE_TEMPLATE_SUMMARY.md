# IDE Design Template — Generation Summary

## File Created
- **Path:** `/sessions/dreamy-nifty-cray/mnt/Psygil/foundry-smb/03_IDE_Design_Template.docx`
- **Format:** Microsoft Word 2007+ (.docx)
- **Size:** 21 KB
- **Version:** 1.0
- **Date:** March 20, 2026
- **Status:** Template — Adapt per project

## Document Contents

### Cover Page
- Title: "Foundry SMB — IDE Application Design Template"
- Subtitle: "Reusable Design System for Professional Desktop Applications"
- Version, date, author, and status information

### Table of Contents
12 major sections with internal navigation

### Section 1: When to Use This Template
Defines the target application class:
- Professional desktop applications managing complex hierarchical data
- Applications with document/file structures
- Applications with embedded document editing
- Applications with AI assistant integration
- Clinical, professional, or enterprise-grade UI density

Explicitly excludes consumer apps, simple CRUD, mobile-first, and simplicity-focused applications.

### Section 2: Architecture Pattern: Three-Column IDE
- **Column 1 (Explorer Panel):** Hierarchical navigation tree + secondary panel (280px default, 180-500px range)
- **Column 2 (Editor Panel):** Tab bar + content area + optional bottom workflow panel (flex: 1)
- **Column 3 (Context + Assistant):** Upper contextual information + lower AI chat interface (320px default, 200-600px range)
- Vertical stack: Titlebar (36px) → Main layout (flex) → Statusbar (24px)
- Full viewport layout (100vh), no body scroll
- 2px draggable splitters between columns
- Explanation of why this pattern works for professional applications

### Section 3: Design Token System
CSS custom properties approach with:
- **7 Core Tokens:** --bg, --panel, --border, --text, --text-secondary, --accent, --highlight
- **3 Theme Palettes:** Light, Medium, Dark (provided as complete color values)
- Theme switching via `data-theme` attribute on html element
- Detailed implementation code snippets (CSS and JavaScript)
- Customization guidance (primarily accent color for branding)

### Section 4: Typography System
- **Font Families:** Inter (UI text, Google Fonts), JetBrains Mono (code, monospace)
- **Type Scale:** 11px (micro), 12px (small), 13px (base), 14-15px (subheading), 20px (heading)
- **Weight Scale:** 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- **Panel Headers Convention:** 11px 600 uppercase 0.5px letter-spacing secondary color
- Complete font loading instructions from Google Fonts CDN

### Section 5: Component Library
Detailed specifications for 10 reusable components:
1. **Panel Header** — 32px height, 11px uppercase, optional action buttons
2. **Tree Node** — Hierarchical with chevron, icon, label, badge; indent by depth
3. **Tab** — 32px height, active/inactive states, close button (×)
4. **Card** — panel bg, border, 4px radius, title + content
5. **Info Grid** — 2-col grid, highlight bg, label + value pairs
6. **Button** — Primary (accent) and Secondary (outlined) variants
7. **Table** — Full-width, bordered cells, header, optional row striping
8. **Chat Bubble** — Max 88% width, user (accent) vs. assistant (panel) styling
9. **Splitter** — 2px vertical/horizontal, col-resize/row-resize cursor
10. **Document Editor** — Max 816px, centered, white bg, 72px padding, 12pt serif
11. **Callout/Draft Section** — Dashed border, warning color, "DRAFT" badge

Each component includes CSS property specification, visual structure, states, and variations.

### Section 6: Layout Specifications
Exact dimensions table for all structural elements:
- Titlebar: 36px
- Statusbar: 24px
- Column widths (default, min, max)
- Splitter dimensions (2px)
- Panel headers: 32px
- Tab bar: 32px
- Bottom panels and resizable constraints
- Scrollbar dimensions (8px)

### Section 7: Interaction Patterns
Documented interaction behaviors:
- **Tree Navigation:** Click leaf → open tab, click folder → expand/collapse
- **Tab Management:** Click tab → switch, × → close, open existing → switch (no duplicate)
- **Splitter Dragging:** Mousedown → drag → mouseup; lock pointer-events; enforce min/max
- **Theme Cycling:** Click icon → rotate light → medium → dark → light
- **AI Chat:** Enter sends, Shift+Enter newlines, auto-scroll to bottom, clear button
- **Document Editor Ribbon:** Auto-show/hide with document tab active state
- **Status Bar:** Connection status left side, metadata right side

### Section 8: Customization Guide
10-step process to adapt template for new products:
1. Rename application in titlebar
2. Customize accent color for branding
3. Define tree structure for domain data
4. Define content templates for leaf nodes
5. Customize context panel (metadata, status, actions)
6. Customize AI assistant (role, prompt, capabilities)
7. Define status bar content
8. Define workflow gates (if applicable)
9. Define document editor (if applicable)
10. Define resources panel (if applicable)

### Section 9: CSS Architecture
- Single `<style>` block approach (no external stylesheets, ideal for Electron)
- CSS custom properties for all theme-aware values
- Component-scoped class naming convention
- No CSS frameworks (hand-written for control)
- Transition durations: 0.1s (backgrounds), 0.15s (splitters), 0.2s (colors)
- Organized structure: reset → themes → typography → layout → components → scrollbars
- Performance note: ~2KB minified + gzip

### Section 10: JavaScript Architecture
- **State:** openTabs array, activeTabId, activeTreeNodeId
- **Tree Management:** renderTree(), buildTreeNode(node, depth) with recursion
- **Tab Management:** openTab(), closeTab(), switchTab(), renderTabBar()
- **Content Factories:** getXxxContent() functions return HTML strings
- **Splitter Management:** makeDraggable(element, axis, callback) generic utility
- **Theme Management:** themes array, cycleTheme() with localStorage persistence
- **Chat Management:** messages array, sendChat() with backend API integration
- **Initialization:** DOMContentLoaded → render tree, open default tab, init splitters
- Bundle size: ~50KB unminified, ~12KB minified (no framework dependencies)

### Section 11: Performance Considerations
- Tree rendering acceptable for <1000 nodes; recommend virtual scrolling for larger trees
- Tab content created once, re-used (hidden/shown, not re-rendered)
- Splitter dragging uses direct DOM manipulation (smooth 60fps)
- CSS transitions kept short for responsive feel
- Electron optimization tips (embed CSS/JS, preload scripts, debounce operations)
- Memory considerations (abundant in Electron, implement lazy-loading for web)

### Section 12: Accessibility Notes
Current implementation gaps and production requirements:
- **Keyboard Navigation:** Add focus states and event handlers
- **ARIA Roles/Labels:** role="tree", role="tablist", role="tabpanel", aria-labels
- **Color Contrast:** Verify WCAG AA ratios (4.5:1 small text, 3:1 large text)
- **Screen Reader Support:** aria-live regions for state announcements
- Testing recommendations: NVDA, JAWS, VoiceOver, axe DevTools
- Semantic HTML guidance (button, input, nav instead of divs)
- Keyboard shortcuts for power users

## Key Design Decisions Extracted from Psygil Prototype

1. **Three-column layout** mirrors VS Code/Cursor paradigm — familiar to technical users
2. **CSS custom properties** enable instant theme switching (light/medium/dark)
3. **Vanilla JavaScript** (no framework) keeps bundle small, ideal for Electron
4. **Single `<style>` block** eliminates CORS issues in Electron
5. **Component-scoped classes** avoid naming conflicts and provide clarity
6. **Type scale** (11px-20px) optimized for professional, dense information display
7. **Token system** (7 tokens, 3 themes) balances consistency with flexibility
8. **Splitter state persistence** (localStorage) improves UX across sessions
9. **Word-style toolbar** auto-mounts for document editing tabs (conditionally)
10. **Draft warnings** (dashed border, warning badge) signal AI-generated content

## How This Template Differs from the Psygil Prototype

- **Generic naming:** Removed forensic psychology domain specifics (cases → documents, gates → workflow stages)
- **Reusable patterns:** Abstracted domain logic into configuration (treeData structure, contentFn factories)
- **Documentation:** Comprehensive specification for implementation by other teams
- **Customization guide:** Step-by-step instructions for adapting to new domains
- **Performance guidance:** Thresholds and optimization recommendations
- **Accessibility planning:** Identified gaps and remediation steps

## What Makes This a Valuable Template

1. **Proven Pattern:** Extracted from a real, working application
2. **Complete Specification:** Design tokens, component library, layout specs, interaction patterns all documented
3. **Implementation Ready:** CSS and JavaScript architecture specified in detail
4. **Customizable:** Token system, colors, panel content all designed to be adapted
5. **Professional Grade:** Intended for clinical, legal, financial, and other high-stakes applications
6. **No Dependencies:** Vanilla HTML/CSS/JS, works in browsers or Electron
7. **Theme-Aware:** Three themes provided; adding new themes requires changing 7 token values
8. **Performance Optimized:** Minimal bundle size, smooth interactions, scalable for large datasets

## File Dependencies

- **Generate script:** `/sessions/dreamy-nifty-cray/mnt/Psygil/foundry-smb/generate_ide_template.js`
- **Source:** `/sessions/dreamy-nifty-cray/mnt/Psygil/Psygil_UI_Prototype_v4.html`
- **Output:** `03_IDE_Design_Template.docx` (this file)

## Usage

1. Open the .docx in Microsoft Word, Google Docs, or any Office-compatible application
2. Read the Table of Contents to navigate to relevant sections
3. Follow "Section 8: Customization Guide" to adapt for your product
4. Copy CSS and JavaScript code snippets from sections 3-5 and 9-10
5. Reference component specifications (section 5) and layout specs (section 6) during implementation
6. Use design tokens (section 3) and typography scale (section 4) for consistency
7. Test interaction patterns (section 7) to ensure feature parity with template

## Next Steps for Implementation Teams

1. Extract token values and create theme system
2. Build component library with CSS from template
3. Implement tree navigation with recursive renderTree function
4. Build tab system with openTab/closeTab/switchTab functions
5. Add splitter dragging with makeDraggable utility
6. Integrate AI assistant chat (replace simulated responses with real API)
7. Define domain-specific content templates (contentFn factories)
8. Implement persistence (localStorage for splitter positions, theme, open tabs)
9. Add accessibility features (ARIA, keyboard navigation)
10. Test on target platform (Electron, web, desktop)

---

**Status:** ✓ Complete and ready for distribution

Generated: March 20, 2026
Foundry SMB
