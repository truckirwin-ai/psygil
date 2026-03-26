# Application Setup Workflow — Production Specification
## Psygil — First Launch Through Operational Readiness

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Product Specification
**References:** Shared Storage Architecture (doc 09), Case Directory Schema (doc 16), UNID Redaction Architecture (doc 15), IPC API Contracts (doc 02), HIPAA Safe Harbor Validation (doc 03)

---

## Overview

This document specifies the complete setup workflow for Psygil from first launch to operational readiness. Two distinct paths exist depending on the deployment model:

**Path A: Solo Practitioner** — Single clinician installs the app, configures it, and begins working. The entire setup happens on one machine in one sitting. No network, no shared storage, no user management. This is the MVP path and the most common initial deployment.

**Path B: Practice Setup** — A practice manager or IT administrator configures a shared environment, then individual providers are onboarded. This involves shared storage configuration, user account creation, role assignment, and per-provider customization. This path ships in v1.1 (network share) and v2.0 (cloud).

Both paths share the same application binary. The divergence happens at Step 3 (Storage Configuration) when the user chooses Local vs. Shared vs. Cloud.

---

# PATH A: SOLO PRACTITIONER

Target: Single clinician running Psygil on their own machine. No collaboration, no shared access, no IT department.

## Step 1: Installation

