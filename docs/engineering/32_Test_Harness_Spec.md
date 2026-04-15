# 32, Test Harness Specification

Status: Draft, v1 (2026-04-15)
Owner: Engineering / QA
Related: 30_Workflow_Map_and_Dev_Path, 31_Gap_Resolution_Implementation_Plan

A thorough, layered test harness covering every workflow identified in doc 30. Designed to run locally, in CI, and on release candidates. Fails loudly on PHI leakage, AI artifacts, and gate bypass.

---

## 1. Layered Architecture

| Layer | Tool | Target | Runs on |
|---|---|---|---|
| Unit | Vitest | Pure functions, utilities, formatters, reducers | every commit |
| Component | Vitest + Testing Library | React components with state | every commit |
| IPC / Main | Vitest + ts-node harness | main-process handlers in isolation | every commit |
| Integration | Vitest + tmp workspace | main + DB + filesystem end-to-end (no UI) | every commit |
| E2E | Playwright + electron driver | Full app, real UI, real DB | nightly + tag |
| Visual regression | Playwright screenshot diffs | Key tabs and modals | nightly |
| Performance | Playwright + custom probes | Large case, 500 docs | nightly |
| Accessibility | axe-core in Playwright | All primary screens | nightly |
| Security | semgrep, gitleaks, npm audit | Source + deps | every commit |
| HARD RULE guard | Custom script | Grep for U+2014, U+2013, AI watermarks | every commit + pre-publish |

---

## 2. Directory Layout

```
app/
  tests/
    unit/
      renderer/
      main/
      shared/
    component/
    ipc/
    integration/
    e2e/
    fixtures/
      cases/
      workspaces/
      db-seeds/
    harness/
      tmpWorkspace.ts
      mockIpc.ts
      buildSeedCase.ts
      hardRuleScan.ts
    visual/
    perf/
    a11y/
```

---

## 3. Fixture Strategy

- **Seed DB**: a JSON bundle in `fixtures/db-seeds/` representing a case at each stage (0 through 5). Loaded by a helper that creates a tmp workspace, initializes an empty SQLCipher file, and seeds rows.
- **Sample documents**: PDFs, DOCXs, and images under `fixtures/cases/` with known SHA-256 hashes.
- **Workspace builder**: `buildSeedCase(options)` returns `{workspacePath, caseId, cleanup}`.
- **Mock IPC**: for component tests, `mockIpc` exposes `window.psygil.*` with Jest-style spies.

---

## 4. Test Matrix (every workflow must have at least one test at each applicable layer)

| WF | Unit | Component | IPC | Integration | E2E |
|---|---|---|---|---|---|
| 1 Install | formatters | SetupWelcome | `setup:getConfig` | first-launch bootstrap | install via packaged build |
| 2 Edition | reducer | EditionChooser | `setup:savePractice` | persist and reload | wizard to main |
| 3 Storage | path validator | StoragePicker | `setup:validateStoragePath` | provision + rescan | pick folder + see tree |
| 4 Case create | formatPhoneUS | IntakeStep1..6 | `cases:create` + `intake:save` | create + scaffold + DB rows | full wizard E2E |
| 5a Testing | score hasher | TestsSubTab | `test_results:update` | batteries + notes flush | advance gate 1 |
| 5b Interview | notes util | MultiNotesPanel | `onboarding:save` | flush on nav | advance to diagnostics |
| 5c Diagnostics | gate2 reducer | DiagnosticsSubTab | diagnoses insert | approve all 4 + gate | full approve + attest |
| 5d Report build | buildReportContent | ReportSubTab | `report:build` | progressive gating | build on complete case |
| 6 Publish | hashing | PublishConfirm | `report:publish` | write DOCX + PDF + audit | full publish cycle |
| 7 Auth | token store | LoginScreen | Auth0 callback | keychain round-trip | `[GAP]` until wired |
| 8 Watcher | debounce | - | `workspace:rescan` | add/remove/rename | external file add |
| 9 Doc viewer | mime detect | DocumentViewer | `documents:open` | tab open from tree | click in tree |
| 10 Tabs | tab reducer | TabStrip | - | persist state | close/reopen |
| 11 Notes flush | flush util | NotesPanel | - | advance without blur | scripted flow |
| 12 Gates | gate fn | - | server-side gate enforce | bypass attempt blocked | UI refusal |
| 13 Evidence map | linker | EvidenceGrid | linker IPC | link and render | link from tests tab |
| 14 Audit | immutable trigger | AuditTable | `audit:list` | write + read only | admin view |
| 15 Versioning | version parse | - | `report:build` versioning | v1 to v3 | export three times |
| 16 Backup | - | - | - | copy workspace + re-sync | new machine scenario |
| 17 Settings | settings reducer | SettingsTab | `settings:save` | round-trip | toggle theme |
| 18 Templates | template parse | TemplateList | `templates:apply` | apply and snapshot | pick battery |
| 19 Recovery | - | - | `db:recover` | corrupt DB scenario | missing workspace scenario |
| 20 Uninstall | - | DangerZone | `app:wipeLocalData` | shred file | full wipe + relaunch |

---

## 5. Representative Tests (scaffolds to implement)

See `app/tests/` scaffolding committed alongside this spec.

### 5.1 Unit: `formatPhoneUS`

