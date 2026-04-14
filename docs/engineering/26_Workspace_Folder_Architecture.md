# Workspace Folder Architecture
**Decision Date:** 2026-03-26
**Decided by:** Truck Irwin
**Status:** LOCKED — supersedes any prior spec language implying files are hidden or DB-only

---

## Core Principle

**The directory tree in Column 1 maps 1:1 to a real folder on the user's hard drive.**

The user chooses (or creates) a workspace root folder on first launch. That folder is the source of truth for all case files. Psygil is a viewer and organizer for that folder — not a black box that hides files.

Outside of Psygil, the user can open Finder, navigate to their cases folder, and open any file directly. Nothing is hidden.

---

## First Launch Behavior

On first launch, Psygil displays a setup dialog:

```
Welcome to Psygil.
Choose a folder to store your case files.
This folder will contain all your cases, documents, and reports.

[ Choose Existing Folder ]  [ Create New Folder ]  [ Use Default ]

Default: ~/Documents/Psygil Cases/
```

The selected path is stored in the app's config (Electron `app.getPath('userData')/config.json`).

On subsequent launches, Psygil opens directly to this folder. The user can change it in Settings → Storage → Workspace Folder.

---

## Folder Structure

Psygil creates and maintains the following structure inside the workspace root:

```
{workspace_root}/                          ← User-chosen location (any drive, GDrive, NAS, etc.)
  {case_number} {last}, {first}/           ← e.g., "2026-0147 Johnson, Marcus"
    _Inbox/                                ← Drop zone — drag files here to ingest
    Collateral/                            ← Court orders, hospital records, police reports
    Testing/                               ← Score reports from Q-global, PARiConnect, etc.
    Interviews/                            ← Session notes, audio transcripts
    Diagnostics/                           ← Diagnostic formulation exports (read-only)
    Reports/                               ← Draft and final evaluation reports (.docx)
    Archive/                               ← Completed/closed case materials
  _Templates/                              ← Practice report templates
  _Reference/                              ← DSM-5-TR, statutes, reference materials
  _Shared/                                 ← Cross-provider shared documents (multi-user setups)
```

---

## Column 1 Tree = Folder Mirror

The case explorer tree in Column 1 is a **live view of the workspace folder structure.**

- Adding a file in Finder → appears in Psygil tree on next refresh (or via file watcher)
- Deleting a file in Finder → disappears from Psygil tree
- Renaming a folder in Finder → reflected in Psygil tree
- Dragging a file into the Psygil tree → writes it to the correct subfolder on disk

The tree adds metadata (pipeline stage badges, status colors, AI agent status) as an overlay — but the underlying structure is always the real filesystem.

---

## What the SQLCipher DB Stores

The DB stores **metadata and clinical decisions only** — never the files themselves:

| Stored in DB | Stored as Files |
|-------------|----------------|
| Case status, pipeline stage | PDFs (score reports, records) |
| Deadlines, referral metadata | DOCXs (reports, notes) |
| Diagnostic decisions + reasoning | Audio recordings |
| Audit trail (every clinical action) | Uploaded collateral |
| Form data (intake, onboarding) | Exported reports |
| AI agent outputs | Any file the user places in the folder |
| User roles and permissions | |

DB = brain. Folder = filing cabinet. Both are the user's.

---

## GDrive / Shared Storage

If the user points their workspace root at a GDrive-synced folder (e.g., `~/Google Drive/My Drive/Psygil Cases/`):

- All case files sync automatically via GDrive's native sync — no special Psygil integration needed
- Staff can drop files into case subfolders from the GDrive web interface or any device
- Psygil's file watcher detects new/changed files and prompts ingestion
- Access control is managed at the GDrive level (per-folder sharing permissions)

This is the recommended multi-user setup. No custom cloud integration required for file storage.

---

## File Watcher

Psygil runs a background file watcher (`chokidar` or native FSEvents on macOS) on the workspace root.

On file change events:
- New file in `_Inbox/` → notify user, prompt to assign to a case
- New file in a case subfolder → add to case tree, offer ingestion (text extraction)
- File deleted → mark as removed in tree, preserve DB metadata with `deleted_at` timestamp
- File modified → update DB metadata, flag for re-ingestion if needed

---

## Ingestion vs. Raw Access

**Ingestion** (optional): Psygil can extract text from PDFs/DOCXs, run it through the UNID redaction pipeline, and make it available for AI analysis. This is a value-add layer on top of the raw file.

**Raw access** (always available): The original file is always accessible directly from the filesystem. Psygil never modifies, moves, or encrypts the original files in the workspace folder. What you put in is what you get out.

---

## Implementation Notes

- `app/src/main/workspace/` — workspace config, folder creation, file watcher
- `app/src/renderer/src/components/layout/LeftColumn.tsx` — tree must be rebuilt to read from filesystem, not DB
- `app/src/main/db/schema.ts` — `cases` table gets `folder_path` column pointing to case subfolder
- Sprint 2 setup wizard (Task 2.x) — first-launch folder picker dialog

---

## Non-Negotiables

1. **The workspace folder is always a real folder the user can open in Finder.**
2. **Psygil never moves or encrypts files in the workspace folder.**
3. **The Column 1 tree always reflects the actual filesystem state.**
4. **The user can work with files outside of Psygil at any time.**
5. **First launch always prompts for workspace folder selection.**
