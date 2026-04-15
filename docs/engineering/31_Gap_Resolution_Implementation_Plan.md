# 31, Gap Resolution Implementation Plan

Status: Draft, v1 (2026-04-15)
Owner: Engineering
Depends on: 30_Workflow_Map_and_Dev_Path

This plan turns each `[GAP]` into a concrete work item with acceptance criteria, files to touch, estimated effort, and a test plan.

Estimates use T-shirt sizes: S (<= 2 days), M (3 to 5 days), L (1 to 2 weeks), XL (2+ weeks).

---

## G1. Writer Agent Integration (XL)

Problem: `generateReportDocx()` expects a `WriterOutput` JSON that nothing currently produces. Report export has no real content.

Scope:
- Define `WriterInput` (case bundle) and `WriterOutput` (section list, paragraphs, citations) in `shared/types/writer.ts`.
- Implement `buildWriterInput(caseId)` in `main/reports/bundle.ts`, pulling from cases, patient_intake, patient_onboarding (all sections), diagnoses, test_results, documents, audit_log.
- Implement Writer agent in `main/agents/writer/` with stage-gated section generation. Use stub deterministic templates first, swap in LLM later.
- Register IPC `report:build(caseId) -> WriterOutput`.
- Wire `ReportSubTab` build button to new IPC.

Acceptance:
- Given a case at stageIndex 4 with all gates passed, `report:build` returns a valid `WriterOutput` with at least six sections.
- `generateReportDocx(output)` writes a non-empty `.docx` that opens in Word and LibreOffice.

Files: `app/src/shared/types/writer.ts` (new), `app/src/main/agents/writer/*` (new), `app/src/main/ipc/handlers.ts` (add `report:build`), `app/src/renderer/src/components/layout/CenterColumn.tsx` (ReportSubTab).

Tests: unit (templating), integration (bundle builder with fixture case), e2e (full advance through gates, click Build, assert file on disk).

---

## G2. Progressive Report Content (M)

Problem: `buildReportContent` stubbed content gating exists client-side; the real Writer must respect the same gating.

Scope:
- Writer reads `workflow_current_stage` and emits placeholder text (`Pending, {stageLabel}`) for any section whose required stage is incomplete.
- Guarantee: no diagnostics or notes appear in the report until stages 2 and 3 are complete.

Acceptance: unit test per stage verifies sections gate correctly.

---

## G3. Publish Pipeline (L)

Problem: "Publish Final" path does not exist. Drafts stay mutable; no audit hash; no archive.

Scope:
- IPC `report:publish(caseId)`:
  1. Assert all gates passed and attestation signed.
  2. Render final DOCX and PDF.
  3. Compute SHA-256 of each file; store in `audit_log`.
  4. Move drafts to `Archive/`.
  5. Set file permissions to read-only.
  6. Update `cases.case_status = 'complete'`, `workflow_current_stage = 'complete'`.
  7. Insert `audit_log` row `action='report_published'` with user_id and hashes.

Acceptance: publishing sets read-only bit; re-publish requires explicit unlock by supervisor role.

---

## G4. Auth0 PKCE End to End (L)

Problem: `psygil://` protocol registered but handlers missing; all handlers assume user_id=1.

Scope:
- Complete `main/auth/login.ts`, `logout.ts`, `user.ts`.
- Register `app.on('open-url')` and Windows second-instance argv parsing for `psygil://callback`.
- Store refresh token in OS keychain (keytar).
- Session context injected into every IPC handler via middleware.
- Renderer login screen replaces bypass.

Acceptance: fresh install forces login; logout invalidates session; every DB write stamps the authenticated user_id.

---

## G5. Session Context Plumbing (M)

Problem: user_id hard-coded across handlers.

Scope: add `getCurrentUserId()` resolver; replace literals in intake, onboarding, diagnoses, audit handlers.

Acceptance: grep for `user_id: 1` returns zero matches in `main/`.

---

## G6. Auto-Update (M)

