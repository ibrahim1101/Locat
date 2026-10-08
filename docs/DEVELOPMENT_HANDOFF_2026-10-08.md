# Locat — Development handoff (2026-10-08)

This document is a living handoff for continuing Locat development in a new chat. Update it as implementation and testing progress.

## Project and environments

- Repository: https://github.com/ibrahim1101/Locat
- Working branch: `feat/locat-1.0`
- Locat: self-hosted encrypted messenger, React web app, Capacitor Android app, Node backend, MariaDB.
- Raspberry Pi deployment: `/opt/locat`, systemd service `locat.service`, HTTPS through Tailscale Serve at `https://ibrahimshaik-1.tail0abf6e.ts.net`.
- Raspberry Pi deployment preserves `.env` and DB; private configuration must never be committed or pasted into chats.
- Windows development machine: Android Studio Pixel emulator `emulator-5554`, ADB at `C:\platform-tools\adb.exe`; physical phone also appears in ADB, so always specify `-s emulator-5554`.
- Emulator has Tailscale installed and connected. Locat APK installed and user confirmed successful login.

## Confirmed achievements

1. Pi presence handling: heartbeat expiry and periodic sweeper introduced; user previously confirmed Android appeared offline within ~40 seconds. Recent faster timing adjustments have not yet been measured by user.
2. GitHub-to-Pi deployment script: `scripts/deploy-pi.sh`, documentation `docs/PI-GITHUB-DEPLOY.md`. User ran it successfully; build, doctor, service and health check passed.
3. Firefox background notifications: buttons disappeared because VAPID configuration was absent. User ran `npm run push:setup -- mailto:<owner-contact>`, restarted server, and confirmed Enable/Disable/Send test controls visible and notifications delivered. Never expose VAPID keys.
4. Accepted-friends search was added to the existing People/conversations dialog. User confirmed controls visible in Android emulator. A *dedicated* Friends tab is still planned.
5. Android emulator: user installed Android Studio emulator, ADB detected `emulator-5554`, installed signed Locat APK, and logged in after installing Tailscale inside emulator. Emulator initially had internet but could not resolve the private Tailscale hostname until Tailscale setup.
6. Automated emulator updater: `scripts/update-android-emulator.ps1` fetches latest successful `android-apk.yml` artifact (`locat-android-release`), verifies SHA256, and installs via `adb -s emulator-5554 install -r`. User confirmed latest updater worked after commit `1835fa90c67c4eec3c0c49e11e132f77507386d7`.

## Relevant GitHub changes

- `f658d8e`: Pi deployment script.
- `5550831`: Pi deployment documentation.
- `ac4bf2e`: accepted-friends search.
- `241fb60`: heartbeat expiry 12 seconds, sweep every 2 seconds.
- `64a68cb`: web presence refresh every 8 seconds; Android stays 3 seconds.
- `1deab59`: initial emulator updater.
- `10f4a49`: clear stale temporary artifact directory.
- `48092f0`: attempted JSON-array run selection fix; still broken.
- `1835fa9`: final fix, get scalar run ID directly with `gh --jq '.[0].databaseId'`; user reported success.

## Troubleshooting history and lessons

- GitHub CLI was initially missing; installed using `winget install --id GitHub.cli -e --source winget`, authenticated via `gh auth login`.
- APK download initially failed with `accepts at most 1 arg(s), received 10`. The PowerShell JSON pipeline unexpectedly passed all ten successful workflow IDs. The final solution requests a single scalar ID from `gh run list ... -L 1 --json databaseId --jq '.[0].databaseId'`.
- Direct `gh run download <run-id> -R ibrahim1101/Locat -n locat-android-release -D <directory>` succeeded, confirming permissions and artifact validity. Artifacts had not expired.
- Do not claim a GitHub commit was deployed until Pi deployment or emulator installation is confirmed. Android APK workflow is separate from Pi deployment.
- `npm ci` reported vulnerabilities during Pi deploy; investigate carefully, do not run blind forced dependency upgrades.

