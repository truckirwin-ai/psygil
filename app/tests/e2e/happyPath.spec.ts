/**
 * E2E happy-path: install fresh, create a case, advance all stages,
 * publish. Runs against the built Electron app in dist/.
 *
 * Prerequisites:
 *   npm run build
 *   npx playwright install
 *
 * This file is a scaffold. Selectors and flows will need to match the
 * final UI. Keep assertions semantic (text, roles) rather than DOM-coupled.
 */

import { _electron as electron, test, expect } from '@playwright/test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

test('fresh install to published report, happy path', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'psygil-e2e-'))

  const app = await electron.launch({
    args: ['dist/main/index.js'],
    env: { ...process.env, PSYGIL_E2E_WORKSPACE: workspace },
  })
  const win = await app.firstWindow()

  // Setup wizard
  await win.getByRole('button', { name: /get started/i }).click()
  await win.getByLabel(/license key/i).fill('TRIAL')
  await win.getByRole('button', { name: /next/i }).click()
  await win.getByRole('radio', { name: /individual/i }).check()
  await win.getByRole('button', { name: /next/i }).click()

  // Storage, pick our tmp workspace via a test-only hook.
  await win.getByRole('button', { name: /use configured workspace/i }).click()

  // Practice info (individual profile still asks for clinician name/NPI)
  await win.getByLabel(/clinician name/i).fill('Dr. Test')
  await win.getByLabel(/npi/i).fill('1234567890')
  await win.getByRole('button', { name: /next/i }).click()
  await win.getByRole('button', { name: /finish/i }).click()

  // Create case, step 1
  await win.getByRole('button', { name: /new case/i }).click()
  await win.getByLabel(/first name/i).fill('Jane')
  await win.getByLabel(/last name/i).fill('Doe')
  await win.getByLabel(/^phone$/i).fill('1112223333')
  await expect(win.getByLabel(/^phone$/i)).toHaveValue('(111) 222-3333')
  await win.getByRole('button', { name: /save and continue/i }).click()

  // Steps 2 through 6, stub-fill the minimum required.
  for (let step = 2; step <= 6; step++) {
    await win.getByRole('button', { name: /save and continue|finish/i }).click()
  }

  // Stage advancement, testing -> interview -> diagnostics.
  await win.getByRole('tab', { name: /testing/i }).click()
  await win.getByRole('button', { name: /advance to interview/i }).click()
  await win.getByRole('tab', { name: /interview/i }).click()
  await win.getByRole('button', { name: /advance to diagnostics/i }).click()

  // Diagnostics, approve all four formulation sections.
  for (const label of ['Clinical Impressions', 'Ruled Out', 'Validity', 'Prognosis']) {
    await win.getByLabel(new RegExp(label, 'i')).fill(`${label}: test narrative.`)
    await win.getByRole('button', { name: `Save ${label}` }).click()
    await win.getByRole('button', { name: `Approve ${label}` }).click()
  }
  await win.getByRole('checkbox', { name: /attest/i }).check()
  await win.getByRole('button', { name: /approve and build report/i }).click()

  // Publish
  await win.getByRole('tab', { name: /report/i }).click()
  await win.getByRole('button', { name: /publish final/i }).click()
  await expect(win.getByText(/case complete/i)).toBeVisible()

  await app.close()
})
