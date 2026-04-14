# Build resources

This directory holds assets that electron-builder bundles into the
distributable installers (`dist/`) but that are not part of the running
JavaScript bundle.

## Contents

| File | Used by | Notes |
|------|---------|-------|
| `icon.icns` | macOS .app + .dmg | Multi-resolution Apple icon (16 to 1024 px). Generated from `psygil_logo.svg` via `sips` + `iconutil`. |
| `icon.png` | Linux AppImage | 1024 by 1024 PNG fallback. |
| `icon.ico` | Windows installer | **Not yet generated.** Run `magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico` on a machine with ImageMagick. Until then Windows builds will use the Electron default icon. |
| `bootstrap-sidecar.sh` | macOS, Linux | First-launch script that creates a Python venv inside the bundled `sidecar/` directory and installs Presidio + spaCy. End users run this once after install. |
| `bootstrap-sidecar.ps1` | Windows | PowerShell equivalent of the bootstrap script. |

## Regenerating the macOS icon

If `psygil_logo.svg` changes, regenerate `icon.icns` from the repo root:

```bash
cd app/resources
sips -s format png ../../psygil_logo.svg --out icon-base.png -Z 1024
mkdir -p icon.iconset
for sz in 16 32 64 128 256 512 1024; do
  sips -z $sz $sz icon-base.png --out icon.iconset/icon_${sz}x${sz}.png
done
cp icon.iconset/icon_32x32.png   icon.iconset/icon_16x16@2x.png
cp icon.iconset/icon_64x64.png   icon.iconset/icon_32x32@2x.png
cp icon.iconset/icon_256x256.png icon.iconset/icon_128x128@2x.png
cp icon.iconset/icon_512x512.png icon.iconset/icon_256x256@2x.png
cp icon.iconset/icon_1024x1024.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
cp icon-base.png icon.png
rm -rf icon.iconset icon-base.png
```
