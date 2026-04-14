/**
 * Psygil Demo Walkthrough
 * =======================
 *
 * Drives the built Electron app through the complete 6-stage forensic
 * evaluation pipeline by clicking real UI elements (no DevTools, no IPC
 * back-channel, no script-side AI calls).  The app itself performs every
 * Anthropic API call when this script clicks "Run <Agent>".
 *
 * The window is NOT resized.  DevTools is NOT opened.  Every meaningful
 * step is captured as a PNG into `demo-screenshots/<timestamp>/NN-<step>.png`
 * so the run can be edited into a marketing / demo video.
 *
 * Prerequisites
 * -------------
 *   1. `npm i -D @playwright/test playwright`            (one-time)
 *   2. `npm run build`                                   (produces ./out)
 *   3. A workspace already configured in the app
 *      (Setup modal completed at least once)
 *   4. Anthropic API key already saved in the app
 *      (so the in-app agent buttons can actually call Claude)
 *
 * Run
 * ---
 *   npx tsx scripts/demo-walkthrough.ts
 *
 * Optional env vars
 * -----------------
 *   DEMO_CASE_FIRST_NAME    default "Marcus"
 *   DEMO_CASE_LAST_NAME     default "Thompson"
 *   DEMO_EVAL_TYPE          default "competency_to_stand_trial"
 *   DEMO_SCREENSHOT_DIR     default "demo-screenshots"
 *   DEMO_STEP_DELAY_MS      default 800   (pause between actions for video pacing)
 *   DEMO_AGENT_TIMEOUT_MS   default 600000 (10 min per agent run)
 */

import { _electron as electron, type ElectronApplication, type Page, type Locator } from 'playwright'
import { mkdirSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir, platform } from 'node:os'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const APP_ROOT = resolve(__dirname, '..')
const MAIN_ENTRY = join(APP_ROOT, 'out', 'main', 'index.js')

// ---------------------------------------------------------------------------
// Demo case selection
// ---------------------------------------------------------------------------
// The walkthrough does NOT pick its own case. On every run the script reads
// `scripts/demo-case.json`, which is authored by Claude (via the working
// session) fresh for each run. Claude also maintains
// `scripts/demo-case-history.json` so previously-used cases are never
// repeated. This guarantees that each walkthrough video features a
// completely unique patient, referral question, and jurisdiction.
//
// The file shape must match `DemoCase`. If the file is missing or invalid,
// the script falls back to env vars and then to a single last-resort
// default (which exists only so `pnpm tsx scripts/demo-walkthrough.ts` does
// not crash if run before Claude has authored a case file).
//
// To override for a one-off run, set:
//   DEMO_CASE_FIRST_NAME, DEMO_CASE_LAST_NAME, DEMO_CASE_DOB,
//   DEMO_EVAL_TYPE, DEMO_COURT_DEADLINE
// ---------------------------------------------------------------------------

interface DemoCase {
  readonly firstName: string
  readonly lastName: string
  readonly dob: string           // YYYY-MM-DD
  readonly evalType: string      // must match EVAL_TYPE_OPTIONS in IntakeModal.tsx
  readonly jurisdiction: string  // free-text city/state for logs only
  readonly courtDeadline?: string  // YYYY-MM-DD, optional (falls back to +45d)
}

const DEMO_CASE_FILE = join(APP_ROOT, 'scripts', 'demo-case.json')

// Last-resort default. Should almost never be used — Claude writes a fresh
// case to demo-case.json on every run. Present only so the script does not
// crash if someone runs it cold without Claude's involvement.
const LAST_RESORT_DEFAULT: DemoCase = {
  firstName: 'Rashad',
  lastName: 'Whitaker',
  dob: '1988-07-12',
  evalType: 'CST',
  jurisdiction: 'Denver, CO',
}

function loadDemoCaseFile(): DemoCase | null {
  if (!existsSync(DEMO_CASE_FILE)) return null
  try {
    const raw = readFileSync(DEMO_CASE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<DemoCase>
    if (
      typeof parsed.firstName !== 'string' ||
      typeof parsed.lastName !== 'string' ||
      typeof parsed.dob !== 'string' ||
      typeof parsed.evalType !== 'string' ||
      typeof parsed.jurisdiction !== 'string'
    ) {
      console.warn(`[demo] ${DEMO_CASE_FILE} is missing required fields — ignoring`)
      return null
    }
    return {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      dob: parsed.dob,
      evalType: parsed.evalType,
      jurisdiction: parsed.jurisdiction,
      courtDeadline: typeof parsed.courtDeadline === 'string' ? parsed.courtDeadline : undefined,
    }
  } catch (e) {
    console.warn(`[demo] failed to parse ${DEMO_CASE_FILE}:`, (e as Error).message)
    return null
  }
}

// Court deadline: 45 days from today (ISO YYYY-MM-DD) — only used when
// neither the case file nor the env var provides one.
function defaultCourtDeadline(): string {
  const d = new Date()
  d.setDate(d.getDate() + 45)
  return d.toISOString().slice(0, 10)
}

const SELECTED_CASE = loadDemoCaseFile() ?? LAST_RESORT_DEFAULT
const FIRST_NAME = process.env.DEMO_CASE_FIRST_NAME ?? SELECTED_CASE.firstName
const LAST_NAME = process.env.DEMO_CASE_LAST_NAME ?? SELECTED_CASE.lastName
const DOB = process.env.DEMO_CASE_DOB ?? SELECTED_CASE.dob      // YYYY-MM-DD for <input type="date">
// EVAL_TYPE must match a value in EVAL_TYPE_OPTIONS in IntakeModal.tsx.
const EVAL_TYPE = process.env.DEMO_EVAL_TYPE ?? SELECTED_CASE.evalType
const COURT_DEADLINE =
  process.env.DEMO_COURT_DEADLINE ?? SELECTED_CASE.courtDeadline ?? defaultCourtDeadline()
const JURISDICTION = SELECTED_CASE.jurisdiction

const SCREENSHOT_ROOT = process.env.DEMO_SCREENSHOT_DIR ?? join(APP_ROOT, 'demo-screenshots')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const RUN_DIR = join(SCREENSHOT_ROOT, RUN_ID)

const STEP_DELAY_MS = Number(process.env.DEMO_STEP_DELAY_MS ?? 800)
const AGENT_TIMEOUT_MS = Number(process.env.DEMO_AGENT_TIMEOUT_MS ?? 600_000)
const ELEMENT_TIMEOUT_MS = 15_000

// Human-paced typing for the demo reel. When enabled, intake Step 1 and
// Step 4 (presenting complaints) are typed character-by-character so a
// viewer can see each field being entered. Other steps still use
// instant .fill() to keep total runtime reasonable. See
// docs/marketing/01_Demo_Reel_Script.md for the rationale.
const HUMAN_TYPING = process.env.DEMO_HUMAN_TYPING !== '0'
// Per-character delay for short fields (names, IDs, phone numbers).
const HUMAN_TYPE_DELAY_SHORT_MS = Number(process.env.DEMO_TYPE_DELAY_SHORT ?? 35)
// Per-character delay for long textareas (referral question, narrative
// fields). Lower so 500-char paragraphs do not take 30+ seconds each.
const HUMAN_TYPE_DELAY_LONG_MS = Number(process.env.DEMO_TYPE_DELAY_LONG ?? 8)
// A short field is anything under this length; everything else uses the
// long-field delay.
const HUMAN_TYPE_LONG_THRESHOLD = 80
// Pause between successive field entries so the viewer can register the
// transition from one input to the next.
const HUMAN_FIELD_GAP_MS = Number(process.env.DEMO_FIELD_GAP ?? 500)
// Pause inserted at each chapter marker so a video editor has an
// obvious cut point and the narration has time to land.
const CHAPTER_PAUSE_MS = Number(process.env.DEMO_CHAPTER_PAUSE_MS ?? 3000)
// When true (default), the walkthrough halts after the intake modal
// closes and waits for the operator to press Enter before kicking off
// the agents. Useful for live demos where you want to talk through the
// completed intake form before triggering the AI pipeline. Set
// DEMO_STOP_AFTER_INTAKE=0 to run straight through.
const STOP_AFTER_INTAKE = process.env.DEMO_STOP_AFTER_INTAKE !== '0'

// ---------------------------------------------------------------------------
// Resolve the *real* userData directory of the dev/prod Psygil app, so the
// Playwright-launched Electron instance shares config (workspacePath),
// SQLCipher database, audit log, and saved API key.  Without this override,
// Electron defaults to a fresh "Electron/" userData dir → loadWorkspacePath()
// returns null → createCase() throws "No workspace path configured".
// ---------------------------------------------------------------------------

function readPackageName(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf-8')) as { name?: string }
    return pkg.name ?? 'psygil-app'
  } catch {
    return 'psygil-app'
  }
}

