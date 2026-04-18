import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { log } from './log.js';
import { validateLicense } from './license.js';
import { checkRateLimit, incrementUsage } from './rate-limiter.js';
import { recordUsage, getUsage, getAllUsage, estimateCostUsd, flushUsageToDisk } from './usage.js';
import { dispatchRequest, resolveProviderAndModel } from './router.js';
import {
  updateRoutingConfig,
  setProviderKey,
  removeProviderKey,
  listProviderKeys,
} from './config.js';
import type { Tier, Provider, RoutingConfig, ProviderKeyEntry, ProxyRequest } from './types.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);
const ADMIN_API_KEY = process.env['ADMIN_API_KEY'] ?? '';
const VERSION = '1.0.0';
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const startTime = Date.now();

// In-flight request tracking for realtime stats.
let activeRequests = 0;
const recentRequests: Array<{ ts: number; inputTokens: number; outputTokens: number }> = [];

function uptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

// ---------- HTTP helpers ----------

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function sendError(res: ServerResponse, statusCode: number, message: string, extra?: Record<string, unknown>): void {
  sendJson(res, statusCode, { ok: false, error: message, ...extra });
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJson(buf: Buffer): unknown {
  try {
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    return null;
  }
}

// ---------- Auth helpers ----------

function getLicenseKey(req: IncomingMessage): string | null {
  const header = req.headers['x-psygil-license'];
  if (typeof header === 'string' && header.length > 0) return header;
  return null;
}

function verifyAdminKey(req: IncomingMessage): boolean {
  const header = req.headers['x-admin-key'];
  if (typeof header !== 'string' || !ADMIN_API_KEY) return false;
  try {
    const a = Buffer.from(createHash('sha256').update(header).digest('hex'));
    const b = Buffer.from(createHash('sha256').update(ADMIN_API_KEY).digest('hex'));
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------- Route handlers ----------

async function handleComplete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const licenseKey = getLicenseKey(req);
  if (!licenseKey) {
    sendError(res, 401, 'Missing X-Psygil-License header');
    return;
  }

  const validation = validateLicense(licenseKey);
  if (!validation.ok || !validation.tier) {
    sendError(res, 403, validation.error ?? 'Invalid license');
    return;
  }

  const tier: Tier = validation.tier;
  const rateCheck = checkRateLimit(licenseKey, tier);

  if (!rateCheck.allowed) {
    if (rateCheck.statusCode === 402) {
      sendError(res, 402, 'Monthly evaluation cap exceeded');
    } else {
      sendError(res, 429, 'Rate limit exceeded', {
        retryAfter: rateCheck.retryAfterSeconds,
        resetAt: new Date(rateCheck.resetAt).toISOString(),
      });
    }
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch (err) {
    sendError(res, 413, 'Request body too large');
    return;
  }

  const parsed = parseJson(body);
  if (!parsed || typeof parsed !== 'object') {
    sendError(res, 400, 'Invalid JSON body');
    return;
  }

  const input = parsed as Record<string, unknown>;
  if (!Array.isArray(input['messages'])) {
    sendError(res, 400, 'messages array is required');
    return;
  }

  const proxyRequest: ProxyRequest = {
    messages: input['messages'] as ProxyRequest['messages'],
    system: typeof input['system'] === 'string' ? input['system'] : undefined,
    model: typeof input['model'] === 'string' ? input['model'] : undefined,
    maxTokens: typeof input['maxTokens'] === 'number' ? input['maxTokens'] : undefined,
    temperature: typeof input['temperature'] === 'number' ? input['temperature'] : undefined,
  };

  activeRequests += 1;
  const reqStart = Date.now();

  try {
    const result = await dispatchRequest(tier, proxyRequest);
    const elapsed = Date.now() - reqStart;

    incrementUsage(licenseKey, tier);
    recordUsage(licenseKey, result.inputTokens, result.outputTokens, result.model, result.provider);

    recentRequests.push({ ts: Date.now(), inputTokens: result.inputTokens, outputTokens: result.outputTokens });

    log('info', 'completion', {
      model: result.model,
      provider: result.provider,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      stopReason: result.stopReason,
      elapsedMs: elapsed,
    });

    sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('error', 'completion failed', { err: message });
    sendError(res, 502, 'Upstream provider error');
  } finally {
    activeRequests -= 1;
  }
}

function handleUsage(req: IncomingMessage, res: ServerResponse): void {
  const licenseKey = getLicenseKey(req);
  if (!licenseKey) {
    sendError(res, 401, 'Missing X-Psygil-License header');
    return;
  }

  const validation = validateLicense(licenseKey);
  if (!validation.ok) {
    sendError(res, 403, validation.error ?? 'Invalid license');
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost`);
  const period = url.searchParams.get('period') ?? undefined;
  const usage = getUsage(licenseKey, period);
  const estimatedCostUsd = estimateCostUsd(usage.inputTokens, usage.outputTokens, 'claude-sonnet-4-20250514');

  sendJson(res, 200, {
    ok: true,
    period: usage.period,
    requests: usage.requests,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostUsd,
  });
}

function handleModels(req: IncomingMessage, res: ServerResponse): void {
  const licenseKey = getLicenseKey(req);
  if (!licenseKey) {
    sendError(res, 401, 'Missing X-Psygil-License header');
    return;
  }

  const validation = validateLicense(licenseKey);
  if (!validation.ok || !validation.tier) {
    sendError(res, 403, validation.error ?? 'Invalid license');
    return;
  }

  const tier: Tier = validation.tier;
  const { provider, model } = resolveProviderAndModel(tier, undefined);

  const allModels: Record<Tier, string[]> = {
    trial: ['claude-sonnet-4-20250514'],
    solo: ['claude-sonnet-4-20250514'],
    practice: ['claude-sonnet-4-20250514', 'claude-opus-4-5', 'claude-haiku-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-flash'],
    enterprise: ['claude-sonnet-4-20250514', 'claude-opus-4-5', 'claude-haiku-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  sendJson(res, 200, {
    ok: true,
    tier,
    defaultProvider: provider,
    defaultModel: model,
    availableModels: allModels[tier],
    allowsModelOverride: tier === 'practice' || tier === 'enterprise',
  });
}

function handleHealth(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { status: 'ok', version: VERSION, uptime: uptimeSeconds() });
}

// ---------- Admin handlers ----------

async function handleAdminSetProviderKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    sendError(res, 413, 'Request body too large');
    return;
  }

  const parsed = parseJson(body);
  if (!parsed || typeof parsed !== 'object') {
    sendError(res, 400, 'Invalid JSON body');
    return;
  }

  const input = parsed as Record<string, unknown>;
  const provider = input['provider'];
  const key = input['key'];

  const validProviders: Provider[] = ['anthropic', 'openai', 'google'];
  if (typeof provider !== 'string' || !validProviders.includes(provider as Provider)) {
    sendError(res, 400, 'provider must be one of: anthropic, openai, google');
    return;
  }
  if (typeof key !== 'string' || key.length === 0) {
    sendError(res, 400, 'key is required');
    return;
  }

  const entry: ProviderKeyEntry = {
    provider: provider as Provider,
    key,
    label: typeof input['label'] === 'string' ? input['label'] : undefined,
    createdAt: new Date().toISOString(),
  };

  setProviderKey(entry);

  sendJson(res, 200, {
    ok: true,
    provider: entry.provider,
    label: entry.label,
    lastFourChars: key.slice(-4),
    createdAt: entry.createdAt,
  });
}

function handleAdminGetProviderKeys(req: IncomingMessage, res: ServerResponse): void {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }
  sendJson(res, 200, { ok: true, providers: listProviderKeys() });
}

function handleAdminDeleteProviderKey(req: IncomingMessage, res: ServerResponse, provider: string): void {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }

  const validProviders: Provider[] = ['anthropic', 'openai', 'google'];
  if (!validProviders.includes(provider as Provider)) {
    sendError(res, 400, 'Unknown provider');
    return;
  }

  const removed = removeProviderKey(provider as Provider);
  if (!removed) {
    sendError(res, 404, 'Provider key not found');
    return;
  }

  sendJson(res, 200, { ok: true, provider });
}

async function handleAdminUpdateProviderConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req);
  } catch {
    sendError(res, 413, 'Request body too large');
    return;
  }

  const parsed = parseJson(body);
  if (!parsed || typeof parsed !== 'object') {
    sendError(res, 400, 'Invalid JSON body');
    return;
  }

  const input = parsed as Partial<RoutingConfig>;
  const updated = updateRoutingConfig(input);
  sendJson(res, 200, { ok: true, config: updated });
}

function handleAdminGetUsage(req: IncomingMessage, res: ServerResponse): void {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost`);
  const period = url.searchParams.get('period') ?? undefined;
  const licenseFilter = url.searchParams.get('license') ?? undefined;

  const aggregate = getAllUsage(period);

  if (licenseFilter) {
    const single = aggregate.byLicense[licenseFilter];
    sendJson(res, 200, { ok: true, data: single ?? null });
    return;
  }

  sendJson(res, 200, { ok: true, data: aggregate });
}

function handleAdminRealtimeUsage(req: IncomingMessage, res: ServerResponse): void {
  if (!verifyAdminKey(req)) {
    sendError(res, 401, 'Invalid admin key');
    return;
  }

  const cutoff = Date.now() - 5 * 60 * 1000;
  const recent = recentRequests.filter((r) => r.ts >= cutoff);
  const last5minTokens = recent.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);

  // Prune stale entries to keep memory bounded.
  const pruneCutoff = Date.now() - 10 * 60 * 1000;
  while (recentRequests.length > 0 && (recentRequests[0]?.ts ?? 0) < pruneCutoff) {
    recentRequests.shift();
  }

  sendJson(res, 200, {
    ok: true,
    activeRequests,
    last5minRequests: recent.length,
    last5minTokens,
  });
}

// ---------- Main dispatcher ----------

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const method = req.method ?? 'GET';
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, 'http://localhost');
  const path = url.pathname;

  // Handle preflight CORS.
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Psygil-License, X-Admin-Key',
    });
    res.end();
    return;
  }

  try {
    // Public endpoints.
    if (method === 'POST' && path === '/v1/ai/complete') {
      await handleComplete(req, res);
      return;
    }
    if (method === 'GET' && path === '/v1/ai/usage') {
      handleUsage(req, res);
      return;
    }
    if (method === 'GET' && path === '/v1/ai/models') {
      handleModels(req, res);
      return;
    }
    if (method === 'GET' && path === '/health') {
      handleHealth(req, res);
      return;
    }

    // Admin endpoints.
    if (method === 'POST' && path === '/v1/admin/provider-keys') {
      await handleAdminSetProviderKey(req, res);
      return;
    }
    if (method === 'GET' && path === '/v1/admin/provider-keys') {
      handleAdminGetProviderKeys(req, res);
      return;
    }
    if (method === 'DELETE' && path.startsWith('/v1/admin/provider-keys/')) {
      const provider = path.slice('/v1/admin/provider-keys/'.length);
      handleAdminDeleteProviderKey(req, res, provider);
      return;
    }
    if (method === 'PUT' && path === '/v1/admin/provider-config') {
      await handleAdminUpdateProviderConfig(req, res);
      return;
    }
    if (method === 'GET' && path === '/v1/admin/usage/realtime') {
      handleAdminRealtimeUsage(req, res);
      return;
    }
    if (method === 'GET' && path === '/v1/admin/usage') {
      handleAdminGetUsage(req, res);
      return;
    }

    sendError(res, 404, 'Not found');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('error', 'Unhandled request error', { err: message, path, method });
    sendError(res, 500, 'Internal server error');
  }
});

server.listen(PORT, () => {
  log('info', `API gateway listening on port ${PORT}`, { version: VERSION });
});

// Graceful shutdown: flush usage before exiting.
function shutdown(signal: string): void {
  log('info', `Received ${signal}, flushing usage and shutting down`);
  flushUsageToDisk();
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
