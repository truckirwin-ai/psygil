#!/usr/bin/env node

/**
 * IDE Design Template Document Generator
 * Generates a comprehensive, reusable IDE design template as a .docx file
 * for Foundry SMB professional desktop applications.
 */

const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, PageBreak, HeadingLevel, AlignmentType, WidthType, BorderStyle, UnderlineType, convertInchesToTwip } = require('docx');
const fs = require('fs');
const path = require('path');

// Output path
const outputPath = path.join(__dirname, '03_IDE_Design_Template.docx');

// ============================================================
// DOCUMENT SECTIONS
// ============================================================

const titlePage = [
    new Paragraph({
        text: 'FOUNDRY SMB',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        run: { size: 40, bold: true, color: '0078D4' }
    }),
    new Paragraph({
        text: 'IDE Application Design Template',
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        run: { size: 28, bold: true }
    }),
    new Paragraph({
        text: 'Reusable Design System for Professional Desktop Applications',
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        run: { size: 16, italics: true, color: '666666' }
    }),
    new Paragraph({
        text: '',
        spacing: { after: 600 }
    }),
    new Paragraph({
        text: 'Version 1.0',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        run: { size: 12, color: '666666' }
    }),
    new Paragraph({
        text: 'March 20, 2026',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        run: { size: 12, color: '666666' }
    }),
    new Paragraph({
        text: 'Author: Foundry SMB',
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        run: { size: 12, color: '666666' }
    }),
    new Paragraph({
        text: 'Status: Template — Adapt per project',
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        run: { size: 12, color: '666666' }
    }),
    new PageBreak()
];

const toc = [
    new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '1. When to Use This Template',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '2. Architecture Pattern: Three-Column IDE',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '3. Design Token System',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '4. Typography System',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '5. Component Library',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '6. Layout Specifications',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '7. Interaction Patterns',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '8. Customization Guide',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '9. CSS Architecture',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '10. JavaScript Architecture',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '11. Performance Considerations',
        spacing: { after: 100 },
        run: { color: '0078D4' }
    }),
    new Paragraph({
        text: '12. Accessibility Notes',
        spacing: { after: 200 },
        run: { color: '0078D4' }
    }),
    new PageBreak()
];

