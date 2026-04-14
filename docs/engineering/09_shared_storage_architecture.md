# ADR-001: Three-Tier Progressive Storage Architecture (Local → Shared Drive → Cloud)

**ADR Number:** ADR-001
**Title:** Three-Tier Progressive Storage Architecture (Local → Shared Drive → Cloud)
**Status:** Accepted
**Date:** 2026-03-20
**Decider:** Truck Irwin, CEO
**Author:** Claude (AI Collaborator)
**Affected Components:** Database Schema, IPC Boundaries, Authentication & Authorization, File Locking, Cloud Integration

---

## Context

Psygil is a desktop application for forensic and clinical psychologists to author evaluation reports. The current implementation uses local-only SQLCipher storage, which is appropriate for solo practitioners but insufficient for multi-provider practices (2–10 clinicians) that need shared access to cases, documents, and collaborative workflows.

The product strategy requires support for three distinct practice types:

1. **Solo practitioners** — Single user, zero collaboration, local machine only
2. **Small practices** — 2–10 providers, shared office, shared network infrastructure, no remote access requirement
3. **Multi-location or remote practices** — Distributed team, need cloud access, peer review workflows across locations

Current state: MVP supports only Mode 1 (Local Only). The decision now is how to architect the system to support Modes 2 and 3 without compromising the security moat (PHI never leaves the machine unless explicitly stored in cloud) or forcing a complete rewrite.

---

## Decision

**Adopt a three-tier progressive storage architecture with a hybrid local-cloud model:**

### Storage Mode 1: Local Only (MVP, Launched)
- **Target:** Solo practitioners
- **Data storage:** SQLCipher database and document store on local machine only
- **Network:** None
- **Sync:** None
- **Security model:** All PHI encrypted at rest on practitioner's own machine
- **Release:** v1.0 (launched)