## Commands

Pi deployment:
```bash
curl -fL https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
```

Pi health:
```bash
cd /opt/locat
npm run doctor
systemctl status locat.service --no-pager
```

Windows: update emulator from GitHub:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" -OutFile "C:\platform-tools\update-locat.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\platform-tools\update-locat.ps1"
```

Manual install (only if needed):
```powershell
C:\platform-tools\adb.exe -s emulator-5554 install -r "C:\platform-tools\locat-release.apk"
```

## 2026-10-08 — In-app version footer

- Commit `aadf4ff`: added package-version display beside the chat sidebar connection status (`Locat · Connected · v0.1.0`). Reads `package.json` at build time, avoiding a hardcoded version string.
- GitHub write succeeded. Build, Raspberry Pi deployment, and Android emulator installation have **not yet been verified**.
- Limitation: package version is not a unique build identifier; future work should expose a short commit SHA or build ID for precise APK identification.

## Build identification (2026-10-08)

- `a3238df`: Vite injects `__LOCAT_BUILD_ID__` using `GITHUB_RUN_NUMBER` on GitHub Actions, otherwise the local short Git SHA (`local` fallback).
- `5569564`: chat footer displays `v<package version> · Build <build identifier>` beside connection status.
- Android release workflow already sets native Android `versionCode` from `github.run_number`; its web build receives the same run number.
- Pi deploy builds outside GitHub Actions and therefore displays a Git SHA instead of a numeric build number.
- Changes committed; CI success, Pi deployment and emulator testing are not yet confirmed.

## Friends tab milestone (2026-10-08)

- Commit `66e8d9a`: Added Friends as default tab in the People and Conversations dialog, separated accepted-contact search from server-wide People search, and added Profile action using the existing `FriendProfileDialog`. Chat and Remove actions remain available.
- GitHub write succeeded; CI/build, Pi deployment, and Android emulator behavior remain **unverified** until user tests.
- Test friend search, profile privacy, chat opening, request acceptance, and group creation for regressions. If nested profile dialogs misbehave on Android, revisit modal composition.

## Next priorities

1. Measure real offline detection latency after recent presence changes; check false offline/flicker while clients remain open, and distinguish normal close, background, and force-stop. Target ~12–20 seconds, not yet verified.
2. Build dedicated Friends tab/interface with accepted contacts, search, profile viewing and quick chat; preserve contact-request workflow and privacy controls.
3. Test Android notification permissions, push delivery, foreground/background behavior on emulator; confirm real-phone behavior separately.
4. Improve Android storage/backup export destinations and permissions UI; plan zero-knowledge encrypted backup vault and MFA before implementing.
5. Maintain ongoing engineering history with failures, tests and outcomes; keep this handoff updated.

## New-chat kickoff

"Continue Locat development from `docs/DEVELOPMENT_HANDOFF_2026-10-08.md` in `ibrahim1101/Locat` branch `feat/locat-1.0`. Emulator updater works, Pi deployment works, Firefox push works, accepted-friends search visible. Start with dedicated Friends tab and verify faster presence timing. Make incremental GitHub commits and give exact Pi/emulator testing commands."


## Deployment and testing command reference (2026-10-08)

Keep this section updated whenever we introduce or change commands. These are the exact recurring commands supplied during the version-footer, build-ID, and Friends-tab milestones. They are user-run commands; do not mark deployment or testing successful without user confirmation.

### Raspberry Pi: fetch and run branch deployment

```bash
curl -fL \
  https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh \
  -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
```

### Raspberry Pi: post-deployment diagnostics

```bash
cd /opt/locat
npm run doctor
sudo systemctl status locat.service --no-pager
```

### Windows PowerShell: download and run Android emulator updater

Wait for the latest successful Android APK workflow before installing.

```powershell
Invoke-WebRequest \`
  -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" \`
  -OutFile "C:\\platform-tools\\update-locat.ps1"

powershell -NoProfile -ExecutionPolicy Bypass \`
  -File "C:\\platform-tools\\update-locat.ps1"
```

