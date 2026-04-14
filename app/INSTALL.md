# Psygil — Install Guide

This document covers two scenarios:

1. **Builder workflow** — you have a checkout of the Psygil monorepo and want to produce an installer.
2. **End-user workflow** — you received an installer (`.dmg`, `.exe`, or `.AppImage`) and want to run Psygil on a fresh machine.

---

## 1. Builder workflow (build the installer yourself)

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20.x or 22.x LTS | `nvm install 20` is fine |
| pnpm | 9.x | `corepack enable && corepack prepare pnpm@latest --activate` |
| Python | 3.10+ | Needed by the PII sidecar; the build itself does not call Python |
| Xcode Command Line Tools | latest | macOS only, for native module compilation |
| Visual Studio 2022 Build Tools (C++) | latest | Windows only |
| build-essential, libsecret-1-dev | latest | Linux only |

### One-time setup

```bash
cd app
pnpm install            # installs JS deps + rebuilds better-sqlite3 for Electron's ABI
```

The `postinstall` hook runs `electron-rebuild-clean.js` which compiles the
native modules (`better-sqlite3-multiple-ciphers`, `argon2`) against the
Electron 33 ABI. If you ever swap Electron versions, re-run `pnpm install`.

### Produce a macOS installer (Apple Silicon, unsigned)

```bash
cd app
pnpm dist:mac:unsigned
```

Output: `app/dist/Psygil-0.1.0-arm64.dmg` (about 200 MB).

