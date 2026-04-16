# Accessibility Tests

Axe-core + Playwright setup lands in Phase F.2. The `setupWizard.a11y.spec.ts`
scaffold in this directory is a Playwright test that launches the Electron
app and runs an axe-core critical-violation check against the setup wizard.
It requires the built app and the `@axe-core/playwright` package.

The three primary surfaces targeted for WCAG 2.1 AA coverage are:

- Setup wizard (all 6 steps, keyboard-navigable, screen-reader labeled).
- Diagnostics tab (formulation sections, approval buttons, attestation checkbox).
- Audit trail tab (sortable table, date filters, accessible pagination).

Run with:

```bash
npx playwright test tests/a11y/
```

Requires `npm run build` and `npx playwright install` before running.
