/**
 * DOCX Generation from Writer Agent Output
 *
 * Converts structured WriterOutput JSON (from Writer Agent) into professional
 * .docx files that can be opened and edited in OnlyOffice.
 *
 * Uses the 'docx' npm package to build Word documents programmatically.
 */

import { mkdirSync, readdirSync, promises as fsPromises } from 'fs'
import { join } from 'path'
import type { WriterOutput, WriterSection, WriterReportSummary } from '../agents/writer'
import type { EditorOutput, EditorAnnotation } from '../agents/editor'
import { loadWorkspacePath } from '../workspace'

// Dynamic require for docx to handle module resolution in Electron main process
let Document: any
let Packer: any
let Paragraph: any
let HeadingLevel: any
let TextRun: any

try {
  const docxModule = require('docx') as typeof import('docx')
  Document = docxModule.Document
  Packer = docxModule.Packer
  Paragraph = docxModule.Paragraph
  HeadingLevel = docxModule.HeadingLevel
  TextRun = docxModule.TextRun
} catch (err) {
  console.error('[docx-generator] Failed to load docx module:', err)
  throw new Error('docx module not found. Make sure docx is installed: npm install docx')
}

/**
 * Generate a professional forensic psychology report .docx from WriterOutput.
 *
 * @param caseId - The case ID
 * @param writerOutput - Structured output from Writer Agent
 * @param editorOutput - Optional annotations from Editor Agent
 * @param outputDir - Optional override for output directory (defaults to workspace case folder)
 * @returns {filePath, version} - Path to generated .docx and version number
 */
export async function generateReportDocx(
  caseId: number,
  writerOutput: WriterOutput,
  editorOutput?: EditorOutput | null,
  outputDir?: string,
): Promise<{ filePath: string; version: number }> {
  // Determine output directory
  let reportDir: string
  if (outputDir) {
    reportDir = outputDir
  } else {
    const wsPath = loadWorkspacePath()
    if (!wsPath) {
      throw new Error('Workspace not configured')
    }
    reportDir = getReportDraftsDir(caseId, wsPath)
  }

  // Ensure directories exist
  mkdirSync(reportDir, { recursive: true })

  // Determine version number
  const version = getNextVersion(reportDir)

  // Build document sections
  const sections = buildDocumentSections(writerOutput, editorOutput)

  // Create Word document
  const doc = new Document({
    sections: [
      {
        children: sections,
      },
    ],
  })

  // Generate .docx bytes and save
  const bytes = await Packer.toBuffer(doc)
  const filePath = join(reportDir, `draft_v${version}.docx`)

  // Write to file
  await fsPromises.writeFile(filePath, bytes)

  return { filePath, version }
}

/**
 * Get the directory where report drafts are stored for a case.
 * Path: {workspacePath}/case_{caseId}/report/drafts/
 */
export function getReportDraftsDir(caseId: number, workspacePath?: string): string {
  const wsPath = workspacePath ?? loadWorkspacePath()
  if (!wsPath) {
    throw new Error('Workspace not configured')
  }

  return join(wsPath, `case_${caseId}`, 'report', 'drafts')
}

/**
 * Determine the next version number by counting existing draft_v*.docx files.
 */
