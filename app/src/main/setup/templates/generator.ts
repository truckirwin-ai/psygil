// =============================================================================
// Template Generator, turn ReportTemplate data into .docx files
// =============================================================================
//
// Flow at setup time:
//   1. Setup Step 7 collects selected eval types
//   2. provisionTemplates() is called with the project root and practice info
//   3. We pick the matching ReportTemplate objects from the registry
//   4. For each, render practice-level placeholders (leaving patient-level
//      placeholders intact) and write a .docx into {projectRoot}/templates/
//   5. Also write a plain-text twin (.txt) next to each .docx for quick
//      inspection and agent-friendly indexing
//
// No PHI is ever written by this module. Practice-level fields are non-PHI
// identity and letterhead data.
// =============================================================================

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { PracticeInfo } from '../state'
import type { ReportTemplate, TemplateSection } from './registry'
import { REPORT_TEMPLATES, templatesForEvalTypes } from './registry'

// ---------------------------------------------------------------------------
// Dynamic docx import, matches the pattern used in docx-generator.ts so
// Electron's main process can resolve the dependency at runtime.
// ---------------------------------------------------------------------------

interface DocxModule {
  Document: typeof import('docx').Document
  Packer: typeof import('docx').Packer
  Paragraph: typeof import('docx').Paragraph
  HeadingLevel: typeof import('docx').HeadingLevel
  TextRun: typeof import('docx').TextRun
  AlignmentType: typeof import('docx').AlignmentType
}

function loadDocx(): DocxModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('docx') as typeof import('docx')
  return {
    Document: m.Document,
    Packer: m.Packer,
    Paragraph: m.Paragraph,
    HeadingLevel: m.HeadingLevel,
    TextRun: m.TextRun,
    AlignmentType: m.AlignmentType,
  }
}

// ---------------------------------------------------------------------------
// Placeholder substitution, practice-level tokens only
// ---------------------------------------------------------------------------

export function buildPracticeTokenMap(practice: PracticeInfo): Record<string, string> {
  return {
    PRACTICE_NAME: practice.practiceName ?? 'Independent Forensic Practice',
    CLINICIAN_FULL_NAME: practice.fullName,
    CLINICIAN_CREDENTIALS: practice.credentials,
    CLINICIAN_LICENSE: practice.licenseNumber,
    CLINICIAN_STATE: practice.licenseState,
    PRACTICE_ADDRESS: practice.practiceAddress ?? '',
    PRACTICE_PHONE: practice.phone ?? '',
  }
}

/**
 * Replace only keys listed in tokens. Any {{OTHER}} placeholders remain
 * untouched, so patient-level placeholders survive into the final template.
 */
export function applyTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(tokens, key)) {
      return tokens[key]!
    }
    return match
  })
}

function applyTokensToSection(
  section: TemplateSection,
  tokens: Record<string, string>,
): TemplateSection {
  return {
    heading: applyTokens(section.heading, tokens),
    body: section.body.map((line) => applyTokens(line, tokens)),
  }
}

// ---------------------------------------------------------------------------
// DOCX rendering
// ---------------------------------------------------------------------------

