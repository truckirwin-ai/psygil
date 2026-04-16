# Visual Regression Tests - Phase F Stub

## Target: 24 snapshots (4 themes x 6 primary tabs)

### Snapshot matrix

| Tab | light | warm | medium | dark |
|-----|-------|------|--------|------|
| Dashboard | snapshot | snapshot | snapshot | snapshot |
| Clinical Overview | snapshot | snapshot | snapshot | snapshot |
| Diagnostics | snapshot | snapshot | snapshot | snapshot |
| Eval Report | snapshot | snapshot | snapshot | snapshot |
| Settings (Appearance) | snapshot | snapshot | snapshot | snapshot |
| Audit Trail | snapshot | snapshot | snapshot | snapshot |

**Total: 24 snapshots.**

### Implementation status

Phase E.7 completes the token infrastructure. Phase F.1 will write the
actual Playwright tests that:

1. Launch the Electron app in each theme (set via `data-theme` attribute
   before navigation).
2. Navigate to each of the 6 tabs.
3. Take a full-page screenshot.
4. Compare to the baseline snapshot stored in `tests/visual/snapshots/`.

### Playwright config stub (Phase F.1 will expand this)

```typescript
// tests/visual/playwright.config.ts (stub - do not run yet)
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  snapshotDir: './tests/visual/snapshots',
  use: {
    // Electron launch config goes here
  },
  projects: [
    { name: 'theme-light', use: { extraHTMLAttributes: { 'data-theme': 'light' } } },
    { name: 'theme-warm', use: { extraHTMLAttributes: { 'data-theme': 'warm' } } },
    { name: 'theme-medium', use: { extraHTMLAttributes: { 'data-theme': 'medium' } } },
    { name: 'theme-dark', use: { extraHTMLAttributes: { 'data-theme': 'dark' } } },
  ],
})
```

### Acceptance criteria (Phase F.1)

- All 24 snapshots pass with a pixel diff threshold of less than 0.1%.
- Any new theme token addition regenerates baselines via
  `npx playwright test --update-snapshots`.
- CI blocks merges when snapshot diffs exceed the threshold.
