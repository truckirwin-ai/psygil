const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, PageBreak, HeadingLevel, AlignmentType, VerticalAlign, BorderStyle, UnderlineType, convertInchesToTwip, ShadingType } = require('docx');
const fs = require('fs');
const path = require('path');

// Color palettes
const lightTheme = {
  '--bg': '#ffffff',
  '--panel': '#f3f3f3',
  '--border': '#e0e0e0',
  '--text': '#1e1e1e',
  '--text-secondary': '#666666',
  '--accent': '#0078d4',
  '--highlight': '#e8f4fd'
};

const mediumTheme = {
  '--bg': '#1e1e1e',
  '--panel': '#2d2d2d',
  '--border': '#3e3e3e',
  '--text': '#e0e0e0',
  '--text-secondary': '#a0a0a0',
  '--accent': '#58a6ff',
  '--highlight': '#1f4b7c'
};

const darkTheme = {
  '--bg': '#0d1117',
  '--panel': '#161b22',
  '--border': '#30363d',
  '--text': '#c9d1d9',
  '--text-secondary': '#8b949e',
  '--accent': '#58a6ff',
  '--highlight': '#1f4b7c'
};

function createColorTable(themeName, colors) {
  return new Table({
    rows: [
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Variable', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Value', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Usage', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          })
        ]
      }),
      ...Object.entries(colors).map(([key, value]) => {
        let usage = '';
        if (key.includes('bg')) usage = 'Page background';
        else if (key.includes('panel')) usage = 'Panels, cards, containers';
        else if (key.includes('border')) usage = 'Dividers, splitters, borders';
        else if (key.includes('text-secondary')) usage = 'Secondary text, icons (inactive)';
        else if (key.includes('text') && !key.includes('secondary')) usage = 'Primary text, headings';
        else if (key.includes('accent')) usage = 'Active elements, buttons, highlights';
        else if (key.includes('highlight')) usage = 'Hover states, subtle backgrounds';

        return new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(key)]
            }),
            new TableCell({
              children: [new Paragraph(value)]
            }),
            new TableCell({
              children: [new Paragraph(usage)]
            })
          ]
        });
      })
    ]
  });
}

function createTypographyTable() {
  const scales = [
    { role: 'h1', size: '20px', weight: '600', usage: 'Page titles' },
    { role: 'h2', size: '15px', weight: '600', usage: 'Section headings' },
    { role: 'h3', size: '14px', weight: '600', usage: 'Subsection headings' },
    { role: 'Body (standard)', size: '13px', weight: '400', usage: 'Main content, tab panes' },
    { role: 'Tab labels', size: '12px', weight: '500 (active)', usage: 'Tab bar, buttons' },
    { role: 'Panel headers', size: '11px', weight: '600', usage: 'CASES, CONTEXT headers (uppercase)' },
    { role: 'Tree nodes', size: '13px', weight: '400', usage: 'Explorer tree items' },
    { role: 'Tables', size: '12px', weight: '400', usage: 'Data presentation' },
    { role: 'Code/Monospace', size: '11px', weight: '400', usage: 'Technical content (JetBrains Mono)' }
  ];

  return new Table({
    rows: [
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Role', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Size', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Weight', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Usage', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          })
        ]
      }),
      ...scales.map(s => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(s.role)] }),
          new TableCell({ children: [new Paragraph(s.size)] }),
          new TableCell({ children: [new Paragraph(s.weight)] }),
          new TableCell({ children: [new Paragraph(s.usage)] })
        ]
      }))
    ]
  });
}

function createLayoutTable() {
  const specs = [
    { component: 'Titlebar', height: '36px', details: 'Panel background, 1px bottom border, contains app name + icons' },
    { component: 'Left Column (Explorer)', width: '280px (default)', details: 'Min 180px, Max 500px; flex split: CASES (1) / RESOURCES (80px)' },
    { component: 'Center Column (Editor)', width: 'flex: 1', details: 'Tab bar (32px) / Content (flex) / Gates panel (80px)' },
    { component: 'Right Column (Context)', width: '320px (default)', details: 'Min 200px, Max 600px; flex split: Context (1) / Chat (280px)' },
    { component: 'Tab bar', height: '32px', details: '12px font, 0 12px padding, scrollable, no scrollbar visible' },
    { component: 'Statusbar', height: '24px', details: 'Panel background, 1px top border, right-aligned status items' },
    { component: 'Splitters (vertical)', width: '2px', details: 'col-resize cursor, hover/drag = accent color' },
    { component: 'Splitters (horizontal)', height: '2px', details: 'row-resize cursor, hover/drag = accent color' }
  ];

  return new Table({
    rows: [
      new TableRow({
        height: { value: 300, rule: 'atLeast' },
        children: [
          new TableCell({
            children: [new Paragraph({ text: 'Component', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Dimension', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          }),
          new TableCell({
            children: [new Paragraph({ text: 'Details', bold: true, color: 'FFFFFF' })],
            shading: { fill: '333333', type: ShadingType.CLEAR }
          })
        ]
      }),
      ...specs.map(s => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(s.component)] }),
          new TableCell({ children: [new Paragraph(s.width || s.height)] }),
          new TableCell({ children: [new Paragraph(s.details)] })
        ]
      }))
    ]
  });
}