async function renderDocx(
  template: ReportTemplate,
  tokens: Record<string, string>,
): Promise<Buffer> {
  const docx = loadDocx()
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = docx

  const children: InstanceType<typeof Paragraph>[] = []

  // Title block
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: applyTokens(template.title, tokens), bold: true })],
    }),
  )
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: applyTokens(template.subtitle, tokens), italics: true }),
      ],
    }),
  )
  children.push(new Paragraph({ text: '' }))

  // Sections
  for (const rawSection of template.sections) {
    const section = applyTokensToSection(rawSection, tokens)
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: section.heading, bold: true })],
      }),
    )
    for (const line of section.body) {
      children.push(new Paragraph({ text: line }))
    }
    children.push(new Paragraph({ text: '' }))
  }

  const doc = new Document({
    creator: tokens['CLINICIAN_FULL_NAME'] ?? 'Psygil',
    title: applyTokens(template.title, tokens),
    description: `Psygil template: ${template.id}`,
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}

/**
 * Render a template to plain text for the .txt twin and for tests.
 */
export function renderText(
  template: ReportTemplate,
  tokens: Record<string, string>,
): string {
  const lines: string[] = []
  lines.push(applyTokens(template.title, tokens).toUpperCase())
  lines.push(applyTokens(template.subtitle, tokens))
  lines.push('')
  for (const rawSection of template.sections) {
    const section = applyTokensToSection(rawSection, tokens)
    lines.push(section.heading.toUpperCase())
    lines.push('-'.repeat(section.heading.length))
    for (const body of section.body) {
      lines.push(body)
    }
    lines.push('')
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Public API, provisioning
// ---------------------------------------------------------------------------

export interface ProvisionTemplateOptions {
  readonly projectRoot: string
  readonly practice: PracticeInfo
  readonly selectedEvalTypes: readonly string[]
  /** If true, overwrite existing template files. Default false. */
  readonly overwrite?: boolean
}

export interface ProvisionTemplateResult {
  readonly id: string
  readonly evalType: string
  readonly docxPath: string
  readonly txtPath: string
  readonly bytesWritten: number
  readonly skipped: boolean
  readonly skipReason: string | null
}

/**
 * Provision templates into {projectRoot}/templates/.
 *
 * Writes a .docx and a .txt twin for each selected eval type. Idempotent:
 * existing files are skipped unless overwrite is true.
 *
 * Returns a result array so the caller (setup wizard) can display what
 * was created, what was skipped, and surface any errors.
 */
export async function provisionTemplates(
  options: ProvisionTemplateOptions,
): Promise<readonly ProvisionTemplateResult[]> {
  const { projectRoot, practice, selectedEvalTypes } = options
  const overwrite = options.overwrite === true

  // Templates live under /Workspace/Templates/ per the consolidated
  // workspace layout. Keep the legacy /templates/ path out, the setup
  // wizard no longer provisions it.
  const templatesDir = join(projectRoot, 'Workspace', 'Templates')
  if (!existsSync(templatesDir)) {
    mkdirSync(templatesDir, { recursive: true })
  }

  const tokens = buildPracticeTokenMap(practice)
  const templates = templatesForEvalTypes(selectedEvalTypes)

  const results: ProvisionTemplateResult[] = []

  for (const template of templates) {
    const docxPath = join(templatesDir, `${template.id}.docx`)
    const txtPath = join(templatesDir, `${template.id}.txt`)

    if (!overwrite && existsSync(docxPath)) {
      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: 0,
        skipped: true,
        skipReason: 'File already exists',
      })
      continue
    }

    try {
      const buffer = await renderDocx(template, tokens)
      writeFileSync(docxPath, buffer)

      // Note: we previously wrote a .txt twin alongside each .docx for
      // agent indexing convenience. That created visual duplication in the
      // file tree. Templates are now .docx only; agents extract text via
      // mammoth on the fly when they need it.

      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: buffer.length,
        skipped: false,
        skipReason: null,
      })
    } catch (err) {
      results.push({
        id: template.id,
        evalType: template.evalType,
        docxPath,
        txtPath,
        bytesWritten: 0,
        skipped: true,
        skipReason: `Generation failed: ${(err as Error).message}`,
      })
    }
  }

  return results
}

/**
 * Emit all templates, regardless of eval type filter. Used by the CLI
 * generator (scripts/generate-templates.ts) to produce a complete sample
 * set into the repo for QA.
 */
export async function provisionAllTemplates(
  options: Omit<ProvisionTemplateOptions, 'selectedEvalTypes'>,
): Promise<readonly ProvisionTemplateResult[]> {
  return provisionTemplates({
    ...options,
    selectedEvalTypes: REPORT_TEMPLATES.map((t) => t.evalType),
  })
}
