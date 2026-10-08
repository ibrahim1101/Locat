# Locat — Project History, Engineering Journal & New-Chat Handoff

**Last updated:** 2026-10-08 (IST)  
**Repository:** https://github.com/ibrahim1101/Locat  
**Active development branch:** `feat/locat-1.0`  
**Status:** Active pre-release development; **not a finished 1.0 release**.  
**Purpose:** Living, editable Markdown project record. Update this file after every meaningful change, failed attempt, successful test and deployment. This is a handoff to future ChatGPT chats and human collaborators.

> **Evidence convention:** “Implemented” means code exists; “CI verified” means automation passed; “device accepted” means the user tested it. These are different. Historical progress counters and older README/plan text may lag reality. Do not assume untested features work.

## 1. Vision and design principles

Locat is a self-hosted, mobile-first encrypted messaging application. The Raspberry Pi (or other Linux/Docker host) runs a **relay**, not a permanent plaintext chat-history store. Client devices encrypt content before sending, keep durable message history locally, and retrieve/acknowledge encrypted envelopes through the relay. The server persists necessary account, key, contact, group and delivery metadata. The app should be installable by beginners and accessible to friends through private HTTPS, currently using Tailscale. The project is intended as a real-world cybersecurity/software-engineering portfolio project.

**Non-negotiables:** protect existing users, keys, conversations and local history; never clear Android app data/browser site storage to “fix” a UI bug; preserve MariaDB and `/opt/locat/.env`; keep backwards compatibility where feasible; prioritize security, correctness and device testing over cosmetic completion; never mark a feature fully accepted merely because code was committed.

## 2. Architecture (current understanding)

- **Server:** Node.js, Hono, tRPC, Drizzle ORM, MariaDB; service `locat.service` on Raspberry Pi 5, running `/opt/locat/dist/boot.js` as dedicated `locat` user.
- **Client:** React/Vite, tRPC React Query, local IndexedDB for account-scoped message history and identity keys; PWA/browser plus Capacitor Android APK (`com.shaikibrahim.locat`).
- **Transport:** HTTPS API, tRPC HTTP batch requests and SSE subscription. Android native bearer token is attached to HTTP batch requests; SSE EventSource may lack that header, motivating authenticated HTTP polling/heartbeat fallback.
- **Crypto:** ECDH P-256/HKDF/AES-GCM envelopes, password-wrapped private-key backup, per-group wrapped/versioned keys. **Not Signal double-ratchet/forward secrecy.** Device-local plaintext history is not encrypted at rest; encrypted exports/backups are important.
- **Presence:** `api/hub.ts` in-memory SSE listeners and time-limited HTTP heartbeats; `api/messagesRouter.ts` `messages.presence` endpoint; `src/pages/Chat.tsx` client refresh every ~20 seconds. Current presence is **broken for Android**; see section 7.
- **Hosting:** Raspberry Pi OS 64-bit, MariaDB, Tailscale Serve HTTPS; user-reported Pi/friend connectivity accepted. Docker and generic Linux instructions exist but not every platform has been physically validated.
- **License:** GNU GPL-3.0-only, aligned with nScout.

## 3. Chronological history

### October 5, 2026 — Initial foundation and working product

1. Defined mobile-first private messenger: encrypted relay delivery, **local-only durable chats**, direct/group communication and self-hosting.
2. Repaired initial installation/build/frontend problems via repository work/PR; restored mobile styles and production loading. Initial checks passed but live Pi/phone testing remained pending.
3. Built out offline/PWA history, durable outbox, search, media viewing, key-change checks, one-active-device sessions, terminal administration, encrypted backup/restore and Docker-hosting groundwork.
4. Added GUI admin dashboard with account controls, session revocation, statistics, cleanup, metadata backup/restore and action logs. Automated tests passed at that stage; device acceptance still needed.
5. Began browser-compatibility investigation: desktop Firefox subsequently worked; **Firefox mobile** had notification and other functionality problems requiring physical testing.

### October 6, 2026 — Scope expansion and 1.0 engineering plan

