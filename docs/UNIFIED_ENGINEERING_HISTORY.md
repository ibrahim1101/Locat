# Unified Locat platform integration — 2026-10-11

Goal: consolidate existing feature branches without replacing newer security
with old prototype code; provide one shared React client in Android and native
Windows/Linux/macOS shells. Dedicated branch `feat/locat-unified-platforms`;
no merge/deploy or modification of other development branches.

Base: music branch 5906713 (latest core/security/Android base aa06bf4 plus
music EQ work). Merged Cinema audit 05b10c8 and retained inherited stabilization
handoff 60170ca. Cherry-picked crypto regression a32f831 and Sentinel bounded
request/read regressions ac40ca4/d51fc6b/8f3686e/0645cc8. Remote commits
05a851a/953ce07/9409305 are additive. All remote branches enumerated locally
and compared by ancestry and diffs; no AGENTS.md files were present.

The media-hub branch 62cd389 is a different FastAPI/CRA prototype. A whole-tree
merge would delete production auth, messaging, database and packaging source.
Reusable Python `packages/` engines and Remote planning documents are preserved
without mounting mock adapters. Prototype UI/server/sample media/test credentials
were deliberately excluded. Preservation is not runtime feature integration.
Planned Vault/Secrets/Workspace/etc remain planned, not dummy working modules.

Implementation: Tauri 2 Rust shell, user-consented Save dialog command (128 MiB
limit), native notification and HTTPS opener adapters, desktop hash routing,
exact native origins, bearer-aware native onboarding and server-change credential
cleanup. Desktop connects to the existing HTTPS backend; MariaDB is not bundled.
Added native media item-scoped tickets because HTML media elements cannot attach
bearer headers. Ticket requests revalidate the original session each time and
preserve root/path checks; they expire after 30 minutes idle and carry no account
session token in URLs. Proxy logs still need query redaction for these capabilities.

Remote now ships as a bundled client embedded in Locat, with explicitly allowed
client-origin CORS on the separate Remote host. Added honest runtime diagnostics
and reused the real graphic EQ in no-server native Local Mode. Remote host startup
remains manual; no unapproved software installation or personal desktop access.

Validation failures and fixes: first typecheck found an unsupported TS parameter
property and a capability condition that DOM types considered always defined;
fixed both. Four service-worker fixtures failed after Remote packaging introduced
an earlier writeFile; updated fixture extraction to identify the actual worker
write, retaining real worker execution. 273 tests then passed with 26 DB tests
skipped (no test MariaDB). Root lint: 0 errors, 12 existing warnings. Web and backend
build passed with existing large-bundle warnings; 45 Remote Python tests passed.
Added exact-origin tests to the Vitest include set for final verification.

Native limitation: local `npm run desktop:build` fails before compile because
Cargo/Rust is absent. A dedicated GitHub OS matrix builds NSIS Windows, DEB /
AppImage Linux and APP / DMG macOS previews; Android preview workflow includes
this branch and reuses persistent preview signing requirements. No release signing,
macOS notarization, secure OS key storage, tray, updater or physical device
acceptance is claimed. Chromium runtime remains blocked by the earlier rejected
installation. Final CI/artifact statuses must be inspected before distribution.


## CI follow-up

Published integration commit bd62b3d; draft PR #6. Core verification and Docker
smoke both passed in run 38157171738, including MariaDB-dependent tests. Android
run 38157171730 compiled successfully and signature verification passed, but
certificate metadata grep returned 1. Replaced the brittle exact-text grep with
full public certificate verification metadata output; signature verification
remains mandatory. No signing key or password was read or changed. Desktop
Windows/Linux/macOS builds were compiling at this observation.

Added explicit Remote cross-origin preflight/approval regressions: 47 Python
tests pass. Added preview download and platform acceptance runbook, clearer
native playback authorization states, and extension-aware local audio routing.

Added mocked desktop adapter tests for save consent command, cancellation, size
limits and unsafe URL rejection. Corrected desktop storage UI so it does not
offer Android folder selection. Desktop preview builds now queue instead of
cancelling an already-compiling native run, with Rust build caching for later
updates. These are native contracts, not physical desktop acceptance.


## Native artifact verification

Initial native run 38157171771 completed successfully for all three OS jobs.
Artifacts: Windows NSIS (11708931579), Linux DEB/AppImage (11709725619), macOS
APP/DMG (11709800089), all built from bd62b3d. These prove compilation and
packaging, not physical runtime acceptance. Final UI and Android metadata fixes
are published as 4761649 and af63b2c. Latest local suite: 279 passed, 26 DB tests
skipped locally; Remote: 47 passed. CI core/MariaDB/Docker already passed on the
initial consolidated revision. Latest revision builds are being inspected.

## Final preview validation

Revision af63b2c: desktop run 38157585088 completed successfully on Windows,
Linux and macOS. Android run 38157585251 completed successfully, including
signing verification; artifact locat-2-preview-apk (11708836809). Core PR run
38157587637 passed verification, MariaDB-dependent tests and Docker smoke.
Remote run 38157587589 passed. Local tests: 279 passed / 26 DB tests skipped;
47 Remote tests passed; typecheck and web/backend build passed; lint has zero
errors and 12 existing warnings. Documentation-only follow-up does not change
the tested application tree. Native compilation/package output is verified;
physical device acceptance, GPU/codec behavior and browser UI runtime remain
unverified. No production deployment or main merge occurred.


## 2026-10-12 — chat-first UI source restoration

After verifying that the unified preview's dashboard-first startup diverged from the original chat-first Locat, changed the root and fallback routes to Chat. The old /messages route remains valid, while the module dashboard now lives at /dashboard. Reordered primary navigation, made the optional launcher explicitly “Modules” on mobile, and corrected media back navigation and shell labeling. Added contracts/chat-first-navigation.test.ts to guard routes, module order, and mobile labeling. No authentication, encryption, server, database, or native package logic was changed in this increment.

Prior CI for 6973fcc passed Locat and Remote workflows (38184647061 and 38184647019). New source and regression tests require CI verification; native builds and physical Windows/Android acceptance are not yet verified. No claim of full feature parity or release readiness.


### 2026-10-12 — chat-first CI fixes

Commit 9f787c1 restored messaging as the default screen. CI run 38188780570 failed TypeScript TS6142 because a test under contracts imported TSX without JSX support; commit 728d1d7 moved it under src/modules. Run 38188914206 then failed an older navigation test expecting the obsolete Home label; commit ac49ee7 updated the assertion to Modules. Runs 38189030205 (Locat verification and Docker smoke) and 38189030259 (Remote) passed. Commit 70fd382 now runs the five mocked LAN readiness tests through npm test; its CI is pending verification. No physical Windows, Android or Pi 5 acceptance is claimed.
