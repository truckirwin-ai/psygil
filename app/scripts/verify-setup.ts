// =============================================================================
// verify-setup.ts, standalone end-to-end verifier for the setup module
// =============================================================================
//
// Run with:  npx tsx app/scripts/verify-setup.ts
//
// This script does NOT use vitest. It runs all the pure-logic checks in the
// __tests__ directory and then performs real filesystem operations against
// a temporary directory to verify:
//
//   1. State machine transitions are correct
//   2. License validator accepts/rejects correctly
//   3. Storage validator detects cloud sync folders and system dirs
//   4. provisionProjectRoot creates the expected directory structure
//   5. provisionTemplates writes 7 DOCX + TXT twins and mammoth can re-read each
//   6. Test document generator writes every format and round-trips correctly
//
// Exits with code 0 on success, 1 on any failure. Prints a PASS/FAIL table.
// =============================================================================

import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'fs'
import { tmpdir, platform, homedir } from 'os'
import { join } from 'path'

import {
  SETUP_STATES,
  stateRank,
  isAtLeast,
  nextState,
  advanceTo,
  freshConfig,
  isSetupComplete,
  type SetupConfig,
} from '../src/main/setup/state'
import {
  validateLocal,
  normalizeLicenseKey,
  validateLicense,
  isWithinOfflineGracePeriod,
} from '../src/main/setup/license'
import {
  validateStoragePath,
  provisionProjectRoot,
} from '../src/main/setup/storage-validation'
import {
  applyTokens,
  buildPracticeTokenMap,
  provisionTemplates,
} from '../src/main/setup/templates/generator'
import {
  seedWorkspaceContent,
  summarizeSeedResults,
} from '../src/main/setup/workspace-content/seeder'
import {
  REPORT_TEMPLATES,
  SUPPORTED_EVAL_TYPES,
  templatesForEvalTypes,
} from '../src/main/setup/templates/registry'
import { generateAllTestDocuments } from '../src/main/setup/test-docs/generator'
import { TEST_DOCUMENTS } from '../src/main/setup/test-docs/registry'
import type { PracticeInfo } from '../src/main/setup/state'

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

interface Result {
  readonly name: string
  readonly ok: boolean
  readonly message: string
}

const results: Result[] = []

function check(name: string, condition: boolean, message = ''): void {
  results.push({ name, ok: condition, message })
  const status = condition ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`  ${status}  ${name}${message.length > 0 ? ', ' + message : ''}`)
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

// ---------------------------------------------------------------------------
// Sample practice info, used for template provisioning
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. State machine
// ---------------------------------------------------------------------------

async function checkStateMachine(): Promise<void> {
  section('1. State machine')
  check('has 9 ordered states', SETUP_STATES.length === 9)
  check('fresh is first', SETUP_STATES[0] === 'fresh')
  check('complete is last', SETUP_STATES[SETUP_STATES.length - 1] === 'complete')
  check('stateRank monotonic', stateRank('fresh') === 0 && stateRank('complete') === 8)
  check('isAtLeast forward true', isAtLeast('storage_ready', 'fresh'))
  check('isAtLeast backward false', !isAtLeast('fresh', 'storage_ready'))
  check('nextState fresh→sidecar_verified', nextState('fresh') === 'sidecar_verified')
  check('nextState complete clamps', nextState('complete') === 'complete')

  const base: SetupConfig = { ...freshConfig(), setupState: 'profile_done' }
  check(
    'advanceTo forward',
    advanceTo(base, 'ai_configured').setupState === 'ai_configured',
  )
  check(
    'advanceTo backward is no-op',
    advanceTo(base, 'fresh').setupState === 'profile_done',
  )
  check('isSetupComplete false initially', !isSetupComplete(freshConfig()))
}

// ---------------------------------------------------------------------------
// 2. License
// ---------------------------------------------------------------------------

