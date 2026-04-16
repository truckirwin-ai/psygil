# Install and First Run

What this covers: step-by-step installation of Psygil on macOS (arm64) from the v1.0 RC1 build, first-launch behavior, the setup wizard, and creating your first case.

## Before you start

You need:
- A Mac with Apple Silicon (M1, M2, M3, or M4). Intel support is deferred to v1.1.
- macOS 11.0 (Big Sur) or later.
- ~1 GB free disk space for the app and sidecar. Another 50 MB to 5 GB for cases depending on document volume.
- An Anthropic API key (sk-ant-...) for the AI agents.

You do NOT need:
- Python installed. The sidecar ships as a frozen binary.
- Homebrew.
- Administrator rights (per-user install).

## Step 1: Download

Download one of the two installers from your Foundry SMB distribution link:
- `Psygil-0.1.0-arm64.dmg` (550 MB) for the standard drag-to-Applications flow.
- `Psygil-0.1.0-arm64-mac.zip` (537 MB) for portable installs.

**RC1 is unsigned.** The first-launch Gatekeeper warning is expected. See step 3.

## Step 2: Install

### Option A: DMG to any folder

Double-click the .dmg. A disk image window opens. You can drag `Psygil.app` to:
- `/Applications` (the convention, shown as a shortcut in the DMG window)
- `~/Applications` (per-user install, no admin rights needed)
- Any other folder (Documents, Desktop, external drive, project directory)

Psygil does NOT require `/Applications`. The app works from any location.

### Option B: ZIP for portable install

Unzip the .zip wherever you want Psygil to live. Everything the app needs is inside the .app bundle.

**To enable portable mode** (cases and config live next to the app, not in `~/Library/Application Support`):

1. Place `Psygil.app` in its own folder, for example `~/Desktop/Psygil-Portable/`.
2. Create an empty file named `.psygil-portable` next to the `.app`:
   ```bash
   touch ~/Desktop/Psygil-Portable/.psygil-portable
   ```
3. Launch Psygil. On first run it creates `Psygil-Data/` in the same folder and stores everything there (database, config, Auth0 refresh token, API key, wipe log).

Portable mode is useful for:
- Running Psygil from a USB stick or external drive.
- Keeping all case data next to the app for easy migration between machines.
- Per-project installs where cases should not mix with another workspace.

To convert a portable install back to standard: quit Psygil, delete `.psygil-portable`, and move the contents of `Psygil-Data/` to `~/Library/Application Support/Psygil/`.

## Step 3: First launch (Gatekeeper bypass for RC1)

Because RC1 is unsigned, macOS Gatekeeper rejects the app by default. Two options:

### Option A: Right-click once

1. Right-click `Psygil.app`, choose `Open` from the context menu.
2. Click `Open` in the warning dialog.

macOS remembers this choice; subsequent launches work normally.

### Option B: Remove the quarantine attribute

```bash
xattr -dr com.apple.quarantine /path/to/Psygil.app
```

Replace the path with wherever you installed. After this, double-click works normally.

Signed builds (post Developer ID certificate acquisition) will not require either step.

## Step 4: Setup wizard

On first launch you go through an 8-step setup wizard. Progress is saved; you can quit and resume at any step.

### Step 1: Sidecar check

Psygil spawns the PyInstaller-frozen Python sidecar that handles PHI redaction. Expected behavior:
- 5 to 10 seconds of sidecar startup (spaCy model load).
- Green status: `sidecar ready, socket: /tmp/psygil-sidecar.sock`.

If the sidecar fails, the step shows specific remediation based on the error:
- `Python not found` -> you have an old build that expected system Python. Re-download the latest RC.
- `en_core_web_lg missing` -> the spaCy model was not bundled correctly. Reinstall.
- `socket already in use` -> another Psygil is running. Quit it or run `rm -f /tmp/psygil-sidecar.sock`.
- Unknown error -> Copy Diagnostic button puts the full stack on your clipboard for a support ticket.

### Step 2: License

Enter your license key (provided by Foundry SMB) or click `Start trial` for a 30-day evaluation. The app validates locally first, then contacts `licenses.psygil.com` if online. Offline fallback works for 30 days.

### Step 3: Storage

Pick the folder where your cases will live. Default is `~/Documents/Psygil Cases/`. In portable mode the default is `<install-dir>/Psygil-Data/cases/`.