function createDocument() {
  const sections = [
    // COVER PAGE
    new Paragraph({
      text: '',
      spacing: { line: 720 }
    }),
    new Paragraph({
      text: 'PSYGIL',
      fontSize: 48,
      bold: true,
      alignment: AlignmentType.CENTER,
      spacing: { line: 720, before: 400, after: 200 }
    }),
    new Paragraph({
      text: 'UX Design Guide',
      fontSize: 32,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: 480 }
    }),
    new Paragraph({
      text: 'Definitive UI/UX Specification for Development',
      fontSize: 14,
      italics: true,
      alignment: AlignmentType.CENTER,
      spacing: { after: 600, line: 360 }
    }),
    new Paragraph({
      text: '',
      spacing: { line: 720 }
    }),
    new Paragraph({
      text: 'Version: 1.0',
      fontSize: 12,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: 'Date: March 20, 2026',
      fontSize: 12,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: 'Author: Truck Irwin / Foundry SMB',
      fontSize: 12,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: 'Status: LOCKED — Approved for Development',
      fontSize: 12,
      bold: true,
      alignment: AlignmentType.CENTER,
      color: 'C00000',
      spacing: { after: 600 }
    }),

    new PageBreak(),

    // DESIGN PHILOSOPHY
    new Paragraph({
      text: '1. Design Philosophy',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Psygil is not a web application. It is not a dashboard. It is an IDE—a professional tool for forensic psychology practitioners.',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Design Principles:',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'VS Code/Cursor IDE Paradigm: Dense, professional, clinical-grade. Three-column persistent layout with draggable splitters. Tab-based document navigation. Tree-based case explorer.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'DOCTOR ALWAYS DIAGNOSES: AI assists the clinician. The AI never decides. Every gate, every recommendation, every output passes through clinical judgment. The interface enforces this: buttons guide, AI suggests, but the doctor chooses.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Professional Density: Information is compact, layered, and scannable. No wasted space. No animations. No gamification. This is clinical work.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Persistent Three-Column Layout: Left (Explorer), Center (Editor), Right (Context + Chat). Columns are resizable via draggable splitters. All splitters are persistent across sessions.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Tab Navigation: Documents open as tabs. Users click tabs to switch between cases, reports, evaluations. Close button (×) removes tabs. Active tab is indicated by accent-colored bottom border.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Tree-Based Explorer: Cases are hierarchical. Folders expand/collapse. Leaf nodes open as tabs. Tree nodes show icons (emoji) and optional badges (case numbers).',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // APPLICATION SHELL
    new Paragraph({
      text: '2. Application Shell',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'The application shell is a vertical stack of three sections: Titlebar, Main Layout, and Statusbar. The entire app is 100vh (full viewport height) with no scroll on the body element.',
      spacing: { after: 200, line: 360 }
    }),

    new Paragraph({
      text: '2.1 Titlebar',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: 36px\nBackground: var(--panel)\nBorder: 1px solid var(--border) on bottom\nPadding: 0 16px\n\nContent (left-aligned):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'App name "PSYGIL" in 15px font, 600 weight, letter-spacing 2px, secondary text color\n\nContent (right-aligned):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Settings gear icon (⚙, 22px, secondary color, hover = accent)\nTheme toggle (🌙, 18px, secondary color, cursor pointer)\nUser avatar (28px circle, accent background, white initials, 12px font, 600 weight)\nUser name (12px, secondary color)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '2.2 Main Layout',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Three columns in horizontal flex layout. Columns are separated by 2px vertical splitters (col-resize cursor).',
      spacing: { after: 120, line: 360 }
    }),

    new Paragraph({
      text: '2.3 Statusbar',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: 24px\nBackground: var(--panel)\nBorder: 1px solid var(--border) on top\nContent: Right-aligned status indicators',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Connection status (green dot + "Connected")\nLLM model (e.g., "LLM: Claude Sonnet")\nPII Safe Harbor status (e.g., "PII: Safe Harbor ✓")\nStorage mode (e.g., "Local")\nCase count (e.g., "5 cases")\nVersion (e.g., "v1.0.0")',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // COLOR SYSTEM
    new Paragraph({
      text: '3. Color System & Theming',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Psygil supports three color themes. The active theme is toggled via the data-theme attribute on the HTML root element. Users cycle through themes by clicking the theme toggle (🌙) in the titlebar.',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Light Theme (default, data-theme="light"):',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    createColorTable('Light', lightTheme),
    new Paragraph({
      text: '',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Medium Theme (data-theme="medium"):',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    createColorTable('Medium', mediumTheme),
    new Paragraph({
      text: '',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Dark Theme (data-theme="dark"):',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    createColorTable('Dark', darkTheme),

    new PageBreak(),

    // TYPOGRAPHY
    new Paragraph({
      text: '4. Typography',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Fonts:',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Primary font: Inter (served via Google Fonts CDN)\nWeights: 400, 500, 600, 700\n\nMonospace font: JetBrains Mono (served via Google Fonts CDN)\nWeights: 400, 500\nUsage: Code blocks, monospace text, logs',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Font Scale:',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    createTypographyTable(),
    new Paragraph({
      text: '',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Line Height: 1.6 for body text, 1.5 for tables and dense content',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Letter Spacing: 0.5px for uppercase panel headers (CASES, CONTEXT, etc.), 0.3px for section titles, normal for all other text',
      spacing: { after: 120, line: 360 }
    }),

    new PageBreak(),

    // COLUMN 1 - EXPLORER
    new Paragraph({
      text: '5. Column 1 — Explorer (Left Column)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Default width: 280px | Min width: 180px | Max width: 500px (enforced by splitter)',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'The left column contains two panels split by a horizontal splitter:',
      spacing: { after: 120, line: 360 }
    }),

    new Paragraph({
      text: '5.1 CASES Panel (Upper)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex: 1 (fills remaining space)\n\nPanel header "CASES" (11px, 600 weight, uppercase, letter-spacing 0.5px, secondary color)',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Header action buttons (right-aligned):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: '➕ New (20×20px, 13px font, secondary color, highlight bg on hover, accent text on hover)\n⊞ Browse (20×20px, 13px font)\n↑ Upload (20×20px, 13px font)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Tree component below header (scrollable, overflow-y: auto)',
      spacing: { after: 120, line: 360 }
    }),

    new Paragraph({
      text: '5.2 RESOURCES Panel (Lower)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex: 0 0 80px (fixed height)\n\nPanel header "RESOURCES" (11px, 600 weight, uppercase)\n\nStatic links with emoji icons:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: '📋 Clinical Notes\n📚 Reference Library\n⚖ Legal Framework\n🔗 External Links\n\nEach link: 12px font, secondary text color, highlight background on hover',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '5.3 Tree Specification',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    createLayoutTable(),
    new Paragraph({
      text: '',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Tree Node Structure:',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: ~22px (3px padding top/bottom)\nIndent: 8px base + 16px per depth level (set via CSS custom property --indent)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Chevron icon (▸ collapsed, ▾ expanded, 16×16px, 10px font, hidden for leaf nodes)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Tree icon (16×16px, emoji-based):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: '📁 Folder (case, collateral records, interviews, test results, gates)\n📄 Document (overview, individual records)\n📊 Chart/Report (test results, summary, evidence map)\n🎙 Interview/Session\n📝 Evaluation report\n⚖ Legal gate\n✍ Attestation\n📋 Audit trail\n💬 Review notes\n🗺 Evidence map',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Label: flex: 1, text-overflow: ellipsis, single-line overflow handling',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Badge: Optional, appears on case root nodes. Accent background, white text, 10px font, 600 weight, 3px border-radius. Content: case number (e.g., "#2026-0147")',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'States:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Default: text color, secondary icons, highlight bg on hover\nActive (user clicked): accent background, white text\nExpanded (folder has children): chevron points down (▾)\nCollapsed (folder has children): chevron points right (▸)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Click behavior:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Leaf nodes: Open as tab in center column\nFolder nodes: Toggle expand/collapse\nFolder with both children AND contentFn: Click toggles expand AND opens tab',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new PageBreak(),

    // COLUMN 2 - EDITOR
    new Paragraph({
      text: '6. Column 2 — Editor (Center Column)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Width: flex: 1 (fills remaining space)\n\nThe center column is subdivided into three sections:',
      spacing: { after: 120, line: 360 }
    }),

    new Paragraph({
      text: '6.1 Tab Bar',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: 32px\nBackground: var(--panel)\nBorder: 1px solid var(--border) on bottom\nDisplay: flex, horizontal scrolling (overflow-x: auto), scrollbar hidden (height: 0)\nPadding: 0 12px\n\nTab styling:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: 32px\nPadding: 0 12px\nFont: 12px, Inter, normal weight\nGap between tabs: 6px\nColor (inactive): var(--text-secondary)\nColor (active): var(--text)\nBackground (inactive): var(--bg)\nBackground (active): var(--bg)\nBottom border (inactive): none\nBottom border (active): 2px solid var(--accent)\nFont weight (active): 500',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Close button (× character):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Size: 16×16px\nOpacity (default): 0\nOpacity (tab hover): 0.6\nOpacity (tab active): 0.6\nOpacity (close button hover): 1.0\nBackground on hover: rgba(0, 0, 0, 0.1)\nBorder radius: 3px',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new Paragraph({
      text: '6.2 Tab Content Area',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex: 1 (fills remaining space)\noverflow-y: auto (scrollable content)\n\nOne .tab-pane is visible at a time (display: none for inactive). Active pane is displayed as position: relative (or display: block).',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Padding: 20px 24px\n\nContent typography:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'h1: 20px, 600 weight, margin-bottom 16px\nh2: 15px, 600 weight, margin-top 20px, margin-bottom 12px, padding-bottom 6px, border-bottom 1px solid var(--border)\nh3: 14px, 600 weight, margin-top 16px, margin-bottom 8px\np: 13px, line-height 1.6, margin-bottom 10px\nul/ol: 13px, line-height 1.6, padding-left 20px, margin-bottom 12px',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Component patterns within tab content:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Card: var(--panel) background, 1px solid var(--border), border-radius 4px, padding 12px, margin-bottom 12px',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Card title: 13px, 600 weight, margin-bottom 8px\nCard content: 13px, line-height 1.5',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Info Grid: 2-column CSS grid, 10px gap. Item: padding 8px, background var(--highlight), border-radius 4px',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Info Item label: 11px, secondary color, margin-bottom 2px\nInfo Item value: 13px, 500 weight',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Table: 100% width, border-collapse collapse, margin-bottom 16px, font-size 12px',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Table header (th): var(--panel) background, 6px 10px padding, 600 weight, 1px solid var(--border) on all sides\nTable cell (td): 6px 10px padding, 1px solid var(--border)\nTable row (even): var(--highlight) background\nTable row (elevated): var(--accent) background, white text, 500 weight',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Button (primary): var(--accent) background, white text, 6px 12px padding, border-radius 4px, 12px font, 500 weight, cursor pointer',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Button (secondary): var(--panel) background, var(--text) color, 1px solid var(--border), 6px 12px padding, border-radius 4px, 12px font',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new PageBreak(),

    // WORD EDITOR MODE
    new Paragraph({
      text: '6.3 Word Editor Mode',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'When a tab has the isWord flag (e.g., CST Evaluation Report), the editor mode changes to simulate a Word document editor.',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Word Toolbar (mounts above content):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Background: var(--panel)\nBorder: 1px solid var(--border) on bottom\nPadding: 4px 8px\n\nRibbon tabs (left-aligned): File, Home, Insert, Layout, References, Review, View',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Tab style: 11px font, border-bottom 2px solid transparent (inactive) or var(--accent) (active), 600 weight on active, padding 4px 10px, cursor pointer',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Formatting tools (below ribbon tabs): 3px 6px padding, background none (default), 1px transparent border, border-radius 3px, 12px font. Hover: var(--highlight) background, 1px solid var(--border)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Document editor pane:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Tab pane padding: 0 (full width)\nBackground: var(--panel) (gray background)\nDocument container: max-width 816px (8.5in at 96dpi), centered, white background, 72px padding (1in margins)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Document content:',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Font: Times New Roman, 12pt\nLine height: 1.6\nMinimum height: 1056px (11in page)\nBox shadow: subtle edge effect (simulates page edge)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1800 }
    }),
    new Paragraph({
      text: 'AI Draft sections (within document):',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Border: 2px dashed #ff9800 (orange dashed)\nBackground: #fff8e1 (light orange)\nPadding: 8px\nLabel badge: "AI Draft" (orange background, white text, 9px font, top-left corner)\nText color: #333 (dark gray)\n\nRuler bar above document:',
      spacing: { after: 120, line: 360 },
      indent: { left: 1800 }
    }),
    new Paragraph({
      text: 'Height: 20px\nBackground: var(--panel)\nContent: Monospace numbers 1-8 (inch marks)\nDisplay: flex, flex-direction row',
      spacing: { after: 120, line: 360 },
      indent: { left: 1800 }
    }),

    new Paragraph({
      text: '6.4 Status & Gates Panel (Bottom)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex-shrink: 0 (fixed height)\nHeight: 80px\nBackground: var(--panel)\nBorder: 1px solid var(--border) on top\nPadding: 8px 12px\n\nGate tabs (pill-style buttons):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Padding: 6px 12px\nBackground (inactive): var(--panel)\nBackground (active): var(--accent)\nBorder: 1px solid var(--border)\nBorder (active): 1px solid var(--accent)\nBorder radius: 4px\nFont: 12px\nColor (inactive): var(--text-secondary)\nColor (active): white\nCursor: pointer\nMargin-right: 8px',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Gate state icons:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: '✓ (checkmark): Completed\n● (filled circle): In progress\n○ (empty circle): Not started',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new PageBreak(),

    // COLUMN 3 - CONTEXT
    new Paragraph({
      text: '7. Column 3 — Context + Writing Assistant (Right Column)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Default width: 320px | Min width: 200px | Max width: 600px\n\nThe right column is split by a horizontal splitter into two sections: Context Panel (upper) and Writing Assistant (lower).',
      spacing: { after: 200, line: 360 }
    }),

    new Paragraph({
      text: '7.1 Context Panel (Upper)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex: 1 (fills remaining space)\n\nPanel header "CONTEXT" (11px, 600 weight, uppercase, letter-spacing 0.5px, secondary color)',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Sections within the Context panel (scrollable content):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Case Notes\nAI Agent Status\nDeadlines\nQuick Actions',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Section styling:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Padding: 12px\nBorder: bottom border 1px solid var(--border) between sections\nSection title: 11px, 600 weight, uppercase, secondary color, letter-spacing 0.3px\nSection content: 12px font, var(--text) color, line-height 1.5',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '7.2 Writing Assistant (Lower)',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'flex: 0 0 280px (fixed height)\nBackground: var(--panel)\nBorder: 1px solid var(--border) on top\nDisplay: flex, flex-direction column',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Panel header "WRITING ASSISTANT" (11px, 600 weight, uppercase, secondary color)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Header action button: Clear (✕, 16×16px, secondary color, hover = accent)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Chat messages area (flex: 1, scrollable, overflow-y: auto):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Padding: 8px 10px\nGap between messages: 8px\n\nUser message:',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Alignment: right\nBackground: var(--accent)\nColor: white\nPadding: 8px 10px\nBorder radius: 8px with 2px bottom-right sharp corner\nMax width: 88% of container\nFont: 12px',
      spacing: { after: 120, line: 360 },
      indent: { left: 1800 }
    }),
    new Paragraph({
      text: 'Assistant message:',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Alignment: left\nBackground: var(--panel)\nColor: var(--text)\nPadding: 8px 10px\nBorder radius: 8px with 2px bottom-left sharp corner\nMax width: 88% of container\nFont: 12px',
      spacing: { after: 120, line: 360 },
      indent: { left: 1800 }
    }),
    new Paragraph({
      text: 'Input area (background var(--panel), border-top 1px):',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Label row: "Writing Assistant" (10px, 600 weight, uppercase, secondary color) + Send button (32×32px, var(--accent) background, ➤ icon, white)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),
    new Paragraph({
      text: 'Textarea: 3 rows default, full width, 6px 10px padding, 1px solid var(--border), border-radius 4px, var(--bg) background, 12px Inter font, no resize\nBehavior: Send on Enter (Ctrl+Enter or Cmd+Enter), newline on Shift+Enter',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new PageBreak(),

    // SPLITTERS & SCROLLBARS
    new Paragraph({
      text: '8. Splitters & Scrollbars',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),

    new Paragraph({
      text: '8.1 Splitters',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Vertical Splitters (between columns):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Width: 2px\nBackground: var(--border)\nCursor: col-resize\nHover/drag state: background var(--accent)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Horizontal Splitters (within columns):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Height: 2px\nBackground: var(--border)\nCursor: row-resize\nHover/drag state: background var(--accent)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Drag behavior:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'During drag: body element receives .dragging class, all elements get pointer-events: none except the active splitter\nDrag direction: constrained (vertical splitters move horizontally, horizontal move vertically)\nPersistent state: Splitter positions saved to localStorage and restored on page reload',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Five splitters total:',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: '1. Left column ↔ Center column (vertical, col-resize)\n2. Center column ↔ Right column (vertical, col-resize)\n3. CASES ↔ RESOURCES within left column (horizontal, row-resize)\n4. Editor ↔ Gates within center column (horizontal, row-resize)\n5. Context ↔ Chat within right column (horizontal, row-resize)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '8.2 Scrollbars',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Width: 8px\nHeight: 8px\nTrack color: var(--bg)\nThumb color: var(--border)\nThumb border-radius: 4px\nThumb hover color: var(--text-secondary)\n\nNote: Tab bar (.tab-bar) has height: 0 scrollbar (horizontal scrollbar hidden)',
      spacing: { after: 200, line: 360 }
    }),

    new PageBreak(),

    // CASE FILE TREE
    new Paragraph({
      text: '9. Case File Tree Structure',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'The canonical tree structure for a forensic case in Psygil:',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: '📁 [Case Name] — [Case Type] (badge: #[case number])\n  📄 Overview\n  📁 Collateral Records\n    📄 Court Order\n    📄 Hospital Records\n    📄 Police Report\n    📄 Jail Medical Records\n    📄 Prior Evaluation\n  📁 Interviews\n    🎙 Session 1 — Initial Interview\n    🎙 Session 2 — Psychological Testing\n    🎙 Session 3 — Cognitive Testing\n  📁 Test Results\n    📊 Summary\n    📊 MMPI-3\n    📊 PAI\n    📊 WAIS-V\n    📊 TOMM\n    📊 SIRS-2\n  🗺 Evidence Map\n  📝 CST Evaluation Report (opens in Word editor mode)\n  📁 Gates\n    ⚖ Gate 2 — Diagnostic\n    ✍ Gate 3 — Attestation\n  📋 Audit Trail\n  💬 Review Notes',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 },
      font: 'Courier New'
    }),
    new Paragraph({
      text: 'Icons and types:',
      bold: true,
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Folders (📁): Expandable containers, children are shown/hidden via chevron toggle\nDocuments (📄): Leaf nodes, open as tabs when clicked\nCharts/Reports (📊): Test result containers, open as tabs\nSessions (🎙): Interview recordings/transcripts, open as tabs\nEvaluation reports (📝): Special flag isWord=true, opens with Word toolbar\nGates (⚖, ✍): Decision gates, open as interactive forms\nAudit (📋): Read-only log, opens as table\nReview (💬): Peer review cards, open as tab\nEvidence (🗺): Cross-reference matrix, opens as tab',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // INTERACTION PATTERNS
    new Paragraph({
      text: '10. Interaction Patterns',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),

    new Paragraph({
      text: '10.1 Tree Navigation',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Click leaf node → Opens as new tab in center column, becomes active tab',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Click folder → Toggles expand/collapse. Icon shows chevron (▸ collapsed, ▾ expanded)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Click folder with contentFn → Toggles expand AND opens tab (folder acts like both container and document)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Double-click tree node → Opens as tab (same as single click for leaves)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Hover tree node → Background changes to var(--highlight)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '10.2 Tab Management',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Click tab label → Switches to that tab (activates its content pane)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Click × button on tab → Closes the tab. If it was the active tab, switches to adjacent tab (next in order, or previous if last).',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Right-click on tab → Context menu (copy path, close others, close all)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Keyboard shortcut Ctrl+W (Cmd+W on Mac) → Closes active tab',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Keyboard shortcut Ctrl+Tab → Cycles to next tab\nCtrl+Shift+Tab → Cycles to previous tab',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '10.3 Theme Cycling',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Click theme toggle (🌙) in titlebar → Cycles through themes: light → medium → dark → light',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Theme selection saved to localStorage (key: "theme") and restored on page reload',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: '10.4 Settings',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Click settings gear (⚙) in titlebar → Opens "Settings" tab in center column',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Settings sections:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Storage Configuration (Local / Shared / Cloud — radio buttons)\nLLM Configuration (model selector, API key management)\nPractice Information (name, license number, jurisdiction)\nTheme Selector (explicit theme radio buttons)',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new Paragraph({
      text: '10.5 Word Document Toolbar',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'When active tab has isWord: true, the Word toolbar appears above the content pane.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Toolbar is hidden when tab switches away from a Word document.',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Toolbar buttons:',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Font selector (dropdown: Times New Roman, Arial, Calibri, etc.)\nFont size selector (dropdown: 10, 11, 12, 13, 14, 16, 18, 20, etc.)\nBold (B, keyboard: Ctrl+B or Cmd+B)\nItalic (I, keyboard: Ctrl+I or Cmd+I)\nUnderline (U, keyboard: Ctrl+U or Cmd+U)\nStrikethrough (S̶)\nAlignment (left, center, right, justify — radio buttons)\nBullet list toggle\nNumbered list toggle\n"Edit in Word" button → Opens document in external Word editor (or downloads .docx)\n"Publish to PDF" button → Converts document to PDF',
      spacing: { after: 120, line: 360 },
      indent: { left: 1440 }
    }),

    new Paragraph({
      text: '10.6 Chat Interaction',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Type in textarea → Focus visible (border 1px solid var(--accent))',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Press Enter → Sends message, clears textarea, appends user message to chat, triggers AI response\nPress Shift+Enter → Inserts newline (multi-line message)',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'AI response simulated with 600ms delay → Assistant message appears below user message',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Clear button (✕) → Clears all messages from chat, resets conversation',
      spacing: { after: 120, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // COMPONENT INVENTORY
    new Paragraph({
      text: '11. Component Inventory',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'Reusable components in Psygil. Each component includes default styling, states, and interactions.',
      spacing: { after: 200, line: 360 }
    }),

    new Paragraph({
      text: 'Panel Header',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A header for a collapsible panel.\n\nHTML structure: <div class="panel-header">\n\nStyling: 32px height, 0 12px padding, var(--panel) background, 1px solid var(--border) border-bottom, 11px font, 600 weight, uppercase, letter-spacing 0.5px, secondary color\n\nOptional action buttons (right-aligned): 20×20px icons, secondary color, hover = highlight background + accent color',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Tree Node',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A single item in the explorer tree.\n\nHTML structure: <div class="tree-node"> with child elements:\n  <div class="tree-chev">▸ or ▾</div>\n  <div class="tree-icn">📁</div>\n  <div class="tree-label">Label text</div>\n  <span class="tree-badge">#2026-0147</span> (optional)\n\nStyling: 22px height, 3px padding top/bottom, flex layout, cursor pointer, 13px font\n\nStates:\n  Default: text color, secondary icons, highlight bg on hover\n  Active (.active): accent background, white text, white icons\n  Hover: highlight background\n\nChevron (.tree-chev): 16×16px, 10px font, hidden for leaf nodes\nIcon (.tree-icn): 16×16px, emoji or SVG\nLabel (.tree-label): flex: 1, text-overflow: ellipsis, overflow hidden\nBadge (.tree-badge): 1px 5px padding, var(--accent) background, white text, 10px font, 600 weight, 3px radius',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Tab',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A single tab in the tab bar.\n\nHTML structure: <div class="tab">\n  <span class="tab-label">Tab title</span>\n  <span class="tab-close">×</span>\n</div>\n\nStyling: 32px height, 0 12px padding, 12px font, flex layout, gap 6px, flex-shrink 0, white-space nowrap, cursor pointer\n\nStates:\n  Default: text-secondary color, bg background, border-right 1px var(--border)\n  Hover: text color, highlight background\n  Active (.active): text color, bg background, border-bottom 2px var(--accent), 500 weight\n\nClose button (.tab-close): 16×16px, opacity 0 default, opacity 0.6 on tab hover/active, opacity 1.0 on close button hover, border-radius 3px, font-size 14px',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Card',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A container for grouped content.\n\nHTML structure: <div class="card">\n  <div class="card-title">Title</div>\n  <div class="card-content">Content</div>\n</div>\n\nStyling: var(--panel) background, 1px solid var(--border), border-radius 4px, 12px padding, margin-bottom 12px\n\nCard title (.card-title): 13px font, 600 weight, margin-bottom 8px\nCard content (.card-content): 13px font, line-height 1.5',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Button',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Primary button: var(--accent) background, white text, 6px 12px padding, border-radius 4px, 12px font, 500 weight, cursor pointer, border none\n\nSecondary button: var(--panel) background, var(--text) color, 1px solid var(--border), 6px 12px padding, border-radius 4px, 12px font, cursor pointer\n\nHover state (both): opacity 0.8 or lighter shade',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Info Grid',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A 2-column grid of label/value pairs.\n\nHTML structure: <div class="info-grid">\n  <div class="info-item">\n    <div class="info-label">Label</div>\n    <div class="info-value">Value</div>\n  </div>\n</div>\n\nGrid styling: display grid, grid-template-columns 1fr 1fr, gap 10px\n\nInfo item styling: 8px padding, var(--highlight) background, border-radius 4px\nLabel (.info-label): 11px font, secondary color, margin-bottom 2px\nValue (.info-value): 13px font, 500 weight',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Gate Tab',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A pill-button representing a processing gate.\n\nHTML: <button class="gate-tab">✓ Gate 1: Data Collection</button>\n\nStyling: 6px 12px padding, var(--panel) background, var(--text) color, 1px solid var(--border), border-radius 4px, 12px font, cursor pointer, margin-right 8px\n\nActive state (.active): var(--accent) background, white text, 1px solid var(--accent)\n\nState icons: ✓ (completed), ● (in progress), ○ (not started)',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Chat Message',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'User message: right-aligned, var(--accent) background, white text, 8px 10px padding, border-radius 8px (2px bottom-right sharp), max-width 88%, font 12px\n\nAssistant message: left-aligned, var(--panel) background, var(--text) color, 8px 10px padding, border-radius 8px (2px bottom-left sharp), max-width 88%, font 12px',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Chat Input',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'A textarea with send button.\n\nHTML: <div class="chat-input">\n  <div class="chat-input-header">\n    <label>Writing Assistant</label>\n    <button class="send-btn">➤</button>\n  </div>\n  <textarea placeholder="..."></textarea>\n</div>\n\nLabel: 10px font, 600 weight, uppercase, secondary color\nSend button: 32×32px, var(--accent) background, white, cursor pointer\nTextarea: 3 rows, 100% width, 6px 10px padding, 1px solid var(--border), border-radius 4px, var(--bg) background, 12px Inter font, no resize, focus border var(--accent)',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Badge',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'An accent-colored pill with text.\n\nStyling: 1px 5px padding, var(--accent) background, white text, 10px font, 600 weight, border-radius 3px',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Table',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Data presentation component.\n\nStyling: 100% width, border-collapse collapse, margin-bottom 16px, font-size 12px\n\nHeader (th): var(--panel) background, 6px 10px padding, 600 weight, 1px solid var(--border) on all sides\nCell (td): 6px 10px padding, 1px solid var(--border)\nEven row: var(--highlight) background\nElevated row (.elevated-row): var(--accent) background, white text, 500 weight',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // ACCESSIBILITY & RESPONSIVE
    new Paragraph({
      text: '12. Accessibility & Responsive Design',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),

    new Paragraph({
      text: 'Accessibility',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'WCAG 2.1 Level AA compliance:\n\n• Color contrast: All text must have at least 4.5:1 contrast ratio (AA standard). Test all theme colors.\n• Keyboard navigation: All interactive elements (tabs, tree nodes, buttons, inputs) must be keyboard accessible.\n• Focus indicators: Active tab has 2px accent bottom border. All buttons have focus outline.\n• ARIA labels: Tree nodes have aria-label attributes. Buttons have aria-label for icon-only buttons.\n• Semantic HTML: Use <button> for buttons, <nav> for navigation, <section> for content sections.\n• Skip links: Not required for an IDE, but consider adding a "Skip to content" link for accessibility testers.',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Responsive Design',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Psygil is designed for desktop (1200px+) and tablet (768px+). Mobile support is out of scope for the MVP.\n\nTablet breakpoint (768px - 1199px):\n• Right column (Context + Chat) collapses to a side drawer (hidden by default, toggled via button in titlebar)\n• Column widths adjust: Left 240px, Center flex: 1, Right hidden\n• Splitter bounds adjusted for smaller screen\n\nMinimum width: 768px. Below this, the app is not responsive.',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // IMPLEMENTATION NOTES
    new Paragraph({
      text: '13. Implementation Notes',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),

    new Paragraph({
      text: 'CSS Architecture',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Use CSS custom properties (--bg, --panel, --border, --text, --text-secondary, --accent, --highlight) for theming.\n\nTheme switching: Set data-theme attribute on html element, CSS uses :root[data-theme="light"] selectors to define colors.\n\nFlex layout: Use flexbox for main layout (columns, rows, splitters). Grid for info grids only.',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'JavaScript / Interaction',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Tree node rendering: Recursive function that builds DOM from tree data structure. Each node is a <div class="tree-node"> with computed --indent CSS variable.\n\nTab management: Array of open tabs, one active. Opening a tab checks if already open; if so, makes it active. Closing removes from array.\n\nSplitter dragging: On mousedown on splitter, attach mousemove listener to document. On mousemove, calculate new width/height based on mouse position. Constrain to min/max bounds. On mouseup, save to localStorage.\n\nTheme toggle: Cycle through array ["light", "medium", "dark"]. Set html.setAttribute("data-theme", newTheme). Save to localStorage.\n\nChat: Mock responses simulated with setTimeout(600ms). Parse user input, append user message bubble, simulate thinking, append assistant message bubble.',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Performance Considerations',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: '• Lazy-load tree nodes: Only render visible nodes (virtualization). For large case trees, implement windowing.\n• Tab content caching: Cache rendered tab content to avoid re-rendering when switching tabs.\n• Debounce splitter drag: Debounce localStorage updates during splitter drag to avoid excessive writes.\n• Intersection Observer: For scrollable sections (tree, chat), use IntersectionObserver to detect when new items enter viewport.',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new Paragraph({
      text: 'Browser Compatibility',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Target: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+\n\nNo IE11 support. Use CSS Grid, Flexbox, CSS custom properties freely.\n\nTest on: Chrome, Firefox, Safari (macOS + iOS), Edge (Windows)',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),

    new PageBreak(),

    // SUMMARY
    new Paragraph({
      text: '14. Design System Summary',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 240, line: 360 }
    }),
    new Paragraph({
      text: 'This UX Design Guide is the definitive specification for the Psygil UI. It contains every pixel value, every color, every interaction pattern, and every component needed to implement the application.',
      spacing: { after: 200, line: 360 }
    }),
    new Paragraph({
      text: 'Key principles (reiterated):',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: '✓ IDE paradigm: VS Code / Cursor, not a web app\n✓ Three-column layout with draggable splitters\n✓ Tab-based navigation\n✓ Tree-based case explorer\n✓ DOCTOR ALWAYS DIAGNOSES: AI assists, never decides\n✓ Professional density: compact, clinical-grade, no flashiness\n✓ Three-theme system: light, medium, dark\n✓ All measurements in pixels or viewport units\n✓ Persistent state saved to localStorage\n✓ Full keyboard accessibility\n✓ Desktop-first (1200px+), tablet support (768px+)',
      spacing: { after: 200, line: 360 },
      indent: { left: 720 }
    }),
    new Paragraph({
      text: 'Use this document as the authoritative reference during development. Every button, every color, every spacing value is locked.',
      spacing: { after: 120, line: 360 }
    }),
    new Paragraph({
      text: 'Status: LOCKED — Approved for Development',
      bold: true,
      color: 'C00000',
      spacing: { before: 200 }
    })
  ];

  return new Document({
    sections: [{
      properties: {},
      children: sections
    }]
  });
}

async function generateDocx() {
  const doc = createDocument();
  const buffer = await Packer.toBuffer(doc);

  const outputPath = '/sessions/dreamy-nifty-cray/mnt/Psygil/docs/engineering/10_UX_Design_Guide.docx';

  // Ensure directory exists
  const dir = require('path').dirname(outputPath);
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ UX Design Guide created: ${outputPath}`);
  console.log(`✓ File size: ${(buffer.length / 1024).toFixed(2)} KB`);
}

generateDocx().catch(err => {
  console.error('Error generating document:', err);
  process.exit(1);
});
