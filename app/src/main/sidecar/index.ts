/**
 * Psygil Python Sidecar Lifecycle Manager
 *
 * Process 4 in the 4-process architecture.
 * Spawns the Python sidecar, waits for readiness, provides health checks,
 * and handles graceful shutdown.
 *
 * Socket: /tmp/psygil-sidecar.sock (macOS only; Windows named pipe deferred)
 */

import { spawn, type ChildProcess } from 'child_process'
import { join } from 'path'
import * as net from 'net'

const SOCKET_PATH = '/tmp/psygil-sidecar.sock'
const READY_TIMEOUT_MS = 10_000
const HEALTH_TIMEOUT_MS = 5_000

let sidecarProcess: ChildProcess | null = null

/**
 * Spawn the Python sidecar and wait for the {"status":"ready","pid":...}
 * message on stdout before resolving.
 */
export function spawnSidecar(): Promise<{ pid: number }> {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, '..', '..', '..', '..', 'sidecar', 'server.py')

    const child = spawn('python3', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    sidecarProcess = child

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Sidecar startup timed out'))
    }, READY_TIMEOUT_MS)

    let stdoutBuffer = ''

    child.stdout!.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split('\n')

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as { status: string; pid: number }
          if (msg.status === 'ready' && typeof msg.pid === 'number') {
            clearTimeout(timeout)
            resolve({ pid: msg.pid })
            return
          }
        } catch {
          // Not JSON yet — keep buffering
        }
      }
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      sidecarProcess = null
      reject(new Error(`Failed to spawn sidecar: ${err.message}`))
    })

    child.on('exit', (code, sig) => {
      clearTimeout(timeout)
      sidecarProcess = null
      // If we haven't resolved yet, this is an unexpected exit
      reject(new Error(`Sidecar exited unexpectedly: code=${code}, signal=${sig}`))
    })
  })
}

/**
 * Send a JSON-RPC health/ping to the sidecar via Unix socket.
 * Resolves with the result or rejects on timeout / connection error.
 */
export function healthCheck(): Promise<{ status: string }> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()

    const timeout = setTimeout(() => {
      client.destroy()
      reject(new Error('Sidecar health check timed out'))
    }, HEALTH_TIMEOUT_MS)

    client.connect(SOCKET_PATH, () => {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        method: 'health/ping',
        id: 1,
      })
      client.write(request + '\n')
    })

    let buffer = ''

    client.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      if (buffer.includes('\n')) {
        clearTimeout(timeout)
        try {
          const resp = JSON.parse(buffer.split('\n')[0]) as {
            result?: { status: string }
            error?: { code: number; message: string }
          }
          client.destroy()
          if (resp.error) {
            reject(new Error(`Sidecar error: ${resp.error.message}`))
          } else {
            resolve(resp.result as { status: string })
          }
        } catch (err) {
          client.destroy()
          reject(new Error(`Failed to parse sidecar response: ${buffer}`))
        }
      }
    })

    client.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Sidecar connection error: ${err.message}`))
    })
  })
}

/**
 * Send SIGTERM to the sidecar process for graceful shutdown.
 */
export function stopSidecar(): void {
  if (sidecarProcess && !sidecarProcess.killed) {
    sidecarProcess.kill('SIGTERM')
    sidecarProcess = null
  }
}
