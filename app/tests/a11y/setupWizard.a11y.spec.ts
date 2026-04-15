/**
 * Accessibility smoke test, Setup Wizard. Zero critical axe-core issues.
 */

import { _electron as electron, test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('setup wizard passes axe-core critical check', async () => {
  const app = await electron.launch({ args: ['dist/main/index.js'] })
  const win = await app.firstWindow()
  // @ts-expect-error, AxeBuilder typed for Page, electron window is compatible enough for this smoke test
  const results = await new AxeBuilder({ page: win }).include('body').analyze()
  const critical = results.violations.filter(v => v.impact === 'critical')
  expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0)
  await app.close()
})