1. Created development branch `feat/locat-1.0` and `docs/LOCAT-1.0-PLAN.md`; chose one comprehensive 1.0 cycle rather than multiple intermediate releases.
2. Audited baseline: Node/Hono/tRPC, React/Vite, MariaDB/Drizzle, opaque ciphertext relay; established that database integration tests and physical acceptance must be tracked separately.
3. Hardened encrypted envelope parsing/validation, malformed payload rejection, shared schema and stable message references; preserved existing message formats.
4. Implemented encrypted edit/delete controls with sender authorization, local projection, replay/deduplication handling and durable offline outbox. User later accepted device tests.
5. Implemented bio/profile editing and searchable account identifiers. Account codes evolved from numeric IDs to 16-digit random, then eight-digit, finally **fixed unique four-digit LC numbers (1000–9999)**, noneditable and server-scoped; preserve established codes across upgrades.
6. Added clickable profile panel, avatar selection/removal and thumbnail handling. User accepted profile picture, profile panel, bio/code, edit and delete tests.
7. Planned stronger privacy, contact requests, read receipts, blocking, app lock, media/calls, themes, UI overhaul and many other features. Added **Android APK** to the 44-item release scope.
8. Wrote beginner installation documentation for Pi, native Linux, Docker, Tailscale HTTPS, friends, backups and troubleshooting. Pi remains the preferred working self-hosted setup.
9. Iterated Locat visual identity: distinctive cursive **“Lo”** with a cartoon side-facing cat inside the “O”; final art integration should be checked rather than presumed complete.
10. GPLv3 license requested to match nScout.

### October 7, 2026 — Features, server and APK bring-up

1. Implemented/expanded read-receipt privacy, block/unblock relationships, contact requests, privacy controls and account/profile flows. The historical roadmap distinguishes partial implementation from device acceptance.
2. Registration initially required **15 characters**, which user found excessive; subsequent Android testing requested **minimum eight characters**. Confirm the current authoritative policy in `contracts/password.ts` and actual deployed UI; do not rely on older plan entries.
3. Installed Locat on Raspberry Pi and verified `npm run doctor` checks for Node, build assets, database, account/admin schema, delivery, retry receipts, group versions/keys, blocking, contact requests and push subscriptions.
4. Tailscale Serve HTTPS used for private access; reported address at the time: `https://ibrahimshaik-1.tail0abf6e.ts.net` (verify before reuse; hostnames can change). Friends use Tailscale machine sharing and separate Locat accounts.
5. First APK authentication failure: **“request origin not allowed”** due to Capacitor `https://localhost` origin; middleware changed to allow the recognized native origin while keeping origin protections for other requests.
6. Additional APK issues included correct credentials reported invalid, registration still enforcing old 15-character guidance, **“too many attempts”** rate limiting, and overlapping UI elements. These were iteratively addressed; do not assume all auth/rate-limit edge cases are fully accepted.
7. CI failures during Android packaging included npm/Capacitor install `edgesOut` and AndroidX `DocumentFile` compilation; fixes isolated Capacitor install and used Android platform APIs. GitHub Actions eventually produced installable APK artifacts.
8. User asked to maintain and update the project schedule/roadmap as features progressed. **Current automation state must be checked explicitly; do not infer a running schedule from this document.**

### October 8, 2026 — Signing, preservation, stability and presence debugging