### Windows PowerShell: ADB commands from earlier emulator debugging

When PowerShell is already in `C:\\platform-tools`, invoke local binaries using `.\\` (plain `adb` is not found unless the directory is on PATH).

```powershell
cd C:\\platform-tools
.\\adb.exe devices
.\\adb.exe logcat -c
```

### Build identification

- Android GitHub Actions APK build: `GITHUB_RUN_NUMBER` is injected into the UI and used as native Android `versionCode`.
- Raspberry Pi build: UI shows short Git commit SHA because `GITHUB_RUN_NUMBER` is not set.
- Footer format: `Locat · Connected · v0.1.0 · Build <identifier>` (connection text varies).

### Documentation rule

For every future milestone, append exact Raspberry Pi, PowerShell, diagnostic, and testing commands used (including failed attempts and corrections), associated commits, observed results, and outstanding verification. Do not store tokens, passwords, keystores, or other secrets.


## User verification — Friends tab and build footer (2026-10-08)

- User confirmed the latest updates work after applying them, including the Friends tab workflows and visible version/build footer.
- Previously pending manual checks for these features are now recorded as **user-reported successful**. No independent automated test run is claimed.
- Continue with profile improvements, faster presence testing, and Android notification verification.
- Deployment and PowerShell commands remain recorded in the command reference above; preserve the exact commands for future milestones.


## Profile UX milestone (2026-10-08)

- Commit `349a8e7`: friend profile now offers Copy LC code and Retry after a profile-fetch failure; existing privacy-filtered profile query remains in place.
- Commit `0000684`: own-profile description now reflects user-configurable visibility; bio counter clarifies the 280-character limit.
- GitHub commits succeeded. Automated checks, Pi deployment, Android emulator behavior, and clipboard permissions **not yet independently verified**.
- Manual tests: open Friends > Profile, copy LC code, paste to verify; confirm privacy settings and bio count; simulate offline profile request and Retry after reconnecting.

### Apply this milestone — Raspberry Pi

```bash
curl -fL \
  https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh \
  -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
cd /opt/locat
npm run doctor
sudo systemctl status locat.service --no-pager
```

### Apply this milestone — Windows PowerShell / Android emulator

Wait for the APK GitHub Actions workflow to succeed before running:

```powershell
Invoke-WebRequest \`
  -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" \`
  -OutFile "C:\\platform-tools\\update-locat.ps1"
powershell -NoProfile -ExecutionPolicy Bypass \`
  -File "C:\\platform-tools\\update-locat.ps1"
```


## Android friend-profile Copy button discrepancy (2026-10-08)

- User reports the new friend-profile LC-code Copy button works in the PC browser but is missing in the Android APK. **Android test failed; browser test passed.**
- The source in `src/components/chat/FriendProfileDialog.tsx` includes the Copy button. The Android updater selects the most recent *successful* APK workflow run, which could be older than the source change if newer runs failed or are pending.
- Diagnosis pending: compare Android footer build number with GitHub Actions run number, verify latest workflow conclusion, then inspect whether Android opens the same friend profile dialog. Do not claim the issue fixed until verified.

### Diagnostic commands — Windows PowerShell

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 8
& "C:\\platform-tools\\adb.exe" -s emulator-5554 shell dumpsys package com.locat.app | Select-String "versionCode|versionName"
```

If package ID differs from `com.locat.app`, use `& "C:\\platform-tools\\adb.exe" -s emulator-5554 shell pm list packages | Select-String locat` first. Check build workflow success before rerunning the existing updater; never uninstall the app just to fix a version mismatch.


## Android Copy button resolution and presence tuning (2026-10-08)

- User confirmed the friend-profile Copy button now works in Android after installing the latest successful APK. PC browser already passed. Earlier Android absence was observed with build 59; the exact installed replacement build number was not recorded.
- GitHub Android workflow run `37811925589` failed for the original Copy-button commit, but subsequent workflow `37811936253` succeeded and included the feature. Do not claim the specific failed-run cause was diagnosed.
- Commit `7c51730`: reduced browser presence refresh interval from 8 seconds to 4 seconds. Android stays at 3 seconds; server heartbeat expiry and sweep remain unchanged. This is a responsiveness experiment, not yet a measured success.
- Test with two accounts: keep one account visible in PC browser and one in Android; close/reopen Android; time online/offline indicator changes. Note background behavior and browser load; rollback polling if server load or battery impact is unacceptable.

### Raspberry Pi deploy and diagnostics

```bash
curl -fL \
  https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh \
  -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
