# E2E Tests

Playwright tests that run against the built Electron app. These require
`npm run build` and `npx playwright install` before executing.

---

## Phase F.1 status

The happy-path scaffold lives at `tests/e2e/happyPath.spec.ts`. Full
selector wiring and assertion coverage land in Phase F.2 hardening.

---

## Test inventory

### Happy path (Phase F.2)

File: `tests/e2e/happy-path.spec.ts` (to be written in Phase F.2)

Covers the full create-to-publish flow:

1. Fresh install, setup wizard (license key, practice type, clinician info)
2. Create a case (intake form, all 6 wizard steps)
3. Advance through the 6-stage pipeline: Onboarding, Testing, Interview,
   Diagnostics, Review, Complete
4. Publish final report and confirm "case complete" status

Run with:

```bash
npx playwright test tests/e2e/happy-path.spec.ts
```

Run smoke subset only:

```bash
npx playwright test tests/e2e/ --grep @smoke
```

### Visual regression

File: `tests/visual/theme-coverage.spec.ts` (wired in Phase E.7 / F.2)

Covers 4 themes x 6 primary tabs = 24 snapshots. See
`tests/visual/README.md` for the full snapshot matrix and baseline
instructions.

---

## Running all E2E tests

```bash
# Full E2E suite
npx playwright test tests/e2e/

# Smoke subset only
npx playwright test tests/e2e/ --grep @smoke

# With UI (headed mode for debugging)
npx playwright test tests/e2e/ --headed
```

Playwright config: `tests/playwright.config.ts`

---

## Prerequisites

```bash
npm run build               # build the Electron app to dist/
npx playwright install      # install browser/Electron binaries
```

E2E tests are excluded from `npm test` (vitest). Run them separately via
`npx playwright test`.
