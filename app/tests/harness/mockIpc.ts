/**
 * Minimal mock of window.psygil for component tests.
 * Each namespace returns recorded calls so tests can assert on behavior.
 */

import { vi } from 'vitest'

type Call = { readonly channel: string; readonly args: unknown }

const calls: Call[] = []

export const mockIpc = {
  calls,
  reset(): void { calls.length = 0 },

  install(handlers: Record<string, (args: unknown) => unknown> = {}): void {
    const proxy = new Proxy({} as Record<string, Record<string, unknown>>, {
      get: (_, namespace: string) => new Proxy({}, {
        get: (_t, method: string) => vi.fn(async (args: unknown) => {
          const channel = `${namespace}:${method}`
          calls.push({ channel, args })
          const h = handlers[channel]
          return h ? h(args) : { status: 'ok', data: null }
        }),
      }),
    })
    ;(globalThis as unknown as { window: { psygil: unknown } }).window = { psygil: proxy }
  },
}

export async function invoke(channel: string, args: unknown): Promise<{ status: string; data?: unknown; message?: string }> {
  // Placeholder, to be wired to the real IPC handler registry during integration tests.
  calls.push({ channel, args })
  return { status: 'todo', message: 'wire to real handler registry' }
}
