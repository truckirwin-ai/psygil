import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MonthlyUsage, AggregateUsage } from './types.js';
import { log } from './log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const USAGE_DIR = join(ROOT, 'usage-data');

// Cost estimates in USD per 1M tokens (approximate, subject to change).
const COST_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-5': { input: 15.0, output: 75.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-1.5-pro': { input: 3.5, output: 10.5 },
  'gemini-1.5-flash': { input: 0.35, output: 1.05 },
};

function DEFAULT_COST_RATES(): { input: number; output: number } {
  return { input: 3.0, output: 15.0 };
}

// In-memory store: licenseKey -> period -> MonthlyUsage
const store = new Map<string, Map<string, MonthlyUsage>>();

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ensureDir(): void {
  if (!existsSync(USAGE_DIR)) {
    mkdirSync(USAGE_DIR, { recursive: true });
  }
}

function usageFilePath(period: string): string {
  return join(USAGE_DIR, `${period}.json`);
}

function loadPeriod(period: string): void {
  const path = usageFilePath(period);
  if (!existsSync(path)) return;
  try {
    const raw = readFileSync(path, 'utf-8');
    const entries = JSON.parse(raw) as MonthlyUsage[];
    for (const entry of entries) {
      let byPeriod = store.get(entry.licenseKey);
      if (!byPeriod) {
        byPeriod = new Map();
        store.set(entry.licenseKey, byPeriod);
      }
      byPeriod.set(period, entry);
    }
  } catch (err) {
    log('warn', 'Failed to load usage data', { period, err: String(err) });
  }
}

// Load current month on startup.
loadPeriod(currentPeriod());

export function recordUsage(
  licenseKey: string,
  inputTokens: number,
  outputTokens: number,
  model: string,
  provider: string,
): void {
  const period = currentPeriod();
  let byPeriod = store.get(licenseKey);
  if (!byPeriod) {
    byPeriod = new Map();
    store.set(licenseKey, byPeriod);
  }

  let entry = byPeriod.get(period);
  if (!entry) {
    entry = { licenseKey, period, requests: 0, inputTokens: 0, outputTokens: 0, models: {}, providers: {} };
    byPeriod.set(period, entry);
  }

  entry.requests += 1;
  entry.inputTokens += inputTokens;
  entry.outputTokens += outputTokens;
  entry.models[model] = (entry.models[model] ?? 0) + 1;
  entry.providers[provider] = (entry.providers[provider] ?? 0) + 1;
}

export function getUsage(licenseKey: string, period?: string): MonthlyUsage {
  const p = period ?? currentPeriod();
  const entry = store.get(licenseKey)?.get(p);
  if (entry) return entry;
  return { licenseKey, period: p, requests: 0, inputTokens: 0, outputTokens: 0, models: {}, providers: {} };
}

export function estimateCostUsd(inputTokens: number, outputTokens: number, model: string): number {
  const rates = COST_PER_1M_TOKENS[model] ?? DEFAULT_COST_RATES();
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

export function getAllUsage(period?: string): AggregateUsage {
  const p = period ?? currentPeriod();
  const result: AggregateUsage = {
    period: p,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    byLicense: {},
    byModel: {},
    byProvider: {},
    estimatedCostUsd: 0,
  };

  for (const [licenseKey, byPeriod] of store) {
    const entry = byPeriod.get(p);
    if (!entry) continue;
    result.byLicense[licenseKey] = entry;
    result.totalRequests += entry.requests;
    result.totalInputTokens += entry.inputTokens;
    result.totalOutputTokens += entry.outputTokens;
    for (const [model, count] of Object.entries(entry.models)) {
      result.byModel[model] = (result.byModel[model] ?? 0) + count;
    }
    for (const [provider, count] of Object.entries(entry.providers)) {
      result.byProvider[provider] = (result.byProvider[provider] ?? 0) + count;
    }
  }

  result.estimatedCostUsd = estimateCostUsd(result.totalInputTokens, result.totalOutputTokens, 'claude-sonnet-4-20250514');
  return result;
}

export function flushUsageToDisk(): void {
  ensureDir();
  const period = currentPeriod();
  const entries: MonthlyUsage[] = [];
  for (const byPeriod of store.values()) {
    const entry = byPeriod.get(period);
    if (entry) entries.push(entry);
  }
  try {
    writeFileSync(usageFilePath(period), JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    log('error', 'Failed to flush usage data to disk', { err: String(err) });
  }
}

// Flush every 5 minutes.
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
setInterval(flushUsageToDisk, FLUSH_INTERVAL_MS).unref();
