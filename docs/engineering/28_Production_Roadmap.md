# Production Roadmap, Outstanding Items to Ship Psygil v1.0

**Document Version:** 1.0
**Created:** 2026-04-07
**Status:** Active, Living document, update as items ship
**Owner:** Truck Irwin / Engineering

---

## Purpose

This document captures every known piece of work between today's state
(setup wizard complete, 157 automated checks passing, all 7 report
templates provisioning, document import working for 6 formats) and a
shippable v1.0 release. Items are grouped by area and ordered by
operational dependency, not by difficulty.

If something is listed here, it has a known scope and is ready for an
engineer to pick up. If something is **not** listed here and a customer
asks for it, treat it as new product surface that needs a separate spec.

---

## 1. Sidecar, Build Pipeline & Distribution

### 1.1 Local sidecar build (BLOCKING for any release)

**Status:** Build script complete, fails fast on this machine because the
host has Python 3.9.6 and spaCy now requires `thinc>=8.3.12` which needs
Python 3.10+.

**Action items:**
1. Install Python 3.11 on the build machine:
   - macOS: `brew install python@3.11`
   - Linux: distribution python3.11 or `pyenv install 3.11.10`
   - Windows: official installer from python.org
2. Run `sidecar/build.sh --clean` from the repo root
3. Verify the produced binary at
   `app/resources/sidecar/<platform>/psygil-sidecar/psygil-sidecar`
   smoke-tests OK (the script does this automatically)
4. Confirm the directory bundle is approximately 950 MB (the spaCy
   `en_core_web_lg` model dominates the size)

**Owner:** Release engineering
**Effort:** 1 hour wall time including model download
**Dependencies:** Python 3.11+, ~3 GB free disk

### 1.2 macOS codesigning + notarization

**Status:** `sign-macos.sh` is complete and ready to run. Requires a
Developer ID certificate.

**Action items:**
1. Acquire a Foundry SMB Developer ID Application certificate from
   Apple Developer Program
2. Install in the build machine's keychain
3. Run `sidecar/sign-macos.sh "Developer ID Application: Foundry SMB (TEAMID)"`
4. Verify with `codesign --verify --deep --strict --verbose=2` (script
   does this automatically)
5. Run a notarization test with `xcrun notarytool` once the parent
   Electron app is built around it

**Owner:** Release engineering
**Effort:** 30 minutes once cert is in keychain
**Dependencies:** Apple Developer Program enrollment, Developer ID cert

### 1.3 Cross-platform CI build

**Status:** GitHub Actions workflow at `.github/workflows/sidecar-build.yml`
covers darwin-arm64, darwin-x64, linux-x64, win32-x64. Not yet exercised.

**Action items:**
1. Push the workflow to a feature branch
2. Trigger via `workflow_dispatch` in the GitHub Actions UI
3. Verify all 4 jobs succeed and artifacts upload
4. Download artifacts and stage them locally to confirm the format
5. Set up a self-hosted Apple Silicon runner if `macos-14` GitHub
   minutes get expensive (the spaCy install is ~5 minutes per run)

**Owner:** Release engineering
**Effort:** 2 hours including first-run debug
**Dependencies:** GitHub Actions enabled on the repository

### 1.4 Sidecar bundle integration into electron-builder

**Status:** The locator at `app/src/main/sidecar/index.ts` already
prefers the bundled binary when present. `electron-builder.yml` needs
the `extraResources` block updated to copy the per-platform bundle.

**Action items:**
1. Edit `app/electron-builder.yml`:
   ```yaml
   extraResources:
     - from: ../app/resources/sidecar/${os}
       to: sidecar/${os}
       filter: ["**/*"]
   ```
2. Run `npm run dist:mac` and verify the .dmg contains the sidecar at
   `Psygil.app/Contents/Resources/sidecar/darwin/psygil-sidecar/`
3. Launch the packaged app and confirm the sidecar starts from the
   bundled binary, not from the dev Python script

**Owner:** Release engineering
**Effort:** 1 hour
**Dependencies:** 1.1 (a built sidecar to bundle)

---

## 2. License Server, Production Deployment

### 2.1 TLS termination

**Status:** Reference server in `services/license-server/` is HTTP-only.
The desktop client refuses non-HTTPS URLs in production, so a TLS
front-end is mandatory before any customer-facing deployment.

**Action items:**
1. Pick a hosting target: Fly.io, Render, Railway, AWS App Runner, or
   self-hosted on a small VPS
2. Add `caddy` or `nginx` as a TLS terminator with automatic Let's
   Encrypt certificate provisioning
