-- Psygil: Shared Storage Support Schema Addendum
-- Purpose: Add tables and alterations to support shared storage modes
-- (local-only, shared network drive, Microsoft 365/SharePoint, Google Drive)
-- This addendum does NOT modify existing tables except where noted.
-- All existing schemas remain unchanged; these are pure additions.
--
-- Designed to support Modes 1-4:
-- Mode 1: Local-only (existing OPFS + SQLite)
-- Mode 2: Shared network drive with application-level file locking
-- Mode 3: Microsoft 365 / SharePoint integration with sync manifest
-- Mode 4: Google Drive integration with sync manifest
--
-- Date: March 20, 2026
-- ============================================================================

-- ============================================================================
-- 1. PRACTICE CONFIGURATION TABLE
-- ============================================================================
-- Stores organization/practice-level settings for storage mode, cloud credentials,
-- and shared drive configuration. Each practice can operate in a single storage mode.

CREATE TABLE practice_config (
    practice_id INTEGER PRIMARY KEY AUTOINCREMENT,
    practice_name TEXT NOT NULL UNIQUE,
    storage_mode TEXT NOT NULL DEFAULT 'local_only'
        CHECK (storage_mode IN ('local_only', 'shared_drive', 'cloud_o365', 'cloud_gdrive')),
    -- For shared_drive mode: UNC path like \\server\share\psygil\cases
    storage_path TEXT,
    -- For cloud_o365 mode: Microsoft Entra ID / Azure AD tenant ID
    cloud_tenant_id TEXT,
    -- For cloud_o365 mode: SharePoint site ID (used to construct site URLs)
    cloud_site_id TEXT,
    -- For cloud_o365 mode: Document library ID (defaults to 'Documents' if null)
    cloud_drive_id TEXT,
    -- For cloud_gdrive mode: Shared Drive ID (Google Team Drive)
    gdrive_shared_drive_id TEXT,
    -- Sync configuration: how often to sync (in minutes, null = manual only)
    auto_sync_interval_minutes INTEGER,
    -- Enable version history in cloud (O365/GDrive)
    enable_version_history BOOLEAN DEFAULT 1,
    -- Maximum local cache size before requiring sync/cleanup (in MB)
    max_local_cache_mb INTEGER DEFAULT 5000,
    -- Contact for practice administrator
    admin_email TEXT,
    -- Created and last updated timestamps
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at DATE DEFAULT CURRENT_DATE,

    CONSTRAINT valid_storage_path_if_shared
        CHECK (storage_mode != 'shared_drive' OR storage_path IS NOT NULL),
    CONSTRAINT valid_cloud_tenant_if_o365
        CHECK (storage_mode != 'cloud_o365' OR cloud_tenant_id IS NOT NULL),
    CONSTRAINT valid_gdrive_id_if_gdrive
        CHECK (storage_mode != 'cloud_gdrive' OR gdrive_shared_drive_id IS NOT NULL)
);

CREATE INDEX idx_practice_config_storage_mode ON practice_config(storage_mode);
CREATE INDEX idx_practice_config_practice_name ON practice_config(practice_name);

-- ============================================================================
-- 2. ALTER USERS TABLE
-- ============================================================================
-- Add practice_id foreign key to associate users with a practice (multi-tenant support)
-- Add 'receptionist' role to the role CHECK constraint

ALTER TABLE users
ADD COLUMN practice_id INTEGER REFERENCES practice_config(practice_id);

ALTER TABLE users
ADD CHECK (role IN ('psychologist', 'psychometrist', 'admin', 'receptionist'));

CREATE INDEX idx_users_practice_id ON users(practice_id);

-- Note: Update the existing CHECK constraint on role. This is a SQLite limitation;
-- to fully enforce the new role, applications should validate before insert/update.

-- ============================================================================
-- 3. DOCUMENT PERMISSIONS TABLE
-- ============================================================================
-- Tracks granular permissions on case files in shared storage mode.
-- Supports read/write/admin permissions per user per document.
-- Useful for receptionist-only read access, clinician write access, etc.