**What happens:**
The clinician downloads the installer from psygil.com. Platform-specific:
- **macOS:** `.dmg` — drag to Applications. On first launch, macOS Gatekeeper prompts for approval (app is code-signed and notarized).
- **Windows:** `.exe` installer — standard wizard with license agreement. Installs to `C:\Program Files\Psygil\`. Registers as a standard Windows application (Add/Remove Programs).

**What installs:**
- Electron application shell
- Bundled Python runtime (embedded, not system Python) with Presidio + spaCy + `en_core_web_lg` model pre-installed
- OnlyOffice Document Editor (embedded, local server)
- Default templates (report templates, consent forms, letterhead)
- Default reference resources (DSM-5-TR code index, common statutes)

**No network required.** The installer is a complete offline package. The AI features require an API key (configured in Step 5), but the application is fully functional for local document editing without one.

**Python sidecar verification:** On first launch, before the setup wizard appears, the app silently verifies the Python sidecar starts correctly:
- Spawns the sidecar process
- Sends a health check ping
- Verifies Presidio loads and can detect a sample PHI string
- If this fails: error screen with diagnostics before setup wizard. The clinician cannot proceed until the sidecar is healthy — it's a hard dependency for HIPAA compliance.

## Step 2: License Activation

**What the user sees:** A clean activation screen before the setup wizard.

**Flow:**
1. Enter license key (25-character alphanumeric, delivered via email at purchase)
2. App validates the key against the Psygil license server (single HTTPS call)
3. License server returns: validity, tier (Solo/Practice/Enterprise), seat count, expiration date
4. License token stored locally in Electron's safeStorage (OS keychain on macOS, Credential Manager on Windows)
5. If offline: option to enter license key for deferred activation (validates on next network connection, 14-day grace period)

**License tiers relevant to setup:**
- **Solo** — Single user, local storage only. Steps 3-8 proceed as described below.
- **Practice** — Multi-user, unlocks shared storage + user management. Redirects to Path B.
- **Enterprise** — Practice + cloud storage + SSO. Redirects to Path B with cloud options enabled.

**No account creation.** The clinician does not create a Psygil web account. The license key is the only authentication artifact. This is deliberate — clinicians handling PHI are allergic to cloud accounts, and we don't want their credentials on our servers.

## Step 3: Storage Configuration

**What the user sees:** "Where should Psygil store your case files?"

**Options presented (Solo tier):**

**Option A: Default Location (recommended)**
- macOS: `~/Documents/Psygil/`
- Windows: `C:\Users\{username}\Documents\Psygil\`
- One-click selection. App creates the project root directory structure (`.psygil/`, `cases/`, `templates/`, `resources/` per doc 16).

**Option B: Custom Location**
- "Choose Folder" button → native OS folder picker
- Validates: write permissions, sufficient disk space (minimum 500MB free), not a system directory, not a cloud-synced folder (warns if inside iCloud Drive, OneDrive, Dropbox, Google Drive — these cause SQLite corruption from sync conflicts)
- Creates the project root directory structure at the chosen location

**What happens behind the scenes:**
1. App creates the directory structure per doc 16
2. SQLCipher database initialized at `{project_root}/.psygil/psygil.db`
   - Database encryption key derived from a random 256-bit key stored in Electron safeStorage (OS keychain)
   - The database key never touches disk in plaintext
3. `config.json` written with storage mode, path, and creation timestamp
4. Empty `audit.log` initialized with setup event
5. Default templates copied from app bundle into `{project_root}/templates/`

**Cloud sync folder warning:** If the user selects a path inside a known cloud sync folder (iCloud, OneDrive, Dropbox, Google Drive), the app shows a hard warning:

> "This folder appears to be synced by [iCloud/OneDrive/etc.]. Storing the Psygil database in a cloud-synced folder can cause database corruption because multiple sync clients may modify the file simultaneously. We strongly recommend choosing a local-only folder. If you need cloud access, Psygil's built-in cloud storage (available on Practice and Enterprise plans) handles this safely."

The user can override the warning, but the audit trail logs that they were warned.

## Step 4: Practice Information

**What the user sees:** "Tell us about your practice."

**Fields:**

| Field | Required | Purpose |
|-------|----------|---------|
| Full Name | Yes | Report headers, audit trail attribution |
| Credentials | Yes | Report signature block (e.g., "Psy.D., ABPP") |
| License Number | Yes | Report signature block, regulatory compliance |
| License State | Yes | Determines applicable state statutes loaded into Resources |
| Practice Name | No | Report letterhead, case metadata |
| Specialty | Yes (dropdown) | Configures default eval types, instrument library, report templates. Options: Forensic Psychology, Clinical Psychology, Neuropsychology, School Psychology, Other |
| NPI Number | No | Insurance/billing integration (future) |
| Practice Address | No | Report letterhead |
| Phone | No | Report letterhead |
| Practice Logo | No | Upload PNG/SVG for report letterhead |

**What happens behind the scenes:**
1. Practitioner profile created in SQLCipher `users` table (id, name, credentials, role='psychologist')
2. License state selection triggers loading of state-specific statutes into `{project_root}/resources/statutes/`
3. Specialty selection configures which eval types appear by default in case creation
4. If practice logo uploaded: stored in `{project_root}/.psygil/assets/logo.png`
5. Report templates updated with practice info (name, address, logo inserted into letterhead template)

## Step 5: AI Configuration

**What the user sees:** "Connect your AI assistant."

**Flow:**
1. **Provider selection:** Anthropic (recommended) or OpenAI
   - Anthropic selected by default with explanation: "Psygil's agents are optimized for Claude. OpenAI is supported but may produce different formatting."
2. **Model selection:** Dropdown populated per provider
   - Anthropic: Claude Opus 4, Claude Sonnet 4 (default), Claude Haiku 4
   - OpenAI: GPT-4o, GPT-4o-mini
3. **API key entry:** Masked input field with "Get API Key" link to provider's console
4. **Test Connection:** Button sends a minimal test prompt (no PHI) to verify the key works
   - Success: green checkmark, model name confirmed, estimated token cost displayed
   - Failure: red error with specific message (invalid key, rate limit, network error)
5. **UNID Redaction verification:** After API key is validated, app runs a live redaction test:
   - Sends a synthetic clinical paragraph through the full pipeline: Presidio detection → UNID replacement → API call → response received → UNID re-hydration → map destroyed
   - Displays results: "12 PHI entities detected and redacted. AI response received and re-hydrated successfully. UNID map destroyed. Pipeline verified."
   - This is a hard gate. If the UNID pipeline test fails, the user cannot proceed. They can skip AI configuration entirely (app works for manual document editing without AI), but if they enter an API key, the pipeline must verify end-to-end.

**What happens behind the scenes:**
1. API key encrypted and stored in Electron safeStorage (OS keychain)
2. Provider and model selection written to `config.json`
3. UNID pipeline test logged in audit trail (with entity count, not PHI)
4. If user skips AI configuration: all AI features are disabled in the UI (greyed out with "Configure AI in Settings to enable" tooltips). The app is fully functional for manual report writing.

## Step 6: Appearance

**What the user sees:** Three theme preview cards (Light, Medium/Warm Parchment, Dark) plus font size and layout preferences.

**Options:**
- Theme: Light (default) / Medium / Dark — click to preview instantly
- Font Size: Small (12px) / Medium (13px, default) / Large (14px)
- Editor Font: System default / Monospace option
- Sidebar default: Expanded (default) / Collapsed

**Lightweight step.** No validation, no hard gates. User clicks what looks good and moves on.

**What happens behind the scenes:**
1. Theme, font size, and layout preferences written to `config.json`
2. Applied immediately — the setup wizard itself reflects the chosen theme

## Step 7: Clinical Configuration

**What the user sees:** "Configure your clinical workspace."

**Two sections:**

**Section A: Evaluation Types**
Checkboxes for which eval types this clinician performs. Pre-selected based on specialty from Step 4:
- Forensic Psychology default: CST, Risk Assessment, Competency Restoration, Malingering Assessment, Fitness for Duty
- Clinical Psychology default: PTSD Dx, ADHD Dx, Disability, Capacity
- Neuropsychology default: ADHD Dx, Capacity, Disability, TBI Assessment
- School Psychology default: ADHD Dx, Learning Disability, Behavioral Assessment

User can check/uncheck any type. This controls which eval types appear in the case creation dropdown and which report templates are pre-loaded.

**Section B: Instrument Library**
Checkboxes for test instruments the clinician has access to. Organized by category:
- Personality/Psychopathology: MMPI-3, PAI, MCMI-IV
- Cognitive/Intelligence: WAIS-V, WMS-IV, WISC-V
- Neuropsychological: RBANS, D-KEFS, Trail Making, Wisconsin Card Sort
- Validity/Effort: TOMM, SIRS-2, M-FAST, VSVT
- Forensic-Specific: HCR-20v3, PCL-R, SAVRY, Static-99R
- Attention/Executive: CAARS, CPT-3, Conners-4
- Trauma: CAPS-5, PCL-5, TSI-2
- Adaptive: Vineland-3, ABAS-3

Pre-selected based on specialty. User can add/remove. This controls which instruments appear in the testing battery configuration when creating a case, and which scoring templates are available.

**What happens behind the scenes:**
1. Selected eval types and instruments saved to clinician profile in SQLCipher
2. Report templates filtered to only include selected eval types
3. Instrument metadata (scoring ranges, validity scales, normative data references) loaded for selected instruments

## Step 8: Completion & First Launch

**What the user sees:** Success screen with summary of configuration:

```
✓ Storage: ~/Documents/Psygil/ (Local, encrypted)
✓ AI: Claude Sonnet 4 (UNID pipeline verified)
✓ Practice: Dr. Truck Irwin, Psy.D., ABPP
✓ Specialty: Forensic Psychology
✓ Eval Types: 5 configured
✓ Instruments: 12 in library
```

**Two buttons:**
- "Open Psygil" — launches the main application with empty Dashboard
- "Create First Case" — launches main application and immediately opens the Intake modal

**What happens behind the scenes:**
1. Setup completion flag written to `config.json` (prevents setup wizard from re-appearing)
2. All 4 processes verified running: Electron Main, Renderer, OnlyOffice, Python Sidecar
3. Dashboard tab opens (permanent, per current prototype behavior)
4. Audit trail logs: "Application setup completed" with configuration summary (no PHI, no API keys)

**Subsequent launches:** App opens directly to Dashboard. Setup wizard never appears again unless the user clicks Setup in the titlebar or resets configuration in Settings.

---

# PATH B: PRACTICE SETUP (SHARED / CLOUD)

Target: A practice manager or IT staff member configuring Psygil for a multi-provider office. The person doing the setup may not be a clinician — they may be an office manager or IT contractor.

## Phase 1: Administrator Installation & Practice Configuration

### Step B1: Installation

Same as Step 1 in Path A. The installer is identical — the license tier determines which features are available.

### Step B2: License Activation

Same screen as Step 2, but the license key is a Practice or Enterprise tier.

**What changes:**
- License server returns `tier: "practice"` or `tier: "enterprise"` with seat count (e.g., 5 seats, 10 seats)
- App recognizes multi-user tier and switches to Path B flow
- "You're setting up Psygil for a practice. Let's configure the shared environment first, then we'll add your providers."

### Step B3: Practice Administrator Account

**What the user sees:** "Create the practice administrator account."

**Fields:**

| Field | Required | Purpose |
|-------|----------|---------|
| Admin Full Name | Yes | Audit trail, user management |
| Admin Email | Yes | Account recovery, license management |
| Admin Password | Yes | Local authentication (min 12 chars, complexity requirements) |
| Admin Role | Pre-set | `admin` — full access to all settings, user management, all cases |

**What happens behind the scenes:**
1. Admin user created in SQLCipher `users` table with `role='admin'`
2. Password hashed with Argon2id (memory-hard, side-channel resistant)
3. Admin session token created
4. The admin user is NOT necessarily a clinician — they may never open a case. Their role is practice management.

### Step B4: Practice Information

Same fields as Step 4 in Path A, but with additional practice-level fields:

| Additional Field | Required | Purpose |
|-----------------|----------|---------|
| Practice Tax ID / EIN | No | Billing, SBIR grant compliance |
| Number of Providers | Yes | Validates against license seat count |
| Practice Type | Yes (dropdown) | Solo, Group Practice, Forensic Center, Academic, Government. Determines default role configurations |

### Step B5: Storage Configuration

**What the user sees:** "Where should Psygil store case files for your practice?"

**This is the critical divergence from Path A.** Three options:

**Option A: Shared Network Drive (Practice tier)**

For practices with a NAS, file server, or shared network mount. All machines on the practice network access the same case files.

1. "Choose Network Location" → native folder picker (user navigates to mapped network drive)
   - Common paths: `\\SERVER\Psygil\` (Windows), `/Volumes/PracticeShare/Psygil/` (macOS)
2. App validates:
   - Network path is accessible and writable
   - Sufficient disk space (minimum 2GB for practice)
   - Path is actually a network location (warns if local path selected — "This appears to be a local folder. For shared access, choose a location on your network drive.")
   - SQLite WAL mode compatibility test (creates temp database, writes from current machine, verifies journal mode)
3. App creates project root directory structure at network path
4. SQLCipher database created on the network share
   - Database encryption key generated and displayed ONCE to the admin: "Save this key securely. Each provider workstation will need it during their setup."
   - Key is a 32-character base64 string
   - Admin can also export the key as a QR code (for easy entry on other machines)
   - Key is stored in this machine's OS keychain (Electron safeStorage)

**Shared Drive Topology:**
```
\\SERVER\Psygil\              ← Network share (all machines access this)
├── .psygil/
│   ├── psygil.db             ← Shared SQLCipher database (WAL mode)
│   ├── config.json                ← Practice-level configuration
│   └── audit.log                  ← Shared audit trail
├── cases/
│   ├── 2026-0147_M.Johnson/
│   └── .../
├── templates/
└── resources/
```

**Option B: Cloud Storage (Enterprise tier)**

For practices needing remote access or multi-location deployment.

1. "Choose Cloud Provider" → Microsoft 365 or Google Workspace
2. **Microsoft 365 flow:**
   - "Sign in with Microsoft" → OAuth via MSAL (opens system browser for auth)
   - Admin grants Psygil permission to read/write SharePoint document library
   - App creates a dedicated SharePoint document library: "Psygil Cases"
   - Admin selects which SharePoint site hosts the library
3. **Google Workspace flow:**
   - "Sign in with Google" → OAuth (opens system browser for auth)
   - Admin grants Psygil Drive access
   - App creates a shared drive: "Psygil Cases"
4. Hybrid storage confirmation:
   - "Your case documents will be stored in [SharePoint/Google Drive]. Each provider's local machine will keep an encrypted database for settings, cache, and offline access. The AI pipeline always runs locally — PHI is never sent to the cloud."
5. BAA verification prompt:
   - "Does your organization have a Business Associate Agreement (BAA) with [Microsoft/Google]?"
   - If Yes: proceed
   - If No: warning — "A BAA is required for HIPAA-compliant cloud storage of PHI. Contact [Microsoft/Google] to establish a BAA before storing patient data in the cloud. You can proceed with setup, but do not create cases with real patient data until the BAA is in place."
   - If Unsure: "Check with your compliance officer. You can complete setup now and add cases after the BAA is confirmed."

**Option C: Local-Only (Practice license, optional)**

A practice can choose local-only storage even with a multi-user license. Each provider has their own local database with no shared access. This is useful for practices where each clinician maintains their own caseload independently.

- Proceeds identically to Path A, Step 3
- Each provider's machine has its own independent project root
- No case sharing, no collaborative workflows
- Note: "Your providers will each have separate, independent case databases. Cases cannot be shared between providers. If you need shared access later, you can migrate to a network drive from Settings."

### Step B6: AI Configuration

Same as Step 5 in Path A, but with one key difference:

**Practice-wide API key vs. Per-provider keys:**

"How should AI access be managed?"

- **Option A: Practice API Key (recommended)** — One API key for the entire practice. All providers share the same key. Billing goes to one account. The admin enters and manages the key.
  - Advantage: simpler billing, one key to rotate, admin controls AI spend
  - Disadvantage: can't track per-provider AI usage for cost allocation

- **Option B: Per-Provider Keys** — Each provider enters their own API key during their individual setup. The practice does not manage AI keys centrally.
  - Advantage: per-provider cost tracking, individual key rotation
  - Disadvantage: each provider must obtain and manage their own key

If Practice API Key is selected: API key is stored in the shared `config.json` (encrypted). All provider workstations use this key.

If Per-Provider Keys is selected: AI configuration is deferred to each provider's individual setup (Phase 2).

UNID pipeline test runs regardless of which option is chosen.

### Step B7: Role & Permissions Configuration

**What the user sees:** "Configure roles for your practice."

**Default roles (pre-configured, editable):**

| Role | Case Access | Can Edit Reports | Can Sign Reports | Can Manage Users | Can Configure Settings |
|------|------------|-----------------|-----------------|-----------------|----------------------|
| Psychologist | Own cases + assigned | Yes | Yes | No | Own preferences only |
| Psychometrist | Assigned testing only | Testing sections only | No | No | No |
| Receptionist | Case list (names, dates) | No | No | No | No |
| Admin | All cases | Yes | No (unless also Psychologist) | Yes | Yes |
| Supervising Psychologist | All cases | Yes | Yes + countersign | Yes | Yes |

The admin can:
- Modify default permissions per role
- Create custom roles (e.g., "Intern" — view assigned cases, edit under supervision, no signing authority)
- Set case assignment rules (auto-assign by eval type, manual only, round-robin)

**What happens behind the scenes:**
1. Roles table populated in SQLCipher
2. Default permissions matrix stored
3. Case assignment rules written to config

### Step B8: Appearance & Defaults

Same as Step 6 (Path A), but these become practice-wide defaults. Individual providers can override theme and font preferences in their own setup.

### Step B9: Clinical Configuration (Practice Defaults)

Same as Step 7 (Path A), but configured as practice-wide defaults:
- Which eval types does this practice perform?
- Which instruments does this practice have licenses for?

Individual providers can further customize (add types from their sub-specialty, remove instruments they don't use), but they cannot add instruments the practice hasn't licensed.

### Step B10: Completion — Admin Setup Done

**What the admin sees:**

```
Practice setup complete.