function getNextVersion(reportDir: string): number {
  try {
    const files = readdirSync(reportDir)
    const draftFiles = files.filter((f) => f.match(/^draft_v\d+\.docx$/))
    if (draftFiles.length === 0) return 1

    const versions = draftFiles
      .map((f) => {
        const match = f.match(/draft_v(\d+)\.docx/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((v) => v > 0)

    return Math.max(...versions) + 1
  } catch {
    return 1
  }
}

/**
 * Build the document sections from WriterOutput.
 * Includes title page, sections, and editor annotations if provided.
 */
function buildDocumentSections(writerOutput: WriterOutput, editorOutput?: EditorOutput | null): unknown[] {
  const sections: unknown[] = []

  // Title page
  sections.push(
    new Paragraph({
      text: 'Forensic Psychology Evaluation Report',
      heading: HeadingLevel.HEADING_1,
      alignment: 'center' as const,
      spacing: { after: 400 },
    }),
  )

  // Case summary
  const summary = writerOutput.report_summary
  if (summary) {
    sections.push(
      new Paragraph({
        text: 'Report Summary',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
    )

    const summaryRows: unknown[] = []
    if (summary.patient_name) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: 'Patient: ', bold: true }), new TextRun(summary.patient_name)],
          spacing: { after: 100 },
        }),
      )
    }
    if (summary.evaluation_dates) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: 'Evaluation Dates: ', bold: true }), new TextRun(summary.evaluation_dates)],
          spacing: { after: 100 },
        }),
      )
    }
    if (summary.evaluation_type) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: 'Evaluation Type: ', bold: true }), new TextRun(summary.evaluation_type)],
          spacing: { after: 100 },
        }),
      )
    }
    if (summary.selected_diagnoses && summary.selected_diagnoses.length > 0) {
      summaryRows.push(
        new Paragraph({
          children: [new TextRun({ text: 'Selected Diagnoses: ', bold: true }), new TextRun(summary.selected_diagnoses.join(', '))],
          spacing: { after: 200 },
        }),
      )
    }

    sections.push(...summaryRows)
  }

  // Add a page break before content sections
  sections.push(
    new Paragraph({
      pageBreakBefore: true,
      text: '',
    }),
  )

  // Content sections from Writer Agent
  if (writerOutput.sections && writerOutput.sections.length > 0) {
    for (const section of writerOutput.sections) {
      // Section heading
      sections.push(
        new Paragraph({
          text: section.section_name,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 200, before: 200 },
        }),
      )

      // Section content (split by paragraphs)
      const paragraphs = section.content.split('\n\n').filter((p) => p.trim())
      for (const para of paragraphs) {
        sections.push(
          new Paragraph({
            text: para.trim(),
            spacing: { after: 200 },
          }),
        )
      }

      // Content type indicator
      if (section.content_type === 'draft_requiring_revision') {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '⚠️ AI DRAFT, CLINICIAN REVIEW REQUIRED',
                bold: true,
                color: 'FF6B35',
              }),
            ],
            spacing: { after: 200, before: 100 },
          }),
        )
      }

      // Sources
      if (section.sources && section.sources.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Sources: ',
                italic: true,
                color: '666666',
              }),
              new TextRun({
                text: section.sources.join('; '),
                italic: true,
                color: '666666',
              }),
            ],
            spacing: { after: 300 },
          }),
        )
      }
    }
  }

  // Editor annotations if provided
  if (editorOutput && editorOutput.annotations && editorOutput.annotations.length > 0) {
    sections.push(
      new Paragraph({
        pageBreakBefore: true,
        text: 'Editor Review Annotations',
        heading: HeadingLevel.HEADING_2,
        spacing: { after: 200 },
      }),
    )

    // Summary stats
    const summary = editorOutput.review_summary
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Total Flags: ${summary.total_flags} (Critical: ${summary.critical_flags}, High: ${summary.high_flags}, Medium: ${summary.medium_flags}, Low: ${summary.low_flags})`,
            bold: true,
          }),
        ],
        spacing: { after: 200 },
      }),
    )

    // Annotations table
    const annotationRows: unknown[] = []
    for (const annotation of editorOutput.annotations) {
      annotationRows.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${annotation.severity.toUpperCase()}] ${annotation.flag_type}: `,
              bold: true,
              color: getSeverityColor(annotation.severity),
            }),
          ],
          spacing: { before: 100 },
        }),
      )

      annotationRows.push(
        new Paragraph({
          text: annotation.location.section_name,
          spacing: { after: 50 },
          indent: { left: 400 },
        }),
      )

      annotationRows.push(
        new Paragraph({
          text: annotation.description,
          spacing: { after: 100 },
          indent: { left: 400 },
        }),
      )

      annotationRows.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Suggestion: ',
              italic: true,
            }),
            new TextRun({
              text: annotation.suggestion,
              italic: true,
            }),
          ],
          spacing: { after: 200 },
          indent: { left: 400 },
        }),
      )
    }

    sections.push(...annotationRows)
  }

  return sections
}

/**
 * Map severity level to hex color for display.
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'CC0000' // Red
    case 'high':
      return 'FF6B35' // Orange
    case 'medium':
      return 'FFC107' // Yellow
    case 'low':
      return '4CAF50' // Green
    default:
      return '000000' // Black
  }
}
