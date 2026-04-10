/**
 * Psygil Transcription Engine, Live Streaming + Batch
 *
 * Live streaming architecture (like Zoom):
 *   1. Renderer: MediaRecorder captures 250ms WebM/Opus chunks
 *   2. Renderer → Main: IPC sends base64 audio chunks
 *   3. Main → Sidecar: Persistent socket streams chunks to Python
 *   4. Sidecar: FFmpeg decode → PCM buffer → faster-whisper every ~3s
 *   5. Sidecar → Main → Renderer: Partial transcripts stream back
 *
 * Also supports batch transcription of complete audio files.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'
import { getCaseById } from '../cases'
import * as net from 'net'

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------

const TRANSCRIBE_SOCKET = '/tmp/psygil-transcribe.sock'

function getWhisperDir(): string {
  return join(app.getPath('userData'), 'whisper')
}

function getWhisperBinary(): string {
  return join(getWhisperDir(), 'main')
}

function getWhisperModel(): string {
  return join(getWhisperDir(), 'ggml-base.en.bin')
}

function isWhisperCppAvailable(): boolean {
  return existsSync(getWhisperBinary()) && existsSync(getWhisperModel())
}

// ---------------------------------------------------------------------------
// Sidecar lifecycle
// ---------------------------------------------------------------------------

let transcribeSidecar: ChildProcess | null = null
let sidecarReady = false

function getSidecarScriptPath(): string {
  const devPath = join(__dirname, '..', '..', '..', '..', 'sidecar', 'transcribe.py')
  if (existsSync(devPath)) return devPath
  return join(app.getAppPath(), '..', 'sidecar', 'transcribe.py')
}

export function spawnTranscribeSidecar(): Promise<{ pid: number }> {
  return new Promise((resolve, reject) => {
    const scriptPath = getSidecarScriptPath()
    if (!existsSync(scriptPath)) {
      reject(new Error(`Transcription sidecar not found: ${scriptPath}`))
      return
    }

    const child = spawn('python3', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    transcribeSidecar = child

    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Transcription sidecar startup timed out'))
    }, 30_000)

    let stdoutBuffer = ''

    child.stdout!.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split('\n')
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line) as { status: string; pid: number; service?: string }
          if (msg.status === 'ready' && msg.service === 'transcription') {
            clearTimeout(timeout)
            sidecarReady = true
            console.log(`[Transcribe] Sidecar ready, PID ${msg.pid}`)
            resolve({ pid: msg.pid })
            return
          }
        } catch { /* keep buffering */ }
      }
    })

    child.stderr!.on('data', (chunk: Buffer) => {
      console.log(`[Transcribe/sidecar] ${chunk.toString().trim()}`)
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      transcribeSidecar = null
      sidecarReady = false
      reject(new Error(`Failed to spawn transcription sidecar: ${err.message}`))
    })

    child.on('exit', (code, sig) => {
      clearTimeout(timeout)
      transcribeSidecar = null
      sidecarReady = false
      console.log(`[Transcribe] Sidecar exited: code=${code}, signal=${sig}`)
    })
  })
}

export function stopTranscribeSidecar(): void {
  if (transcribeSidecar && !transcribeSidecar.killed) {
    transcribeSidecar.kill('SIGTERM')
    transcribeSidecar = null
    sidecarReady = false
  }
}

// ---------------------------------------------------------------------------
// Live streaming session management
// ---------------------------------------------------------------------------

interface LiveStreamSession {
  sessionId: string
  socket: net.Socket
  win: BrowserWindow
}

const liveStreams = new Map<string, LiveStreamSession>()

/**
 * Start a live streaming transcription session.
 * Opens a persistent socket to the sidecar and relays partial transcripts back.
 */
