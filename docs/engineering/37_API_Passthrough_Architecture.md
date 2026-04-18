# API Passthrough Architecture

Status: Planning (2026-04-17)
Owner: Truck Irwin / Engineering
Related: `src/main/ai/claude-client.ts`, `src/main/ai/key-storage.ts`, `src/main/agents/runner.ts`

## Problem Statement

Today, every Psygil user must obtain their own Anthropic API key (sk-ant-...) and paste it into Settings. This creates three problems:

1. **Onboarding friction.** A forensic psychologist should not need to create an Anthropic account, understand API tiers, manage billing, or troubleshoot rate limits. They bought Psygil; the AI should just work.

2. **Cost unpredictability.** Users see raw Claude API pricing (input/output tokens at per-model rates). They cannot predict what a case will cost. Foundry SMB cannot bundle AI costs into the license price without controlling the API surface.

3. **No multi-provider flexibility.** The current client hardcodes `https://api.anthropic.com/v1/messages`. Practice and Enterprise customers who have existing OpenAI or Google Gemini agreements cannot use those credits.

## Proposed Architecture

### Two modes, one interface

The app supports two API routing modes, selected per license tier:

| Mode | Who uses it | How it works |
|---|---|---|
| **Psygil Passthrough** (default) | Trial + Solo | App sends requests to `api.psygil.com/v1/ai/complete`. Foundry SMB's server proxies to Claude. User never sees an API key. Cost is bundled into the Psygil license fee. |
| **Bring Your Own Key (BYOK)** | Practice + Enterprise (optional) | User pastes their own API key for Claude, OpenAI, or Gemini. App calls the provider directly. User pays the provider; Psygil license is cheaper. |

### Request flow (Passthrough mode)

```
Psygil Desktop App
    |
    |  POST https://api.psygil.com/v1/ai/complete
    |  Headers:
    |    X-Psygil-License: <license-key>
    |    X-Psygil-Client-Version: 1.0.0
    |    Content-Type: application/json
    |  Body: { systemPrompt, userMessage, model?, maxTokens?, temperature? }
    |
    v
Psygil API Gateway (Cloudflare Workers or Fly.io)
    |
    |  1. Validate license key (check tier, expiry, rate limits)
    |  2. Select upstream provider + model:
    |     - Default: Claude Sonnet 4.5 (one major version behind current)
    |     - Override: if the request specifies a model, use it (rate-limited)
    |  3. Inject Foundry SMB's provider API key
    |  4. Forward request to Anthropic / OpenAI / Google
    |  5. Stream or buffer the response
    |  6. Log usage: license_key, tokens_in, tokens_out, model, latency
    |  7. Return response to the desktop app
    |
    v
Anthropic API (or OpenAI / Google, depending on model routing)
```

### Request flow (BYOK mode)

```
Psygil Desktop App
    |
    |  POST https://api.anthropic.com/v1/messages  (or openai/google)
    |  Headers: provider-native (x-api-key / Authorization: Bearer)
    |  Body: provider-native
    |
    v
Provider API directly (no Psygil server in the path)
```

## Code changes (app side)

### 1. New: `src/main/ai/provider.ts` (provider abstraction)

A single interface that all agents call instead of `callClaude` directly:

```typescript
export interface AiCompletionRequest {
  readonly systemPrompt: string
  readonly userMessage: string
  readonly model?: string       // provider-specific model ID
  readonly maxTokens?: number
  readonly temperature?: number
}

export interface AiCompletionResponse {
  readonly content: string
  readonly model: string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stopReason: string
  readonly provider: 'psygil' | 'anthropic' | 'openai' | 'google'
}

/**
 * Route a completion request through either the Psygil passthrough
 * or a direct BYOK provider, depending on the app's configured mode.
 */
export async function completeAi(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse>
```

The function reads the routing mode from the persisted config:
- If `aiConfig.mode === 'passthrough'`, call `callPsygilProxy(licenseKey, request)`
- If `aiConfig.mode === 'byok'`, determine provider from the stored key prefix and call the appropriate client

### 2. New: `src/main/ai/psygil-proxy.ts` (passthrough client)

```typescript
export async function callPsygilProxy(
  licenseKey: string,
  request: AiCompletionRequest,
): Promise<AiCompletionResponse>
```

Sends to `https://api.psygil.com/v1/ai/complete` with the license key in a header. The response envelope matches the provider-agnostic `AiCompletionResponse` shape. The server side handles provider selection and key injection.

### 3. Modified: `src/main/ai/claude-client.ts` (keep as BYOK Anthropic client)

Rename to make its role clear. No functional change; it already does the right thing. Just called by the BYOK path when the stored key starts with `sk-ant-`.

