# Psychometrician Agent — Engineering Spec

**Status:** DRAFT (2026-04-06)
**Owner:** Truck Irwin
**Related docs:**
  - `03_agent_prompt_specs.md` (existing 4-agent specs)
  - `20_Stage_1_Testing.md` (Testing stage pipeline definition)
  - `22_Stage_3_Diagnostics.md` (downstream consumer)
  - `02_ipc_api_contracts.md` (IPC boundary contracts)

---

## 1. Rationale

The existing 4-agent pipeline (Ingestor → Diagnostician → Writer → Editor) has a gap at the **Testing** stage: there is no agent responsible for processing raw psychometric data. Clinicians currently upload test protocols (MMPI-3 answer sheets, PAI protocols, WAIS-IV subtest records, TOMM results, etc.) into the `Testing/` subfolder, but the pipeline has no component that:

1. Converts raw responses to scaled/T-scores using normative tables
2. Runs validity protocols (F, Fb, Fp, L, K, VRIN, TRIN for MMPI; NIM, PIM, INF, ICN for PAI; effort indices for TOMM/MSVT)
3. Flags invalid profiles, over-reporting, under-reporting, random responding
4. Produces a structured summary the Diagnostician can cite as evidence

The Diagnostician currently has to either ignore test data or parse raw protocol PDFs itself, which is unreliable and defeats the purpose of having validated instruments in forensic evaluation. A dedicated Psychometrician Agent fills this gap and enforces the same "DOCTOR ALWAYS DIAGNOSES" principle: the agent computes and validates, the clinician interprets.

---

## 2. Pipeline Position

Updated agent graph:

```
Ingestor → Psychometrician → Diagnostician → [Gate 2: DOCTOR] → Writer → Editor
              │                  ▲
              │                  │
              └── (test data) ───┘
```

- **Prereq:** Ingestor has run successfully for this case (needs the case record and document index)
- **Downstream:** Diagnostician now depends on **both** Ingestor and Psychometrician
- **Stage:** Runs during the **Testing** stage of the pipeline. Blocks advance from Testing → Interview until either (a) Psychometrician has completed successfully, or (b) the clinician explicitly marks "No standardized testing for this case" via a pipeline override.

---

## 3. Inputs

The agent reads from:

1. **`documents` table** (via `listDocuments(caseId)`), filtered to:
   - `document_type IN ('test_protocol', 'test_answer_sheet', 'test_scoring_report')`
   - Files in the `Testing/` subfolder
2. **Raw test data** extracted by the Ingestor's text extraction pass (`indexed_content` column) OR uploaded as structured JSON (`test_scores` table, already defined)
3. **`test_scores` table** — if the clinician has manually entered T-scores via the Testing tab UI, those take precedence over OCR'd protocol data
4. **Case metadata** — age, sex, education (needed for normative lookups)

---

## 4. Outputs

The agent produces a `PsychometricianOutput` JSON object, stored in `agent_results` as `agent_type = 'psychometrician'`.

```typescript
export interface PsychometricianOutput {
  readonly case_id: string
  readonly version: string
  readonly generated_at: string

  /** All instruments the agent scored or validated */
  readonly instruments_administered: readonly InstrumentResult[]

  /** Cross-instrument validity summary */
  readonly overall_validity: {
    readonly status: 'valid' | 'questionable' | 'invalid'
    readonly concerns: readonly string[]
    readonly summary: string
  }

  /** Flagged elevations the clinician should review */
  readonly clinical_elevations: readonly {
    readonly instrument: string
    readonly scale: string
    readonly score: number
    readonly interpretation: string
    readonly severity: 'mild' | 'moderate' | 'marked' | 'severe'
  }[]

  /** Effort / response bias indicators */
  readonly effort_assessment: {
    readonly tests_administered: readonly string[]
    readonly overall_effort: 'adequate' | 'suboptimal' | 'poor'
    readonly indicators: readonly string[]
  }
}

export interface InstrumentResult {
  readonly instrument: string           // 'MMPI-3', 'PAI', 'WAIS-IV', 'TOMM', etc.
  readonly administration_date?: string
  readonly form?: string                // 'standard', 'short', etc.
  readonly validity_scales: Record<string, {
    readonly score: number
    readonly interpretation: string
    readonly elevated: boolean
  }>
  readonly clinical_scales: Record<string, {
    readonly raw?: number
    readonly scaled: number
    readonly interpretation: string
  }>
  readonly profile_interpretation: string
  readonly validity_status: 'valid' | 'questionable' | 'invalid'
}
```

