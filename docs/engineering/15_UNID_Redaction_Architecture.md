# UNID-Based PHI Redaction Architecture
## Psygil — Secure AI Transmission Protocol

**Document Version:** 1.0
**Created:** 2026-03-22
**Author:** Truck Irwin / Engineering
**Status:** Active — Architectural Principle
**References:** HIPAA Safe Harbor Validation (doc 03), Agent Prompt Specs (doc 03), IPC API Contracts (doc 02)

---

## Core Principle

**Reports are never redacted.** The final evaluation report contains full patient information — names, dates of birth, addresses, case numbers — because that's what gets filed with the court, sent to the referring attorney, or placed in the clinical record. Redaction applies exclusively at the AI transmission boundary.

**PHI never reaches the AI.** Every text payload sent to the LLM (Claude API) passes through the local UNID redaction pipeline first. The AI receives de-identified text, processes it, and returns output that references UNIDs. The local application then re-hydrates UNIDs back to real PHI before displaying or storing the result.

---

## What Is a UNID

A UNID (Unique Non-Identifying Descriptor) is a temporary, cryptographically random identifier that replaces a specific PHI element during a single AI transmission operation. UNIDs have three defining properties:

1. **Opaque** — A UNID carries no semantic information about the PHI it replaces. `PERSON_a7f3c2` tells the AI nothing about the patient's actual name.
2. **Temporary** — A UNID is valid for exactly one operation. Once the AI response is received and re-hydrated, the UNID mapping is discarded.
3. **Non-reusable** — Subsequent operations generate entirely new UNIDs, even for the same PHI elements. The same patient name gets a different UNID every time text is sent to the AI.

This prevents correlation attacks — even if an adversary captured multiple AI transmissions, the rotating UNIDs would not allow linking them to the same patient.

---

## Redaction Points

PHI redaction occurs at exactly two points in the clinical workflow. These are the only moments when case data leaves the local machine and reaches the AI.

### Redaction Point 1: Intake & Onboarding Cleanup

**When:** After the clinician completes the intake form and biopsychosocial history (onboarding), the raw text fields are sent to the Ingestor Agent for cleanup — fixing grammar, standardizing formatting, resolving abbreviations.

**What gets redacted:**
- Patient name → `PERSON_[unid]`
- Family/collateral names → `PERSON_[unid]` (each person gets a unique UNID)
- Dates of birth → `DOB_[unid]`
- Addresses → `ADDRESS_[unid]`
- Phone numbers → `PHONE_[unid]`
- SSN → `SSN_[unid]`
- Case/medical record numbers → `RECNUM_[unid]`
- All other Safe Harbor 18 identifiers per doc 03

**What does NOT get redacted:**
- Clinical content (symptoms, history, diagnoses)
- Legal context (charges, court orders, referral questions)
- Age (integer only, no DOB)
- Gender
- State-level geography (no sub-state)
- Evaluation type and referral source type

**Flow:**
```
Clinician types intake → Local app stores full-PHI version in SQLCipher
                        → UNID map generated (e.g., "Marcus Johnson" → PERSON_a7f3c2)
                        → Redacted text sent to Ingestor Agent
                        → Ingestor returns cleaned text with UNIDs intact
                        → Local app re-hydrates UNIDs → stores cleaned full-PHI version
                        → UNID map destroyed
```

### Redaction Point 2: Report Drafting

**When:** After testing is complete, the clinician has made all diagnostic decisions, and the case is ready for report writing. The full case record — demographics, test results, interview notes, collateral summaries, diagnostic formulation, clinical opinion — is sent to the Writer Agent to produce a draft report.

**What gets redacted:** Same 18 Safe Harbor identifiers as Redaction Point 1, plus:
- Names appearing in collateral documents ("school records from Ms. Patterson")
- Names of prior treatment providers
- Specific facility names that could identify the patient
- Any other identifying information embedded in clinical notes

**What does NOT get redacted:**
- Test scores and interpretive ranges
- Diagnostic codes (ICD-10) and criteria
- Clinical observations and behavioral descriptions
- Legal questions and psycholegal opinions
- Referral source type and jurisdiction (state-level)

