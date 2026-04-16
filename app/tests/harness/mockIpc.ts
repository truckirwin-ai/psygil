/**
 * In-memory IPC spy for component and unit tests.
 *
 * Creates a psygil namespace compatible with window.psygil that can be
 * assigned in JSDOM tests. Every method routes through a configurable
 * handler map so tests can control responses, and all calls are recorded
 * so assertions can verify which channels were invoked and with what args.
 *
 * Usage:
 *   const ipc = createMockIpc()
 *   ipc.handlers['cases:list'] = async () => ok({ cases: [], total: 0 })
 *   ;(window as { psygil?: unknown }).psygil = ipc.preloadShim
 *   // ... render component ...
 *   const listCalls = ipc.calls.filter(c => c.channel === 'cases:list')
 *   expect(listCalls).toHaveLength(1)
 */

import { vi } from 'vitest'
import type { IpcResponse } from '../../src/shared/types/ipc'

// ---------------------------------------------------------------------------
// Call record
// ---------------------------------------------------------------------------

export interface IpcCall {
  readonly channel: string
  readonly args: readonly unknown[]
  readonly calledAt: number
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface MockIpc {
  /**
   * Channel handler map. Keys are 'namespace:method' strings.
   * Assign before invoking to override the default stub response.
   */
  readonly handlers: Record<string, (...args: unknown[]) => Promise<IpcResponse<unknown>>>
  /** All recorded invocations in call order. */
  readonly calls: IpcCall[]
  /** Invoke a channel directly (mirrors what the preload shim does). */
  invoke(channel: string, ...args: unknown[]): Promise<IpcResponse<unknown>>
  /** Clears call history and resets all vi.fn() spies. */
  resetAllSpies(): void
  /**
   * Partial window.psygil shim. Assign to (window as { psygil?: unknown }).psygil
   * in JSDOM tests to give renderer code a working IPC surface without Electron.
   */
  readonly preloadShim: Partial<Window['psygil']>
}

// ---------------------------------------------------------------------------
// Default stub response
// ---------------------------------------------------------------------------

function defaultResponse(): IpcResponse<unknown> {
  return { ok: true, status: 'success', data: null }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createMockIpc(): MockIpc {
  const handlers: Record<string, (...args: unknown[]) => Promise<IpcResponse<unknown>>> = {}
  const calls: IpcCall[] = []

  // Spy function that records calls and delegates to handlers.
  function makeSpy(channel: string): (...args: unknown[]) => Promise<IpcResponse<unknown>> {
    return vi.fn(async (...args: unknown[]): Promise<IpcResponse<unknown>> => {
      calls.push({ channel, args: Object.freeze(args), calledAt: Date.now() })
      const handler = handlers[channel]
      if (handler !== undefined) {
        return handler(...args)
      }
      return defaultResponse()
    })
  }

  // Build the invoke function.
  async function invoke(channel: string, ...args: unknown[]): Promise<IpcResponse<unknown>> {
    const spy = makeSpy(channel)
    return spy(...args)
  }

  function resetAllSpies(): void {
    calls.length = 0
    vi.clearAllMocks()
  }

  // Build the preload shim using a Proxy so any namespace.method access is
  // intercepted and routed through the spy infrastructure.
  const spyCache: Record<string, Record<string, (...args: unknown[]) => Promise<IpcResponse<unknown>>>> = {}

  const preloadShim = new Proxy({} as Partial<Window['psygil']>, {
    get(_target: Partial<Window['psygil']>, namespace: string | symbol): unknown {
      if (typeof namespace !== 'string') return undefined
      if (spyCache[namespace] === undefined) {
        spyCache[namespace] = new Proxy({} as Record<string, (...args: unknown[]) => Promise<IpcResponse<unknown>>>, {
          get(_ns: Record<string, (...args: unknown[]) => Promise<IpcResponse<unknown>>>, method: string | symbol): unknown {
            if (typeof method !== 'string') return undefined
            const channel = `${namespace}:${method}`
            // Return a stable spy per channel so vi.clearAllMocks() works correctly.
            if (spyCache[namespace][method] === undefined) {
              spyCache[namespace][method] = makeSpy(channel)
            }
            return spyCache[namespace][method]
          },
        })
      }
      return spyCache[namespace]
    },
  })

  return {
    handlers,
    calls,
    invoke,
    resetAllSpies,
    preloadShim,
  }
}
