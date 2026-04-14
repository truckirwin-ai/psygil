// =============================================================================
// Minimal PDF Writer, zero dependencies, produces valid single-document PDFs
// =============================================================================
//
// Used exclusively for generating test import documents. Handles multi-line
// text, basic Helvetica font, US Letter pages. The output is read successfully
// by pdf-parse, which is the extraction library used by the real import
// pipeline.
//
// Not a full-featured PDF library. Handles the common case:
//   - Portrait US Letter pages (612 x 792 pt)
//   - Helvetica 12pt text with word wrap at ~85 chars
//   - Simple line breaks, no formatting
//   - Multiple pages when text overflows
//
// The PDF spec requires that xref entries point at byte offsets, so we build
// the body first, record offsets as we go, then write the xref and trailer.
// =============================================================================

export interface MinimalPdfOptions {
  readonly title: string
  readonly author: string
  readonly body: string
}

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 72
const MARGIN_TOP = 72
const FONT_SIZE = 12
const LINE_HEIGHT = 14
const CHARS_PER_LINE = 85
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT - MARGIN_TOP - MARGIN_TOP) / LINE_HEIGHT)

// ---------------------------------------------------------------------------
// Text preparation
// ---------------------------------------------------------------------------

function escapePdfString(s: string): string {
  // Escape parens and backslashes per PDF spec section 7.3.4.2
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line]
  const words = line.split(' ')
  const out: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length === 0) {
      current = word
      continue
    }
    if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`
    } else {
      out.push(current)
      current = word
    }
  }
  if (current.length > 0) out.push(current)
  return out
}

function paginate(body: string): string[][] {
  const rawLines = body.split('\n')
  const wrapped: string[] = []
  for (const line of rawLines) {
    if (line.length === 0) {
      wrapped.push('')
      continue
    }
    wrapped.push(...wrapLine(line, CHARS_PER_LINE))
  }
  const pages: string[][] = []
  for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
    pages.push(wrapped.slice(i, i + LINES_PER_PAGE))
  }
  if (pages.length === 0) pages.push([''])
  return pages
}

// ---------------------------------------------------------------------------
// Content stream construction
// ---------------------------------------------------------------------------

function buildContentStream(lines: readonly string[]): Buffer {
  const parts: string[] = []
  parts.push('BT')
  parts.push(`/F1 ${FONT_SIZE} Tf`)
  parts.push(`${LINE_HEIGHT} TL`)
  parts.push(`${MARGIN_X} ${PAGE_HEIGHT - MARGIN_TOP} Td`)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    parts.push(`(${escapePdfString(line)}) Tj`)
    if (i < lines.length - 1) parts.push('T*')
  }
  parts.push('ET')
  return Buffer.from(parts.join('\n'), 'latin1')
}

// ---------------------------------------------------------------------------
// Build PDF
// ---------------------------------------------------------------------------

/**
 * Build a minimal multi-page PDF. Returns a Buffer ready to write to disk.
 * The result opens cleanly in Preview, Acrobat, Chrome, and pdf-parse.
 */
export function buildMinimalPdf(options: MinimalPdfOptions): Buffer {
  const pages = paginate(options.body)
  const pageCount = pages.length

  // Object numbering:
  //   1  Catalog
  //   2  Pages
  //   3  Font
  //   4..4+pageCount-1  Page objects
  //   4+pageCount..4+2*pageCount-1  Content streams
  const firstPageObj = 4
  const firstContentObj = firstPageObj + pageCount
  const totalObjects = 3 + pageCount * 2

  const pageObjNums: number[] = []
  for (let i = 0; i < pageCount; i++) pageObjNums.push(firstPageObj + i)

  // ---- Build body with offset tracking ----
  const chunks: Buffer[] = []
  const offsets: number[] = [0] // obj 0 placeholder
  let cursor = 0

  function emit(str: string): void {
    const b = Buffer.from(str, 'latin1')
    chunks.push(b)
    cursor += b.length
  }
  function emitBuffer(b: Buffer): void {
    chunks.push(b)
    cursor += b.length
  }
  function startObject(num: number): void {
    offsets[num] = cursor
    emit(`${num} 0 obj\n`)
  }
  function endObject(): void {
    emit('\nendobj\n')
  }

  emit('%PDF-1.4\n')
  // Binary marker required by some PDF readers
  emit('%\u00e2\u00e3\u00cf\u00d3\n')

  // 1: Catalog
  startObject(1)
  emit('<< /Type /Catalog /Pages 2 0 R >>')
  endObject()

  // 2: Pages
  startObject(2)
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(' ')
  emit(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`)
  endObject()

  // 3: Font
  startObject(3)
  emit('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  endObject()

  // 4..: Page objects
  for (let i = 0; i < pageCount; i++) {
    const pageNum = firstPageObj + i
    const contentNum = firstContentObj + i
    startObject(pageNum)
    emit(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    )
    endObject()
  }

  // Content streams
  for (let i = 0; i < pageCount; i++) {
    const contentNum = firstContentObj + i
    const stream = buildContentStream(pages[i]!)
    startObject(contentNum)
    emit(`<< /Length ${stream.length} >>\nstream\n`)
    emitBuffer(stream)
    emit('\nendstream')
    endObject()
  }

  // ---- xref table ----
  const xrefOffset = cursor
  emit(`xref\n0 ${totalObjects + 1}\n`)
  emit('0000000000 65535 f \n')
  for (let i = 1; i <= totalObjects; i++) {
    const off = offsets[i] ?? 0
    emit(`${off.toString().padStart(10, '0')} 00000 n \n`)
  }

  // ---- trailer ----
  const info = {
    Title: escapePdfString(options.title),
    Author: escapePdfString(options.author),
    Producer: 'Psygil Test Document Generator',
    CreationDate: formatPdfDate(new Date()),
  }
  emit(
    `trailer << /Size ${totalObjects + 1} /Root 1 0 R ` +
      `/Info << /Title (${info.Title}) /Author (${info.Author}) ` +
      `/Producer (${info.Producer}) /CreationDate (${info.CreationDate}) >> >>\n`,
  )
  emit(`startxref\n${xrefOffset}\n%%EOF\n`)

  return Buffer.concat(chunks)
}

function formatPdfDate(d: Date): string {
  // PDF dates are formatted as D:YYYYMMDDHHmmSSZ
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return (
    `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}
