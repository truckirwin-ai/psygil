# 30, Workflow Map and Dev Path

Status: Draft, v1 (2026-04-15)
Owner: Engineering
Related: 17_Setup_Workflow_Spec, 18_Case_Lifecycle_Spec, 28_Production_Roadmap

This document enumerates every end-to-end workflow in Psygil v2, maps the current code paths, marks gaps, and prescribes the dev path to beta. It is the canonical source for QA scenarios and sprint scoping.

---

## 1. Workflow Inventory

Primary (user-requested):

1. Download and Install
2. Configure Individual / Practice / Enterprise
3. Configure Shared Storage
4. Case Creation and Onboarding
5. Case Processing (Testing, Interview, Diagnostics, Report Generation)
6. Report Publishing (Word and PDF)

Secondary (discovered in code, required for beta):

7. Authentication and Session (Auth0 PKCE, `psygil://` deep link)
8. Workspace Sync and File Watcher Reconciliation (chokidar)
9. Document Ingestion and Viewing (pdfjs-dist, `document-viewer` tabs)
10. Tab Management and Navigation (multi-tab center column, persistence)
11. Notes and Flush-on-Navigate (`registerFlushHandler`)
12. Stage Advancement and Gates (Gate 1/2/3 plus attestation)
13. Evidence Map and Differential Diagnosis
14. Audit Trail and Attestation (immutable clinical decision log)
15. Archive and Version Management (`Archive/`, `draft_vN.docx`)
16. Backup, Restore, Data Portability (case export, workspace migration)
17. Settings and Appearance (theme, font, AI config)
18. Resource and Template Management (instrument norms, consent templates)
19. Error Recovery and Crash Resilience (DB corruption, missing workspace)
20. Uninstall and Data Removal (HIPAA relevant)

---

## 2. Workflow Detail (numbered, testable steps)

Each step lists: actor, action, system effect, verification hook. Gaps flagged `[GAP]`.

### WF-1. Download and Install

1.1 User downloads signed installer (DMG, NSIS, AppImage). Verify: notarization ticket (macOS), Authenticode signature (Win).
1.2 User runs installer. App copied; `psygil://` protocol registered. Verify: `defaults read`, registry key.
1.3 First launch, `main/index.ts:134` runs `initDb()`, `registerIpcHandlers()`, `loadWorkspacePath()` returns null.
1.4 No workspace, Setup Wizard renders (welcome). Verify: `setup:getConfig.state === 'welcome'`.
1.5 Quit persists window bounds.
1.6 `[GAP]` Auto-update (electron-updater not integrated).

Negative: corrupted download, read-only volume, permission denied on userData, second install over existing data.

### WF-2. Configure Individual / Practice / Enterprise

2.1 User clicks Get Started; state advances to `license`.
2.2 User enters license key (or skips trial). Persisted to `psygil-setup.json`.
2.3 User selects deployment profile: Individual, Practice, Enterprise.
2.4 Practice info (name, NPI, address) saved via `setup:savePractice`.
2.5 Individual skips multi-user screens.
2.6 Practice prompts for clinician roster, inserts rows into `users`.
2.7 `[LATER]` Enterprise SSO/SAML.
2.8 Wizard completes; main shell loads.
2.9 `[GAP]` User login (Auth0 PKCE) not wired; session hard-codes user_id=1.

Negative: invalid license, duplicate NPI, back-button mid-flow.

### WF-3. Configure Shared Storage

3.1 Wizard enters `storage` state; default path suggested.
3.2 User picks folder via `setup:pickStorageFolder`.
3.3 `setup:validateStoragePath` returns writable, free bytes, cloud drive flag.
3.4 Cloud drive (Dropbox/iCloud/OneDrive) warns of sync conflicts.
3.5 `setup:provisionStorage` creates `cases/`, `reports/`, `_inbox/` plus templates.
3.6 Path persisted to `config.json` and `psygil-setup.json`.
3.7 chokidar watcher starts on `{root}/cases`.
3.8 Initial `syncWorkspaceToDB` matches `YYYY-NNNN Last, First` folders, upserts cases.
3.9 `[GAP?]` Post-setup workspace switch not explicitly handled.

Negative: read-only path, path deleted while running, removable drive unmounted, two app instances on same workspace.

### WF-4. Case Creation and Onboarding (6-step wizard)

