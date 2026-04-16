// =============================================================================
// importQueue.ts
// Pure state-machine helpers for the document import queue.
// These are intentionally free of React and side-effects so they can be
// unit-tested without a DOM.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportStatus = 'pending' | 'in_progress' | 'ok' | 'error' | 'retrying'

export type ImportEvent =
  | 'start'
  | 'complete'
  | 'fail'
  | 'retry'

export interface ImportQueueItem {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly size: number
  status: ImportStatus
  error?: string
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/**
 * Given the current status and an event, return the next status.
 * Throws if the transition is not valid.
 */
export function computeNextStatus(
  current: ImportStatus,
  event: ImportEvent,
): ImportStatus {
  switch (event) {
    case 'start': {
      if (current === 'pending' || current === 'retrying') return 'in_progress'
      throw new Error(`Cannot start from status "${current}"`)
    }
    case 'complete': {
      if (current === 'in_progress') return 'ok'
      throw new Error(`Cannot complete from status "${current}"`)
    }
    case 'fail': {
      if (current === 'in_progress') return 'error'
      throw new Error(`Cannot fail from status "${current}"`)
    }
    case 'retry': {
      if (current === 'error') return 'retrying'
      throw new Error(`Cannot retry from status "${current}"`)
    }
  }
}

// ---------------------------------------------------------------------------
// Queue helpers
// ---------------------------------------------------------------------------

/** Returns true when every item in the queue has reached a terminal state. */
export function isQueueComplete(items: readonly ImportQueueItem[]): boolean {
  if (items.length === 0) return true
  return items.every((item) => item.status === 'ok' || item.status === 'error')
}

/** Count items in a given status. */
export function countByStatus(
  items: readonly ImportQueueItem[],
  status: ImportStatus,
): number {
  return items.filter((item) => item.status === status).length
}

/** Apply an event to the item with the given id, returning a new array. */
export function applyEvent(
  items: readonly ImportQueueItem[],
  id: string,
  event: ImportEvent,
  errorMessage?: string,
): ImportQueueItem[] {
  return items.map((item) => {
    if (item.id !== id) return item
    const nextStatus = computeNextStatus(item.status, event)
    return {
      ...item,
      status: nextStatus,
      error: event === 'fail' ? (errorMessage ?? 'Import failed') : item.error,
    }
  })
}