```ts
// app/tests/unit/renderer/formatPhoneUS.test.ts
import { describe, it, expect } from 'vitest'
import { formatPhoneUS } from '@/components/modals/IntakeOnboardingModal'

describe('formatPhoneUS', () => {
  it('formats 10 digits', () => {
    expect(formatPhoneUS('1112223333')).toBe('(111) 222-3333')
  })
  it('drops country code', () => {
    expect(formatPhoneUS('11112223333')).toBe('(111) 222-3333')
  })
  it('formats partial input progressively', () => {
    expect(formatPhoneUS('111')).toBe('(111')
    expect(formatPhoneUS('11122')).toBe('(111) 22')
  })
  it('ignores non-digits', () => {
    expect(formatPhoneUS('abc-111-def-222-3333')).toBe('(111) 222-3333')
  })
  it('handles empty string', () => {
    expect(formatPhoneUS('')).toBe('')
  })
})
```

### 5.2 Integration: case creation scaffolds folders and stubs

```ts
// app/tests/integration/caseCreate.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createCase } from '@/main/cases'
import { initDb } from '@/main/db/connection'
import { setWorkspacePath } from '@/main/workspace'

let tmp: string

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'psygil-'))
  setWorkspacePath(tmp)
  await initDb()
})

describe('createCase', () => {
  it('creates 7 subfolders plus stub docs', async () => {
    const c = await createCase({ lastName: 'Doe', firstName: 'Jane', dob: '1990-01-01' })
    const folder = join(tmp, 'cases', `${c.case_number} Doe, Jane`)
    const subs = ['_Inbox', 'Collateral', 'Testing', 'Interviews', 'Diagnostics', 'Reports', 'Archive']
    for (const s of subs) {
      expect(existsSync(join(folder, s))).toBe(true)
      expect(existsSync(join(folder, s, 'README.txt'))).toBe(true)
    }
    const diag = readFileSync(join(folder, 'Diagnostics', 'Diagnostic Formulation.txt'), 'utf-8')
    expect(diag).toContain('Clinical Impressions:')
  })
})
```

### 5.3 IPC: gate bypass is refused server side

```ts
// app/tests/ipc/gateEnforcement.test.ts
import { describe, it, expect } from 'vitest'
import { invoke } from '../harness/mockIpc'
import { buildSeedCase } from '../harness/buildSeedCase'

describe('cases:advanceStage', () => {
  it('refuses advance when gate unmet', async () => {
    const { caseId } = await buildSeedCase({ stageIndex: 3, gate2Approved: false })
    const res = await invoke('cases:advanceStage', { caseId, to: 'review' })
    expect(res.status).toBe('error')
    expect(res.message).toMatch(/gate 2/i)
  })
})
```

### 5.4 E2E: full happy path

```ts
// app/tests/e2e/happyPath.spec.ts
import { _electron as electron, test, expect } from '@playwright/test'

test('create case, advance all stages, publish', async () => {
  const app = await electron.launch({ args: ['dist/main/index.js'] })
  const win = await app.firstWindow()

  await win.click('text=Get Started')
  await win.fill('input[name="licenseKey"]', 'TRIAL')
  await win.click('text=Next')
  // choose edition, storage (tmp), practice, finish...

  await win.click('text=New Case')
  await win.fill('[placeholder="(555) 555-5555"]', '1112223333')
  await expect(win.locator('[placeholder="(555) 555-5555"]')).toHaveValue('(111) 222-3333')
  // continue through six steps...

  // advance stages, approve formulations, attest, publish
  await win.click('text=Publish Final')
  await expect(win.locator('text=Case Complete')).toBeVisible()

  await app.close()
})
```

### 5.5 HARD RULE guard

```ts
// app/tests/unit/shared/hardRule.test.ts
import { scanForProhibited } from '../../harness/hardRuleScan'

test('rejects em and en dashes', () => {
  expect(() => scanForProhibited('hello\u2014world')).toThrow(/U\+2014/)
  expect(() => scanForProhibited('range 1\u20132')).toThrow(/U\+2013/)
})

test('rejects AI watermark strings', () => {
  expect(() => scanForProhibited('Generated by AI')).toThrow(/watermark/i)
})
```

---

## 6. CI Pipeline

- On push: lint, typecheck, unit, component, ipc, integration, hardRuleScan, gitleaks.
- On PR: above plus a11y smoke test.
- Nightly: full E2E matrix (mac arm64, win x64, linux x64), visual regression, performance probes.
- On release tag: packaged-build E2E against signed installer.

---

## 7. Quality Gates (CI must block merge if any fail)

- Unit + component + ipc + integration: 100% pass, coverage >= 80%.
- HARD RULE scan: 0 violations.
- gitleaks: 0 secrets.
- a11y: 0 critical issues.
- Schema snapshot: no unintended DB shape change (reviewed).

---

## 8. Manual Test Checklist (for each RC)

1. Fresh install on clean VM for each platform.
2. Setup wizard end to end.
3. Create 3 cases, advance each to a different stage.
4. Publish one. Verify Word and PDF open correctly in Word, Pages, LibreOffice, Acrobat, Preview.
5. Kill the app mid-save; reopen; confirm no data loss and no orphan rows.
6. Rename a case folder externally; verify DB updates.
7. Full uninstall and data removal; verify no residue.

---

## 9. Known Gaps Covered by `[GAP]` Tests

Each gap from doc 31 has at least one failing test committed with `test.fails(...)` or `it.todo(...)`, so resolution closes a known red test rather than adding a new one.
