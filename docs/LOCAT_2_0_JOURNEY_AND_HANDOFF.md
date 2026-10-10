# Locat 2.0 — Development Journey and Next-Chat Handoff

Updated: 2026-10-10. This is an editable, living record. Record both successes and failures. Do not confuse local preview verification with production readiness.

## Project identity and safety
- Locat is a self-hosted, end-to-end-encrypted messenger and planned 13-module private digital ecosystem, with React/Vite, Hono/tRPC, MariaDB/Drizzle and Capacitor Android.
- Preserve existing E2EE and native Capacitor Android architecture; no Expo conversion.
- Official approved metallic cat logo and matte-black/burnt-orange "Obsidian Ember" design must be preserved. Logo: `public/locat-official-logo.png` (approved blob `c465d010524032e1ec9f37b1e9b1c2722c7237cc`).
- NEVER deploy to the Raspberry Pi, modify its production database, merge into stable/main, or overwrite the user's original APK without explicit permission.
- Current work is on `feat/locat-2.0` local preview; security review on separate `fix/locat-link-security-review` draft PR #3. Quality branch `chore/locat-2.0-quality` draft PR #2.

## What was implemented / surfaced
- Emergent M0 redesigned UI, M1 Sentinel, M2 Link on `feat/locat-2.0`; remaining modules are roadmap only. Desktop dashboard visibly rendered with sidebar Dashboard, Messages, Sentinel, Link, and module roadmap.
- Local registration succeeded for test account `test0` (screen showed LC-4465). This is a **local preview account**, not a production account.
- Desktop preview worked through the full app server at `http://localhost:3000`.
- Android native project was absent from the v2 checkout, as were Capacitor packages; generated Android project locally using Capacitor 7. Built debug APK and installed a separate preview app by changing Android `applicationId` to `com.shaikibrahim.locat.preview` (user instructed to do so).
- Android APK launched and displayed the **Connect Locat** HTTPS-only server onboarding screen. **Authenticated Android login, messaging, Sentinel and Link have NOT been tested on Android.**

## Troubleshooting timeline — failures, causes, resolutions
1. Registration/login showed Drizzle `Failed query ... users`; local preview lacked database environment configuration.
2. Diagnostic command `require('dotenv')` failed; package unavailable at that point. Switched to Node built-in fs/env checks; no `.env` or process DATABASE_URL found.
3. `npm ci` initially failed `EPERM unlink node_modules/@esbuild/win32-x64/esbuild.exe`, caused by a Windows process file lock. Stopping the dev server/esbuild process allowed `npm ci` to succeed (478 packages). npm reported 11 vulnerabilities (6 moderate, 5 high); do not automatically run `npm audit fix --force`.
4. Docker Desktop Engine 29.8.2 available; Docker Hub `mariadb:11.4` pulls timed out contacting `auth.docker.io`. `docker pull public.ecr.aws/docker/library/mariadb:11.4` succeeded. Created isolated container `locat2-preview-db` mapped `127.0.0.1:3307 -> 3306`. SentinelLab API/Mongo containers were also running independently.
5. Local preview database configuration recommended: `DATABASE_URL=mysql://locat_preview:locat_preview_pass@127.0.0.1:3307/locat_preview`, `PORT=3000`, `HOST=127.0.0.1`, `COOKIE_SECURE=false` in local `.env`. `npm run db:setup`, `npm run build`, `npm run doctor`, `npm start` were supplied. User then showed successful signed-in dashboard; **exact db:setup/doctor output not supplied**, so do not claim all checks passed.
6. `npm run build:web` succeeded (1981 modules transformed; >500 kB chunk warning). `npx cap sync android` failed "could not determine executable" because Capacitor CLI/Android packages were missing; `android/gradlew.bat` did not exist. Recommended installing `@capacitor/cli@7 @capacitor/core@7 @capacitor/android@7`, `npx cap add android`, sync.
7. First `gradlew.bat assembleDebug` downloaded Gradle 8.11.1 but failed "SDK location not found". Recommended setting `android/local.properties` to `sdk.dir=C:/Users/ibrah/AppData/Local/Android/Sdk` (verify actual SDK location). Later APK existed, confirming build succeeded, though build log not supplied.
8. `adb install -r` failed `INSTALL_FAILED_VERSION_DOWNGRADE`: existing app versionCode 194, preview APK versionCode 1. Recommended separate preview `applicationId` instead of uninstalling the original app and risking encryption-key/data loss.
9. APK launched and showed HTTPS-only Connect Locat screen. The preview backend is plain HTTP bound to PC loopback, so emulator cannot use it directly; no insecure cleartext exception should be added. **This is the next Android blocker.** Prefer a trusted local HTTPS reverse proxy with an emulator-trusted development certificate and deliberate hostname routing; alternatively discuss implications of a temporary HTTPS tunnel, which exposes the test server.

