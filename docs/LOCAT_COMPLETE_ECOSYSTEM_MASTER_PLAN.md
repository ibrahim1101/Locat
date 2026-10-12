# Locat complete ecosystem — canonical recovery and execution plan

Recovered 2026-10-11. Baseline `feat/locat-unified-platforms` at `b849774`, application revision `af63b2c`. This document reconciles historical approved scope with the Complete Ecosystem Mission attached on 2026-10-11. It does not declare all features shipped. The evidence and acceptance register is [LOCAT_COMPLETE_FEATURE_MATRIX.md](LOCAT_COMPLETE_FEATURE_MATRIX.md).

## Product identity and boundaries

One Locat account, shared React/Vite client, Hono/tRPC/MariaDB/Drizzle backend, Capacitor Android and Tauri 2 desktop shells. Cinema, Music, Remote, Sentinel and Link are sections of Locat. Native clients connect to a separately self-hosted backend; they do not bundle a mandatory local database. Preserve client-side message cryptography, compatible existing encrypted archives and additive migrations.

Approved design: Obsidian Ember, matte black/graphite, restrained titanium surfaces and burnt-orange accents. Preserve `public/locat-official-logo.png`, approved git blob `c465d010524032e1ec9f37b1e9b1c2722c7237cc`, existing user preferences, keyboard accessibility, safe areas and reduced motion. No generic blue replacement or unrelated parallel application.

Dedicated development work may be committed/pushed and a draft PR prepared. Do not merge main, replace the original installed Android app, delete user data, modify the user's Windows machine, access unapproved credentials, incur costs or deploy/migrate the live Raspberry Pi. Test tools may be installed within the isolated environment as authorized in the current mission. Do not schedule background development without separate request.

## Historical recovery findings

1. `docs/LOCAT-1.0-PLAN.md` recovers all original IDs **01–49**. Original 01–41 are in Backlog; 42–43 are in Approved scope additions; 44 is in Beginner documentation and Android addition; 45–49 are attachment/location additions. The top list's apparent 42–44 gap is an ordering artifact, not missing requirements. The earliest plan commit is `c73b023`.
2. `docs/LOCAT_2_0_JOURNEY_AND_HANDOFF.md` and `docs/FEATURE_MATRIX.md` establish **M0–M11**. The historical phrase “13-module” does not enumerate 13 modules. `git log --all -G 'M12|M13|13-module|13 modules' -- '*.md'` locates that phrase's introduction in `e32f848`/`49a51d1`; no historical M12 or M13 identity was recovered in the fetched refs and Markdown history. M0–M11 is 12 identities, while M0–M13 would be 14; retain this historical numbering/count ambiguity instead of inventing names. Cinema/Music/Remote are mandatory unnumbered integrations under the current mission.
3. The original ledger assigns device acceptance to **01,03,06,07,17,41**. `docs/PROJECT-HISTORY-AND-HANDOFF.md` preserves a later **13/44** conversational progress counter but expressly calls it an unaudited per-item ledger. Do not guess seven additional accepted IDs. The same history independently confirms an older signed Android upgrade and cross-account Android/Firefox messages, while Android presence remained unresolved.
4. Historical app-lock/WebAuthn and plaintext draft risk notes are superseded by later code: biometrics fail closed; baseline composer drafts are account-scoped ephemeral memory and legacy persistent drafts are purged. Current source adds identity-derived AES-GCM durable drafts; current verification remains separate from baseline. App lock remains a client-controlled UI barrier; draft protection does not encrypt all durable messaging data or provide native hardware key protection.
5. `origin/feat/locat-media-hub:memory/PRD.md` and `docs/INTEGRATION.md` recover substantial media scope (metadata/artwork, series/next episode, technical/HDR information, real host telemetry, advanced audio). Its FastAPI/CRA development host and mock adapters are not shipping Locat. Packages were preserved for feature-level ports; presence on disk is not runtime integration. The native audio bridge remains a scaffold and bit-perfect verification remains unavailable.

No complete public GitHub PR/issue archival export is asserted here. Root execution may add newly retrieved authoritative issue/PR requirements. This recovery covers the fetched repository refs, accessible docs, relevant history searches, baseline integration records, code and current attached mission.