4.1 User clicks New Case; IntakeOnboardingModal opens at step 0.
4.2 User fills Contact and Insurance; phone field formats live (`1112223333` to `(111) 222-3333`).
4.3 Save and Continue calls `cases:create`, which inserts the `cases` row and scaffolds the folder tree plus stub documents.
4.4 `intake:save(section='contact')` upserts `patient_intake`.
4.5 `writeCaseDoc` writes `_Inbox/intake.md`.
4.6 Step 1, Referral and Legal, saves to `patient_intake.referral_*`.
4.7 Step 2, Demographics and Family, two `patient_onboarding` rows.
4.8 Steps 3 to 5, Complaints, Medical plus Substance, Recent Events.
4.9 Finish advances `workflow_current_stage` from `onboarding` to `testing`.
4.10 LeftColumn refreshes and renders the new case node.
4.11 Mid-flow close then reopen restores to last-saved step.

Negative: duplicate case_number, unicode, missing DOB, partial save.

### WF-5. Case Processing

#### 5a. Testing
Add instruments to battery; upload raw protocols to `Testing/`; enter scored values; notes flush on blur and on navigate; Gate 1 satisfied when required instruments complete; advance to `interview`.

#### 5b. Interview
Record Behavioral Observations, MSE, Collateral, Free Notes; attach collateral files to `Interviews/`; advance to `diagnostics`.

#### 5c. Diagnostics (DOCTOR ALWAYS DIAGNOSES)
Differential grid rendered from `evidence_maps`; clinician selects/rules out each Dx; fills four Final Formulation sections (Impressions, Ruled Out, Validity, Prognosis); Save and Approve per section; editing an approved section revokes approval; Gate 2 satisfied when all four approved; attestation check enables Gate 3; Approve and Build Report advances to `review`.

#### 5d. Report Generation (Progressive)
While stageIndex <= 3, ReportSubTab renders placeholders only. After Build, `buildReportContent` assembles sections gated by `isStageDone(required)`. Rich editing inert today (`[GAP]` OnlyOffice). Draft DOCX written to `Reports/draft_vN.docx`.

### WF-6. Report Publishing

6.1 Export DOCX via `docx` v9.6.1, versioned `draft_vN.docx`.
6.2 Export PDF via Electron `printToPDF`, Letter, 0.75 inch margins.
6.3 Publish Final checks all gates passed plus attestation signed.
6.4 Final file written to `Reports/final/`, marked read-only, hash recorded.
6.5 `case_status` set to `complete`; stageIndex 4 to 5.
6.6 `audit_log` row inserted: action, user_id, SHA-256 of file.
6.7 Prior drafts moved to `Archive/`.

`[GAP]` Writer Agent not integrated; `WriterOutput` never produced today.
`[GAP]` Publish pipeline (lock, audit hash, archive) not implemented.

### WF-7 to WF-20 (summary, one line each, see Section 4 for test matrix)

7 Auth, `[GAP]`. 8 File watcher reconciliation. 9 Document viewing. 10 Tab management. 11 Notes flush. 12 Gate enforcement. 13 Evidence map. 14 Audit trail. 15 Draft versioning. 16 Backup / restore. 17 Settings. 18 Templates and resources. 19 Error recovery. 20 Uninstall, `[GAP]`.

---

## 3. Dev Path to Beta

Phased sequencing, each phase shippable:

### Phase A, Plumbing the Through-Line (2 sprints)
- Writer Agent integration producing `WriterOutput` from case state.
- Progressive `buildReportContent` wired to real agent output.
- Publish pipeline: lock, hash, archive, audit row.

### Phase B, Identity and Safety (2 sprints)
- Auth0 PKCE flow wired end to end, `psygil://callback` handler.
- Session context replaces hard-coded user_id=1 in all handlers.
- Audit log enforced on every clinical decision and every export.

### Phase C, Deploy and Update (1 sprint)
- electron-updater integrated with signed feed.
- Uninstall and data removal path (HIPAA).
- Second-instance lock on workspace.

### Phase D, Rich Editing (2 sprints)
- OnlyOffice server packaged and launched as sidecar.
- Round-trip DOCX edits from in-app editor.

### Phase E, Enterprise (post-beta)
- SSO/SAML for Enterprise profile.
- Multi-clinician concurrency model.
- Admin console for user roster and audit review.

---

## 4. Cross-Cutting Test Concerns

- Immutability of `diagnoses` and `audit_log`.
- SQLCipher key derivation; workspace permissions 0700 on POSIX.
- Concurrency: two instances on same workspace via lock file.
- Clock trust: UTC only; no system-clock-backward surprises.
- Accessibility: keyboard-through all 6 intake steps; screen-reader labels on gates.
- Schema migration v1 to v2 with zero data loss.
- Large cases: 500 documents, 50 instruments, 200-page render budget.
- HARD RULE scan: grep generated reports for U+2014 and U+2013 before publish; reject if found.

---

## 5. Open Questions

- Do we support a "read-only reviewer" role pre-beta?
- Is Dropbox/iCloud workspace officially supported or warned-only?
- What is the retention policy on `Archive/` after case close?
- What is the notarization plan for Windows beyond Authenticode (EV cert)?
