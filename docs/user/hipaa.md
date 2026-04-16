# HIPAA and Data Security

What this covers: how Psygil handles PHI, what leaves your workstation, what stays local, and what the audit trail records.

---

## Local-First Architecture

Psygil stores all case data on your local workstation in an encrypted database. PHI never leaves your machine unless you explicitly export a finished report.

The only network activity is: license key validation (re-validation every 30 days, offline mode available); API calls to your AI provider when you explicitly run an agent (de-identified before transmission, see below); and software update checks (version number only). Solo practitioners on a local installation have no cloud dependencies.

---

## UNID Redaction: How PHI Is Protected During AI Calls

Before any text is sent to the AI API, Psygil's local Python sidecar runs a de-identification pipeline. The pipeline detects all 18 HIPAA Safe Harbor identifiers using Presidio and spaCy, then replaces each one with a temporary opaque code called a UNID (Unique Non-Identifying Descriptor).

**Example:**

```
Original:     "Marcus Johnson, DOB 04/22/1985, was evaluated at 1234 Grant St."
Sent to API:  "PERSON_a7f3c2, DOB_9f1b44, was evaluated at ADDRESS_cc3d12."
```

The API returns output with UNIDs intact. The sidecar rehydrates the response, replacing each UNID with the original PHI, and destroys the UNID map. A second rehydration with the same operation ID returns nothing. UNID maps are single-use and verified end to end during setup before AI features activate.

UNIDs are non-reusable across operations. The same patient name generates a different UNID each time, so multiple API payloads cannot be linked to the same patient.

What does NOT get redacted (these are sent to the API as-is):
- Clinical content: symptoms, history, diagnostic criteria, formulation
- Legal context: charges, referral questions, court orders
- Age as an integer (date of birth is redacted; age is not)
- Gender
- State-level geography
- Evaluation type and referral source type

The final signed report contains full PHI and is never redacted. Redaction applies exclusively at the AI transmission boundary.

---

## Database Encryption

All case data is stored in a SQLCipher-encrypted database at `{workspace}/.psygil/psygil.db`. SQLCipher is an open-source fork of SQLite that applies AES-256 encryption to every page of the database file.

The encryption key is a 256-bit random key stored in your OS keychain via Electron's `safeStorage` API (system Keychain on macOS, Credential Manager on Windows). It is never written to any config file. API keys are stored in the same mechanism and are not in the database or any config file.

---

## Audit Trail

Every significant action in Psygil is recorded in the audit trail: case creation, stage advancement, document upload, agent invocations, diagnostic decisions (each one individually), report generation, and report signing.

Each row records the action type, actor, timestamp, and a SHA-256 hash computed from the row's content plus the prior row's hash. Any modification to a past row breaks the chain. Verify chain integrity via Settings > Audit > Verify Chain Integrity.

To export: open the case, click the Audit Trail tab, then Export Audit Trail. The export is a CSV with all rows and hash values.

---

## Wipe Log

If you use Settings > Danger Zone > Wipe All Local Data, Psygil performs a full local data wipe. Before any destructive action, it writes a `wipe_log.json` file to the application data directory. This file records who initiated the wipe, when, and from which machine. The wipe log survives the wipe. The database is zero-filled then deleted. API keys and config files are removed.

The wipe log is a HIPAA accountability artifact. It documents that data was intentionally destroyed, who authorized it, and when. Retain this file per your jurisdiction's record retention requirements.

---

## BAA Requirements

A Business Associate Agreement (BAA) is a contract between your practice and a service provider that handles PHI on your behalf.

**Solo tier (local only):** No cloud services are involved. No BAA is required. All PHI stays on your workstation.

**Practice and Enterprise tiers with cloud storage:** If you configure Microsoft 365 (SharePoint) or Google Workspace (Drive) as the storage backend, those services handle documents containing PHI. HIPAA requires a BAA with Microsoft or Google before storing PHI there.

- Microsoft's BAA for Microsoft 365: available through the Microsoft Online Services Terms.
- Google Workspace BAA: available through the Google Workspace Admin console.

Psygil will prompt you to confirm a BAA is in place when configuring cloud storage. You can complete setup before the BAA is finalized, but do not create cases with real patient data until the BAA is active.

**AI API providers:** The AI API (Anthropic or OpenAI) receives only de-identified text. UNIDs, not PHI, cross the API boundary. Whether a BAA is required for this use depends on your compliance interpretation. Consult your compliance officer. If you prefer a conservative position, both Anthropic and OpenAI offer BAAs for healthcare customers.

**Foundry SMB:** If you have a direct services engagement with Foundry SMB for support or implementation, a BAA is available on request. Contact support for details.

---

## See Also

- [ai-assistant.md](./ai-assistant.md): Detailed explanation of the UNID pipeline and what each agent transmits
- [walkthrough.md](./walkthrough.md): Stage 3 audit trail entries for diagnostic decisions
- [troubleshooting.md](./troubleshooting.md): What to do if the UNID pipeline fails
