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

### ✅ M1 — Locat Sentinel
- Scoped revocable integration tokens (hash-only storage, shown once).
- Token-authed inbound webhooks (`/api/sentinel/webhook`) — fully separate from
  user sessions. Severity model, incident lifecycle (open/ack/resolved/reopen),
  fingerprint dedupe + resolve, audit timeline, per-token rate limit.
  Webhook size now enforced in real UTF-8 bytes (Content-Length pre-check +
  byte-accurate body check) with oversized/multibyte regression tests.
- Adapters: generic, nScout, PipelineGuard. Full Incidents + Integrations UI.
- Validated via live E2E (auth rejection, validation, dedupe, cross-account
  isolation). See `docs/SENTINEL.md`.

### ✅ M2 — Locat Link
- Per-device ECDH keys; device registry; pairing with 6-digit SAS verified on
  both devices (MITM protection, not code-alone). Encrypted chunked file
  transfer relayed through the server as opaque ciphertext (progress, cancel,
  recovery, history, purge on completion). Encrypted clipboard + send-to-device.
- Transparent: server-relayed (not P2P); no LAN/mDNS/Bluetooth (future). Scoped
  to an account's own devices.
- Validated: 149 unit tests (12 new), lint/tsc/build clean; live E2E confirmed
  pre-pair transfer blocked (403), two-sided SAS verify, byte-exact transfer,
  chunk purge, clipboard delivery, cross-account isolation. See `docs/LINK.md`.

## Backlog (dependency-ordered, approved scope)
- **M3 — Vault** (next if budget allows): client-side encrypted files/folders,
  authorized sharing (reuse group-key wrapping), previews, quotas, recovery
  design. Only start if enough credits remain to finish securely + tested.
- **Sentinel critical notifications**: alert on arrival of critical incidents.
- Later (P2): Workspace, Hub, Offline, Secrets, Automate, Search, Calendar,
  Share, Extensions — each ships complete+tested before becoming tappable.

## Test credentials
See `memory/test_credentials.md` (disposable `locat_dev` only).

---

## Emergent session on `feat/locat-2.0-emergent-final` (fork of `feat/locat-2.0`)

### Phase 1 completed

| # | Goal | Status | Commit |
|---|---|---|---|
| 1 | Mobile Home button + de-duplicated hamburger drawer | ✅ Implemented & tested | `af6855c` |
| 2 | Composer drafts preserved across navigation / background | ✅ Implemented & tested | `af6855c` |
| 3 | Real device app lock (passcode + biometric + auto-lock + background lock) | ✅ Implemented & tested | `ca74f33` |
| 4 | Honest device-storage protection UI (no fake green-checks) | ✅ Implemented & tested | `ca74f33` |
| 5 | Platform-adapter scaffold for Tauri 2 desktop (no installer work) | ✅ Scaffolded + journal entry | `b78afb8` |
| 6 | Notification prefs (categories, quiet hours, foreground alerts, per-chat mute) | ✅ Implemented & tested | `33e3d17` |
| 7 | Journal + handoff updated with hashes, next steps | ✅ Updated | `829a2b3` |

### New shared architecture
- `src/lib/draft.ts` — per-conversation localStorage drafts.
- `src/lib/appLock.ts` — PBKDF2-SHA-256 (310 000 iters) passcode, auto-lock, WebAuthn biometric.
- `src/lib/notificationPrefs.ts` — categories, quiet hours, mute list, `shouldNotify` predicate.
- `src/lib/platform/{index,browser,capacitor,tauri}.ts` — capability-driven adapter.
- `src/components/shell/MobileBottomNav.tsx` — shared bottom nav.
- `src/components/AppLockGate.tsx` — modal lock gate between AuthProvider and router.
- `src/components/chat/{AppLockSection,NotificationPreferences}.tsx` — Settings panels.

### Validation
- `npx tsc -b` — clean.
- `npx vitest run` — 218 tests passed / 26 skipped / 1 file skipped (baseline was 151 passing); 67 new tests, zero regressions.
- `npx eslint` on changed files — 0 errors, 0 warnings.
- No Android build, no Pi access, no deploy, no PR merges.

### Explicit non-goals / deferred
- Any merge to `main` / `stable` / `feat/locat-2.0`.
- Rust Tauri project (`src-tauri/`), installer bundling, signed updates.
- M1–M11 server-side work.

### Resume plan
1. `git checkout feat/locat-2.0-emergent-final`
2. `npm ci && npx tsc -b && npx vitest run` to confirm baseline.
3. Pick next item from `docs/LOCAT_2_0_JOURNEY_AND_HANDOFF.md`:
   - Phase 2: Sentinel + Link hardening (Link proof-of-possession is the next P0 security item).
   - Android HTTPS loopback verification on the user's emulator.
   - Replace Tauri adapter stubs with real plugins once `src-tauri/` exists.
