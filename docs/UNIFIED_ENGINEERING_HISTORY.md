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