### Storage Mode 2: Shared Network Drive (Post-Launch Year 1)
- **Target:** Small practices (2–10 providers) sharing office infrastructure
- **Data storage:** SQLCipher database and document store on network share (NAS, Windows/macOS network mount)
  - Network path configured during setup: `\\server\Psygil\` or `/Volumes/PracticeShare/Psygil/`
  - Database stored at: `{network_root}/database/Psygil.db`
  - Document store at: `{network_root}/documents/`
- **Access control:** Each user has individual login credentials; role-based access controls applied at application layer
- **Concurrency:** SQLite Write-Ahead Logging (WAL) mode for multiple readers, single writer
- **Network:** Private practice network only (no internet exposure)
- **Security model:** PHI never leaves practice network; all data encrypted by SQLCipher
- **Release:** v1.1 (post-launch)

### Storage Mode 3: Cloud Storage (Post-Launch Year 2)
- **Target:** Practices requiring remote access or multi-location distribution
- **Hybrid storage model:**
  - **SQLCipher database:** Remains LOCAL on each machine
    - Stores: settings, style rules, agent state, local cache of case metadata
    - Never synced to cloud
    - Rationale: Reduces cloud API calls, eliminates real-time sync complexity, keeps practice configuration private
  - **Document store:** Cloud-hosted (Microsoft SharePoint/OneDrive or Google Drive)
    - Case metadata synced via lightweight JSON manifest file (`case-metadata.json`) in each cloud case folder
    - Source of truth for: case files, reports, supporting documents
  - **File locking:** Handled natively by cloud provider (SharePoint exclusive locks with 10-minute renewal; GDrive via Google Drive API)
    - **Electron gotcha:** SharePoint locks may persist ~15 minutes after document close; must explicitly release via Microsoft Graph API
- **Cloud providers supported:**
  - **Microsoft 365 (SharePoint Online / OneDrive)** — via Microsoft Graph API with MSAL authentication in Electron
  - **Google Workspace (Google Drive)** — via Google Drive API with BAA for eligible organizations
  - **Future:** Additional cloud providers per market demand (Dropbox, etc.)
- **Authentication:** OAuth 2.0 via MSAL (Microsoft) or Google OAuth (Google); credentials stored securely in Electron's native secure store
- **UI features:**
  - "Edit in Word" button — opens .docx in native Microsoft Word or Google Docs
  - "Publish to PDF" button — generates static PDF for sharing/archival
  - "Sync Status" indicator — shows last sync time, pending conflicts, cloud availability
- **Network:** Internet required; all communication over TLS 1.2+
- **Security model:** PHI in cloud storage is covered by provider's BAA and encryption; local database never synced
- **Release:** v2.0+ (Year 2+)

---

## Options Considered

| Option | Description | Trade-offs | Viability | Rationale |
|--------|-------------|-----------|-----------|-----------|
| **A: Local-Only Forever** | No multi-user, no cloud, no remote access. All future requests declined. | Limits market to solo practitioners only. Revenue ceiling ~$50K–$100K/yr. Forecloses small-practice and enterprise segments. Competitive disadvantage vs. Nabla, Heidi Health (both cloud-native). | ❌ Rejected | Unnecessarily small addressable market. Strategic risk in a consolidating market. |
| **B: Custom Sync Server with CRDTs** | Build proprietary server with Conflict-free Replicated Data Types for real-time sync across all devices. | 2–3 dev-months to implement. Adds server infrastructure, deployment, monitoring, SLA. Doubles security surface (client + server). Requires team hire before Year 1 product launch. High risk of sync bugs. | ⚠️ Too Complex | Valid for Year 2+ if market validation justifies investment. Defers MVP launch. Not selected for initial post-launch. |
| **C: Cloud-Only (No Local Storage)** | SQLCipher database in cloud (S3, Azure Blob, etc.). All reads/writes via cloud API. | Destroys the "local-first security moat" that differentiates Psygil from competitors. Creates dependency on cloud uptime. Increases latency (network round-trip for every query). Complicates offline workflows. Eliminates the "disconnect and work securely" value prop. | ❌ Rejected | Contradicts the clinical ethics principle that patients' most sensitive data should not leave the practitioner's machine. Creates unnecessary cloud vendor lock-in. |
| **D: Three-Tier Progressive Model (SELECTED)** | Local (v1.0) → Shared Drive (v1.1) → Cloud Hybrid (v2.0+). Storage abstraction layer at Day 1. Single codebase supports all three modes. | Requires upfront Storage Provider abstraction. Schema and IPC design must accommodate multi-tenant, multi-user, file-locking from Day 1. Some redundancy in Year 1 (abstraction layer unused until v1.1). | ✅ Selected | Maximizes long-term flexibility without delaying MVP. Each tier progressively unlocks new markets. Hybrid cloud model (local DB + cloud docs) keeps security moat while enabling remote access. One codebase, three revenue tiers. |

---

## Consequences

### Positive Consequences

1. **Market Expansion**
   - v1.0 captures solo practitioners (high security, simplest setup)
   - v1.1 opens small-practice segment (2–10 providers, $500–$5K/month potential)
   - v2.0+ enables enterprise and multi-location practices ($5K–$50K+/month potential)
   - Single product roadmap supports solo through enterprise

2. **Security & Trust**
   - Local-first default maintains the "PHI never leaves your machine" security moat
   - Cloud integration remains optional; practices choose their comfort level
   - Hybrid model (local DB + cloud docs) avoids forced dependency on cloud vendor
   - HIPAA-compliant options available from day one

3. **Operational Simplicity (Years 1–2)**
   - Shared network drive (Mode 2) requires no additional infrastructure beyond NAS or network share
   - No server to operate, monitor, or scale in Year 1
   - No per-user licensing costs; licensing tied to installation
   - Reduced operational surface during early revenue stage

4. **Development Velocity**
   - Upfront abstraction layer (Storage Provider interface) enables future modes without rework
   - Each tier can be implemented incrementally: v1.0 local → v1.1 shared drive → v2.0 cloud
   - No forcing of "everything goes to the cloud" architecture
   - Backwards compatible: v1.0 users seamlessly upgrade to v1.1 without data migration

5. **Competitive Positioning**
   - Competitors (Nabla, Heidi Health) are cloud-native with no local-first option
   - Psygil can market to security-conscious clinicians, regulatory-constrained organizations, and offline-workflow advocates
   - Hybrid cloud model differentiates from "cloud or nothing" alternatives

### Negative Consequences

1. **Increased Upfront Complexity**
   - Storage Provider abstraction layer must support three modes from Day 1
   - Database schema requires: organization table, document-level permissions, file locking fields, storage_mode config
   - IPC boundary (Boundary 5) adds surface area: local FS, network shares, Microsoft Graph API, Google Drive API
   - Testing must cover three storage modes + interaction matrix (cross-mode sync, upgrade paths)

2. **Concurrency Challenges (Mode 2)**
   - SQLite WAL mode is reasonably safe but not bulletproof for highly concurrent workloads
   - If more than 2–3 concurrent writers, WAL mode can cause lock timeouts or journal file corruption
   - Mitigation: "Soft" write lock at application layer (only one instance can hold editing lock per case)
   - Scaling beyond ~5 concurrent users on shared drive may require migration to Mode 3

3. **Cloud Provider Coupling (Mode 3)**
   - Microsoft Graph API and Google Drive API have different:
     - Authentication flows (MSAL vs. OAuth)
     - File locking semantics (SharePoint exclusive locks vs. GDrive optimistic conflict detection)
     - Quota models (O365 included in subscription vs. GDrive per-storage-tier)
   - Each provider requires separate integration, testing, and support
   - Future cloud providers (Dropbox, Box, etc.) will require additional implementation

4. **File Locking Complexity (Mode 3)**
   - SharePoint locks may persist ~15 minutes after document close
   - Must explicitly call Microsoft Graph API to release locks (not automatic)
   - Risk: Stale locks block other users from editing; requires manual admin intervention
   - Google Drive uses optimistic conflict resolution; may lead to version conflicts if not handled carefully

5. **Schema & Data Migration**
   - Current v1.0 databases (local-only) must be migrated to support organization/permissions fields for Mode 2/3
   - Upgrade path: v1.0 → v1.1 creates implicit "solo practice" organization record
   - No user-visible changes, but schema evolution must be scripted and tested

6. **Offline Mode Complexity**
   - Mode 3 (cloud) requires offline-first architecture for document cache
   - Local SQLCipher database acts as cache; sync happens when network available
   - Conflict resolution must handle: local edits made offline, conflicting cloud edits, re-sync
   - Adds state machine complexity to document sync lifecycle

---

## Implementation Timeline

### Phase 1: Architecture & Abstraction (v1.0→v1.1 Transition, 2 weeks)
- **Week 1:**
  - Define Storage Provider interface (local FS, network share, cloud API)
  - Extend database schema: organization, document_permissions, file_lock_state, storage_mode config
  - Extend IPC Boundary 5: Storage abstraction layer with three implementations
  - Implement network share path configuration in Settings UI
  - Write integration tests: local vs. network share parity

- **Week 2:**
  - Implement SQLite WAL mode for network share access
  - Add application-level write lock (single editor per case) for Mode 2
  - Implement user role expansion: add 'receptionist' role
  - Document: schema migration script, upgrade instructions, configuration guide

### Phase 2: Shared Network Drive (v1.1, 4 weeks post-launch)
- **Week 1–2:**
  - Implement network path configuration dialog
  - Add file system watcher for remote changes (detect edits made by other users)
  - Implement case-level locking mechanism (soft lock at app layer, visual indicator)

- **Week 3–4:**
  - QA: Multi-user concurrent access scenarios
  - QA: Network interruption recovery
  - Beta release with 2–3 pilot practices
  - Customer support: troubleshooting shared drive setup

### Phase 3: Cloud Infrastructure (v2.0, 8 weeks post-launch, estimated Q2 2027)
- **Week 1–2:**
  - Implement Microsoft Graph API integration (MSAL authentication in Electron)
  - Implement OAuth 2.0 secure credential storage in native Electron secure store
  - Design case metadata JSON manifest format (lightweight sync)

- **Week 3–4:**
  - Implement SharePoint document store integration
  - Implement file lock handling (explicit release via Graph API)
  - Add "Edit in Word" and "Publish to PDF" toolbar buttons
  - Implement sync status indicator and conflict resolution UI

- **Week 5–6:**
  - Implement Google Drive API integration (Google OAuth)
  - Implement GDrive document store integration
  - Implement optimistic conflict resolution for GDrive

- **Week 7–8:**
  - QA: Multi-provider cloud scenarios (O365 + GDrive co-existence)
  - QA: Offline-to-online sync, lock handling, conflict resolution
  - Beta release with 5–10 pilot practices
  - Customer support & training for cloud workflows

### Post-Launch (Ongoing)
- **Month 6+:** Monitor Mode 2 usage; identify scaling issues with shared drives
- **Month 12+:** Consider Dropbox, Box, or other cloud providers based on customer demand

---

## Schema Changes Required

### New Tables

```sql
-- Organization: stores practice information
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('local', 'network_share', 'cloud')),
  network_share_path TEXT,  -- e.g., \\server\Psygil or /Volumes/PracticeShare/Psygil
  cloud_provider TEXT,       -- 'microsoft' or 'google' or NULL if not cloud
  cloud_tenant_id TEXT,      -- Microsoft tenant ID or Google Workspace domain
  mfa_required BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Role Extensions
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'psychologist' CHECK (role IN ('psychologist', 'psychometrist', 'receptionist', 'admin'));
ALTER TABLE users ADD COLUMN organization_id TEXT REFERENCES organizations(id);
```

### Extended Tables

```sql
-- Documents table additions
ALTER TABLE documents ADD COLUMN remote_path TEXT;  -- e.g., SharePoint URL or GDrive file ID
ALTER TABLE documents ADD COLUMN cloud_sync_state TEXT CHECK (cloud_sync_state IN ('local', 'syncing', 'synced', 'conflict'));
ALTER TABLE documents ADD COLUMN last_cloud_sync TIMESTAMP;
ALTER TABLE documents ADD COLUMN locked_by_user_id TEXT;  -- file lock holder (soft lock at app layer)
ALTER TABLE documents ADD COLUMN locked_until TIMESTAMP;   -- lock expiration time

