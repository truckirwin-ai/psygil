# =============================================================================
# PyInstaller spec for Psygil Python Sidecar
# =============================================================================
#
# Build with:  pyinstaller --clean sidecar/psygil_sidecar.spec
#
# Output: dist/psygil-sidecar (single executable on the build platform)
#
# What's bundled:
#   - server.py (entry point) and transcribe.py (audio module)
#   - presidio-analyzer + presidio-anonymizer
#   - spaCy + the en_core_web_lg model (~800 MB on disk after extraction)
#   - All transitive dependencies (numpy, sklearn, regex, etc.)
#
# What's NOT bundled:
#   - The test files (sidecar/test_*.py, conftest.py, gate_verification.py)
#   - PyInstaller's own runtime, that's compiled into the binary
#
# Cross-platform notes:
#   - Run this spec on each target platform separately. PyInstaller cannot
#     cross-compile. The Electron build pipeline copies the appropriate
#     dist/psygil-sidecar binary into resources/sidecar/{platform}/ before
#     packaging the .dmg/.exe.
#   - On macOS, after building you must codesign the binary so the parent
#     Electron app's notarization stays valid. The codesign command lives
#     in app/scripts/sign-sidecar.sh.
#
# Why one-file vs one-dir:
#   We use --onedir (default) because:
#     1. spaCy and Presidio models load faster from a directory than from
#        a self-extracting one-file build (no temp-dir extraction at every
#        launch).
#     2. macOS Gatekeeper notarization is simpler with a directory bundle
#        than with self-extracting binaries.
#     3. Diff-based auto-updates can patch only the files that changed
#        instead of replacing the whole binary.
# =============================================================================

# pylint: disable=undefined-variable
# (PyInstaller injects Analysis, PYZ, EXE, COLLECT into the spec namespace)

import os
import sys
from pathlib import Path

# ---- Locate project root and entry point ------------------------------------

# This spec lives in {repo}/sidecar/. SPECPATH is set by PyInstaller.
SIDECAR_DIR = Path(SPECPATH).resolve()  # noqa: F821
ENTRY_POINT = str(SIDECAR_DIR / "server.py")

# ---- Discover the spaCy model so it gets bundled ----------------------------
#
# spaCy models are installed as a separate Python package (e.g.
# `en_core_web_lg`). PyInstaller does not pick up their data files
# automatically. We collect them via the spaCy package itself.

datas = []
hiddenimports = []

# Bundle the spaCy English large model if it is installed
try:
    import spacy.util
    model_path = spacy.util.get_package_path("en_core_web_lg")
    datas.append((str(model_path), "en_core_web_lg"))
    hiddenimports.append("en_core_web_lg")
except Exception:  # noqa: BLE001
    print(
        "WARNING: en_core_web_lg not found. Run "
        "`python -m spacy download en_core_web_lg` before building."
    )

# Presidio recognizers ship with YAML/JSON resource files we must bundle
try:
    import presidio_analyzer
    presidio_dir = Path(presidio_analyzer.__file__).parent
    datas.append((str(presidio_dir / "conf"), "presidio_analyzer/conf"))
except Exception:  # noqa: BLE001
    pass

# Hidden imports, modules PyInstaller's static analysis misses
hiddenimports += [
    "presidio_analyzer",
    "presidio_analyzer.nlp_engine.spacy_nlp_engine",
    "presidio_analyzer.predefined_recognizers",
    "presidio_anonymizer",
    "spacy.lang.en",
    "spacy.matcher",
    "spacy.tokens",
    "thinc.api",
    "blis",
    "srsly.msgpack.util",
]

# ---- Analysis ---------------------------------------------------------------

a = Analysis(  # noqa: F821
    [ENTRY_POINT],
    pathex=[str(SIDECAR_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude things we know we never use to keep the bundle small
        "tkinter",
        "matplotlib",
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "wx",
        "IPython",
        "jupyter",
        "notebook",
        "pytest",
        "pylint",
    ],
    noarchive=False,
)

# ---- Bytecode archive --------------------------------------------------------

pyz = PYZ(a.pure)  # noqa: F821

# ---- Executable --------------------------------------------------------------

exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="psygil-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX breaks macOS notarization; do not enable
    console=True,  # the sidecar prints {"status":"ready"} on stdout
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,  # signed separately by app/scripts/sign-sidecar.sh
    entitlements_file=None,
)

# ---- Collect into onedir layout ----------------------------------------------

coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="psygil-sidecar",
)