This build is **unsigned** and **un-notarized**, so the first time you open
it on a fresh Mac you must right-click → Open and confirm the Gatekeeper
warning. For a signed and notarized release see [§3 Signing & Notarization](#3-signing--notarization).

### Produce a Windows installer

```bash
cd app
pnpm dist:win
```

Output: `app/dist/Psygil Setup 0.1.0.exe`. Without an Authenticode cert this
build triggers a SmartScreen warning on first launch.

### Produce a Linux AppImage

```bash
cd app
pnpm dist:linux
```

Output: `app/dist/Psygil-0.1.0.AppImage`.

### Build artifacts

After any of the `dist:*` commands, `app/dist/` contains:

```
dist/
├── Psygil-0.1.0-arm64.dmg              # macOS installer
├── Psygil-0.1.0-arm64-mac.zip          # macOS zipped .app (for testing)
├── mac-arm64/
│   └── Psygil.app                      # unpacked .app (for fast iteration)
├── builder-effective-config.yaml       # the resolved electron-builder config
└── latest-mac.yml                      # auto-update manifest
```

You can run the unpacked `.app` directly without installing:

```bash
open dist/mac-arm64/Psygil.app
```

---

## 2. End-user workflow (install on a fresh machine)

### Step 1 — Install runtime prerequisites

Psygil needs **Python 3.10 or newer** for its PII detection sidecar. The
sidecar runs locally; nothing leaves the machine.

#### macOS

```bash
# Recommended: Homebrew
brew install python@3.12
```

Or download the official installer from <https://www.python.org/downloads/macos/>.

#### Windows

Download from <https://www.python.org/downloads/windows/> and check
**"Add python.exe to PATH"** in the installer.

#### Linux

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip
```

### Step 2 — Install Psygil

#### macOS

1. Double-click `Psygil-0.1.0-arm64.dmg`
2. Drag `Psygil.app` into `/Applications`
3. The first time you launch it, **right-click → Open** (Gatekeeper warning)

#### Windows

1. Double-click `Psygil Setup 0.1.0.exe`
2. Click "More info" → "Run anyway" if SmartScreen warns
3. Choose an install location (default: `C:\Program Files\Psygil`)

#### Linux

```bash
chmod +x Psygil-0.1.0.AppImage
./Psygil-0.1.0.AppImage
```

### Step 3 — Bootstrap the PII sidecar (one-time)

Psygil needs a Python virtualenv with Presidio + spaCy + the
`en_core_web_lg` model (about 1.5 GB total). A bootstrap script is bundled
inside the app.

#### macOS

```bash
/Applications/Psygil.app/Contents/Resources/bootstrap-sidecar.sh
```

#### Windows

```powershell
PowerShell -ExecutionPolicy Bypass -File `
  "C:\Program Files\Psygil\resources\bootstrap-sidecar.ps1"
```

#### Linux (AppImage)

```bash
# Extract the AppImage to access bundled resources
./Psygil-0.1.0.AppImage --appimage-extract
./squashfs-root/resources/bootstrap-sidecar.sh
```

The script:
1. Verifies Python 3.10+ is on `PATH`
2. Creates a venv inside the bundled `sidecar/` directory
3. Installs `presidio-analyzer`, `presidio-anonymizer`, `spacy`, `jsonrpcserver`
4. Downloads `en_core_web_lg` (about 600 MB)

Total time: 5 to 10 minutes on a typical broadband connection.

### Step 4 — First launch

1. Open Psygil
2. The Setup wizard appears on first launch:
   - **Workspace location** — pick a directory where Psygil will store the encrypted SQLCipher database, audit log, and case folders. Recommended: `~/Documents/Psygil`. Pick a location with at least 5 GB free.
   - **Anthropic API key** — paste your `sk-ant-api03-...` key. This is encrypted with macOS Keychain / Windows DPAPI / libsecret and never leaves the machine.
   - **Clinician profile** — your name, license number, jurisdiction. This populates report headers and the audit trail.
3. Click **Finish**. The main IDE opens.

### Step 5 — Verify the install

In the IDE, open the Help menu and click **Run system check**. You should see:

```
[OK] Database opened (SQLCipher 4.x.x)
[OK] PII sidecar running (pid 12345)
[OK] Anthropic API reachable (200)
[OK] Audit log writable
[OK] Workspace folder writable
```

If the **PII sidecar** check fails, re-run the bootstrap script from Step 3.

---

## 3. Signing & Notarization (release builds only)

For shipping signed releases, set these environment variables before
running the dist command:

### macOS

```bash
export APPLE_ID="developer@foundrysmb.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"
export CSC_LINK="path/to/DeveloperIDApplication.p12"
export CSC_KEY_PASSWORD="..."

pnpm dist:mac
```

Edit `electron-builder.yml` and change:
```yaml
mac:
  identity: null
  notarize: false
```
to:
```yaml
mac:
  identity: "Developer ID Application: Foundry SMB (ABCDE12345)"
  notarize:
    teamId: ${env.APPLE_TEAM_ID}
```

### Windows

```bash
export WIN_CERT_SUBJECT="Foundry SMB"
# Configure cert in scripts/sign-win.js
pnpm dist:win
```

---

## 4. Troubleshooting

### "Cannot find module 'better-sqlite3-multiple-ciphers'"

Re-run `pnpm install`. If that doesn't fix it:

```bash
rm -rf node_modules
pnpm install
node scripts/electron-rebuild-clean.js
```

### "Sidecar exited unexpectedly"

The Python venv is missing or broken. Re-run `bootstrap-sidecar.sh`. To
verify the sidecar manually:

```bash
# macOS, in the installed app
cd /Applications/Psygil.app/Contents/Resources/sidecar
./venv/bin/python server.py
# Should print: {"status":"ready","pid":12345}
# Press Ctrl-C to stop
```

### "Invalid API key" from Anthropic

Open Psygil → Settings → API Keys → re-enter your key. Verify it works
with `curl`:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: sk-ant-api03-..." \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-5","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}'
```

### "App is damaged and can't be opened" (macOS)

This is Gatekeeper rejecting an unsigned build. Either:

```bash
xattr -cr /Applications/Psygil.app
```

or right-click the app → Open → confirm.

### Native module ABI mismatch on Linux

```bash
cd app
pnpm rebuild
node scripts/electron-rebuild-clean.js
pnpm dist:linux
```

---

## 5. Uninstalling

### macOS
```bash
rm -rf /Applications/Psygil.app
rm -rf "~/Library/Application Support/psygil-app"
rm -rf "~/Library/Logs/psygil-app"
```
Your workspace folder (cases, database) is **not** removed automatically.
Delete it manually if you want a clean slate.

### Windows
Use **Settings → Apps → Psygil → Uninstall**, then delete:
```
%APPDATA%\psygil-app
%LOCALAPPDATA%\psygil-app
```

### Linux
Delete the AppImage and:
```bash
rm -rf ~/.config/psygil-app
```

---

## 6. What is and is not included

**Included in the installer:**
- Electron runtime
- Compiled main + renderer + preload bundles
- SQLCipher (via `better-sqlite3-multiple-ciphers`)
- Python sidecar source files
- Bootstrap scripts
- Default Psygil icon and entitlements

**Not included (must be installed separately):**
- Python 3.10+ interpreter
- The Python venv with Presidio + spaCy + `en_core_web_lg` (created by `bootstrap-sidecar.sh`)
- Anthropic API key (entered on first launch)
- Workspace folder (chosen on first launch)
- Clinician profile data (entered on first launch)

This split keeps the installer under 250 MB while letting Psygil ship a
real, locally running PII detection pipeline.
