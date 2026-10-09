# Locat 2.0 — Product Requirements & Progress

## Original problem statement
Transform the imported `ibrahim1101/Locat` encrypted messenger into a modular,
self-hosted private digital ecosystem with a full frontend overhaul (matte-black
`#0B0B0C` + burnt-orange `#E86B2C`, patterned backgrounds, cybersecurity
aesthetic) and 13 real functional modules, preserving all existing messaging,
E2EE, authentication and database compatibility. Official logo
`public/locat-official-logo.png` is immutable.

## Architecture (existing, preserved)
- Frontend: React 19 + TypeScript + Vite + Tailwind + Radix (shadcn). Entry
  `src/main.tsx` → `src/App.tsx` (react-router).
- Backend: Hono + tRPC v11, Drizzle ORM, MariaDB. Entry `api/boot.ts`.
- E2EE: ECDH P-256 + HKDF + AES-GCM, device-held keys, password-wrapped backup.
  Server is a blind relay; history lives in per-account IndexedDB.
- Android: Capacitor 8 (CI-generated native project).

## Constraints (binding)
- Isolated branch `feat/locat-2.0` (from `feat/locat-1.0`); never push to
  `feat/locat-1.0`/`main`; no Pi/production access. Disposable local MariaDB
  `locat_dev`.
- Additive-only backend changes (new tables/routers). No custom crypto. New
  modules get their own threat models + authorization + tests. No mock features.

## Users / personas
- Self-hoster/owner (admin): runs the server, manages accounts, wires security
  integrations (nScout, PipelineGuard) into Sentinel.
- Member: private messaging + ecosystem modules on web/desktop/Android.

## Status

### ✅ M0 — Obsidian Ember design system + ecosystem shell (commit a9ed868)
- Matte-black + burnt-orange token layer with dotted mesh; token-only re-skin of
  auth, chat, bubbles, composer, drawer, dialogs (zero logic change). Logo
  preserved byte-for-byte.
- Module registry (`src/modules/registry.tsx`) = single source of truth; planned
  modules shown honestly, never as working screens.
- Responsive `AppShell` (desktop rail + mobile bottom nav) + real `Dashboard`
  wired to live conversation data. Routing: `/`=Dashboard, `/messages`=Chat
  (unchanged), `/sentinel`, `/admin`.
- Validated: 122 unit tests pass, tsc + eslint clean, production web build green.

### ✅ M1 — Locat Sentinel (this milestone)
- Scoped revocable integration tokens (hash-only storage, shown once).
- Token-authed inbound webhooks (`/api/sentinel/webhook`) — fully separate from
  user sessions. Severity model, incident lifecycle (open/ack/resolved/reopen),
  fingerprint dedupe + resolve, audit timeline, per-token rate limit, 64KB cap.
- Adapters: generic, nScout, PipelineGuard. Full Incidents + Integrations UI.
- Validated: 137 unit tests pass (15 new), lint clean, tsc clean; live E2E curl
  confirmed auth rejection (no/bad/session-token), payload validation, dedupe
  lifecycle, cross-account isolation (other user sees 0 incidents). See
  `docs/SENTINEL.md`.

## Backlog (dependency-ordered, approved scope)
- **M2 — Link** (next): authenticated device pairing (ephemeral ECDH + verified
  code + key pinning, not code-alone), device registry, encrypted server-relayed
  transfers, clipboard sync, send-to-device, history. Document server-assisted
  vs direct P2P (P2P/mDNS = future).
- **M3 — Vault**: client-side encrypted files/folders, authorized sharing
  (reuse group-key wrapping), previews, quotas, recovery design.
- Later (P2): Workspace, Hub, Offline, Secrets, Automate, Search, Calendar,
  Share, Extensions — each ships complete+tested before becoming tappable.

## Test credentials
See `memory/test_credentials.md` (disposable `locat_dev` only).