CREATE TABLE document_permissions (
    permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    -- read: can view, write: can edit, admin: can change permissions
    permission_level TEXT NOT NULL DEFAULT 'read'
        CHECK (permission_level IN ('read', 'write', 'admin')),
    -- User who granted this permission
    granted_by_user_id INTEGER NOT NULL,
    -- When the permission was granted
    granted_at DATE NOT NULL DEFAULT CURRENT_DATE,
    -- When the permission was revoked (null = still active)
    revoked_at DATE,

    FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by_user_id) REFERENCES users(user_id),
    UNIQUE (document_id, user_id),
    CONSTRAINT valid_grantor CHECK (granted_by_user_id != user_id)
);

CREATE INDEX idx_document_permissions_document_id ON document_permissions(document_id);
CREATE INDEX idx_document_permissions_user_id ON document_permissions(user_id);
CREATE INDEX idx_document_permissions_permission_level ON document_permissions(permission_level);
CREATE INDEX idx_document_permissions_active ON document_permissions(revoked_at)
    WHERE revoked_at IS NULL; -- For fast query of active permissions

-- ============================================================================
-- 4. FILE LOCKS TABLE
-- ============================================================================
-- Application-level file locking for shared network drive mode (Mode 2).
-- Prevents simultaneous editing of the same case file by multiple users.
-- Locks auto-expire after 15 minutes if not renewed (edit session ended).
-- Used for Mode 2 (shared drive) pessimistic locking strategy.

CREATE TABLE file_locks (
    lock_id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    -- User who currently holds the lock
    locked_by_user_id INTEGER NOT NULL,
    -- exclusive: only one writer; shared: multiple readers allowed
    lock_type TEXT NOT NULL DEFAULT 'exclusive'
        CHECK (lock_type IN ('exclusive', 'shared')),
    -- When the lock was acquired
    acquired_at DATE NOT NULL DEFAULT CURRENT_DATE,
    -- When the lock expires (auto-cleanup trigger will delete if expired)
    expires_at DATE NOT NULL,
    -- When the lock was explicitly released by the user
    released_at DATE,

    FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
    FOREIGN KEY (locked_by_user_id) REFERENCES users(user_id),
    UNIQUE (document_id) -- Only one active lock per document
);

CREATE INDEX idx_file_locks_document_id ON file_locks(document_id);
CREATE INDEX idx_file_locks_locked_by_user_id ON file_locks(locked_by_user_id);
CREATE INDEX idx_file_locks_expires_at ON file_locks(expires_at);
CREATE INDEX idx_file_locks_active ON file_locks(released_at)
    WHERE released_at IS NULL; -- For fast query of active locks

-- Trigger: Auto-delete expired locks (15 minute timeout)
-- In production, this would be called by a background cleanup task
-- or triggered via an UPDATE to released_at
CREATE TRIGGER tr_file_locks_cleanup
AFTER INSERT ON file_locks
FOR EACH ROW
WHEN NEW.expires_at < CURRENT_DATE
BEGIN
    DELETE FROM file_locks
    WHERE lock_id = NEW.lock_id
    AND released_at IS NULL
    AND expires_at < CURRENT_DATE;
END;

-- ============================================================================
-- 5. ALTER DOCUMENTS TABLE
-- ============================================================================
-- Add cloud storage metadata columns for sync tracking (Modes 3 & 4)

ALTER TABLE documents
ADD COLUMN remote_path TEXT;
-- Purpose: For cloud modes, stores SharePoint URL or Google Drive file ID

ALTER TABLE documents
ADD COLUMN remote_version TEXT;
-- Purpose: Cloud version/etag from O365 or GDrive for change detection

ALTER TABLE documents
ADD COLUMN sync_status TEXT DEFAULT 'local_only'
    CHECK (sync_status IN ('local_only', 'synced', 'pending_upload', 'pending_download', 'conflict'));
-- Purpose: Tracks sync state: what needs to be synced, and conflict status

ALTER TABLE documents
ADD COLUMN last_synced_at DATE;
-- Purpose: When the document was last successfully synced with cloud

CREATE INDEX idx_documents_sync_status ON documents(sync_status);
CREATE INDEX idx_documents_last_synced_at ON documents(last_synced_at);
CREATE INDEX idx_documents_remote_path ON documents(remote_path) WHERE remote_path IS NOT NULL;

-- ============================================================================
-- 6. ALTER CASES TABLE
-- ============================================================================
-- Link cases to the practice for practice-level configuration isolation

