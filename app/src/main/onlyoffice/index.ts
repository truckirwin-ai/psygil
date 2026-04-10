/**
 * OnlyOffice Document Server Lifecycle Manager
 *
 * Manages OnlyOffice Document Server running as a Docker container on localhost:9980.
 * Provides startup, shutdown, health checks, and JWT token generation for secure API calls.
 *
 * Container: psygil-onlyoffice
 * Image: onlyoffice/documentserver:latest
 * Port: 9980 (container 80 → host 9980)
 * JWT: HMAC-SHA256, stored securely via safeStorage
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { createHmac } from 'crypto'
import type { SafeStorage } from 'electron'

const execFileAsync = promisify(execFile)

const CONTAINER_NAME = 'psygil-onlyoffice'
const IMAGE = 'onlyoffice/documentserver:latest'
const PORT = 9980
const HEALTH_CHECK_INTERVAL_MS = 2000
const HEALTH_CHECK_TIMEOUT_MS = 120000
const JWT_SECRET_KEY = 'psygil-oo-jwt-secret'

let safeStorageInstance: SafeStorage | null = null

/**
 * Initialize safe storage for secure secret storage.
 * Call this from the main process after the app is ready.
 */
export function initializeSafeStorage(electronSafeStorage: SafeStorage): void {
  safeStorageInstance = electronSafeStorage
}

/**
 * Store JWT secret securely using Electron's safeStorage.
 */
function storeSecret(secret: string): void {
  if (!safeStorageInstance) {
    throw new Error('SafeStorage not initialized. Call initializeSafeStorage() first.')
  }
  safeStorageInstance.setItemSync(JWT_SECRET_KEY, secret)
}

/**
 * Retrieve JWT secret from secure storage.
 */
function getSecret(): string | null {
  if (!safeStorageInstance) {
    return null
  }
  try {
    return safeStorageInstance.getItemSync(JWT_SECRET_KEY)
  } catch {
    return null
  }
}

/**
 * Check if Docker is available on the system.
 */
async function isDockerAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('docker', ['--version'])
    return stdout.includes('Docker')
  } catch {
    return false
  }
}

/**
 * Check if the OnlyOffice container is running.
 */
async function isContainerRunning(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('docker', ['ps', '--filter', `name=${CONTAINER_NAME}`, '--format', '{{.Names}}'])
    return stdout.trim() === CONTAINER_NAME
  } catch {
    return false
  }
}

/**
 * Wait for the health endpoint to return 200.
 */
async function waitForHealthCheck(): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
    try {
      // Use Node's built-in fetch (available in Node 18+)
      const response = await fetch(`http://localhost:${PORT}/healthcheck`)
      if (response.ok) {
        return
      }
    } catch {
      // Endpoint not ready yet, continue polling
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS))
  }
  throw new Error(`OnlyOffice health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`)
}

/**
 * Start the OnlyOffice Document Server container.
 * If already running, just verifies health.
 * If not running, pulls/starts the container and waits for health.
 *
 * @returns {port, jwtSecret}
 */
