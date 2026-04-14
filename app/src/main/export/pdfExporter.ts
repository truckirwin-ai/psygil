/**
 * PDF export for Psygil reports.
 * Uses Electron's webContents.printToPDF to render the OnlyOffice document as PDF.
 */

import { dialog, webContents, BrowserWindow } from 'electron'
import * as fs from 'fs'

export interface PdfExportParams {
  webContentsId: number    // the OnlyOffice webContents ID
  caseNumber: string
  examineeName: string
}

export interface PdfExportResult {
  success: boolean
  filePath?: string
  error?: string
}

/**
 * Export the OnlyOffice webContents as a PDF file.
 */
export async function exportToPdf(params: PdfExportParams): Promise<PdfExportResult> {
  const { webContentsId, caseNumber, examineeName } = params

  // ── 1. Prompt for save path ─────────────────────────────────────────────
  const win = BrowserWindow.getFocusedWindow()
  const dialogResult = await dialog.showSaveDialog(win ?? undefined!, {
    title: 'Export Report as PDF',
    defaultPath: `${examineeName.replace(/\s+/g, '_')}_${caseNumber}_report.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  })

  if (dialogResult.canceled || !dialogResult.filePath) {
    return { success: false, error: 'Save cancelled by user' }
  }

  const filePath = dialogResult.filePath

  try {
    // ── 2. Find the webContents by ID ─────────────────────────────────────
    const wc = webContents.fromId(webContentsId)
    if (!wc) {
      return { success: false, error: `WebContents with ID ${webContentsId} not found` }
    }

    // ── 3. Print to PDF ───────────────────────────────────────────────────
    const pdfBuffer = await wc.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: {
        marginType: 'custom',
        top: 0.75,
        bottom: 0.75,
        left: 1.0,
        right: 1.0,
      },
    })

    // ── 4. Write to disk ──────────────────────────────────────────────────
    fs.writeFileSync(filePath, pdfBuffer)

    return { success: true, filePath }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'PDF export failed'
    console.error('[pdfExporter] error:', message)
    return { success: false, error: message }
  }
}