ALTER TABLE cases
ADD COLUMN practice_id INTEGER REFERENCES practice_config(practice_id);

CREATE INDEX idx_cases_practice_id ON cases(practice_id);

-- ============================================================================
-- 7. SYNC MANIFEST TABLE
-- ============================================================================
-- Tracks sync state for cloud modes (O365 SharePoint, Google Drive).
-- Stores the JSON manifest file that lives in the cloud case folder.
-- Used for Mode 3 (O365) and Mode 4 (GDrive) to manage sync direction, conflicts.

CREATE TABLE sync_manifest (
    manifest_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    -- Date of the last successful sync (across both directions)
    last_sync_date DATE,
    -- The full JSON manifest object stored in the cloud case folder
    -- Format: { "version": "1.0", "case_id": N, "files": [...], "conflicts": [...] }
    manifest_json TEXT,
    -- upload: cloud is source of truth; download: local is source
    -- bidirectional: two-way sync with conflict resolution
    sync_direction TEXT NOT NULL DEFAULT 'bidirectional'
        CHECK (sync_direction IN ('upload', 'download', 'bidirectional')),
    -- Current sync state: synced, pending, conflict, error
    sync_status TEXT NOT NULL DEFAULT 'synced'
        CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    -- If sync_status = 'error', error message details
    error_message TEXT,
    -- When this manifest was created/updated
    updated_at DATE NOT NULL DEFAULT CURRENT_DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    UNIQUE (case_id)
);

CREATE INDEX idx_sync_manifest_case_id ON sync_manifest(case_id);
CREATE INDEX idx_sync_manifest_sync_status ON sync_manifest(sync_status);
CREATE INDEX idx_sync_manifest_updated_at ON sync_manifest(updated_at);

-- ============================================================================
-- 8. CASE ASSIGNMENTS TABLE
-- ============================================================================
-- Tracks which users are assigned to which cases for multi-user workflows.
-- Supports primary/reviewing clinician, psychometrist, and receptionist roles.
-- Enables assignment tracking and role-based access control.

CREATE TABLE case_assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    -- Role of the user in the context of this case (may differ from user.role)
    role_in_case TEXT NOT NULL
        CHECK (role_in_case IN ('primary_clinician', 'reviewing_clinician', 'psychometrist', 'receptionist')),
    -- User who assigned this user to the case
    assigned_by_user_id INTEGER NOT NULL,
    -- When the assignment started
    assigned_at DATE NOT NULL DEFAULT CURRENT_DATE,
    -- When the assignment ended (null = still active)
    completed_at DATE,

    FOREIGN KEY (case_id) REFERENCES cases(case_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by_user_id) REFERENCES users(user_id),
    UNIQUE (case_id, user_id, role_in_case) -- A user can only have one of each role per case
);

CREATE INDEX idx_case_assignments_case_id ON case_assignments(case_id);
CREATE INDEX idx_case_assignments_user_id ON case_assignments(user_id);
CREATE INDEX idx_case_assignments_role_in_case ON case_assignments(role_in_case);
CREATE INDEX idx_case_assignments_active ON case_assignments(completed_at)
    WHERE completed_at IS NULL; -- For fast query of active assignments

-- ============================================================================
-- VIEWS FOR SHARED STORAGE QUERIES
-- ============================================================================

-- View: Active case assignments per user
CREATE VIEW v_user_case_assignments AS
SELECT
    ca.assignment_id,
    ca.case_id,
    ca.user_id,
    u.full_name AS user_name,
    u.role AS user_role,
    ca.role_in_case,
    c.case_number,
    c.examinee_first_name,
    c.examinee_last_name,
    c.case_status,
    ca.assigned_at
FROM case_assignments ca
LEFT JOIN users u ON ca.user_id = u.user_id
LEFT JOIN cases c ON ca.case_id = c.case_id
WHERE ca.completed_at IS NULL
ORDER BY ca.assigned_at DESC;

-- View: Current file locks (active, non-expired)
CREATE VIEW v_active_file_locks AS
SELECT
    fl.lock_id,
    fl.document_id,
    d.original_filename,
    d.case_id,
    c.case_number,
    fl.locked_by_user_id,
    u.full_name AS locked_by_user,
    fl.lock_type,
    fl.acquired_at,
    fl.expires_at,
    CASE
        WHEN fl.expires_at < CURRENT_DATE THEN 'expired'
        ELSE 'active'
    END AS lock_status
