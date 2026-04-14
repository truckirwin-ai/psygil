# Recovery Notes — Psygil Golden Copy

**Assembled:** 2026-04-13
**Base commit:** `ceb7e64` (GitHub remote HEAD as of Apr 10, 2026 11:54)
**Overlay:** Cole's Day 1 work (Apr 13, 2026 10:55 to 10:57)
**Source workspace:** `~/Desktop/Foundry SMB/Products/Psygil_RECOVERY_20260413/`

## Provenance by directory

| Path | Source | Timestamp |
|---|---|---|
| `app/` | `github-head/app/` | Apr 10 11:54 |
| `app/src/main/branding/brandingManager.ts` | `day1-cole/app/...` (DISK8S1 backup) | Apr 13 10:55:32 |
| `app/src/main/export/pdfExporter.ts` | `day1-cole/app/...` (DISK8S1 backup) | Apr 13 10:55:12 |
| `app/src/main/export/wordExporter.ts` | `day1-cole/app/...` (DISK8S1 backup) | Apr 13 10:55:02 |
| `app/src/renderer/src/components/tabs/settings/BrandingPanel.tsx` | `day1-cole/...` (DISK8S1 backup) | Apr 13 10:56:32 |
| `app/src/renderer/src/components/tabs/SettingsTab.tsx` | `day1-cole/...` (DISK8S1 backup) | Apr 13 10:57:24 (has BrandingPanel integration) |
| `sidecar/` | `github-head/sidecar/` | Apr 10 11:54 |
| `services/license-server/` | `github-head/services/license-server/` | Apr 10 11:54 (v1 only; v2 lost) |
| `scripts/audit-deps.sh` | `github-head/scripts/` | Apr 10 11:54 |
| `docs/engineering/` `docs/legal/` `docs/marketing/` | `github-head/docs/` | Apr 10 11:54 |
| `docs/wireframes/` | `github-head/wireframes/` (moved under docs/) | Apr 10 11:54 |
| `test-resources/` | `github-head/test-resources/` | Apr 10 11:54 |
| `.github/workflows/` | `github-head/.github/workflows/` | Apr 10 11:54 |
| `CLAUDE.md` | `github-head/CLAUDE.md` | Apr 10 11:54 |
| `.gitignore` | Written fresh (expanded from github-head) | Apr 13 |
| `.gitattributes` | NEW (LFS rules before first commit) | Apr 13 |
| `README.md` | NEW (drafted from INSTALL.md + BUILD.md) | Apr 13 |

## What was deliberately excluded

Root-level clutter from github-head (not shipped):
- HTML dashboards and UI prototypes (`DASHBOARD.html`, `Psygil_UI_Prototype*.html`, etc.)
- Demo files (`Psygil_Demo_60s*.html`, `Psygil_Demo_60s.MOV`)
- Session notes (`SESSION_*.md`, `TASK_*.md`)
- Panel reviews (`*_Panel_Review.md`, `Legal_Panel_Review.md`)
- One-off scripts (`capture_screenshots.py`, `generate-ux-guide.js`)
- Audio files (`rithym2.m4a`, `rithym3.m4a`, `capture_screenshots.m4a`)
- PyInstaller caches (`__pycache__/`)
- Deleted analysis files (`Forensai_Technical_Functional_Analysis.docx`, `Psygil_Technical_Functional_Analysis.md`)
- Duplicate manifests (`BUILD_MANIFEST.md`, `COMPONENT_SUMMARY.md`, `INTEGRATION_GUIDE.md`)

Excluded docs:
- 19 numbered business `.docx` files (`01_Project_Overview.docx` through `19_Orchestration_Process.docx`)
- Generator scripts (`add_market_sections.py`, `append_sections.py`, `build_overview.py`)
- `docs/foundry-smb/` subdirectory (unrelated sibling project)

Excluded top-level directories:
- `foundry-smb/` (sibling project, extract to its own repo separately)
- `skills/` (empty in source)

