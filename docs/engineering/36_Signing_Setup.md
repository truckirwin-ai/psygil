# macOS Signing and Notarization Setup

Status: Draft, v1 (2026-04-16)
Owner: Truck Irwin (CEO), engineering for automation
Related: `scripts/signing/`, `sidecar/sign-macos.sh`, `app/electron-builder.yml`

This doc walks through getting a Psygil macOS build signed and notarized so the resulting `.dmg` launches on any Mac without Gatekeeper warnings.

## One-time setup (you do this)

### 1. Confirm your Apple Developer registration

Log in at https://developer.apple.com/account. You need an active Apple Developer Program membership (100 USD per year) associated with a company name that matches how you want the signature to read.

If the Apple legal entity name is wrong, fix it before generating certificates. Changing it later is painful.

### 2. Collect the Team ID

On the Membership details page, copy the Team ID. It is exactly 10 characters, uppercase alphanumeric (e.g., `J3K8L9M2N4`).

### 3. Register the App ID

Navigate to https://developer.apple.com/account/resources/identifiers/list.

Click the plus sign, select App IDs, then App. Use:
- Description: `Psygil`
- Bundle ID: select Explicit and enter `com.foundrysmb.psygil`
- Capabilities: leave everything unchecked (Psygil does not need Push, iCloud, App Groups, etc.)

Continue and Register.

### 4. Generate a Certificate Signing Request (CSR)

On your Mac:
1. Open Keychain Access (spotlight: Keychain Access)
2. Menu: Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority
3. User Email Address: your Apple ID email
4. Common Name: `Foundry SMB` (or your legal entity name, exactly as registered)
5. CA Email Address: leave blank
6. Request is: Saved to disk (not Emailed to CA)
7. Continue, save `CertificateSigningRequest.certSigningRequest` to Desktop

### 5. Create the Developer ID Application certificate

Back in the browser at https://developer.apple.com/account/resources/certificates/list:

Click the plus sign, then under Software select Developer ID Application (NOT Apple Development, NOT Apple Distribution, NOT Mac Installer).

Upload the CSR file from step 4. Apple processes it and gives you a `developerID_application.cer` file. Download and double-click to install in Keychain Access (login keychain).

Verify:
```bash
security find-identity -v -p codesigning
```
Expected output includes a line like:
```
1) ABC123DEF4567890ABC123DEF4567890 "Developer ID Application: Foundry SMB (J3K8L9M2N4)"
```
Copy the entire quoted string for use in `credentials.env`.

### 6. Generate an app-specific password for notarization

Apple deprecated regular-password authentication for notarytool. You need an app-specific password:

1. Go to https://appleid.apple.com
2. Sign in with the Apple ID tied to your Developer account
3. Under Sign-In and Security, find App-Specific Passwords
4. Click the plus sign, label it `Psygil notarization`
5. Copy the password (format: `abcd-efgh-ijkl-mnop`)

You cannot view this password again after closing the dialog. Store it in 1Password, Bitwarden, or another password manager before continuing.

## Per-machine setup

### 7. Install Xcode command line tools

Needed for `codesign` and `xcrun notarytool`.
```bash
xcode-select --install
```

### 8. Fill in credentials.env

```bash
cd /Users/truckirwin/Desktop/Foundry\ SMB/Products/Psygil
cp scripts/signing/credentials.env.example scripts/signing/credentials.env
```

Open `scripts/signing/credentials.env` in a text editor and replace:
- `APPLE_DEVELOPER_ID` with the quoted string from step 5
- `APPLE_TEAM_ID` with the 10-character Team ID from step 2
- `APPLE_ID` with your Apple Developer email
- `APPLE_APP_SPECIFIC_PASSWORD` with the password from step 6

Save the file. `.gitignore` already excludes it from commits.

### 9. Preflight

```bash
scripts/signing/preflight.sh
```

Every row should show `[ ok ]`. If anything shows `[miss]` or `[warn]`, follow the remediation text printed underneath.

## Build a signed, notarized .dmg

```bash
scripts/signing/sign-and-package.sh
```

