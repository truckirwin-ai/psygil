# Building the Psygil Python Sidecar

The Psygil sidecar runs Microsoft Presidio + spaCy for HIPAA-compliant PII
detection. In development the Electron main process spawns it directly from
this directory using the system Python. For releases we bundle it with
PyInstaller so end users do not need to install Python or the spaCy model
themselves.

## Quick build

```bash
sidecar/build.sh --clean
```

This creates `sidecar/.venv-build/`, installs `requirements.txt` and
PyInstaller, downloads the `en_core_web_lg` spaCy model, runs PyInstaller
against `psygil_sidecar.spec`, smoke-tests the binary, and stages the
result into `app/resources/sidecar/<platform>/psygil-sidecar/`.

## Sign for macOS release

After building on macOS, sign the bundle so the parent Electron app's
notarization stays valid:

```bash
sidecar/sign-macos.sh "Developer ID Application: Foundry SMB (TEAMID)"
```

This signs every inner Mach-O file (dylibs, so files) inside the bundle,
then signs the launcher with `--options runtime` and the entitlements
plist from `app/entitlements.mac.plist`. It then verifies with `codesign
--deep --strict` and runs an `spctl` Gatekeeper preview.

## How the Electron app finds the binary

In development the spawn helper at `app/src/main/sidecar/index.ts` looks
in this order:

1. `process.env.PSYGIL_SIDECAR_BIN` if set (override for tests)
2. `app/resources/sidecar/<platform>/psygil-sidecar/psygil-sidecar` if
   the staged binary exists (production / packaged build)
3. The system `python3` running `sidecar/server.py` (development fallback)

The locator helper is `app/src/main/sidecar/locate.ts`. If the bundled
binary is missing in a production build, the app refuses to start, this is the hard dependency check from doc 17 §1.

## Per-platform builds

PyInstaller cannot cross-compile. Run `sidecar/build.sh` once per
target platform:

| Platform | Where to run | Output dir |
|---|---|---|
| macOS arm64 | macOS Apple Silicon | `app/resources/sidecar/darwin/` |
| macOS x64 | macOS Intel | `app/resources/sidecar/darwin/` |
| Windows x64 | Windows + Git Bash or WSL | `app/resources/sidecar/win32/` |
| Linux x64 | Linux | `app/resources/sidecar/linux/` |

For dual-arch macOS, build twice on the appropriate machines and use a
`lipo` step to merge the launcher binaries (the spaCy model and dylibs
are arch-specific so the directory bundle stays separate per arch).

## Bundle size

A clean macOS arm64 build is approximately:

| Component | Size |
|---|---|
| Launcher + Python runtime | ~25 MB |
| Presidio + dependencies | ~120 MB |
| spaCy + en_core_web_lg | ~800 MB |
| Total directory bundle | ~950 MB |

The .dmg compresses this to roughly 280 MB. This is the price of running
HIPAA-grade NER offline with zero cloud dependencies.

## Smoke test contract

A successful build prints `{"status":"ready","pid":NNNN}` on stdout
within five seconds of launch and listens on `/tmp/psygil-sidecar.sock`.
The `build.sh` script enforces this; if the binary fails the smoke test
the build aborts with a non-zero exit code.

## CI integration (future)

The build script is designed to be runnable from CI. Suggested workflow:

1. Checkout
2. Set up Python 3.11+
3. Run `sidecar/build.sh --no-venv` (CI runner already isolated)
4. Run `sidecar/sign-macos.sh "$DEVELOPER_ID"` on macOS jobs
5. Upload `app/resources/sidecar/<platform>/` as an artifact
6. Download into the app build job before `electron-builder`
