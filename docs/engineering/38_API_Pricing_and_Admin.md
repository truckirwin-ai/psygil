# API Pricing Model and Admin Key Management

Status: Planning (2026-04-17)
Owner: Truck Irwin (CEO)
Related: 37_API_Passthrough_Architecture.md

## Token Usage Per Evaluation (empirical estimate)

A single forensic psychological evaluation runs five AI agents sequentially. Each agent receives redacted text (UNIDs in place of PHI) and returns structured JSON or prose. Token counts vary by case complexity; the estimates below assume an average case with 8-12 uploaded documents, one clinical interview transcript, and 3-4 test instruments scored.

| Agent | Input tokens (avg) | Output tokens (avg) | What it processes |
|---|---|---|---|
| Ingestor | 12,000 | 3,000 | All case documents concatenated: referral letters, medical records, test protocols, court orders |
| Psychometrician | 5,000 | 2,000 | Test score tables, validity scale data, normative references |
| Diagnostician | 15,000 | 5,000 | Ingestor output + test data + interview content; produces evidence map and differential |
| Writer | 22,000 | 15,000 | Everything above + clinician decisions + style profile; produces 6-10 report sections |
| Editor | 18,000 | 3,500 | Writer output + case record cross-reference; produces 9-category adversarial annotations |
| **Total per eval** | **72,000** | **28,500** | |

Additional overhead per evaluation (validation retries, test-connection calls, re-runs on HARD RULE violation): approximately 10% on top. Adjusted totals:

- **Input: ~79,000 tokens per eval**
- **Output: ~31,000 tokens per eval**

## Cost Per Evaluation at Provider Rates

Using Claude Sonnet pricing as the passthrough default (the model one version behind current):

| Model | Input rate (per 1M tokens) | Output rate (per 1M tokens) | Cost per eval |
|---|---|---|---|
| Claude Sonnet 4.5 (passthrough default) | $3.00 | $15.00 | $0.70 |
| Claude Opus 4.5 (Practice/Enterprise override) | $15.00 | $75.00 | $3.51 |
| Claude Haiku 4.5 (lightweight tasks) | $0.80 | $4.00 | $0.19 |

**Foundry SMB's raw cost per evaluation on Sonnet: $0.70**

With volume discount from Anthropic (estimated 15% at 100K+ requests/month): **$0.60 per eval.**

## Weekly/Monthly Projections for a Solo Practitioner

| Pace | Evals/week | Evals/month | Raw API cost/mo | At 2x markup (overage rate) |
|---|---|---|---|---|
| Light (part-time forensic practice) | 5 | 20 | $14.00 | $28.00 |
| Standard (full-time solo) | 10 | 40 | $28.00 | $56.00 |
| Heavy (high-volume practice) | 15 | 60 | $42.00 | $84.00 |

## Recommended Tier Pricing

| Tier | Monthly license | Included evals/mo | Overage per eval | Foundry SMB margin on AI |
|---|---|---|---|---|
| Trial | $0 (10 days) | 15 total (not per month) | Blocked after 15 | ~$10.50 cost, covered by conversion rate |
| Solo | $199/mo | 30 | $1.50 (2x of $0.70 market + buffer) | $199 license minus ~$21 AI cost = $178 margin before infra |
| Practice | $499/mo per seat | 80 per seat | $1.50 | $499 minus ~$56 AI cost = $443 margin per seat |
| Enterprise | Custom (starting $999/mo) | Unlimited (fair-use policy) | Negotiated bulk rate | Volume-dependent |

### Why 30 included evals for Solo

A solo forensic practitioner conducting 5-10 evaluations per week averages 20-40 per month. Setting the cap at 30 means:
- A 5/week practitioner never hits the cap (20 < 30).
- A 10/week practitioner occasionally hits it mid-month and pays $1.50 per overage eval (still cheaper than managing their own API key).
- The overage rate of $1.50 is 2x the market cost ($0.70), which covers infrastructure overhead and provides margin.
- At 30 included evals, Foundry SMB's baked-in AI cost is ~$21/month against a $199 license: 10.5% of revenue, well within SaaS margin targets.

### Overage notification UX

When usage reaches 80% of the included cap: yellow banner in the Dashboard header.
When usage reaches 100%: amber modal on next agent run. "You have used 30 of 30 included AI evaluations this month. Additional evaluations are $1.50 each. Continue?" with a "View Usage" link to the Settings > AI > Usage panel.

## Admin Key Management (Server-Side)

The entire point: Truck can swap provider keys, change models, or switch providers without touching a single desktop app installation. Every change takes effect on the next API call from any user.

### Admin endpoints on the Psygil API Gateway (Fly.io)

