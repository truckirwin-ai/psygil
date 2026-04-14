// =============================================================================
// generate-samples.ts, produce templates + test docs into the repo
// =============================================================================
//
// Run with:  npx tsx app/scripts/generate-samples.ts
//
// Writes to:
//   test-resources/generated-templates/    (7 report templates as .docx + .txt)
//   test-resources/generated-import-samples/ (7 synthetic import documents)
//
// This lets the team eyeball the output without running the full app.
// Safe to run repeatedly; files are overwritten on each run.
// =============================================================================

import { mkdirSync } from 'fs'
import { join, resolve } from 'path'

import {
  provisionAllTemplates,
} from '../src/main/setup/templates/generator'
import { generateAllTestDocuments } from '../src/main/setup/test-docs/generator'
import type { PracticeInfo } from '../src/main/setup/state'

const SAMPLE_PRACTICE: PracticeInfo = {
  fullName: 'Dr. Jordan Whitfield',
  credentials: 'Psy.D., ABPP',
  licenseNumber: 'PSY12345',
  licenseState: 'Colorado',
  specialty: 'forensic',
  practiceName: 'Forensic Psychology Services',
  npi: null,
  practiceAddress: '1234 Grant Street, Denver, CO 80203',
  phone: '(303) 555-0100',
  logoRelPath: null,
}

async function main(): Promise<void> {
  // Resolve relative to the repository root (two levels up from app/scripts)
  const repoRoot = resolve(__dirname, '..', '..')
  const fakeProjectRoot = join(repoRoot, 'test-resources', 'generated-psygil-root')
  const templatesOut = join(fakeProjectRoot, 'templates')
  const samplesOut = join(repoRoot, 'test-resources', 'generated-import-samples')

  mkdirSync(templatesOut, { recursive: true })
  mkdirSync(samplesOut, { recursive: true })

  console.log('Generating report templates into:', templatesOut)
  const templateResults = await provisionAllTemplates({
    projectRoot: fakeProjectRoot,
    practice: SAMPLE_PRACTICE,
    overwrite: true,
  })
  let totalTemplateBytes = 0
  for (const r of templateResults) {
    if (r.skipped) {
      console.log(`  SKIP  ${r.id.padEnd(26)} ${r.skipReason ?? ''}`)
    } else {
      totalTemplateBytes += r.bytesWritten
      console.log(
        `  OK    ${r.id.padEnd(26)} ${(r.bytesWritten / 1024).toFixed(1).padStart(6)} KB  ${r.evalType}`,
      )
    }
  }

  console.log('\nGenerating test import documents into:', samplesOut)
  const samples = await generateAllTestDocuments(samplesOut)
  let totalSampleBytes = 0
  for (const s of samples) {
    totalSampleBytes += s.bytes
    console.log(
      `  OK    ${s.id.padEnd(28)}.${s.format.padEnd(4)} ${(s.bytes / 1024).toFixed(1).padStart(6)} KB`,
    )
  }

  console.log('\nDone.')
  console.log(`  Templates: ${templateResults.length} files, ${(totalTemplateBytes / 1024).toFixed(1)} KB`)
  console.log(`  Samples:   ${samples.length} files, ${(totalSampleBytes / 1024).toFixed(1)} KB`)
}

main().catch((err) => {
  console.error('Failed to generate samples:', err)
  process.exit(1)
})
