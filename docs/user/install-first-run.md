# Install and First Run

What this covers: step-by-step installation of Psygil on macOS (arm64) from the v1.0 RC1 build, the three-field first-run dialog, post-setup configuration in Settings, and creating your first case.

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

## Step 4: First-run setup (three fields)

On first launch Psygil opens a single dialog asking for three values. Everything else is optional and lives in Settings.

**Field 1: Your name.** Used as the stamp on every clinical decision and on report signature lines. Enter it the way you want it to appear on evaluations, including credentials if you want them in the byline (for example, `Dr. Robert Irwin, Psy.D.`).

**Field 2: License key.** Provided by Foundry SMB at purchase. The app validates locally first, then contacts `licenses.psygil.com` if online. Offline validation works for 30 days; after that the app requires a one-time online check.

**Field 3: Local storage folder.** Click `Browse...` to pick the folder where your case files will live. Default is `~/Documents/Psygil Cases/`. In portable mode the default is inside the Psygil-Data sibling of the .app. The picker validates:
- Path is writable.
- Disk has at least 500 MB free.
- Path is NOT a cloud-synced folder (Dropbox, iCloud, OneDrive, Google Drive). Cloud folders cause sync conflicts and are blocked for v1.0. Use a local-only folder; shared-drive or team configurations are set up post-first-run in Settings.

Click `Get started`. Psygil validates the license, saves it, provisions the storage folder structure (`cases/`, `Archive/`, `_Resources/`, templates), saves your name, and finalizes setup. No browser round trip, no Auth0 redirect.

Total time: under 30 seconds on a warm machine.

## Step 5: Post-setup configuration (optional, in Settings)

After the first-run dialog closes you land in the main app shell. Everything you skipped is available from `Settings` in the top toolbar:

**AI configuration** (`Settings > AI`)
- Paste your Anthropic API key (starts with `sk-ant-`); stored in the macOS Keychain via safeStorage, never in plain files.
- Click `Test connection`. On success, see the estimated token cost for the chosen model.
- Model selection: default `claude-sonnet-4-20250514`. Opus for deeper reasoning, Haiku for faster and cheaper workflows.

**Appearance** (`Settings > Appearance`)
- Four themes: Light, Warm (cream), Medium (gray), Dark.
- Form inputs and the report preview stay white regardless of theme, so what you write is always readable.

**Clinical preferences** (`Settings > Clinical`)
- Primary evaluation type (CST, Custody, Risk Assessment, Parenting Time, Sanity, Fitness for Duty, Other).
- Jurisdiction (state / territory).
- Default test battery.

**Templates** (`Settings > Templates`)
- A starter set of `.docx` templates with placeholder tokens (`{{PATIENT_NAME}}`, `{{EVAL_TYPE}}`, `{{SIGNATURE_LINE}}`) is provisioned on first run.
- `Preview` opens any template in your default .docx viewer.
- `Reveal in Finder` jumps to the templates folder for deeper customization.
- See `docs/user/templates.md` for the token syntax.

**Shared storage / team account** (`Settings > Team`, post-v1.0)
- Psygil v1.0 is single-practitioner by design. Team mode (Auth0 sign-in, shared SQLCipher database over a network share, cloud sync) lands in v1.1.
- The Team tab in Settings shows "Available in v1.1" for now.

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
| Sidecar load hangs past 30 seconds | Quit the app, run `ps aux \| grep psygil-sidecar` to check for a stuck process, `kill` it if present, relaunch. |
| First-run dialog reappears every launch | Psygil cannot write to its userData directory, so setup completion is not persisting. In portable mode, check the `.psygil-portable` folder has write permissions. In standard mode, check `~/Library/Application Support/Psygil/`. |
| "Workspace locked by PID X" on second launch | Another Psygil is already running or crashed leaving a stale lock. Quit the other instance, or if the PID is dead the lock auto-recovers after about 10 seconds. |
| White screen after clicking Get started | Typically a renderer crash. Quit and relaunch; the main-process stdout contains the diagnostic. For persistent crashes, file a support ticket with the log from Console.app. |
| License validation fails offline | First-run requires one successful online validation to activate. Connect to the internet, re-enter the license, and the app caches the result for 30 days of offline use afterward. |
| "Cloud-sync folder not supported" | You picked Dropbox, iCloud Drive, OneDrive, or Google Drive. Pick a local-only folder instead. Team / shared storage arrives in v1.1. |

## See also

- [quick-start.md](./quick-start.md) for a condensed version
- [hipaa.md](./hipaa.md) for security architecture
- [troubleshooting.md](./troubleshooting.md) for ongoing operation
