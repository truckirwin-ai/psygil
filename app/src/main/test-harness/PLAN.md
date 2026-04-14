# Test Harness + Promotional Video Plan

## Architecture

```
test-harness/
  manifest.ts          # Type definitions for test case manifests
  runner.ts            # Step-by-step executor (DB + filesystem operations)
  index.ts             # Registry of all manifests + public API
  harness-handlers.ts  # IPC handlers (testHarness:list, testHarness:run)
  PLAN.md              # This file
  cases/
    deshawn-riggins.ts # CST case, full pipeline (49 steps) [DONE]
    tanya-whitfield.ts # Custody, stops mid-diagnostics [PLANNED]
    cory-belliveau.ts  # Risk Assessment, stops at review [PLANNED]
    luz-espinoza.ts    # PTSD Dx, full pipeline [PLANNED]
    kyle-neuhaus.ts    # Malingering, stops at interview [PLANNED]
    doreen-platt.ts    # Capacity, full pipeline [PLANNED]
  fixtures/            # Temp directory for generated files during runs
```

## How to Run

### From DevTools Console (while app is running)
```js
// List available test cases
const manifests = await window.psygil.testHarness.list()
console.table(manifests.data)

// Run the DeShawn Riggins case
const result = await window.psygil.testHarness.run({ manifestId: 'cst-riggins-001' })
console.log(result.data)

// Run all cases
const results = await window.psygil.testHarness.runAll()
```

### From Vitest (headless CI)
```bash
npx vitest run src/main/__tests__/harness.test.ts
```

## Screenshot Capture Strategy

Each manifest has `screenshot` steps at key moments:
1. Case created (empty onboarding)
2. Onboarding documents ingested
3. Testing stage entered
4. Test scores entered
5. Interview stage entered
6. Interviews documented
7. Diagnostics stage entered
8. Evidence map ready
9. Diagnostic decisions complete
10. Review stage entered
11. Report drafted
12. Case complete

### Capture Methods (in priority order)

1. **Screen Studio** (macOS, highest quality)
   - Record the full session as a video
   - Export key frames at screenshot step markers
   - Post-process with zoom/pan effects

2. **Electron webContents.capturePage()**
   - Programmatic screenshots from main process
   - No external tool needed
   - Can be triggered at screenshot steps automatically

3. **Claude computer-use screenshot tool**
   - Available during development sessions
   - Lower resolution but immediate

## Video Production Pipeline

```
Screen Studio capture (1080p/4K)
    |
    v
FFmpeg: trim segments per pipeline stage
    |
    v
Remotion: compose with transitions, titles, callouts
    |
    v
ElevenLabs: generate voiceover narration
    |
    v
fal.ai: generate any supplementary visuals
    |
    v
Descript/CapCut: final edit, captions, export
```

### Narration Script Outline

1. **Opening** (5s): Psygil logo, tagline
2. **Case Intake** (15s): "A new competency evaluation arrives..."
3. **Document Ingestion** (15s): "Court orders, medical records, collateral
   contacts - all organized automatically"
4. **Testing** (15s): "MMPI-3, PAI, WAIS-IV scores entered and validated"
5. **Clinical Interview** (10s): "Interview notes captured, ready for analysis"
6. **AI-Assisted Diagnostics** (20s): "The AI maps evidence to DSM-5-TR criteria.
   The doctor makes every diagnostic decision."
7. **Report Generation** (15s): "Draft report generated, legally reviewed,
   clinician-attested"
8. **Completion** (10s): "From intake to final report. One platform."
9. **Closing** (5s): CTA, website, tagline

### Content Quality Rules (per .claude/rules/content-quality.md)
- No AI placeholder names in video content
- No em dashes in any text overlays or narration
- All clinical content must be psychometrically accurate
- DSM-5-TR codes must be correct
- Test score ranges must be valid

## Test Case Matrix

| Case | Type | Instruments | Stop Point | Tests |
|------|------|-------------|------------|-------|
| DeShawn Riggins | CST | MMPI-3, PAI, WAIS-IV, MacCAT-CA | Complete | Full pipeline, all stages |
| Tanya Whitfield | Custody | MMPI-3, PAI, PCRI-2, ASPECT | Mid-diagnostics | Partial completion, custody instruments |
| Cory Belliveau | Risk | HCR-20v3, PCL-R, MMPI-3, VRAG-R | Review | Risk-specific instruments, pre-completion |
| Luz Espinoza-Trujillo | PTSD Dx | CAPS-5, PCL-5, TSI-2, MMPI-3 | Complete | Trauma battery, full pipeline |
| Kyle Neuhaus | Malingering | TOMM, SIRS-2, MMPI-3 (validity), M-FAST | Interview | Effort testing, stops mid-workflow |
| Doreen Platt | Capacity | MoCA, WAIS-IV, ABAS-3, WCST | Complete | Geriatric/capacity, full pipeline |
