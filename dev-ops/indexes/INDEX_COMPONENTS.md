# Psygil Components Index

Last Updated: 2026-04-14 08:41 UTC

## brandingManager.ts
Handles storage and retrieval of practice branding (name, logo, colors, tagline) for white-label support. Uses a JSON file for branding data and a dedicated directory for logo files within the app's user data path. Provides interfaces for `PracticeBranding` and functions to `getDefaultBranding`, `getBranding`, `saveBranding`, and `saveLogo`.

## pdfExporter.ts
Manages the export of Psygil reports to PDF format. Utilizes Electron's `webContents.printToPDF` to render OnlyOffice documents into PDFs. It includes functionality to prompt the user for a save location and provides `PdfExportParams` and `PdfExportResult` interfaces for handling export parameters and results.

## wordExporter.ts
Manages the export of Psygil reports to `.docx` format using the `docx` npm package. Features include prompting for a save path, incorporating branding elements (practice name, logo, tagline, primary color), stripping HTML to parse content into styled paragraphs, and generating a structured title page with report details and metadata. It constructs headers and footers, then assembles and writes the document to a `.docx` file.