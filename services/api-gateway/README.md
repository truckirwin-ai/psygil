# Psygil API Gateway

Standalone Node.js/TypeScript proxy server that forwards AI completion requests from the
Psygil desktop app to Anthropic, OpenAI, or Google, injecting Foundry SMB provider API
keys server-side. Deployed on Fly.io.

## Local development

```bash
cd services/api-gateway
npm install
npm run dev
```

Set required env vars before starting:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ADMIN_API_KEY=your-admin-secret
# Optional:
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=...
export PORT=8080
```

## Build

```bash
npm run build
# Output goes to dist/
```

## Deploy to Fly.io

```bash
cd services/api-gateway
npm run build
fly deploy
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set ADMIN_API_KEY=your-admin-secret
# Optional providers:
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_API_KEY=...
```

## Endpoints

### Public (requires X-Psygil-License header)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/ai/complete | Proxy an AI completion request |
| GET | /v1/ai/usage | Current month usage for the requesting license |
| GET | /v1/ai/models | Available models for the requesting license tier |
| GET | /health | Health check |

### Admin (requires X-Admin-Key header)

| Method | Path | Description |
|--------|------|-------------|
| POST | /v1/admin/provider-keys | Add or update a provider API key |
| GET | /v1/admin/provider-keys | List configured providers (masked keys) |
| DELETE | /v1/admin/provider-keys/:provider | Remove a provider key |
| PUT | /v1/admin/provider-config | Update routing config |
| GET | /v1/admin/usage | Aggregate usage (period and license query params) |
| GET | /v1/admin/usage/realtime | Active requests and last-5-minute stats |

## License key format

```
PSGIL-TTTTT-XXXXX-XXXXX-XXXXX
```

Tier is encoded in the first 4 chars of segment 2:

| Prefix | Tier |
|--------|------|
| TRIA | trial (10 req/day) |
| SOLO | solo (50 req/day, 30 evals/month) |
| PRAC | practice (200 req/day, 80 evals/month, model override allowed) |
| ENTR | enterprise (unlimited, model override allowed) |

## Security notes

- Provider API keys are stored as Fly.io secrets, never in code.
- Admin key comparison uses `timingSafeEqual` to prevent timing attacks.
- Request bodies are capped at 1 MB.
- No PHI is logged: only token counts, model, provider, and elapsed time are written to stderr.