What this does:
1. Reruns preflight; refuses to continue if anything is missing
2. Signs every Mach-O inside the sidecar bundle (all the dylibs and .so files PyInstaller produced) and the sidecar launcher itself with `hardenedRuntime` and the entitlements at `app/entitlements.mac.plist`
3. Runs `electron-vite build` to produce the main and renderer bundles
4. Runs `electron-builder --mac` with your identity; electron-builder signs the Electron shell, stages the signed sidecar inside the .app bundle, produces the .dmg, and submits the .dmg to Apple notarytool
5. Waits for notarytool to return a successful ticket (usually 1 to 5 minutes, can be up to 30)
6. Staples the notarization ticket to the .dmg so Gatekeeper accepts it offline
7. Runs `codesign --verify --deep --strict` and `spctl -a -vvv -t install` to confirm the output is acceptable

Expected runtime: 10 to 20 minutes on Apple Silicon, longer if notarytool is slow.

Output: `app/dist/Psygil-<version>-arm64.dmg`

## Variants

### Signed but not notarized (faster, internal only)

```bash
scripts/signing/sign-and-package.sh --skip-notarize
```

Produces a signed .dmg without the notarytool round trip. First-launch Gatekeeper will warn and require a right-click Open to bypass. Useful for local testing of the signing path before committing to a full notarization cycle.

### Completely unsigned (dev only)

```bash
scripts/signing/sign-and-package.sh --unsigned
```

No credentials required. First-launch Gatekeeper will refuse to open the .dmg until the user moves it out of quarantine manually (`xattr -d com.apple.quarantine ...`). Useful for in-repo smoke testing only.

## Verifying a .dmg

After a signed build, verify externally:

```bash
DMG="app/dist/Psygil-1.0.0-rc1-arm64.dmg"

# Signature check
codesign --verify --deep --strict --verbose=2 "$DMG"

# Gatekeeper assessment
spctl -a -vvv -t install "$DMG"

# Notarization staple check
stapler validate "$DMG"
```

All three should exit zero with no warnings.

## Troubleshooting

### "No identity found"

Your cert is not installed or was installed in a keychain other than login. Open Keychain Access, verify under login keychain. Re-install the `.cer` if needed.

### "unable to build chain to self-signed root"

Intermediate certificate missing. Download and install "Developer ID Certification Authority" from https://www.apple.com/certificateauthority/ and re-run.

### notarytool submits but returns "Invalid"

Run:
```bash
xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID"
```
The log explains which binary failed and why. Common causes: unsigned .so or dylib inside the sidecar bundle (fix by re-running `sidecar/sign-macos.sh`), missing hardened runtime, missing timestamp flag.

### "The Developer ID certificate has been revoked"

Someone at Apple, or you, revoked the cert. Generate a new one at the Developer portal, install it, update `APPLE_DEVELOPER_ID` in `credentials.env`.

### First launch on another Mac still shows a Gatekeeper warning

Notarization succeeded but the ticket was not stapled. Re-staple:
```bash
xcrun stapler staple app/dist/Psygil-*.dmg
```
Or rebuild; stapling is automatic when electron-builder finishes notarization.

## CI migration (later)

When you want GitHub Actions to build signed releases automatically, add these Repository Secrets (Settings > Secrets and variables > Actions):

| Secret | Value |
|---|---|
| `APPLE_DEVELOPER_ID_APPLICATION` | The quoted string from step 5 |
| `APPLE_TEAM_ID` | 10-char team id |
| `APPLE_ID` | email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the xxxx-xxxx-xxxx-xxxx password |
| `CSC_LINK` | base64-encoded .p12 of the Developer ID cert (see below) |
| `CSC_KEY_PASSWORD` | password you set when exporting the .p12 |

To export the cert as .p12:
1. Keychain Access > login > My Certificates
2. Right-click the Developer ID Application cert > Export
3. Save as Certificate.p12 with a strong password
4. Base64-encode: `base64 -i Certificate.p12 | pbcopy`
5. Paste into the `CSC_LINK` GitHub secret

The existing `.github/workflows/app-release.yml` workflow reads these secrets. No code changes required.
