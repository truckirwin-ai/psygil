// =============================================================================
// documentImport.test.ts
// Unit tests for the import queue state machine helpers.
// Tests pure logic only; no DOM, no IPC, no React.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  computeNextStatus,
  isQueueComplete,
  countByStatus,
  applyEvent,
} from '../../../src/renderer/src/utils/importQueue'
import type { ImportQueueItem } from '../../../src/renderer/src/utils/importQueue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(id: string, status: ImportQueueItem['status']): ImportQueueItem {
  return { id, name: `${id}.pdf`, path: `/tmp/${id}.pdf`, size: 1024, status }
}

// ---------------------------------------------------------------------------
// computeNextStatus
// ---------------------------------------------------------------------------

describe('computeNextStatus', () => {
  it('pending -> in_progress on start', () => {
    expect(computeNextStatus('pending', 'start')).toBe('in_progress')
  })

  it('in_progress -> ok on complete', () => {
    expect(computeNextStatus('in_progress', 'complete')).toBe('ok')
  })

  it('in_progress -> error on fail', () => {
    expect(computeNextStatus('in_progress', 'fail')).toBe('error')
  })

  it('error -> retrying on retry', () => {
    expect(computeNextStatus('error', 'retry')).toBe('retrying')
  })

  it('retrying -> in_progress on start', () => {
    expect(computeNextStatus('retrying', 'start')).toBe('in_progress')
  })

  it('throws on invalid transition: ok -> start', () => {
    expect(() => computeNextStatus('ok', 'start')).toThrow()
  })

  it('throws on invalid transition: pending -> complete', () => {
    expect(() => computeNextStatus('pending', 'complete')).toThrow()
  })

  it('throws on invalid transition: pending -> retry', () => {
    expect(() => computeNextStatus('pending', 'retry')).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Full transition chains
// ---------------------------------------------------------------------------

describe('transition chains', () => {
  it('happy path: pending -> in_progress -> ok', () => {
    let status = computeNextStatus('pending', 'start')
    expect(status).toBe('in_progress')
    status = computeNextStatus(status, 'complete')
    expect(status).toBe('ok')
  })

  it('error path: pending -> in_progress -> error', () => {
    let status = computeNextStatus('pending', 'start')
    expect(status).toBe('in_progress')
    status = computeNextStatus(status, 'fail')
    expect(status).toBe('error')
  })

  it('retry then ok: error -> retrying -> in_progress -> ok', () => {
    let status = computeNextStatus('error', 'retry')
    expect(status).toBe('retrying')
    status = computeNextStatus(status, 'start')
    expect(status).toBe('in_progress')
    status = computeNextStatus(status, 'complete')
    expect(status).toBe('ok')
  })
})

// ---------------------------------------------------------------------------
// isQueueComplete
// ---------------------------------------------------------------------------

describe('isQueueComplete', () => {
  it('empty queue is complete', () => {
    expect(isQueueComplete([])).toBe(true)
  })

  it('all-ok queue is complete', () => {
    const items = [makeItem('a', 'ok'), makeItem('b', 'ok')]
    expect(isQueueComplete(items)).toBe(true)
  })

  it('all-error queue is complete (terminal state)', () => {
    const items = [makeItem('a', 'error'), makeItem('b', 'error')]
    expect(isQueueComplete(items)).toBe(true)
  })

  it('mixed ok and error is complete', () => {
    const items = [makeItem('a', 'ok'), makeItem('b', 'error')]
    expect(isQueueComplete(items)).toBe(true)
  })

  it('queue with pending item is not complete', () => {
    const items = [makeItem('a', 'ok'), makeItem('b', 'pending')]
    expect(isQueueComplete(items)).toBe(false)
  })

  it('queue with in_progress item is not complete', () => {
    const items = [makeItem('a', 'ok'), makeItem('b', 'in_progress')]
    expect(isQueueComplete(items)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// countByStatus
// ---------------------------------------------------------------------------

describe('countByStatus', () => {
  it('counts pending items', () => {
    const items = [makeItem('a', 'pending'), makeItem('b', 'ok'), makeItem('c', 'pending')]
    expect(countByStatus(items, 'pending')).toBe(2)
  })

  it('returns 0 when no items match', () => {
    const items = [makeItem('a', 'ok'), makeItem('b', 'ok')]
    expect(countByStatus(items, 'error')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// applyEvent
// ---------------------------------------------------------------------------

describe('applyEvent', () => {
  it('advances a specific item and leaves others untouched', () => {
    const items = [makeItem('a', 'pending'), makeItem('b', 'pending')]
    const result = applyEvent(items, 'a', 'start')
    expect(result.find((i) => i.id === 'a')?.status).toBe('in_progress')
    expect(result.find((i) => i.id === 'b')?.status).toBe('pending')
  })

  it('attaches error message on fail', () => {
    const items = [makeItem('a', 'in_progress')]
    const result = applyEvent(items, 'a', 'fail', 'disk full')
    expect(result[0]?.status).toBe('error')
    expect(result[0]?.error).toBe('disk full')
  })

  it('does not mutate the original array', () => {
    const items = [makeItem('a', 'pending')]
    applyEvent(items, 'a', 'start')
    expect(items[0]?.status).toBe('pending')
  })
})
