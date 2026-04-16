/**
 * Document service, file ingestion, text extraction, and metadata storage.
 * Source of truth: docs/engineering/26_Workspace_Folder_Architecture.md
 *
 * STORAGE RULE (doc 26, LOCKED):
 *   Files stay on disk in the workspace folder.
 *   DB stores metadata + extracted text (indexed_content) only.
 *   Psygil never moves or encrypts files in the workspace folder.
 */

import { readFileSync, statSync, existsSync, unlinkSync, copyFileSync, mkdirSync } from 'fs'
import { basename, extname, join } from 'path'
import { getSqlite } from '../db/connection'
import { getCaseById } from '../cases'
import { logAuditEntry } from '../audit'
import { getCurrentClinicianUserId } from '../auth/session'
import type { DocumentRow } from '../../shared/types'

// ---------------------------------------------------------------------------
// Valid subfolders per doc 26 workspace architecture
// ---------------------------------------------------------------------------

const VALID_SUBFOLDERS = [
  '_Inbox',
  'Collateral',
  'Testing',
  'Interviews',
  'Diagnostics',
  'Reports',
  'Archive',
] as const

type CaseSubfolder = (typeof VALID_SUBFOLDERS)[number]

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

async function extractText(filePath: string, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === 'application/pdf') {
      // pdf-parse v2 exposes a PDFParse class. The old callable default
      // export is gone, so dynamic-import the named export and instantiate.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = (await import('pdf-parse')) as any
      const PDFParseCtor = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse
      if (typeof PDFParseCtor !== 'function') {
        console.error('[documents] pdf-parse PDFParse class not available')
        return null
      }
      const buffer = readFileSync(filePath)
      const parser = new PDFParseCtor({ data: buffer })
      const parsed = await parser.getText()
      if (typeof parsed.text === 'string' && parsed.text.length > 0) {
        return parsed.text
      }
      // Some builds return { pages: [{ text }] } instead of a flat text field
      if (Array.isArray(parsed.pages)) {
        const combined = parsed.pages
          .map((p: { text?: string }) => (typeof p.text === 'string' ? p.text : ''))
          .join('\n')
        return combined.length > 0 ? combined : null
      }
      return null
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value || null
    }

    // Plain text, markdown, csv, read directly
    if (mimeType.startsWith('text/')) {
      return readFileSync(filePath, 'utf-8')
    }

    // Rich Text Format, strip control groups to get readable text.
    // Good enough for indexing and PII scanning; not a full RTF renderer.
    if (mimeType === 'application/rtf' || mimeType === 'text/rtf') {
      const raw = readFileSync(filePath, 'utf-8')
      return stripRtf(raw)
    }

    return null
  } catch (err) {
    console.error(`[documents] Text extraction failed for ${filePath}:`, err)
    return null
  }
}

/**
 * Minimal RTF → plain text converter. Removes control words, groups, and
 * escape sequences so the result is readable and scannable by the PII
 * pipeline. Does not attempt to preserve formatting.
 */
function stripRtf(rtf: string): string {
  let out = rtf
  // Replace \par and \line with newlines
  out = out.replace(/\\par[d]?/g, '\n')
  out = out.replace(/\\line/g, '\n')
  // Hex escapes like \'e9
  out = out.replace(/\\'[0-9a-fA-F]{2}/g, '')
  // Unicode escapes like \u233?
  out = out.replace(/\\u-?\d+\??/g, '')
  // Control words (\word or \word123) possibly followed by a space
  out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  // Braces
  out = out.replace(/[{}]/g, '')
  // Collapse runs of whitespace but preserve newlines
  out = out.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim()
  return out
}

// ---------------------------------------------------------------------------
// MIME type from extension
// ---------------------------------------------------------------------------

function mimeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.rtf': 'application/rtf',
    '.md': 'text/markdown',
    '.markdown': 'text/markdown',
    '.vtt': 'text/vtt',
    '.json': 'application/json',
  }
  return map[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Document type from extension (maps to DB CHECK constraint)
// ---------------------------------------------------------------------------

function docTypeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.pdf': 'pdf',
    '.docx': 'docx',
    '.doc': 'docx',
    '.vtt': 'transcript_vtt',
    '.mp3': 'audio',
    '.wav': 'audio',
    '.m4a': 'audio',
  }
  return map[ext] ?? 'other'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ingest a file: copy it into the case's workspace subfolder,
 * extract text (PDF/DOCX), and store metadata + extracted text in DB.
 */