✓ Storage: \\SERVER\Psygil\ (Network Share, encrypted)
✓ AI: Claude Sonnet 4 (Practice key, UNID pipeline verified)
✓ Practice: Forensic Psychology Associates, LLC
✓ Roles: 4 configured (Psychologist, Psychometrist, Receptionist, Admin)
✓ Eval Types: 8 configured
✓ Instruments: 18 in practice library
✓ License: Practice (5 seats) — 0 of 5 providers onboarded

Next: Add your providers.
```

**Two buttons:**
- "Add Provider Now" → goes to Phase 2 on this machine
- "Generate Provider Setup Instructions" → creates a printable/emailable instruction sheet with:
  - Download link for Psygil installer
  - Practice license key
  - Database encryption key (for shared drive) or cloud sign-in instructions
  - Provider setup code (a short-lived 8-digit code the provider enters during their setup to link their workstation to this practice)

---

## Phase 2: Provider Onboarding (Per-Provider Setup)

This happens on each provider's individual workstation. The practice admin has already completed Phase 1. The provider is a clinician who will use the app daily.

### Step P1: Installation

Same as Step 1 (identical installer for all users).

### Step P2: License & Practice Linking

**What the provider sees:** "Welcome to Psygil. Are you setting up a new practice or joining an existing one?"

- **"New practice"** → Path A (solo) or Path B Phase 1 (admin setup)
- **"Join existing practice"** → Proceeds here

**Linking flow:**
1. Provider enters the practice license key (shared by admin)
2. Provider enters the provider setup code (8-digit, time-limited — valid 72 hours after generation)
3. App validates both against the license server
4. License server returns: practice name, storage mode, remaining seats
5. If seats available: proceed. If not: "All seats in this license are in use. Contact your practice administrator."

### Step P3: Storage Connection

**What happens depends on storage mode:**

**If Network Share:**
1. "Enter the network path to your practice's Psygil folder"
   - Pre-filled if discoverable via network browse
   - Provider navigates to the shared folder
2. "Enter the database encryption key"
   - Text field or QR code scanner (phone camera → screen scan)
3. App verifies:
   - Can read/write the network path
   - Encryption key unlocks the shared SQLCipher database
   - Database contains the expected practice configuration
4. App stores the encryption key in this machine's OS keychain
5. Provider's workstation is now connected to the shared practice

**If Cloud:**
1. "Sign in with [Microsoft/Google]"
   - OAuth flow in system browser
   - Provider signs in with their own work account (not the admin's account)
2. App verifies the provider's account has access to the Psygil SharePoint library / shared drive
3. Local SQLCipher database created on this machine (cache + settings)
4. Cloud sync initialized — existing cases begin downloading metadata (not full documents — those download on demand)

**If Local-Only (practice chose independent local storage):**
1. Standard local folder selection (same as Path A, Step 3)
2. Independent database created — no shared access

### Step P4: Provider Profile

**What the provider sees:** "Set up your provider profile."

**Fields:**

| Field | Required | Source |
|-------|----------|--------|
| Full Name | Yes | Manual entry |
| Credentials | Yes | Manual entry (e.g., "Ph.D.", "Psy.D., ABPP") |
| License Number | Yes | Manual entry |
| License State | Yes | Dropdown (may differ from practice state for multi-state providers) |
| Role | Pre-assigned | Set by admin during Phase 1 or provider code generation. Displayed but not editable by provider. |
| Specialty | Yes | Dropdown — may narrow from practice defaults |
| Authentication | Required | Create local password (min 12 chars). This is the provider's login password on this workstation. |

**What happens behind the scenes:**
1. Provider record created in shared SQLCipher `users` table
2. Password hashed with Argon2id, stored locally
3. Provider linked to practice organization
4. Seat count incremented on license server
5. Audit trail: "Provider onboarded: [name], role: [role]"

### Step P5: AI Configuration (if per-provider keys)

If the practice chose per-provider API keys in Step B6:
- Provider enters their own API key
- UNID pipeline test runs on this machine
- Key stored in this machine's OS keychain

If the practice uses a shared API key:
- This step is skipped. Provider's machine uses the practice key from shared config.
- UNID pipeline test still runs on this machine (verifies the local Python sidecar works)

### Step P6: Personal Preferences

**What the provider sees:** Subset of Steps 6-7 from Path A, scoped to personal overrides:

- Theme preference (override practice default)
- Font size (override practice default)
- Eval types (can deselect practice types they don't perform, cannot add types the practice hasn't configured)
- Instrument library (can deselect instruments they don't use, cannot add instruments the practice hasn't licensed)
- Notification preferences (case assignment alerts, deadline reminders, review requests)

### Step P7: Completion — Provider Ready

```
You're all set, Dr. [Name].

