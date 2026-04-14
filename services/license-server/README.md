# Psygil License Server

A minimal HTTP service that implements the contract consumed by the Psygil
desktop app's license validator.

## Endpoints

```
POST /v1/licenses/validate
  Body:    { "key": "PSGIL-XXXXX-XXXXX-XXXXX-XXXXX" }
  200 OK:  { "ok": true,  "tier": "...", "seats": N, "expiresAt": "..." }
  200 OK:  { "ok": false, "errorCode": "EXPIRED"|"REJECTED",
             "errorMessage": "..." }
  400:     { "error": "Body must be { \"key\": string }" }

GET /healthz
  200 OK:  "ok"
```

## Run locally

```bash
npx tsx services/license-server/server.ts
```

The server listens on `127.0.0.1:8443` by default. On first launch it
seeds `services/license-server/licenses.json` with five development keys
covering valid solo / practice / enterprise, plus an expired key and a
revoked key.

## Connect the desktop app

Set the environment variable before launching `npm run dev`:

```bash
export PSYGIL_LICENSE_SERVER=https://your-server.example.com
npm run dev
```

The desktop client refuses non-`https://` URLs in production. For local
testing the verifier overrides this with a closed-port URL to exercise
the fallback path; the runtime check is enforced inside `validateRemote`
itself.

## Verify the contract

```bash
npx tsx services/license-server/verify.ts
```

This boots the server in-process on a random localhost port, sends real
HTTP requests, then exercises the production `validateLicense` /
`validateRemote` clients against it. Confirms valid keys, expired keys,
revoked keys, malformed input, missing fields, the 404 fallback, the
HTTPS guard, and the offline fallback path.

## Database

Storage is a JSON file at `services/license-server/licenses.json`. Schema:

```json
{
  "licenses": [
    {
      "key": "PSGIL-SOLO1-ABCDE-12345-XYZ7Q",
      "tier": "solo",
      "seats": 1,
      "expiresAt": null,
      "revoked": false,
      "notes": "free-form"
    }
  ]
}
```

The file is read on every request. Replacing it with a real database is a
small change in `loadDatabase()` and `getDatabase()` in `server.ts`.

## Production hardening (NOT in this MVP)

- TLS termination via reverse proxy (caddy, nginx) or fastify with HTTPS
- Rate limiting per IP and per key
- HMAC-signed responses to prevent local fakery
- Audit log for every validation
- Replication and backups
- Real database (Postgres) with row-level security
- Per-customer issuance API for the Foundry SMB sales team
