import type { Tier } from './types.js';

// Daily request limits per tier.
const DAILY_LIMITS: Record<Tier, number | null> = {
  trial: 10,
  solo: 50,
  practice: 200,
  enterprise: null, // unlimited
};

// Monthly evaluation caps per tier (null = no cap).
const MONTHLY_CAPS: Record<Tier, number | null> = {
  trial: null,
  solo: 30,
  practice: 80,
  enterprise: null,
};

interface DailyBucket {
  count: number;
  resetAt: number; // Unix ms timestamp
}

interface MonthlyBucket {
  count: number;
  period: string; // YYYY-MM
}

const dailyBuckets = new Map<string, DailyBucket>();
const monthlyBuckets = new Map<string, MonthlyBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  statusCode?: 429 | 402;
  retryAfterSeconds?: number;
}

function todayResetMs(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function checkRateLimit(key: string, tier: Tier): RateLimitResult {
  const now = Date.now();

  // --- Daily check ---
  const dailyLimit = DAILY_LIMITS[tier];
  if (dailyLimit !== null) {
    let bucket = dailyBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: todayResetMs() };
    }
    if (bucket.count >= dailyLimit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        statusCode: 429,
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
      };
    }
  }

  // --- Monthly cap check ---
  const monthlyCap = MONTHLY_CAPS[tier];
  const period = currentPeriod();
  if (monthlyCap !== null) {
    let mbucket = monthlyBuckets.get(key);
    if (!mbucket || mbucket.period !== period) {
      mbucket = { count: 0, period };
    }
    if (mbucket.count >= monthlyCap) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: 0,
        statusCode: 402,
      };
    }
  }

  // Compute remaining for the daily window.
  const bucket = dailyBuckets.get(key);
  const usedToday = !bucket || now >= bucket.resetAt ? 0 : bucket.count;
  const remaining = dailyLimit !== null ? Math.max(0, dailyLimit - usedToday - 1) : Infinity;

  return {
    allowed: true,
    remaining: isFinite(remaining) ? remaining : 999999,
    resetAt: bucket?.resetAt ?? todayResetMs(),
  };
}

export function incrementUsage(key: string, tier: Tier): void {
  const now = Date.now();
  const period = currentPeriod();

  // Daily bucket.
  let bucket = dailyBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: todayResetMs() };
  }
  bucket.count += 1;
  dailyBuckets.set(key, bucket);

  // Monthly bucket.
  const monthlyCap = MONTHLY_CAPS[tier];
  if (monthlyCap !== null) {
    let mbucket = monthlyBuckets.get(key);
    if (!mbucket || mbucket.period !== period) {
      mbucket = { count: 0, period };
    }
    mbucket.count += 1;
    monthlyBuckets.set(key, mbucket);
  }
}