-- Cases table additions
ALTER TABLE cases ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE cases ADD COLUMN permissions_model TEXT DEFAULT 'role_based';  -- 'role_based', 'explicit', 'open'

-- New: Fine-grained document permissions
CREATE TABLE document_permissions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT REFERENCES users(id),
  role_id TEXT REFERENCES roles(id),
  permission_type TEXT NOT NULL CHECK (permission_type IN ('view', 'edit', 'review', 'sign')),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by_user_id TEXT
);

-- New: File lock tracking (for cloud modes, explicit locks via Graph API)
CREATE TABLE file_locks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  lock_type TEXT CHECK (lock_type IN ('exclusive', 'shared')),
  acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  cloud_lock_token TEXT,  -- Microsoft Graph lock token or GDrive revision
  is_explicit_released BOOLEAN DEFAULT 0
);

-- New: Sync audit trail (Mode 3 only)
CREATE TABLE cloud_sync_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  event_type TEXT CHECK (event_type IN ('upload', 'download', 'conflict', 'lock_acquired', 'lock_released')),
  local_revision INTEGER,
  cloud_revision TEXT,
  conflict_detail TEXT,  -- JSON describing conflict if applicable
  resolved_by_user_id TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## IPC Changes Required

### New IPC Boundary: Boundary 5 — Storage Provider Abstraction

