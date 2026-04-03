# Session Summary — April 3, 2026 (Session 3, Full)

**Project:** Psygil / Foundry SMB
**CEO:** Truck Irwin (truckirwin@gmail.com)
**Session Date:** April 3, 2026
**Sessions:** Part 1 (main), Part 2 (main continued), Part 3 (cowork session)

---

## Part 1 & 2 — Main Session

### 1. Clinician Formulation Template System Redesign

- Added `FormulationTemplate` interface (`{ title: string; body: string }`) to `DiagCondition`
- Dropdown shows short clinical titles; selecting inserts full clinical paragraph into textarea
- **~190 clinical formulation templates** across 25 diagnostic conditions covering all eval types:
  - **CST/Competency:** Schizophrenia (10), Schizoaffective (10), Intellectual Disability (10), Substance-Induced Psychotic (10), Malingering (11)
  - **Custody:** MDD (10), Adjustment Disorder (10), Personality Disorder Features (10), SUD (10)
  - **Risk Assessment:** ASPD (10), HCR-20v3 (11), SUD (6), IED (7)
  - **PTSD:** PTSD (11), Acute Stress Disorder (6), Malingered PTSD (10), Comorbid MDD (7)
  - **Capacity:** Major NCD (11), Depressive Pseudodementia (8), Delirium (6)
  - **Generic/Other:** MDD (8), Adjustment Disorder (6), SUD (6), Malingering (6)
  - **Cross-cutting:** TBI (8)
- Templates live inside `getDiagnosticConsiderations()` in CenterColumn.tsx

### 2. Clinician Formulation Textarea Height Fix

- Formulation column now uses `display: flex` / `flexDirection: column`
- Textarea gets `flex: 1` and `minHeight: 120` to fill available height

### 3. Dashboard "Untyped" Fix

- `listCases()` and `getCaseById()` now use `COALESCE(c.evaluation_type, pi.eval_type)` via LEFT JOIN to `patient_intake`
- Backward compatible — checks for `patient_intake` table existence before joining

### 4. Vasquez Custody Case Intake (Part 1)

- Completed Vasquez case intake through the UI
- Traced evaluation type system end-to-end
- Moved Complaint field to column 1 in Diagnostics
- Converted long-form fields (Complaint, Charges) to NarrativeBlock layout pattern

### 5. Unsaved State Audit

- Comprehensive audit of all `useState` variables in CenterColumn.tsx
- Identified 5 RED (critical data loss) and 1 YELLOW (partial loss) state variables
- Documented in `UNSAVED_STATE_AUDIT.md` with recommended save mechanisms and implementation priorities

---

## Part 3 — Cowork Session

### 6. Live Audio Transcription Pipeline (Complete Rewrite)

**Problem:** MediaRecorder produces WebM/Opus chunks that aren't standalone files — only the first chunk has the EBML container header. FFmpeg can't decode individual 250ms chunks.

**Solution — Three-layer fix:**

- **Renderer (CenterColumn.tsx):** Added `ScriptProcessorNode` capturing raw PCM float32 at 16kHz. Sends base64-encoded samples to sidecar via IPC every ~256ms. MediaRecorder still runs in parallel for archival WebM only — its chunks are NOT streamed to the sidecar.
- **Sidecar (transcribe.py):** Replaced `add_audio()` (which expected FFmpeg-decoded s16le PCM) with `add_raw_pcm_float32()` — does `np.frombuffer(raw_bytes, dtype=np.float32)` directly. No FFmpeg subprocess needed.
- **Main process + preload:** No changes — they relay base64 strings regardless of payload format.

**Initial AudioWorklet attempt failed** due to Electron CSP blocking `blob:` URLs for `audioWorklet.addModule()`. Replaced with `ScriptProcessorNode` (deprecated but works reliably in Electron/Chromium for single 16kHz mono stream).

### 7. Sentence-Buffered Timestamps

**Problem:** Every ~3-second whisper chunk got its own timestamped newline, producing choppy, hard-to-read output.

**Solution:** Text accumulates in a buffer until a sentence boundary (`.` `?` `!`) is detected. Incomplete text shows with a `⏳` live preview prefix. When a sentence completes, it commits as a clean timestamped line: `[00:05] Full sentence here.`

- `pendingTranscript` ref holds uncommitted text
- `pendingTimestamp` ref tracks when the current sentence started
- `flushPendingTranscript()` commits remaining text when recording stops

### 8. Auto-Summary on Stop Recording

- When recording stops, calls Claude API to generate a structured clinical summary
- Summary includes: Session Overview, Key Topics, Notable Clinical Observations, Clinically Relevant Statements, Follow-up Considerations
- Transcript is cleaned (timestamps stripped) before sending to Claude
- Summary auto-saves to session state
- Error handling: shows inline error if API key not configured (no infinite spinner)
- **Requires:** Claude API key configured in Settings tab

### 9. Transcription Chunk Processing Fix

**Problem:** Race condition — sidecar's `_process_loop` had 3-second threshold but stop signal arrived before buffer was full. Loop broke immediately on `self.running = False` before final transcription.

**Fix:**
- `_process_loop` now uses 1-second timeout on `asyncio.wait_for()` for polling
- `stop()` method flushes remaining buffer via `_transcribe_buffer(final=True)` after loop exits
- Added comprehensive logging: chunk counter, buffer duration, whisper inference timing, final flush

### 10. Comprehensive Settings Tab (Complete Rebuild)

Replaced the minimal API-key-only settings with a full 9-section tabbed interface:

| Section | What It Contains |
|---------|-----------------|
| **Writing Samples** | Upload/manage forensic report samples for AI style analysis. PHI auto-stripped. |
| **Style Guide** | Writing conventions: person reference, verb tense, formality, citation style (APA 7), diagnostic terminology (DSM-5-TR vs ICD-10), section numbering, custom rules |
| **Templates** | Upload report structure templates (.docx/.txt) for Writer agent |
| **Documentation** | Upload scoring manuals, legal guidelines, state statutes, clinical standards |
| **Appearance** | Theme picker (Light/Warm/Dark) with mini-previews, font size slider (11-16px) |
| **AI & Models** | API key with encrypted keychain storage + Save button (fixed!), connection test, model selection (Sonnet/Opus/Haiku), PHI redaction status, transcription engine status, language selection |
| **Practice** | Clinician profile: name, credentials, license, practice, jurisdictions, NPI, contact info |
| **Data & Storage** | Workspace path + change, DB health (encryption/version/size), backup, audit export, demo data reset |
| **About** | Version, build, platform, tech stack, core principles |

**Bug fixed:** The old SettingsTab never actually saved the API key — it held it in local state only. New version calls `apiKey:store` on Save.

---

## Key Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `app/src/renderer/src/components/layout/CenterColumn.tsx` | 6,180 | PCM capture via ScriptProcessorNode, sentence-buffered timestamps, auto-summary, formulation templates (~190), textarea flex height, NarrativeBlock pattern |
| `app/src/renderer/src/components/tabs/SettingsTab.tsx` | 1,166 | Complete rebuild — 9-section tabbed settings interface |
| `app/src/main/ipc/handlers.ts` | 2,050 | Resource management IPC, AI handlers, workspace handlers |
| `sidecar/transcribe.py` | 513 | Raw PCM float32 ingestion, 1-second poll loop, final flush on stop, comprehensive logging |
| `app/src/main/cases/index.ts` | 351 | COALESCE eval_type from patient_intake, backward-compatible JOIN |
| `app/src/preload/index.ts` | 295 | New IPC channel bindings for resources, AI, workspace, settings |
| `app/src/shared/types/ipc.ts` | +90 lines | New type definitions for resources, settings, AI completion |
| `app/src/shared/types/index.ts` | +9 lines | New shared types |
| `app/src/renderer/src/types/tabs.ts` | +1 line | Settings tab type |
| `app/src/main/index.ts` | +19 lines | Whisper sidecar integration, resource seeding |
| `app/src/main/seed-demo-cases.ts` | +8 lines | Demo case seeding updates |
| `app/src/renderer/src/App.tsx` | +8 lines | App-level routing for new tab types |
| `app/src/renderer/src/components/layout/LeftColumn.tsx` | +496 lines | Settings entry in sidebar tree, resource tree |
| `app/src/renderer/src/components/layout/Titlebar.tsx` | +8 lines | Titlebar updates |
| `app/src/renderer/src/components/tabs/ClinicalOverviewTab.tsx` | +62 lines | Clinical overview tab updates |

## New Files

| File | Purpose |
|------|---------|
| `sidecar/transcribe.py` | Python sidecar — faster-whisper transcription server over Unix socket |
| `app/src/main/whisper/index.ts` | Whisper sidecar lifecycle management (spawn, connect, relay) |
| `app/src/main/db/reset-cases.ts` | Database reset utility for demo data |
| `app/src/main/seed-resources.ts` | Resource folder seeding (Writing Samples, Templates, Documentation) |
| `app/scripts/electron-rebuild-clean.js` | Clean rebuild script for native modules |
| `app/src/renderer/src/components/modals/IntakeOnboardingModal.tsx` | Intake/onboarding modal component |
| `test-resources/` | Test resource folders (Writing Samples, Templates, Documentation) |
| `docs/engineering/18_Forensic_Report_Style_Guide.docx` | Forensic report style guide reference document |
| `UNSAVED_STATE_AUDIT.md` | Comprehensive audit of unsaved UI state with remediation plan |

---

## Outstanding Issues / Next Steps

1. **Unsaved state persistence** — 5 critical state variables need database backing (see UNSAVED_STATE_AUDIT.md)
2. **EVAL_TYPE_OPTIONS centralization** — Duplicated in 3 files, no single source of truth
3. **Diagnostics tab as report builder** — Architectural direction discussed but not built
4. **API key required for auto-summary** — Must be configured in Settings > AI & Models
5. **CenterColumn.tsx is 6,180 lines** — Needs decomposition into feature-specific components

---

## Architecture Decisions Made

1. **Raw PCM over WebM for live transcription** — WebM chunks aren't standalone decodable; raw float32 PCM bypasses container format entirely
2. **ScriptProcessorNode over AudioWorklet** — Electron CSP blocks blob: URLs; ScriptProcessorNode is deprecated but reliable for single mono stream
3. **Sentence buffering over time-based chunking** — Natural language boundaries produce more readable transcripts
4. **9-section Settings over minimal config** — Comprehensive settings surface for a professional clinical tool
5. **COALESCE pattern for eval_type** — Graceful fallback from cases table to patient_intake table

---

## Working Pattern Reminders

- Truck communicates through screenshots with annotations — parse visually, implement the delta
- "DOCTOR ALWAYS DIAGNOSES" is a load-bearing architectural principle enforced at every layer
- The Electron app IS the spec — when in doubt, look at the running app
- Speed is the expectation: directive -> execute -> show -> next
- All-caps from Truck = non-negotiable architectural principle
- Read `BUILD_MANIFEST.md` and `CLAUDE.md` before writing any code in a new session