1. **APK signing failure diagnosed:** older installed debug APK and GitHub-produced APK had different signing certificates, so Android refused an in-place upgrade. The old debug signing key was not available for compatible upgrades.
2. Backed up the old device data after correcting an initial broken binary transfer/permission issue. Created a **permanent release keystore** on the user's Windows machine and GitHub Actions signing secrets; **never commit or share keystore, passwords or secrets**. A one-time uninstall of incompatible debug build was undertaken with user consent after backup. New signed release APK installed.
3. Stable release-signing workflow `.github/workflows/android-apk.yml` uses GitHub secrets and build-number versioning. Later successful run **37767599860** produced signed APK artifact `locat-android-release`; user subsequently upgraded newer builds **in place**.
4. User successfully registered an account and sent **“Hi”**. Android UI video showed system status bar overlapping header, frequent full-screen **CONNECTING…**, grey offline indicators, and occasional **“Loading local chat settings”**.
5. Fixes committed: native root/status-bar padding (`84caafe`, `76f631c`), enable native SSE subscription (`802be0a`), remove unused import after failed CI (`911eddb`).
6. **Critical stability root cause:** `src/pages/Chat.tsx` reloaded the entire page when subscription reported `UNAUTHORIZED`. Native SSE can fail auth while HTTP polling still works. Removed forced reload on SSE auth failure in commit **`96afd3c`**. User tested: repeated CONNECTING screen **PASS**, account/“Hi” history preserved **PASS**, chat usable for 3–5 minutes **PASS**, online status **FAIL**. This is confirmed device acceptance for **data-preserving signed APK upgrade** and stability.
7. Implemented HTTP heartbeat fallback: `api/hub.ts` heartbeat with 65-second expiry; `api/messagesRouter.ts` authenticated `messages.presence`; `src/pages/Chat.tsx` fetch during 20-second sync. Commits **`05324c8`**, **`0348bae`**, **`28fcd51`**.
8. Pi deployment: `systemctl is-active locat` returned `active`; Docker absent (normal: native systemd install). Checkout `~/Locat` on branch `feat/locat-1.0`, clean and latest commit `28fcd51`. Initial SQL dump attempt failed due to ownership of `~/locat-backups`; directory permissions corrected and `mariadb-dump --single-transaction locat` produced recognizable MariaDB SQL header. **Check dump completion footer/size before depending on backup.** Ran native installer `sudo bash scripts/install-pi.sh`; readiness verified: `active` and `{"app":"Locat","status":"ready"}`.
9. Initially `grep` of deployed `/opt/locat` files failed `Permission denied` because of restricted installation ownership; `sudo grep` confirmed deployed source includes `heartbeat(userId)` and `messages.presence.fetch()`.
10. User confirmed **latest APK installed**, Pi updated, messaging works, but PC↔Android online indicators both **FAIL**.
11. Firefox DevTools initially did not show `messages.presence` until disabling cache and hard refreshing; afterward endpoint appeared. Firefox `messages.presence` response repeatedly **`{"online":[3]}`** (inside tRPC JSON wrapper).
12. Firefox `auth.me` identified **user ID 3**, username `test0`. Its server-side `presenceVisibility` was initially **`contacts`** despite user believing it was Everyone; changing the UI setting and refreshing `auth.me` confirmed **`everyone`**. Afterward presence still **`[3]`**. This establishes **Firefox heartbeat works** and **Android account is not showing as online** in Firefox's presence result. Android's own numeric ID has not been collected.
13. Latest diagnostic requested Android logcat: PowerShell `adb` not recognized as command even in `C:\platform-tools`; PowerShell requires **`.\adb.exe`**. User was about to run `.\adb.exe devices`, `.\adb.exe logcat -c`, `.\adb.exe logcat -v time -s chromium Capacitor/Console Capacitor`. **No log output has been received yet.**

## 4. Confirmed outcomes vs unverified claims

**Confirmed by user/device:**
- Pi service active and `/api/ready` returns ready after upgrade.
- Signed Android APK installed and successfully upgraded in place without losing the “Hi” chat/account.
- Repeated full-screen CONNECTING issue no longer occurs in 3–5-minute test.
- Two distinct accounts on Firefox PC and Android can message each other.
- Firefox account ID 3 registers as online at server via `messages.presence`.
- Firefox server-side privacy can be set to `everyone`.

**Not yet accepted / unresolved:**
- Android presence heartbeat and online status in either direction.
- Full Android logcat diagnostics; current investigation paused before log capture.
- Whether Firefox mobile notification and other compatibility problems are resolved on physical mobile Firefox.
- Extended notification/push reliability, background Android behavior and all release features in 44-item plan.
- A complete backup **restore drill** (a dump file alone is not proof of restorable recovery).
- Long-run messaging, reconnect, offline/restart, multi-account and device lifecycle security acceptance.
- UI polish and branding finalization; historic overlap fixed in one video but broader responsive testing remains.

**Progress accounting:** Historical acceptance tracking reached **10/44** before the successful APK-upgrade acceptance; the chat later recorded **13/44** following three additional device checks. Treat **13/44 as the last reported working counter, not an audited feature-by-feature ledger**. Reconcile against `docs/LOCAT-1.0-PLAN.md` before marking any further items complete. Current presence test **FAIL**.

## 5. Failed attempts and lessons