3. Map `licenses.psygil.com` (or chosen subdomain) to the server
4. Verify `validateRemote()` from the desktop app accepts the live URL

**Owner:** Infrastructure
**Effort:** 4 hours
**Dependencies:** Domain registration, hosting account

### 2.2 Real database

**Status:** The reference server uses a JSON file
(`services/license-server/licenses.json`). Acceptable for the first 100
keys; not acceptable past that.

**Action items:**
1. Add Postgres (Supabase, Neon, or RDS)
2. Replace `loadDatabase()` and `validateKey()` with a parameterized
   SQL implementation
3. Migrate the existing JSON seed data into a schema with `licenses`,
   `customers`, `audit_log` tables
4. Add indexes on `key` (unique) and `customer_id`

**Owner:** Backend engineering
**Effort:** 1 day
**Dependencies:** 2.1

### 2.3 Issuance API + admin tooling

**Status:** No way to mint a new key without hand-editing JSON. Foundry
SMB sales needs a self-serve issuance flow once the first paying
customer signs up.

**Action items:**
1. Add `POST /v1/admin/licenses` (auth-gated) for issuance with body
   `{ tier, seats, customerId, expiresAt? }`
2. Add `POST /v1/admin/licenses/<key>/revoke` for revocation
3. Add `GET /v1/admin/licenses` for the customer list
4. Build a thin admin UI (next.js or Retool) for sales to use
5. Authenticate admin endpoints with a static API key in env, rotated
   monthly

**Owner:** Backend engineering
**Effort:** 2 days
**Dependencies:** 2.2

### 2.4 Audit log + observability

**Status:** Server logs validation events to stdout but does not
persist them.

**Action items:**
1. Persist every validation attempt to an `audit_log` table with key
   hash, IP, timestamp, result, error code
2. Add a daily report email to the sales team summarizing activations,
   rejections, and offline-fallback fallbacks
3. Set up alerts for unusual patterns (e.g. >10 failed validations
   from one IP per hour)

**Owner:** Backend engineering
**Effort:** 1 day
**Dependencies:** 2.2

### 2.5 HMAC-signed responses

**Status:** Responses are plain JSON. A determined attacker on the
client machine could intercept and forge a successful response.

**Action items:**
1. Add a server-side signing key
2. Sign every response body with HMAC-SHA256
3. Update the desktop client to verify the signature with a hardcoded
   public verification key (or shared secret in keychain)
4. Reject any response with a missing or invalid signature

**Owner:** Backend engineering
**Effort:** 1 day
**Dependencies:** 2.1

---

## 3. Vitest Environment Repair

