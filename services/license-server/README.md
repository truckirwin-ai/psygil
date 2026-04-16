# Psygil License Server

A production-ready HTTP service that implements the license validation contract
consumed by the Psygil desktop app.

## Endpoints

```
POST /v1/licenses/validate
  Body:    { "key": "PSGIL-XXXXX-XXXXX-XXXXX-XXXXX" }
  200 OK:  { "ok": true,  "tier": "...", "seats": N, "expiresAt": "..." }
  200 OK:  { "ok": false, "errorCode": "EXPIRED"|"REJECTED", "errorMessage": "..." }
  400:     { "error": "Body must be { \"key\": string }" }

GET  /health               200: { "status": "ok", "version": "1.0.0" }
GET  /healthz              same (legacy alias)

POST /v1/admin/licenses
  Header:  X-Admin-Api-Key: <ADMIN_API_KEY>
  Body:    { "tier": "solo"|"practice"|"enterprise", "seats"?: N,
             "customer_id"?: "...", "expires_at"?: "ISO8601" }
  200 OK:  { "ok": true, "license": { ... } }

POST /v1/admin/licenses/:key/revoke
  Header:  X-Admin-Api-Key: <ADMIN_API_KEY>
  200 OK:  { "ok": true, "key": "..." }

GET  /v1/admin/licenses?tier=&customer_id=&page=&limit=
  Header:  X-Admin-Api-Key: <ADMIN_API_KEY>
  200 OK:  { "licenses": [...], "total": N, "page": N, "limit": N }

GET  /admin/               Static admin UI (HTML, no build step)
```

Every 200 response includes `X-Psygil-Signature: <hmac-sha256-hex>` so the
desktop app can verify the response was not tampered with in transit.

## Environment variables

| Variable | Default | Required in prod |
|---|---|---|
| `PSYGIL_LICENSE_SERVER_PORT` | `8443` | No |
| `PSYGIL_LICENSE_SERVER_HOST` | `127.0.0.1` | No |
| `DATABASE_URL` | (unset, uses JSON file) | Yes |
| `SIGNING_SECRET` | `dev-signing-secret-change-in-production` | Yes |
| `ADMIN_API_KEY` | (unset, admin disabled) | Yes |
| `PSYGIL_LICENSE_DB` | `./licenses.json` | No (JSON mode only) |

## Storage backends

**Development (no DATABASE_URL):** Reads and writes `licenses.json` next to
`server.ts`. Auto-seeds five dev keys on first start.

**Production (DATABASE_URL set):** Uses Postgres. Tables are auto-created on
first connection:
- `customers(id, email, name, created_at)`
- `licenses(key, tier, seats, customer_id, issued_at, expires_at, revoked_at)`
- `audit_log(id, license_key, ip, timestamp, result, error_code)`

## Run locally

```bash
cd services/license-server
npm install
npx tsx server.ts
```

The server listens on `127.0.0.1:8443` by default. On first launch it seeds
`licenses.json` with five dev keys (valid solo/practice/enterprise, expired,
revoked).

## Verify the contract

```bash
npx tsx services/license-server/verify.ts
```

This boots the server in-process on a random port, sends real HTTP requests,
then exercises the production `validateLicense` / `validateRemote` clients.

## Deployment: Fly.io

Create `fly.toml`:

```toml
app = "psygil-licenses"
primary_region = "iad"

[build]
  dockerfile = "services/license-server/Dockerfile"

[env]
  PSYGIL_LICENSE_SERVER_PORT = "8080"
  PSYGIL_LICENSE_SERVER_HOST = "0.0.0.0"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [services.concurrency]
    type = "connections"
    hard_limit = 100
    soft_limit = 75

[services.http_checks]
  interval = "15s"
  timeout = "5s"
  grace_period = "10s"
  method = "get"
  path = "/health"
```

Set secrets:

```bash
fly secrets set DATABASE_URL="postgres://..." SIGNING_SECRET="..." ADMIN_API_KEY="..."
fly deploy
```

## Deployment: Render

1. Create a new Web Service, root directory `services/license-server`.
2. Build command: `npm install`.
3. Start command: `npx tsx server.ts`.
4. Environment variables: `DATABASE_URL`, `SIGNING_SECRET`, `ADMIN_API_KEY`,
   `PSYGIL_LICENSE_SERVER_HOST=0.0.0.0`, `PSYGIL_LICENSE_SERVER_PORT=8080`.
5. Add a Postgres database and paste the connection string into `DATABASE_URL`.

## TLS with Caddy (self-hosted, `licenses.psygil.com`)

```caddy
licenses.psygil.com {
  reverse_proxy localhost:8443
  encode gzip

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Frame-Options DENY
    X-Content-Type-Options nosniff
  }

  log {
    output file /var/log/caddy/licenses.psygil.com.log
    format json
  }
}
```

Caddy handles certificate renewal automatically via Let's Encrypt.

## Connect the desktop app

```bash
export PSYGIL_LICENSE_SERVER=https://licenses.psygil.com
npm run dev
```

The app enforces `https://` at the call site and refuses plain HTTP.

## Admin UI

Browse to `https://licenses.psygil.com/admin/` and enter your `ADMIN_API_KEY`
in the password field. The key is stored in `sessionStorage` for the tab's
lifetime only.