const section1 = [
    new Paragraph({
        text: '1. When to Use This Template',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'This template is designed for a specific class of applications. Use it when building:',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '• Professional desktop applications that manage complex, hierarchical data',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Applications with document/file structures that users navigate and edit',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Applications with embedded document editing (Word-style toolbars, page layouts)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Applications with AI assistant or copilot integration',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Applications that need clinical, professional, or enterprise-grade UI density',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'DO NOT use this template for:',
        spacing: { after: 200 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '• Consumer applications, marketing sites, or landing pages',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Simple CRUD tools without complex data hierarchies',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Mobile-first applications (this pattern assumes a large desktop viewport)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Applications that prioritize simplicity over information density',
        spacing: { after: 400 }
    }),
    new Paragraph({
        text: 'The template was extracted from Psygil (a forensic psychology evaluation tool) and successfully applied to that domain. However, the underlying patterns are generic and apply to any professional IDE-style application.',
        spacing: { after: 200 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section2 = [
    new Paragraph({
        text: '2. Architecture Pattern: Three-Column IDE',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'The layout pattern borrows from VS Code, Cursor, and professional desktop applications. It divides the viewport into three semantic columns, each with distinct responsibilities.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Column Structure',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Column 1 (Explorer Panel)',
        spacing: { after: 100 },
        run: { bold: true, color: '0078D4' }
    }),
    new Paragraph({
        text: 'Left sidebar, default 280px, resizable (min 180px, max 500px). Contains hierarchical navigation tree plus secondary panel (e.g., resources, references). Users browse their data hierarchy here, similar to VS Code file explorer.',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Column 2 (Editor Panel)',
        spacing: { after: 100 },
        run: { bold: true, color: '0078D4' }
    }),
    new Paragraph({
        text: 'Center column, flexible width. Contains tab bar (32px) + primary content area + optional bottom panel (e.g., workflow gates, status tracking). This is where users do their primary work.',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Column 3 (Context + Assistant)',
        spacing: { after: 100 },
        run: { bold: true, color: '0078D4' }
    }),
    new Paragraph({
        text: 'Right sidebar, default 320px, resizable (min 200px, max 600px). Upper half shows contextual information (notes, metadata, quick actions). Lower half shows AI chat/assistant interface. Provides supporting information and AI help without cluttering the editor.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Layout Structure',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Vertical Stack (top to bottom):',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '• Titlebar: 36px height, application branding, theme control, user menu',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Main Layout: Three columns separated by 2px draggable splitters, flex: 1',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Statusbar: 24px height, connection status, version, document state',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Full Viewport:',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '• All sections use 100vh (100% viewport height), no body scroll',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Scrolling only within individual panels and the content area',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Splitters are draggable and persistent across sessions',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Why This Pattern Works',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '1. Minimizes context switching: Three distinct zones keep information organized',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '2. Maximizes information density: Professional users expect dense, integrated UIs',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '3. Familiar paradigm: Anyone who has used VS Code understands the layout immediately',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '4. Flexible: Each column can be resized or collapsed without losing information',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '5. Scales to complex data: Works equally well for 5 items or 5000 items in the tree',
        spacing: { after: 400 }
    }),
    new PageBreak()
];

const section3 = [
    new Paragraph({
        text: '3. Design Token System',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'All colors, spacing, and theme-aware values are defined as CSS custom properties (variables). This approach allows rapid theme switching without changing component code.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Core Tokens',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Seven core tokens power the entire design system. All components reference these tokens, never hardcoded colors.',
        spacing: { after: 200 }
    }),
    createTokenTable(),
    new Paragraph({
        text: '',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Theme Palettes',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Three themes are provided as a starting point. Switch themes via data-theme attribute on the html element.',
        spacing: { after: 200 }
    }),
    createThemesTable(),
    new Paragraph({
        text: '',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Implementation',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'In CSS, define the themes in :root and [data-theme] selectors:',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'html { --bg: #ffffff; --panel: #f3f3f3; --border: #e0e0e0; --text: #1e1e1e; --text-secondary: #666666; --accent: #0078d4; --highlight: #e8f4fd; }',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'html[data-theme="dark"] { --bg: #0d1117; --panel: #161b22; --border: #30363d; --text: #c9d1d9; --text-secondary: #8b949e; --accent: #58a6ff; --highlight: #1f4b7c; }',
        spacing: { after: 300 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'To switch themes in JavaScript:',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'const themes = ["light", "medium", "dark"]; let idx = 0; function cycleTheme() { idx = (idx + 1) % themes.length; document.documentElement.setAttribute("data-theme", themes[idx]); }',
        spacing: { after: 300 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Customization',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'To customize for a new product:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '1. Keep the token structure (7 tokens, 3 themes)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '2. Change --accent color to match your brand (this is the primary interaction color)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '3. Keep --bg, --panel, --border, --text consistent with your product aesthetic',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '4. Adjust --highlight to provide good contrast and visual feedback',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Most teams only customize the --accent color. This single change propagates through buttons, links, selections, and hover states automatically.',
        spacing: { after: 400 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section4 = [
    new Paragraph({
        text: '4. Typography System',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Typography follows a strict scale designed for dense information display. Two font families handle distinct roles.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Font Families',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Inter (UI text) — geometric sans-serif, excellent on-screen legibility, widely used in professional applications. Load from Google Fonts CDN:',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'JetBrains Mono (code and technical content) — monospace font optimized for code readability. Load from Google Fonts:',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">',
        spacing: { after: 300 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Type Scale',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    createTypeScaleTable(),
    new Paragraph({
        text: '',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Weight Scale',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '400 (normal) — Body copy, descriptions, content',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '500 (medium) — Secondary headings, labels, metadata values',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '600 (semibold) — Panel headers, button labels, emphasis',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '700 (bold) — Primary headings, draft warnings, critical status',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Panel Headers Convention',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'All panel headers use the same pattern:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Font size: 11px',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Weight: 600 (semibold)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Transform: uppercase',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Letter spacing: 0.5px',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Color: var(--text-secondary)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'This creates a visual anchor that signals "panel boundary" without distraction.',
        spacing: { after: 400 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section5 = [
    new Paragraph({
        text: '5. Component Library',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'This section documents each reusable component with its CSS specification. Copy these patterns into your stylesheet and customize as needed.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Panel Header',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Semantic container for section titles, typically at the top of each column or panel.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Height: 32px | Background: var(--panel) | Border: 1px bottom var(--border) | Padding: 0 12px | Display: flex | Align items: center | Font: 11px 600 uppercase secondary',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Optional: Floating action buttons on the right (⊕, ⊞, ↑ icons). Button size 20x20, font 13px, color var(--text-secondary), hover background var(--highlight) + color var(--accent).',
        spacing: { after: 300 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Tree Node',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Hierarchical list item in left sidebar. Supports nesting, expand/collapse, badges.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Structure: [Chevron 16x16] [Icon 16x16] [Label flex:1] [Badge optional]',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: 'Padding: 3px 0 | Margin left: 8px base + 16px per depth level | Font: 13px | Display: flex | Gap: 4px',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Chevron: 16x16, font-size 10px, shows ▸ (collapsed) or ▾ (expanded), color var(--text-secondary)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Icon: 16x16, emoji or SVG, flex-shrink: 0, color var(--text-secondary)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Label: flex: 1, min-width: 0, overflow: hidden, text-overflow: ellipsis for long text',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Badge: padding 1px 5px, background var(--accent), color white, font 10px 600, border-radius 3px, margin-left 4px',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'States:',
        spacing: { after: 80 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '  • Default: text color var(--text)',
        spacing: { after: 60 }
    }),
    new Paragraph({
        text: '  • Hover: background var(--highlight)',
        spacing: { after: 60 }
    }),
    new Paragraph({
        text: '  • Active: background var(--accent), color white, font-weight 500',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Tab',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Horizontal tab in editor header. Click switches content pane. × button closes tab.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Height: 32px | Padding: 0 12px | Font: 12px | Display: flex | Gap: 6px | Align items: center | Background: var(--bg)',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Active state: text color var(--text), 2px bottom border var(--accent), font-weight 500',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Inactive state: color var(--text-secondary)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Close button (×): 16x16, opacity 0 by default, opacity 1 on hover, cursor pointer',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Card',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Content container used in context panels and right sidebar.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Background: var(--panel) | Border: 1px var(--border) | Border radius: 4px | Padding: 12px | Margin bottom: 12px',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Title: 13px 600 | Content: 13px 400 line-height 1.5',
        spacing: { after: 300 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Info Grid',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Two-column grid for key-value information display.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Display: grid | Grid template columns: 1fr 1fr | Gap: 10px | Margin bottom: 16px',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Item: background var(--highlight), border-radius 4px, padding 8px',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Label: 11px var(--text-secondary) | Value: 13px 500 var(--text)',
        spacing: { after: 300 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Button',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Primary (accent background): background var(--accent), color white, padding 6px 12px, border-radius 4px, font 12px 500, cursor pointer',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Secondary (outlined): background var(--bg), border 1px var(--border), color var(--text), padding 6px 12px, border-radius 4px, font 12px 500, cursor pointer',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Table',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Full-width tabular data display.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Width: 100% | Border collapse: collapse | Margin bottom: 16px | Font: 12px',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Header: background var(--panel), padding 6px 10px, font-weight 600, border 1px var(--border)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Data cell: padding 6px 10px, border 1px var(--border)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Striping (optional): Alternate rows with background var(--highlight)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Chat Bubble',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Message container in chat panel.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Max width: 88% | Padding: 8px 10px | Border radius: 8px | Font: 12px | Line height: 1.5',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'User bubble: background var(--accent), color white, border-bottom-right-radius 2px, right-aligned',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Assistant bubble: background var(--panel), color var(--text), border-bottom-left-radius 2px, left-aligned',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Splitter',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Draggable divider between columns.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Vertical: width 2px, cursor col-resize, background var(--border)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Horizontal: height 2px, cursor row-resize, background var(--border)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Hover/Active: background var(--accent)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Document Editor',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Embedded WYSIWYG editor for document editing (Word-style ribbon toolbar).',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Max width: 816px | Centered in viewport | Padding: 72px | Background: white | Font: serif 12pt | Box shadow for page edge effect',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Includes ribbon toolbar pattern (File, Home, Insert, Layout, References, Review, View tabs with formatting buttons)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Callout/Draft Section',
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Warning container for AI-generated or draft content.',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'Border: 2px dashed #ff9800 | Background: #fff8e1 | Border radius: 4px | Padding: 16px | Margin: 16px 0',
        spacing: { after: 100 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Label badge: background #ff9800, color white, font 10px 700 uppercase, padding 2px 8px, border-radius 3px',
        spacing: { after: 400 }
    }),
    new PageBreak()
];

const section6 = [
    new Paragraph({
        text: '6. Layout Specifications',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Exact dimensions for structural elements ensure consistency and make layouts reproducible.',
        spacing: { after: 300 }
    }),
    createLayoutSpecTable(),
    new Paragraph({
        text: '',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Resizable Columns',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Left column (Explorer): default 280px, min 180px, max 500px',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Center column: flex: 1 (fills remaining space)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Right column (Context + Assistant): default 320px, min 200px, max 600px',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Store splitter positions in localStorage and restore on page load to persist user preferences across sessions.',
        spacing: { after: 400 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section7 = [
    new Paragraph({
        text: '7. Interaction Patterns',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Consistent interaction patterns reduce cognitive load and make the application intuitive.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Tree Navigation',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Click leaf node → open as tab in center column',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Click folder node → toggle expand/collapse (show/hide children)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'If folder has content, clicking it should both open the folder tab AND toggle expand',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Active tree node is highlighted with background var(--accent) + white text',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Tab Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Click tab → switch to that tab, display its content pane',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Click × on tab → close tab, switch to adjacent tab (prefer next, fall back to previous)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Open existing tab → switch to it (do not duplicate tabs)',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'If last tab is closed, center column shows empty state or dashboard',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Splitter Dragging',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'mousedown on splitter → start drag',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'mousemove → update column width in real-time',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'mouseup → end drag, save position to localStorage',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'During drag: lock pointer-events on all non-splitter elements (prevents text selection, button clicks)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Enforce min/max constraints to prevent columns from collapsing or exceeding bounds',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Theme Cycling',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Clicking theme icon (☀ in titlebar) rotates through themes: light → medium → dark → light',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Update document.documentElement.setAttribute("data-theme", themeName)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Persist theme choice in localStorage',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'AI Chat',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Enter key sends message (with focus in input)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Shift+Enter creates newline (doesn\'t send)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Messages scroll to bottom automatically on new message',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Clear button (✕ in panel header) resets chat to welcome message',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Document Editor Ribbon',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Word toolbar auto-shows when document tab is active',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Word toolbar auto-hides when switching to non-document tabs',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Tabs track isWord flag; only document tabs mount the toolbar',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Status Bar',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Left side: connection status, LLM name, security/storage state',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Right side: document count, application version',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Update in real-time as application state changes',
        spacing: { after: 400 }
    }),
    new PageBreak()
];

const section8 = [
    new Paragraph({
        text: '8. Customization Guide',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'This template is generic and designed to be adapted for different domains. Follow these steps to apply it to a new product.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 1: Rename Application',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Replace "PSYGIL" in the titlebar with your product name. This appears at the top-left of the window.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 2: Customize Accent Color',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Change --accent values in all three themes to match your brand:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Light theme: --accent: #0078d4 (or your brand color)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Medium theme: --accent: #0078d4',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Dark theme: --accent: #58a6ff (lighter version of brand color)',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'This single change propagates to all interactive elements (buttons, links, selections, hovers).',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 3: Define Tree Structure',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Create your domain\'s hierarchical data structure in the tree. Example:',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'const treeData = [ { id: "dashboard", label: "Dashboard", icon: "📊", contentFn: "getDashboardContent" }, { id: "project1", label: "Project Alpha", icon: "📁", expanded: true, children: [ { id: "doc1", label: "Requirements", icon: "📄", contentFn: "getDocContent" } ] } ];',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Step 4: Define Content Templates',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'For each leaf node, create a contentFn that returns HTML. Example:',
        spacing: { after: 100 },
        run: { italics: true, color: '666666' }
    }),
    new Paragraph({
        text: 'function getDocContent() { return "<h1>Requirements</h1><p>...</p><table>...</table>"; }',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Step 5: Customize Context Panel',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Define what contextual information shows in the right sidebar upper panel. For forensic psych, this was case notes, agent status, deadlines, and quick actions. For your domain, it might be project metadata, team members, blockers, or status.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 6: Customize AI Assistant',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Define the assistant\'s role and capabilities. Update:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Panel title (e.g., "Writing Assistant" → "Code Assistant")',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Welcome message (initial assistant message)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Input placeholder text',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Backend API endpoint and prompt context',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 7: Define Status Bar',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Customize what appears in the status bar. Left side shows connection and security state. Right side shows document count and version.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 8: Define Workflow Gates (Optional)',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'If your application has workflow stages or gates (like Psygil\'s Gate 1, Gate 2, Gate 3), replace the gates panel in the center column bottom with your domain\'s workflow.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 9: Define Document Editor (Optional)',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'If your application has document editing, mark tabs with isWord: true. The Word toolbar will auto-mount when those tabs are active. Customize toolbar buttons to match your editor capabilities.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Step 10: Define Resources Panel (Optional)',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'The left sidebar lower panel (Resources) can display reference materials, quick links, or domain-specific resources. For forensic psych, it shows DSM-5-TR Reference, statutes, and legal standards. For your domain, it might show API docs, design system, or templates.',
        spacing: { after: 300 }
    }),
    new PageBreak()
];

const section9 = [
    new Paragraph({
        text: '9. CSS Architecture',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'All CSS is contained in a single <style> block with no external stylesheets. This is intentional for Electron apps (no CORS issues, instant theme switching).',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Design Principles',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '1. CSS Custom Properties for all theme-aware values (colors, shadows, opacity)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '2. Component-scoped class naming (.tree-node, .tab-bar, .chat-bubble) — no utility classes',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '3. No CSS frameworks (no Tailwind, Bootstrap, etc.) — everything hand-written for full control',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '4. Transition durations: 0.1s for backgrounds, 0.15s for splitters/opacity, 0.2s for colors',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '5. Scrollbar styling with -webkit-scrollbar for consistent appearance across themes',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Structure',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'The style block should be organized as:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '1. Reset + Global (*, body, html)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '2. Theme Variables (:root, [data-theme])',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '3. Typography (font-family, type scale, weights)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '4. Layout (app, main-layout, columns, splitters)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '5. Components (titlebar, tree, tabs, cards, buttons, etc.)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '6. Scrollbars (::-webkit-scrollbar)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Customization',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'To customize CSS for a new product:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '1. Keep the token structure — do not add new custom properties',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '2. Change accent color values in theme definitions',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '3. Adjust spacing (padding, margin, gap) to match visual density preferences',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '4. Add domain-specific components only, do not remove existing ones',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '5. Keep class names simple and component-scoped (avoid .left-col-item-label nesting)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Performance Note: At ~2KB minified + gzipped, the CSS is minimal and loads instantly. No build step required.',
        spacing: { after: 400 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section10 = [
    new Paragraph({
        text: '10. JavaScript Architecture',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'The application is built with vanilla JavaScript (no framework dependencies). The structure is straightforward and easy to adapt.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'State Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Three pieces of global state:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'const openTabs = []; // Array of { id, title, contentFn, isWord }',
        spacing: { after: 80 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'let activeTabId = null; // Currently visible tab',
        spacing: { after: 80 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'let activeTreeNodeId = null; // Currently selected tree node',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Tree Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'renderTree() — Recursively renders treeData array as DOM, starting from document.getElementById("tree-root")',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'buildTreeNode(node, depth) — Builds a single node with chevron, icon, label, badge. Calls itself recursively for children.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Tree node click handler: toggles node.expanded if it has children, calls openTab if it has contentFn',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Tab Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'openTab(id, title, contentFn, isWord) — Creates tab if not exists, renders pane, sets as active',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'closeTab(id) — Removes tab, switches to adjacent, re-renders',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'switchTab(id) — Sets activeTabId, re-renders tab bar and panes',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'renderTabBar() — Renders tabs from openTabs array, marks active tab',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'showActivePane() — Hides all panes except activeTab, conditionally mounts Word toolbar',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Content Factory Functions',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Each tab type has a contentFn that returns HTML string:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'function getDashboardContent() { return "<h1>Dashboard</h1>..."; }',
        spacing: { after: 80 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'function getEvalReportContent() { return "<div class=\'document-editor\'>...</div>"; }',
        spacing: { after: 200 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'Content is created once on openTab and re-used (not re-rendered on switch). This is efficient for static content.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Splitter Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Generic makeDraggable(splitterEl, axis, onDrag) utility handles both vertical and horizontal splitters',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'axis: "col" for vertical (resize columns) or "row" for horizontal (resize rows)',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'onDrag callback updates width or height of adjacent element',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'During drag: set pointer-events: none on all non-splitter elements to prevent interference',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Theme Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'const themes = ["light", "medium", "dark"];',
        spacing: { after: 80 },
        run: { font: 'Courier New', size: 20 }
    }),
    new Paragraph({
        text: 'cycleTheme() rotates index and sets document.documentElement.setAttribute("data-theme", themes[idx])',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Persist theme in localStorage for next session',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Chat Management',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'messages = [] — Array of { role: "user" | "assistant", content: string }',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'sendChat() — Gets input value, adds user message, clears input, adds assistant response, scrolls to bottom',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Assistant responses can be hardcoded or fetched from backend API',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Initialization',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'On DOMContentLoaded:',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: '1. renderTree()',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '2. openTab("dashboard", "Dashboard", getDashboardContent)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '3. makeDraggable(splitter-left, "col", ...)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '4. makeDraggable(splitter-right, "col", ...)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '5. makeDraggable(splitter-center-h, "row", ...)',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'No framework overhead — total bundle size (HTML + CSS + JS) ~50KB unminified, ~12KB minified.',
        spacing: { after: 400 },
        run: { italics: true, color: '666666' }
    }),
    new PageBreak()
];

const section11 = [
    new Paragraph({
        text: '11. Performance Considerations',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'For a professional desktop application, performance is critical.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Tree Rendering',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'renderTree() recreates DOM for the entire tree on expand/collapse or node click. This is acceptable for <1000 nodes.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'For larger trees (>1000 nodes), implement virtual scrolling or lazy-load children.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Tab Content',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Content is created once in openTab() and re-used across tab switches (hidden with display: none, shown with display: block).',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'This avoids re-rendering large content panes on every tab switch.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Splitter Dragging',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Uses direct DOM manipulation (element.style.width/height), not CSS transitions or requestAnimationFrame.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Achieves smooth 60fps dragging without jank.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'CSS Transitions',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Transition durations are short (0.1s–0.2s) to feel responsive, not sluggish.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'Hover effects use ::hover pseudo-class, not JavaScript timers.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Bundle Size',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '• HTML: ~8KB',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• CSS: ~2KB',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• JavaScript: ~6KB',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• Total: ~16KB unminified (~4KB minified + gzip)',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'No external dependencies (no React, Vue, jQuery, etc.).',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Electron App Optimization',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'For Electron applications:',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '1. Embed CSS and JavaScript in the HTML file (no external requests)',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '2. Use preload scripts to set up Node.js context',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '3. Debounce file system operations during splitter dragging',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '4. Store app state (open tabs, splitter positions, theme) in localStorage or IPC',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Memory',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Each content pane is a DOM subtree in memory. For Electron (where memory is abundant), this is fine.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: 'If deployed as web app with memory constraints, implement lazy-loading: create pane content on tab click, destroy on tab close.',
        spacing: { after: 400 }
    }),
    new PageBreak()
];

const section12 = [
    new Paragraph({
        text: '12. Accessibility Notes',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: 'Professional applications should be accessible to all users. This section outlines what\'s needed.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Current Gaps (To Do for Production)',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '1. Keyboard Navigation',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: 'All interactive elements need focus states and keyboard event handlers. Currently, only mouse interaction is supported.',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '2. ARIA Roles and Labels',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: 'Add role and aria-label attributes:',
        spacing: { after: 80 }
    }),
    new Paragraph({
        text: '• role="tree" on tree-root',
        spacing: { after: 60 }
    }),
    new Paragraph({
        text: '• role="tablist" on tab-bar',
        spacing: { after: 60 }
    }),
    new Paragraph({
        text: '• role="tabpanel" on tab panes',
        spacing: { after: 60 }
    }),
    new Paragraph({
        text: '• aria-label and aria-describedby on buttons',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '3. Color Contrast',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: 'Verify all color combinations meet WCAG AA contrast ratios (4.5:1 for small text, 3:1 for large text).',
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '4. Screen Reader Support',
        spacing: { after: 100 },
        run: { bold: true }
    }),
    new Paragraph({
        text: 'Announce tab switches and major state changes using aria-live regions.',
        spacing: { after: 300 }
    }),
    new Paragraph({
        text: 'Recommendations',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 }
    }),
    new Paragraph({
        text: '• Test with NVDA (Windows), JAWS (Windows), or VoiceOver (macOS).',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Use axe DevTools browser extension to identify accessibility violations.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Ensure all icons have text labels or aria-labels.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Use semantic HTML (button, input, nav) instead of divs with click handlers where possible.',
        spacing: { after: 100 }
    }),
    new Paragraph({
        text: '• Keyboard shortcuts (e.g., Cmd+1 to switch to tab 1) improve usability for power users.',
        spacing: { after: 400 }
    }),
    new PageBreak()
];

// ============================================================
// TABLE HELPERS
// ============================================================

function createTokenTable() {
    const createCell = (text, width = 25, isHeader = false) => {
        return new TableCell({
            children: [new Paragraph({ text })],
            width: { size: width, type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'D3D3D3' } : {}
        });
    };

    return new Table({
        rows: [
            new TableRow({
                height: { value: 400, rule: 'atLeast' },
                children: [
                    createCell('Token Name', 25, true),
                    createCell('Purpose', 50, true),
                    createCell('Light Theme', 25, true)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--bg', 25),
                    createCell('Main background (panels, content area)', 50),
                    createCell('#ffffff', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--panel', 25),
                    createCell('Secondary background (headers, cards, hover)', 50),
                    createCell('#f3f3f3', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--border', 25),
                    createCell('Dividers, outlines, splitters', 50),
                    createCell('#e0e0e0', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--text', 25),
                    createCell('Primary text (body copy, labels)', 50),
                    createCell('#1e1e1e', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--text-secondary', 25),
                    createCell('Secondary text (meta, hints, disabled)', 50),
                    createCell('#666666', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--accent', 25),
                    createCell('Interactive elements (buttons, links, highlights)', 50),
                    createCell('#0078d4', 25)
                ]
            }),
            new TableRow({
                children: [
                    createCell('--highlight', 25),
                    createCell('Light highlight for hover, active states', 50),
                    createCell('#e8f4fd', 25)
                ]
            })
        ]
    });
}

function createThemesTable() {
    const createCell = (text, width = 15, isHeader = false) => {
        return new TableCell({
            children: [new Paragraph({ text })],
            width: { size: width, type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'D3D3D3' } : {}
        });
    };

    return new Table({
        rows: [
            new TableRow({
                height: { value: 400, rule: 'atLeast' },
                children: [
                    createCell('Token', 15, true),
                    createCell('Light', 28, true),
                    createCell('Medium', 28, true),
                    createCell('Dark', 29, true)
                ]
            }),
            new TableRow({ children: [createCell('--bg', 15), createCell('#ffffff', 28), createCell('#1e1e1e', 28), createCell('#0d1117', 29)] }),
            new TableRow({ children: [createCell('--panel', 15), createCell('#f3f3f3', 28), createCell('#2d2d2d', 28), createCell('#161b22', 29)] }),
            new TableRow({ children: [createCell('--border', 15), createCell('#e0e0e0', 28), createCell('#3e3e3e', 28), createCell('#30363d', 29)] }),
            new TableRow({ children: [createCell('--text', 15), createCell('#1e1e1e', 28), createCell('#e0e0e0', 28), createCell('#c9d1d9', 29)] }),
            new TableRow({ children: [createCell('--text-secondary', 15), createCell('#666666', 28), createCell('#a0a0a0', 28), createCell('#8b949e', 29)] }),
            new TableRow({ children: [createCell('--accent', 15), createCell('#0078d4', 28), createCell('#0078d4', 28), createCell('#58a6ff', 29)] }),
            new TableRow({ children: [createCell('--highlight', 15), createCell('#e8f4fd', 28), createCell('#264f78', 28), createCell('#1f4b7c', 29)] })
        ]
    });
}

function createTypeScaleTable() {
    const createCell = (text, width = 20, isHeader = false) => {
        return new TableCell({
            children: [new Paragraph({ text })],
            width: { size: width, type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'D3D3D3' } : {}
        });
    };

    return new Table({
        rows: [
            new TableRow({
                height: { value: 400, rule: 'atLeast' },
                children: [
                    createCell('Size', 20, true),
                    createCell('Usage', 80, true)
                ]
            }),
            new TableRow({ children: [createCell('11px', 20), createCell('Micro: panel headers, labels, badges, status indicators', 80)] }),
            new TableRow({ children: [createCell('12px', 20), createCell('Small: UI text, tabs, buttons, table data, secondary content', 80)] }),
            new TableRow({ children: [createCell('13px', 20), createCell('Base: body copy, card titles, tree nodes, chat messages', 80)] }),
            new TableRow({ children: [createCell('14-15px', 20), createCell('Subheading: section titles, h3 in content', 80)] }),
            new TableRow({ children: [createCell('20px', 20), createCell('Heading: h1 in tab panes, major section titles', 80)] })
        ]
    });
}

function createLayoutSpecTable() {
    const createCell = (text, width = 30, isHeader = false) => {
        return new TableCell({
            children: [new Paragraph({ text })],
            width: { size: width, type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: 'D3D3D3' } : {}
        });
    };

    return new Table({
        rows: [
            new TableRow({
                height: { value: 400, rule: 'atLeast' },
                children: [
                    createCell('Element', 30, true),
                    createCell('Dimension', 35, true),
                    createCell('Notes', 35, true)
                ]
            }),
            new TableRow({ children: [createCell('Titlebar', 30), createCell('36px height', 35), createCell('Fixed at top, contains branding and user menu', 35)] }),
            new TableRow({ children: [createCell('Statusbar', 30), createCell('24px height', 35), createCell('Fixed at bottom, shows status and metadata', 35)] }),
            new TableRow({ children: [createCell('Main layout', 30), createCell('100vh - 60px', 35), createCell('Fills space between titlebar and statusbar', 35)] }),
            new TableRow({ children: [createCell('Left column', 30), createCell('280px default', 35), createCell('Min 180px, max 500px, resizable', 35)] }),
            new TableRow({ children: [createCell('V-splitter', 30), createCell('2px width', 35), createCell('Draggable, separates left and center', 35)] }),
            new TableRow({ children: [createCell('Center column', 30), createCell('flex: 1', 35), createCell('Fills remaining space', 35)] }),
            new TableRow({ children: [createCell('Right column', 30), createCell('320px default', 35), createCell('Min 200px, max 600px, resizable', 35)] }),
            new TableRow({ children: [createCell('V-splitter', 30), createCell('2px width', 35), createCell('Draggable, separates center and right', 35)] }),
            new TableRow({ children: [createCell('Panel header', 30), createCell('32px height', 35), createCell('Fixed in each panel', 35)] }),
            new TableRow({ children: [createCell('Tab bar', 30), createCell('32px height', 35), createCell('Horizontally scrollable if many tabs', 35)] }),
            new TableRow({ children: [createCell('H-splitter (center)', 30), createCell('2px height', 35), createCell('Separates content area from gates panel', 35)] }),
            new TableRow({ children: [createCell('Gates/workflow panel', 30), createCell('80px default', 35), createCell('Resizable, shows workflow stages', 35)] }),
            new TableRow({ children: [createCell('H-splitter (right)', 30), createCell('2px height', 35), createCell('Separates context from chat panel', 35)] }),
            new TableRow({ children: [createCell('Chat panel', 30), createCell('280px default', 35), createCell('Min 120px, resizable', 35)] })
        ]
    });
}

// ============================================================
// BUILD DOCUMENT
// ============================================================

const doc = new Document({
    sections: [{
        children: [
            ...titlePage,
            ...toc,
            ...section1,
            ...section2,
            ...section3,
            ...section4,
            ...section5,
            ...section6,
            ...section7,
            ...section8,
            ...section9,
            ...section10,
            ...section11,
            ...section12
        ]
    }]
});

// ============================================================
// GENERATE FILE
// ============================================================

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outputPath, buffer);
    console.log(`✓ IDE Design Template generated: ${outputPath}`);
    console.log(`  Version: 1.0`);
    console.log(`  Date: March 20, 2026`);
    console.log(`  Status: Template — Adapt per project`);
}).catch(err => {
    console.error('Error generating document:', err);
    process.exit(1);
});