cd /opt/locat
npm run doctor
sudo systemctl status locat.service --no-pager
```

### Windows PowerShell Android updater and workflow check

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 8
Invoke-WebRequest \`
  -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" \`
  -OutFile "C:\\platform-tools\\update-locat.ps1"
powershell -NoProfile -ExecutionPolicy Bypass \`
  -File "C:\\platform-tools\\update-locat.ps1"
```

- Only install after a successful workflow containing the target commit. The updater selects the latest *successful* APK, which can lag behind failed/pending commits.


## Presence test results — user verified (2026-10-08)

After the browser presence refresh change in commit `7c51730`, the user reported **PASS** on all five manual checks:

1. Both accounts show online while connected.
2. Closing/disconnecting Android eventually shows offline on PC.
3. Reopening Android changes status back to online.
4. Messages continue arriving correctly.
5. No noticeable lag or excessive battery use.

Result: **5/5 user-reported PASS**. Exact online/offline transition latency was not measured; do not claim a specific number of seconds. No independent automated test is claimed. Next milestone: Android notification testing (foreground, background, closed app, and permission behavior). This is documentation-only and requires no redeployment.


## Android notification verification milestone (2026-10-08)

### Architecture review

- Existing `src/components/chat/Notifications.tsx` uses browser `Notification`, `PushManager`, and service workers. `api/push.ts` sends privacy-preserving generic Web Push notifications using VAPID, when configured.
- A Capacitor Android WebView does **not** automatically inherit full native FCM background push capability from this browser Web Push code. Treat standalone APK background/terminated notifications as **unverified**; do not promise delivery.
- `docs/NOTIFICATIONS.md` describes supported HTTPS browser/PWA behavior and Pi VAPID setup. The user's Android APK must be tested separately.
- Never regenerate existing VAPID keys unless intentionally rotating them; check `npm run doctor` first. Do not commit private keys or endpoints.

### Manual test matrix (pending)

1. On Pi, run `cd /opt/locat && npm run doctor` and check whether push is configured (no secret output).
2. On Android APK, open Locat settings and report the exact Background notifications message and whether Enable / Send test buttons are available.
3. If supported, grant notification permission and use Send test; record whether an OS notification appears.
4. Send a message to Android while foregrounded, backgrounded, and swiped away; record each result separately. Do not assume force-stopped app delivery.
5. Tap an alert, if delivered, and record whether it opens Locat/the right chat. Confirm no sender name/message text is exposed in previews.
6. In a supported HTTPS desktop/mobile browser, repeat the same tests to distinguish browser Web Push from native APK behavior.

### Raspberry Pi read-only diagnostics

```bash
cd /opt/locat
npm run doctor
sudo systemctl status locat.service --no-pager
```

### Windows PowerShell read-only APK diagnostics

```powershell
& "C:\\platform-tools\\adb.exe" -s emulator-5554 shell pm list packages | Select-String locat
& "C:\\platform-tools\\adb.exe" -s emulator-5554 shell dumpsys notification | Select-String -Pattern "locat" -Context 1,2
```

### Existing deployment commands (only after an actual code update)

```bash
curl -fL https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
```

```powershell
Invoke-WebRequest \`
  -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" \`
  -OutFile "C:\\platform-tools\\update-locat.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\platform-tools\\update-locat.ps1"
```

- Status: architecture inspected; tests and any native push implementation **not yet completed**. This commit is documentation-only, so no deployment is required.


## Android OS notification settings evidence (2026-10-08)