✓ Practice: Forensic Psychology Associates, LLC
✓ Role: Psychologist
✓ Storage: Connected to \\SERVER\Psygil\
✓ AI: Claude Sonnet 4 (UNID pipeline verified)
✓ Eval Types: 5 active
✓ Instruments: 12 in your library

You have 0 assigned cases. Your practice administrator can assign cases to you,
or you can create new cases from the Dashboard.
```

---

## Login Flow (Subsequent Launches)

After setup is complete, subsequent application launches follow this flow:

### Solo Practitioner
1. App launches → Python sidecar starts → OnlyOffice starts
2. **No login screen.** The solo practitioner is the only user. App opens directly to Dashboard.
3. If the user wants session-level security: configurable in Settings → "Require password on launch" (off by default for solo, since the machine itself should be locked when unattended)

### Shared Practice
1. App launches → Python sidecar starts → OnlyOffice starts
2. **Login screen appears:**
   - Provider name (dropdown of configured providers on this machine, or type-to-search for large practices)
   - Password field
   - "Forgot password" → contact practice administrator (admin can reset)
3. Successful login → Dashboard filtered to provider's assigned cases + cases with their role access
4. Session timeout: configurable by admin (default 30 minutes idle → lock screen, not full logout)
5. "Switch User" option in titlebar user menu → returns to login screen without quitting the app

### Cloud Practice
Same as Shared Practice login, plus:
1. If cloud OAuth token has expired: "Sign in with [Microsoft/Google]" re-authentication prompt
2. Sync status check on login: downloads any case metadata changes since last session
3. Offline mode: if network unavailable, app starts with cached data + warning banner "Working offline — changes will sync when connection is restored"

---

## Setup State Machine

The setup wizard tracks its progress so it can resume if interrupted (app quit, crash, power loss):

```
STATES:
  fresh           → No setup attempted. First launch.
  license_entered → License validated, tier determined.
  storage_ready   → Project root created, database initialized.
  profile_done    → Practitioner/admin profile configured.
  ai_configured   → API key validated, UNID pipeline tested. (or explicitly skipped)
  prefs_done      → Appearance and clinical prefs saved.
  complete        → Setup finished. Normal launch from now on.

