import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import { archiveDrafts } from '../../../src/main/reports/archive'

// The global setup (src/main/__tests__/setup.ts) mocks fs with no-op stubs.
// We override specific methods to simulate a draft directory so the unit
// behavior of archiveDrafts can be exercised without touching real disk.

describe('archiveDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 when drafts dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    const res = archiveDrafts('/tmp/nope', '/tmp/archive')
    expect(res.movedCount).toBe(0)
    expect(res.archiveDir).toBe('/tmp/archive')
  })

  it('moves draft_vN.docx and skips other files', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue([
      'draft_v1.docx',
      'draft_v2.docx',
      'notes.txt',
      'scratch.bak',
    ] as unknown as string[])

    const res = archiveDrafts('/tmp/drafts', '/tmp/archive')

    expect(res.movedCount).toBe(2)
    expect(fs.renameSync).toHaveBeenCalledTimes(2)
    expect(fs.renameSync).toHaveBeenCalledWith(
      '/tmp/drafts/draft_v1.docx',
      '/tmp/archive/draft_v1.docx',
    )
    expect(fs.renameSync).toHaveBeenCalledWith(
      '/tmp/drafts/draft_v2.docx',
      '/tmp/archive/draft_v2.docx',
    )
  })

  it('creates the archive directory before moving', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue(['draft_v1.docx'] as unknown as string[])

    archiveDrafts('/tmp/drafts', '/tmp/archive')

    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/archive', { recursive: true })
  })

  it('regex is anchored: does not match draft_v1.docx.bak', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readdirSync).mockReturnValue([
      'draft_v1.docx.bak',
      'olddraft_v1.docx',
    ] as unknown as string[])

    const res = archiveDrafts('/tmp/drafts', '/tmp/archive')

    expect(res.movedCount).toBe(0)
    expect(fs.renameSync).not.toHaveBeenCalled()
  })
})
