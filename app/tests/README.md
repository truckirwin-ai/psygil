# Psygil Test Harness

See `docs/engineering/32_Test_Harness_Spec.md` for the full architecture.

## Layout

- `unit/`, pure-function tests, fast.
- `component/`, React components with Testing Library.
- `ipc/`, main-process IPC handlers in isolation.
- `integration/`, main + DB + filesystem against a tmp workspace.
- `e2e/`, full Electron app driven by Playwright.
- `fixtures/`, seed DB, sample cases, sample documents.
- `harness/`, shared helpers (tmp workspace, mock IPC, hard-rule scanner).
- `visual/`, Playwright screenshot diffs.
- `perf/`, performance probes.
- `a11y/`, axe-core checks.

## Running

```bash
# unit + component + ipc + integration
npm run test

# e2e (requires built app)
npm run test:e2e

# coverage
npm run test:coverage

# hard-rule scan (must pass before publish)
npm run test:hardrule
```

## Quality gates

CI blocks merge if any of:
- unit/component/ipc/integration red
- coverage below 80 percent
- hard-rule scan finds U+2014, U+2013, or AI watermark strings
- gitleaks finds secrets
- axe-core reports critical a11y issues