**Purpose:** Abstract local filesystem, network shares, and cloud APIs behind a unified storage interface so the main application logic doesn't need to know which mode is active.

**New Preload Functions:**

```typescript
// Storage Provider Management
ipcMain.handle('storage:get-mode', async (event): Promise<'local' | 'network_share' | 'cloud'> => {
  // Return current storage mode from settings
});

ipcMain.handle('storage:get-config', async (event): Promise<StorageConfig> => {
  // Return storage configuration (path, cloud provider, etc.)
});

ipcMain.handle('storage:configure', async (event, config: StorageConfig): Promise<void> => {
  // Initialize storage mode (validate path, test connectivity, etc.)
});

// Document Operations (Storage-Agnostic)
ipcMain.handle('storage:read-document', async (event, documentId: string): Promise<DocumentContent> => {
  // Read from local FS, network share, or cloud depending on storage mode
});

ipcMain.handle('storage:write-document', async (event, documentId: string, content: DocumentContent): Promise<void> => {
  // Write to local FS, network share, or cloud
});

ipcMain.handle('storage:acquire-lock', async (event, documentId: string): Promise<LockToken> => {
  // Acquire soft lock (local), file lock (network share), or cloud lock (Graph API / GDrive)
});

ipcMain.handle('storage:release-lock', async (event, documentId: string, lockToken: LockToken): Promise<void> => {
  // Release lock; for SharePoint, explicitly call Graph API to release
});

ipcMain.handle('storage:watch-remote-changes', async (event, caseId: string): Promise<RemoteChangeStream> => {
  // Watch for changes made by other users (network share: file system watcher; cloud: polling Graph API / GDrive API)
});

// Cloud-Specific Operations (Mode 3 only)
ipcMain.handle('storage:authenticate-cloud', async (event, provider: 'microsoft' | 'google'): Promise<CloudCredentials> => {
  // OAuth 2.0 / MSAL authentication flow
});

ipcMain.handle('storage:list-cloud-cases', async (event): Promise<CloudCase[]> => {
  // List cases available in cloud storage
});

ipcMain.handle('storage:sync-case', async (event, caseId: string): Promise<SyncResult> => {
  // Sync case metadata and documents from cloud
});

ipcMain.handle('storage:open-in-cloud-editor', async (event, documentId: string): Promise<void> => {
  // Open document in Microsoft Word online or Google Docs (Mode 3 only)
});

ipcMain.handle('storage:publish-to-pdf', async (event, documentId: string): Promise<PDFBuffer> => {
  // Generate PDF from document (works across all modes)
});
```

