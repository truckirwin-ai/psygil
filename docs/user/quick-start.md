# Quick Start

What this covers: installing Psygil, completing the three-field first-run dialog, and creating your first case. For the detailed version with every option explained, see [install-first-run.md](./install-first-run.md).

---

## Install the Application

Download the installer for your platform from your Foundry SMB distribution link.

- **macOS arm64 (.dmg):** Open the disk image and drag Psygil.app to any folder: Applications, ~/Applications, Desktop, a USB stick, or a project directory. The app does not require Applications. For v1.0 RC1 (unsigned), right-click the app and choose Open on first launch to bypass Gatekeeper; see the detailed doc for the one-time command that avoids this.
- **macOS portable install (.zip):** Unzip anywhere and optionally create an empty file named .psygil-portable next to the .app to make the install self-contained. Psygil then stores all case data in a sibling Psygil-Data folder instead of ~/Library/Application Support.
- **Windows (.exe):** Run the installer and pick any install directory. Per-user install, no admin rights required.

The installer is a complete offline package. The Python sidecar ships as a frozen binary; you do not need Python installed. AI features require a separate Anthropic API key, configured during setup.

Before the first-run dialog appears, Psygil verifies its sidecar process. The sidecar takes 5 to 10 seconds to boot on first launch. If it fails, the dialog shows specific remediation; see [troubleshooting.md](./troubleshooting.md).

---

## First-Run Setup

A single dialog appears on first launch with three fields. Everything else is optional and available in Settings afterward.

### Field 1: Your Name

The name used as the stamp on every clinical decision and on report signature lines. Enter it the way you want it to appear on evaluations, including credentials if desired (for example, `Dr. Robert Irwin, Psy.D.`). Editable later in Settings.

### Field 2: License Key

Enter the key delivered by Foundry SMB at purchase. The app validates locally first, then contacts `licenses.psygil.com` if online. Offline validation works for 30 days after the first successful online check.

### Field 3: Local Storage Folder

Click Browse to pick the folder where your case files will live.

- The default is `~/Documents/Psygil Cases/` on macOS. In portable mode, the default is inside the `Psygil-Data` sibling next to the .app.
- The app requires at least 500 MB of free space and write permissions.
- Cloud-sync folders (iCloud Drive, OneDrive, Dropbox, Google Drive) are not supported for v1.0. Cloud sync can corrupt the encrypted database file. Use a local-only folder.
- Team and shared-storage configurations are set up after first run in Settings.

The app creates an encrypted SQLCipher database at this location. The encryption key is stored in your OS keychain and never written to disk in plain text.

Click Get Started. Psygil validates the license, provisions the storage folder structure, saves your name, and finalizes setup in under 30 seconds.

---

## Post-Setup Configuration (Optional)

After the first-run dialog closes you land in the main app shell. Everything that was skipped is available from Settings in the top toolbar:

- **Settings > AI**: paste your Anthropic API key (stored in the macOS Keychain). Click Test connection to verify and see cost estimates.
- **Settings > Appearance**: pick from four themes (Light, Warm, Medium gray, Dark). Form inputs and the report preview stay white regardless.
- **Settings > Clinical**: primary evaluation type, jurisdiction, default test battery.
- **Settings > Templates**: preview, edit, or upload `.docx` report templates. Seven templates ship by default (CST, Custody, Risk Assessment, Fitness for Duty, PTSD Dx, ADHD Dx, Malingering).
- **Settings > Team**: shared storage and team-account setup. Available in v1.1.

---

## Create Your First Case

From the Dashboard, click New Case in the upper right. A modal opens with these fields:

- **Patient name** (required)
- **Date of birth** (required)
- **Evaluation type** (required, dropdown filtered to your configured types)
- **Referral source**
- **Case number** (auto-generated if left blank)
- **Complaint or referral question**

Click Create. The case opens at Stage 0: Onboarding. The left panel shows the case folder tree; the center panel shows the Clinical Overview.

Fill in the intake form by clicking on Intake in the folder tree. Upload at least one document (referral letter, prior evaluation, or consent form) by clicking the Upload button in the toolbar. When intake is complete, use the Advance Stage button at the top of the Clinical Overview to move the case to Testing.

---

## What to Do Next

See [walkthrough.md](./walkthrough.md) for a complete explanation of all six pipeline stages and what each one requires.

---

## See Also

- [install-first-run.md](./install-first-run.md): Detailed installation, portable mode, and the three-field first-run dialog with Settings follow-up
- [walkthrough.md](./walkthrough.md): The six-stage clinical pipeline in detail
- [templates.md](./templates.md): Uploading and customizing report templates
- [ai-assistant.md](./ai-assistant.md): What the AI agents do and how to use them
- [troubleshooting.md](./troubleshooting.md): Common problems and solutions