export async function startDocumentServer(): Promise<{ port: number; jwtSecret: string }> {
  // Check Docker availability
  const dockerAvailable = await isDockerAvailable()
  if (!dockerAvailable) {
    throw new Error('Docker is not installed or not available on this system. Please install Docker to use OnlyOffice.')
  }

  // Check if already running
  const running = await isContainerRunning()
  if (running) {
    // Verify health
    try {
      await waitForHealthCheck()
      // Get or generate secret
      let secret = getSecret()
      if (!secret) {
        secret = generateJwtSecret()
        storeSecret(secret)
      }
      return { port: PORT, jwtSecret: secret }
    } catch (err) {
      console.error('[onlyoffice] Health check failed for running container:', err)
      throw new Error('OnlyOffice container is running but not responding. Check Docker logs.')
    }
  }

  // Container not running, pull image and start
  try {
    await execFileAsync('docker', ['pull', IMAGE])

    // Create volume for fonts if not exists
    try {
      await execFileAsync('docker', ['volume', 'create', 'psygil-oo-fonts'])
    } catch {
      // Volume might already exist
    }

    // Start the container
    await execFileAsync('docker', [
      'run',
      '-d',
      `--name=${CONTAINER_NAME}`,
      `-p=${PORT}:80`,
      '-v=psygil-oo-fonts:/usr/share/fonts/custom',
      `-e=JWT_ENABLED=true`,
      `-e=JWT_SECRET=${generateJwtSecret()}`,
      `-e=WOPI_ENABLED=false`,
      IMAGE,
    ])

    // Wait for health
    await waitForHealthCheck()

    // Generate and store JWT secret
    const secret = generateJwtSecret()
    storeSecret(secret)

    return { port: PORT, jwtSecret: secret }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to start OnlyOffice container: ${message}`)
  }
}

/**
 * Stop the OnlyOffice container.
 */
export async function stopDocumentServer(): Promise<void> {
  try {
    const running = await isContainerRunning()
    if (!running) {
      return
    }

    await execFileAsync('docker', ['stop', CONTAINER_NAME])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to stop OnlyOffice container: ${message}`)
  }
}

/**
 * Get the current status of the Document Server.
 */
export async function getDocumentServerStatus(): Promise<{
  running: boolean
  port: number | null
  healthy: boolean
}> {
  try {
    const running = await isContainerRunning()
    if (!running) {
      return { running: false, port: null, healthy: false }
    }

    // Check health
    let healthy = false
    try {
      const response = await fetch(`http://localhost:${PORT}/healthcheck`)
      healthy = response.ok
    } catch {
      healthy = false
    }

    return { running: true, port: PORT, healthy }
  } catch {
    return { running: false, port: null, healthy: false }
  }
}

/**
 * Get the OnlyOffice server URL.
 */
export async function getDocumentServerUrl(): Promise<string | null> {
  const status = await getDocumentServerStatus()
  if (status.running && status.healthy) {
    return `http://localhost:${PORT}`
  }
  return null
}

/**
 * Generate a cryptographically secure JWT secret.
 */
function generateJwtSecret(): string {
  const crypto = require('crypto') as typeof import('crypto')
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate a JWT token for OnlyOffice API calls.
 *
 * JWT format: base64url(header).base64url(payload).signature
 * Uses HMAC-SHA256 with the stored secret.
 *
 * @param payload - The payload to sign (e.g., { "document": {...} })
 * @returns JWT token string
 */
export function generateJwtToken(payload: Record<string, unknown>): string {
  const secret = getSecret()
  if (!secret) {
    throw new Error('JWT secret not configured. Start the Document Server first.')
  }

  // Header
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerEncoded = base64urlEncode(JSON.stringify(header))

  // Payload
  const payloadEncoded = base64urlEncode(JSON.stringify(payload))

  // Signature
  const signatureInput = `${headerEncoded}.${payloadEncoded}`
  const signature = createHmac('sha256', secret).update(signatureInput).digest('base64')
  const signatureEncoded = base64urlEncode(signature)

  return `${signatureInput}.${signatureEncoded}`
}

/**
 * Base64URL encode without padding.
 */
function base64urlEncode(str: string | Buffer): string {
  let input: string
  if (typeof str === 'string') {
    input = Buffer.from(str).toString('base64')
  } else {
    input = str.toString('base64')
  }
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Get the secure editor configuration for OnlyOffice.
 * Disables macros, plugins, and other potentially dangerous features.
 */
export function getSecureEditorConfig(): Record<string, unknown> {
  return {
    customization: {
      macros: false,
      macrosMode: 'disable',
      plugins: false,
    },
    permissions: {
      fillForms: false,
      modifyContentControl: false,
      modifyFilter: false,
    },
  }
}
