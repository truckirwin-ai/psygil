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
import { existsSync } from 'fs'
import { join } from 'path'
import * as net from 'net'
import { app } from 'electron'

const SOCKET_PATH = '/tmp/psygil-sidecar.sock'
const READY_TIMEOUT_MS = 10_000
const HEALTH_TIMEOUT_MS = 5_000

let sidecarProcess: ChildProcess | null = null

/**
 * Resolve the sidecar root directory.
 *
 * In dev (electron-vite, `pnpm dev`):
 *   __dirname = <repo>/app/out/main
 *   sidecar lives at <repo>/sidecar
 *
 * In a packaged build (electron-builder):
 *   sidecar is copied via extraResources to process.resourcesPath/sidecar
 *   (see electron-builder.yml `extraResources` block)
 */
function resolveSidecarDir(): string {
  // Allow explicit override (used by demo-walkthrough.ts and CI)
  if (process.env.PSYGIL_SIDECAR_DIR && existsSync(process.env.PSYGIL_SIDECAR_DIR)) {
    return process.env.PSYGIL_SIDECAR_DIR
  }
  // Packaged: extraResources path
  if (app.isPackaged) {
    return join(process.resourcesPath, 'sidecar')
  }
  // Dev: walk up from out/main → app/ → repo/ → sidecar/
  return join(__dirname, '..', '..', '..', 'sidecar')
}

/**
 * Resolve the Python interpreter to use for the sidecar.
 *
 * Priority:
 *   1. PSYGIL_PYTHON env var (full path to a venv python)
 *   2. <sidecar>/venv/bin/python (POSIX) or <sidecar>/venv/Scripts/python.exe (Win)
 *   3. system `python3`
 *
 * The bundled venv is created on first launch by scripts/bootstrap-sidecar.sh
 * (POSIX) or scripts/bootstrap-sidecar.ps1 (Windows). End users run that
 * script once after install.
 */
function resolvePythonExecutable(sidecarDir: string): string {
  if (process.env.PSYGIL_PYTHON && existsSync(process.env.PSYGIL_PYTHON)) {
    return process.env.PSYGIL_PYTHON
  }
  const isWin = process.platform === 'win32'
  // Check both `.venv` (created by sidecar/setup-dev-venv.sh) and `venv`
  // (created by scripts/bootstrap-sidecar.sh) so either layout works.
  const venvDirs = ['.venv', 'venv']
  for (const dir of venvDirs) {
    const venvPython = isWin
      ? join(sidecarDir, dir, 'Scripts', 'python.exe')
      : join(sidecarDir, dir, 'bin', 'python')
    if (existsSync(venvPython)) return venvPython
  }
  return isWin ? 'python' : 'python3'
}

/**
 * Locate a PyInstaller-bundled sidecar binary, if one is staged.
 *
 * Search order:
 *   1. PSYGIL_SIDECAR_BIN env var (explicit override)
 *   2. <repo>/app/resources/sidecar/<platform>/psygil-sidecar/psygil-sidecar
 *      (or .exe on Windows), populated by sidecar/build.sh
 *   3. process.resourcesPath/sidecar/<platform>/psygil-sidecar/psygil-sidecar
 *      (electron-builder packaged layout)
 *
 * Returns null if no bundled binary is present. Callers fall back to the
 * Python interpreter + script approach used in development.
 */
function resolveBundledBinary(): string | null {
  const isWin = process.platform === 'win32'
  const platformDir =
    process.platform === 'darwin'
      ? 'darwin'
      : process.platform === 'win32'
        ? 'win32'
        : 'linux'
  const binaryName = isWin ? 'psygil-sidecar.exe' : 'psygil-sidecar'

  const candidates: string[] = []
  if (
    process.env.PSYGIL_SIDECAR_BIN !== undefined &&
    existsSync(process.env.PSYGIL_SIDECAR_BIN)
  ) {
    candidates.push(process.env.PSYGIL_SIDECAR_BIN)
  }

  // Repo-staged path used during development after running sidecar/build.sh
  candidates.push(
    join(
      __dirname,
      '..',
      '..',
      'resources',
      'sidecar',
      platformDir,
      'psygil-sidecar',
      binaryName,
    ),
  )

  // Packaged path (electron-builder extraResources)
  if (app.isPackaged) {
    candidates.push(
      join(
        process.resourcesPath,
        'sidecar',
        platformDir,
        'psygil-sidecar',
        binaryName,
      ),
    )
  }

  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

/**
 * Spawn the Python sidecar and wait for the {"status":"ready","pid":...}
 * message on stdout before resolving.
 */
export function spawnSidecar(): Promise<{ pid: number }> {
  return new Promise((resolve, reject) => {
    // Prefer a PyInstaller-bundled binary when available; fall back to
    // running the Python script via the venv interpreter in development.
    const bundledBinary = resolveBundledBinary()

    let command: string
    let args: readonly string[]
    if (bundledBinary !== null) {
      command = bundledBinary
      args = []
    } else {
      const sidecarDir = resolveSidecarDir()
      const scriptPath = join(sidecarDir, 'server.py')
      if (!existsSync(scriptPath)) {
        reject(new Error(`Sidecar script not found at ${scriptPath}`))
        return
      }
      command = resolvePythonExecutable(sidecarDir)
      args = [scriptPath]
    }

    const child = spawn(command, args as string[], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
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
          // Not JSON yet, keep buffering
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