- User supplied Android system notification settings screenshot for Locat showing **“This app does not send notifications”**, with master notifications switch disabled. This is an observed **FAIL / unsupported current native notification capability**, not proof of a user-denied permission.
- Reviewed `capacitor.config.json` (`com.shaikibrahim.locat`), `package.json`, `.github/workflows/android-apk.yml`, `docs/ANDROID.md`, and browser push implementation. Current APK is generated by Capacitor Android shell and custom storage bridge; no native push registration or Android FCM implementation is shown in inspected files. Existing Web Push support is for supported HTTPS browsers/PWAs, not guaranteed for Capacitor WebView.
- Plan: implement native Android notification permission/channel and push token lifecycle; select secure FCM delivery integration for the self-hosted Pi, without exposing sender names, message bodies, encryption keys or session credentials to FCM. Validate foreground, background, swiped-away and tap routing separately. Firebase configuration and secure credentials may require user setup. Do not claim implementation complete.
- No code change or new APK in this milestone; deployment is not required. Existing read-only commands and deploy/update scripts are in the previous notification milestone.


## Firebase Android configuration checkpoint (2026-10-09)

- User created a Firebase project, downloaded `google-services.json` and confirmed GitHub Actions secret `LOCAT_FIREBASE_CONFIG_BASE64` added. Secret value was not shared.
- Initial PowerShell encoding attempt failed because `$env:USERPROFILE` was prefixed to an absolute `D:\\Projects\\Locat\\google-services.json` path. Corrected by using the absolute path directly, `[Convert]::ToBase64String([System.IO.File]::ReadAllBytes($file)) | Set-Clipboard`.
- Commit `ead43ce`: Android APK workflow decodes the secret into `android/app/google-services.json` after Capacitor sync, fails if secret is absent, validates JSON and exact Android package `com.shaikibrahim.locat`. The configuration is not committed to source control.
- **Not yet native FCM support**: Gradle Google Services plugin, Capacitor native push plugin, Android runtime permission/token registration, Pi FCM service-account credential and FCM sender integration are still required. Existing browser Web Push is separate.
- Workflow success **not yet verified**. The build step validates Firebase configuration only; do not claim Android notifications now work.

### Android workflow inspection — PowerShell

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 8
```

### Pi read-only check

```bash
cd /opt/locat
npm run doctor
```

- No Pi deployment needed for the workflow-only change. Android updater is not required until an APK with usable native notification features has successfully built.


## Firebase Android SDK Gradle integration (2026-10-09)

- Commit `f6b603e` modifies the generated Android Gradle project in CI after `google-services.json` is injected. It adds `com.google.gms:google-services:4.4.4` to root buildscript dependencies and applies `com.google.gms.google-services` to the app module.
- Purpose: have Gradle process the Firebase configuration for the matching `com.shaikibrahim.locat` application ID. No native FCM SDK/Capacitor push plugin, device registration, permission flow, or Pi FCM delivery implemented yet.
- Build status **unverified** until the new Android APK workflow completes. On failure, inspect logs and correct the generated Gradle structure rather than guessing.

### Windows PowerShell — workflow inspection

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 5
```

### Raspberry Pi — no deployment for CI-only Gradle change

```bash
cd /opt/locat
npm run doctor
```

- Do not reinstall the Android APK merely to test the Firebase SDK setup: notification support is not yet implemented. Preserve the user's app data.


## Firebase Android CI verification (2026-10-09)

- User provided `gh run list` showing **SUCCESS** for Firebase config injection run `37824807173` and Google Services Gradle integration run `37825264826`. This verifies the signed Android APK workflow completed, **not** that native push is operational.
- User ran `gh run view RUN_ID -R ibrahim1101/Locat --log-failed` literally and got HTTP 404; `RUN_ID` was a placeholder, not a workflow identifier. Correct command if needed: `gh run view 37825264826 -R ibrahim1101/Locat` (no failed logs needed for a successful run).
- Next implementation: native Android push SDK, runtime permission, FCM registration, backend token storage and secure sender. Existing browser push does not cover Capacitor native push.
- No Pi deployment required for CI-only changes. Do not assert background notifications work yet.


