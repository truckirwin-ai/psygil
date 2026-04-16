// =============================================================================
// manifest.ts, update manifest fetcher with Ed25519 signature verification
// =============================================================================
//
// Fetches manifest-{channel}.json from the update server, validates its
// schema with Zod, verifies the Ed25519 signature, and returns a typed result.
//
// Returns null on any failure so the updater stays resilient. Never throws.
// =============================================================================

import { z } from 'zod'
import { createVerify } from 'crypto'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const UpdateManifestSchema = z.object({
  version: z.string().regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/,
    'version must be a valid semver string',
  ),
  releaseDate: z.string(),
  releaseNotes: z.string().optional(),
  installerUrl: z.string().url(),
  installerSha256: z.string().regex(/^[0-9a-f]{64}$/, 'installerSha256 must be a 64-char hex string'),
  ed25519Signature: z.string().min(1, 'ed25519Signature is required'),
})

export type UpdateManifest = z.infer<typeof UpdateManifestSchema>

// ---------------------------------------------------------------------------
// Ed25519 public key (placeholder replaced by CI at build time)
// ---------------------------------------------------------------------------
//
// CONTRACT: The .github/workflows/app-release.yml build job runs a sed step
// that replaces "MCow...PLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000="
// with the real Ed25519 public key in PEM format before compiling.
// The private key lives only in GitHub Actions secrets (ED25519_PRIVATE_KEY).

const ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAPLACE_HOLDER_KEY_REPLACE_DURING_CI_BUILD_0000000=
-----END PUBLIC KEY-----`

// ---------------------------------------------------------------------------
// Update server URL
// ---------------------------------------------------------------------------

const UPDATE_SERVER_URL =
  process.env['PSYGIL_UPDATE_URL'] ?? 'https://updates.psygil.com'

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifyManifestSignature(manifest: UpdateManifest): boolean {
  try {
    // The signature covers the installer SHA-256, not the entire manifest JSON.
    // This matches how CI signs: `echo -n $SHA256 | openssl pkeyutl -sign ...`
    const isValid = createVerify('ed25519')
      .update(manifest.installerSha256)
      .verify(ED25519_PUBLIC_KEY, Buffer.from(manifest.ed25519Signature, 'base64'))
    return isValid
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch and validate the update manifest for the given channel.
 * Returns null on any fetch, parse, schema, or signature error.
 * Never throws.
 */
export async function fetchUpdateManifest(
  channel: 'stable' | 'beta',
): Promise<UpdateManifest | null> {
  const url = `${UPDATE_SERVER_URL}/manifest-${channel}.json`
  try {
    const res = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null

    const raw: unknown = await res.json()
    const parsed = UpdateManifestSchema.safeParse(raw)
    if (!parsed.success) {
      process.stderr.write(
        `[updater/manifest] Schema validation failed: ${parsed.error.message}\n`,
      )
      return null
    }

    if (!verifyManifestSignature(parsed.data)) {
      process.stderr.write('[updater/manifest] SECURITY: Ed25519 signature verification FAILED\n')
      return null
    }

    return parsed.data
  } catch (err) {
    process.stderr.write(`[updater/manifest] Fetch failed: ${String(err)}\n`)
    return null
  }
}
