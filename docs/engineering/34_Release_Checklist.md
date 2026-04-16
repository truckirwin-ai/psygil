# Release Checklist for Psygil v1.0

This document provides the manual verification checklist that must be completed before tagging an RC or stable release. Each section corresponds to a phase of the release process.

## Pre-Flight Verification

Before creating a release tag (v1.0.0, v1.0.0-rc1, etc.), verify all of the following:

- [ ] All CI workflows pass green on the target branch
  - All steps in `.github/workflows/ci.yml` must pass
  - All steps in `sidecar-build.yml` must pass
  - No skipped or failed checks

- [ ] Full test suite runs with zero failures
  - Run: `cd app && npm test`
  - All unit, integration, and IPC tests must pass
  - No baseline failures; if baseline failures exist, they must be documented in `app/tests/vitest.config.ts`

- [ ] TypeScript compilation clean on both configs
  - Run: `cd app && npx tsc -p tsconfig.node.json --noEmit`
  - Run: `cd app && npx tsc -p tsconfig.web.json --noEmit`
  - Zero errors on both

- [ ] HARD RULE scan passes (no em dashes, no en dashes, no AI watermarks)
  - Run: `cd app && node scripts/hardRuleScanCi.js`
  - Must return exit code 0
  - Verify no violations in source tree

- [ ] CHANGELOG.md has been updated
  - New version header added with current date
  - All user-facing changes documented
  - Release notes are clear and concise
  - No marketing fluff or AI-generated language

## Sidecar Build Verification (Per Platform)

For each platform (darwin-arm64, darwin-x64, linux-x64, win32-x64), complete the following before the release workflow runs:

### Darwin (ARM64)

- [ ] Binary smoke test passes
  - Run: `./app/resources/sidecar/darwin-arm64/psygil-sidecar/psygil-sidecar --version`
  - Should exit cleanly with version output or no-op

- [ ] Directory size is reasonable (~950 MB)
  - Run: `du -sh app/resources/sidecar/darwin-arm64/psygil-sidecar/`
  - Should be in the 800 MB to 1.1 GB range

- [ ] codesign verification passes (macOS only)
  - Run: `codesign --verify --verbose app/resources/sidecar/darwin-arm64/psygil-sidecar/psygil-sidecar`
  - Should return "valid on disk"

### Darwin (x64)

- [ ] Binary smoke test passes
  - Run: `./app/resources/sidecar/darwin-x64/psygil-sidecar/psygil-sidecar --version`

- [ ] Directory size is reasonable
  - Run: `du -sh app/resources/sidecar/darwin-x64/psygil-sidecar/`

- [ ] codesign verification passes
  - Run: `codesign --verify --verbose app/resources/sidecar/darwin-x64/psygil-sidecar/psygil-sidecar`

### Linux (x64)

- [ ] Binary smoke test passes
  - Run: `./app/resources/sidecar/linux-x64/psygil-sidecar/psygil-sidecar --version`

- [ ] Directory size is reasonable
  - Run: `du -sh app/resources/sidecar/linux-x64/psygil-sidecar/`

- [ ] File permissions are correct
  - Run: `ls -la app/resources/sidecar/linux-x64/psygil-sidecar/psygil-sidecar`
  - Executable bit must be set

### Windows (x64)

- [ ] Binary smoke test passes
  - Run (PowerShell): `& app/resources/sidecar/win32-x64/psygil-sidecar/psygil-sidecar.exe --version`

- [ ] Directory size is reasonable
  - Run: `(Get-Item -Recurse app/resources/sidecar/win32-x64/psygil-sidecar | Measure-Object -Property Length -Sum).Sum / 1GB`

## Application Build Verification (Per Platform)

For each platform (darwin-arm64, darwin-x64, linux-x64, win32-x64), complete the following after the release workflow completes:

### macOS (ARM64) - Psygil-{version}-arm64.dmg

- [ ] DMG opens without quarantine warnings
  - Download the artifact locally
  - Open the DMG on a fresh macOS ARM64 machine
  - No "unidentified developer" or gatekeeper warnings

- [ ] Application launches on fresh VM
  - Extract the app from the DMG
  - Copy to Applications/
  - Launch the app
  - Verify it opens without crashes
  - Check console logs for errors: no critical errors

- [ ] Ed25519 public key injected correctly
  - Extract app package: `ditto -x Psygil-{version}-arm64.dmg extracted/`
  - Verify key string in binary does not contain "PLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD"
  - Run: `strings extracted/Psygil.app/Contents/MacOS/Psygil | grep "MCow"`
  - Should show the injected key, not the placeholder

### macOS (x64) - Psygil-{version}.dmg

- [ ] DMG opens without quarantine warnings
- [ ] Application launches on fresh VM
- [ ] Ed25519 public key injected correctly

### Linux (x64) - psygil-{version}.AppImage