Excluded build artifacts (always regenerated):
- `node_modules/`, `venv/`, `.venv/`, `__pycache__/`, `out/`, `dist/`, `dist-electron/`

## What is still missing (pending forensic recovery)

These files were destroyed by the Apr 13 incident and no backup source has yet been located:

1. **Kit's website/** — 5 HTML marketing pages (index, features, pricing, demo, download). Last known: Apr 13 morning.
2. **Remy's license-server v2** — Fastify + SQLite + Stripe rebuild. Last known: Apr 13 morning.
3. **Apex's AI-BUILD-PLAN.md** — architecture plan document. Last known: Apr 13 morning.

Recovery paths to try next (see `Psygil_RECOVERY_20260413/diagnostics/psygil_recovery_diagnostics.sh`):
- APFS local snapshots (`tmutil listlocalsnapshots /`)
- Time Machine (`tmutil latestbackup`)
- iCloud Drive / Dropbox / Google Drive caches
- macOS Trash on external volumes

## Post-recovery fixes applied

Bugs found in the Apr 10 `ceb7e64` source tree during Gate 4 (app launch). Fixed directly in `Psygil_v2/` during recovery. Not introduced by the recovery process.

1. **`app/src/main/db/migrate.ts` lines 205-206 (now removed).** Orphan SQL fragment `);\nEND;` between `tr_cases_update_last_modified` and `tr_diagnosis_audit` triggers. Caused `SqliteError: near ")": syntax error` on first-run migration. Regression introduced between Apr 3 and Apr 10 when `tr_gate_review_audit` was replaced by `tr_diagnosis_audit` and the previous block was only partially removed. Verified clean against isolated SQLite after fix.

Known pre-existing issues addressed in the Apr 13 recovery follow-up pass:

1. **Vitest 4 vs Vite 5 peer mismatch, FIXED.** Pinned `vitest` in `app/package.json` from `^4.1.2` to `^3.2.4`. Vitest 3.2.x supports `vite ^5.0.0 || ^6.0.0 || ^7.0.0-0` so the peer graph resolves cleanly. Run `pnpm install` in `app/` on the Mac to regenerate the lockfile, then `pnpm test`.
2. **Python sidecar requires 3.10+, SCRIPT ADDED.** Added `sidecar/setup-dev-venv.sh` which enforces Python 3.10+ (prefers 3.12), wipes the old `.venv`, and rebuilds it with `requirements.txt` plus the `en_core_web_lg` spaCy model. Run `brew install python@3.12` first, then `sidecar/setup-dev-venv.sh`.
3. **`diagnosisCatalog` handlers missing from main bundle, FIXED.** `registerDiagnosisCatalogHandlers()` in `app/src/main/ipc/handlers.ts` used `require('../db/seed-catalog')` and `require('../db/connection')` inside the function body, which rollup did not trace into the bundled main process. Converted both to static top-of-file imports so electron-vite emits `out/main/db/seed-catalog.js` and the catalog loads normally.

Remaining known issues (non-blocking):

- Other `require('../seed-demo-cases')`, `require('../updater')`, and `require('../sidecar')` callsites in `handlers.ts` use the same dynamic pattern and could exhibit the same symptom in packaged builds. Convert to static imports in a follow-up commit if any are reported missing at runtime.

## Safety guarantees

- Every source location used to build this copy was read-only during the build.
- `Psygil/`, `Psygil_Backup_20260403_175103/`, `Psygil_RECOVERY_20260413/` in the parent directory are untouched.
- `.gitattributes` was committed BEFORE any source files, so LFS is in effect from commit 1.
- No file in this tree exceeds 50 MB. GH001 cannot recur.
- No GitHub PAT is present in `.git/config` (fresh init, no inherited remote).

## Next steps

1. Test locally: `pnpm install` and `pnpm build` in `app/`, `pytest` in `sidecar/`.
2. Verify UI: `pnpm dev` and confirm BrandingPanel renders in the Settings tab.
3. When satisfied, push to GitHub on a new branch (`recovery/20260413`).
4. Open a PR against `main`. Do not force-push.
