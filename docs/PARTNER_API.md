# Partner API (v1)

Read API for master-dealer / partner integrations (e.g. Coastside) to reconcile
installs, field activity, ISP/carrier info, and rep rosters against their own
system.

## Base URL
```
https://<host>/api/v1
```

## Authentication
Every request needs an API key, sent as a Bearer token (or `X-API-Key` header):
```
Authorization: Bearer csk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Keys are issued by us (one per partner) and carry **scopes** limiting which
resources they can read. Missing/invalid key → `401`; valid key without the
required scope → `403`.

Verify a key:
```
curl -H "Authorization: Bearer $KEY" https://<host>/api/v1/ping
# → { "ok": true, "partner": "Coastside", "scopes": ["installs:read", ...] }
```

## Scopes
| Scope | Grants |
|---|---|
| `installs:read` | `GET /installs` |
| `field-logs:read` | `GET /field-logs` |
| `carriers:read` | `GET /carriers` |
| `reps:read` | `GET /reps` |
| `*` | all of the above |

## Conventions
- All responses are JSON. List endpoints return `{ "count": N, "<resource>": [...] }`.
- **Pagination / deltas:** `?limit=` (1–500, default 100) and `?since=<ISO8601>`
  (returns records changed on/after that time — use for incremental syncs).
- Timestamps are ISO 8601 UTC.

## Endpoints

### `GET /installs` — install records
Params: `limit`, `since` (by `createdAt`), `carrierId`, `status`.
```json
{ "count": 1, "installs": [{
  "id": "…", "externalId": "ORD-123", "carrier": { "id": "…", "name": "AT&T" },
  "customerName": "…", "customerAddress": "…", "installDate": "2026-06-01T00:00:00.000Z",
  "status": "MATCHED", "orderStatus": "ORDER COMPLETE",
  "repId": "…", "repName": "…", "matchedSaleId": "…", "createdAt": "…"
}]}
```

### `GET /field-logs` — door-knock field activity
Params: `limit`, `since` (by `updatedAt`), `blitzId`, `disposition`.
```json
{ "count": 1, "fieldLogs": [{
  "id": "…", "address": "100 Cypress Creek Rd", "city": "Cedar Park", "state": "TX",
  "zip": "78613", "lat": 30.53, "lng": -97.82, "disposition": "SOLD",
  "blitzId": "…", "rep": { "id": "…", "name": "…" },
  "resolvedAt": "…", "updatedAt": "…"
}]}
```

### `GET /carriers` — ISP / carrier info
```json
{ "count": 1, "carriers": [{
  "id": "…", "name": "AT&T", "revenuePerInstall": 400, "status": "ACTIVE",
  "markets": [{ "id": "…", "name": "Lockhart, TX (AT&T)", "coverageArea": "…", "status": "ACTIVE" }]
}]}
```

### `GET /reps` — field users
Params: `limit`, `role`.
```json
{ "count": 1, "reps": [{ "id": "…", "name": "…", "email": "…", "role": "FIELD_REP", "status": "ACTIVE", "createdAt": "…" }]}
```

## Coming soon
- **Rep-level commission rates** (`/commissions`) — lands once the compensation
  engine is merged.
- **Write endpoints** for partners to push leads/payments to us (scoped `*:write`).

## Issuing / revoking keys (internal)
```
# local
npx tsx -r dotenv/config scripts/mint-api-key.ts "Coastside"
# prod (Neon)
DOTENV_CONFIG_PATH=.env.kinetic.local npx tsx -r dotenv/config scripts/mint-api-key.ts "Coastside"
```
The plaintext key prints once. Revoke by setting `active=false` on its `api_keys`
row (or `revoked_at`).