### 4. New: `src/main/ai/openai-client.ts` (BYOK OpenAI client)

Same interface, calls `https://api.openai.com/v1/chat/completions`. Maps the Psygil-standard request to OpenAI's message format (system role + user role). Maps the response back to `AiCompletionResponse`.

### 5. New: `src/main/ai/google-client.ts` (BYOK Google Gemini client)

Same interface, calls the Gemini API. Maps request/response.

### 6. Modified: `src/main/agents/runner.ts`

Currently:
```typescript
import { callClaude } from '../ai/claude-client'
...
claudeResponse = await callClaude(apiKey, { ... })
```

After:
```typescript
import { completeAi } from '../ai/provider'
...
aiResponse = await completeAi({ systemPrompt, userMessage, ... })
```

The runner no longer knows which provider is in use. It gets a `AiCompletionResponse` with `provider` field for logging. The API key is resolved internally by `completeAi` (passthrough uses the license key; BYOK retrieves from keychain).

### 7. Modified: `src/main/ai/key-storage.ts`

Extend to store provider alongside the key:

```typescript
interface StoredApiKey {
  readonly key: string
  readonly provider: 'anthropic' | 'openai' | 'google'
}
```

Auto-detect provider from key prefix:
- `sk-ant-` -> Anthropic
- `sk-` (without `ant`) -> OpenAI
- `AIza` -> Google

### 8. Modified: Setup flow (FirstRunModal + Settings)

**FirstRunModal (Trial/Solo):** No API key field. The passthrough is automatic. The user enters their license key, and that is the authentication token for the Psygil API gateway. Remove the "AI Configuration" requirement entirely for Trial and Solo tiers.

**Settings > AI (Practice/Enterprise):** Shows two options:
- "Use Psygil AI (included)" (default, passthrough)
- "Use your own API key" (BYOK, with provider selector: Claude / ChatGPT / Gemini, key input, Test Connection button)

### 9. Modified: `src/shared/types/setup.ts`

```typescript
export interface AiConfig {
  readonly mode: 'passthrough' | 'byok'
  readonly provider: 'anthropic' | 'openai' | 'google' | null
  readonly model: string | null
  readonly configured: boolean
  readonly verifiedAt: string | null
}
```

### 10. Pricing / model selection

| Tier | Default model via passthrough | Override allowed? |
|---|---|---|
| Trial | Claude Sonnet 4.5 (cost-optimized) | No |
| Solo | Claude Sonnet 4.5 | No |
| Practice (passthrough) | Claude Sonnet 4.5 | Yes, with per-request surcharge |
| Practice (BYOK) | Whatever the user's key supports | Yes |
| Enterprise | Negotiated | Yes |

The passthrough server controls the model. The app sends a preferred model in the request body; the server may override it based on the license tier's allowance. This lets Foundry SMB manage costs centrally.

## Server side (Psygil API Gateway)

Not in the desktop app repo. Lives at `services/api-gateway/` or as a separate project.

### Endpoints

```
POST /v1/ai/complete
  Headers: X-Psygil-License, X-Psygil-Client-Version
  Body: { systemPrompt, userMessage, model?, maxTokens?, temperature? }
  Response: { content, model, inputTokens, outputTokens, stopReason, provider }

GET /v1/ai/usage
  Headers: X-Psygil-License
  Response: { currentMonth: { requests, inputTokens, outputTokens, estimatedCostUsd } }

GET /v1/ai/models
  Headers: X-Psygil-License
  Response: { models: [{ id, provider, label, tier }] }
```

### Server responsibilities

1. **License validation.** Reject expired/revoked keys. Rate-limit by tier (Trial: 100 requests/day; Solo: 1,000/day; Practice: 10,000/day; Enterprise: unlimited).
2. **Provider routing.** Default to Claude Sonnet 4.5. If the request specifies `model: "claude-opus-4-..."`, route to Opus and log the surcharge.
3. **Key injection.** The server holds Foundry SMB's provider API keys. They never reach the client.
4. **Usage tracking.** Per-license, per-month token counts. Feeds into billing and the usage dashboard.
5. **Response passthrough.** The response body is provider-agnostic; the server normalizes Anthropic, OpenAI, and Google responses into the same shape.

### Cost model

Foundry SMB buys Claude API access at volume rates. The Solo license price includes a bundled AI allowance (e.g., 500 agent runs/month at ~$0.05 each = $25/month AI cost baked into the $199/month license). Overages are tracked but not billed to the user in v1.0; they produce a "usage high" warning in the app and an alert to the Foundry SMB operations team.

## Security considerations

