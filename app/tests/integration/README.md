# Integration Tests

Tests that exercise a real SQLite DB, real filesystem, and the migration
manifest together. These are slower than unit tests but faster than E2E.

---

## Current status

No tests in this directory have been promoted to full integration-level yet.
The existing files are scaffolds that compile and run as `.todo` suites:

| File | Status | Notes |
|------|--------|-------|
| `caseCreate.test.ts` | todo suite | Wires createCase + subfolder scaffold |
| `progressiveReport.test.ts` | todo suite | Progressive report build |
| `publishPipeline.test.ts` | todo suite | Publish pipeline |
| `watcherReconcile.test.ts` | todo suite | Watcher reconcile logic |

Full wiring lands in Phase F.2 once the main-process DB modules can be
imported cleanly in the vitest environment.

---

## When to add an integration test

Add a test here (rather than in `tests/unit/`) when ALL THREE of these are
true:

1. The test exercises a real SQLite DB (provisioned via
   `createTmpWorkspace({ seed: true })`).
2. The test requires real filesystem I/O (folder creation, file reads/writes).
3. The test runs the migration manifest so the schema matches production.

If any of those is absent, the test belongs in `tests/unit/` with mocked
dependencies.

---

## How to provision a test DB

```ts
import { createTmpWorkspace } from '../harness/tmpWorkspace'

const ws = createTmpWorkspace({ seed: true })
// ws.dbPath is an empty file; apply the migration manifest here:
// const { runMigrations } = await import('@/main/db/migrate')
// runMigrations(ws.dbPath)
```

Migration wiring is commented out in the scaffold files pending Phase F.2
import resolution in vitest.config.ts.
