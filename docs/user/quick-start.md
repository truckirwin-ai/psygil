# Quick Start

What this covers: installing Psygil, completing the setup wizard, and creating your first case.

---

## Install the Application

Download the installer for your platform from psygil.com.

- **macOS (.dmg):** Open the disk image and drag Psygil to your Applications folder. On first launch, macOS Gatekeeper will prompt you to confirm the application is from an identified developer. Click Open to proceed.
- **Windows (.exe):** Run the installer and follow the standard wizard. The application installs to `C:\Program Files\Psygil\` and registers in Add/Remove Programs.

The installer is a complete offline package. No internet connection is required for installation. AI features require a separate API key, configured during setup.

Before the setup wizard appears, Psygil silently verifies its Python sidecar process. If the sidecar fails to start, you will see a diagnostic screen rather than the wizard. See [troubleshooting.md](./troubleshooting.md) for resolution steps.

---

## Setup Wizard

The wizard runs once on first launch. It has eight steps. All choices can be changed later in Settings.

### Step 1: License Activation

Enter the 25-character license key delivered by email at purchase. The app contacts the Psygil license server once to validate the key, then stores a token locally. If you are offline, you may defer validation; the grace period is 14 days.

### Step 2: Storage Location

Choose where Psygil stores your case files.

- The default location is `~/Documents/Psygil/` on macOS or `C:\Users\{username}\Documents\Psygil\` on Windows.
- To use a different folder, click Choose Folder and select a local directory. The app requires at least 500 MB of free space and write permissions.
- Avoid placing the workspace inside iCloud Drive, OneDrive, Dropbox, or Google Drive. The app will warn you if it detects a cloud-sync path. Cloud sync can corrupt the encrypted database file. If you need remote access, upgrade to a Practice or Enterprise license, which uses Psygil's built-in cloud storage.

The app creates an encrypted SQLCipher database at this location. The encryption key is stored in your OS keychain and never written to disk in plain text.

### Step 3: Practice Information

Enter your name, credentials, license number, and license state. These values populate report signature blocks and letterhead. Practice name, address, phone, and a logo are optional but appear in report headers if provided.

Select your specialty from the dropdown. This pre-selects evaluation types and instrument libraries in the next step.

### Step 4: AI Configuration

This step is optional. If you skip it, all AI-assisted features are disabled, but manual report editing works fully.

To enable AI features, select a provider (Anthropic is recommended; OpenAI is also supported), choose a model, and enter your API key. The app stores the key in the OS keychain only; it is never written to config files or logs.

After you enter a key, click Test and save. The app:
1. Stores the key in the keychain.
2. Sends a minimal test prompt with no patient data to verify connectivity.
3. Runs a full UNID redaction pipeline test to confirm that PHI de-identification works end to end before any real data is processed.

If the pipeline test fails, the key is not activated. The app explains what went wrong. You can skip AI configuration and return later via Settings.

### Step 5: Appearance

Choose Light, Medium, or Dark theme. Adjust font size and sidebar default. These are personal preferences with no effect on data or compliance.

### Step 6: Clinical Preferences

Check the evaluation types you perform and the instruments you have access to. These selections control which options appear in case creation and which report templates are preloaded. You can add or remove options at any time in Settings.

### Step 7: Templates

The app provisions report templates based on your selected evaluation types. Seven templates ship with v1.0 (CST, Custody, Risk Assessment, Fitness for Duty, PTSD Dx, ADHD Dx, Malingering). You can upload your own templates later. See [templates.md](./templates.md) for details.

### Step 8: Completion

A summary screen confirms your configuration. Click Open Psygil to go to the Dashboard, or click Create First Case to go directly to a new case intake form.

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

- [walkthrough.md](./walkthrough.md): The six-stage clinical pipeline in detail
- [templates.md](./templates.md): Uploading and customizing report templates
- [ai-assistant.md](./ai-assistant.md): What the AI agents do and how to use them
- [troubleshooting.md](./troubleshooting.md): Common problems and solutions
