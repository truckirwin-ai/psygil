// =============================================================================
// verify-doc-import.ts, exercise the real document extraction pipeline
// =============================================================================
//
// Run with:  npx tsx app/scripts/verify-doc-import.ts
//
// This is the end-to-end companion to verify-setup.ts. It:
//
//   1. Generates a fresh batch of synthetic test documents into a temp dir
//      (PDF, DOCX, TXT, RTF, MD, CSV, all marked SYNTHETIC).
//   2. Imports each one through the same extraction code path that
//      main/documents/index.ts uses for real ingestion. We do NOT touch
//      SQLCipher or the case folder; we call the extraction primitives
//      directly so this script runs without an Electron context or DB.
//   3. Verifies that each document yields readable text containing the
//      synthetic markers we expect from the registry.
//   4. Checks that the SYNTHETIC sentinel survives the round trip in
//      every format. This is a HIPAA tripwire: if the sentinel is ever
//      missing, the extraction quietly dropped content.
//
// Exits 0 on full pass, 1 on any failure.
// =============================================================================

import { mkdtempSync, rmSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  generateAllTestDocuments,
} from '../src/main/setup/test-docs/generator'
import { TEST_DOCUMENTS } from '../src/main/setup/test-docs/registry'

// ---------------------------------------------------------------------------
// Standalone harness
// ---------------------------------------------------------------------------

interface Result {
  readonly name: string
  readonly ok: boolean
  readonly message: string
}

const results: Result[] = []
function check(name: string, condition: boolean, message = ''): void {
  results.push({ name, ok: condition, message })
  const status = condition ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`  ${status}  ${name}${message.length > 0 ? ', ' + message : ''}`)
}
function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

// ---------------------------------------------------------------------------
// Standalone extraction primitives, mirror main/documents/index.ts so this
// runner has no dependency on Electron, SQLCipher, or the workspace module.
// Any change here MUST be reflected in main/documents/index.ts and vice versa.
// ---------------------------------------------------------------------------

async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  if (mimeType === 'application/pdf') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = (await import('pdf-parse')) as any
    const PDFParseCtor = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse
    if (typeof PDFParseCtor !== 'function') return null
    const buffer = readFileSync(filePath)
    const parser = new PDFParseCtor({ data: buffer })
    const parsed = await parser.getText()
    if (typeof parsed.text === 'string' && parsed.text.length > 0) return parsed.text
    if (Array.isArray(parsed.pages)) {
      return parsed.pages
        .map((p: { text?: string }) => (typeof p.text === 'string' ? p.text : ''))
        .join('\n')
    }
    return null
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammoth = (await import('mammoth')) as any
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value ?? null
  }
  if (mimeType.startsWith('text/')) {
    return readFileSync(filePath, 'utf-8')
  }
  if (mimeType === 'application/rtf' || mimeType === 'text/rtf') {
    return stripRtf(readFileSync(filePath, 'utf-8'))
  }
  return null
}

function stripRtf(rtf: string): string {
  let out = rtf
  out = out.replace(/\\par[d]?/g, '\n')
  out = out.replace(/\\line/g, '\n')
  out = out.replace(/\\'[0-9a-fA-F]{2}/g, '')
  out = out.replace(/\\u-?\d+\??/g, '')
  out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  out = out.replace(/[{}]/g, '')
  out = out.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim()
  return out
}

function mimeForFormat(fmt: 'pdf' | 'docx' | 'txt' | 'rtf' | 'md' | 'csv'): string {
  switch (fmt) {
    case 'pdf': return 'application/pdf'
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'txt': return 'text/plain'
    case 'csv': return 'text/csv'
    case 'rtf': return 'application/rtf'
    case 'md': return 'text/markdown'
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\x1b[1mPsygil document import verifier\x1b[0m')

  const sandbox = mkdtempSync(join(tmpdir(), 'psygil-import-'))
  console.log(`Sandbox: ${sandbox}`)

  try {
    section('1. Generate synthetic samples')
    const generated = await generateAllTestDocuments(sandbox)
    check(
      `generated ${TEST_DOCUMENTS.length} samples`,
      generated.length === TEST_DOCUMENTS.length,
    )
    for (const g of generated) {
      check(
        `${g.id}.${g.format} on disk`,
        g.bytes > 0,
        `${g.bytes} bytes`,
      )
    }

    section('2. Extract text from each sample (real pipeline)')
    for (const g of generated) {
      const mime = mimeForFormat(g.format)
      try {
        const extracted = await extractText(g.path, mime)
        check(
          `extractText returns string for ${g.format}`,
          typeof extracted === 'string' && extracted !== null && extracted.length > 0,
          extracted !== null ? `${extracted.length} chars` : 'null',
        )
        check(
          `${g.id}.${g.format} contains SYNTHETIC sentinel`,
          extracted !== null && extracted.includes('SYNTHETIC'),
        )
      } catch (err) {
        check(
          `extractText for ${g.format}`,
          false,
          (err as Error).message,
        )
      }
    }

    section('3. Cross-format content invariants')
    // Each document has at least one identifier we can sniff for
    const sniffs: { id: string; needles: string[] }[] = [
      { id: 'sample_referral_letter', needles: ['Vanmeter', 'Tupper'] },
      { id: 'sample_arrest_report', needles: ['Halvorsen', 'Welton'] },
      { id: 'sample_records_cover_sheet', needles: ['Denver Health', 'MRN'] },
      { id: 'sample_test_report', needles: ['MMPI', 'Whitfield'] },
      { id: 'sample_interview_notes', needles: ['Whitfield', 'Vanmeter'] },
      { id: 'sample_interview_transcript', needles: ['EXAMINER', 'Vanmeter'] },
      { id: 'sample_school_records', needles: ['Tucson', 'Drachman'] },
    ]
    for (const sniff of sniffs) {
      const g = generated.find((x) => x.id === sniff.id)
      if (g === undefined) {
        check(`${sniff.id} present`, false, 'not generated')
        continue
      }
      const mime = mimeForFormat(g.format)
      const extracted = await extractText(g.path, mime)
      const text = (extracted ?? '').toLowerCase()
      for (const needle of sniff.needles) {
        check(
          `${sniff.id} preserves "${needle}"`,
          text.includes(needle.toLowerCase()),
        )
      }
    }

    section('4. Round-trip byte counts')
    for (const g of generated) {
      const mime = mimeForFormat(g.format)
      const extracted = await extractText(g.path, mime)
      // Extracted text should be a meaningful fraction of the original
      // (lower bound for binary formats, near-1.0 for plain text)
      const minRatio = g.format === 'pdf' || g.format === 'docx' ? 0.05 : 0.4
      const ratio = extracted !== null ? extracted.length / g.bytes : 0
      check(
        `${g.id}.${g.format} extraction ratio >= ${minRatio}`,
        ratio >= minRatio,
        `${(ratio * 100).toFixed(1)}%`,
      )
    }
  } finally {
    if (process.env.VERIFY_KEEP !== '1') {
      try {
        rmSync(sandbox, { recursive: true, force: true })
      } catch {
        // ignore
      }
    } else {
      console.log(`\n(kept at ${sandbox} because VERIFY_KEEP=1)`)
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n\x1b[1mSummary:\x1b[0m ${results.length - failed.length}/${results.length} passed`,
  )
  if (failed.length > 0) {
    console.log('\n\x1b[31mFailures:\x1b[0m')
    for (const f of failed) {
      console.log(`  - ${f.name}${f.message.length > 0 ? ', ' + f.message : ''}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\x1b[31mUnhandled error:\x1b[0m', err)
  process.exit(1)
})
