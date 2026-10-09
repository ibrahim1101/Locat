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