Scope:
- Integrate `electron-updater` with signed release feed (GitHub Releases or S3).
- Add update channel selection (stable, beta) to Settings.
- Show release notes in-app on successful update.

Acceptance: published test release triggers update notification in dev harness.

---

## G7. Uninstall and Data Removal (M)

Problem: no documented path to fully remove PHI from a workstation.

Scope:
- Add Settings > Danger Zone > "Remove all local data" flow.
- Shreds DB, userData config, and prompts to delete workspace folder.
- Ships a CLI helper `psygil-wipe` for imaging.

Acceptance: after wipe, re-launching shows Welcome; SQLCipher file zeroed before unlink.

---

## G8. OnlyOffice Sidecar (XL)

Scope:
- Package OnlyOffice Document Server as sidecar process launched by main.
- Implement JWT handshake for document session.
- Round-trip DOCX to in-app editor.
- Health check and auto-restart on crash.

Acceptance: user can edit draft DOCX inline; saves round-trip without formatting loss.

---

## G9. Workspace Switch and Second-Instance Lock (S+S)

Scope:
- Settings > Workspace > "Change" triggers safe re-sync: close watchers, swap path, rescan, confirm.
- Write `.psygil-lock` with PID on startup; second instance detects and refuses.

Acceptance: concurrent launch warns and exits; workspace change preserves all DB rows that still map to folders.

---

## G10. File Watcher Hardening (M)

Scope:
- Debounce chokidar events, 300ms.
- Handle rename, delete, permission change.
- Idempotent upsert; no duplicate document rows on rapid events.

Acceptance: rename case folder externally; DB updates within 1 second; no duplicate rows.

---

## G11. Gate Enforcement Server-Side (M)

Scope: move gate checks from renderer to main so keyboard or scripted bypass cannot skip gates.

Acceptance: attempting `cases:advanceStage` when gate unmet returns error and does not update DB.

---

## G12. Audit Trail Completeness (M)

Scope:
- Write-only `audit_log` with BEFORE INSERT trigger rejecting UPDATE/DELETE.
- Every Dx decision, gate pass, report build, export, publish writes a row.
- Admin view in Settings surfaces last 100 entries.

Acceptance: SQL `UPDATE audit_log ...` fails; spot-check coverage by event.

---

## G13. Schema Migrations (S)

Scope: add `umzug` or hand-rolled migration runner on `initDb()`; version table; forward-only migrations.

Acceptance: clean install on v2 schema; upgrade from v1 sample DB preserves all data.

---

## G14. Anti-AI-Artifact Guard (S)

Scope: pre-publish scan for U+2014, U+2013, and marker strings ("Generated by", "Co-authored"). Block publish if found.

Acceptance: seeded offending string causes publish to fail with actionable message.

---

## G15. Accessibility Pass (M)

Scope: keyboard navigation across wizard and gate checkboxes; ARIA labels on all textareas; focus ring on tab strip.

Acceptance: axe-core run returns zero critical issues on Setup Wizard and Diagnostics tab.

---

## Sequencing and Milestones

| Sprint | Items | Outcome |
|---|---|---|
| S1 | G1, G2 | Writer produces real report content |
| S2 | G3, G12, G14 | Publish pipeline with audit and artifact guard |
| S3 | G4, G5 | Real auth end to end |
| S4 | G6, G7, G9 | Install, update, uninstall, workspace safety |
| S5 | G10, G11, G13 | Watcher, gates, migrations hardened |
| S6 | G8 | OnlyOffice rich edit |
| S7 | G15 + beta polish | Accessibility and bug burn-down |

---

## Risk Register (abbreviated)

- Writer hallucination, mitigated by deterministic templates for beta and clinician-approves-every-section gate.
- OnlyOffice licensing cost at scale, evaluate Docx.js in-app editor as fallback.
- Auth0 vendor lock-in, abstract session resolver behind interface.
- Cloud-drive workspace race conditions, warn on detect, document "not supported for teams".