**Type Definitions:**

```typescript
interface StorageConfig {
  mode: 'local' | 'network_share' | 'cloud';
  networkSharePath?: string;          // \\server\Psygil or /Volumes/PracticeShare/Psygil
  cloudProvider?: 'microsoft' | 'google';
  cloudTenantId?: string;             // Microsoft tenant or Google domain
  mfaRequired?: boolean;
}

interface DocumentContent {
  id: string;
  format: 'docx' | 'pdf' | 'rtf';
  buffer: Buffer;
  metadata: {
    lastModified: Date;
    lastModifiedBy: string;
    version: number | string;
  };
}

interface LockToken {
  token: string;
  expiresAt: Date;
  cloudLockId?: string;  // Microsoft Graph lock ID or GDrive revision
}

interface RemoteChangeStream {
  caseId: string;
  changedDocuments: string[];  // document IDs
  timestamp: Date;
  changedByUser: string;
}

interface CloudCredentials {
  provider: 'microsoft' | 'google';
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tenantId?: string;
}

interface CloudCase {
  id: string;
  name: string;
  cloudPath: string;  // SharePoint URL or GDrive folder ID
  lastSynced: Date;
  conflicts: ConflictSummary[];
}

interface SyncResult {
  caseId: string;
  documentsDownloaded: number;
  documentsUploaded: number;
  conflicts: ConflictDetail[];
  lastSyncTime: Date;
}

interface ConflictDetail {
  documentId: string;
  documentName: string;
  conflictType: 'version' | 'lock' | 'permission';
  localVersion: number | string;
  remoteVersion: number | string;
  suggestedResolution: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
}
```

---

## Security Implications

### Mode 1: Local Only (Strongest)

