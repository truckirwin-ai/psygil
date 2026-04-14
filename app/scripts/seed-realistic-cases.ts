// =============================================================================
// seed-realistic-cases.ts, populate the current project root with 10
// realistic synthetic cases, documents, intake, and onboarding data
// =============================================================================
//
// Run with:
//   npx tsx app/scripts/seed-realistic-cases.ts [--overwrite]
//
// The project root is read from {userData}/psygil-setup.json -> storage.projectRoot.
// The DB is opened at {projectRoot}/.psygil/psygil.db and migrated to the current
// schema before seeding.
//
// Safety:
//   - Idempotent: re-running updates rows and preserves existing files
//   - Pass --overwrite to rewrite all files
//   - All content is synthetic; no real patient data
// =============================================================================

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

import { initDb } from '../src/main/db/connection'
import { seedRealisticCases } from '../src/main/setup/case-content/seeder'

function resolveProjectRoot(): string {
  // Mirror the Electron app's userData lookup for macOS
  const userData = join(homedir(), 'Library', 'Application Support', 'psygil-app')
  const configPath = join(userData, 'psygil-setup.json')
  if (!existsSync(configPath)) {
    throw new Error(
      `Setup config not found at ${configPath}. ` +
        'Run the app setup wizard first so a project root is configured.',
    )
  }
  const raw = readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as {
    storage?: { projectRoot?: string } | null
  }
  const root = parsed.storage?.projectRoot
  if (typeof root !== 'string' || root.length === 0) {
    throw new Error(
      `psygil-setup.json has no storage.projectRoot. Run the setup wizard.`,
    )
  }
  return root
}

async function main(): Promise<void> {
  const overwrite = process.argv.includes('--overwrite')

  console.log('\x1b[1mPsygil realistic case seeder\x1b[0m')

  const projectRoot = resolveProjectRoot()
  console.log(`Project root: ${projectRoot}`)
  console.log(`Overwrite:    ${overwrite}`)

  // initDb() reads getDefaultDbPath() which prefers the setup config's
  // projectRoot. As long as the setup config exists, initDb opens the
  // DB at {projectRoot}/.psygil/psygil.db.
  await initDb()

  const results = seedRealisticCases({ projectRoot, overwrite })

  console.log('')
  console.log('Seeded cases:')
  console.log('')
  let totalWritten = 0
  let totalSkipped = 0
  for (const r of results) {
    const paddedNumber = r.caseNumber.padEnd(18)
    const paddedStage = r.stage.padEnd(12)
    console.log(
      `  ${paddedNumber}  stage=${paddedStage}  docs written=${r.documentsWritten}  skipped=${r.documentsSkipped}`,
    )
    totalWritten += r.documentsWritten
    totalSkipped += r.documentsSkipped
  }
  console.log('')
  console.log(
    `Total: ${results.length} cases, ${totalWritten} documents written, ${totalSkipped} skipped`,
  )
}

main().catch((err) => {
  console.error('\x1b[31mSeeder failed:\x1b[0m', err)
  process.exit(1)
})
