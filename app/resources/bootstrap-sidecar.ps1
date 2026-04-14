# Psygil sidecar bootstrap (Windows PowerShell)
# ==============================================
#
# Run this once after installing Psygil. It creates a Python virtualenv
# inside the bundled sidecar\ directory and installs Presidio + spaCy +
# the en_core_web_lg model. Psygil's main process auto-detects this venv
# at startup.
#
# Requirements:
#   - Python 3.10 or newer (`python --version`)
#   - About 1.5 GB free disk
#   - Internet connection
#
# Usage (after installing Psygil):
#   PowerShell -ExecutionPolicy Bypass -File `
#     "C:\Program Files\Psygil\resources\bootstrap-sidecar.ps1"

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (Test-Path "$ScriptDir\sidecar") {
  $SidecarDir = "$ScriptDir\sidecar"
} elseif (Test-Path "$ScriptDir\..\..\sidecar") {
  $SidecarDir = (Resolve-Path "$ScriptDir\..\..\sidecar").Path
} else {
  Write-Error "Cannot locate sidecar\ directory relative to $ScriptDir"
  exit 1
}

$VenvDir = "$SidecarDir\venv"
$ReqFile = "$SidecarDir\requirements.txt"

if (-not (Test-Path $ReqFile)) {
  Write-Error "requirements.txt not found at $ReqFile"
  exit 1
}

$Python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $Python) {
  Write-Error "python not found on PATH. Install Python 3.10+ from https://www.python.org/downloads/"
  exit 1
}

$PyVersion = & python -c "import sys; print('{}.{}'.format(sys.version_info[0], sys.version_info[1]))"
Write-Host "==> Sidecar dir: $SidecarDir"
Write-Host "==> Python:      $Python ($PyVersion)"
Write-Host "==> Venv target: $VenvDir"

if (Test-Path $VenvDir) {
  Write-Host "==> Existing venv detected. Reusing."
} else {
  Write-Host "==> Creating venv..."
  & python -m venv $VenvDir
}

$VenvPython = "$VenvDir\Scripts\python.exe"

Write-Host "==> Upgrading pip"
& $VenvPython -m pip install --quiet --upgrade pip

Write-Host "==> Installing sidecar dependencies"
& $VenvPython -m pip install --quiet -r $ReqFile

Write-Host "==> Downloading spaCy model en_core_web_lg (about 600 MB)"
& $VenvPython -m spacy download en_core_web_lg

Write-Host ""
Write-Host "Bootstrap complete. You can now launch Psygil."
