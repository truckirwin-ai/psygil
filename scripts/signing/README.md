# macOS Signing Setup

Three-step flow for signing and notarizing Psygil .dmg builds. Designed so you can fill in credentials later, once your Apple Developer registration completes.

## Quick start (once your cert is ready)

```bash
# 1. Copy the credentials template and fill in the four values
cp scripts/signing/credentials.env.example scripts/signing/credentials.env
# ... edit credentials.env with real values ...

# 2. Verify every input is in place
scripts/signing/preflight.sh

# 3. Sign sidecar, build app, notarize .dmg
scripts/signing/sign-and-package.sh
```

The signed, notarized `.dmg` lands at `app/dist/`.

## Files

| File | Purpose |
|---|---|
| `credentials.env.example` | Template with placeholders for the four required values. Committed. |
| `credentials.env` | Your filled-in credentials. Gitignored. Never commit. |
| `preflight.sh` | Verifies keychain cert, credentials, sidecar binary, toolchain. Non-destructive. |
| `sign-and-package.sh` | Orchestrator: preflight -> sign sidecar -> electron-builder -> verify. |

## Options

```bash
# Signed + notarized release build (default)
scripts/signing/sign-and-package.sh

# Signed but not notarized (faster, for internal distribution)
scripts/signing/sign-and-package.sh --skip-notarize

# Unsigned build, bypassing credentials entirely (dev/testing only)
scripts/signing/sign-and-package.sh --unsigned
```

## Troubleshooting

### preflight reports "Developer ID Application cert not found in keychain"

You have not yet installed the cert. See `docs/engineering/36_Signing_Setup.md` for the full walkthrough (CSR generation, Apple Developer portal steps, Keychain installation).

### preflight says the credentials are still placeholders

Open `scripts/signing/credentials.env` in a text editor and replace every `REPLACE_WITH_*` and `xxxx-xxxx-xxxx-xxxx` with the real values from your Apple Developer account.

### notarization fails with "invalid credentials"

Most common cause: you pasted your regular Apple ID password instead of the app-specific password. Regular passwords no longer work with notarytool. Generate an app-specific password at https://appleid.apple.com under Sign-In and Security > App-Specific Passwords.

### notarization succeeds but Gatekeeper rejects the .dmg on another Mac

Stapling may not have completed. Run:
```bash
xcrun stapler staple app/dist/Psygil-*.dmg
spctl -a -vvv -t install app/dist/Psygil-*.dmg
```

## Security

- `credentials.env` is gitignored. Do not share it in Slack, email, or Drive.
- The app-specific password can be revoked at https://appleid.apple.com if it leaks.
- The Developer ID certificate private key lives in your keychain; export as `.p12` only for transfer to a CI runner.

## CI deployment (later)

For GitHub Actions, export credentials as secrets instead of a file:

```
APPLE_DEVELOPER_ID       -> APPLE_DEVELOPER_ID_APPLICATION secret
APPLE_TEAM_ID            -> APPLE_TEAM_ID secret
APPLE_ID                 -> APPLE_ID secret
APPLE_APP_SPECIFIC_PASSWORD -> APPLE_APP_SPECIFIC_PASSWORD secret
Developer ID cert (.p12) -> CSC_LINK (base64) + CSC_KEY_PASSWORD secrets
```

The existing `.github/workflows/app-release.yml` reads these secrets; no change needed when CI comes online.
