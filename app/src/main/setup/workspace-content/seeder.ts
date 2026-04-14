// =============================================================================
// Workspace Content Seeder
// =============================================================================
//
// Writes the initial Writing Samples, Documents, Testing guides, and Forms
// into the user's project root at setup time. Runs once after the setup
// wizard collects the practice profile. Idempotent: existing files are
// skipped unless overwrite is requested.
//
// All content is synthetic reference material. No PHI.
// =============================================================================

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

import type { PracticeInfo } from '../state'
import { applyTokens, buildPracticeTokenMap } from '../templates/generator'
import { WRITING_SAMPLES } from './writing-samples'
import { DOCUMENT_FILES } from './documents'
import { TESTING_GUIDES } from './testing'
import { BLANK_FORMS, type BlankForm, type FormSection } from './forms'

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface SeedWorkspaceResult {
  readonly category: 'writing-samples' | 'documents' | 'testing' | 'forms'
  readonly filename: string
  readonly path: string
  readonly bytesWritten: number
  readonly skipped: boolean
  readonly skipReason: string | null
}

export interface SeedWorkspaceOptions {
  readonly projectRoot: string
  readonly practice: PracticeInfo
  readonly overwrite?: boolean
}

// ---------------------------------------------------------------------------
// DOCX rendering for forms (reuses the `docx` package)
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

function applySectionTokens(
  section: FormSection,
  tokens: Record<string, string>,
): FormSection {
  return {
    heading: applyTokens(section.heading, tokens),
    body: section.body.map((line) => applyTokens(line, tokens)),
  }
}

async function renderFormDocx(
  form: BlankForm,
  tokens: Record<string, string>,
): Promise<Buffer> {
  const docx = loadDocx()
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = docx

  const children: InstanceType<typeof Paragraph>[] = []

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: form.title, bold: true })],
    }),
  )
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: form.subtitle, italics: true })],
    }),
  )
  children.push(new Paragraph({ text: '' }))

  for (const rawSection of form.sections) {
    const section = applySectionTokens(rawSection, tokens)
    // Skip the Header section's heading text in the DOCX since it's a
    // letterhead stand-in, not a true heading
    if (section.heading !== 'Header') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: section.heading, bold: true })],
        }),
      )
    }
    for (const line of section.body) {
      children.push(new Paragraph({ text: line }))
    }
    children.push(new Paragraph({ text: '' }))
  }

  const doc = new Document({
    creator: tokens['CLINICIAN_FULL_NAME'] ?? 'Psygil',
    title: form.title,
    description: `Psygil blank form: ${form.id}`,
    sections: [{ children }],
  })

  return Packer.toBuffer(doc)
}

// ---------------------------------------------------------------------------
// Writers, one per category
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function writeSkipResult(
  category: SeedWorkspaceResult['category'],
  filename: string,
  path: string,
  reason: string,
): SeedWorkspaceResult {
  return {
    category,
    filename,
    path,
    bytesWritten: 0,
    skipped: true,
    skipReason: reason,
  }
}

function writeTextFile(
  category: SeedWorkspaceResult['category'],
  dir: string,
  filename: string,
  content: string,
  overwrite: boolean,
): SeedWorkspaceResult {
  ensureDir(dir)
  const path = join(dir, filename)
  if (!overwrite && existsSync(path)) {
    return writeSkipResult(category, filename, path, 'File already exists')
  }
  writeFileSync(path, content, 'utf-8')
  return {
    category,
    filename,
    path,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
    skipped: false,
    skipReason: null,
  }
}

async function writeFormFile(
  dir: string,
  form: BlankForm,
  tokens: Record<string, string>,
  overwrite: boolean,
): Promise<SeedWorkspaceResult> {
  ensureDir(dir)
  const path = join(dir, form.filename)
  if (!overwrite && existsSync(path)) {
    return writeSkipResult('forms', form.filename, path, 'File already exists')
  }
  try {
    const buffer = await renderFormDocx(form, tokens)
    writeFileSync(path, buffer)
    return {
      category: 'forms',
      filename: form.filename,
      path,
      bytesWritten: buffer.length,
      skipped: false,
      skipReason: null,
    }
  } catch (err) {
    return writeSkipResult(
      'forms',
      form.filename,
      path,
      `DOCX generation failed: ${(err as Error).message}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Seed the workspace folders with starter content.
 *
 * Creates:
 *   {projectRoot}/Workspace/Writing Samples/*.txt
 *   {projectRoot}/Workspace/Documents/*.md
 *   {projectRoot}/Workspace/Testing/*.md
 *   {projectRoot}/Workspace/Forms/*.docx
 *
 * The Workspace/Templates/ directory is populated separately by
 * provisionTemplates() in templates/generator.ts.
 */
export async function seedWorkspaceContent(
  options: SeedWorkspaceOptions,
): Promise<readonly SeedWorkspaceResult[]> {
  const { projectRoot, practice } = options
  const overwrite = options.overwrite === true
  const tokens = buildPracticeTokenMap(practice)

  const workspace = join(projectRoot, 'Workspace')
  const writingSamplesDir = join(workspace, 'Writing Samples')
  const documentsDir = join(workspace, 'Documents')
  const testingDir = join(workspace, 'Testing')
  const formsDir = join(workspace, 'Forms')

  const results: SeedWorkspaceResult[] = []

  // Writing Samples, plain text, no token substitution
  for (const sample of WRITING_SAMPLES) {
    results.push(
      writeTextFile(
        'writing-samples',
        writingSamplesDir,
        sample.filename,
        sample.content,
        overwrite,
      ),
    )
  }

  // Documents, markdown, no token substitution
  for (const doc of DOCUMENT_FILES) {
    results.push(
      writeTextFile('documents', documentsDir, doc.filename, doc.content, overwrite),
    )
  }

  // Testing guides, markdown, no token substitution
  for (const guide of TESTING_GUIDES) {
    results.push(
      writeTextFile('testing', testingDir, guide.filename, guide.content, overwrite),
    )
  }

  // Forms, DOCX with practice token substitution
  for (const form of BLANK_FORMS) {
    results.push(await writeFormFile(formsDir, form, tokens, overwrite))
  }

  return results
}

/**
 * Summary counters for UI display.
 */
export function summarizeSeedResults(
  results: readonly SeedWorkspaceResult[],
): { written: number; skipped: number; failed: number; byCategory: Record<string, number> } {
  let written = 0
  let skipped = 0
  let failed = 0
  const byCategory: Record<string, number> = {
    'writing-samples': 0,
    documents: 0,
    testing: 0,
    forms: 0,
  }
  for (const r of results) {
    if (r.skipped && r.skipReason !== null && r.skipReason.startsWith('DOCX generation failed')) {
      failed += 1
    } else if (r.skipped) {
      skipped += 1
    } else {
      written += 1
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
    }
  }
  return { written, skipped, failed, byCategory }
}