## Current preview environment (as last observed)
- Windows local checkout: `C:\Users\ibrah\Locat-2-Preview`.
- MariaDB container: `locat2-preview-db`, ECR public mirror MariaDB 11.4, localhost port 3307, separate preview schema `locat_preview`.
- Local server: `http://localhost:3000` (working in browser at screenshot time).
- Emulator: `emulator-5554`, ADB at `C:\platform-tools\adb.exe`.
- APK expected: `android/app/build/outputs/apk/debug/app-debug.apk`.
- Existing original Locat Android app versionCode 194; protect its app data.
- Local `.env` and Gradle `local.properties` should not be committed, and preview database passwords should be rotated if ever exposed beyond local testing.

## Security and engineering caveats
- Locat Link device authentication still needs proper proof-of-possession challenge-response, ownership/revocation enforcement, transfer authorization and regression tests. Draft PR #3 addresses bounded Sentinel webhook bodies, lint/tests/CI, **not** all Link security concerns.
- GitHub Actions had Docker Hub pull rate-limit problems; ECR public mirror substitution was attempted in review branch but final CI status needs verification.
- Browser screenshot is evidence of UI/auth functioning locally, not evidence of production-ready E2EE, Sentinel, Link, or Android feature parity.
- The Android HTTPS connection screen is expected security behavior; do not weaken it to plain HTTP just to complete preview.

## Prioritized next development table

| Priority | Work item | Definition of done | Status |
| --- | --- | --- | --- |
| P0 | Android local preview HTTPS connectivity | Emulator can connect securely to isolated PC backend with trusted HTTPS; login and logout work; no production changes | Blocked |
| P0 | Android UI/responsiveness audit | Verify login, dashboard, navigation, scrolling, safe areas, keyboard, orientation and screenshots on emulator | Not tested |
| P0 | Link device authentication security | Challenge-response proof of key ownership, revoked-device restrictions, authenticated transfer actions, tests | Open |
| P0 | Baseline CI and security review | Verify PR #3 checks, investigate 11 npm audit findings, keep merges gated | Open |
| P1 | Messaging and E2EE regression | Cross-device direct/group messages, encryption keys, offline retry, attachment handling, mobile/browser interoperability | Not yet validated in v2 |
| P1 | Sentinel integration verification | Scoped webhook tokens, event ingestion, severity, audit, acknowledge/resolve, nScout/PipelineGuard fixtures | UI exists; full tests pending |
| P1 | Link integration verification | Pairing, LAN discovery, encrypted transfer, clipboard sync, send-to-device, revocation, history | UI exists; full tests pending |
| P1 | Documentation and onboarding | User guide, security model, troubleshooting, deployment notes, feature availability matrix | In progress |
| P2 | M3 Vault | Client-side encrypted file storage, authorization, recovery, tests | Planned |
| P2 | M4 Dashboard + Search | Real dashboard data and permission-scoped search | Planned |
| P2 | M5 Hub | Least-privilege server telemetry agent and alerts | Planned |
| P2 | M6 Secrets | Client-encrypted credential vault, auto-lock/recovery | Planned |
| P3 | M7 Calendar + Automate | Shared events/reminders and workflow rules | Planned |
| P3 | M8 Share | Expiring links, QR, Android share sheet | Planned |
| P3 | M9 Workspace | Roles, Kanban, notes, team spaces | Planned |
| P3 | M10 Extensions | Server-enforced scoped plugin/module permissions | Planned |
| P3 | M11 Offline | Genuine LAN-only messaging, future mesh; not just offline outbox | Planned |

