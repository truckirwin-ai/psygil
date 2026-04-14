# Psygil API Index

Last Updated: 2026-04-14 08:41 UTC

## pdfExporter.ts
Provides the `exportToPdf` function, which serves as an API for exporting Psygil reports to PDF. This function takes `PdfExportParams` (containing `webContentsId`, `caseNumber`, `examineeName`) and returns a `Promise<PdfExportResult>`, indicating success, file path, or error.

## wordExporter.ts
Exposes the `exportToWord` function as an API for generating `.docx` reports. It accepts `WordExportParams` (including `reportContent`, `caseNumber`, `examineeName`, `evaluationType`, `clinicianName`, and `branding` details) and returns a `Promise<WordExportResult>`, detailing the outcome of the export operation.