export async function ingestFile(
  caseId: number,
  filePath: string,
  subfolder: CaseSubfolder,
  uploadedByUserId?: number,
): Promise<DocumentRow> {
  const caseRow = getCaseById(caseId)
  if (caseRow === null) {
    throw new Error(`Case ${caseId} not found`)
  }
  if (caseRow.folder_path === null) {
    throw new Error(`Case ${caseId} has no workspace folder`)
  }

  // Resolve the clinician to stamp on this upload. Uses the Auth0 session
  // when present, otherwise falls back to the first active user, and
  // bootstraps a default row only on an empty database.
  const userId = uploadedByUserId ?? getCurrentClinicianUserId()

  if (!VALID_SUBFOLDERS.includes(subfolder)) {
    throw new Error(`Invalid subfolder: ${subfolder}. Must be one of: ${VALID_SUBFOLDERS.join(', ')}`)
  }

  if (!existsSync(filePath)) {
    throw new Error(`Source file does not exist: ${filePath}`)
  }

  const fileName = basename(filePath)
  const destDir = join(caseRow.folder_path, subfolder)
  const destPath = join(destDir, fileName)

  // Ensure destination subfolder exists
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }

  // Copy file into workspace (don't move, leave original intact)
  copyFileSync(filePath, destPath)

  const stat = statSync(destPath)
  const mime = mimeFromExt(filePath)
  const docType = docTypeFromExt(filePath)

  // Extract text content
  const extractedText = await extractText(destPath, mime)

  // Insert metadata into DB
  const sqlite = getSqlite()
  const stmt = sqlite.prepare(`
    INSERT INTO documents (
      case_id, document_type, original_filename, file_path,
      file_size_bytes, mime_type, uploaded_by_user_id,
      description, indexed_content
    ) VALUES (
      @case_id, @document_type, @original_filename, @file_path,
      @file_size_bytes, @mime_type, @uploaded_by_user_id,
      @description, @indexed_content
    )
  `)

  const result = stmt.run({
    case_id: caseId,
    document_type: docType,
    original_filename: fileName,
    file_path: destPath,
    file_size_bytes: stat.size,
    mime_type: mime,
    uploaded_by_user_id: userId,
    description: null,
    indexed_content: extractedText,
  })

  const docId = Number(result.lastInsertRowid)

  // Audit: document_uploaded. Capture file metadata only, not the indexed
  // content (which can contain PHI before the UNID pipeline runs).
  try {
    logAuditEntry({
      caseId,
      actionType: 'document_uploaded',
      actorType: 'clinician',
      actorId: String(userId),
      details: {
        filename: fileName,
        subfolder,
        mime_type: mime,
        file_size_bytes: stat.size,
        document_type: docType,
      },
      relatedEntityType: 'document',
      relatedEntityId: docId,
    })
  } catch (e) {
    process.stderr.write(`[documents] audit log failed for document_uploaded: ${(e as Error).message}\n`)
  }

  return getDocument(docId)!
}

/**
 * Register an existing file already present in the workspace as a
 * document for the given case. Unlike `ingestFile`, this does NOT copy
 * the file, it expects the file to already live at `filePath`. Used
 * by the auto-generated case docs (Patient_Intake.docx, Referral_Information.docx,
 * etc.) so the Ingestor agent can find them via `listDocuments`.
 *
 * Idempotent: if a row for (case_id, file_path) already exists, the
 * metadata and indexed_content are refreshed in place rather than
 * producing a duplicate row.
 */
export async function registerExistingDocument(
  caseId: number,
  filePath: string,
  uploadedByUserId?: number,
): Promise<DocumentRow> {
  if (!existsSync(filePath)) {
    throw new Error(`registerExistingDocument: file does not exist: ${filePath}`)
  }

  const fileName = basename(filePath)
  const stat = statSync(filePath)
  const mime = mimeFromExt(filePath)
  const docType = docTypeFromExt(filePath)
  const extractedText = await extractText(filePath, mime)
  const userId = uploadedByUserId ?? getCurrentClinicianUserId()

  const sqlite = getSqlite()

  // Check for an existing row for (case_id, file_path), avoid duplicates
  // when an auto-generated doc is regenerated on every save.
  const existing = sqlite
    .prepare('SELECT document_id FROM documents WHERE case_id = ? AND file_path = ? LIMIT 1')
    .get(caseId, filePath) as { document_id: number } | undefined

  if (existing) {
    sqlite
      .prepare(
        `UPDATE documents SET
           document_type = @document_type,
           original_filename = @original_filename,
           file_size_bytes = @file_size_bytes,
           mime_type = @mime_type,
           indexed_content = @indexed_content
         WHERE document_id = @document_id`,
      )
      .run({
        document_id: existing.document_id,
        document_type: docType,
        original_filename: fileName,
        file_size_bytes: stat.size,
        mime_type: mime,
        indexed_content: extractedText,
      })
    return getDocument(existing.document_id)!
  }

  const result = sqlite
    .prepare(
      `INSERT INTO documents (
         case_id, document_type, original_filename, file_path,
         file_size_bytes, mime_type, uploaded_by_user_id,
         description, indexed_content
       ) VALUES (
         @case_id, @document_type, @original_filename, @file_path,
         @file_size_bytes, @mime_type, @uploaded_by_user_id,
         @description, @indexed_content
       )`,
    )
    .run({
      case_id: caseId,
      document_type: docType,
      original_filename: fileName,
      file_path: filePath,
      file_size_bytes: stat.size,
      mime_type: mime,
      uploaded_by_user_id: userId,
      description: null,
      indexed_content: extractedText,
    })

  const docId = Number(result.lastInsertRowid)
  return getDocument(docId)!
}

/**
 * Get a single document by ID.
 */
export function getDocument(docId: number): DocumentRow | null {
  const sqlite = getSqlite()
  const row = sqlite
    .prepare('SELECT * FROM documents WHERE document_id = ?')
    .get(docId) as DocumentRow | undefined
  return row ?? null
}

/**
 * List all documents for a case, ordered by upload date descending.
 */
export function listDocuments(caseId: number): readonly DocumentRow[] {
  const sqlite = getSqlite()
  const rows = sqlite
    .prepare('SELECT * FROM documents WHERE case_id = ? ORDER BY upload_date DESC')
    .all(caseId) as DocumentRow[]
  return rows
}

/**
 * Delete a document: remove DB record. File on disk is left intact
 * (per doc 26, Psygil never moves or deletes files in the workspace folder).
 */
export function deleteDocument(docId: number): void {
  const sqlite = getSqlite()
  const existing = getDocument(docId)
  if (existing === null) {
    throw new Error(`Document ${docId} not found`)
  }
  sqlite.prepare('DELETE FROM documents WHERE document_id = ?').run(docId)
}
