import type { Tier } from './types.js';

// Format: PSGIL-TTTTT-XXXXX-XXXXX-XXXXX
// The second segment encodes the tier prefix.
const LICENSE_REGEX = /^PSGIL-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})-([A-Z0-9]{5})$/;

const TIER_PREFIXES: Record<string, Tier> = {
  TRIA: 'trial',
  SOLO: 'solo',
  PRAC: 'practice',
  ENTR: 'enterprise',
};

// Configurable blocklist of revoked keys.
let blocklist: Set<string> = new Set();

export function setBlocklist(keys: string[]): void {
  blocklist = new Set(keys);
}

export interface LicenseValidationResult {
  ok: boolean;
  tier: Tier | null;
  error?: string;
}

export function validateLicense(key: string): LicenseValidationResult {
  if (!key || typeof key !== 'string') {
    return { ok: false, tier: null, error: 'Missing license key' };
  }

  const match = LICENSE_REGEX.exec(key.trim().toUpperCase());
  if (!match) {
    return { ok: false, tier: null, error: 'Invalid license key format' };
  }

  if (blocklist.has(key.trim().toUpperCase())) {
    return { ok: false, tier: null, error: 'License key has been revoked' };
  }

  const tierSegment = match[1] as string;
  const prefix = tierSegment.slice(0, 4);
  const tier = TIER_PREFIXES[prefix];

  if (!tier) {
    return { ok: false, tier: null, error: 'Unrecognized license tier' };
  }

  return { ok: true, tier };
}
