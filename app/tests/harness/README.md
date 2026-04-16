# Test Harness

Shared helpers used across unit, component, and integration tests. Import
from `tests/harness/<module>`. Do not import Electron APIs from this layer;
helpers here must run in the Node/JSDOM test environment.

---

## tmpWorkspace

**File:** `tests/harness/tmpWorkspace.ts`

Provisions a fresh workspace folder under `os.tmpdir()` with the standard
subdirectory layout (`cases/`, `Archive/`, `_Resources/`) and an optional
empty DB file at `dbPath`.

```ts
import { createTmpWorkspace } from '../harness/tmpWorkspace'

const ws = createTmpWorkspace()           // layout only
const ws = createTmpWorkspace({ seed: true }) // layout + empty DB file

// in afterEach:
ws.cleanup()
```

**When to use:**
- Any test that needs a real filesystem path for workspace-scoped logic.
- Integration tests that wire the migration manifest against `ws.dbPath`
  (Phase F.2).

**Note:** `makeTmpWorkspace()` is a deprecated alias kept for backwards
compatibility with integration test files written before Phase F.1.

---

## buildSeedCase

**File:** `tests/harness/buildSeedCase.ts`

Creates a case folder at a given pipeline stage and returns the folder path
and a stub case id. Provisions all 7 standard subfolders (`_Inbox`,
`Collateral`, `Testing`, `Interviews`, `Diagnostics`, `Reports`, `Archive`)
and writes a placeholder `_Inbox/intake.md`.

```ts
import { buildSeedCase } from '../harness/buildSeedCase'

const result = buildSeedCase({
  workspacePath: ws.path,
  caseNumber: 'TEST-0042',
  stage: 'diagnostics',
  gate2Approved: true,
  attested: false,
})
// result.caseFolder: absolute path
// result.caseId:     1 (stub; real id comes from integration DB)
```

**When to use:**
- Unit tests that assert on folder structure or document presence.
- Component tests that need a caseFolder path without a real DB.

**DB-level options** (`gate2Approved`, `attested`) are accepted by the
signature but not wired until Phase F.2 integration tests run against a
real SQLite DB provisioned via `createTmpWorkspace({ seed: true })`.

---

## mockIpc

**File:** `tests/harness/mockIpc.ts`

In-memory spy for `window.psygil`. Assign `ipc.preloadShim` to
`(window as { psygil?: unknown }).psygil` before rendering a component,
then configure handlers and assert on recorded calls.

```ts
import { createMockIpc } from '../harness/mockIpc'

const ipc = createMockIpc()
ipc.handlers['cases:list'] = async () => ({
  ok: true, status: 'success',
  data: { cases: [], total: 0 },
})
;(window as { psygil?: unknown }).psygil = ipc.preloadShim

// after render...
const listCalls = ipc.calls.filter(c => c.channel === 'cases:list')
expect(listCalls).toHaveLength(1)

// between tests:
ipc.resetAllSpies()
```

**When to use:**
- JSDOM component tests (React Testing Library, etc.) that call IPC methods
  and need controlled responses without launching Electron.
- Unit tests that verify channels are called with the correct payloads.

**Not for:** integration tests that need a real IPC handler. Use the actual
handler registry wired against an in-process DB.

---

## Fixture naming convention

Fixture files live under `tests/fixtures/cases/<scenario>.ts`. Each file
exports a function that calls `buildSeedCase` with scenario-specific
options. Example:

```
tests/fixtures/cases/competency-at-diagnostics.ts
tests/fixtures/cases/custody-complete-attested.ts
```

---

## Representative examples

| Pattern | File |
|---------|------|
| hardRuleScan unit tests | `tests/unit/shared/hardRule.test.ts` |
| buildSeedCase unit tests | `tests/unit/shared/buildSeedCase.test.ts` |
| Integration (todo) | `tests/integration/caseCreate.test.ts` |