## Branch audit at fetched snapshot

Ancestry is checked with `git merge-base --is-ancestor <ref> b849774`; counts below are `git rev-list --left-right --count b849774...<ref>`. Divergence does not mean features were omitted: security/remote commits may have been cherry-picked.

| Branch | Head | Baseline ancestry | Baseline-only / branch-only commits | Integration evidence / decision |
|---|---|---|---|---|
| main | e2e21df | Divergent | 658 / 1 | Old landing snapshot; not current application base |
| fix/locat-install-mobile-foundation | e16e924 | Inherited | 652 / 0 | Foundation retained |
| feat/locat-1.0 | 3b324ef | Inherited | 169 / 0 | Original messaging/account/privacy/Android scope retained |
| feat/locat-2.0 | 30fcd93 | Inherited | 147 / 0 | M0 redesign, Sentinel and Link retained |
| chore/locat-2.0-stabilization-handoff | 60170ca | Inherited | 141 / 0 | Security findings and handoff retained |
| fix/locat-2.0-app-lock-biometric-guard | aa06bf4 | Inherited | 7 / 0 | Fail-closed biometrics, private drafts and native-download truth retained |
| feat/locat-music-equalizer | 5906713 | Inherited | 4 / 0 | Unified base; graphic EQ preserved |
| feat/locat-cinema-complete | 05b10c8 | Divergent | 7 / 1 | HLS audit record integrated; ancestor code already present; performance acceptance remains open |
| chore/locat-2.0-quality | a32f831 | Divergent | 169 / 4 | Crypto regression selected; no old-tree replacement |
| fix/locat-link-security-review | 52e11d2 | Divergent | 164 / 8 | Sentinel bounded request/read tests selected; full Link security remains open |
| feat/locat-media-hub | 62cd389 | Divergent | 660 / 6 | Reusable packages preserved; demo host/auth/sample media excluded; advanced features require ports |
| feat/locat-remote-prototype | 9409305 | Divergent | 658 / 4 | Remote additive commits 05a851a/953ce07/9409305 selected; separate approved host remains |
| feat/locat-unified-platforms | b849774 | Same baseline | 0 / 0 | Latest retrieved unified packaging/docs source |

See `docs/BRANCH_AUDIT_2026-10-11.md` and `docs/UNIFIED_ENGINEERING_HISTORY.md` for original integration decisions. Re-fetch and compare changed refs before later integration; this snapshot is not automatic branch synchronization.

## Confirmed milestones and dependency order

| Internal phase | Deliverable | Required acceptance gate |
|---|---|---|
| A Historical recovery | This plan and all-49 feature register; unresolved identities recorded | Every confirmed requirement has source, code/status, tests, device steps and remaining work |
| B Shared architecture | Dedicated branch, one navigation/identity/theme, compatible contracts/migrations | No security downgrade/old-tree replacement; auth/native transport regression |
| C M0 completion | Original 49 plus current mission messaging/calls/profile/security additions | Two-account direct/group E2EE, durable offline controls, authorization/recovery and each item's device acceptance |
| D Existing integrations | Sentinel/Link/Cinema/Music/Remote advanced features | Real-token incidents, real key possession/revocation, physical video/audio/input tests |
| E Confirmed ecosystem | M3 Vault, M4 Dashboard/Search, M5 Hub, M6 Secrets, M7 Calendar/Automate, M8 Share, M9 Workspace, M10 Extensions, M11 LAN | Client encryption and server permissions; no placeholder availability; module-specific acceptance |
| F Native clients | Preview APK, Windows NSIS, Linux DEB/AppImage, macOS APP/DMG; web retained | Real install/startup/storage/notifications/lifecycle and shared workflow parity |
| G Security/reliability | Complete threat model, integration/performance/permission regressions | E2EE/key recovery, revoked devices, safe files/paths, origin/TLS/CSRF, redaction, dependency review |
| H Reviewable release candidate | Current CI artifacts, Docker deployment instructions, draft PR and accurate readiness report | No unaudited production publish; signing/notarization/physical blockers disclosed |