## Next-chat startup instructions
1. Read this journey document on `feat/locat-2.0` and inspect latest branch/PR statuses before modifying code.
2. User is taking a break; do not initiate work or scheduling without a new request.
3. When resuming, begin with **Android preview secure HTTPS setup**, then Android smoke tests and Link security hardening.
4. Verify which local changes are uncommitted (`git status`) before proposing commits. Local Capacitor changes may not exist on GitHub; do not assume they are saved in the repo.
5. Continue updating this document with every substantive failure, fix, test result and milestone; do not erase earlier lessons.

## 2026-10-10 — Resume audit and Android HTTPS runbook (committed)

- Inspected current GitHub branch `feat/locat-2.0`, handoff, NativeServerSetup, API/native transport, Android docs, draft PRs and CI. At audit start the branch head was `e32f84843cd36ec3409b9a303183172653d9400e`.
- PR #2 `chore/locat-2.0-quality` and PR #3 `fix/locat-link-security-review` remain **open, draft, unmerged**. Historic quality CI run `37984497936` was successful as recorded in PR #2; check live status again before integration.
- Latest reviewed PR #3 CI run `37991441744`: `verify` success, `code-quality` success, `docker-smoke` failed. Inspected job `114026639334`: MariaDB mirror fetched successfully, but the Dockerfile's `node:22-bookworm-slim` image returned Docker Hub **429 Too Many Requests**. This is a registry failure, not a proven application test regression. Remediation: evaluate mirror for Dockerfile Node build/runtime images in the dedicated security/quality branch, then rerun full CI. Do not mark Docker smoke green until actually successful.
- Confirmed `NativeServerSetup` rejects HTTP and validates `/api/health`; secure onboarding must remain intact. Native bearer support exists for tRPC batch requests. The present tRPC provider still configures `httpSubscriptionLink` unconditionally despite Android docs describing a polling-only native fallback: verify subscription use and fix before claiming Android realtime coverage.
- Committed a new runbook at `docs/ANDROID_LOCAL_HTTPS_PREVIEW.md` describing loopback-only Caddy HTTPS, `adb reverse tcp:8443 tcp:8443`, exact `https://localhost:8443` hostname, debug-only trust of the preview development CA, original APK preservation, and positive/negative acceptance checks. This **does not mean connectivity was run or verified**: the assistant cannot access the user's running Windows emulator, Caddy instance, isolated MariaDB or local uncommitted Capacitor project.
- Next implementation after user/local acceptance: automate **only the separate preview debug variant's** local HTTPS trust setup without committing private CA material; verify Android native transport and login/logout; add automated HTTPS rejection tests and secure Link device proof-of-possession challenge-response tests.
- No merge, production Pi access, original app replacement, or production database changes occurred.

## 2026-10-10 — Active development: strict Android origin integration

- Rechecked branch heads, open PRs, Actions and both handoff documents before editing. `feat/locat-2.0` was at `6bf5d655385c61c9b0aad997e398aeb9a3c87bb7`; draft PR #2 and #3 remain open and unmerged. Quality branch run `37988534534` passed; last reviewed security run `37991441744` failed (Docker Hub image 429 per previous investigation).
- Committed `7f372a1857e6a1b04aa62ba391e7d2866585dfd0` on `feat/locat-2.0`: `NativeServerSetup.tsx` now calls `parseNativeServerOrigin` before `/api/health`, enforcing strict HTTPS-only origin with no credentials/path/query/fragment. Health check remains mandatory and native server URL persists only after success.
- No build, CI rerun, emulator HTTPS handshake or Android login was executed in this cycle. Next: add regression coverage for onboarding and negative health responses, verify CI; validate localhost Caddy/debug CA/ADB reverse on user's Windows emulator. Link key possession/revocation remains unresolved.
- Production Raspberry Pi/database, original Android APK, stable/main branches and draft PRs untouched.

## 2026-02-?? — Emergent Phase 1 session on `feat/locat-2.0-emergent-final`

Working branch forked from `feat/locat-2.0` at `334ff1f`. Target is Phase 1
(M0 Core Messenger) plus the cross-platform directive added mid-session.

### Commits landed in this session

* `af6855c` — **M0 nav: unified mobile bottom bar, Home button, draft
  persistence.** Extracted `MobileBottomNav` from `AppShell` and mounted it
  on the Messages conversation list so a single tap on "Home" returns to the
  Dashboard. Hamburger drawer dropped the duplicated "Ecosystem home" and
  "Chats" entries. New `src/lib/draft.ts` persists composer text per
  conversation in `localStorage` so backgrounding / Home / switching chats
  no longer loses drafts. 15 new tests, no regressions.
