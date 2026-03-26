# Psygil IPC API Contract Addendum: Storage Provider

**Document Version:** 1.0
**Last Updated:** March 2026
**Parent Document:** `02_ipc_api_contracts.md`
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Boundary 5: Electron Main ↔ Storage Provider](#boundary-5-electron-main--storage-provider)
3. [Architecture & Connection Details](#architecture--connection-details)
4. [Endpoints](#endpoints)
5. [Error Handling](#error-handling)
6. [File Locking Strategy](#file-locking-strategy)
7. [Sync Conflict Resolution](#sync-conflict-resolution)

---

## Overview

The Storage Provider is an abstraction layer within the Electron Main process that handles all file I/O operations across three storage modes:

1. **Local Filesystem** — Solo practitioner, all files on local disk
2. **Shared Network Drive** — Small team, files on NAS/SMB share (e.g., Windows network drive)
3. **Cloud** — Multi-location team, files in Microsoft 365 SharePoint or Google Drive

The Storage Provider exposes a unified IPC API regardless of backend. The Renderer, Python Sidecar, and other components call the same IPC channels (e.g., `storage:upload`). The Storage Provider routes each request to the correct backend implementation.

### Key Design Principles

- **Unified Interface:** Same API for all three storage modes. Caller doesn't need to know which backend is active.
- **Local Cache:** All modes maintain a local cache in OPFS (Origin Private File System) for offline access.
- **File Locking:** Advisory locks prevent concurrent edits across all storage modes.
- **Sync Conflict Resolution:** When bidirectional sync detects conflicts, conflicts are tracked in `file_conflicts` table for user review.
- **Cloud Authentication:** OAuth 2.0 tokens stored securely in OS credential store (macOS Keychain, Windows Credential Manager, Linux Secret Service).

---

## Boundary 5: Electron Main ↔ Storage Provider

### Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│              Electron Main Process                      │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Storage Provider Service                │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Local Filesystem Backend                   │ │  │
│  │  │  • Direct file I/O                          │ │  │
│  │  │  • File locks via SQLite                    │ │  │
│  │  │  • OPFS local cache                         │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Shared Drive Backend (SMB/NFS)             │ │  │
│  │  │  • SMB client for Windows shares            │ │  │
│  │  │  • Advisory lock files + SQLite             │ │  │
│  │  │  • OPFS local cache + sync tracker          │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │                                                   │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Cloud Backend (O365 / Google Drive)        │ │  │
│  │  │  • Graph API or Google Drive API            │ │  │
│  │  │  • OAuth 2.0 token management               │ │  │
│  │  │  • Cloud file locks + SQLite                │ │  │
│  │  │  • OPFS local cache + sync tracker          │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │                                                   │  │
│  └──────────────────────────────────────────────────┘  │
│         ↑                                               │
│         │ IPC (ipcMain)                                │
│         │                                               │
└─────────┼───────────────────────────────────────────────┘
          │
          │ Calls:
          │ - storage:configure
          │ - storage:authenticate
          │ - storage:upload
          │ - storage:download
          │ - storage:list
          │ - storage:lock
          │ - storage:unlock
          │ - storage:sync
          │ - storage:open-external
          │ - storage:publish-pdf
          │ - storage:version-history
          ▼
    ┌─────────────┐
    │   Renderer  │  (React UI)
    │ (case mgmt) │
    └─────────────┘
```

---

## Architecture & Connection Details

### Connection Details

- **Protocol:** Electron IPC (`ipcMain.handle()` / `ipcRenderer.invoke()`)
- **Process Location:** Storage Provider runs in Main process
- **Startup:** Initializes on app launch, loads configuration from SQLite
- **Authentication:** OAuth tokens stored in OS credential store
- **Local Cache:** OPFS directory: `Psygil/case-cache/<case_id>/`
- **Lock Timeout:** 30 minutes (configurable)
- **Sync Interval:** Every 5 minutes (configurable, or on-demand)
- **Conflict Resolution:** User review via `file_conflicts` table

### Supporting Database Tables

The Storage Provider uses these SQLite tables (in the main app database):

**`storage_config`** — Current storage mode and connection details
```
id (TEXT PRIMARY KEY)
mode (TEXT: 'local_only', 'shared_drive', 'cloud_o365', 'cloud_gdrive')
local_root_path (TEXT) — for 'local_only' mode
shared_drive_path (TEXT) — for 'shared_drive' mode (e.g., '\\server\share')
cloud_tenant_id (TEXT) — for 'cloud_o365'
cloud_site_id (TEXT) — for 'cloud_o365'
cloud_drive_id (TEXT) — for 'cloud_o365' and 'cloud_gdrive'
cloud_folder_id (TEXT) — for 'cloud_gdrive'
user_email (TEXT)
authenticated_at (TIMESTAMP)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**`file_locks`** — Active file locks across all modes
```
id (TEXT PRIMARY KEY: uuid)
document_id (TEXT FOREIGN KEY → documents.id)
lock_type (TEXT: 'exclusive', 'shared')
locked_by (TEXT: user email or 'system')
acquired_at (TIMESTAMP)
expires_at (TIMESTAMP)
lock_id_cloud (TEXT) — cloud-specific lock ID (Graph, GDrive)
local_lock_file_path (TEXT) — for 'shared_drive' mode
metadata (JSON)
```

**`file_conflicts`** — Sync conflicts requiring user review
```
id (TEXT PRIMARY KEY: uuid)
case_id (TEXT FOREIGN KEY → cases.id)
document_id (TEXT FOREIGN KEY → documents.id)
conflict_type (TEXT: 'version_mismatch', 'concurrent_edit', 'deleted_locally_modified_cloud')
local_version_id (TEXT)
cloud_version_id (TEXT)
local_modified_at (TIMESTAMP)
cloud_modified_at (TIMESTAMP)
local_modified_by (TEXT)
cloud_modified_by (TEXT)
resolution_strategy (TEXT: 'keep_local', 'keep_cloud', 'merge', 'pending')
resolved_at (TIMESTAMP)
resolved_by (TEXT)
notes (TEXT)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**`file_sync_state`** — Sync metadata for each document
```
id (TEXT PRIMARY KEY: uuid)
document_id (TEXT FOREIGN KEY → documents.id)
local_path (TEXT)
remote_path (TEXT)
local_version_id (TEXT)
remote_version_id (TEXT)
last_sync_at (TIMESTAMP)
last_sync_direction (TEXT: 'push', 'pull', 'conflict')
etag (TEXT) — cloud file version identifier
local_checksum (TEXT)
remote_checksum (TEXT)
sync_status (TEXT: 'synced', 'pending_push', 'pending_pull', 'conflict')
```

---

## Endpoints

### 1. storage:configure

**Description:** Set storage mode and connection details. Validates connectivity before returning success.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "mode": "local_only",
  "config": {
    "local_root_path": "/Users/truck/Documents/Psygil-Cases"
  }
}
```

**For `local_only` mode:**
```json
{
  "mode": "local_only",
  "config": {
    "local_root_path": "/path/to/cases"
  }
}
```

**For `shared_drive` mode:**
```json
{
  "mode": "shared_drive",
  "config": {
    "shared_drive_path": "\\\\nas-server\\Psygil-cases",
    "username": "team_user",
    "password": "encrypted_via_credential_store"
  }
}
```

**For `cloud_o365` mode:**
```json
{
  "mode": "cloud_o365",
  "config": {
    "tenant_id": "12345678-1234-1234-1234-123456789012",
    "site_id": "contoso.sharepoint.com:/sites/Psygil",
    "drive_id": "b!7N0y90..."
  }
}
```

**For `cloud_gdrive` mode:**
```json
{
  "mode": "cloud_gdrive",
  "config": {
    "folder_id": "0AExampleFolderId"
  }
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "mode": "local_only",
  "connection_test": {
    "status": "ok",
    "message": "Local root path is accessible",
    "root_path": "/Users/truck/Documents/Psygil-Cases",
    "available_space_bytes": 1099511627776,
    "test_completed_at": "2026-03-20T14:32:15.000Z"
  },
  "cache_location": "opfs://Psygil/case-cache/",
  "config_saved_at": "2026-03-20T14:32:16.000Z"
}
```

#### Response Schema (Failure)

```json
{
  "success": false,
  "error": {
    "code": "STORAGE_CONFIGURE_FAILED",
    "message": "Shared drive is not accessible",
    "details": {
      "attempted_path": "\\\\nas-server\\Psygil-cases",
      "system_error": "ECONNREFUSED: Cannot reach NAS server",
      "suggestion": "Check network connectivity and credentials"
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `STORAGE_CONFIGURE_FAILED` | Root path not accessible, network unreachable, credentials invalid |
| `INVALID_MODE` | Mode not one of allowed values |
| `MISSING_CONFIG` | Required config fields missing for the selected mode |
| `INVALID_PATH` | Path format is malformed |

---

### 2. storage:authenticate

**Description:** Initiate OAuth 2.0 flow for cloud storage modes. Opens browser, user logs in, token stored securely.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "provider": "o365"
}
```

Or:

```json
{
  "provider": "gdrive"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "provider": "o365",
  "authenticated_user": {
    "email": "truck@contoso.onmicrosoft.com",
    "display_name": "Truck Irwin",
    "user_principal_name": "truck@contoso.onmicrosoft.com"
  },
  "token_info": {
    "token_type": "Bearer",
    "expires_in_seconds": 3600,
    "expires_at": "2026-03-20T15:32:16.000Z",
    "scope": "Files.ReadWrite.All Sites.ReadWrite.All"
  },
  "authenticated_at": "2026-03-20T14:32:16.000Z"
}
```

#### Response Schema (Failure - User Cancelled)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_CANCELLED",
    "message": "User cancelled the OAuth flow",
    "provider": "o365"
  }
}
```

#### Response Schema (Failure - Token Expired/Invalid)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "OAuth token could not be obtained",
    "details": {
      "provider": "o365",
      "reason": "refresh_token_expired",
      "suggestion": "Re-authenticate with storage:authenticate"
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `AUTH_CANCELLED` | User closed browser before completing OAuth |
| `AUTH_FAILED` | OAuth server returned error (invalid client, network error) |
| `INVALID_PROVIDER` | Provider not 'o365' or 'gdrive' |
| `CREDENTIAL_STORE_UNAVAILABLE` | OS credential store not accessible |

---

### 3. storage:upload

**Description:** Upload a document from local OPFS cache to configured storage backend. Returns remote path and version ID.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "case_id": "case_c7f3d8e1",
  "local_file_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment.docx",
  "remote_folder": "reports",
  "metadata": {
    "document_type": "report",
    "created_by": "truck@contoso.onmicrosoft.com",
    "created_at": "2026-03-20T14:00:00.000Z",
    "case_reference": "case_c7f3d8e1"
  }
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "remote_path": "Psygil-cases/case_c7f3d8e1/reports/Report_Initial_Assessment.docx",
  "file_id": "01MZRMM5...",
  "version_id": "v1_VER_2026-03-20T14:32:00Z",
  "file_size_bytes": 245678,
  "storage_mode": "local_only",
  "uploaded_at": "2026-03-20T14:32:16.000Z",
  "integrity": {
    "checksum_local": "sha256:a3f9e2d1...",
    "checksum_remote": "sha256:a3f9e2d1...",
    "verified": true
  }
}
```

#### Response Schema (Failure - File Locked)

```json
{
  "success": false,
  "error": {
    "code": "FILE_LOCKED",
    "message": "Document is currently locked for editing",
    "details": {
      "lock_id": "lock_abc123",
      "locked_by": "alice@contoso.onmicrosoft.com",
      "expires_at": "2026-03-20T15:00:00.000Z",
      "suggestion": "Wait for the lock to expire or ask the user to save and release the lock"
    }
  }
}
```

#### Response Schema (Failure - Storage Unavailable)

```json
{
  "success": false,
  "error": {
    "code": "STORAGE_UNAVAILABLE",
    "message": "Shared drive is not currently accessible",
    "details": {
      "storage_mode": "shared_drive",
      "system_error": "EHOSTUNREACH: Network is unreachable",
      "suggestion": "Check network connectivity. File remains in local cache."
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `FILE_LOCKED` | Another user/process has exclusive lock |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `INSUFFICIENT_SPACE` | Insufficient space on remote storage |
| `FILE_NOT_FOUND` | Local file path does not exist |
| `INVALID_METADATA` | Metadata JSON is malformed |
| `UPLOAD_TIMEOUT` | Upload took >300 seconds |

---

### 4. storage:download

**Description:** Download a document from configured storage to local OPFS cache. Returns local path.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "remote_path": "Psygil-cases/case_c7f3d8e1/reports/Report_Initial_Assessment.docx",
  "destination_path": "opfs://Psygil/case-cache/case_c7f3d8e1/",
  "version_id": "v1_VER_2026-03-20T14:32:00Z"
}
```

Or identify by document ID:

```json
{
  "document_id": "doc_a1b2c3d4",
  "destination_path": "opfs://Psygil/case-cache/case_c7f3d8e1/"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "local_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment.docx",
  "remote_path": "Psygil-cases/case_c7f3d8e1/reports/Report_Initial_Assessment.docx",
  "version_id": "v1_VER_2026-03-20T14:32:00Z",
  "file_size_bytes": 245678,
  "downloaded_at": "2026-03-20T14:32:16.000Z",
  "integrity": {
    "checksum_local": "sha256:a3f9e2d1...",
    "checksum_remote": "sha256:a3f9e2d1...",
    "verified": true
  }
}
```

#### Response Schema (Failure - File Not Found)

```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "Document does not exist on remote storage",
    "details": {
      "remote_path": "Psygil-cases/case_c7f3d8e1/reports/Report_Initial_Assessment.docx",
      "storage_mode": "cloud_o365"
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `FILE_NOT_FOUND` | Remote file does not exist |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `INSUFFICIENT_LOCAL_SPACE` | Not enough OPFS cache space |
| `DOWNLOAD_TIMEOUT` | Download took >300 seconds |
| `INTEGRITY_CHECK_FAILED` | Checksum mismatch after download |

---

### 5. storage:list

**Description:** List all files in a case folder. Includes metadata, locks, and version info.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "case_id": "case_c7f3d8e1",
  "path": "reports"
}
```

Or list root:

```json
{
  "case_id": "case_c7f3d8e1",
  "path": ""
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "case_id": "case_c7f3d8e1",
  "path": "reports",
  "files": [
    {
      "name": "Report_Initial_Assessment.docx",
      "file_id": "01MZRMM5...",
      "type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "size_bytes": 245678,
      "created_at": "2026-03-15T09:00:00.000Z",
      "modified_at": "2026-03-20T14:00:00.000Z",
      "modified_by": "truck@contoso.onmicrosoft.com",
      "version_id": "v1_VER_2026-03-20T14:32:00Z",
      "is_locked": true,
      "locked_by": "alice@contoso.onmicrosoft.com",
      "lock_expires_at": "2026-03-20T15:00:00.000Z",
      "is_in_local_cache": true,
      "sync_status": "synced"
    },
    {
      "name": "Supporting_Documents.pdf",
      "file_id": "01MZRMM6...",
      "type": "application/pdf",
      "size_bytes": 512340,
      "created_at": "2026-03-18T10:30:00.000Z",
      "modified_at": "2026-03-20T13:45:00.000Z",
      "modified_by": "truck@contoso.onmicrosoft.com",
      "version_id": "v1_VER_2026-03-20T13:45:00Z",
      "is_locked": false,
      "is_in_local_cache": false,
      "sync_status": "synced"
    }
  ],
  "total_size_bytes": 758018,
  "file_count": 2,
  "folders": [
    {
      "name": "evidence",
      "file_count": 5,
      "total_size_bytes": 2048576
    }
  ],
  "listed_at": "2026-03-20T14:32:16.000Z"
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `CASE_NOT_FOUND` | Case ID does not exist |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `PERMISSION_DENIED` | User does not have read access to folder |
| `INVALID_PATH` | Path contains invalid characters or traversal attempts |

---

### 6. storage:lock

**Description:** Acquire a file lock (exclusive or shared). Used when opening a document for editing.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "document_id": "doc_a1b2c3d4",
  "lock_type": "exclusive"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "lock_id": "lock_xyz789",
  "document_id": "doc_a1b2c3d4",
  "lock_type": "exclusive",
  "locked_by": "truck@contoso.onmicrosoft.com",
  "acquired_at": "2026-03-20T14:32:16.000Z",
  "expires_at": "2026-03-20T15:32:16.000Z",
  "ttl_seconds": 3600,
  "storage_mode": "local_only"
}
```

#### Response Schema (Failure - Already Locked)

```json
{
  "success": false,
  "error": {
    "code": "FILE_ALREADY_LOCKED",
    "message": "Document is locked by another user",
    "details": {
      "document_id": "doc_a1b2c3d4",
      "locked_by": "alice@contoso.onmicrosoft.com",
      "expires_at": "2026-03-20T15:00:00.000Z",
      "lock_type": "exclusive",
      "suggestion": "Wait for lock to expire or request the user to save and close the document"
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `FILE_ALREADY_LOCKED` | Another user has exclusive lock |
| `DOCUMENT_NOT_FOUND` | Document ID does not exist |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `LOCK_TIMEOUT` | Lock acquisition took >30 seconds |

---

### 7. storage:unlock

**Description:** Release a file lock. Called when user saves and closes document.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "lock_id": "lock_xyz789"
}
```

Or by document:

```json
{
  "document_id": "doc_a1b2c3d4"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "lock_id": "lock_xyz789",
  "document_id": "doc_a1b2c3d4",
  "released_at": "2026-03-20T14:35:00.000Z"
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `LOCK_NOT_FOUND` | Lock ID does not exist |
| `LOCK_OWNER_MISMATCH` | Current user does not own the lock |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |

---

### 8. storage:sync

**Description:** Synchronize case metadata between local OPFS cache and remote storage. Handles conflicts.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "case_id": "case_c7f3d8e1",
  "direction": "bidirectional"
}
```

Or push only:

```json
{
  "case_id": "case_c7f3d8e1",
  "direction": "push"
}
```

#### Response Schema (Success - No Conflicts)

```json
{
  "success": true,
  "case_id": "case_c7f3d8e1",
  "sync_direction": "bidirectional",
  "sync_status": "completed",
  "files_pushed": 3,
  "files_pulled": 1,
  "files_updated": 4,
  "conflicts_detected": 0,
  "started_at": "2026-03-20T14:32:00.000Z",
  "completed_at": "2026-03-20T14:32:45.000Z",
  "details": [
    {
      "document_id": "doc_a1b2c3d4",
      "action": "pushed",
      "local_version": "v1_LOCAL_20260320T143000Z",
      "remote_version": "v1_VER_20260320T143000Z"
    },
    {
      "document_id": "doc_b2c3d4e5",
      "action": "pulled",
      "local_version": "v1_LOCAL_20260319T100000Z",
      "remote_version": "v1_VER_20260320T101500Z"
    }
  ]
}
```

#### Response Schema (Success - With Conflicts)

```json
{
  "success": true,
  "case_id": "case_c7f3d8e1",
  "sync_direction": "bidirectional",
  "sync_status": "completed_with_conflicts",
  "files_pushed": 2,
  "files_pulled": 0,
  "files_updated": 2,
  "conflicts_detected": 1,
  "conflicts": [
    {
      "conflict_id": "conflict_xyz789",
      "document_id": "doc_c3d4e5f6",
      "conflict_type": "concurrent_edit",
      "local_modified_at": "2026-03-20T14:00:00.000Z",
      "local_modified_by": "truck@contoso.onmicrosoft.com",
      "remote_modified_at": "2026-03-20T14:15:00.000Z",
      "remote_modified_by": "alice@contoso.onmicrosoft.com",
      "local_version_id": "v1_LOCAL_20260320T140000Z",
      "remote_version_id": "v1_VER_20260320T141500Z",
      "suggested_resolution": "merge",
      "status": "pending_user_review"
    }
  ],
  "started_at": "2026-03-20T14:32:00.000Z",
  "completed_at": "2026-03-20T14:32:45.000Z"
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `CASE_NOT_FOUND` | Case ID does not exist |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `SYNC_TIMEOUT` | Sync took >120 seconds |
| `INVALID_DIRECTION` | Direction not 'push', 'pull', or 'bidirectional' |

---

### 9. storage:open-external

**Description:** Open a document in the native editor (Word). Used for "Edit in Word" button. Main process handles app launch and file monitoring.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "document_id": "doc_a1b2c3d4"
}
```

Or by path:

```json
{
  "local_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment.docx"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "document_id": "doc_a1b2c3d4",
  "local_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment.docx",
  "launched_app": "Microsoft Word",
  "launched_at": "2026-03-20T14:32:16.000Z",
  "file_monitoring": {
    "enabled": true,
    "monitoring_for_changes": true,
    "will_sync_on_save": true
  },
  "lock_acquired": true,
  "lock_id": "lock_xyz789",
  "lock_expires_at": "2026-03-20T15:32:16.000Z"
}
```

#### Response Schema (Failure - App Not Available)

```json
{
  "success": false,
  "error": {
    "code": "EDITOR_NOT_FOUND",
    "message": "Microsoft Word is not installed on this system",
    "details": {
      "document_id": "doc_a1b2c3d4",
      "file_extension": ".docx",
      "suggestions": [
        "Install Microsoft Office",
        "Use OnlyOffice editor built into Psygil instead"
      ]
    }
  }
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `DOCUMENT_NOT_FOUND` | Document ID does not exist |
| `EDITOR_NOT_FOUND` | Native editor not installed |
| `FILE_NOT_IN_CACHE` | Document not in local cache (must download first) |
| `FILE_LOCKED` | Document is locked by another user |
| `APP_LAUNCH_FAILED` | Failed to launch the editor application |

---

### 10. storage:publish-pdf

**Description:** Generate a sealed PDF from the .docx report file. Includes document structure and metadata.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "document_id": "doc_a1b2c3d4",
  "output_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment_SEALED.pdf"
}
```

Or omit output_path for default:

```json
{
  "document_id": "doc_a1b2c3d4"
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "document_id": "doc_a1b2c3d4",
  "source_format": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "pdf_path": "opfs://Psygil/case-cache/case_c7f3d8e1/Report_Initial_Assessment_SEALED.pdf",
  "file_size_bytes": 189456,
  "page_count": 12,
  "integrity": {
    "checksum": "sha256:d4e5f6a7b8c9d0e1...",
    "signed": false,
    "can_be_sealed": true
  },
  "metadata": {
    "source_document_id": "doc_a1b2c3d4",
    "generated_at": "2026-03-20T14:32:16.000Z",
    "generated_by": "truck@contoso.onmicrosoft.com",
    "title": "Forensic Psychological Assessment — Initial Report",
    "author": "Truck Irwin"
  },
  "generated_at": "2026-03-20T14:32:30.000Z"
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `DOCUMENT_NOT_FOUND` | Document ID does not exist |
| `INVALID_SOURCE_FORMAT` | Document is not a .docx file |
| `CONVERSION_FAILED` | PDF conversion process failed |
| `FILE_NOT_IN_CACHE` | Document not in local cache (must download first) |
| `INSUFFICIENT_SPACE` | Not enough OPFS space for PDF output |

---

### 11. storage:version-history

**Description:** Get version history for a document. Shows all saved versions and who modified them.

**Direction:** Renderer → Main (Request), Main → Renderer (Response)

#### Request Schema

```json
{
  "document_id": "doc_a1b2c3d4",
  "limit": 10
}
```

#### Response Schema (Success)

```json
{
  "success": true,
  "document_id": "doc_a1b2c3d4",
  "document_name": "Report_Initial_Assessment.docx",
  "versions": [
    {
      "version_id": "v1_VER_2026-03-20T14:32:00Z",
      "version_number": 5,
      "modified_at": "2026-03-20T14:32:00.000Z",
      "modified_by": "truck@contoso.onmicrosoft.com",
      "size_bytes": 245678,
      "checksum": "sha256:a3f9e2d1...",
      "is_current": true,
      "change_summary": "Minor edits to conclusions section",
      "storage_location": "cloud_o365"
    },
    {
      "version_id": "v1_VER_2026-03-20T13:45:00Z",
      "version_number": 4,
      "modified_at": "2026-03-20T13:45:00.000Z",
      "modified_by": "alice@contoso.onmicrosoft.com",
      "size_bytes": 244512,
      "checksum": "sha256:b4g0f3e2...",
      "is_current": false,
      "change_summary": "Added clinical recommendations",
      "storage_location": "cloud_o365"
    },
    {
      "version_id": "v1_VER_2026-03-20T12:00:00Z",
      "version_number": 3,
      "modified_at": "2026-03-20T12:00:00.000Z",
      "modified_by": "truck@contoso.onmicrosoft.com",
      "size_bytes": 240128,
      "checksum": "sha256:c5h1g4f3...",
      "is_current": false,
      "change_summary": "Initial clinical assessment completed",
      "storage_location": "cloud_o365"
    }
  ],
  "total_versions": 5,
  "oldest_version_date": "2026-03-18T09:00:00.000Z",
  "retrieved_at": "2026-03-20T14:32:16.000Z"
}
```

#### Error Responses

| Code | Scenario |
|------|----------|
| `DOCUMENT_NOT_FOUND` | Document ID does not exist |
| `STORAGE_UNAVAILABLE` | Network/cloud service is down |
| `VERSION_HISTORY_UNAVAILABLE` | Storage backend does not support version history (e.g., local_only mode) |

---

## Error Handling

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "context_field_1": "value",
      "context_field_2": "value",
      "suggestion": "Recommended action for the user"
    }
  }
}
```

### Common Error Codes

| Code | Applicable Endpoints | HTTP Analogy | Meaning |
|------|----------------------|--------------|---------|
| `STORAGE_CONFIGURE_FAILED` | configure | 400 | Configuration is invalid or unreachable |
| `STORAGE_UNAVAILABLE` | upload, download, list, lock, sync | 503 | Storage backend is temporarily down |
| `FILE_LOCKED` | upload | 423 | File is locked by another user |
| `FILE_NOT_FOUND` | download, lock, unlock | 404 | File does not exist |
| `PERMISSION_DENIED` | list, download | 403 | User lacks access to file/folder |
| `INSUFFICIENT_SPACE` | upload | 507 | Out of space on storage |
| `AUTH_FAILED` | authenticate | 401 | OAuth token could not be obtained |
| `SYNC_CONFLICT` | sync | 409 | Concurrent modifications detected |
| `TIMEOUT` | Any long-running op | 504 | Operation exceeded time limit |

---

## File Locking Strategy

### Overview

File locks prevent concurrent edits across all three storage modes. Locks are acquired when a document is opened for editing and released when saved/closed.

### Local Mode (`local_only`)

- **Mechanism:** SQLite `file_locks` table with TTL
- **Lock File:** None (handled in memory + DB)
- **Behavior:**
  - Insert row in `file_locks` with `lock_type` and `expires_at`
  - If lock exists, return error with lock holder info
  - Lock auto-expires after 30 minutes; can be manually unlocked

### Shared Drive Mode (`shared_drive`)

- **Mechanism:** Advisory lock file + SQLite `file_locks` table
- **Lock File:** `<folder>/.locks/<document_id>.lock` containing JSON with lock holder, timestamp, expiry
- **Behavior:**
  - Try to create lock file (atomic operation)
  - Insert row in `file_locks` table with `local_lock_file_path`
  - If lock file exists, read it and return lock holder info
  - Check if lock is expired; if so, remove and retry
  - On unlock, remove lock file and delete from table

### Cloud Mode (`cloud_o365` / `cloud_gdrive`)

- **Mechanism:** Cloud provider's native lock API + SQLite `file_locks` table
- **O365:** Microsoft Graph API [`PATCH /drives/{driveId}/items/{itemId}`](https://learn.microsoft.com/en-us/graph/api/driveitem-lock)
- **GDrive:** Custom advisory using permissions + metadata files
- **Behavior:**
  - Call cloud lock API to acquire lock
  - Store cloud lock ID in `file_locks.lock_id_cloud`
  - Return lock info to caller
  - On unlock, call cloud API to release lock
  - If cloud lock fails, fall back to SQLite-only lock

### Lock Expiry & Cleanup

- Locks expire after 30 minutes by default (configurable)
- On every lock operation, scan for expired locks and remove them
- Client-side cleanup: when app exits, scan for locks owned by this device and release them
- Server-side cleanup (cloud only): cloud providers auto-release locks after extended period (varies by provider)

---

## Sync Conflict Resolution

### Conflict Detection

Sync detects conflicts when:

1. **Version Mismatch:** Local and remote versions differ in content
2. **Concurrent Edit:** Both local and remote were modified since last sync
3. **Delete + Modify:** File deleted locally but modified remotely (or vice versa)

### Conflict Recording

When conflict detected:
- Insert row in `file_conflicts` table with:
  - `conflict_type`
  - `local_version_id`, `remote_version_id`
  - `local_modified_at`, `remote_modified_at`
  - `local_modified_by`, `remote_modified_by`
  - `resolution_strategy: 'pending'`
  - Conflict remains in table until user resolves

### Resolution Strategies

User can choose one of these via UI (calls `storage:sync` with resolution):

1. **Keep Local** — Local version overwrites remote (push)
2. **Keep Remote** — Remote version overwrites local (pull)
3. **Merge** — Manual merge in Word; user saves and syncs again
4. **Discard** — Delete the conflicted version entirely

### Example Conflict Flow

```
1. User opens Psygil app
2. Sync runs automatically (every 5 mins)
3. Sync detects: local Report v5, remote Report v7
4. Conflict created in file_conflicts table
5. UI shows conflict banner: "Report_Initial_Assessment.docx has a conflict"
6. User clicks "Resolve"
7. UI shows: "Local (v5 by You), Remote (v7 by Alice) — which do you want to keep?"
8. User chooses "Merge"
9. Local version downloaded to comparison view
10. User manually edits local version to incorporate remote changes
11. User clicks "Save"
12. storage:sync called again with case_id + direction='push'
13. Sync marks conflict as resolved with strategy='merge'
14. file_conflicts row updated: resolution_strategy='merge', resolved_at=now, resolved_by=user_email
```

---

## Integration Points

### Renderer → Main Calls

The React renderer calls `ipcRenderer.invoke()` for all storage operations:

```javascript
// Example: Upload a report
const result = await window.electron.invoke('storage:upload', {
  case_id: 'case_c7f3d8e1',
  local_file_path: 'opfs://...',
  remote_folder: 'reports'
});

// Example: Lock a document
const lockResult = await window.electron.invoke('storage:lock', {
  document_id: 'doc_a1b2c3d4',
  lock_type: 'exclusive'
});
```

### OnlyOffice Integration

OnlyOffice editor communicates via its SDK:
- Detects file save events
- Main process calls `storage:upload` on save
- Detects file close events
- Main process calls `storage:unlock`

### Python Sidecar Integration

Python sidecar (PII detection) uses downloaded files:
- Renderer calls `storage:download` to get document
- Renderer passes local path to sidecar via `pii/detect`
- Sidecar processes and returns redacted text
- Renderer uploads redacted version via `storage:upload`

---

## Version Control & Document Lineage

Each document maintains:
- **Document ID:** Unique identifier across all versions
- **Version ID:** Unique per saved version (timestamp + environment)
- **Checksum:** SHA-256 of file contents (detects tampering)
- **Modified By:** Email of user who saved this version
- **Modified At:** Timestamp of save (UTC)

Example version lineage:
```
Document: doc_a1b2c3d4
├─ v1 (2026-03-18 09:00 by truck@contoso) — Initial draft
├─ v2 (2026-03-18 14:30 by truck@contoso) — Clinical notes added
├─ v3 (2026-03-20 12:00 by truck@contoso) — Initial assessment complete
├─ v4 (2026-03-20 13:45 by alice@contoso) — Clinical recommendations
└─ v5 (2026-03-20 14:32 by truck@contoso) — Current [ACTIVE]
```

This enables:
- **Audit trail:** See every change and by whom
- **Rollback:** Restore earlier versions if needed
- **Forensic analysis:** Prove document integrity for legal discovery

---

## Security Considerations

### PII Protection

- Uploaded documents may contain PII. All PII handling goes through Python Sidecar for redaction.
- Cloud storage (O365, GDrive) are trusted for encrypted-at-rest, but Psygil manages encryption of sensitive metadata locally.

### Credential Storage

- OAuth tokens stored in OS credential store (Keychain/Credential Manager/Secret Service).
- Never logged to console or stored in plaintext.
- Tokens automatically refreshed before expiry.

### Audit Logging

- All file operations logged: upload, download, lock, unlock, delete, sync, conflict
- Logs include: user, timestamp, file ID, action, result
- Logs stored in SQLite audit table for production forensic analysis

### Network Security

- All cloud communication over HTTPS with certificate pinning (O365, GDrive)
- SMB/shared drive communication over encrypted SMB 3.1.1
- Local cache stored in OPFS (browser-isolated storage, not accessible to other apps)