FROM file_locks fl
LEFT JOIN documents d ON fl.document_id = d.document_id
LEFT JOIN cases c ON d.case_id = c.case_id
LEFT JOIN users u ON fl.locked_by_user_id = u.user_id
WHERE fl.released_at IS NULL;

-- View: Document sync status summary per case
CREATE VIEW v_case_sync_status AS
SELECT
    c.case_id,
    c.case_number,
    c.practice_id,
    pc.practice_name,
    pc.storage_mode,
    COUNT(d.document_id) AS total_documents,
    SUM(CASE WHEN d.sync_status = 'synced' THEN 1 ELSE 0 END) AS synced_documents,
    SUM(CASE WHEN d.sync_status = 'pending_upload' THEN 1 ELSE 0 END) AS pending_uploads,
    SUM(CASE WHEN d.sync_status = 'pending_download' THEN 1 ELSE 0 END) AS pending_downloads,
    SUM(CASE WHEN d.sync_status = 'conflict' THEN 1 ELSE 0 END) AS conflicted_documents,
    sm.sync_status AS case_manifest_status,
    sm.last_sync_date
FROM cases c
LEFT JOIN practice_config pc ON c.practice_id = pc.practice_id
LEFT JOIN documents d ON c.case_id = d.case_id
LEFT JOIN sync_manifest sm ON c.case_id = sm.case_id
GROUP BY c.case_id;

-- ============================================================================
-- TRIGGER: Auto-update practice_config.updated_at on changes
-- ============================================================================

CREATE TRIGGER tr_practice_config_update_timestamp
AFTER UPDATE ON practice_config
FOR EACH ROW
BEGIN
    UPDATE practice_config
    SET updated_at = CURRENT_DATE
    WHERE practice_id = NEW.practice_id;
END;

-- ============================================================================
-- TRIGGER: Auto-update sync_manifest.updated_at on changes
-- ============================================================================

CREATE TRIGGER tr_sync_manifest_update_timestamp
AFTER UPDATE ON sync_manifest
FOR EACH ROW
BEGIN
    UPDATE sync_manifest
    SET updated_at = CURRENT_DATE
    WHERE manifest_id = NEW.manifest_id;
END;

-- ============================================================================
-- CONSTRAINTS & NOTES
-- ============================================================================
--
-- IMPORTANT NOTES FOR IMPLEMENTATION:
--
-- 1. PRACTICE ISOLATION:
--    All users and cases must belong to a practice_id. Queries should filter
--    by practice_id to ensure multi-tenant isolation.
--
-- 2. FILE LOCKING (Mode 2 only):
--    When using shared_drive storage mode, the application MUST:
--    - Acquire a lock before opening a document for editing
--    - Renew the lock periodically (e.g., every 5 minutes during editing)
--    - Release the lock on save or close
--    - Inform users if a document is locked by another user
--    Lock expiry (15 min) provides safety against crash-without-release
--
-- 3. SYNC MANIFEST (Modes 3 & 4):
--    The sync manifest is a JSON file stored in the cloud case folder.
--    Format: {
--      "version": "1.0",
--      "case_id": <N>,
--      "practice_id": <N>,
--      "files": [
--        { "document_id": <N>, "remote_path": "...", "remote_version": "...", "local_hash": "..." },
--        ...
--      ],
--      "conflicts": [
--        { "document_id": <N>, "cloud_version": "...", "local_version": "..." },
--        ...
--      ]
--    }
--
-- 4. PERMISSIONS:
--    Document permissions are a supplement to storage-level permissions.
--    In cloud modes, use SharePoint/GDrive permission inheritance.
--    In shared_drive mode, use NTFS/SMB permissions + application-level checks.
--
-- 5. RECEPTIONIST ROLE:
--    Receptionists can:
--    - View case documents (read-only)
--    - Not edit clinical content
--    - Possibly upload new documents (configurable per practice)
--    - Not access Gate 2/3 decisions
--
-- 6. VERSION CONTROL:
--    For cloud modes with enable_version_history=1, cloud platforms (O365/GDrive)
--    maintain automatic version history. Sync logic should respect version lineage.
--
-- ============================================================================
-- END OF SCHEMA ADDENDUM
-- ============================================================================