**Flow:**
```
Clinician triggers report draft → Local app assembles full case record
                                → New UNID map generated (fresh UNIDs, not reused from Point 1)
                                → Redacted case record sent to Writer Agent
                                → Writer returns draft report with UNIDs
                                → Local app re-hydrates UNIDs → stores full-PHI draft
                                → UNID map destroyed
                                → Clinician reviews/edits full-PHI draft in editor
```

### Additional Redaction Points (Post-MVP)

- **Editor/Legal Agent review** — When the draft report is sent for Daubert compliance checking, a new UNID map is generated.
- **Diagnostician Agent** — When diagnostic evidence is sent for criteria mapping, a new UNID map is generated.
- **Any future AI call** — Every transmission to any external AI endpoint requires a fresh UNID map. No exceptions.

---

## UNID Map Lifecycle

```
1. GENERATE    Clinician triggers an AI operation (cleanup, draft, review)
               → UNIDMap created: { phiValue → UNID } for all detected PHI
               → Each UNID = type prefix + "_" + 6-char crypto-random hex
               → Map stored in-memory only (never written to disk, never in SQLCipher)

2. REDACT      Full-PHI text passed through Presidio + spaCy pipeline
               → Each detected PHI entity replaced with its UNID from the map
               → Redacted text validated: assert no known PHI remains
               → Redacted text transmitted to AI endpoint

3. RECEIVE     AI returns response containing UNIDs (e.g., "PERSON_a7f3c2 presented as...")

4. RE-HYDRATE  Local app walks the response, replacing each UNID with original PHI
               → "PERSON_a7f3c2 presented as..." → "Marcus Johnson presented as..."
               → Re-hydrated text stored in SQLCipher (full-PHI, encrypted at rest)

5. DESTROY     UNID map zeroed from memory
               → Map object overwritten, not just dereferenced
               → Subsequent operations cannot access previous UNIDs
               → If same text needs to go to AI again, Step 1 starts fresh
```

### Why Single-Use UNIDs

**Correlation resistance.** If UNIDs were persistent (same patient always maps to same UNID), an adversary with access to multiple API logs could correlate them — "PERSON_a7f3c2 appears in 47 API calls, probably the same person." Single-use UNIDs make each transmission independent.

**Forward secrecy.** Compromise of one UNID map reveals PHI for one operation only. Previous and future operations are unaffected because their maps were already destroyed or haven't been created yet.

**No stored mapping surface.** Because maps exist only in-memory and only during an active operation, there is no file, database row, or cache entry that could be exfiltrated to reverse the de-identification.

---

## UNID Format Specification

```
Pattern:  {TYPE}_{hex}
Length:   TYPE prefix (variable) + "_" + 6 hex characters
Entropy:  24 bits per UNID (16.7 million possible values per type prefix)
          Sufficient for single-operation uniqueness (typical case has <50 PHI entities)

Type Prefixes:
  PERSON_     Names (patient, family, collateral, attorneys, judges, clinicians)
  DOB_        Dates of birth
  DATE_       Other significant dates (admission, incident, evaluation dates)
  ADDRESS_    Street addresses, city names (sub-state geography)
  PHONE_      Telephone and fax numbers
  EMAIL_      Email addresses
  SSN_        Social Security numbers
  RECNUM_     Medical record numbers, case numbers, health plan IDs
  LICENSE_    License and certificate numbers
  VEHICLE_    Vehicle identifiers
  DEVICE_     Device identifiers and serial numbers
  URL_        Web URLs
  IP_         IP addresses
  BIOMETRIC_  Biometric identifiers
  PHOTO_      Photographic image references
  OTHER_      Any other unique identifying characteristic

Examples:
  "Marcus D. Johnson"     → PERSON_a7f3c2
  "Maria Johnson (mother)"→ PERSON_d1e84b
  "03/15/1988"            → DOB_f29c71
  "1247 Elm Street, Denver" → ADDRESS_8b3e0a
  "#2026-0147"            → RECNUM_c5a912
```

---

## Implementation Architecture

### Python Sidecar Responsibility

The UNID redaction pipeline runs in the Python sidecar process (same process that runs Presidio + spaCy). The Electron renderer never handles raw PHI + UNID mapping simultaneously — the sidecar receives full-PHI text via local IPC and returns redacted text.

