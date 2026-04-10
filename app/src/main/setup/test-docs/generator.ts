// =============================================================================
// Test Document Generator, writes synthetic import-test files to disk
// =============================================================================
//
// Emits one file per entry in TEST_DOCUMENTS, using the appropriate writer
// for each format. Safe to run multiple times; existing files are overwritten
// so the set always matches the registry.
//
// All content is synthetic and marked as such in the body of every document.
// No PHI, no real patient data.
// =============================================================================

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { buildMinimalPdf } from './minimal-pdf'
import type { TestDocument, TestDocFormat } from './registry'
import { TEST_DOCUMENTS } from './registry'

export interface GenerateTestDocResult {
  readonly id: string
  readonly path: string
  readonly format: TestDocFormat
  readonly bytes: number
}

// ---------------------------------------------------------------------------
// DOCX via docx package
// ---------------------------------------------------------------------------

async function writeDocx(doc: TestDocument, outPath: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('docx') as typeof import('docx')
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType } = m

  const paragraphs: InstanceType<typeof Paragraph>[] = []
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: doc.title, bold: true })],
    }),
  )
  for (const line of doc.body.split('\n')) {
    paragraphs.push(new Paragraph({ text: line }))
  }

  const docxDoc = new Document({
    creator: doc.author,
    title: doc.title,
    description: `Psygil synthetic test document: ${doc.id}`,
    sections: [{ children: paragraphs }],
  })

  const buf = await Packer.toBuffer(docxDoc)
  writeFileSync(outPath, buf)
  return buf.length
}

// ---------------------------------------------------------------------------
// RTF, minimal, well-formed RTF with embedded line breaks
// ---------------------------------------------------------------------------

function escapeRtf(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\par\n')
}

function buildRtf(doc: TestDocument): string {
  const header = '{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat{\\fonttbl{\\f0\\fnil\\fcharset0 Helvetica;}}'
  const meta = `{\\info{\\title ${escapeRtf(doc.title)}}{\\author ${escapeRtf(doc.author)}}}`
  const body =
    '\\viewkind4\\uc1\\pard\\sa160\\sl252\\slmult1\\f0\\fs22 ' +
    escapeRtf(doc.body) +
    '\\par\n}'
  return `${header}${meta}${body}`
}

// ---------------------------------------------------------------------------
// Writers by format
// ---------------------------------------------------------------------------

async function writeTestDoc(doc: TestDocument, outDir: string): Promise<GenerateTestDocResult> {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  switch (doc.format) {
    case 'pdf': {
      const outPath = join(outDir, `${doc.id}.pdf`)
      const buf = buildMinimalPdf({
        title: doc.title,
        author: doc.author,
        body: `${doc.title}\n\n${doc.body}`,
      })
      writeFileSync(outPath, buf)
      return { id: doc.id, path: outPath, format: 'pdf', bytes: buf.length }
    }
    case 'docx': {
      const outPath = join(outDir, `${doc.id}.docx`)
      const bytes = await writeDocx(doc, outPath)
      return { id: doc.id, path: outPath, format: 'docx', bytes }
    }
    case 'txt': {
      const outPath = join(outDir, `${doc.id}.txt`)
      const content = `${doc.title}\n\n${doc.body}\n`
      writeFileSync(outPath, content, 'utf-8')
      return {
        id: doc.id,
        path: outPath,
        format: 'txt',
        bytes: Buffer.byteLength(content, 'utf-8'),
      }
    }
    case 'rtf': {
      const outPath = join(outDir, `${doc.id}.rtf`)
      const content = buildRtf(doc)
      writeFileSync(outPath, content, 'utf-8')
      return {
        id: doc.id,
        path: outPath,
        format: 'rtf',
        bytes: Buffer.byteLength(content, 'utf-8'),
      }
    }
    case 'md': {
      const outPath = join(outDir, `${doc.id}.md`)
      const content = `${doc.body}\n`
      writeFileSync(outPath, content, 'utf-8')
      return {
        id: doc.id,
        path: outPath,
        format: 'md',
        bytes: Buffer.byteLength(content, 'utf-8'),
      }
    }
    case 'csv': {
      const outPath = join(outDir, `${doc.id}.csv`)
      const content = `${doc.body}\n`
      writeFileSync(outPath, content, 'utf-8')
      return {
        id: doc.id,
        path: outPath,
        format: 'csv',
        bytes: Buffer.byteLength(content, 'utf-8'),
      }
    }
    default: {
      const exhaustive: never = doc.format
      throw new Error(`Unhandled test doc format: ${String(exhaustive)}`)
    }
  }
}

/**
 * Generate all registered test documents into outDir. Returns metadata
 * for each file written.
 */
export async function generateAllTestDocuments(
  outDir: string,
): Promise<readonly GenerateTestDocResult[]> {
  const results: GenerateTestDocResult[] = []
  for (const doc of TEST_DOCUMENTS) {
    results.push(await writeTestDoc(doc, outDir))
  }
  return results
}
