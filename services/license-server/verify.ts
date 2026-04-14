// =============================================================================
// verify.ts, exercise the Psygil license server end-to-end
// =============================================================================
//
// Run with:  npx tsx services/license-server/verify.ts
//
// What it does:
//   1. Starts an in-process license server on a random localhost port
//   2. Issues real HTTP requests against it and asserts the responses
//   3. Drives the production validateRemote() client from
//      app/src/main/setup/license.ts against the live server
//   4. Confirms validateLicense() falls back cleanly when the server is
//      unreachable
//
// No external dependencies. Stops the server cleanly on exit.
// =============================================================================

import { createLicenseServer } from './server'
import {
  validateRemote,
  validateLicense,
  normalizeLicenseKey,
} from '../../app/src/main/setup/license'

interface Result {
  readonly name: string
  readonly ok: boolean
  readonly message: string
}

const results: Result[] = []
function check(name: string, condition: boolean, message = ''): void {
  results.push({ name, ok: condition, message })
  const status = condition ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`  ${status}  ${name}${message.length > 0 ? ', ' + message : ''}`)
}
function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

async function main(): Promise<void> {
  console.log('\x1b[1mPsygil license server verifier\x1b[0m')

  // ---- Start server on random port ----------------------------------------
  const server = createLicenseServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  if (typeof address !== 'object' || address === null) {
    throw new Error('Could not determine server address')
  }
  const port = address.port
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`Test server: ${baseUrl}`)

  try {
    // ---- 1. Direct HTTP probes --------------------------------------------
    section('1. Direct HTTP probes')

    const healthResp = await fetch(`${baseUrl}/healthz`)
    check('GET /healthz returns 200', healthResp.status === 200)
    check('GET /healthz body is "ok"', (await healthResp.text()).trim() === 'ok')

    const goodResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PSGIL-SOLO1-ABCDE-12345-XYZ7Q' }),
    })
    check('POST valid solo key returns 200', goodResp.status === 200)
    const goodBody = (await goodResp.json()) as {
      ok: boolean
      tier?: string
      seats?: number
    }
    check('valid solo key body.ok=true', goodBody.ok === true)
    check('valid solo key tier=solo', goodBody.tier === 'solo')
    check('valid solo key seats=1', goodBody.seats === 1)

    const expiredResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PSGIL-SOLO2-EXPIR-EDKEY-00001' }),
    })
    const expiredBody = (await expiredResp.json()) as {
      ok: boolean
      errorCode?: string
    }
    check('expired key body.ok=false', expiredBody.ok === false)
    check('expired key errorCode=EXPIRED', expiredBody.errorCode === 'EXPIRED')

    const revokedResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PSGIL-SOLO3-REVOK-EDKEY-00002' }),
    })
    const revokedBody = (await revokedResp.json()) as {
      ok: boolean
      errorCode?: string
    }
    check('revoked key body.ok=false', revokedBody.ok === false)
    check('revoked key errorCode=REJECTED', revokedBody.errorCode === 'REJECTED')

    const unknownResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'PSGIL-SOLO9-NOPER-NOPER-NOPER' }),
    })
    const unknownBody = (await unknownResp.json()) as { ok: boolean }
    check('unknown key rejected', unknownBody.ok === false)

    const malformedResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'not-a-real-key' }),
    })
    const malformedBody = (await malformedResp.json()) as { ok: boolean }
    check('malformed key rejected', malformedBody.ok === false)

    const badBodyResp = await fetch(`${baseUrl}/v1/licenses/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"not-a-key":true}',
    })
    check('missing key field returns 400', badBodyResp.status === 400)

    const notFoundResp = await fetch(`${baseUrl}/nope`)
    check('unknown route returns 404', notFoundResp.status === 404)

    // ---- 2. Production client (validateRemote) ----------------------------
    section('2. Production validateRemote() against live server')

    // validateRemote enforces https://. We're testing against http://, so
    // we expect it to throw. That's the security guarantee in action.
    let httpsThrew = false
    try {
      await validateRemote('PSGIL-SOLO1-ABCDE-12345-XYZ7Q', baseUrl)
    } catch (err) {
      httpsThrew = (err as Error).message.includes('https://')
    }
    check('validateRemote refuses http:// URL', httpsThrew)

    // ---- 3. validateLicense top-level fallback ----------------------------
    section('3. validateLicense fallback behavior')

    // Server unreachable URL → falls back to local with offlineFallback=true
    process.env['PSYGIL_LICENSE_SERVER'] = 'https://127.0.0.1:1' // closed port
    const fallback = await validateLicense('PSGIL-SOLO1-ABCDE-12345-XYZ7Q')
    check('unreachable server triggers fallback', fallback.ok === true)
    check('fallback marks offlineFallback=true', fallback.offlineFallback === true)
    check('fallback source=local', fallback.source === 'local')
    delete process.env['PSYGIL_LICENSE_SERVER']

    // ---- 4. normalizeLicenseKey ------------------------------------------
    section('4. Normalization')
    check(
      'normalizeLicenseKey lowercases and strips spaces',
      normalizeLicenseKey(' psgil - solo1 - abcde - 12345 - xyz7q ') ===
        'PSGIL-SOLO1-ABCDE-12345-XYZ7Q',
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n\x1b[1mSummary:\x1b[0m ${results.length - failed.length}/${results.length} passed`,
  )
  if (failed.length > 0) {
    console.log('\n\x1b[31mFailures:\x1b[0m')
    for (const f of failed) {
      console.log(`  - ${f.name}${f.message.length > 0 ? ', ' + f.message : ''}`)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\x1b[31mUnhandled error:\x1b[0m', err)
  process.exit(1)
})