```
Electron Renderer                    Python Sidecar
─────────────────                    ──────────────

Full-PHI text ──── IPC (local) ────→ Presidio detects PHI entities
                                     Generate UNID map (in-memory)
                                     Replace PHI with UNIDs
Redacted text ←─── IPC (local) ────  Return redacted text

Redacted text ──── HTTPS ──────────→ Claude API (sees only UNIDs)

AI response   ←─── HTTPS ──────────  Response with UNIDs

AI response   ──── IPC (local) ────→ Re-hydrate UNIDs → full PHI
                                     Destroy UNID map
Full-PHI text ←─── IPC (local) ────  Return re-hydrated text

Store in SQLCipher (encrypted)
```

### IPC Contract Addition

New IPC channels for the UNID pipeline (extends doc 02):

```typescript
// Redact: send full-PHI text, receive redacted text with UNIDs
ipcMain.handle('pii:redact', async (event, {
  text: string,           // Full-PHI text to redact
  operationId: string,    // Unique ID for this operation (for map lifecycle)
  context: 'intake' | 'report' | 'review' | 'diagnostics'  // Redaction point
}) => Promise<{
  redactedText: string,   // Text with UNIDs replacing PHI
  entityCount: number,    // Number of PHI entities detected and replaced
  typeBreakdown: Record<string, number>  // e.g., { PERSON: 4, DOB: 1, ADDRESS: 2 }
}>);

// Re-hydrate: send AI response with UNIDs, receive full-PHI text
ipcMain.handle('pii:rehydrate', async (event, {
  text: string,           // AI response text containing UNIDs
  operationId: string     // Must match the redact operationId
}) => Promise<{
  fullText: string,       // Re-hydrated text with real PHI
  unidsReplaced: number   // Number of UNIDs found and replaced
}>);

// Destroy: explicitly destroy a UNID map (also happens automatically on rehydrate)
ipcMain.handle('pii:destroy', async (event, {
  operationId: string
}) => Promise<{ destroyed: boolean }>);
```

### Audit Trail Integration

Every redaction operation is logged to the audit trail (without PHI):

```json
{
  "timestamp": "2026-03-22T14:30:00Z",
  "operation": "pii:redact",
  "context": "report",
  "caseId": "2026-0147",
  "entityCount": 12,
  "typeBreakdown": { "PERSON": 5, "DOB": 1, "ADDRESS": 2, "PHONE": 1, "RECNUM": 3 },
  "apiEndpoint": "anthropic/claude-sonnet",
  "unidMapLifetimeMs": 3420
}
```

The audit trail records *that* redaction happened, *how many* entities were redacted, and *how long* the UNID map existed — but never the PHI values or the UNID mappings themselves.

---

## Relationship to Existing Documents

| Document | What It Covers | What This Document Adds |
|----------|---------------|----------------------|
| Doc 03 (HIPAA Safe Harbor) | The 18 identifier types, detection methodology, Presidio config, validation protocol | The UNID replacement mechanism, map lifecycle, single-use rotation |
| Doc 02 (IPC API Contracts) | Electron ↔ Python IPC channels | New `pii:redact`, `pii:rehydrate`, `pii:destroy` channels |
| Doc 03 (Agent Prompt Specs) | What each agent does with input | Clarifies that agents receive UNID-redacted input, never raw PHI |
| Doc 12 (Intake/Onboarding) | Form fields and data flow | Specifies Redaction Point 1 in the intake workflow |
| BUILD_MANIFEST.md | Sprint tasks for PII pipeline | Provides architectural context for Sprint 2 (Task 2.2) and Sprint 4 (Task 4.1) |

---

## Key Invariants

1. **No PHI in any outbound HTTPS request.** The Python sidecar is the only component that makes API calls, and it only sends redacted text.
2. **No UNID map on disk.** Maps exist in-memory only, for the duration of a single operation.
3. **No UNID reuse.** Every operation generates fresh UNIDs. Previous UNIDs cannot be correlated with future ones.
4. **Reports contain full PHI.** The final evaluation report is never redacted — it's a clinical/legal document that requires patient identification.
5. **Audit trail contains no PHI.** Operation logs record entity counts and types, never values or mappings.