function startLiveStream(sessionId: string, win: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    if (!sidecarReady) {
      resolve(false)
      return
    }

    const socket = new net.Socket()

    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 10_000)

    socket.connect(TRANSCRIBE_SOCKET, () => {
      clearTimeout(timeout)

      // Send stream/start command
      const startCmd = JSON.stringify({
        jsonrpc: '2.0',
        method: 'stream/start',
        params: { session_id: sessionId },
        id: 1,
      })
      socket.write(startCmd + '\n')

      liveStreams.set(sessionId, { sessionId, socket, win })
      console.log(`[Transcribe] Live stream started: ${sessionId}`)
      resolve(true)
    })

    // Handle incoming data from sidecar (partial transcripts)
    let buffer = ''
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const resp = JSON.parse(line) as {
            result?: {
              type: string
              text?: string
              session_id?: string
              started?: boolean
              stopped?: boolean
              error?: string
            }
            error?: { message: string }
          }

          if (resp.error) {
            console.error(`[Transcribe] Sidecar error: ${resp.error.message}`)
            continue
          }

          const r = resp.result
          if (!r) continue

          // Skip the start/stop acknowledgments
          if (r.started || r.stopped) continue

          if (r.type === 'partial' && r.text) {
            // Send partial transcript to renderer
            win.webContents.send('whisper:liveText', {
              sessionId: r.session_id ?? sessionId,
              text: r.text,
              type: 'partial',
            })
          } else if (r.type === 'final' && r.text !== undefined) {
            win.webContents.send('whisper:liveText', {
              sessionId: r.session_id ?? sessionId,
              text: r.text,
              type: 'final',
            })
          } else if (r.type === 'error') {
            win.webContents.send('whisper:liveText', {
              sessionId: r.session_id ?? sessionId,
              text: `[Transcription error: ${r.error}]`,
              type: 'error',
            })
          }
        } catch { /* partial JSON */ }
      }
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      console.error(`[Transcribe] Stream socket error: ${err.message}`)
      liveStreams.delete(sessionId)
      resolve(false)
    })

    socket.on('close', () => {
      liveStreams.delete(sessionId)
    })
  })
}

/**
 * Send an audio chunk to the live stream.
 */
function sendAudioChunk(sessionId: string, audioBase64: string): void {
  const stream = liveStreams.get(sessionId)
  if (!stream) return

  // Use the JSON method for reliability
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    method: 'stream/audio',
    params: { session_id: sessionId, audio: audioBase64 },
  })
  stream.socket.write(msg + '\n')
}

/**
 * Stop a live streaming session.
 */
function stopLiveStream(sessionId: string): void {
  const stream = liveStreams.get(sessionId)
  if (!stream) return

  const stopCmd = JSON.stringify({
    jsonrpc: '2.0',
    method: 'stream/stop',
    params: { session_id: sessionId },
    id: 2,
  })
  stream.socket.write(stopCmd + '\n')

  // Socket will close after the final transcript is sent
  setTimeout(() => {
    if (liveStreams.has(sessionId)) {
      stream.socket.destroy()
      liveStreams.delete(sessionId)
    }
  }, 10_000)
}

// ---------------------------------------------------------------------------
// Sidecar RPC helper (for batch transcription)
// ---------------------------------------------------------------------------

function sidecarRpc(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!sidecarReady) {
      reject(new Error('Transcription sidecar not ready'))
      return
    }

    const client = new net.Socket()
    const timeout = setTimeout(() => {
      client.destroy()
      reject(new Error('Sidecar RPC timed out'))
    }, 300_000)

    client.connect(TRANSCRIBE_SOCKET, () => {
      const request = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
      client.write(request + '\n')
    })

    let buffer = ''
    client.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      if (buffer.includes('\n')) {
        clearTimeout(timeout)
        try {
          const resp = JSON.parse(buffer.split('\n')[0]) as {
            result?: unknown
            error?: { code: number; message: string }
          }
          client.destroy()
          if (resp.error) reject(new Error(resp.error.message))
          else resolve(resp.result)
        } catch {
          client.destroy()
          reject(new Error('Failed to parse sidecar response'))
        }
      }
    })

    client.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`Sidecar connection error: ${err.message}`))
    })
  })
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

interface IpcOk<T> { status: 'success'; data: T }
interface IpcFail { status: 'error'; error: string; code?: string }
type IpcResponse<T> = IpcOk<T> | IpcFail

function ok<T>(data: T): IpcOk<T> { return { status: 'success', data } }
function fail(code: string, error: string): IpcFail { return { status: 'error', error, code } }

// ---------------------------------------------------------------------------
// IPC: Save audio
// ---------------------------------------------------------------------------

function handleSaveAudio(
  _event: Electron.IpcMainInvokeEvent,
  args: { caseId: number; audioBase64: string; filename: string; mimeType: string },
): IpcResponse<{ filePath: string; sizeBytes: number }> {
  try {
    const caseRow = getCaseById(args.caseId)
    if (!caseRow) return fail('NOT_FOUND', `Case ${args.caseId} not found`)
    if (!caseRow.folder_path) return fail('NO_FOLDER', `Case ${args.caseId} has no workspace folder`)

    const interviewDir = join(caseRow.folder_path, 'Interviews')
    if (!existsSync(interviewDir)) mkdirSync(interviewDir, { recursive: true })

    const destPath = join(interviewDir, args.filename)
    const buffer = Buffer.from(args.audioBase64, 'base64')
    writeFileSync(destPath, buffer)

    const stat = statSync(destPath)
    console.log(`[Whisper] Saved audio: ${destPath} (${(stat.size / 1024).toFixed(1)} KB)`)
    return ok({ filePath: destPath, sizeBytes: stat.size })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save audio'
    console.error('[Whisper] saveAudio error:', msg)
    return fail('SAVE_ERROR', msg)
  }
}

