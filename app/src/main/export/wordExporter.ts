/**
 * Word (.docx) export for Psygil reports.
 * Uses the `docx` npm package (v9) to generate structured .docx files.
 * Calls dialog.showSaveDialog to prompt for save path.
 */

import { dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  ImageRun,
  PageBreak,
} from 'docx'

export interface WordExportParams {
  reportContent: string     // HTML or plain text from OnlyOffice
  caseNumber: string
  examineeName: string
  evaluationType: string
  clinicianName: string
  branding: {
    practiceName: string
    logoPath?: string        // absolute path to logo image, may be undefined
    tagline?: string
    primaryColor?: string
  }
}

export interface WordExportResult {
  success: boolean
  filePath?: string
  error?: string
}

/**
 * Strip HTML tags from content for plain-text paragraph parsing.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

/**
 * Parse report content into paragraphs.
 * Heading lines (ALL CAPS or preceded by a blank line + short line) become styled headings.
 */
function parseContentToParagraphs(content: string): Paragraph[] {
  const text = content.includes('<') ? stripHtml(content) : content
  const lines = text.split('\n')
  const paragraphs: Paragraph[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      // Blank line — add small spacing
      paragraphs.push(new Paragraph({ text: '', spacing: { before: 80, after: 80 } }))
      continue
    }

    // Treat short ALL-CAPS lines as section headings
    const isHeading = line.length < 80 && line === line.toUpperCase() && /[A-Z]/.test(line)

    if (isHeading) {
      paragraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: line, bold: true })],
        })
      )
    } else {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [new TextRun({ text: line })],
        })
      )
    }
  }

  return paragraphs
}

/**
 * Load logo image as a Buffer and infer dimensions for ImageRun.
 * Returns null if logoPath is missing or unreadable.
 */
function loadLogoImage(logoPath?: string): { data: Buffer; width: number; height: number } | null {
  if (!logoPath) return null
  try {
    if (!fs.existsSync(logoPath)) return null
    const data = fs.readFileSync(logoPath)
    // Default display size for logo on title page: 120 x 60 points
    return { data, width: 120, height: 60 }
  } catch {
    return null
  }
}

/**
 * Export a Psygil report to .docx format.
 */
export async function exportToWord(params: WordExportParams): Promise<WordExportResult> {
  const { reportContent, caseNumber, examineeName, evaluationType, clinicianName, branding } = params

  // ── 1. Prompt for save path ─────────────────────────────────────────────
  const win = BrowserWindow.getFocusedWindow()
  const dialogResult = await dialog.showSaveDialog(win ?? undefined!, {
    title: 'Export Report as Word Document',
    defaultPath: `${examineeName.replace(/\s+/g, '_')}_${caseNumber}_report.docx`,
    filters: [{ name: 'Word Document', extensions: ['docx'] }],
  })

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, error: 'Save cancelled by user' }
  }

  const filePath = dialogResult.filePath

  try {
    // ── 2. Build logo image (optional) ────────────────────────────────────
    const logoImage = loadLogoImage(branding.logoPath)

    // ── 3. Footer text ────────────────────────────────────────────────────
    const footerText = branding.practiceName
      ? `${branding.practiceName} | Confidential`
      : 'psygil.com | a Foundry SMB product'

    // ── 4. Build header: practiceName + caseNumber on every page ──────────
    const headerPara = new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: 'single', size: 6, color: 'AAAAAA' } },
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${branding.practiceName}  |  Case #${caseNumber}`,
          size: 18,
          color: '555555',
        }),
      ],
    })

    // ── 5. Title page content ─────────────────────────────────────────────
    const titlePageChildren: Paragraph[] = []

    // Logo image on title page
    if (logoImage) {
      titlePageChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 240 },
          children: [
            new ImageRun({
              data: logoImage.data,
              transformation: { width: logoImage.width, height: logoImage.height },
              type: path.extname(branding.logoPath ?? '').replace('.', '').toLowerCase() as never || 'png',
            }),
          ],
        })
      )
    } else {
      titlePageChildren.push(new Paragraph({ spacing: { before: 960 }, text: '' }))
    }

    // Practice name
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: branding.practiceName,
            size: 36,
            bold: true,
          }),
        ],
      })
    )

    // Tagline
    if (branding.tagline) {
      titlePageChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [new TextRun({ text: branding.tagline, size: 20, color: '777777' })],
        })
      )
    } else {
      titlePageChildren.push(new Paragraph({ spacing: { after: 480 }, text: '' }))
    }

    // Report title
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `PSYCHOLOGICAL EVALUATION REPORT`,
            size: 28,
            bold: true,
            allCaps: true,
          }),
        ],
      })
    )

    // Evaluation type
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [
          new TextRun({ text: evaluationType, size: 24, italics: true }),
        ],
      })
    )

    // Divider line
    titlePageChildren.push(
      new Paragraph({
        border: { top: { style: 'single', size: 6, color: 'CCCCCC' } },
        spacing: { before: 240, after: 240 },
        text: '',
      })
    )

    // Metadata block
    const metaItems: [string, string][] = [
      ['Examinee', examineeName],
      ['Case Number', caseNumber],
      ['Evaluation Type', evaluationType],
      ['Clinician', clinicianName],
      ['Date', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ]

    for (const [label, value] of metaItems) {
      titlePageChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `${label}: `, bold: true, size: 22 }),
            new TextRun({ text: value, size: 22 }),
          ],
        })
      )
    }

    // Page break after title page
    titlePageChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    )

    // ── 6. Body paragraphs ────────────────────────────────────────────────
    const bodyParagraphs = parseContentToParagraphs(reportContent)

    // ── 7. Assemble document ──────────────────────────────────────────────
    const doc = new Document({
      creator: branding.practiceName || 'Psygil',
      title: `${evaluationType} Report — ${examineeName}`,
      description: `Case ${caseNumber} | ${evaluationType}`,
      sections: [
        {
          properties: {},
          headers: {
            default: new Header({ children: [headerPara] }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: footerText, size: 16, color: '888888' }),
                  ],
                }),
              ],
            }),
          },
          children: [
            ...titlePageChildren,
            ...bodyParagraphs,
          ],
        },
      ],
    })

    // ── 8. Write to file ──────────────────────────────────────────────────
    const buffer = await Packer.toBuffer(doc)
    fs.writeFileSync(filePath, buffer)

    return { success: true, filePath }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Word export failed'
    console.error('[wordExporter] error:', message)
    return { success: false, error: message }
  }
}