**Status:** `npm test` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED ... vite/package.json` because the
project has vitest 4.x against an older vite. The standalone verifier
scripts cover everything important, but a working vitest unblocks
renderer snapshot tests and TDD on new features.

**Action items:**
1. Run `npm install vite@latest --save-dev` in `app/` to bump to a
   vitest 4.x compatible vite
2. Run `npm test` and confirm the existing test files in
   `src/main/__tests__/` and `src/main/setup/__tests__/` execute
3. Wire test runs into pre-commit and CI

**Owner:** Build engineering
**Effort:** 1 hour, possibly more if other deps depend on the old vite
**Dependencies:** None

---

## 4. Settings Tab, Pre-existing Type Errors

**Status:** `tsc -p tsconfig.web.json` reports 4 long-standing errors
in `SettingsTab.tsx` (lines 173, 191, 698, 747) and 15 in
`DiagnosticsTab.tsx` (around lines 586-814). None block the build but
they erode confidence in the typecheck signal.

**Action items:**
1. Fix `SettingsTab.tsx` `ResourceCategory` type cast at lines 173/191
2. Fix `ApiKeyHasResult` boolean coercion at line 698
3. Fix `IpcResponse<AiTestConnectionResult>` discrimination at line 747
4. Fix the 15 `unknown → ReactNode` issues in `DiagnosticsTab.tsx` by
   tightening the agent result types in `agents/diagnostician.ts`

**Owner:** Frontend engineering
**Effort:** 2 hours
**Dependencies:** None

---

## 5. Setup Wizard Polish

### 5.1 Step 1, Sidecar diagnostic detail

**Status:** Step 1 reports "Sidecar healthy" or "Sidecar check failed"
with the raw error message. When the failure is "no Python found" or
"missing en_core_web_lg model", we should detect that and offer
specific remediation instead of the raw stack trace.

**Action items:**
1. Add specific error matchers for: ENOENT (Python not found), import
   error (model missing), socket bind failure (sidecar already running)
2. Show a step-by-step remediation panel for each known case
3. Add a "Copy diagnostic to clipboard" button for unknown failures

**Owner:** Frontend engineering
**Effort:** 2 hours

### 5.2 Step 5, Connection cost estimate

**Status:** When the user enters an API key and hits "Test and save",
we run the UNID gate but do not show the estimated token cost from the
test request.

**Action items:**
1. Capture the token usage from `ai.testConnection`
2. Multiply by published rates for the selected model
3. Display "Test cost: $0.0001" so the user sees what the gate ran

**Owner:** Frontend engineering
**Effort:** 1 hour

### 5.3 Step 7, Template preview

**Status:** Step 7 lists the templates that were provisioned but does
not show what they look like. A "Preview" button next to each one would
help users understand what they're getting.

**Action items:**
1. Add a "Preview" button per provisioned template
2. Open the .docx in OnlyOffice in read-only mode, or render the
   .txt twin in a modal
3. Close button returns to the wizard

**Owner:** Frontend engineering
**Effort:** 4 hours
**Dependencies:** OnlyOffice integration is already wired

### 5.4 Step 8, "Open Folder" button

**Status:** Step 8 shows the configured paths but does not let the user
open the project root in Finder/Explorer to verify everything is in
place.

**Action items:**
1. Add a "Reveal in Finder" button next to the storage path
2. Wire to existing `workspace:openInFinder` IPC
3. Add similar buttons for the templates folder and resources folder

**Owner:** Frontend engineering
**Effort:** 30 minutes

---

## 6. Accessibility Audit

**Status:** The wizard uses semantic HTML and includes `aria-label`,
`aria-modal`, `aria-current` on the right elements, but has not been
tested with VoiceOver, NVDA, or screen magnifiers. WCAG 2.1 AA is a
common procurement requirement for government contracts.

**Action items:**
1. Run axe-core or Lighthouse against every wizard step
2. Test with VoiceOver on macOS and NVDA on Windows
3. Verify keyboard-only navigation works for the entire flow
4. Ensure focus management on step transitions (focus the first
   interactive element on each new step)
5. Verify color contrast ratios meet AA in all three themes

**Owner:** Frontend engineering
**Effort:** 1 day for audit + 1 day for fixes
**Dependencies:** None

---

## 7. Localization Foundation

**Status:** All wizard strings are inline English. Forensic psychology
practices in Quebec, Mexico, and many European countries would need
French, Spanish, German, etc. before they could deploy.

**Action items:**
1. Extract all wizard strings into a `strings/en.ts` file with typed
   keys
2. Add a `useLocale()` hook that reads from `localStorage`
3. Pre-create empty `fr.ts`, `es.ts`, `de.ts` for translators
4. Add a locale picker to the practice info step (and global Settings)
5. Date and number formatting via `Intl.DateTimeFormat`

**Owner:** Frontend engineering
**Effort:** 2 days for the foundation; translation is a separate
contracted effort
**Dependencies:** None

---

## 8. Document Import, End-User Polish

### 8.1 Drag-and-drop import to case folders

**Status:** Document import works via the `documents:ingest` IPC and
the existing modal. End users would expect to drag files from the OS
file manager directly onto a case in the LeftColumn tree.

**Action items:**
1. Wire HTML5 drag events on `LeftColumn.tsx` case nodes
2. Read the dropped file paths via `webUtils.getPathForFile`
3. Show a dropdown of valid subfolders (\_Inbox, Collateral, Testing,
   etc.) before triggering the ingest
4. Surface progress for large PDFs

**Owner:** Frontend engineering
**Effort:** 4 hours

### 8.2 Bulk import

**Status:** Files are imported one at a time. Practices receiving large
record dumps need to import 50 PDFs at once.

**Action items:**
1. Multi-select in the file picker
2. Background import with a progress modal
3. Per-file success/failure log
4. Option to retry failed imports

**Owner:** Frontend engineering
**Effort:** 1 day

### 8.3 OCR for scanned PDFs

**Status:** `pdf-parse` returns empty text for image-only scans. Many
court records arrive as scanned PDFs from clerks who refuse to email
text-searchable copies.

**Action items:**
1. Detect scanned PDFs (`extractText` returns < 50 chars on a > 100 KB
   PDF)
2. Add Tesseract.js as an opt-in OCR fallback, OR
3. Add a Python sidecar handler for OCR via pytesseract / paddleocr
4. Cache OCR results so re-imports don't redo the work

**Owner:** Backend engineering
**Effort:** 2 days for sidecar OCR; 4 days for Tesseract.js
**Dependencies:** Sidecar build pipeline (1.x) for the Python option

---

## 9. Auto-Update Pipeline

**Status:** Sprint 12 added Ed25519 verification scaffolding for
auto-update but the actual update server endpoint, signing keys, and
Sparkle (macOS) / Squirrel (Windows) integration are not wired.

**Action items:**
1. Set up an update manifest server (can be the same VPS as the
   license server, or GitHub Releases)
2. Generate the Ed25519 signing keypair and store the private key in a
   1Password vault accessible only to release engineers
3. Configure `electron-updater` to point at the manifest URL
4. Add a release script that builds, signs, uploads, and updates the
   manifest
5. Test the update flow end-to-end with a fake "old" version

**Owner:** Release engineering
**Effort:** 2 days
**Dependencies:** 1.x (sidecar bundling), 2.1 (server hosting)

---

## 10. Documentation for End Users

**Status:** All current docs are engineer-facing (build manifests,
spec docs, code comments). End-user documentation is zero.

**Action items:**
1. Quick-start guide: install → activate license → create first case
2. Forensic evaluation walkthrough: intake → testing → interview →
   diagnostics → review → complete
3. Template customization guide: how to edit `.docx` templates and
   what placeholder tokens are available
4. AI assistant guide: when to use it, what it does, what to verify
5. HIPAA compliance one-pager: what Psygil does locally, what UNID
   redaction means, what BAA you need (none for solo, M365/Google for
   cloud tier)
6. Troubleshooting: sidecar won't start, OnlyOffice won't load, license
   says invalid

**Owner:** Truck + technical writing
**Effort:** 1 week
**Dependencies:** None, can be drafted now and updated as features
land

---

## Sequencing Recommendation

If I were sequencing this for a single-engineer rollout, I would do:

**Sprint 13 (1 week), Make a release possible**
- 1.1 Build the sidecar locally on a Python 3.11 machine
- 1.2 Codesign for macOS
- 1.4 Wire into electron-builder
- 4 Fix the pre-existing type errors
- 3 Repair vitest

**Sprint 14 (1 week), Ship the first internal beta**
- 1.3 Cross-platform CI
- 9 Auto-update pipeline
- 5.1 Sidecar diagnostic detail
- 5.4 Open Folder button
- 10 Quick-start guide (just the install + first case path)

**Sprint 15 (1 week), Make it customer-ready**
- 2.1 License server TLS deployment
- 2.2 Postgres migration
- 5.2 Connection cost estimate
- 5.3 Template preview
- 8.1 Drag-and-drop import

**Sprint 16 (1 week), Production hardening**
- 2.3 Issuance API
- 2.4 Audit log
- 2.5 HMAC signing
- 6 Accessibility audit + fixes

**Sprint 17 (1 week), Polish for sale**
- 8.2 Bulk import
- 8.3 OCR for scans
- 10 Full end-user docs
- 7 Localization foundation (English-only is fine for v1.0; foundation
  enables future translations)

Ship Psygil v1.0 at the end of Sprint 17.

---

## 11. Resource seeding, explicit-only

**Status (2026-04-08):** Auto-seeding of `_Resources/Documentation/_cleaned/...`
on first `resources:list` call has been removed. A freshly-set-up project root
no longer gets surprise demo content. This means the Resources panel is empty
until the user uploads something or explicitly requests demo data.

**Action items:**
1. Add a "Load demo resources" button to Settings → Demo / Danger Zone that
   calls `seedResources(workspacePath)` on demand
2. Make the empty-state of the Resources panel visually clear ("No resources
   yet. Upload one above or load demo content from Settings.")
3. When a user picks an EXISTING project root that already has `_Resources/`,
   the panel should still see and use those files (the seed function is the
   only thing changing, the read path still works)

**Owner:** Frontend engineering
**Effort:** 2 hours

---

## Items deliberately NOT in this roadmap

These are not blockers for v1.0 and should be reconsidered for v1.1+:

- Multi-user practice tier (network drive sync), defer to v1.1
- Cloud storage tier (M365 / Google Drive), defer to v2.0
- iOS / Android companion app, defer indefinitely
- Built-in scheduling and billing, defer indefinitely; partner with
  existing practice management software instead
- Real-time collaboration on a single case, defer to v2.0
- Court-specific report formatting variants, handle via custom
  templates per practice; do not bake into the product
- AI auto-diagnosis, never. THE DOCTOR ALWAYS DIAGNOSES. This is a
  load-bearing architectural principle and is not on any roadmap.