// ---------------------------------------------------------------------------
// IPC: Batch transcribe
// ---------------------------------------------------------------------------

async function handleTranscribe(
  _event: Electron.IpcMainInvokeEvent,
  args: { filePath: string; language?: string },
): Promise<IpcResponse<{ text: string; segments: readonly { start: number; end: number; text: string }[]; duration: number }>> {
  const lang = args.language ?? 'en'

  if (!existsSync(args.filePath)) {
    return fail('FILE_NOT_FOUND', `Audio file not found: ${args.filePath}`)
  }

  // Try faster-whisper sidecar
  if (sidecarReady) {
    try {
      const result = await sidecarRpc('transcription/transcribe', {
        file_path: args.filePath,
        language: lang,
      }) as { text: string; segments: { start: number; end: number; text: string }[]; duration_sec: number; error?: string }

      if (!result.error) {
        return ok({ text: result.text, segments: result.segments, duration: result.duration_sec })
      }
    } catch (err) {
      console.warn(`[Transcribe] Sidecar batch failed: ${err}`)
    }
  }

  // Fallback: whisper.cpp
  if (!isWhisperCppAvailable()) {
    return fail('NOT_AVAILABLE', 'No transcription engine available.')
  }

  return new Promise((resolve) => {
    const binary = getWhisperBinary()
    const model = getWhisperModel()
    const cliArgs = ['-m', model, '-f', args.filePath, '-l', lang, '--output-txt', '--no-timestamps', '--print-progress', 'false']
    const startTime = Date.now()

    execFile(binary, cliArgs, { timeout: 300_000 }, (error, stdout, stderr) => {
      const elapsed = (Date.now() - startTime) / 1000
      if (error) {
        resolve(fail('TRANSCRIBE_ERROR', `Whisper.cpp error: ${stderr || error.message}`))
        return
      }
      const text = stdout.trim()
      const lines = text.split('\n').filter((l: string) => l.trim())
      const segments = lines.map((line: string, i: number) => ({ start: i * 5, end: (i + 1) * 5, text: line.trim() }))
      resolve(ok({ text, segments, duration: elapsed }))
    })
  })
}

// ---------------------------------------------------------------------------
// IPC: Live streaming
// ---------------------------------------------------------------------------

async function handleStreamStart(
  event: Electron.IpcMainInvokeEvent,
  args: { sessionId: string },
): Promise<IpcResponse<{ started: boolean }>> {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return fail('NO_WINDOW', 'Could not find browser window')

  if (!sidecarReady) {
    return fail('NOT_AVAILABLE', 'Transcription sidecar not running')
  }

  const started = await startLiveStream(args.sessionId, win)
  if (!started) {
    return fail('STREAM_FAILED', 'Failed to start live stream')
  }

  return ok({ started: true })
}

function handleStreamAudio(
  _event: Electron.IpcMainInvokeEvent,
  args: { sessionId: string; audioBase64: string },
): void {
  sendAudioChunk(args.sessionId, args.audioBase64)
}

function handleStreamStop(
  _event: Electron.IpcMainInvokeEvent,
  args: { sessionId: string },
): IpcResponse<{ stopped: boolean }> {
  stopLiveStream(args.sessionId)
  return ok({ stopped: true })
}

// ---------------------------------------------------------------------------
// IPC: Status
// ---------------------------------------------------------------------------

function handleStatus(): IpcResponse<{
  available: boolean;
  model: string | null;
  version: string | null;
  sidecarReady: boolean;
}> {
  const whisperCpp = isWhisperCppAvailable()
  return ok({
    available: sidecarReady || whisperCpp,
    model: sidecarReady ? 'faster-whisper base.en' : (whisperCpp ? basename(getWhisperModel()) : null),
    version: sidecarReady ? 'faster-whisper' : (whisperCpp ? 'whisper.cpp' : null),
    sidecarReady,
  })
}

// ---------------------------------------------------------------------------
// Register all handlers
// ---------------------------------------------------------------------------

export function registerWhisperHandlers(): void {
  ipcMain.handle('whisper:saveAudio', handleSaveAudio)
  ipcMain.handle('whisper:transcribe', handleTranscribe)
  ipcMain.handle('whisper:status', handleStatus)

  // Live streaming
  ipcMain.handle('whisper:stream:start', handleStreamStart)
  ipcMain.on('whisper:stream:audio', (_event, args) => handleStreamAudio(_event as any, args))
  ipcMain.handle('whisper:stream:stop', handleStreamStop)

  console.log('[Whisper] IPC handlers registered (batch + live streaming)')

  // Start sidecar
  spawnTranscribeSidecar().catch((err) => {
    console.log(`[Whisper] Sidecar not available: ${err.message}`)
  })
}