## Native Android Push SDK dependency milestone (2026-10-09)

- Commit `537e9b8` extends the isolated Capacitor 8 toolchain in `.github/workflows/android-apk.yml` with `@capacitor/push-notifications@8`, and symlinks it into the project's `node_modules/@capacitor` before `npx cap sync android`.
- Firebase configuration and Google Services Gradle plugin were already proven by successful Android workflows `37824807173` and `37825264826`.
- **Current push plugin workflow not yet verified.** Next inspect workflow result; if plugin discovery fails, fix build before introducing app-level notification logic.
- **Not yet implemented**: Android permission request and token listeners, authenticated Pi token registration/storage, FCM server sender, logout cleanup and device testing. Plugin installation does not imply notifications work.

### Windows PowerShell

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 5
```

### Raspberry Pi

```bash
cd /opt/locat
npm run doctor
```

- No Pi deployment needed for this Android workflow-only change. Avoid installing the APK until build is verified and app-side native notification flow is implemented.


## Capacitor push plugin dependency correction (2026-10-09)

- Inspected `.github/workflows/android-apk.yml` and found an invalid duplicate symlink: the entire `node_modules/@capacitor` namespace was already linked from the isolated toolchain, so separately linking `node_modules/@capacitor/push-notifications` would attempt to create a path that already exists.
- Commit `eb4e20a` removes only the redundant per-plugin symlink. Isolated installation of `@capacitor/push-notifications@8` remains.
- **Build verification pending**. Do not install an APK until this change passes. Android FCM registration/permission and Pi notification delivery are not yet implemented.

### Windows PowerShell

```powershell
gh run list -R ibrahim1101/Locat -w android-apk.yml -b feat/locat-1.0 -L 5
```

### Raspberry Pi

```bash
cd /opt/locat
npm run doctor
```

- No Pi deployment necessary for workflow-only fix.


## Quick Sign-In Key project started (2026-10-09)

- User approved full single-field Quick Sign-In Key with secure server-side verification and encrypted identity recovery.
- Reviewed `api/authRouter.ts`, `db/schema.ts`, `src/lib/crypto.ts`, `src/state/auth.tsx`, `src/providers/trpc.tsx`, `scripts/setup-db.mjs`. Existing login has 30-day session and password-encrypted identity backup; Android stores session token in WebView localStorage; existing one-active-session rule must be preserved.
- Commit `19a5e7b`: new `src/lib/quickSignIn.ts` containing 256-bit secret generation, domain-separated SHA-256 verifier, PBKDF2-SHA256 AES-GCM private-key wrapping/unwrapping. **Unreferenced library module only, not a functional login**.
- Commit `f212928`: `docs/QUICK_SIGN_IN_DESIGN.md` records threat model, release gates, UI/API/database work and verification plan.
- Pending: schema/bootstrap migration, server issuance/revocation and login, client UI, crypto/auth automated tests, GitHub CI, Pi and Android physical acceptance.
- No Pi or APK deployment needed yet; no claim of completed implementation. Existing login unaffected.


### Quick Sign-In crypto regression tests (2026-10-09)
- User reported Android `Failed to fetch` and then identified Tailscale offline in the emulator as the network cause; no app code fix required. Preserve device data.
- Commit `dafd877`: added `src/lib/quickSignIn.test.ts` testing random 256-bit key generation, verifier normalization, malformed inputs, encrypted ECDH identity restore, independent salt/nonce, wrong-key and ciphertext tamper rejection.
- Tests have **not yet been executed/verified**. Next: check CI or run `npm test -- src/lib/quickSignIn.test.ts` and `npm run check` on a checkout with dependencies. No Pi or APK deployment needed for tests-only commit.


### Dual sign-in design approved (2026-10-09)
- User approved both permanent **Recovery Key** and short-lived **Link Device** methods, with password fallback.
- `2a9199d`: expanded `docs/QUICK_SIGN_IN_DESIGN.md` with challenge-response requirement, short-code trusted-device approval, ephemeral authenticated encryption, and per-device session/message-delivery prerequisites.
- `3cf0203`: `src/lib/deviceLink.ts` adds client-only ephemeral P-256 ECDH, HKDF-SHA256 and AES-256-GCM identity transfer bound to request ID and public keys.
- `19f2848`: `src/lib/deviceLink.test.ts` adds intended-recipient recovery and rejection of wrong recipient, wrong request ID, ciphertext tampering and unsupported version.
- **Not executed/CI-verified**; no API, database, login UI or APK integration yet. Do not expose device linking to users until trusted-device approval, fingerprint confirmation, anti-replay, multi-device sessions and tests are complete.


### Link Device safety-code follow-up (2026-10-09)
- `1dcdae0`: `linkSafetyCode(requestId, senderPublicKey, recipientPublicKey)` produces a 40-bit human-readable SHA-256-derived comparison bound to the pending request and both ephemeral keys. It is only a comparison aid, **not** a replacement for authenticated approval or pairing authorization.
- `d0e8075`: regression tests verify deterministic comparison and changes on request or key changes.
- CI/tests not yet verified. Do not enable Link Device until backend approval, anti-replay, multi-device sessions and UI are completed.


### Passwordless schema bootstrap (2026-10-09)
- `c11fb98`: declared `recovery_credentials` and `device_link_requests` in Drizzle schema (no live auth endpoints).
- Prior attempt to edit setup-db was blocked; no schema bootstrap was changed then.
- `6fdc4cc`: added idempotent `CREATE TABLE IF NOT EXISTS` statements to `scripts/setup-db.mjs`, including user foreign keys, expiry and verifier indexes. Existing accounts/messages are not intentionally altered by these new statements.
- **Not verified** by CI, TypeScript check or a live MariaDB setup run. Next: validate `npm run check`, run `npm run db:setup` on a backed-up test installation, verify both tables, and build safe authentication protocols.


### GitHub-only validation (2026-10-09)
- User confirmed no local Locat checkout and requested GitHub-only development.
- Existing `.github/workflows/ci.yml` already ran `npm run check`, lint, all tests, build and Docker smoke tests on `feat/locat-1.0`.
- Commit `2c2aa95` explicitly adds Quick Sign-In and Link Device Vitest suites, runs MariaDB `npm run db:setup` twice to detect non-idempotent bootstrap, and verifies both passwordless tables exist.
- Workflow results are pending verification. Do not treat a pushed workflow as proof of passing tests; inspect Actions runs and fix failures before production deployment.


### Recovery credential management foundation (2026-10-09)
- Commit `4630405`: added authenticated `recoveryCredentialList` and `recoveryCredentialRevoke` procedures to `api/authRouter.ts`.
- List returns record IDs and creation timestamps only. Revocation requires a session, filters by account owner and active state, and is rate-limited.
- No recovery credential enrollment or passwordless login is enabled. This update has not been confirmed by CI at the time of writing.


### Recovery ownership regression guard (2026-10-09)
- `23852b0`: introduced shared active and revocable credential owner filters.
- `c4f271c`: applied shared filters to authenticated credential inventory and revocation endpoints.
- `a6454d1`: added SQL-compilation regression tests verifying owner, active-only and credential-ID conditions. These are query-shape tests, not end-to-end authorization tests against MariaDB.
- CI verification pending. Passwordless enrollment and login remain disabled.


### Recovery backup parsing hardening (2026-10-09)
- Verified CI run #302 succeeded for recovery credential ownership SQL tests.
- `2d6a343`: bounded encrypted backup and ciphertext sizes and checked envelope field types before PBKDF2/decryption to avoid oversized/malformed input processing.
- `303643f`: added regression tests for oversized and malformed envelopes.
- These are cryptographic input-hardening changes only; enrollment and passwordless authentication remain disabled. CI for these commits not yet verified.