RESUME BEHAVIOR:
  On launch, read config.json setup_state.
  If not "complete", open setup wizard at the appropriate step.
  All previously entered data is preserved — the user doesn't re-enter anything.
```

---

## Settings → Reconfiguration

Every setup decision is changeable after initial setup via Settings. The Setup wizard in the titlebar reopens the same flow but pre-populated with current values. Changes take effect immediately except:

- **Storage location change:** Triggers a migration wizard. "Move all cases from [old location] to [new location]?" Progress bar, file copy, database migration, verification, then swap.
- **API key change:** New UNID pipeline test required before the new key is active.
- **Adding a provider (Practice):** Admin generates a new provider setup code from Settings → Users → "Add Provider."
- **Removing a provider (Practice):** Admin deactivates the provider. Their cases are reassigned or archived. Seat freed on license server.
- **Storage mode upgrade:** Local → Network Share, or Network Share → Cloud. Migration wizard handles data movement. This is the upsell path from Solo to Practice to Enterprise.

---

## Security Invariants Across Both Paths

1. **Database encryption key never in plaintext on disk.** Stored in OS keychain (Electron safeStorage) on every machine.
2. **Passwords hashed with Argon2id.** Never stored in reversible form.
3. **API keys in OS keychain.** Not in config files, not in the database.
4. **UNID pipeline must pass before AI features activate.** Hard gate — no exceptions.
5. **Python sidecar must be healthy before app is usable.** No degraded mode without the PII pipeline.
6. **Audit trail starts at setup.** Every setup decision is logged. Every login is logged. Every case action is logged.
7. **Cloud sync never includes the SQLCipher database.** The database is always local. Only case document files sync to cloud.
8. **Provider setup codes are time-limited (72 hours) and single-use.** Cannot be reused to onboard additional providers.

---

## Relationship to Existing Documents

| Document | Connection |
|----------|-----------|
| Doc 09 (Shared Storage Architecture) | Storage configuration steps implement the three-tier model |
| Doc 15 (UNID Redaction Architecture) | UNID pipeline verification is a hard gate in AI configuration |
| Doc 16 (Case Directory Schema) | Storage configuration creates the directory structure defined here |
| Doc 02 (IPC API Contracts) | Setup invokes IPC channels for sidecar health, database creation, file operations |
| Doc 03 (HIPAA Safe Harbor) | UNID pipeline test validates Safe Harbor compliance during setup |
| Doc 12 (Intake/Onboarding Spec) | "Create First Case" button launches the intake flow defined here |
