import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoutingConfig, Provider, ProviderKeyEntry } from './types.js';
import { log } from './log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Config files sit next to the compiled output (dist/), so go up one level to the package root.
const ROOT = join(__dirname, '..');

const ROUTING_CONFIG_PATH = join(ROOT, 'routing-config.json');
const PROVIDER_KEYS_PATH = join(ROOT, 'provider-keys.json');

const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
};

function loadRoutingConfig(): RoutingConfig {
  if (existsSync(ROUTING_CONFIG_PATH)) {
    try {
      const raw = readFileSync(ROUTING_CONFIG_PATH, 'utf-8');
      return JSON.parse(raw) as RoutingConfig;
    } catch (err) {
      log('warn', 'Failed to parse routing-config.json, using defaults', { err: String(err) });
    }
  }
  return { ...DEFAULT_ROUTING_CONFIG };
}

function loadProviderKeys(): Map<Provider, ProviderKeyEntry> {
  const map = new Map<Provider, ProviderKeyEntry>();

  // Seed from env vars first so file overrides are possible.
  const envPairs: Array<[Provider, string | undefined]> = [
    ['anthropic', process.env['ANTHROPIC_API_KEY']],
    ['openai', process.env['OPENAI_API_KEY']],
    ['google', process.env['GOOGLE_API_KEY']],
  ];
  for (const [provider, key] of envPairs) {
    if (key) {
      map.set(provider, { provider, key, label: 'env', createdAt: new Date().toISOString() });
    }
  }

  if (existsSync(PROVIDER_KEYS_PATH)) {
    try {
      const raw = readFileSync(PROVIDER_KEYS_PATH, 'utf-8');
      const entries = JSON.parse(raw) as ProviderKeyEntry[];
      for (const entry of entries) {
        map.set(entry.provider, entry);
      }
    } catch (err) {
      log('warn', 'Failed to parse provider-keys.json', { err: String(err) });
    }
  }

  return map;
}

// Mutable runtime state.
let routingConfig: RoutingConfig = loadRoutingConfig();
let providerKeys: Map<Provider, ProviderKeyEntry> = loadProviderKeys();

export function getRoutingConfig(): RoutingConfig {
  return routingConfig;
}

export function updateRoutingConfig(update: Partial<RoutingConfig>): RoutingConfig {
  routingConfig = { ...routingConfig, ...update };
  writeFileSync(ROUTING_CONFIG_PATH, JSON.stringify(routingConfig, null, 2), 'utf-8');
  log('info', 'Routing config updated', { config: routingConfig });
  return routingConfig;
}

export function getProviderKey(provider: Provider): string | undefined {
  return providerKeys.get(provider)?.key;
}

export function setProviderKey(entry: ProviderKeyEntry): void {
  providerKeys.set(entry.provider, entry);
  persistProviderKeys();
}

export function removeProviderKey(provider: Provider): boolean {
  const existed = providerKeys.has(provider);
  providerKeys.delete(provider);
  if (existed) persistProviderKeys();
  return existed;
}

export function listProviderKeys(): Array<Omit<ProviderKeyEntry, 'key'> & { lastFourChars: string }> {
  return [...providerKeys.values()].map(({ provider, label, createdAt, key }) => ({
    provider,
    label,
    createdAt,
    lastFourChars: key.slice(-4),
  }));
}

function persistProviderKeys(): void {
  const entries = [...providerKeys.values()];
  writeFileSync(PROVIDER_KEYS_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}