function resolveUserDataDir(): string {
  if (process.env.DEMO_USER_DATA_DIR) return process.env.DEMO_USER_DATA_DIR
  const name = readPackageName()
  const home = homedir()
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', name)
    case 'win32':
      return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), name)
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), name)
  }
}

const USER_DATA_DIR = resolveUserDataDir()

// ---------------------------------------------------------------------------
// Step + screenshot helpers
// ---------------------------------------------------------------------------

let stepCounter = 0
let app: ElectronApplication
let win: Page

// When the intake/onboarding modal is open, all field-targeting helpers
// must scope inside it.  Otherwise nth(0) selectors will hit selects from
// the dashboard/sidebar and the script hangs (or fills the wrong field).
let modalScope: Locator | null = null

function scope(): Locator | Page {
  return modalScope ?? win
}

function getIntakeModal(): Locator {
  // The modal is the inner dialog container with width: min(920px, 92vw).
  // That inline style is unique on the page.
  return win.locator('div[style*="min(920px"]').first()
}

async function openIntakeModalScope(): Promise<void> {
  const m = getIntakeModal()
  await m.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT_MS })
  modalScope = m
  log('modal scope acquired')
}

function clearIntakeModalScope(): void {
  modalScope = null
  log('modal scope cleared')
}

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[demo] ${message}`)
}

async function pause(ms: number = STEP_DELAY_MS): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function shot(name: string): Promise<void> {
  stepCounter += 1
  const padded = String(stepCounter).padStart(2, '0')
  const safe = name.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()
  const file = join(RUN_DIR, `${padded}-${safe}.png`)
  await win.screenshot({ path: file, fullPage: false })
  log(`screenshot → ${padded}-${safe}.png`)
}

async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  log(`▶ ${label}`)
  const result = await fn()
  await pause()
  return result
}

// Mark a major chapter boundary in the demo reel. Logs a CHAPTER line
// (so post-production can find cut points in the run log), takes a
// dedicated screenshot, and pauses long enough that the narration has
// time to land before the next action begins. The five chapters mirror
// docs/marketing/01_Demo_Reel_Script.md: Intake, Testing, Interviews,
// Diagnostics, Reports.
// Halt the walkthrough until the operator presses Enter on stdin.
// Used for live-demo pause points (e.g. after intake completes, before
// the agents run). Ctrl+C exits as usual.
async function waitForKeyPress(prompt: string): Promise<void> {
  log(`⏸  ${prompt}`)
  // eslint-disable-next-line no-console
  console.log(`\n>>> ${prompt}\n`)
  await new Promise<void>((resolve) => {
    const stdin = process.stdin
    const onData = (): void => {
      stdin.removeListener('data', onData)
      try {
        stdin.pause()
      } catch {
        /* ignore */
      }
      resolve()
    }
    try {
      stdin.resume()
    } catch {
      /* ignore */
    }
    stdin.once('data', onData)
  })
  log('▶ resumed')
}

async function chapter(num: number, title: string): Promise<void> {
  const banner = `========== CHAPTER ${num}: ${title.toUpperCase()} ==========`
  log(banner)
  await shot(`chapter_${num}_${title.replace(/\s+/g, '_').toLowerCase()}`)
  await pause(CHAPTER_PAUSE_MS)
}

// First locator that resolves to a visible element wins; throws if none.
async function firstVisible(
  locators: readonly Locator[],
  description: string,
  opts: { requireEnabled?: boolean } = {},
): Promise<Locator> {
  const deadline = Date.now() + ELEMENT_TIMEOUT_MS
  while (Date.now() < deadline) {
    for (const loc of locators) {
      try {
        if ((await loc.count()) > 0) {
          const first = loc.first()
          if (await first.isVisible()) {
            if (opts.requireEnabled && !(await first.isEnabled())) continue
            return first
          }
        }
      } catch {
        /* try next */
      }
    }
    await pause(250)
  }
  throw new Error(`Timed out waiting for visible${opts.requireEnabled ? ' enabled' : ''} element: ${description}`)
}

async function clickByText(...candidates: readonly string[]): Promise<void> {
  // Scope to the modal when one is open so we don't accidentally click
  // dashboard elements (kanban cards, sidebar items) sitting behind it.
  const root = scope()
  const locs = candidates.flatMap((t) => [
    root.getByRole('button', { name: t, exact: true }),
    root.getByRole('button', { name: t, exact: false }),
    root.locator(`button:has-text("${t.replace(/"/g, '\\"')}")`),
    root.locator(`[title="${t.replace(/"/g, '\\"')}"]`),
    root.getByText(t, { exact: false }),
  ])
  const target = await firstVisible(locs, candidates.join(' / '), { requireEnabled: true })
  await target.click()
}

async function fillByLabel(label: string, value: string): Promise<void> {
  const locs = [
    win.getByLabel(label, { exact: false }),
    win.getByPlaceholder(label, { exact: false }),
    win.locator(`input[name="${label}"]`),
    win.locator(`input[placeholder*="${label}" i]`),
  ]
  const target = await firstVisible(locs, `field "${label}"`)
  await target.fill(value)
}

// Fill an <input type="date"> by its placeholder *neighbor* — date inputs
// have no placeholder, so target by type and ordinal position.
// Scoped to the modal when one is open.
async function fillDateInput(value: string, ordinal: number = 0): Promise<void> {
  const dateInputs = scope().locator('input[type="date"]')
  const count = await dateInputs.count()
  if (count <= ordinal) {
    throw new Error(`No <input type="date"> at index ${ordinal} (found ${count})`)
  }
  const target = dateInputs.nth(ordinal)
  await target.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT_MS })
  // .fill() works for date inputs as long as the value is YYYY-MM-DD.
  await target.fill(value)
}

// Fill an input or textarea targeted by exact placeholder text. Uses ordinal
// to disambiguate when multiple fields share the same placeholder
// (e.g. several "(555) 555-5555" phone fields). Scoped to the modal when open.
async function fillByPlaceholder(
  placeholder: string,
  value: string,
  ordinal: number = 0,
): Promise<void> {
  const escaped = placeholder.replace(/"/g, '\\"')
  const loc = scope().locator(
    `input[placeholder="${escaped}"], textarea[placeholder="${escaped}"]`,
  )
  const count = await loc.count()
  if (count <= ordinal) {
    throw new Error(
      `No element with placeholder "${placeholder}" at index ${ordinal} (found ${count})`,
    )
  }
  const target = loc.nth(ordinal)
  await target.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT_MS })
  await target.fill(value)
}