1. **PHI never reaches the Psygil proxy.** The UNID redaction pipeline runs BEFORE the AI call. The proxy sees only redacted text with UNIDs in place of PHI. This is unchanged from the current architecture.

2. **License key is not an API key.** The Psygil license key authenticates the request to the proxy, not to Anthropic. The proxy injects Foundry SMB's provider keys server-side. A leaked license key cannot be used to call Anthropic directly.

3. **BYOK keys stay local.** In BYOK mode, the user's API key is stored in safeStorage on their machine and sent directly to the provider. It never passes through Psygil's servers.

4. **TLS everywhere.** Both passthrough and BYOK paths use HTTPS. The proxy enforces TLS 1.3.

## Migration path

### Phase 1 (this sprint): app-side abstraction

- Build `provider.ts` with `completeAi` abstraction
- Build `psygil-proxy.ts` client (initially calls a stub or falls back to BYOK if no proxy is reachable)
- Modify `runner.ts` to use `completeAi` instead of `callClaude`
- Add `mode: 'passthrough' | 'byok'` to AiConfig
- FirstRunModal no longer requires an API key for Trial/Solo
- Settings shows the two-mode picker for Practice/Enterprise
- BYOK OpenAI + Gemini clients (stub implementations, basic message mapping)

### Phase 2 (next sprint): server-side gateway

- Deploy the Psygil API Gateway (Cloudflare Workers or Fly.io)
- Wire it to Foundry SMB's Anthropic API key
- Add license validation + rate limiting + usage tracking
- Point the app's `psygil-proxy.ts` at the live URL
- Test end-to-end: Trial user activates, runs an agent, sees results, Foundry SMB sees usage

### Phase 3 (post-launch): multi-provider BYOK

- Complete OpenAI client with full message mapping
- Complete Gemini client
- Settings UI for provider selection
- Test matrix: each agent x each provider

## What this does NOT change

- The UNID redaction pipeline (runs locally, before any AI call)
- The agent prompt specs (same system prompts regardless of provider)
- The Writer/Editor/Diagnostician/Ingestor agent architecture
- The test harness or the audit trail
- The report generation pipeline
- HIPAA compliance (PHI still never leaves the workstation)

## Decision points for Truck

1. **Passthrough URL.** `api.psygil.com` requires DNS + hosting. Is Fly.io the target, or Cloudflare Workers? Workers has edge routing (lower latency from any geography) but more complex deployment. Fly.io is simpler and co-locates with the license server.

2. **Cost bundling.** Is the Solo tier a flat monthly fee that includes X agent runs, or is it usage-based with a cap? The proxy needs to know the answer to enforce rate limits.

3. **Model versioning.** "One or two releases behind current" means Sonnet 4.5 today (Sonnet 4.6 is current). When 4.7 ships, the passthrough upgrades to 4.5 or 4.6? This is a business decision, not a code decision; the proxy's model config is a single line change.

4. **BYOK tiers.** Is BYOK available on Solo for an extra fee, or strictly Practice/Enterprise? The code supports either; the gate is a license-tier check in Settings.

5. **OpenAI/Gemini priority.** How important is multi-provider BYOK for v1.0 launch? Phase 3 can ship weeks after launch with no user-facing downside if most users are on passthrough. Recommend deferring to reduce launch risk.

## Files touched (Phase 1 estimate)

| File | Change |
|---|---|
| `src/main/ai/provider.ts` | NEW: provider abstraction + routing |
| `src/main/ai/psygil-proxy.ts` | NEW: passthrough HTTP client |
| `src/main/ai/openai-client.ts` | NEW: BYOK OpenAI stub |
| `src/main/ai/google-client.ts` | NEW: BYOK Gemini stub |
| `src/main/ai/claude-client.ts` | KEPT: becomes BYOK Anthropic client |
| `src/main/ai/key-storage.ts` | EXTEND: store provider alongside key |
| `src/main/ai/ai-handlers.ts` | MODIFY: route through provider.ts |
| `src/main/agents/runner.ts` | MODIFY: `callClaude` -> `completeAi` |
| `src/main/agents/*.ts` (5 files) | MODIFY: remove `retrieveApiKey` import (provider.ts handles it) |
| `src/shared/types/setup.ts` | MODIFY: AiConfig gains `mode` field |
| `src/renderer/.../FirstRunModal.tsx` | MODIFY: no API key for Trial/Solo |
| `src/renderer/.../SettingsTab.tsx` | MODIFY: two-mode picker |
| `tests/unit/shared/provider.test.ts` | NEW: routing logic tests |

Estimated effort: 1 day app-side (Phase 1), 2 days server-side (Phase 2).
