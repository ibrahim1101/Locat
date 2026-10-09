# Locat Sentinel (M1)

Cybersecurity notification & incident-management module. Part of the Locat 2.0
ecosystem on `feat/locat-2.0`. Additive only — no change to existing messaging,
auth, E2EE or schema.

## Capabilities (implemented)
- **Scoped, revocable integration tokens** (`incidents:write`). Generated as
  `lsk_<32 random bytes>`; only the SHA-256 hash is stored, the plaintext is
  shown exactly once and never logged.
- **Authenticated inbound webhooks** at `POST /api/sentinel/webhook?format=…`.
  Auth is a Bearer integration token only — **never** a user session. The route
  lives outside tRPC/session middleware; a session token cannot authenticate it
  and an integration token cannot authenticate a session.
- **Severity model**: `info < low < medium < high < critical`. Re-triggered
  incidents keep the higher severity.
- **Incident lifecycle**: `open → acknowledged → resolved` (+ reopen), every
  transition recorded in `incident_events` (full audit trail / timeline).
- **Fingerprint dedupe**: a webhook with a matching open/acknowledged
  fingerprint updates the existing incident; a `resolved` signal clears it.
- **Payload adapters**: `generic`, `nscout`, `pipelineguard` (normalized to a
  common incident shape; see `api/sentinel/adapters.ts`).
- **Rate limiting** per token (120/min) and a 64 KB body cap.
- **Authorization**: incidents and tokens are strictly scoped to the owning
  account; cross-account reads return `NOT_FOUND` (verified by test + E2E).

## Webhook examples
```bash
# Generic
curl -X POST "$LOCAT/api/sentinel/webhook?format=generic" \
  -H "Authorization: Bearer lsk_…" -H "content-type: application/json" \
  -d '{"title":"Suspicious login blocked","severity":"medium","source":"siem"}'

# nScout (fingerprint = alert.id or nscout:<service>:<host>)
curl -X POST "$LOCAT/api/sentinel/webhook?format=nscout" \
  -H "Authorization: Bearer lsk_…" -H "content-type: application/json" \
  -d '{"alert":{"name":"CPU high","service":"web","host":"pi-1","level":"critical","id":"a-1"}}'
# clear it:
#   {"alert":{"service":"web","host":"pi-1","state":"recovered","id":"a-1"}}

# PipelineGuard (failed stage ⇒ high severity, fingerprint pipeline:stage)
curl -X POST "$LOCAT/api/sentinel/webhook?format=pipelineguard" \
  -H "Authorization: Bearer lsk_…" -H "content-type: application/json" \
  -d '{"pipeline":"api-deploy","stage":"build","status":"failed","branch":"main","runId":"run-7"}'
```

## Security limitations
- Webhook payloads are **metadata**, not end-to-end encrypted — they are
  operational alerts, a different trust boundary from Locat messages. Do not put
  message plaintext, keys or secrets in webhook bodies.
- Integration tokens grant incident creation for one account. Treat them like
  any bearer secret; rotate via revoke + create.
- Rate limiting is per-process in-memory (consistent with the existing relay
  limiter); a horizontally-scaled deployment would need a shared store.

## Files
- `db/schema.ts` — `integration_tokens`, `incidents`, `incident_events`
- `scripts/setup-db.mjs` — additive `CREATE TABLE IF NOT EXISTS`
- `api/sentinel/tokens.ts`, `api/sentinel/adapters.ts` — pure, unit-tested
- `api/sentinel/webhook.ts` — token-authed receiver
- `api/sentinelRouter.ts` — authed tRPC (tokens + incident management + stats)
- `src/pages/Sentinel.tsx` — Incidents + Integrations UI
- Tests: `api/sentinel/adapters.test.ts`, `api/sentinel/tokens.test.ts`