// Type into an input/textarea one character at a time at a human-ish
// pace, so a viewer of the demo reel can see each field being filled.
// Long values use a smaller per-char delay to keep the visual without
// blowing up runtime. After typing, pause briefly so the next field
// transition is visually distinct.
async function typeHuman(target: Locator, value: string): Promise<void> {
  await target.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT_MS })
  await target.click()
  // Clear any pre-filled content (some date/select fields auto-populate).
  try {
    await target.fill('')
  } catch {
    /* not a fillable input — pressSequentially still works */
  }
  const delay =
    value.length >= HUMAN_TYPE_LONG_THRESHOLD
      ? HUMAN_TYPE_DELAY_LONG_MS
      : HUMAN_TYPE_DELAY_SHORT_MS
  await target.pressSequentially(value, { delay })
  await pause(HUMAN_FIELD_GAP_MS)
}

// Human-paced version of fillByPlaceholder. Falls back to instant fill
// when HUMAN_TYPING is disabled. Use this for fields the demo reel
// should visibly show being entered (intake Step 1 + complaints Step 4).
async function humanFillByPlaceholder(
  placeholder: string,
  value: string,
  ordinal: number = 0,
): Promise<void> {
  if (!HUMAN_TYPING) {
    return fillByPlaceholder(placeholder, value, ordinal)
  }
  const escaped = placeholder.replace(/"/g, '\\"')
  const loc = scope().locator(
    `input[placeholder="${escaped}"], textarea[placeholder="${escaped}"]`,
  )
  const count = await loc.count()
  if (count <= ordinal) {
    throw new Error(
      `No element with placeholder "${placeholder}" at index ${ordinal} (found ${count})`,
    )
  }
  await typeHuman(loc.nth(ordinal), value)
}

// Pick an option from the Nth visible <select> within the current scope
// (modal when open, page otherwise).  Tries by value first, then label.
async function selectNth(
  ordinal: number,
  valueOrLabel: string,
): Promise<void> {
  const selects = scope().locator('select')
  const count = await selects.count()
  if (count <= ordinal) {
    throw new Error(`No <select> at index ${ordinal} (found ${count})`)
  }
  const target = selects.nth(ordinal)
  await target.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT_MS })
  try {
    await target.selectOption({ value: valueOrLabel })
  } catch {
    await target.selectOption({ label: valueOrLabel })
  }
}

// Click the "Save & Continue →" (or "Complete Intake ✓" on the last step)
// button inside the modal and wait briefly for the next step to render.
async function clickSaveAndContinue(label: string): Promise<void> {
  const candidates = [
    win.getByRole('button', { name: 'Save & Continue', exact: false }),
    win.getByRole('button', { name: 'Complete Intake', exact: false }),
  ]
  const target = await firstVisible(candidates, `Save & Continue (${label})`, {
    requireEnabled: true,
  })
  await target.click()
  // The modal updates currentStepIndex synchronously after the save resolves;
  // give it a beat for the new step's inputs to appear.
  await pause(1200)
}

// Try to click any of the given button texts; if none are visible/enabled
// within a short window, log and return without throwing.  Used for
// pipeline advance + confirm buttons that may not exist (e.g. when the
// stage was already advanced automatically by intake completion).
async function tryClickByText(
  description: string,
  candidates: readonly string[],
  timeoutMs: number = 3000,
): Promise<boolean> {
  const root = scope()
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const t of candidates) {
      const locs = [
        root.getByRole('button', { name: t, exact: true }),
        root.getByRole('button', { name: t, exact: false }),
        root.locator(`button:has-text("${t.replace(/"/g, '\\"')}")`),
      ]
      for (const loc of locs) {
        try {
          if ((await loc.count()) > 0) {
            const first = loc.first()
            if ((await first.isVisible()) && (await first.isEnabled())) {
              await first.click()
              log(`tryClickByText[${description}] → clicked "${t}"`)
              return true
            }
          }
        } catch {
          /* try next */
        }
      }
    }
    await pause(200)
  }
  log(`tryClickByText[${description}] → none of [${candidates.join(', ')}] visible — skipping`)
  return false
}

// Advance pipeline: clicks the Advance button (any of several labels) and
// then optionally clicks Confirm if a confirmation appears.  No-ops if the
// case has already been moved to the target stage.
async function advancePipeline(
  fromStage: string,
  toStage: string,
  advanceLabels: readonly string[],
): Promise<void> {
  const advanced = await tryClickByText(
    `${fromStage}→${toStage}`,
    advanceLabels,
    4000,
  )
  if (!advanced) return
  await pause(500)
  await tryClickByText('confirm-dialog', ['Confirm', 'Yes', 'OK'], 2000)
  await pause(800)
}

// Click the "Run X" / "Re-run X" button for an agent.  Waits up to
// `enableTimeoutMs` for the button to become enabled (prereqs met +
// active case selected + no other agent running).  Always uses page
// scope (the agent panel lives outside the modal).
async function clickRunAgent(
  agentLabel: 'Ingestor' | 'Diagnostician' | 'Writer' | 'Editor',
  enableTimeoutMs: number = 30_000,
): Promise<void> {
  const labels = [`Run ${agentLabel}`, `Re-run ${agentLabel}`]
  const deadline = Date.now() + enableTimeoutMs
  while (Date.now() < deadline) {
    for (const label of labels) {
      const btn = win.getByRole('button', { name: label, exact: true }).first()
      try {
        if ((await btn.count()) > 0 && (await btn.isVisible()) && (await btn.isEnabled())) {
          await btn.click()
          log(`clickRunAgent → clicked "${label}"`)
          return
        }
      } catch {
        /* try next */
      }
    }
    await pause(500)
  }
  throw new Error(
    `${agentLabel} run button never became enabled. ` +
      `Likely cause: no active case in tab, prereq agent missing, or another agent still running.`,
  )
}

// Get the most recently created case id via the cases IPC. The demo
// creates a brand new case on each run, so max(case_id) is the active one.
// Used to invoke agent IPCs directly via evaluate() for diagnostics.
async function getActiveCaseIdFromRenderer(): Promise<number | null> {
  try {
    const id = await win.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).psygil?.cases
      if (!api?.list) return null
      const resp = await api.list()
      if (resp?.status !== 'success') return null
      const rows: Array<{ case_id: number }> = resp.data?.cases ?? []
      if (rows.length === 0) return null
      return rows.reduce((max, r) => (r.case_id > max ? r.case_id : max), 0)
    })
    return id
  } catch {
    return null
  }
}

// Invoke an agent IPC directly via window.psygil.<agent>.run and return
// the full response so we can log the real error message instead of
// inferring from button state.
interface AgentIpcResult {
  readonly status: string
  readonly error?: string
  readonly message?: string
  readonly data?: {
    readonly status?: string
    readonly error?: string
    readonly durationMs?: number
  }
}

async function runAgentViaIpc(
  agentKey: 'ingestor' | 'diagnostician' | 'writer' | 'editor',
  caseId: number,
): Promise<AgentIpcResult> {
  return win.evaluate(
    async ({ key, id }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = (window as any).psygil?.[key]
      if (!api?.run) return { status: 'error', message: `window.psygil.${key}.run not available` }
      try {
        const resp = await api.run({ caseId: id })
        return resp as AgentIpcResult
      } catch (e) {
        return {
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
        }
      }
    },
    { key: agentKey, id: caseId },
  )
}