| Symptom / failure | Cause or evidence | Action / status |
|---|---|---|
| APK install refused upgrade | Different debug signing certificates | Permanent signed workflow, backup, one-time migration; future `adb install -r` |
| Initial binary backup failed | Redirection/copy permissions | Corrected transfer; verify backup integrity |
| Android registration “request origin not allowed” | Capacitor origin `https://localhost` rejected | Native-origin allowance implemented |
| Login rejected / password 15-character UI / rate limiting | Auth/UI/server policy drift and retry throttling | Iterative fixes; retest systematically |
| CI `edgesOut` | Capacitor/npm dependency installation | Build isolation change |
| CI `DocumentFile` error | AndroidX compile mismatch | Android framework document API |
| CI unused import | Leftover `isNativeShell` import | Removed; next build passed |
| Android full-screen CONNECTING loop | Subscription auth error called `window.location.reload()` | Removed; **device PASS** |
| Presence absent | SSE auth and/or native heartbeat; Firefox only reports `[3]` | **OPEN**, Android logcat pending |
| Firefox presence request invisible | Possibly cached JS or network filtering | Hard refresh exposed request |
| Pi backup permission denied | Backup directory owned by another user | `chown`/chmod and rerun |
| `/opt/locat` grep denied | Protected deployment directory | Use `sudo grep` |
| PowerShell `adb` not found | Current-directory executables not auto-invoked | Use `.\adb.exe` |

## 6. Immediate next actions — resume here in a new chat

**Priority P0: diagnose Android presence without destabilizing chat.**

1. On Windows PowerShell, with USB debugging enabled:
   ```powershell
   cd C:\platform-tools
   .\adb.exe devices
   .\adb.exe logcat -c
   .\adb.exe logcat -v time -s chromium Capacitor/Console Capacitor
   ```
   Keep Android Locat foregrounded 30–40 seconds, then Ctrl+C. Share **only relevant sanitized errors**; never publish bearer tokens/cookies.
2. If logcat silent, add **minimal non-sensitive diagnostic** to Android client for heartbeat success/error and `online` count. Check whether `messages.presence` executes, auth headers/token, endpoint errors and React effect lifecycle. Preserve stable sync fallback.
3. Inspect `src/providers/trpc.tsx` native `authHeaders()`, `nativeSessionToken()`, HTTP batch link, and SSE `httpSubscriptionLink` behavior. Browser cookie and native bearer auth are different. Do **not** put tokens into URLs to work around EventSource without a security review.
4. Check `api/hub.ts` heartbeat lifecycle and `visibleOnlineUserIds` privacy filtering. Firefox ID 3 with visibility Everyone is known; identify Android account numeric ID using authenticated `auth.me` without disclosing secrets.
5. Potential design problem to assess: **in-memory heartbeat state is process-local**, so multi-process/multi-instance deployments would require shared presence storage; Pi appears single systemd service. Also, current heartbeat expiry may not actively broadcast offline transitions until subsequent activity; improve carefully with tests.
6. Add regression tests for browser+Android concurrent presence, privacy Everyone/Contacts/Nobody, heartbeat expiry, reconnect, SSE failure and API polling fallback. Ensure `npm run check`, `npm run lint`, `npm test`, `npm run build`, GitHub Actions and Pi readiness pass before asking for APK upgrade.
7. Only then test two devices foregrounded for >60 seconds; record both `messages.presence` results and indicators. No uninstall or site-data clearing.

**P1:** Firefox mobile physical regression, notification permissions/behavior, local chat settings loading, UI spacing, contacts/profile flows, delivery and offline/reconnect.  
**P2:** Finish acceptance matrix for all 44 scoped items; security/privacy audit; backup-restore drill; performance; release candidate; documentation consistency.  
**P3:** Longer-term feature backlog: MFA/passkeys with safe key recovery, calling/WebRTC/TURN, file/media handling, voice, expiry/view limits, themes, widgets and improved deployment options—only after core reliability.

## 7. Safe commands and deployment workflow

**Pi checkout/version:**
```bash
cd ~/Locat
git status --short
git branch --show-current
git log -1 --format='%h %s'
git fetch origin
git pull --ff-only origin feat/locat-1.0
```