async function checkLicense(): Promise<void> {
  section('2. License validation')
  check(
    'normalizeLicenseKey strips whitespace and uppercases',
    normalizeLicenseKey(' psgil - solo1 - abcde - 12345 - xyz7q ') ===
      'PSGIL-SOLO1-ABCDE-12345-XYZ7Q',
  )

  const solo = validateLocal('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
  check('solo key accepted', solo.ok === true)
  check('solo tier', solo.license?.tier === 'solo')
  check('solo seats = 1', solo.license?.seats === 1)

  const prac = validateLocal('PSGIL-PRAC1-SEAT5-ABCDE-12345')
  check('practice key accepted', prac.ok === true)
  check('practice tier', prac.license?.tier === 'practice')
  check('practice seats = 5', prac.license?.seats === 5)

  const entr = validateLocal('PSGIL-ENTR1-ABCDE-12345-67890')
  check('enterprise key accepted', entr.ok === true)
  check('enterprise default seats = 25', entr.license?.seats === 25)

  const bad = validateLocal('not-a-license')
  check('malformed rejected', !bad.ok && bad.errorCode === 'MALFORMED')

  const unknownTier = validateLocal('PSGIL-BOGUS-ABCDE-12345-XYZ7Q')
  check(
    'unknown tier rejected',
    !unknownTier.ok && unknownTier.errorCode === 'UNKNOWN_TIER',
  )

  // validateLicense top-level: with no server configured, returns local result
  delete process.env['PSYGIL_LICENSE_SERVER']
  const noServer = await validateLicense('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
  check('no-server validateLicense returns local source', noServer.source === 'local')
  check('no-server validateLicense ok', noServer.ok === true)
  check('no-server is not offline fallback', noServer.offlineFallback === false)

  // With an unreachable server, validateLicense falls back to local
  // and marks offlineFallback=true
  process.env['PSYGIL_LICENSE_SERVER'] = 'https://license.invalid.psygil.example'
  const offline = await validateLicense('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
  check('unreachable server falls back to local', offline.ok === true)
  check('unreachable server marks offline fallback', offline.offlineFallback === true)
  delete process.env['PSYGIL_LICENSE_SERVER']

  // Grace period helper
  const now = new Date().toISOString()
  check('within grace period: now', isWithinOfflineGracePeriod(now))
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  check('outside grace period: 30 days ago', !isWithinOfflineGracePeriod(old))
  check('grace period rejects garbage timestamp', !isWithinOfflineGracePeriod('not-a-date'))
}

// ---------------------------------------------------------------------------
// 3. Storage validation
// ---------------------------------------------------------------------------

async function checkStorageValidation(): Promise<void> {
  section('3. Storage validation')
  check(
    'empty path rejected',
    !validateStoragePath('').ok,
  )
  check(
    'relative path rejected',
    !validateStoragePath('./local').ok,
  )

  if (platform() !== 'win32') {
    const sysResult = validateStoragePath('/etc/psygil')
    check(
      'system directory /etc rejected',
      !sysResult.ok &&
        sysResult.errors.some((e) => e.code === 'SYSTEM_DIRECTORY'),
    )
  }

  const dropboxResult = validateStoragePath(join(homedir(), 'Dropbox', 'Psygil'))
  check(
    'Dropbox path flagged as CLOUD_SYNC_FOLDER',
    dropboxResult.warnings.some((w) => w.code === 'CLOUD_SYNC_FOLDER'),
  )

  // A real absolute path whose parent exists (tmpdir) should pass
  const tmpTarget = join(tmpdir(), `psygil-verify-${Date.now()}`)
  const validResult = validateStoragePath(tmpTarget)
  check('tmpdir target is valid', validResult.ok)
  check('tmpdir target normalized', validResult.normalizedPath === tmpTarget)
}

// ---------------------------------------------------------------------------
// 4. Project root provisioning (real fs)
// ---------------------------------------------------------------------------

async function checkProjectRootProvisioning(tmpRoot: string): Promise<void> {
  section('4. Project root provisioning')
  const created = provisionProjectRoot(tmpRoot)
  check('at least one folder created', created.length > 0)
  check('.psygil exists', existsSync(join(tmpRoot, '.psygil')))
  check('.psygil/assets exists', existsSync(join(tmpRoot, '.psygil', 'assets')))
  check('cases/ exists', existsSync(join(tmpRoot, 'cases')))
  check('Workspace/ exists', existsSync(join(tmpRoot, 'Workspace')))
  check(
    'Workspace/Writing Samples exists',
    existsSync(join(tmpRoot, 'Workspace', 'Writing Samples')),
  )
  check(
    'Workspace/Templates exists',
    existsSync(join(tmpRoot, 'Workspace', 'Templates')),
  )
  check(
    'Workspace/Documents exists',
    existsSync(join(tmpRoot, 'Workspace', 'Documents')),
  )
  check(
    'Workspace/Testing exists',
    existsSync(join(tmpRoot, 'Workspace', 'Testing')),
  )
  check(
    'Workspace/Forms exists',
    existsSync(join(tmpRoot, 'Workspace', 'Forms')),
  )

  // Idempotent re-run
  const second = provisionProjectRoot(tmpRoot)
  check('second provisioning is no-op', second.length === 0)
}

// ---------------------------------------------------------------------------
// 5. Template provisioning + DOCX round trip via mammoth
// ---------------------------------------------------------------------------

async function checkTemplates(tmpRoot: string): Promise<void> {
  section('5. Template provisioning')
  check('registry has 7 templates', REPORT_TEMPLATES.length === 7)
  check('SUPPORTED_EVAL_TYPES has 7 entries', SUPPORTED_EVAL_TYPES.length === 7)

  const tokens = buildPracticeTokenMap(SAMPLE_PRACTICE)
  check(
    'buildPracticeTokenMap PRACTICE_NAME',
    tokens.PRACTICE_NAME === 'Forensic Psychology Services',
  )
  check(
    'applyTokens preserves unknown placeholders',
    applyTokens('{{PRACTICE_NAME}} {{UNKNOWN}}', tokens) ===
      'Forensic Psychology Services {{UNKNOWN}}',
  )

  const subset = templatesForEvalTypes(['CST', 'PTSD Dx'])
  check('templatesForEvalTypes filters to 2', subset.length === 2)

  const results = await provisionTemplates({
    projectRoot: tmpRoot,
    practice: SAMPLE_PRACTICE,
    selectedEvalTypes: [...SUPPORTED_EVAL_TYPES],
    overwrite: true,
  })
  check('provisionTemplates returned 7 results', results.length === 7)

  let allWritten = true
  for (const r of results) {
    if (r.skipped || !existsSync(r.docxPath)) {
      allWritten = false
      console.log(
        `  \x1b[33m  ${r.id}: skipped=${r.skipped} reason=${r.skipReason ?? ''}\x1b[0m`,
      )
    }
  }
  check('all 7 templates written to disk', allWritten)

  // Round trip: mammoth reads the DOCX and should return non-empty text
  // that contains the practice name.
  const mammoth = await import('mammoth')
  for (const r of results) {
    if (r.skipped) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extracted = await (mammoth as any).extractRawText({ path: r.docxPath })
    const text: string = extracted.value
    check(
      `mammoth extracts text from ${r.id}.docx`,
      text.length > 500,
      `${text.length} chars`,
    )
    check(
      `${r.id}.docx contains practice name`,
      text.includes('Forensic Psychology Services'),
    )
    // Patient placeholders should remain
    check(
      `${r.id}.docx preserves patient placeholders`,
      text.includes('{{PATIENT_NAME}}') || text.includes('{{CASE_NUMBER}}'),
    )
    // Confirm the template landed under /Workspace/Templates/ (new path)
    check(
      `${r.id}.docx lives under /Workspace/Templates/`,
      r.docxPath.includes(`${'/'}Workspace${'/'}Templates${'/'}`) ||
        r.docxPath.includes(`\\Workspace\\Templates\\`),
    )
  }
}

// ---------------------------------------------------------------------------
// 5b. Workspace content seeder
// ---------------------------------------------------------------------------

async function checkWorkspaceSeeder(tmpRoot: string): Promise<void> {
  section('5b. Workspace content seeder')
  const seeded = await seedWorkspaceContent({
    projectRoot: tmpRoot,
    practice: SAMPLE_PRACTICE,
    overwrite: true,
  })
  const summary = summarizeSeedResults(seeded)

  check('seeder ran and returned results', seeded.length > 0)
  check('all writes succeeded (no failures)', summary.failed === 0)
  check(
    'Writing Samples seeded (>=2)',
    (summary.byCategory['writing-samples'] ?? 0) >= 2,
  )
  check(
    'Documents seeded (>=6)',
    (summary.byCategory['documents'] ?? 0) >= 6,
  )
  check(
    'Testing guides seeded (>=7)',
    (summary.byCategory['testing'] ?? 0) >= 7,
  )
  check('Forms seeded (>=5)', (summary.byCategory['forms'] ?? 0) >= 5)

  // Sample a concrete file path for each category
  const wsDir = join(tmpRoot, 'Workspace')
  check(
    'Writing Samples directory has files',
    existsSync(join(wsDir, 'Writing Samples', 'Writing_Sample_CST_Maynard.txt')),
  )
  check(
    'Documents directory has DSM reference',
    existsSync(join(wsDir, 'Documents', 'DSM-5-TR_Forensic_Quick_Reference.md')),
  )
  check(
    'Testing directory has MMPI-3 guide',
    existsSync(join(wsDir, 'Testing', 'MMPI-3_Scoring_Quick_Reference.md')),
  )
  check(
    'Forms directory has consent form',
    existsSync(join(wsDir, 'Forms', 'Informed_Consent_Forensic_Evaluation.docx')),
  )

  // Idempotent re-run: no overwrite → every entry should be skipped
  const second = await seedWorkspaceContent({
    projectRoot: tmpRoot,
    practice: SAMPLE_PRACTICE,
    overwrite: false,
  })
  const secondSummary = summarizeSeedResults(second)
  check(
    'second seeder run is idempotent',
    secondSummary.written === 0 && secondSummary.skipped === second.length,
  )
}

// ---------------------------------------------------------------------------
// 6. Test documents + round trip
// ---------------------------------------------------------------------------

async function checkTestDocuments(outDir: string): Promise<void> {
  section('6. Test document generator')
  const generated = await generateAllTestDocuments(outDir)
  check(
    `generated ${TEST_DOCUMENTS.length} test documents`,
    generated.length === TEST_DOCUMENTS.length,
  )

  // All formats covered
  const formats = new Set(generated.map((g) => g.format))
  for (const fmt of ['pdf', 'docx', 'txt', 'rtf', 'md', 'csv']) {
    check(`${fmt} written`, formats.has(fmt as 'pdf'))
  }

  // Each file exists and is non-empty
  for (const g of generated) {
    check(
      `${g.id}.${g.format} exists`,
      existsSync(g.path) && statSync(g.path).size > 0,
    )
  }

  // PDF round trip via pdf-parse v2 class API
  const pdfGen = generated.find((g) => g.format === 'pdf')
  if (pdfGen !== undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParseModule = (await import('pdf-parse')) as any
      const PDFParseCtor = pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse
      if (typeof PDFParseCtor !== 'function') {
        throw new Error('PDFParse class not found on pdf-parse module')
      }
      const buf = readFileSync(pdfGen.path)
      const parser = new PDFParseCtor({ data: buf })
      const parsed = await parser.getText()
      const text: string = parsed.text ?? parsed.pages?.map((p: { text: string }) => p.text).join('\n') ?? ''
      check(
        'pdf-parse extracts text from generated PDF',
        text.length > 100,
        `${text.length} chars`,
      )
      check(
        'PDF text contains SYNTHETIC marker',
        text.includes('SYNTHETIC'),
      )
    } catch (err) {
      check('pdf-parse round-trip', false, (err as Error).message)
    }
  }

  // DOCX round trip via mammoth
  const mammoth = await import('mammoth')
  const docxGen = generated.find((g) => g.format === 'docx')
  if (docxGen !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extracted = await (mammoth as any).extractRawText({ path: docxGen.path })
    check(
      'mammoth extracts text from generated DOCX',
      extracted.value.length > 100,
    )
    check(
      'DOCX text contains SYNTHETIC marker',
      extracted.value.includes('SYNTHETIC'),
    )
  }

  // TXT/RTF/MD/CSV: plain read
  for (const fmt of ['txt', 'rtf', 'md', 'csv'] as const) {
    const g = generated.find((x) => x.format === fmt)
    if (g !== undefined) {
      const content = readFileSync(g.path, 'utf-8')
      check(
        `${fmt} contains SYNTHETIC marker`,
        content.includes('SYNTHETIC'),
      )
    }
  }

  // RTF strip-to-text sanity
  const rtfGen = generated.find((g) => g.format === 'rtf')
  if (rtfGen !== undefined) {
    const { stripRtfForVerifier } = await loadStripRtf()
    const stripped = stripRtfForVerifier(readFileSync(rtfGen.path, 'utf-8'))
    check(
      'RTF strip produces readable text',
      stripped.length > 100 && stripped.includes('SYNTHETIC'),
      `${stripped.length} chars`,
    )
  }
}

/**
 * Re-implement stripRtf inline so the verifier doesn't depend on importing
 * from documents/index.ts (which would pull in DB connection code).
 */
async function loadStripRtf(): Promise<{ stripRtfForVerifier: (rtf: string) => string }> {
  return {
    stripRtfForVerifier: (rtf: string): string => {
      let out = rtf
      out = out.replace(/\\par[d]?/g, '\n')
      out = out.replace(/\\line/g, '\n')
      out = out.replace(/\\'[0-9a-fA-F]{2}/g, '')
      out = out.replace(/\\u-?\d+\??/g, '')
      out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      out = out.replace(/[{}]/g, '')
      out = out.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').trim()
      return out
    },
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\x1b[1mPsygil setup verifier\x1b[0m')

  const tmpRoot = mkdtempSync(join(tmpdir(), 'psygil-verify-'))
  console.log(`Temporary project root: ${tmpRoot}`)

  try {
    await checkStateMachine()
    await checkLicense()
    await checkStorageValidation()
    await checkProjectRootProvisioning(tmpRoot)
    await checkTemplates(tmpRoot)
    await checkWorkspaceSeeder(tmpRoot)

    const testDocDir = join(tmpRoot, 'test-import-samples')
    await checkTestDocuments(testDocDir)
  } finally {
    // Keep the output when VERIFY_KEEP=1 for manual inspection
    if (process.env.VERIFY_KEEP !== '1') {
      try {
        rmSync(tmpRoot, { recursive: true, force: true })
      } catch (err) {
        console.warn(`\nWarning: failed to clean up ${tmpRoot}: ${(err as Error).message}`)
      }
    } else {
      console.log(`\n(kept at ${tmpRoot} because VERIFY_KEEP=1)`)
    }
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n\x1b[1mSummary:\x1b[0m ${results.length - failed.length}/${results.length} passed`,
  )
  if (failed.length > 0) {
    console.log('\n\x1b[31mFailures:\x1b[0m')
    for (const f of failed) {
      console.log(`  - ${f.name}${f.message.length > 0 ? ', ' + f.message : ''}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\x1b[31mUnhandled error in verifier:\x1b[0m', err)
  process.exit(1)
})
