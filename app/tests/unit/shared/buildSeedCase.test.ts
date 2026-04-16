/**
 * Unit tests for tests/harness/buildSeedCase.
 *
 * The global test setup (src/main/__tests__/setup.ts) mocks the 'fs' module
 * so mkdirSync and existsSync are vi.fn() stubs. These tests verify the
 * logical behavior of buildSeedCase (which paths it creates, which files it
 * writes) by inspecting spy calls rather than the real filesystem.
 *
 * Tests that require a live SQLite connection are marked .todo and land in
 * Phase F.2 integration tests.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import * as fs from 'fs'
import { join } from 'path'
import { buildSeedCase, CASE_SUBFOLDERS } from '../../harness/buildSeedCase'

describe('buildSeedCase', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a case at onboarding stage with the expected folder structure', () => {
    // The global fs mock makes existsSync return true and mkdirSync a vi.fn() stub.
    // Spy on writeFileSync so it does not actually write to disk in this unit test.
    const writeFileSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined)

    const workspacePath = '/tmp/psygil-test-unit'

    const result = buildSeedCase({
      workspacePath,
      caseNumber: 'TEST-0001',
      stage: 'onboarding',
    })

    // Result shape is correct.
    expect(result.caseId).toBe(1)
    expect(result.caseFolder).toContain('TEST-0001')
    expect(result.caseFolder.startsWith(workspacePath)).toBe(true)

    const expectedRoot = join(workspacePath, 'cases', 'TEST-0001 Test, Examinee')
    expect(result.caseFolder).toBe(expectedRoot)

    // mkdirSync was called for the case folder root.
    const mkdirSpy = vi.mocked(fs.mkdirSync)
    const mkdirPaths = mkdirSpy.mock.calls.map(([p]) => p)

    // Note: the global setup mocks existsSync to always return true, so the
    // root-folder mkdirSync call is skipped (the guard sees the folder as
    // already existing). We verify subfolder creation only here.
    // mkdirSync was called for all 7 standard subfolders.
    for (const sub of CASE_SUBFOLDERS) {
      const subPath = join(expectedRoot, sub)
      expect(
        mkdirPaths.includes(subPath),
        `mkdirSync called for subfolder ${sub}`,
      ).toBe(true)
    }

    // writeFileSync was called for the intake placeholder inside _Inbox.
    const intakePath = join(expectedRoot, '_Inbox', 'intake.md')
    expect(writeFileSpy).toHaveBeenCalledWith(intakePath, expect.any(String), 'utf-8')
  })

  it.todo(
    'with gate2Approved: true inserts the required diagnostic_decisions rows (needs integration DB)',
    // Rationale: inserting diagnostic_decisions requires a real SQLite DB
    // provisioned via createTmpWorkspace({ seed: true }) + migration manifest.
    // This test lands in tests/integration/ in Phase F.2.
  )

  it.todo(
    'with attested: true emits the correct audit row type (needs integration DB)',
    // Rationale: the attestation_signed audit row requires a live DB and the
    // audit trail handler from src/main/audit/. Wired in Phase F.2.
  )
})
