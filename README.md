# Psygil

Psygil is an Electron desktop application with a Python sidecar service for transcription and de-identification, plus a companion license-verification backend.

This repository is the recovered "golden copy" assembled on 2026-04-13 after a destructive `rm -rf` incident. It combines the Apr 10 GitHub HEAD (`ceb7e64`) with Cole's Apr 13 Day 1 work that existed only on an external backup disk. See `RECOVERY_NOTES.md` for provenance.

## Repository layout

```
app/                  Electron app (main, preload, renderer, shared)
sidecar/              Python transcription + de-id service (pyinstaller spec, pytest)
services/
  license-server/     License verification backend (v1, Apr 10 snapshot)
scripts/
  audit-deps.sh       Called by CI security audit
docs/
  engineering/        Engineering specs (01 through 29 numbered)
  legal/              Legal notes
  marketing/          Marketing notes
  wireframes/         UI wireframes (6 HTML files)
test-resources/       Fixtures used by pytest and vitest
.github/workflows/    CI: security audit + sidecar build
CLAUDE.md             Agent collaboration rules
```

## Prerequisites

- Node 20 or newer
- pnpm 9 or newer (`npm install -g pnpm`)
- Python 3.11 or newer
- Git LFS (`brew install git-lfs && git lfs install`)

## Install

```bash
# App
cd app
pnpm install

# Sidecar
cd ../sidecar
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# License server
cd ../services/license-server
npm install
```

## Run

```bash
# In one terminal: sidecar
cd sidecar && source .venv/bin/activate && python server.py

# In another terminal: Electron app in dev mode
cd app && pnpm dev
```

## Test

```bash
# App unit tests (vitest)
cd app && pnpm test

# Sidecar tests (pytest)
cd sidecar && source .venv/bin/activate && pytest

# License server
cd services/license-server && npm test
```

## Build

```bash
# App (macOS, signed)
cd app && pnpm build

# Sidecar binary
cd sidecar && ./build.sh
```

## Notable files recovered from Cole's Apr 13 work

- `app/src/main/branding/brandingManager.ts`
- `app/src/main/export/pdfExporter.ts`
- `app/src/main/export/wordExporter.ts`
- `app/src/renderer/src/components/tabs/settings/BrandingPanel.tsx`
- `app/src/renderer/src/components/tabs/SettingsTab.tsx` (BrandingPanel integration)

## Still missing (pending forensic recovery)

- Kit's `website/` (5 HTML marketing pages)
- Remy's `services/license-server/` v2 (Fastify + SQLite + Stripe)
- Apex's `AI-BUILD-PLAN.md`

See `RECOVERY_NOTES.md` in this repo or `Psygil_RECOVERY_20260413/RECOVERY_README.md` in the recovery workspace.

## License

See `LICENSE` (to be added).
