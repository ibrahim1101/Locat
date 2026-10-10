# Locat 2.0 — Fresh Workspace Handoff
Updated: 2026-10-10. Based on source review of feat/locat-2.0 at 30fcd931aaba1a298c348873c80e4bb3d09a5528.

## Startup
1. Import https://github.com/ibrahim1101/Locat, branch feat/locat-2.0 (or the subsequently reviewed integration branch).
2. Read docs/LOCAT_2_0_JOURNEY_AND_HANDOFF.md, docs/FEATURE_MATRIX.md, docs/SECURITY_MODEL.md, docs/PLATFORM_ROADMAP.md, docs/TESTING_STATUS.md, docs/ANDROID_LOCAL_HTTPS_PREVIEW.md.
3. Inspect actual code, current Git status, CI and draft PRs; do not infer completion from previous agents' messages.
4. Create a dedicated feature branch. Never push to main/stable or production, merge PRs, reset production data, or replace the original Android app.
5. Preserve React/Vite + Hono/tRPC + MariaDB/Drizzle + Capacitor Android, existing E2EE/auth compatibility, approved Obsidian Ember visual design and public/locat-official-logo.png.
6. Implement and test one scoped milestone at a time; commit atomically; document successes AND failures.

## Baseline implementation
- M0: mobile Home navigation, drafts, UI app lock, notification preferences, foreground toasts, web service-worker notification filters, image MIME sniffing and preview improvements.
- M1 Sentinel and M2 Link have existing UI and partial backend implementations; security and integration remain unverified.
- M3–M11 are roadmap, not shipped applications.
- Platform adapter for future Tauri 2 exists; no Windows/Linux/macOS desktop installers.
- Latest reviewed media work: b8d5773. Latest branch head: 30fcd93.

## High-priority blockers
1. App-lock security: localStorage passcode verifier and sessionStorage unlocked flag are not equivalent to OS-backed secure storage or encrypted local data. Review WebAuthn assertion verification, rate limiting, session scoping and recovery language. Do not market as encrypted device protection.
2. Draft plaintext: src/lib/draft.ts writes unsent message text to localStorage without encryption. Replace with reviewed secure storage design or explicit opt-in and clear limitations; prevent cross-account leakage.
3. Android downloads: src/lib/download.ts returns browser after a synthetic anchor click without proving a file was saved; native LocatStorage plugin was unavailable in user's preview APK. Implement/test a real Capacitor file-save path.
4. Android notifications: service-worker and in-app dispatcher are not proof of background native notifications. Implement and test platform-specific permission, registration, delivery and tap navigation.
5. End-to-end tests for push, app lock, media, E2EE, Sentinel and Link on real preview environment; review Link device possession/revocation and replay protections.
6. No GitHub Actions runs returned for feat/locat-2.0 during 2026-10-10 audit; run independent checks.

## Recommended next sprint
P0 security and compatibility tests, P0 native Android media/notification reliability, P0 device-lock and draft privacy hardening, P1 Link cryptographic hardening, P1 Sentinel authenticated integration, P2 M3 Vault. Stop before adding more placeholder modules.

## Local preview precautions
User's Windows checkout: C:\Users\ibrah\Locat-2-Preview, potentially uncommitted package.json, package-lock.json and android/ native project. Do not overwrite these. Separate Android preview app ID com.shaikibrahim.locat.preview; original com.shaikibrahim.locat. Isolated local MariaDB port 3307, HTTPS proxy localhost:8443 and adb reverse documented in Android runbook. These local artifacts may not be present in GitHub.

## Definition of done
For each change: source diff, tests executed with output, lint/typecheck/build result, platform verification (or explicit unverified), risk notes, commit SHA, documentation update. No claim of production readiness from unit tests alone.
