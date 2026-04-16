/**
 * Phase C.4: Unit tests for the rename-pair tracker module.
 *
 * The tracker pairs chokidar unlink+add events that arrive within
 * PAIR_WINDOW_MS and share the same basename, treating them as a single
 * rename rather than a delete + insert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRenamePairTracker, PAIR_WINDOW_MS } from '../../../src/main/workspace/rename-pair'

describe('createRenamePairTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Test 1: unlink(A) + add(A) within window, same basename, different dir -> paired as rename
  it('pairs unlink and add with same basename from different directories within window', () => {
    const tracker = createRenamePairTracker()

    tracker.recordUnlink('/cases/Case-001/Interviews/notes.txt')

    // Advance time to just inside the window
    vi.advanceTimersByTime(PAIR_WINDOW_MS - 10)

    const oldPath = tracker.recordAdd('/cases/Case-001/Archive/notes.txt')
    expect(oldPath).toBe('/cases/Case-001/Interviews/notes.txt')
  })

  // Test 2: unlink(A) + add(B) within window, different basename -> NOT paired
  it('does not pair unlink and add with different basenames within window', () => {
    const tracker = createRenamePairTracker()

    tracker.recordUnlink('/cases/Case-001/Interviews/notes.txt')

    vi.advanceTimersByTime(PAIR_WINDOW_MS - 10)

    const oldPath = tracker.recordAdd('/cases/Case-001/Archive/report.txt')
    expect(oldPath).toBeNull()
  })

  // Test 3: unlink(A) at t=0, add(A) at t=150ms -> NOT paired (window expired)
  it('does not pair when add arrives after window has expired', () => {
    const tracker = createRenamePairTracker()

    tracker.recordUnlink('/cases/Case-001/Testing/scan.pdf')

    // Advance past the window
    vi.advanceTimersByTime(PAIR_WINDOW_MS + 50)

    const oldPath = tracker.recordAdd('/cases/Case-001/Archive/scan.pdf')
    expect(oldPath).toBeNull()
  })

  // Test 4: rapid sequence of 10 events deduped to correct rename/unpaired split
  it('correctly deduplicates a rapid sequence of 10 events', () => {
    const tracker = createRenamePairTracker()

    // 5 files that will be renamed (unlink + add within window)
    const renames = [
      { from: '/cases/A/Interviews/alpha.txt', to: '/cases/A/Archive/alpha.txt' },
      { from: '/cases/A/Interviews/beta.docx', to: '/cases/A/Reports/beta.docx' },
      { from: '/cases/B/Testing/gamma.pdf', to: '/cases/B/Archive/gamma.pdf' },
      { from: '/cases/B/Collateral/delta.txt', to: '/cases/B/Collateral/delta.txt' },
      { from: '/cases/C/Diagnostics/epsilon.txt', to: '/cases/C/Archive/epsilon.txt' },
    ]

    // Record all unlinks first
    for (const r of renames) {
      tracker.recordUnlink(r.from)
    }

    // Advance time to 50ms (inside window)
    vi.advanceTimersByTime(50)

    // Record all adds and collect results
    const paired: Array<{ from: string; to: string }> = []
    for (const r of renames) {
      const from = tracker.recordAdd(r.to)
      if (from !== null) {
        paired.push({ from, to: r.to })
      }
    }

    // All 5 should be paired because they share basenames and are within window
    expect(paired).toHaveLength(5)
    for (const r of renames) {
      expect(paired.some(p => p.from === r.from && p.to === r.to)).toBe(true)
    }

    // flush should return nothing (all were consumed)
    vi.advanceTimersByTime(PAIR_WINDOW_MS + 10)
    const unpaired = tracker.flush()
    expect(unpaired).toHaveLength(0)
  })

  // Additional: flush returns expired unlinks that were never paired
  it('flush returns unpaired unlinks that timed out', () => {
    const tracker = createRenamePairTracker()

    tracker.recordUnlink('/cases/Case-001/Testing/orphan.pdf')
    tracker.recordUnlink('/cases/Case-001/Archive/alone.txt')

    // Advance past window so both expire
    vi.advanceTimersByTime(PAIR_WINDOW_MS + 20)

    const expired = tracker.flush()
    expect(expired).toHaveLength(2)
    expect(expired).toContain('/cases/Case-001/Testing/orphan.pdf')
    expect(expired).toContain('/cases/Case-001/Archive/alone.txt')
  })

  // Additional: second add with same basename does not pair if first was already consumed
  it('does not double-pair the same unlink with two adds', () => {
    const tracker = createRenamePairTracker()

    tracker.recordUnlink('/cases/Case-001/Interviews/notes.txt')

    vi.advanceTimersByTime(20)

    const first = tracker.recordAdd('/cases/Case-001/Archive/notes.txt')
    expect(first).toBe('/cases/Case-001/Interviews/notes.txt')

    // Second add with same basename should not pair (already consumed)
    const second = tracker.recordAdd('/cases/Case-001/Reports/notes.txt')
    expect(second).toBeNull()
  })
})