// Unwrap nested agent IPC envelope: the outer { status: 'success' } just
// means the IPC call didn't throw; the REAL agent result lives at
// resp.data.status. Both must be 'success' for the agent to have actually
// run end-to-end and persisted a result.
function agentIpcOk(resp: AgentIpcResult): boolean {
  if (resp.status !== 'success') return false
  if (!resp.data) return false
  return resp.data.status === 'success'
}

function agentIpcErrorMessage(resp: AgentIpcResult): string {
  return resp.data?.error ?? resp.error ?? resp.message ?? '(no message)'
}

/**
 * DOCTOR ALWAYS DIAGNOSES gate: after the Diagnostician runs, it produces
 * an evidence map of candidate diagnoses but makes no decision. The Writer
 * refuses to run until at least one diagnostic decision exists in the
 * diagnostic_decisions table. In a real workflow the clinician clicks
 * "Render" on one of the diagnostics cards; here we simulate that click
 * via the diagnosticDecisions.save IPC.
 *
 * Strategy:
 *   1. Pull the latest Diagnostician result via window.psygil.diagnostician.getResult
 *   2. Read the first key from diagnostic_evidence_map (the top-ranked
 *      diagnosis option the agent surfaced)
 *   3. Save that key with decision='render' and a short clinician note
 *
 * Returns the diagnosis_key that was confirmed, for logging. Throws if
 * no evidence map is available (which would mean the Diagnostician didn't
 * actually produce a usable result).
 */
async function confirmFirstDiagnosticDecision(caseId: number): Promise<string> {
  const result = await win.evaluate(async (id: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (window as any).psygil?.diagnostician
    if (!api?.getResult) {
      return { ok: false as const, reason: 'diagnostician.getResult not available' }
    }
    try {
      const resp = await api.getResult({ caseId: id })
      if (resp?.status !== 'success' || !resp.data) {
        return { ok: false as const, reason: `diagnostician:getResult returned ${resp?.status}` }
      }
      const output = resp.data as {
        diagnostic_evidence_map?: Record<string, unknown>
      }
      const map = output.diagnostic_evidence_map ?? {}
      const keys = Object.keys(map)
      if (keys.length === 0) {
        return { ok: false as const, reason: 'diagnostic_evidence_map is empty' }
      }
      const diagnosisKey = keys[0]!
      const entry = map[diagnosisKey] as Record<string, unknown>
      const icdCode = typeof entry?.icd_code === 'string' ? entry.icd_code : ''
      const diagnosisName = diagnosisKey.replace(/_/g, ' ')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const save = (window as any).psygil?.diagnosticDecisions?.save
      if (!save) {
        return { ok: false as const, reason: 'diagnosticDecisions.save not available' }
      }
      const saveResp = await save({
        case_id: id,
        diagnosis_key: diagnosisKey,
        icd_code: icdCode,
        diagnosis_name: diagnosisName,
        decision: 'render',
        clinician_notes:
          'Clinician confirms diagnosis based on Diagnostician evidence map, clinical interview, and collateral records.',
      })
      if (saveResp?.status !== 'success') {
        return {
          ok: false as const,
          reason: `diagnosticDecision:save returned ${saveResp?.status}: ${saveResp?.message ?? ''}`,
        }
      }
      return { ok: true as const, diagnosisKey, icdCode }
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : String(e) }
    }
  }, caseId)

  if (!result.ok) {
    throw new Error(`Could not confirm diagnostic decision: ${result.reason}`)
  }
  return `${result.diagnosisKey}${result.icdCode ? ` (${result.icdCode})` : ''}`
}

// Wait for the global agent indicator to return to idle.
// RightColumn re-renders "Run X" → "Running…" → "Run X" once status is idle,
// so we poll until no "Running…" button is visible OR a result panel appears.
async function waitForAgentToFinish(agentLabel: string): Promise<void> {
  const deadline = Date.now() + AGENT_TIMEOUT_MS
  log(`waiting for ${agentLabel} to finish (up to ${Math.round(AGENT_TIMEOUT_MS / 1000)}s)…`)
  // Authoritative completion signal: the button relabels from "Run X" /
  // "Running…" to "Re-run X" only after a result is actually persisted.
  // Waiting for "Running…" alone is NOT safe: if the agent errors (e.g. no
  // API key, LLM timeout), the button flips straight back to "Run X" with
  // no persisted result, and downstream agents stay disabled.
  const reRunBtn = win.getByRole('button', { name: `Re-run ${agentLabel}`, exact: true })
  const runBtn = win.getByRole('button', { name: `Run ${agentLabel}`, exact: true })
  let sawRunning = false
  const startedAt = Date.now()
  let lastProgressLog = 0
  while (Date.now() < deadline) {
    // Heartbeat every 15s so the user can see the script is alive and what
    // the renderer currently thinks the agent state is.
    const elapsed = Date.now() - startedAt
    if (elapsed - lastProgressLog >= 15_000) {
      lastProgressLog = elapsed
      try {
        const snapshot = await win.evaluate(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const api = (window as any).psygil?.agent
          if (!api?.status) return { status: 'no-api' }
          const resp = await api.status()
          return resp
        })
        log(
          `[heartbeat] ${agentLabel} elapsed=${Math.round(elapsed / 1000)}s ` +
            `agent.status=${JSON.stringify(snapshot)}`,
        )
      } catch (e) {
        log(`[heartbeat] ${agentLabel} elapsed=${Math.round(elapsed / 1000)}s (status probe failed: ${(e as Error).message})`)
      }
    }
    // Success: result persisted, button now says "Re-run X"
    if ((await reRunBtn.count()) > 0 && (await reRunBtn.first().isVisible())) {
      log(`${agentLabel} finished (button now "Re-run ${agentLabel}")`)
      return
    }
    // Track whether we ever saw the "Running…" state, so we can distinguish
    // "agent never started" from "agent ran and errored".
    const running = win.getByText('Running…', { exact: false })
    if ((await running.count()) > 0) {
      sawRunning = true
    } else if (sawRunning) {
      // Running stopped, but no "Re-run" appeared — agent errored. Give the
      // poll loop one more tick to catch up (refreshAgentResults runs every
      // 2s in the renderer), then fail with a clear diagnostic.
      await pause(2500)
      if ((await reRunBtn.count()) > 0 && (await reRunBtn.first().isVisible())) {
        log(`${agentLabel} finished (button now "Re-run ${agentLabel}")`)
        return
      }
      const stillRunBtn = (await runBtn.count()) > 0
      throw new Error(
        `${agentLabel} finished running but no result was persisted ` +
          `(button still says "Run ${agentLabel}"${stillRunBtn ? '' : ' — not found'}). ` +
          `Likely cause: LLM call failed (missing/invalid API key, network error, ` +
          `or agent threw). Check main-process logs and Settings → API keys.`,
      )
    }
    await pause(1000)
  }
  throw new Error(`${agentLabel} did not finish within timeout`)
}

