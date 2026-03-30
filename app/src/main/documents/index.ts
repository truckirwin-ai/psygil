/**
 * Document service — file ingestion, text extraction, and metadata storage.
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
      // pdf-parse expects a Buffer
      const pdfModule = await import('pdf-parse')
      const pdfParse = (pdfModule as any).default ?? pdfModule
      const buffer = readFileSync(filePath)
      const result = await pdfParse(buffer)
      return result.text || null
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value || null
    }

    // Plain text files — read directly
    if (mimeType.startsWith('text/')) {
      return readFileSync(filePath, 'utf-8')
    }

    return null
  } catch (err) {
    console.error(`[documents] Text extraction failed for ${filePath}:`, err)
    return null
  }
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
  uploadedByUserId: number = 1,
): Promise<DocumentRow> {
  const caseRow = getCaseById(caseId)
  if (caseRow === null) {
    throw new Error(`Case ${caseId} not found`)
  }
  if (caseRow.folder_path === null) {
    throw new Error(`Case ${caseId} has no workspace folder`)
  }

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

  // Copy file into workspace (don't move — leave original intact)
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
    uploaded_by_user_id: uploadedByUserId,
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
 * (per doc 26 — Psygil never moves or deletes files in the workspace folder).
 */
export function deleteDocument(docId: number): void {
  const sqlite = getSqlite()
  const existing = getDocument(docId)
  if (existing === null) {
    throw new Error(`Document ${docId} not found`)
  }
  sqlite.prepare('DELETE FROM documents WHERE document_id = ?').run(docId)
}