- **Encryption at Rest:** SQLCipher with AES-256
- **Network Exposure:** Zero. No data traverses network.
- **Attack Surface:** Local machine physical security, OS access controls
- **HIPAA Compliance:** Full BAA not required (data doesn't involve cloud vendor); practice responsible for OS-level encryption and access controls
- **Audit Trail:** Application audit logs stored locally; no cloud audit available
- **Threat Model:** Compromised OS credentials, malware, physical theft

**Security Controls:**
- Require OS-level password protection
- Document: "encrypt your hard drive (BitLocker, FileVault)" in setup guide
- Consider: Periodic backup encryption, secure deletion protocol for archived cases

---

### Mode 2: Shared Network Drive (Moderate)

- **Encryption at Rest:** SQLCipher (in-transit: depends on network config)
- **Network Exposure:** Private practice network only (no internet). Data traverses LAN if practice uses Wi-Fi.
- **Attack Surface:** Network share authentication (Windows NTLM/Kerberos, NFS, SMB), NAS physical security, insider threat
- **HIPAA Compliance:** Practice responsible for:
  - Network segmentation (isolated VLAN for medical data)
  - Access controls (NTFS/NFS permissions, network authentication)
  - Encryption in transit (SMB3 signing/encryption, TLS for remote NAS access)
  - Physical security of NAS
  - Backup encryption and retention policy
  - Audit logging of network share access
- **Audit Trail:** Practice responsible for NAS audit logs (Synology, QNAP provide)
- **Threat Model:** Network interception (LAN eavesdropping), credential compromise, NAS breach, insider threat

**Security Controls:**
- Require: SMB3 signing + encryption on Windows shares; NFS v4 with Kerberos on Unix
- Recommend: Network isolation (separate VLAN for medical data), per-user network credentials
- Implement: Application-level audit logging (who edited which document, when)
- Educate: Password security, share access review (quarterly), backup testing
- Document: "Consult your IT provider for secure network share setup"

---

### Mode 3: Cloud Storage (Moderate to High with proper configuration)

#### Microsoft 365 (SharePoint Online / OneDrive)

- **Encryption at Rest:** Microsoft manages AES-256 encryption; customer encryption (Purview) available for Enterprise SKUs
- **Encryption in Transit:** TLS 1.2+ enforced; HTTPS only
- **Network Exposure:** Internet-exposed. All data traverses Microsoft infrastructure.
- **Attack Surface:** OAuth token compromise, SharePoint misconfiguration, Microsoft Graph API exposure, browser-based threats
- **HIPAA Compliance:** BAA available for eligible Microsoft 365 plans (Business Standard, Business Premium, Enterprise E3/E5)
  - BAA requirement: Enable MFA, disable non-covered services (OneDrive consumer sync, Sharepoint sharing with external users)
  - Must configure: DLP policies (prevent unencrypted downloads, restrict external shares), audit logging, data residency
- **Audit Trail:** Microsoft provides built-in audit logging in Security & Compliance Center (6 months of logs)
- **Threat Model:** Compromised OAuth token, phishing, misconfigured sharing, account takeover, Microsoft insider threat (low but non-zero)

**Security Controls (Psygil Responsibility):**
- Enforce MFA (Microsoft Authenticator or FIDO2 preferred)
- Use MSAL with secure credential storage (Electron native store; never hardcode tokens)
- Implement short-lived access tokens + refresh token rotation
- Log all cloud operations locally (sync events, lock acquisitions, user actions)
- Document: "Enable MFA for all O365 accounts; consult Microsoft for DLP setup"
- Implement: "Publish to PDF" button for external sharing (avoid direct link sharing of .docx)

**Practice Responsibility (must be in Psygil documentation):**
- BAA activation with Microsoft
- MFA enforcement via Azure AD
- DLP policies: no external sharing of case documents
- Monitor audit logs monthly
- Disable non-covered services
- Annual access review

---

#### Google Workspace (Google Drive)

- **Encryption at Rest:** Google manages AES-128 encryption; customer encryption (Google Workspace Security Key Manager) available for Enterprise plans
- **Encryption in Transit:** TLS 1.2+ enforced
- **Network Exposure:** Internet-exposed. All data traverses Google infrastructure.
- **Attack Surface:** OAuth token compromise, Google Drive API misconfiguration, browser-based threats
- **HIPAA Compliance:** BAA available for Business Plus and Enterprise plans
  - BAA requirement: Disable non-covered services (Google Photos, YouTube), enable audit logging
  - Must configure: Sharing policies (prevent external domain shares), MFA
- **Audit Trail:** Google Admin Console provides audit logs (30 months retention)
- **Threat Model:** Compromised OAuth token, phishing, misconfigured sharing, account takeover, Google insider threat (low)

**Security Controls (Psygil Responsibility):**
- Enforce MFA (Google Authenticator or FIDO2 preferred)
- Use Google OAuth with secure credential storage
- Implement short-lived access tokens
- Log all cloud operations locally
- Document: "Enable MFA for all Google Workspace accounts; consult Google for BAA setup"

**Practice Responsibility (must be in Psygil documentation):**
- BAA activation with Google
- MFA enforcement via Google Admin Console
- Sharing policies: restrict to organization domain only
- Disable non-covered services
- Monitor audit logs monthly
- Annual access review

---

### Cross-Mode Security Concerns

**Upgrade Path (v1.0 → v1.1):**
- Local-only database contains all historical data
- When upgrading to network share mode, all data migrated to network share
- Risk: Unencrypted migration; mitigation: (a) destination network share must be encrypted, (b) migration runs on same machine (doesn't traverse network)
- Recommendation: Prompt user to validate destination network share encryption before migration

**Multi-Mode Coexistence (Mode 2 → Mode 3):**
- If practice switches from shared drive to cloud, must handle:
  - Local SQLCipher database: continues to store settings, style rules, agent state (not migrated)
  - Document store: migrated from \\server\Psygil to SharePoint/GDrive
  - Metadata sync: must handle split history (old docs on network share, new docs in cloud)
- Recommendation: Implement one-way "export from network share" feature before migration

**Offline-First Cache (Mode 3):**
- Psygil caches cloud documents locally for offline access
- Risk: Stale local copies if practice switches machines or uses multiple devices
- Mitigation: Explicit "sync now" button, last-sync timestamp visible, conflict detection on next online
- Recommendation: Document: "Offline editing may cause conflicts; review sync conflicts before saving"

---

## HIPAA Compliance Validation

### Psygil Responsibilities (Controls in Code)

| Requirement | Mode 1 | Mode 2 | Mode 3 (O365) | Mode 3 (Google) |
|-------------|--------|--------|---------------|-----------------|
| **Encryption at Rest** | ✓ SQLCipher | ✓ SQLCipher (+ NAS config) | ✓ Microsoft | ✓ Google |
| **Encryption in Transit** | N/A | Practice config (SMB3) | ✓ TLS enforced | ✓ TLS enforced |
| **MFA Enforcement** | N/A | N/A | ✓ via MSAL | ✓ via OAuth |
| **Audit Logging** | ✓ Local app logs | ✓ Local app logs | ✓ Local + Cloud | ✓ Local + Cloud |
| **Access Control Segregation** | ✓ Role-based (app) | ✓ Role-based (app + OS) | ✓ Role-based + AD | ✓ Role-based + Workspace |
| **Token Security** | N/A | N/A | ✓ Secure storage + refresh | ✓ Secure storage + refresh |
| **Explicit Lock Release** | N/A | ✓ Soft lock (app) | ✓ via Graph API | ✓ via API |
| **Minimum Necessary Access** | ✓ App default | ✓ App role-based | ✓ Requires config | ✓ Requires config |

### Practice Responsibilities (Controls NOT in Code)

| Requirement | Mode 1 | Mode 2 | Mode 3 (O365) | Mode 3 (Google) |
|-------------|--------|--------|---------------|-----------------|
| **OS/Hardware Encryption** | ✓ BitLocker/FileVault | ✓ BitLocker/FileVault | Optional (cloud redundant) | Optional (cloud redundant) |
| **Network Security (Firewall, VPN)** | N/A | ✓ Must isolate LAN | N/A (cloud-managed) | N/A (cloud-managed) |
| **Physical NAS Security** | N/A | ✓ Secure closet, backup power | N/A | N/A |
| **Network Share Permissions (NTFS/NFS)** | N/A | ✓ Restrict to practice users | N/A | N/A |
| **BAA with Cloud Vendor** | N/A | N/A | ✓ Required | ✓ Required |
| **DLP / Sharing Policies** | N/A | N/A | ✓ Configure in Azure AD | ✓ Configure in Admin Console |
| **MFA Enforcement** | N/A | Recommended | ✓ Required | ✓ Required |
| **Audit Log Monitoring** | ✓ App logs only | ✓ App + NAS logs | ✓ App + Cloud logs | ✓ App + Cloud logs |
| **Incident Response Plan** | ✓ Local recovery | ✓ Local + NAS backup | ✓ Cloud restore + notify MS | ✓ Cloud restore + notify Google |
| **Backup & Disaster Recovery** | ✓ Offline backup encryption | ✓ NAS snapshots (encrypted) | ✓ Cloud snapshots | ✓ Cloud snapshots |
| **Workforce Training** | ✓ Annual HIPAA training | ✓ Annual HIPAA + NAS policies | ✓ Annual + MFA + cloud sharing | ✓ Annual + MFA + cloud sharing |

---

## Action Items

### Immediate (Before v1.0 Launch)

- [ ] **Code:** Implement Storage Provider abstraction interface (local FS only for v1.0; stubs for network share and cloud)
- [ ] **Schema:** Add `organization`, `storage_mode`, `document_permissions`, `file_lock` tables; extend `documents` and `users` tables
- [ ] **IPC:** Define Boundary 5 preload functions for storage abstraction
- [ ] **Docs:** Create "Security & HIPAA Guide for Solo Practitioners" (Mode 1)
- [ ] **Testing:** QA local-only storage mode; baseline performance (document load time, case search)

### v1.1 Post-Launch (4 weeks, Q2 2026)

- [ ] **Code:** Implement `StorageProvider::NetworkShare` adapter for SMB/NFS
- [ ] **Code:** Implement SQLite WAL mode; application-level write lock for concurrent access
- [ ] **IPC:** Wire up network share path configuration in Settings UI
- [ ] **IPC:** Implement file system watcher for remote change detection
- [ ] **Schema:** Migrate v1.0 databases; add organization record for existing solo users
- [ ] **Docs:** Create "Setup Guide: Psygil on Shared Network Drive" (Mode 2)
- [ ] **Docs:** Create "Security & HIPAA Guide for Small Practices" (Mode 2)
- [ ] **Testing:** QA multi-user concurrent access (2–5 users editing simultaneously)
- [ ] **Testing:** QA network interruption recovery (unplug network, verify case unlocks after timeout)
- [ ] **Support:** Prepare troubleshooting guide for common issues (share not found, permission denied, file lock stuck)

### v2.0 Pre-Launch (8 weeks, Q2–Q3 2027)

- [ ] **Code:** Implement `StorageProvider::MicrosoftGraph` adapter (SharePoint Online)
- [ ] **Code:** Implement `StorageProvider::GoogleDrive` adapter
- [ ] **Code:** Implement OAuth 2.0 / MSAL authentication flows for both providers
- [ ] **Code:** Implement case metadata JSON manifest sync
- [ ] **Code:** Implement Microsoft Graph file lock release mechanism (handle stale locks)
- [ ] **Code:** Implement optimistic conflict resolution (GDrive)
- [ ] **IPC:** Wire up OAuth flows, cloud case discovery, sync status indicator
- [ ] **IPC:** Implement "Edit in Word" and "Publish to PDF" buttons
- [ ] **UI:** Design sync status panel, conflict resolution UI
- [ ] **Schema:** Add `cloud_sync_events`, `file_locks`, `cloud_sync_state` fields
- [ ] **Docs:** Create "Setup Guide: Psygil with Microsoft 365" (Mode 3, O365)
- [ ] **Docs:** Create "Setup Guide: Psygil with Google Workspace" (Mode 3, GDrive)
- [ ] **Docs:** Create "HIPAA Compliance Checklist for Cloud Storage" (Mode 3)
- [ ] **Testing:** QA offline-to-online sync (edit offline, sync when network available)
- [ ] **Testing:** QA multi-provider cloud (O365 + GDrive in same org)
- [ ] **Testing:** QA conflict resolution (simultaneous edits to same document)
- [ ] **Testing:** QA file lock persistence (verify stale SharePoint locks are released)
- [ ] **Support:** Prepare troubleshooting guide for OAuth, sync conflicts, cloud authentication

### Post-v2.0 (Ongoing)

- [ ] **Monitor:** Track Mode 2 adoption; identify scaling bottlenecks (WAL contention beyond 5 concurrent users)
- [ ] **Monitor:** Track Mode 3 adoption; monitor sync success rate, conflict frequency
- [ ] **Customer Feedback:** Conduct quarterly review with pilot practices (what works, what doesn't)
- [ ] **Roadmap:** Evaluate demand for additional cloud providers (Dropbox, Box, OneDrive personal)
- [ ] **Roadmap:** Consider CRDT-based server sync (if Mode 2/3 customers demand real-time collaboration)
- [ ] **Legal:** Engage outside counsel to review HIPAA compliance documentation; obtain customer testimonials for BAA language

---

## References & Related Documents

- **Database Schema Spec:** `docs/engineering/03_database_schema.md`
- **IPC Boundary Specification:** `docs/engineering/04_ipc_contracts.md`
- **Security Model:** `docs/engineering/security_model.md`
- **HIPAA Compliance Framework:** `docs/legal/hipaa_safe_harbor_validation.md`
- **Microsoft 365 BAA:** [Microsoft Data Protection Addendum](https://learn.microsoft.com/en-us/compliance/regulatory/offering-dpa)
- **Google Workspace BAA:** [Google Workspace Business Agreement](https://workspace.google.com/terms/ba_terms.html)
- **Electron Secure Store Best Practices:** [Electron Security Documentation](https://www.electronjs.org/docs/tutorial/security)

---

## Approval & Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **CEO / Decider** | Truck Irwin | 2026-03-20 | ✓ Accepted |
| **Technical Lead** | Claude (AI) | 2026-03-20 | ✓ Endorsed |
| **Clinical Advisor** | [To be engaged] | [Pending] | [ ] Pending review |
| **Legal Counsel** | [Outside counsel] | [Pending] | [ ] Pending review |

---

## Revision History

| Date | Author | Change | Status |
|------|--------|--------|--------|
| 2026-03-20 | Claude | Initial ADR | Accepted |
| [Pending] | [Clinical Advisor] | Clinical feasibility validation | Pending |
| [Pending] | [Legal Counsel] | HIPAA/BAA validation review | Pending |