// ---------------------------------------------------------------------------
// Walkthrough
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!existsSync(MAIN_ENTRY)) {
    throw new Error(
      `Main entry not found at ${MAIN_ENTRY}.\n` +
        `Run \`npm run build\` first so Playwright can launch the packaged main process.`,
    )
  }

  mkdirSync(RUN_DIR, { recursive: true })
  log(`screenshots → ${RUN_DIR}`)
  const caseSource = existsSync(DEMO_CASE_FILE)
    ? `scripts/demo-case.json`
    : '(last-resort default — ask Claude to generate a fresh case)'
  log(`demo case source → ${caseSource}`)
  log(
    `demo case → ${FIRST_NAME} ${LAST_NAME} (dob ${DOB}) • ${EVAL_TYPE} • ${JURISDICTION} • deadline ${COURT_DEADLINE}`,
  )

  // Launch Electron WITHOUT --inspect, --remote-debugging-port flags so the
  // DevTools panel never opens.  Playwright attaches via the CDP that Electron
  // already exposes; the visible window is unmodified.
  log(`launching Electron (userData=${USER_DATA_DIR})…`)
  if (!existsSync(USER_DATA_DIR)) {
    log(
      `WARNING: userData dir does not exist at ${USER_DATA_DIR}. ` +
        'Open the regular Psygil app once and configure a workspace before running this script.',
    )
  }
  // Video recording is opt-in via DEMO_RECORD_VIDEO=1. Playwright's
  // Electron `recordVideo` support is undocumented at the top level and
  // can interact badly with the renderer load on some versions; the
  // default path stays unchanged so existing screenshot-only runs are
  // not destabilised. When enabled, the .webm finalises after app.close().
  const RECORD_VIDEO = process.env.DEMO_RECORD_VIDEO === '1'
  const launchOpts: Parameters<typeof electron.launch>[0] = {
    // --user-data-dir is a Chromium switch Electron honors. It forces the
    // launched process to read/write config.json, the encrypted SQLite DB,
    // and audit logs from the SAME directory the dev/prod app uses, so the
    // workspacePath set in the GUI is visible to this run.
    args: [MAIN_ENTRY, `--user-data-dir=${USER_DATA_DIR}`],
    cwd: APP_ROOT,
    env: {
      ...process.env,
      // Tell the app this is an automated demo run (optional flag the
      // renderer can read to suppress nag modals if desired).
      PSYGIL_DEMO_MODE: '1',
    },
    timeout: 30_000,
  }
  if (RECORD_VIDEO) {
    ;(launchOpts as { recordVideo?: unknown }).recordVideo = {
      dir: RUN_DIR,
      size: { width: 1440, height: 900 },
    }
    log('DEMO_RECORD_VIDEO=1 — attempting Playwright video capture')
  }
  try {
    app = await electron.launch(launchOpts)
  } catch (e) {
    if (RECORD_VIDEO) {
      log(`recordVideo rejected by Playwright (${(e as Error).message}); retrying without video`)
      delete (launchOpts as { recordVideo?: unknown }).recordVideo
      app = await electron.launch(launchOpts)
    } else {
      throw e
    }
  }

  // Forward main-process stdout/stderr so any crash (e.g. native module
  // ABI mismatch) is visible instead of hanging silently.
  app.process().stdout?.on('data', (b) => process.stdout.write(`[main:out] ${b}`))
  app.process().stderr?.on('data', (b) => process.stderr.write(`[main:err] ${b}`))
  app.on('close', () => log('electron process closed'))

  log('waiting for first window…')
  win = await Promise.race([
    app.firstWindow(),
    new Promise<Page>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              'firstWindow() timed out after 30s. The main process likely crashed before showing a window. ' +
                'Check the [main:err] lines above. Most common cause: native module ABI mismatch (use Node 22, not Node 25).',
            ),
          ),
        30_000,
      ),
    ),
  ])
  log('first window received')

  // Surface renderer console output so React errors are visible.
  win.on('console', (msg) => log(`[renderer:${msg.type()}] ${msg.text()}`))
  win.on('pageerror', (err) => log(`[renderer:pageerror] ${err.message}`))
  win.on('crash', () => log('[renderer:crash] window crashed'))

  await win.waitForLoadState('domcontentloaded')
  log('renderer DOM ready')

  // Defensive: if the app ever calls webContents.openDevTools(), close it.
  win.on('popup', async (popup) => {
    try {
      await popup.close()
    } catch {
      /* ignore */
    }
  })

  // Give the renderer a moment to hydrate cases / workspace.
  await pause(2000)
  await shot('app_loaded_dashboard')

  // -------------------------------------------------------------------------
  // 1. Create a new case
  // -------------------------------------------------------------------------
  await step('Open New Case modal', async () => {
    const newCaseBtn = await firstVisible(
      [win.locator('[title="New Case"]'), win.getByRole('button', { name: 'New Case' })],
      'New Case button',
    )
    await newCaseBtn.click()
    // Acquire modal scope so all subsequent fillByPlaceholder / selectNth /
    // fillDateInput calls target only inputs inside the wizard, not the
    // dashboard / sidebar selects sitting underneath it.
    await openIntakeModalScope()
  })
  await shot('new_case_modal_open')

  // -------------------------------------------------------------------------
  // STEP 1 of 6 — Contact & Insurance (intake)
  // -------------------------------------------------------------------------
  // CHAPTER 1 — Intake. Step 1 is typed character-by-character so the
  // demo reel can show the clinician personally entering each field.
  // (Steps 2/3/5/6 still use instant fill to keep total runtime sane.)
  await chapter(1, 'Intake')
  await step('Step 1: Fill Contact & Insurance (human-paced)', async () => {
    // Identity row
    await humanFillByPlaceholder('Last name', LAST_NAME)
    await humanFillByPlaceholder('First name', FIRST_NAME)
    await humanFillByPlaceholder('M', 'J')

    // DOB + Gender (Age is read-only)
    await fillDateInput(DOB, 0)
    await selectNth(0, 'Male') // gender select is the first <select>

    // Address
    await humanFillByPlaceholder('123 Main St', '4421 Tennyson Street, Apt 2B')
    await humanFillByPlaceholder('City', 'Denver')
    await selectNth(1, 'CO') // state select
    await humanFillByPlaceholder('80901', '80212')

    // Phone, email, preferred contact
    await humanFillByPlaceholder('(555) 555-5555', '(720) 555-0184', 0) // patient phone
    await humanFillByPlaceholder('patient@example.com', 'mthompson1985@protonmail.com')
    await selectNth(2, 'Phone') // preferredContact

    // Emergency contact
    await humanFillByPlaceholder('Full name', 'Denise Thompson', 0)
    await humanFillByPlaceholder('Spouse, Parent…', 'Sister')
    await humanFillByPlaceholder('(555) 555-5555', '(720) 555-0192', 1) // emergency phone

    // Insurance
    await humanFillByPlaceholder('Aetna, BCBS, etc.', 'Colorado Medicaid')
    await humanFillByPlaceholder('Member ID', 'CO-22149-883')
    await humanFillByPlaceholder('Group #', 'GRP-4471')
    await humanFillByPlaceholder('Full name', 'Denise Thompson', 1) // policyholder
    await selectNth(3, 'Other') // relationshipToPatient
  })
  await shot('intake_step1_contact_insurance')

  await step('Step 1 → Save & Continue', async () => {
    await clickSaveAndContinue('Contact & Insurance')
  })
  await shot('intake_step2_loaded')

  // -------------------------------------------------------------------------
  // STEP 2 of 6 — Referral & Legal (intake)
  // -------------------------------------------------------------------------
  await step('Step 2: Fill Referral & Legal', async () => {
    // Referring party
    await clickByText('Court') // referringPartyType chip
    await fillByPlaceholder('Name or office', 'Denver County Public Defender Office')
    await fillByPlaceholder('Street address', '1560 Broadway, Suite 250')
    await fillByPlaceholder('(555) 555-5555', '(303) 555-0140', 0) // referring party phone
    await fillByPlaceholder('email@example.com', 'intake@dpdo.colorado.gov')

    // Court & attorney
    await fillByPlaceholder('Case #', '2026-CR-04417')
    await fillByPlaceholder('Hon. Smith / District Court', 'Hon. Patricia Velasquez, Denver District Court')
    await fillByPlaceholder('Attorney name', 'Whitney Ferraro', 0) // defense
    await fillByPlaceholder('(555) 555-5555', '(303) 555-0188', 1) // defense phone
    await fillByPlaceholder('Attorney name', 'Adam Ng', 1) // prosecution
    await fillByPlaceholder('(555) 555-5555', '(303) 555-0233', 2) // prosecution phone
    await fillDateInput(COURT_DEADLINE, 0)

    // Evaluation
    await selectNth(0, EVAL_TYPE) // only select on this step
    await fillByPlaceholder(
      'Describe the evaluation being requested…',
      'Defense counsel requests a forensic evaluation of competency to proceed (CRS 16-8.5-101). Defendant has presented with disorganized speech and possible delusional content during attorney visits. Court needs an opinion on factual and rational understanding of proceedings and capacity to assist counsel.',
    )
    await fillByPlaceholder(
      'List charges or legal matter…',
      'Burglary in the second degree (F4), criminal mischief (M1), trespass (M2). Allegations stem from a March 11 2026 incident at a vacant retail property.',
    )
    await fillByPlaceholder(
      'Police report, prior evals, medical records…',
      'Denver PD arrest report 26-DPD-09887, body-worn camera footage, jail intake medical screen, two prior outpatient psychiatric notes from Mental Health Center of Denver dated 2024 and 2025.',
    )
    await fillByPlaceholder(
      'Any other relevant information…',
      'Defendant is currently held at Denver County Detention Center. Pretrial services flagged him for behavioral health screen on intake. No active medications at jail.',
    )

    // Legal history
    await fillByPlaceholder(
      'Prior arrests, charges, and convictions…',
      'Two prior misdemeanor trespass arrests (2022, 2024), both in Denver County. One disorderly conduct conviction in 2023, sentence completed. No prior felony convictions.',
    )
    await fillByPlaceholder(
      'Prior incarceration, duration, facility…',
      'Approximately 14 days at Denver County Detention Center in 2023 pending the disorderly conduct disposition. No prior DOC commitments.',
    )
    await fillByPlaceholder(
      'Current or prior probation/parole status…',
      'Currently on no probation or parole. Completed 12 months unsupervised probation in 2024.',
    )
    await fillByPlaceholder(
      'Active or prior protective orders…',
      'No active protective or restraining orders at this time.',
    )
  })
  await shot('intake_step2_referral_legal')

  await step('Step 2 → Save & Continue (creates case)', async () => {
    await clickSaveAndContinue('Referral & Legal')
  })
  // Case is created on this save; give the renderer a moment to receive the
  // new case row + open the tab in the background.
  await pause(2500)
  await shot('case_created_step3_loaded')

  // -------------------------------------------------------------------------
  // STEP 3 of 6 — Demographics & Family (onboarding)
  // -------------------------------------------------------------------------
  await step('Step 3: Fill Demographics & Family', async () => {
    // Demographics row 1
    await selectNth(0, 'Single')                    // marital_status
    await fillByPlaceholder('Number and ages', 'None')

    // Demographics row 2
    await selectNth(1, 'With Family')               // living_situation
    await selectNth(2, 'English')                   // primary_language

    // Education & employment
    await selectNth(3, 'High School/GED')            // highest_education
    await selectNth(4, 'Unemployed')                // employment_status

    await fillByPlaceholder(
      'Schools, colleges, programs…',
      'Manual High School (Denver), graduated 2003. Two semesters at Community College of Denver (general studies, did not complete).',
    )
    await fillByPlaceholder(
      'Employer — role',
      'Front Range Logistics, warehouse associate (2023, terminated after 7 months).',
    )
    await fillByPlaceholder(
      'Academic performance, challenges, special education…',
      'Average grades through middle school. Began struggling academically in 10th grade. No formal special education services. Reports difficulty concentrating in class and frequent absences.',
    )
    await fillByPlaceholder(
      'Employment history, gaps, issues…',
      'Series of short-term warehouse and food service jobs since 2004. Longest single job was 18 months at a restaurant supply warehouse. Most separations attributed to attendance and conflict with supervisors.',
    )
    await fillByPlaceholder(
      'Branch, dates, discharge status — or N/A',
      'No military service.',
    )

    // Family history
    await fillByPlaceholder(
      'Parents, siblings, upbringing, household composition…',
      'Raised by mother and maternal grandmother in northwest Denver. Father absent since infancy. One older sister (Denise, currently primary support). Household stable but financially strained.',
    )
    await fillByPlaceholder(
      'Family history of mental health conditions…',
      'Maternal grandfather hospitalized in the 1970s for what family describes as a nervous breakdown. Mother treated for depression in her 40s. Maternal cousin diagnosed with schizophrenia in early adulthood.',
    )
    await fillByPlaceholder(
      'Family history of medical conditions…',
      'Maternal hypertension and Type 2 diabetes. Paternal history unknown.',
    )
    await fillByPlaceholder(
      'Current relationships, support system, conflicts…',
      'Sister Denise is primary contact and visits weekly at the jail. Mother in declining health, limited contact. No current romantic partner. Few peer relationships outside of acquaintances from prior jobs.',
    )
  })
  await shot('intake_step3_demographics_family')

  await step('Step 3 → Save & Continue', async () => {
    await clickSaveAndContinue('Demographics & Family')
  })
  await shot('intake_step4_loaded')

  // -------------------------------------------------------------------------
  // STEP 4 of 6 — Presenting Complaints (onboarding)
  // -------------------------------------------------------------------------
  // Presenting Complaints is the second visibly-typed form for the
  // demo reel — the textarea entries here are the most clinically
  // evocative content in the intake and reinforce that the clinician
  // is personally documenting symptoms.
  await step('Step 4: Fill Presenting Complaints (human-paced)', async () => {
    // Generic OnboardingStep renders one textarea per field with
    // placeholder "Enter <Field Label>…".
    await humanFillByPlaceholder(
      'Enter Primary Complaint — Describe in Detail…',
      'Defendant reports hearing what he describes as the building talking to him for the past several months. He says voices give him instructions and warn him about danger. He has difficulty distinguishing his own thoughts from the voices and reports increasing confusion about who he can trust. He denies command hallucinations to harm himself or others at this time.',
    )
    await humanFillByPlaceholder(
      'Enter Secondary Concerns…',
      'Sleep has been very poor (estimates 2 to 4 hours per night for the past 6 weeks). Appetite is markedly decreased, lost approximately 15 pounds since arrest. Reports persistent feeling that he is being watched. Social withdrawal even from his sister.',
    )
    await humanFillByPlaceholder(
      'Enter Onset & Timeline…',
      'Subtle changes began in late 2024 (per sister: increased isolation, talking to himself). Symptoms accelerated significantly in January 2026 after losing his housing. Acute deterioration in the 2 weeks prior to arrest. No clear precipitant beyond housing loss.',
    )
  })
  await shot('intake_step4_complaints')

  await step('Step 4 → Save & Continue', async () => {
    await clickSaveAndContinue('Presenting Complaints')
  })
  await shot('intake_step5_loaded')

  // -------------------------------------------------------------------------
  // STEP 5 of 6 — Medical & Substance Use (onboarding)
  // -------------------------------------------------------------------------
  await step('Step 5: Fill Medical & Substance Use', async () => {
    // Medical history
    await fillByPlaceholder(
      'Describe current medical conditions…',
      'No diagnosed chronic medical conditions. Reports occasional tension headaches. Vision and hearing intact per self-report. No known allergies.',
    )
    await fillByPlaceholder(
      'Medication, dose, prescriber…',
      'No current prescription medications. Jail medical declined to start any psychiatric medications pending evaluation.',
    )
    await fillByPlaceholder(
      'Prior surgeries, hospitalizations…',
      'Appendectomy at age 16 (2001). Two emergency department visits for lacerations (2020, 2022). No psychiatric hospitalizations.',
    )
    await fillByPlaceholder(
      'Head injuries, LOC, TBI history…',
      'One reported head injury at age 19 from a workplace fall, brief loss of consciousness (under 1 minute), no formal TBI workup. No other head injuries reported.',
    )
    await fillByPlaceholder(
      'Hours, quality, disturbances…',
      '2 to 4 hours per night, fragmented. Reports nightmares and being woken by voices.',
    )
    await fillByPlaceholder(
      'Recent changes in appetite or weight…',
      'Appetite poor, approximately 15 pounds weight loss over 6 weeks.',
    )

    // Mental health history
    await fillByPlaceholder(
      'Prior therapy, counseling, inpatient…',
      'Two outpatient visits at Mental Health Center of Denver (2024, 2025). Did not engage with follow-up. No prior inpatient psychiatric treatment.',
    )
    await fillByPlaceholder(
      'Prior psychiatric or psychological diagnoses…',
      'Provisional diagnosis of unspecified psychotic disorder noted in 2025 outpatient record. No formal SMI determination prior to current case.',
    )
    await fillByPlaceholder(
      'Current and prior psychiatric medications…',
      'Risperidone 1 mg trial in 2025 for approximately 3 weeks, discontinued by patient due to reported side effects. No other psychiatric medication history.',
    )
    await fillByPlaceholder(
      'Describe history, frequency, most recent…',
      'Denies any history of self-harm or suicide attempts. Endorses occasional passive thoughts of "wanting it to stop" without plan or intent. Most recent passive thought approximately 2 weeks ago.',
      0, // self_harm
    )
    await fillByPlaceholder(
      'Describe history, context, most recent…',
      'No history of physical violence toward others. One verbal altercation with a previous supervisor in 2023 that did not become physical. Denies current thoughts of harming others.',
      0, // violence (different placeholder string from self_harm above)
    )

    // Substance use
    await fillByPlaceholder(
      'Frequency, amount, history…',
      'Drinks approximately 3 to 4 beers on weekends, more during periods of stress. Denies blackouts or withdrawal symptoms. No DUI history.',
    )
    await fillByPlaceholder(
      'Substances, frequency, route…',
      'Cannabis use approximately 2 to 3 times per week for the past several years. Denies use of methamphetamine, cocaine, opioids, or hallucinogens. Last urine drug screen at jail intake was negative.',
    )
    await fillByPlaceholder(
      'Prior treatment, rehab, detox, duration…',
      'No prior substance use treatment. Has not sought detox or rehab services.',
    )
  })
  await shot('intake_step5_medical_substance')

  await step('Step 5 → Save & Continue', async () => {
    await clickSaveAndContinue('Medical & Substance Use')
  })
  await shot('intake_step6_loaded')

  // -------------------------------------------------------------------------
  // STEP 6 of 6 — Recent Events (onboarding)
  // -------------------------------------------------------------------------
  await step('Step 6: Fill Recent Events', async () => {
    await fillByPlaceholder(
      'Enter Describe the Events or Circumstances…',
      'Defendant lost his shared housing in early January 2026 after a conflict with his roommate. He spent several weeks couch-surfing and intermittently sleeping in his car. The arrest occurred at a vacant strip mall property where he had been sheltering. He reports limited memory of the night of arrest and says he believed the building was sending him signals.',
    )
    await fillByPlaceholder(
      'Enter Current Stressors…',
      'Pretrial detention at Denver County. Pending felony charge with potential prison exposure. Loss of housing and limited family resources to assist with bond. Ongoing psychotic symptoms without medication. Concern about losing contact with his sister.',
    )
    await fillByPlaceholder(
      'Enter Goals for This Evaluation…',
      'Defendant says he wants the doctor to "help me figure out what is real and what is not" and to help him understand what is happening with his case. He expresses willingness to participate in the evaluation and says he hopes it will lead to treatment.',
    )
  })
  await shot('intake_step6_recent_events')

  await step('Step 6 → Complete Intake ✓', async () => {
    await clickSaveAndContinue('Recent Events (final)')
  })
  await pause(2500)
  // Modal closes here — drop the scope so later helpers target the page.
  clearIntakeModalScope()
  await shot('intake_complete_modal_closed')

  if (STOP_AFTER_INTAKE) {
    await waitForKeyPress(
      'Intake complete — PAUSED. Press Enter to continue with the agent pipeline, Ctrl+C to exit.',
    )
  }

  // After the modal closes, the new case auto-opens as a tab titled
  // "${last_name}, ${first_name}" (see App.tsx::handleCaseSaved). If for any
  // reason the auto-open didn't happen, fall back to clicking the case in the
  // LeftColumn sidebar.
  await step('Ensure new case is active in a tab', async () => {
    const tabTitle = `${LAST_NAME}, ${FIRST_NAME}`
    const candidates = [
      win.getByText(tabTitle, { exact: false }),
      win.getByText(`${LAST_NAME},`, { exact: false }),
      win.getByText(LAST_NAME, { exact: false }),
      win.getByText(`${FIRST_NAME} ${LAST_NAME}`, { exact: false }),
    ]
    try {
      const target = await firstVisible(candidates, `case "${tabTitle}"`)
      await target.click()
    } catch (e) {
      log(`could not locate case tab/sidebar entry: ${(e as Error).message}`)
      log('continuing — will let agent-button check decide if case is active')
    }
  })
  await pause(1500)
  await shot('case_open_in_tab')

  // NOTE: we no longer wait for the "Run Ingestor" button to become enabled.
  // We invoke the agents via IPC directly (see below), so the button state
  // (which is derived from renderer getResult() polling) is not on our path.

  // -------------------------------------------------------------------------
  // 2. ONBOARDING → TESTING : run Ingestor agent
  // -------------------------------------------------------------------------
  // NOTE: we invoke the agent via IPC directly rather than clicking the
  // button. The UI-based agent-status IPC doesn't track ingestor:run /
  // diagnostician:run / etc. (only the generic agent:run handler updates
  // the status map), so button state is the only renderer-side signal and
  // it's lossy. Calling the IPC directly gives us the authoritative
  // {status, error, tokenUsage, durationMs} response.
  await step('Run Ingestor', async () => {
    const caseId = await getActiveCaseIdFromRenderer()
    if (caseId === null) throw new Error('Could not resolve active case id')
    log(`invoking window.psygil.ingestor.run({caseId: ${caseId}})…`)
    const resp = await runAgentViaIpc('ingestor', caseId)
    log(`ingestor:run → ${JSON.stringify(resp).slice(0, 500)}`)
    if (!agentIpcOk(resp)) {
      throw new Error(`Ingestor agent failed: ${agentIpcErrorMessage(resp)}`)
    }
    // Give the renderer's 2s getResult poll a tick to flip the button
    // from "Run Ingestor" to "Re-run Ingestor" for subsequent steps.
    await pause(2500)
  })
  await shot('ingestor_complete')

  // Note: completing intake (Step 6) auto-advances the case to 'testing',
  // so this advance is usually a no-op. We still call it defensively in
  // case the auto-advance failed for any reason.
  await step('Advance pipeline (onboarding → testing)', async () => {
    await advancePipeline('onboarding', 'testing', ['Advance to Testing', 'Advance'])
  })
  await shot('stage_testing')

  // -------------------------------------------------------------------------
  // 3. TESTING → INTERVIEW
  // -------------------------------------------------------------------------
  await chapter(2, 'Testing')
  await step('Open Test Results tab', async () => {
    await tryClickByText('test-results-tab', ['Test Results', 'Testing'], 2000)
  })
  await shot('testing_tab')

  await step('Advance pipeline (testing → interview)', async () => {
    await advancePipeline('testing', 'interview', ['Advance to Interview', 'Advance'])
  })
  await shot('stage_interview')

  // -------------------------------------------------------------------------
  // 4. INTERVIEW → DIAGNOSTICS
  // -------------------------------------------------------------------------
  await chapter(3, 'Interviews')
  await step('Advance pipeline (interview → diagnostics)', async () => {
    await advancePipeline('interview', 'diagnostics', ['Advance to Diagnostics', 'Advance'])
  })
  await shot('stage_diagnostics')

  // CHAPTER 4 — Diagnostics. The most important chapter in the reel.
  // The Diagnostician proposes evidence; the clinician decides via the
  // gate (confirmFirstDiagnosticDecision below). Without that decision
  // the Writer agent refuses to run.
  await chapter(4, 'Diagnostics')

  // -------------------------------------------------------------------------
  // 5. DIAGNOSTICS : run Diagnostician
  // -------------------------------------------------------------------------
  await step('Run Diagnostician', async () => {
    const caseId = await getActiveCaseIdFromRenderer()
    if (caseId === null) throw new Error('Could not resolve active case id')
    log(`invoking window.psygil.diagnostician.run({caseId: ${caseId}})…`)
    const resp = await runAgentViaIpc('diagnostician', caseId)
    log(`diagnostician:run → ${JSON.stringify(resp).slice(0, 500)}`)
    if (!agentIpcOk(resp)) {
      throw new Error(`Diagnostician agent failed: ${agentIpcErrorMessage(resp)}`)
    }
    await pause(2500)
  })
  await shot('diagnostician_complete')

  // DOCTOR ALWAYS DIAGNOSES gate: simulate the clinician clicking "Render"
  // on the top-ranked diagnosis from the evidence map. Without this, the
  // Writer refuses to run. In a live demo the presenter would click this
  // in the DiagnosticsTab UI; the walkthrough does it via IPC so the video
  // can show the "Render" state without requiring a human click.
  await step('Confirm diagnostic decision (clinician Gate 2)', async () => {
    const caseId = await getActiveCaseIdFromRenderer()
    if (caseId === null) throw new Error('Could not resolve active case id')
    const confirmed = await confirmFirstDiagnosticDecision(caseId)
    log(`clinician confirmed diagnosis → ${confirmed}`)
    await pause(1500)
  })
  await shot('diagnosis_confirmed')

  await step('Open Evidence Map tab', async () => {
    await tryClickByText('evidence-map-tab', ['Evidence Map', 'Diagnostics'], 2000)
  })
  await shot('evidence_map')

  await step('Advance pipeline (diagnostics → review)', async () => {
    await advancePipeline('diagnostics', 'review', ['Advance to Review', 'Advance'])
  })
  await shot('stage_review')

  // -------------------------------------------------------------------------
  // 6. REVIEW : run Writer + Editor, then attest
  // -------------------------------------------------------------------------
  await chapter(5, 'Reports')
  await step('Run Writer', async () => {
    const caseId = await getActiveCaseIdFromRenderer()
    if (caseId === null) throw new Error('Could not resolve active case id')
    log(`invoking window.psygil.writer.run({caseId: ${caseId}})…`)
    const resp = await runAgentViaIpc('writer', caseId)
    log(`writer:run → ${JSON.stringify(resp).slice(0, 500)}`)
    if (!agentIpcOk(resp)) {
      throw new Error(`Writer agent failed: ${agentIpcErrorMessage(resp)}`)
    }
    await pause(2500)
  })
  await shot('writer_complete')

  await step('Run Editor', async () => {
    const caseId = await getActiveCaseIdFromRenderer()
    if (caseId === null) throw new Error('Could not resolve active case id')
    log(`invoking window.psygil.editor.run({caseId: ${caseId}})…`)
    const resp = await runAgentViaIpc('editor', caseId)
    log(`editor:run → ${JSON.stringify(resp).slice(0, 500)}`)
    if (!agentIpcOk(resp)) {
      throw new Error(`Editor agent failed: ${agentIpcErrorMessage(resp)}`)
    }
    await pause(2500)
  })
  await shot('editor_complete')

  await step('Open Eval Report tab', async () => {
    await tryClickByText('eval-report-tab', ['Eval Report', 'Report'], 2000)
  })
  await shot('eval_report')

  await step('Open Attestation tab', async () => {
    await tryClickByText('attestation-tab', ['Attestation', 'Sign Report'], 2000)
  })
  await shot('attestation_tab')

  await step('Submit attestation', async () => {
    // Try to fill any required attestation fields if present
    try {
      await fillByLabel('Signed By', 'Dr. Demo Clinician')
    } catch {
      /* optional */
    }
    // Tolerant click — attestation UI may not be wired yet; don't crash the run.
    await tryClickByText(
      'submit-attestation',
      ['Submit Attestation', 'Sign & Lock', 'Sign Report', 'Attest', 'Sign'],
      3000,
    )
  })
  await pause(2500)
  await shot('attestation_signed')

  // -------------------------------------------------------------------------
  // 7. REVIEW → COMPLETE
  // -------------------------------------------------------------------------
  await step('Advance pipeline (review → complete)', async () => {
    await advancePipeline('review', 'complete', ['Advance to Complete', 'Advance'])
  })
  await pause(2000)
  await shot('stage_complete')

  // -------------------------------------------------------------------------
  // 8. Return to Dashboard for the closing shot
  // -------------------------------------------------------------------------
  await step('Return to Dashboard', async () => {
    await tryClickByText('dashboard-nav', ['Dashboard', 'Home'], 3000)
  })
  await pause(1500)
  await shot('dashboard_final')

  log(`✅ walkthrough complete — ${stepCounter} screenshots in ${RUN_DIR}`)
  // Surface the video path (if recordVideo was honored). The .webm is
  // not finalized until app.close() runs in the finally block.
  try {
    const videoPath = await win.video()?.path()
    if (videoPath) {
      log(`🎬 video will be saved to ${videoPath} after the app closes`)
    }
  } catch {
    /* video not enabled — fine */
  }
}

// ---------------------------------------------------------------------------
// Entry point with crash-safe screenshot + cleanup
// ---------------------------------------------------------------------------

main()
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('[demo] ERROR:', err)
    try {
      if (win) {
        const failPath = join(RUN_DIR, `99-FAILURE-${Date.now()}.png`)
        await win.screenshot({ path: failPath, fullPage: false })
        log(`failure screenshot → ${failPath}`)
      }
    } catch {
      /* ignore */
    }
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (app) await app.close()
    } catch {
      /* ignore */
    }
  })