**Backup before migration/deployment (validate file permissions and dump success):**
```bash
mkdir -p ~/locat-backups
chmod 700 ~/locat-backups
sudo mariadb-dump --single-transaction locat > ~/locat-backups/locat-before-upgrade.sql
test -s ~/locat-backups/locat-before-upgrade.sql
tail -n 5 ~/locat-backups/locat-before-upgrade.sql
```
Use a unique dated filename in practice to avoid overwriting prior backups. Protect SQL dumps: they include private account metadata. Also back up `/opt/locat/.env` securely, without pasting it into chat.

**Pi deploy after validated backup:**
```bash
cd ~/Locat
sudo bash scripts/install-pi.sh
sudo systemctl is-active locat
curl -f http://127.0.0.1:3000/api/ready
sudo journalctl -u locat -n 50 --no-pager
```
Installer stages build, preserves existing `.env` and MariaDB, swaps deployment and restarts service; do not interrupt unnecessarily. `/opt/locat` permissions are intentionally restrictive.

**Android in-place upgrade:**
```powershell
cd C:\platform-tools
.\adb.exe devices
.\adb.exe install -r ".\ACTUAL_APK_FILENAME.apk"
```
Only use a **same-signing-key** APK. Never uninstall, clear app storage or rotate keys casually. Confirm APK workflow success and server compatibility first.

**Checks:** `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run doctor`. Database integration tests **must use a disposable `_test` database**; never point tests at production MariaDB.

## 8. GitHub and source-of-truth links

- Repository: https://github.com/ibrahim1101/Locat
- Branch: https://github.com/ibrahim1101/Locat/tree/feat/locat-1.0
- Acceptance/backlog: [LOCAT-1.0-PLAN.md](LOCAT-1.0-PLAN.md)
- Installation: [INSTALLATION.md](INSTALLATION.md)
- Pi hosting: [RASPBERRY_PI.md](RASPBERRY_PI.md)
- Groups: [GROUPS.md](GROUPS.md)
- Message controls: [MESSAGE-CONTROLS.md](MESSAGE-CONTROLS.md)
- Notifications: [NOTIFICATIONS.md](NOTIFICATIONS.md)
- Android APK CI: https://github.com/ibrahim1101/Locat/actions/workflows/android-apk.yml
- Relevant commits: `96afd3c` (no-reload stability), `28fcd51` (presence heartbeat fallback).
- Historical CI run: https://github.com/ibrahim1101/Locat/actions/runs/37767599860

**Note:** Existing `README.md` and `LOCAT-1.0-PLAN.md` contain some stale historical statements (e.g. “APK planned” after APK was built). Refresh them in a separate, reviewed documentation update. This journal describes observed progress, not an independently verified release manifest.

## 9. Editable running log template

Copy this section for each new milestone:

```markdown
### YYYY-MM-DD HH:MM IST — Short title
- Goal:
- Starting branch/commit:
- Files changed:
- GitHub commit / workflow run:
- What succeeded:
- What failed (exact error):
- Tests run (automated + physical):
- Data/backup/deployment impact:
- User acceptance (PASS / FAIL / NOT TESTED):
- Open follow-ups:
```

## 10. Copy-paste prompt to resume in a fresh chat

> Continue developing my self-hosted encrypted messaging app **Locat**. GitHub: `ibrahim1101/Locat`, branch `feat/locat-1.0`. First read **`docs/PROJECT-HISTORY-AND-HANDOFF.md`** and `docs/LOCAT-1.0-PLAN.md` from GitHub, and inspect the current source before edits. Our Raspberry Pi 5 runs `locat.service`, native MariaDB and Tailscale HTTPS; Android uses a permanently signed Capacitor APK. We fixed a repeated CONNECTING reload loop and verified an in-place APK upgrade preserves history. Messaging works on PC Firefox and Android, but **Android presence is still not reported online**. Firefox account `test0` is ID 3, `auth.me.presenceVisibility=everyone`, and `messages.presence` repeatedly returns only `online:[3]` with both devices open. Android has the latest APK, Pi deployed commit `28fcd51`. Next diagnose Android HTTP presence heartbeat via `.\adb.exe logcat` and/or safe instrumentation; do not break messaging, uninstall APK, clear browser data or reset accounts. Keep a distinction between implemented, CI-tested and device-accepted. Update this history document after substantive work.

---
*This file is intentionally Markdown so it can be edited directly in GitHub, VS Code or any text editor. Never paste private keys, passwords, session tokens, production SQL dumps or signing secrets into it.*
