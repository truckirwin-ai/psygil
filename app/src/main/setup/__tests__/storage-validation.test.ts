// Unit tests for storage path validation, relies on mocked fs from setup.ts
// where possible, and on real path manipulation for format checks.
import { describe, it, expect } from 'vitest'
import { validateStoragePath } from '../storage-validation'
import { homedir, platform } from 'os'
import { join } from 'path'

describe('validateStoragePath, format rules', () => {
  it('rejects the empty string', () => {
    const r = validateStoragePath('')
    expect(r.ok).toBe(false)
    expect(r.errors.find((e) => e.code === 'INVALID_PATH')).toBeDefined()
  })

  it('rejects relative paths', () => {
    const r = validateStoragePath('./local')
    expect(r.ok).toBe(false)
    expect(r.errors.find((e) => e.code === 'NOT_ABSOLUTE')).toBeDefined()
  })

  it('rejects paths with parent-directory traversal', () => {
    // Use an absolute path that still contains ".." segments
    const p = platform() === 'win32'
      ? 'C:\\Users\\foo\\..\\bar'
      : '/Users/foo/../bar'
    const r = validateStoragePath(p)
    expect(r.ok).toBe(false)
    expect(r.errors.find((e) => e.code === 'PATH_TRAVERSAL')).toBeDefined()
  })

  it('rejects system directories on POSIX', () => {
    if (platform() === 'win32') return
    const r = validateStoragePath('/etc/psygil')
    expect(r.ok).toBe(false)
    expect(r.errors.find((e) => e.code === 'SYSTEM_DIRECTORY')).toBeDefined()
  })

  it('flags iCloud Drive as a cloud-sync warning on macOS', () => {
    if (platform() !== 'darwin') return
    const home = homedir()
    const icloud = join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Psygil')
    const r = validateStoragePath(icloud)
    // May or may not pass the "errors" phase depending on parent existence,
    // but the warning should appear regardless of error state.
    expect(
      r.warnings.find((w) => w.code === 'CLOUD_SYNC_FOLDER'),
    ).toBeDefined()
  })

  it('flags Dropbox-style paths as cloud-sync', () => {
    const home = homedir()
    const dbx = join(home, 'Dropbox', 'Psygil')
    const r = validateStoragePath(dbx)
    expect(
      r.warnings.find((w) => w.code === 'CLOUD_SYNC_FOLDER'),
    ).toBeDefined()
  })
})