```
POST   /v1/admin/provider-keys
  Body: { provider: 'anthropic'|'openai'|'google', key: string, label?: string }
  Auth: ADMIN_API_KEY header
  Effect: stores the key in the gateway's encrypted vault (Fly.io secrets or a
          KMS-backed store). Active keys are used for all passthrough requests
          to that provider immediately.

GET    /v1/admin/provider-keys
  Auth: ADMIN_API_KEY
  Response: [{ provider, label, lastFourChars, createdAt, lastUsedAt, requestCount }]
  Keys are never returned in full; only the last 4 characters for identification.

DELETE /v1/admin/provider-keys/:provider
  Auth: ADMIN_API_KEY
  Effect: removes the provider key. If the default passthrough model uses this
          provider, the gateway falls back to the next configured provider or
          returns a 503 to the desktop app with a clear error.

PUT    /v1/admin/provider-config
  Body: {
    defaultProvider: 'anthropic'|'openai'|'google',
    defaultModel: 'claude-sonnet-4-5-...',
    fallbackProvider?: 'openai',
    fallbackModel?: 'gpt-4o',
    tierOverrides?: {
      trial:  { model: 'claude-haiku-4-5-...', maxRequestsPerDay: 10 },
      solo:   { model: 'claude-sonnet-4-5-...', maxRequestsPerDay: 50 },
      practice: { model: 'claude-sonnet-4-5-...', maxRequestsPerDay: 200 },
      enterprise: { model: 'claude-sonnet-4-5-...', maxRequestsPerDay: null },
    },
    overageRateMultiplier: 2.0,
  }
  Auth: ADMIN_API_KEY
  Effect: updates the routing config. Takes effect on the next request.

GET    /v1/admin/usage
  Auth: ADMIN_API_KEY
  Query: ?period=2026-04&license=PSGIL-SOLO1-...
  Response: {
    period: '2026-04',
    totalRequests: 1234,
    totalInputTokens: 89_000_000,
    totalOutputTokens: 35_000_000,
    estimatedCostUsd: 860.00,
    byLicense: [
      { license: 'PSGIL-SOLO1-...', requests: 42, inputTokens: 3_024_000, ... },
      ...
    ],
    byModel: [
      { model: 'claude-sonnet-4-5-...', requests: 1100, costUsd: 770.00 },
      { model: 'claude-opus-4-5-...', requests: 134, costUsd: 90.00 },
    ],
  }

GET    /v1/admin/usage/realtime
  Auth: ADMIN_API_KEY
  Response: { activeRequests: 3, last5minRequests: 12, last5minTokens: 450_000 }
```

### Key rotation workflow (zero downtime)

1. Truck generates a new Anthropic API key at console.anthropic.com.
2. Truck calls `POST /v1/admin/provider-keys` with the new key. The gateway stores both old and new.
3. The gateway immediately starts using the new key for all new requests.
4. After confirming the new key works (check `/v1/admin/usage/realtime`), Truck calls `DELETE /v1/admin/provider-keys/anthropic?label=old` to remove the previous key.
5. No desktop app update, no user action, no downtime.

### Provider swap workflow (e.g., Anthropic to OpenAI)

1. Truck adds an OpenAI key via `POST /v1/admin/provider-keys`.
2. Truck calls `PUT /v1/admin/provider-config` with `defaultProvider: 'openai'` and `defaultModel: 'gpt-4o'`.
3. All subsequent passthrough requests route to OpenAI. The gateway translates between Psygil's request format and OpenAI's ChatCompletion format server-side.
4. Desktop apps see no change: `completeAi()` receives the same `AiCompletionResponse` shape regardless of which provider served it. The `provider` field in the response changes from `'anthropic'` to `'openai'`, which the app can display in the status bar for transparency.
5. To roll back: `PUT /v1/admin/provider-config` with `defaultProvider: 'anthropic'`.

### Model upgrade workflow

1. Anthropic releases Claude Sonnet 4.7. The current passthrough default is Sonnet 4.5.
2. Truck decides to upgrade to 4.6 (one behind current, per policy).
3. `PUT /v1/admin/provider-config` with `defaultModel: 'claude-sonnet-4-6-...'`.
4. All passthrough requests now use 4.6. No desktop update needed.
5. If 4.6 produces worse results for forensic prompts, roll back to 4.5 in one API call.

### Admin UI

Extend the existing `services/license-server/admin.html` with three new tabs:

- **Provider Keys**: list configured providers, add/remove keys, show last-4-chars and usage stats.
- **Routing Config**: edit the JSON config for default provider, model, tier overrides, overage multiplier. Live preview of what each tier would get.
- **Usage Dashboard**: monthly usage by license, by model, by provider. Cost estimates. Real-time request counter.

All admin operations are authenticated by the same `ADMIN_API_KEY` used for the license server admin endpoints.

## Desktop App Changes for Usage Visibility

### Settings > AI > Usage panel (new)

Shows the current month's usage for this license:
- Evals used: 22 of 30 included
- Progress bar (green up to 80%, amber 80-100%, red at cap)
- Estimated cost if overages are incurred
- "View detailed usage" link (opens the Psygil web dashboard, future)

### Status bar indicator

The existing status bar at the bottom of the app already shows "LLM: Claude Sonnet" and "PHI: UNID Redaction". After this change:
- Passthrough mode: "LLM: Psygil AI (Sonnet 4.5)" with a green dot
- BYOK mode: "LLM: Claude Sonnet 4.6 (your key)" or "LLM: GPT-4o (your key)"

This gives the clinician transparency about which model is generating their report content, which matters for expert-witness credibility (the clinician should know and be able to testify about what AI tools were used).

## Metrics to Track (for Truck's business decisions)

1. **Conversion rate from Trial to Solo**: does removing the API-key barrier increase conversion?
2. **Average evals/month per Solo user**: calibrates the included cap.
3. **Overage frequency**: if more than 20% of Solo users hit the cap regularly, the cap is too low.
4. **Provider cost per eval over time**: tracks whether Anthropic pricing changes affect margin.
5. **BYOK adoption rate in Practice tier**: if most Practice users stay on passthrough, multi-provider BYOK was over-invested.