---

## 5. Validity Protocols (Per Instrument)

### MMPI-3 / MMPI-2-RF
- **VRIN-r** (T ≥ 80 → invalid random responding)
- **TRIN-r** (T ≥ 80 fixed direction → invalid)
- **F-r**, **Fp-r**, **Fs** (infrequent responding; T ≥ 100 on F-r → over-reporting concern)
- **L-r**, **K-r** (under-reporting / defensive responding; T ≥ 80 L-r → invalid)
- **RBS** (Response Bias Scale; T ≥ 100 → symptom exaggeration)
- **FBS-r** (Symptom validity; T ≥ 100 → possible malingering)

### PAI (Personality Assessment Inventory)
- **INF** (Infrequency; T ≥ 75 → random/careless)
- **ICN** (Inconsistency; T ≥ 73 → inconsistent)
- **NIM** (Negative Impression; T ≥ 92 → malingering probable)
- **PIM** (Positive Impression; T ≥ 68 → under-reporting)
- **MAL** index, **RDF** (Rogers Discriminant Function)

### Effort / SVT Tests
- **TOMM** (Trial 2 or Retention < 45 → suboptimal effort)
- **MSVT** (below cutoff on any of the four easy subtests → fail)
- **VSVT** (hard items < cutoff → below chance → definite malingering)

### Cognitive Batteries
- **WAIS-IV** subtest scaled scores (normative M=10, SD=3)
- **FSIQ**, **GAI**, index scores (M=100, SD=15)
- Flag discrepancies > 1.5 SD between indexes as clinically significant

---

## 6. IPC Contract

Following the pattern from `02_ipc_api_contracts.md` Boundary 4:

```typescript
// Channels
'psychometrician:run'
'psychometrician:getResult'

// Types
interface PsychometricianRunParams {
  readonly caseId: number
}

interface PsychometricianRunResult {
  readonly status: 'success' | 'error'
  readonly agentType: 'psychometrician'
  readonly caseId: number
  readonly operationId: string
  readonly result?: PsychometricianOutput
  readonly error?: string
  readonly tokenUsage?: TokenUsage
  readonly durationMs: number
}

interface PsychometricianGetResultParams {
  readonly caseId: number
}
```

Preload bridge additions (`src/preload/index.ts`):

```typescript
psychometrician: {
  run: (params: PsychometricianRunParams) =>
    ipcRenderer.invoke('psychometrician:run', params),
  getResult: (params: PsychometricianGetResultParams) =>
    ipcRenderer.invoke('psychometrician:getResult', params),
}
```

---

## 7. LLM Prompt Architecture

The Psychometrician is a **hybrid** agent:

1. **Deterministic layer (TypeScript, no LLM):**
   - Normative table lookups for scaled scores (MMPI-3 and PAI norms shipped as JSON data files)
   - Cutoff comparisons for validity scales
   - Profile shape classification (2-point code types for MMPI)
2. **LLM layer (Claude):**
   - Interpretation of elevation patterns
   - Cross-instrument synthesis ("MMPI-3 RC1 elevation paired with PAI SOM elevation suggests...")
   - Free-text profile summaries

The deterministic layer runs first and produces a structured input for the LLM. The LLM never invents T-scores; it only interprets the ones computed locally. This is the same split as the Diagnostician (evidence map is structured, narrative is LLM).

Full prompt text: see `03_agent_prompt_specs.md` after this spec is accepted.

---

## 8. UI Changes

### RightColumn agent card
Add a **Psychometrician** card between Ingestor and Diagnostician:

```
┌─ Ingestor ──────────────────┐
│ ✓ Run complete              │
└─────────────────────────────┘
┌─ Psychometrician ───────────┐   ← NEW
│ Run Psychometrician         │
│ Validates test protocols    │
└─────────────────────────────┘
┌─ Diagnostician ─────────────┐
│ (disabled until ^)          │
└─────────────────────────────┘
```

### Testing tab (`Stage_1_Testing.md`)
Add a "Psychometric Summary" panel that renders `PsychometricianOutput.instruments_administered` as a table with validity status badges. Clicking a row opens the full interpretation in the center column.

### Diagnostics tab
The Evidence Map should cite Psychometrician results alongside interview observations:

> *"Evidence supporting Schizophrenia Spectrum disorder: MMPI-3 RC8 T=78 (marked elevation, psychotic experiences), PAI SCZ T=82 (paranoid and thought disorder elevations), clinical interview documentation of first-rank symptoms."*

---

## 9. Database Changes

No new tables required. The existing `test_scores` table is sufficient as an input source, and `agent_results` already supports arbitrary `agent_type` values. Add one migration:

```sql
-- Add 'psychometrician' as a valid agent_type in the CHECK constraint if present
-- (check 01_database_schema.sql for the current constraint before writing this)
```

---

## 10. Walkthrough Integration

`demo-walkthrough.ts` will need a new step:

```typescript
await step('Run Psychometrician', async () => {
  const caseId = await getActiveCaseIdFromRenderer()
  if (caseId === null) throw new Error('Could not resolve active case id')
  const resp = await runAgentViaIpc('psychometrician', caseId)
  if (!agentIpcOk(resp)) {
    throw new Error(`Psychometrician agent failed: ${agentIpcErrorMessage(resp)}`)
  }
  await pause(2500)
})
```

Inserted between Ingestor completion and the "Advance to Interview" pipeline step. The `runAgentViaIpc` type union must be widened:

```typescript
agentKey: 'ingestor' | 'psychometrician' | 'diagnostician' | 'writer' | 'editor'
```

The demo also needs to seed `Testing/` subfolder with at least one realistic test protocol. Recommend generating a synthetic MMPI-3 answer sheet at case creation time via a new `case-docs-writer.ts` helper (`writeMmpiProtocol`).

---

## 11. Phased Implementation

### Phase 1 — Deterministic MVP (1–2 sessions)
- Scaffold agent file (`src/main/agents/psychometrician.ts`)
- Ship MMPI-3 normative JSON (T-score lookup only)
- Implement validity protocol cutoffs
- No LLM call — output only structured scales
- Wire IPC + UI card + walkthrough step

### Phase 2 — LLM Interpretation (1 session)
- Add Claude call for profile narrative
- Cross-instrument synthesis

### Phase 3 — Additional Instruments (ongoing)
- PAI normative tables
- WAIS-IV subtests
- TOMM / MSVT effort tests

### Phase 4 — Diagnostician Integration (1 session)
- Diagnostician loads `getLatestPsychometricianResult(caseId)` and includes it as structured evidence
- Prereq graph update

---

## 12. Open Questions

1. **Norms licensing** — MMPI-3 and PAI norms are copyrighted. Can Psygil ship them? Likely need a licensing agreement with Pearson/PAR, or restrict the agent to parse scoring reports that already contain T-scores (defer scoring itself).
2. **Testing override** — if a case has no standardized testing (not every forensic eval does), how does the clinician bypass the Psychometrician without breaking the prereq graph? Proposed: a "No testing administered" checkbox in the Testing tab that marks the agent result as `status: 'not_applicable'`.
3. **Juvenile batteries** — need different norms for BASC-3, Conners-3, YSR. Out of scope for Phase 1.
4. **Non-English protocols** — translated MMPI-2-RF norms exist for Spanish/Hindi/Mandarin. Phase 3+.

---

## 13. Content Quality Gate

Per `.claude/rules/content-quality.md`:
- All normative data must be psychometrically valid (T M=50 SD=10, IQ M=100 SD=15)
- No em dashes in agent output
- Banned vocabulary list enforced via the same post-processing filter used by Writer/Editor
- Scale interpretations must use real clinical terminology, not AI-generic phrases
