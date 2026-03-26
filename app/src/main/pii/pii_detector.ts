/**
 * Psygil PII Detector — TypeScript client for Presidio + spaCy via Python sidecar.
 *
 * Communicates with the Python sidecar (Process 4) over a Unix domain socket
 * using JSON-RPC 2.0. The sidecar runs Presidio AnalyzerEngine with the
 * en_core_web_lg spaCy model and detects all 18 HIPAA Safe Harbor identifiers.
 *
 * This module is used by the IPC handlers (pii:detect, pii:batchDetect) to
 * bridge renderer requests to the Python NLP pipeline.
 */

import * as net from 'net'
import type { PiiEntity } from '../../shared/types'

const SOCKET_PATH = '/tmp/psygil-sidecar.sock'
const REQUEST_TIMEOUT_MS = 30_000

let _rpcId = 0

interface JsonRpcResponse {
  readonly jsonrpc: '2.0'
  readonly id: number
  readonly result?: Record<string, unknown>
  readonly error?: { readonly code: number; readonly message: string }
}

/**
 * Send a JSON-RPC 2.0 request to the Python sidecar and return the result.
 */
function rpcCall(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    const id = ++_rpcId

    const timeout = setTimeout(() => {
      client.destroy()
      reject(new Error(`PII sidecar request timed out: ${method}`))
    }, REQUEST_TIMEOUT_MS)

    client.connect(SOCKET_PATH, () => {
      const request = JSON.stringify({ jsonrpc: '2.0', method, params, id })
      client.write(request + '\n')
    })

    let buffer = ''

    client.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      if (buffer.includes('\n')) {
        clearTimeout(timeout)
        try {
          const resp = JSON.parse(buffer.split('\n')[0]) as JsonRpcResponse
          client.destroy()
          if (resp.error) {
            reject(new Error(`PII sidecar error: ${resp.error.message}`))
          } else {
            resolve((resp.result ?? {}) as Record<string, unknown>)
          }
        } catch {
          client.destroy()
          reject(new Error(`Failed to parse sidecar response: ${buffer}`))
        }
      }
    })

    client.on('error', (err) => {
      clearTimeout(timeout)
      reject(new Error(`PII sidecar connection error: ${err.message}`))
    })
  })
}

/**
 * Detect PII entities in a single text string.
 *
 * Sends the text to the Python sidecar's Presidio analyzer via JSON-RPC
 * and returns an array of detected PII entities with positions and scores.
 */
export async function detect(text: string): Promise<readonly PiiEntity[]> {
  const result = await rpcCall('pii/detect', { text })
  const entities = result.entities as Array<{
    text: string
    start: number
    end: number
    type: string
    score: number
  }>
  return entities.map((e) => ({
    text: e.text,
    start: e.start,
    end: e.end,
    type: e.type,
    score: e.score,
  }))
}

/**
 * Detect PII entities in multiple text strings (batch mode).
 *
 * More efficient than calling detect() in a loop — sends all texts
 * in a single JSON-RPC call to the sidecar.
 */
export async function batchDetect(texts: readonly string[]): Promise<readonly (readonly PiiEntity[])[]> {
  const result = await rpcCall('pii/batch', { texts: [...texts] })
  const results = result.results as Array<
    Array<{ text: string; start: number; end: number; type: string; score: number }>
  >
  return results.map((entities) =>
    entities.map((e) => ({
      text: e.text,
      start: e.start,
      end: e.end,
      type: e.type,
      score: e.score,
    }))
  )
}