The wizard validates:
- Path is writable.
- Disk has at least 500 MB free.
- Path is NOT a cloud-synced folder (Dropbox, iCloud, OneDrive, Google Drive). Cloud folders cause sync conflicts and are explicitly blocked. Use a local-only folder.

### Step 4: Practice information

Fill in your practice identity. Fields: practice name, your full name, NPI number (optional), primary address. These appear on generated reports, so use the spelling you want in your evaluations.

### Step 5: AI configuration

Paste your Anthropic API key (starts with `sk-ant-`). The key is stored in your macOS Keychain via `safeStorage`, never written to plain files.

Click `Test connection`. The app makes one minimal request to `https://api.anthropic.com/v1/messages` and reports:
- Success plus cost estimate ("Test cost: $0.0001") for the model you selected.
- Failure with specific error: invalid key, network issue, model not accessible.

Model selection: default is `claude-sonnet-4-20250514`. Opus for deeper reasoning, Haiku for faster and cheaper workflows.

### Step 6: Appearance

Choose one of four themes:
- `Light`: default, bright, for well-lit offices.
- `Warm`: cream palette, easier on the eyes for long sessions.
- `Medium`: medium gray with higher contrast, good for dim rooms.
- `Dark`: GitHub-style dark, for late-evening work.

Form inputs and the report preview stay white regardless of theme, so what you write is always readable.

### Step 7: Clinical preferences

Select your primary evaluation type (Competency to Stand Trial, Custody, Risk Assessment, Parenting Time, Sanity, Fitness for Duty, Other), your jurisdiction (state / territory), and your default test battery preferences. These drive template selection and evidence-map defaults for new cases.

### Step 8: Templates

The wizard provisions a starter set of report templates (.docx files with placeholder tokens like `{{PATIENT_NAME}}`, `{{EVAL_TYPE}}`, `{{SIGNATURE_LINE}}`). You can:
- Click `Preview` on any template to open it in your default .docx viewer.
- Click `Reveal in Finder` to jump to the templates folder and customize further.

Templates you add later appear automatically. See `docs/user/templates.md` for the token syntax.

### Step 9: Completion

Summary screen showing:
- Workspace path with `Reveal in Finder` button.
- Templates provisioned.
- API model selected.
- Theme applied.

Click `Finish` to land in the main app shell.

## Step 5: Create your first case

From the main shell:

1. Click `New Case` in the top toolbar.
2. The Intake modal opens. Fill in patient contact info (name, DOB, phone, email). Phone auto-formats as you type.
3. Add insurance details if relevant.
4. Click `Save and Continue`. The wizard creates the case folder structure (_Inbox, Collateral, Testing, Interviews, Diagnostics, Reports, Archive) on disk and inserts the case row.
5. Continue through Referral and Legal, Demographics and Family, Complaints, Medical and Substance, Recent Events tabs. Each Save persists to the local database.
6. After the 6-step onboarding finishes, the case advances from `Onboarding` to `Testing` stage.

You now have a case node in the left column with a real folder on disk.

## Next steps

- Read `docs/user/walkthrough.md` for the 6-stage pipeline: how to advance from Testing through Interview, Diagnostics, Review, and Complete.
- Read `docs/user/ai-assistant.md` to understand what each AI agent does (and what you are responsible for).
- Read `docs/user/hipaa.md` for the local-first architecture and BAA requirements.

## Troubleshooting first launch

| Symptom | Fix |
|---|---|
| `Psygil can't be opened because Apple cannot check it for malicious software` | Right-click the .app, choose Open, click Open in the dialog. Or run `xattr -dr com.apple.quarantine /path/to/Psygil.app`. |
| Sidecar step hangs past 30 seconds | Quit the app, run `ps aux \| grep psygil-sidecar` to check for a stuck process, `kill` it if present, relaunch. |
| Setup wizard restarts at step 1 every launch | Psygil cannot write to its userData directory. In portable mode, check the `.psygil-portable` folder has write permissions. In standard mode, check `~/Library/Application Support/Psygil/`. |
| "Workspace locked by PID X" on second launch | Another Psygil is already running or crashed leaving a stale lock. Quit the other instance, or if the PID is dead the lock auto-recovers after about 10 seconds. |
| White screen after setup wizard | Typically a renderer crash. Quit and relaunch; the main-process stdout contains the diagnostic. For persistent crashes, file a support ticket with the log from Console.app. |

## See also

- [quick-start.md](./quick-start.md) for a condensed version
- [hipaa.md](./hipaa.md) for security architecture
- [troubleshooting.md](./troubleshooting.md) for ongoing operation