These are engineering phases inside one product, not disconnected apps or promises of interim production releases.

## Immediate execution and acceptance boundaries

Current local source implements limited encrypted Vault/Secrets, explicit encrypted static location, durable encrypted drafts, Obsidian Ember defaults, practical EQ/presets/local queue, scoped Search/Dashboard and read-only admin Hub previews. Link uses session-bound device-key proof with actor/revocation enforcement and legacy-pair reproof. Combined checks passed 334 tests including 28 real database integrations, fresh canonical migrations, typecheck/build and Remote 47/47; lint has zero errors/12 warnings. Physical acceptance, actual browser signal measurements, Docker execution and current native packaging remain open. These previews do not constitute full module completion.

Prioritize the following next engineering gates:

- Preserve messaging delivery/recovery/group-key compatibility and validate newly added payload types across live encrypt/decrypt, localdb and archive import/export.
- Complete missing core protocols before UI-only claims: structural reply references, scheduling, expiry/timed deletion/view limits, reactions/pins/forwarding, account closure/MFA/passkeys and authenticated calls.
- Extend tested Link proof/actor/revocation enforcement with contextual ciphertext replay protection and multi-worker shared proof storage before asserting secure-device completeness.
- Port useful media engines into current Hono/account authorization rather than mounting mock FastAPI auth. Measure direct-play first; benchmark transcoding against actual hardware and make buffering/quality/duration state reliable. Preserve camera/microphone/location permissions and resource cleanup.
- Route local and server audio through the same measured EQ/DSP graph; implement practical band/filter controls and bounded headroom. Pure bypass cannot be labeled bit-perfect without a verified native output path.
- New modules must share current accounts, navigation, HTTPS/native transport and role/account authorization. Search must respect encryption boundaries; automation actions must be authorized and bounded; extensions require actual isolation.
- Native capabilities must report unavailable accurately. File-save completion means the native writer succeeded, not an anchor was clicked. UI lock and secure OS key storage are separate capabilities.

## Verification and evidence rules

Run TypeScript, lint, unit/cryptographic contract tests, database/API authorization/integration tests, Docker smoke and relevant native builds after each coherent change. Tests must check behavior and failure boundaries, not only source-string presence. Record exact commands, pass/skip counts, failures/fixes and revision. Skipped database tests are not database verification.

For all hardware-dependent behavior provide concrete test steps and disclose missing evidence: 4K decoding/transcoding throughput, codec compatibility, audio signal processing, native focus/background notification/calls, controller/input latency, headset/lock-screen controls, biometrics and release signing/notarization.

Baseline application `af63b2c` has verified desktop matrix `38157585088`, signed Android preview `38157585251`, core/MariaDB/Docker `38157587637`, and Remote `38157587589`. These are historical baseline builds, not artifacts for subsequent changes. Baseline local test record is 279 passed/26 database skipped and 47 Remote passed. No physical unified platform acceptance is reported.

Keep `docs/LOCAT_UNIFIED_ENGINEERING_HISTORY.md`, `docs/LOCAT_CROSS_PLATFORM_TESTING.md` and `docs/LOCAT_RELEASE_READINESS.md` aligned with fresh verification. Do not erase older failure/acceptance history; annotate superseded evidence. All 49 rows and module requirements stay open until their actual acceptance gates are met.

## Current publication and build limits

Root reports automatic approval review rejected push publication twice. No new remote branch/PR or current native CI artifacts have been produced; the blocked publication must not be bypassed. Source work and local verification continue within the isolated checkout. Cargo, Java and Docker are absent, and a Chromium download was corrupt, so fresh native builds, container execution and browser runtime acceptance have not been completed here. Updated workflow branch filters and Docker media packaging are source changes awaiting verification.

## Networking requirement added 2026-10-12

Every implemented and future feature must work between authorized devices on
the same network without Tailscale. Tailscale is the optional private route for
invited outside devices to the same Locat host/accounts/data. Preserve one
canonical HTTPS origin across both paths and existing feature authorization;
see [LAN and Tailscale](LAN_AND_TAILSCALE.md). This requirement does not mark
unimplemented features complete or physical network acceptance verified.