* `ca74f33` — **M0 device lock: real passcode + biometric + auto-lock +
  background lock.** Replaced the misleading "Protect device storage"
  button with a full `AppLockSection`, backed by `src/lib/appLock.ts`
  (PBKDF2-SHA-256 310 000 iterations, random salt, constant-time compare,
  configurable auto-lock, lock-on-background, optional WebAuthn platform
  authenticator). New `AppLockGate` mounts between `AuthProvider` and the
  router: it does **not** touch the server session or identity keys — the
  gate only blocks the UI until the device-local passcode / biometric is
  satisfied. 24 new tests, no regressions.
* `b78afb8` — **Platform adapter scaffold for Tauri 2 desktop.**
  Added `src/lib/platform/{index,browser,capacitor,tauri}.ts` so native
  capabilities (notifications, file save, open-external, secure storage,
  system tray, deep links, signed updates) sit behind a shared `PlatformAdapter`
  interface. The browser and Capacitor adapters are live; the Tauri adapter is
  a scaffold that currently delegates to the browser fallback and advertises
  only the capabilities actually implemented. **No installer / packaging
  work was performed** — this stays within the stated budget.

### Validation
* `npx tsc -b` — clean.
* `npx vitest run` — 190+ passing / 26 skipped / 1 file skipped. Baseline
  on `feat/locat-2.0` was 151 passing / 26 skipped; the delta is the new
  Phase 1 tests. No regressions.
* No Android build, no emulator run, no production access.

### Cross-platform desktop directive (recorded verbatim)
Locat 2.0 must support **Windows (EXE/MSI)**, **Linux (AppImage/DEB/RPM)**
and **macOS (APP/DMG)** desktop builds using **Tauri 2**, reusing the
existing React/Vite/TypeScript frontend. Electron / Expo migrations are
forbidden. Capacitor Android stays unchanged.

Architecture rules enforced in this session:
1. Shared UI and business logic are platform-independent. Every native call
   routes through `src/lib/platform/*` and returns `null` / `false` /
   `UnsupportedCapability` when the capability is honestly unavailable.
2. Capability surface documented in `PlatformCapabilities`:
   `nativeNotifications`, `nativeFileSave`, `nativeOpenExternal`,
   `nativeSecureStorage`, `systemTray`, `deepLinks`, `signedUpdates`.
3. The Tauri adapter advertises only shipped capabilities. The
   `plannedCapabilities` map in `src/lib/platform/tauri.ts` is the target
   set for a future dedicated Tauri branch.

### Follow-up work parked for a dedicated Tauri branch
* Add Rust Tauri project (`src-tauri/`) wired to the existing Vite bundle.
* Replace Tauri adapter stubs with plugin calls:
  `@tauri-apps/plugin-notification`, `-dialog`, `-fs`, `-opener`,
  `-updater`, and either `-stronghold` or an OS keyring plugin.
* System-tray / deep-link listeners in `src/main.tsx` gated by the
  `tauri-desktop` platform kind.
* Signed update manifest endpoint on the Hono API, scoped to deployment
  identity. Public key committed; private key kept in deployment secrets.
* CI pipelines for Windows / Linux / macOS artefacts; code-signing
  certificates procured separately.
* QA runbook equivalent to `docs/ANDROID_LOCAL_HTTPS_PREVIEW.md` covering
  macOS Gatekeeper and Windows SmartScreen trust.

No desktop packaging work was performed in this session per the explicit
budget constraint. The directive is recorded so the next session can pick
up from this adapter layer without re-planning the architecture.

### Still open from previous sessions
* Android HTTPS loopback verification on the user's emulator.
* Link device proof-of-possession challenge-response (PR #3 open draft).
* Docker Hub rate-limit on CI for the Node runtime image.

### Follow-up in this session
* `33e3d17` — **M0 notifications: device prefs, categories, quiet hours,
  per-conversation mute.** Added `src/lib/notificationPrefs.ts` (pure logic
  + persistence), `src/components/chat/NotificationPreferences.tsx` (UI
  mounted in Settings & backups) and a bell/mute toggle in the chat header
  that toggles the muted state via the shared prefs store. Prefs stay on
  the device; the Web Push payload still contains no plaintext — only the
  shell decides when to alert. 23 new tests, no regressions.
