# Troubleshooting

What this covers: solutions to the most common problems in Psygil v1.0, organized by symptom.

---

## Sidecar Won't Start

**Symptom:** On launch, you see a diagnostic screen instead of the setup wizard or dashboard. The message references "sidecar" or "Python."

Psygil bundles a local Python 3.11 process for the Presidio and spaCy PHI detection pipeline. The app cannot start without it.

**Resolution steps:**

1. The official `.dmg` or `.exe` installer includes the runtime. If you installed from source, Python 3.11 is required (spaCy needs `thinc>=8.3.12`, which requires 3.11+; 3.9 and 3.10 do not work).

2. To rebuild the sidecar virtual environment, run:
   ```
   cd {repo_root}/sidecar
   ./setup-dev-venv.sh
   ```
   This creates `.venv/`, installs `requirements.txt`, and downloads `en_core_web_lg`. Allow several minutes for the download.

3. Relaunch Psygil. The startup health check re-tests the sidecar automatically.

4. If the sidecar starts but fails the health check, review the diagnostic screen. Common causes: insufficient disk space, or a security policy blocking the Python binary.

---

## OnlyOffice Won't Load

**Symptom:** Clicking on a document in the folder tree shows a blank editor or an "editor unavailable" message.

**Status:** The embedded OnlyOffice Document Editor is deferred to v1.1. In Psygil v1.0, documents open in read-only preview mode. Full in-app editing (formatting, tracked changes, comments) is not available in this release.

**Workaround:** Export the document using File > Export, edit it in Microsoft Word or LibreOffice, and re-import. Imports update the document in the case folder and trigger a re-index.

---

## License Says Invalid

**Symptom:** License activation fails with "invalid license key" or "license not found."

**Resolution steps:**

1. Verify the key against your purchase email (format: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`). Copy-paste to avoid transcription errors.

2. Check your internet connection. License validation requires one HTTPS call. A network issue produces "unable to reach server," distinct from "invalid key." Use the deferred activation option if offline; the grace period is 14 days.

3. Exceeding the seat count for your tier produces "no seats available." Contact support to transfer or add seats. Solo-tier licenses bind to one machine; moving to a new workstation requires a seat transfer.

4. If none of the above applies, contact support with your license key and the exact error message.

---

## Case Folder Appears Twice

**Symptom:** A case appears twice in the case list, or the folder tree shows duplicate entries.

**Cause:** The file watcher pairs rename events to detect folder moves. Rapid successive renames (common when sync software touches folders) can cause it to register two folders instead of one.

**Resolution:**

1. Rename the duplicated folder back to its original name. The folder is at `{workspace}/cases/{case_folder_name}/`.
2. Restart Psygil. The watcher re-scans on launch.
3. If the duplicate persists, open `case.json` in both folders and compare the `id` field. If identical, delete the folder that lacks a `report/` or `diagnostics/` subdirectory.

---

## Workspace Locked Message

**Symptom:** Psygil shows "This workspace is locked by another instance" on launch.

Psygil writes a `.psygil-lock` file to the workspace root to prevent two instances from writing to the same database.

**Resolution:**

1. Check whether another Psygil instance is running (Dock, taskbar, or Task Manager / Activity Monitor). Close it and relaunch.

2. If no other instance is running, the lock is stale (left from a crash). Psygil checks the recorded PID; if that process is dead, the lock is removed automatically on the next launch. Wait a few seconds and retry.

3. If the lock persists, delete `{workspace}/.psygil-lock` manually, then relaunch. Safe when no other Psygil instance is running.

---

## Report Export Shows Empty Sections

**Symptom:** Generating a draft report produces a document where one or more sections are blank or show only the placeholder text.

**Resolution:**

1. Confirm the Ingestor has run on all documents and the case record is complete: required intake fields, at least one scored test, interview notes with a Mental Status Exam.

2. Confirm the Diagnostician has run and at least one diagnosis has a `confirmed` decision (or "No diagnosis" is documented). The Writer cannot populate Clinical Formulation or Opinion without this.

3. Check `revision_notes` on any empty section; the note identifies which data is missing.

4. If data looks complete but sections are still blank, re-run the Writer. Transient API errors can produce partial drafts. Check that your API key is valid and that you have not hit your provider's rate limit.

---

## Opening a Support Ticket

The support address is in your license confirmation email and in Help > About Psygil. Include: Psygil version, OS version, the exact error message, and whether the issue affects one specific case or all cases. Response times for v1.0 are in your license agreement.

---

## See Also

- [quick-start.md](./quick-start.md): Setup wizard steps, including AI and sidecar configuration
- [hipaa.md](./hipaa.md): Wipe log and UNID pipeline details
- [ai-assistant.md](./ai-assistant.md): What to do when an agent call returns incomplete output
- [walkthrough.md](./walkthrough.md): Stage requirements and advancement conditions