- [ ] AppImage opens without errors
  - Run on a fresh Ubuntu 20.04+ VM: `chmod +x psygil-{version}.AppImage && ./psygil-{version}.AppImage`
  - No quarantine or FUSE errors

- [ ] Application launches and renders correctly
  - Verify window appears
  - Verify UI is responsive
  - Check: no crashes in first 10 seconds

- [ ] Ed25519 public key injected correctly
  - Run: `strings psygil-{version}.AppImage | grep "MCow"`
  - Should show the injected key, not the placeholder

### Windows (x64) - Psygil-Setup-{version}.exe

- [ ] Installer runs on fresh Windows VM
  - Download and run the installer
  - No SmartScreen or defender warnings
  - Installation completes successfully

- [ ] Application launches after installation
  - Launch from Start menu
  - Verify window appears
  - Verify UI is responsive

- [ ] Ed25519 public key injected correctly
  - Extract installer: `7z x Psygil-Setup-{version}.exe` (requires 7-Zip or equivalent)
  - Search extracted files for "MCow"
  - Should show the injected key, not the placeholder

## License Server Verification

Before releasing, verify the license server is reachable and operational:

- [ ] License server health check passes
  - Run: `curl -s https://licenses.psygil.com/health`
  - Should return HTTP 200 with JSON response

- [ ] License issuance API reachable
  - Using the admin key: `curl -s -H "Authorization: Bearer $ADMIN_KEY" https://licenses.psygil.com/issue`
  - Should return HTTP 200 (or 400 if missing required params, but endpoint must exist)

- [ ] HMAC signature verification works client-side
  - Launch the app with `DEBUG=psygil:license:*` environment variable
  - Attempt to issue a license or verify an existing one
  - Signature verification should pass
  - No "invalid signature" errors in logs

## Auto-Update System Verification

Before releasing, verify the auto-update pipeline works end-to-end:

- [ ] Manifest posted to GitHub Releases
  - The release workflow uploads `manifest-stable.json` to GitHub Releases
  - File is accessible at: `https://github.com/psygil/psygil-app/releases/download/{version}/manifest-stable.json`
  - JSON is valid (can be parsed)
  - All four platform URLs in the manifest are reachable

- [ ] Previous version sees the update offer
  - Install the previous stable version (v0.9.x or earlier RC) on a test machine
  - Launch the app
  - Check for updates (Settings > Check for Updates or automatic background check)
  - Update notification appears with correct version number

- [ ] Download, verify, and install succeeds
  - Accept the update offer
  - Download completes without corruption (SHA-256 match)
  - Installation proceeds
  - App relaunches and shows correct new version
  - No errors in updater logs: `~/.psygil/logs/updater.log`

## HIPAA and Legal Compliance Verification

Before releasing, confirm legal and compliance documentation is in place:

- [ ] BAA (Business Associate Agreement) is signed and filed (if applicable)
  - For v1.0 if any cloud infrastructure is used
  - Document location: `docs/legal/BAA.pdf` or equivalent
  - Status recorded in this checklist with date

- [ ] Privacy Policy linked in About/Settings
  - Open app > Settings > About
  - Verify "Privacy Policy" link is present and clickable
  - Link points to: `https://psygil.com/privacy`
  - Policy is current (last updated date matches release date)

- [ ] Terms of Service linked in About/Settings
  - Open app > Settings > About
  - Verify "Terms of Service" link is present and clickable
  - Link points to: `https://psygil.com/terms`
  - ToS is current (last updated date matches release date)

- [ ] EULA/License Agreement available
  - Accessible in-app or at: `https://psygil.com/license`
  - Covers Ed25519 signature verification and auto-update terms

## Post-Release Procedures

After the release is published, complete the following:

- [ ] Release notes posted to documentation site
  - Run: `scripts/publish-release-notes.sh {version}`
  - Verify notes appear at: `https://docs.psygil.com/releases/{version}`
  - Notes include user-facing changes, bug fixes, and upgrade instructions

- [ ] Changelog merged to main branch
  - If release was created on a release branch, merge back to main
  - Commit message: `chore: merge release {version} back to main`

- [ ] Beta customers notified
  - Email template: `docs/templates/release-notification.txt`
  - Recipients: `BETA_TESTERS` mailing list from GitHub Secrets
  - Include download links, release notes, and feedback channel
  - Verify at least one recipient confirms receipt

- [ ] Sentry/monitoring dashboards updated
  - Create a "Release" marker in Sentry
  - Run: `sentry-cli releases create -p psygil {version}`
  - Tag the release commit: `git tag -a {version} -m "Release {version}"`

- [ ] GitHub Milestone closed (if applicable)
  - Close the GitHub Milestone for {version}
  - Verify all issues in the milestone are resolved or deferred

## Sign-Off

Release prepared by: _____________________ Date: _______

Verified by: _____________________ Date: _______

## Notes

Use this section to document any deviations, waived checks, or issues encountered:

(Leave blank if all checks pass as written)

