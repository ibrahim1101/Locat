# Locat complete ecosystem — release readiness

Updated 2026-10-11. **Not ready for a complete production release.** The canonical 49-item and ecosystem acceptance register is `docs/LOCAT_COMPLETE_FEATURE_MATRIX.md`. This document distinguishes historical build evidence from current source and physical acceptance.

## Revision and artifact evidence

| Evidence | Verified historical revision | Result / limitation |
|---|---|---|
| Unified application | `af63b2c`; docs-only follow-up `b849774` | Previous consolidated preview; later complete-ecosystem additions are not in those installers |
| Core/MariaDB/Docker CI | [38157587637](https://github.com/ibrahim1101/Locat/actions/runs/38157587637) | Passed as recorded by unified engineering history |
| Windows/Linux/macOS packaging | [38157585088](https://github.com/ibrahim1101/Locat/actions/runs/38157585088) | NSIS EXE, DEB/AppImage, APP/DMG built; unsigned previews; runtime unverified |
| Signed Android preview | [38157585251](https://github.com/ibrahim1101/Locat/actions/runs/38157585251) | Isolated preview package; persistent signing and signature verification; physical runtime unverified |
| Remote CI | [38157587589](https://github.com/ibrahim1101/Locat/actions/runs/38157587589) | Recorded passing; not physical host/game streaming acceptance |
| Baseline local checks | `af63b2c` | 279 passed/26 DB skipped; 47 Remote passed; typecheck/build; zero lint errors/12 warnings |
| Complete-ecosystem source | Current local dedicated development branch | 334 tests across 55 files passed, including 28 MariaDB tests; fresh canonical migrations passed; typecheck/build pass; lint zero errors/12 warnings; Remote 47/47; push rejected twice, no new remote branch/PR/current artifacts |

Earlier user reports accepted original numbered 01/03/06/07/17/41 and older Android messaging/upgrade. The later historical 13/44 counter is explicitly unaudited by item. None of this certifies current unified physical runtime or all 49 features.

## Current implemented increments (acceptance pending)

- Explicit encrypted location payload, manual/current-location dialog and safe map handoff.
- Durable identity-derived encrypted account/server/conversation drafts, with legacy plaintext cleanup.
- Obsidian Ember default/migration and practical graphic/parametric EQ, custom preset management, local music queue/shuffle/repeat/favorites.
- Limited client-encrypted Vault and Secrets previews using separate passphrase-wrapped keys (PBKDF2 600k), authenticated ciphertext storage, folder labels/device search, atomic quota/revision checks, bounded files, background/five-minute lock and encrypted same-store missing-ID backup restore.
- Read-only M5 Hub beta reuses authorized admin statistics; OS-reported RAM/uptime are shown, while CPU, media activity and alerts remain absent. M4 scoped Search/Dashboard are integrated previews.
- New-registration 15 Unicode-character policy restored per current assignment; legacy 8-character login remains supported, with the earlier f5d37d9 decision preserved in history.

These are limited implementations, not completion of their full module requirements. Final test evidence must be read from `docs/LOCAT_UNIFIED_ENGINEERING_HISTORY.md`. Data model/migration changes require fresh-database and upgrade/restore verification, not merely a TypeScript build.

## Production release gates

| Gate | Status | Required action |
|---|---|---|
| All historical requirements | Open | Account for all 49; implement missing calling/MFA/passkeys/closure/expiry/scheduling/view limits/nested refs/widgets/share integration and mission additions |
| Missing milestone history | Unresolved | M12/M13 identities not recovered; preserve uncertainty, do not invent |
| Messaging security/recovery | Partially tested baseline | Current payload/draft/archive/group/offline integration; cross-device regression and real restore drill |
| Link trust/revocation/replay | Partially tested preview | Session-bound private-key proof, actor checks, legacy-pair reproof and revoked-key alias/API regressions pass. Multi-worker shared proof state, contextual transfer ciphertext replay protection and genuine LAN discovery remain open |
| New encrypted stores | Preview only | Current crypto/API/migration/quota/concurrency tests; native save; same-account/module/origin empty-store restore now supported with original passphrase; per-record non-atomic retry-safe writes; no lost-passphrase recovery or different-origin/account migration |
| Ecosystem modules | Incomplete | Dashboard/search/admin-stat Hub have partial current source; Calendar/Automate/Share/Workspace/Extensions/LAN transport remain mostly planned |
| Cinema performance/completeness | Unverified physical; features partial | Real 4K direct-play/decoder/transcode benchmarks; quality timeline/buffer/seek; subtitles/tracks/series/history/artwork missing |
| Music quality/native lifecycle | Partial | Measure DSP local/server and headroom; gapless/native focus/background/headset/lock screen, album/artist metadata/playlists |
| Remote Play | Prototype | Actual Windows approval/input/capture; audio/controller/encoding/latency/reconnect and cross-platform host scope |
| Current source automated checks | Local checks pass; platform execution open | 334 unit/API tests incl 28 MariaDB integrations, fresh migrations, typecheck/build and Remote 47/47 pass; lint zero errors/12 warnings. Docker and real Chromium signal checks await executable environments |
| Current native packaging | Pending | Workflow filters updated in source; blocked publication prevents new CI. Verify exact-revision APK and OS artifacts after approved push |
| Native physical acceptance | Open on all targets | Run `docs/LOCAT_CROSS_PLATFORM_TESTING.md`; packaging is insufficient |
| Native credential security | Open | OS-backed secure storage and verified biometric assertion/hardware authentication; UI app lock is not local data encryption |
| Distribution trust | Preview only | Windows signing, macOS signing/notarization, signed updater feed; Android persistent preview key is separate from production identity |
| Deployment recovery | Open | Fresh/upgrade/restorable backups/rollback, Pi ARM/resource test and media mounts/tools; no live production migration authorized |
| Secret/dependency audit | Needs fresh verification | Runtime/development dependency advisories, redacted stream capabilities/logs, safe external content |

## Packaging and CI failure surfaces

- **Branch filters:** native preview workflows originally target unified/biometric branches. The actual complete-ecosystem development branch has now been added in local source; this update itself still needs publication/CI verification. A green core run does not create an installer.
- **Generated Android project:** CI installs an isolated Capacitor toolchain, generates Android and installs the SAF plugin with `scripts/install-android-storage-plugin.mjs`. Native project/plugin generation and package/version checks are release gates; a TypeScript bridge declaration is insufficient.
- **Signing secrets:** missing approved preview keystore/password/alias secrets fail closed. Never create a different signing key to force an update or read/change production credentials. Verify APK certificate/checksum/build-info and exact preview package. `INSTALL_FAILED_VERSION_DOWNGRADE` is not fixed by destructive uninstallation.
- **Toolchains/registries:** Linux WebKitGTK/C++/Rust packages and Java/Gradle/Android SDK need network availability; npm/image registries can rate-limit. Cargo absent or registry failures are environment failures until logs show a code error. Use trusted isolated tools; do not weaken checks.
- **Host media dependencies:** FFmpeg runtime installation and optional read-only `compose.media.yaml` have now been added in local source. Docker is unavailable locally, so the updated image/mounts are unexecuted. Bounded temporary HLS capacity and optional NVENC hardware/driver acceptance still require verification.
- **Native runtime differences:** WebView2/WebKitGTK/macOS runtime codecs, autoplay/CORS/HTTPS and WebRTC differ. Native media uses item-scoped capability tickets; reverse proxy query redaction and revoked-session tests remain essential.
- **Artifact retention:** preview uploads expire after 14 days. Missing artifacts require checking run/job/head/retention, not assuming the app failed or distributing an unrelated older file.

## Reviewable deliverables and authorization

Dedicated development source, canonical matrix, tests/history and a draft PR are reviewable deliverables. New installer/preview workflow links must be provided only once the exact application revision builds successfully. A complete release requires the gates above; disclose partial scope rather than relabeling preview availability as completion.

No main merge, public production release, paid service, original app replacement, live Pi deployment or production database migration is authorized by the current development assignment. Preserve those boundaries while preparing test artifacts and review.

## Actual session blockers

Automatic approval review rejected push publication twice. The rejection prevents remote branch/PR updates and current-revision GitHub packaging; it must not be worked around through another publication path. Root will request direct approval for the concrete blocked push after local work is reviewable.

Docker, Cargo and Java are absent in the current environment. Chromium download failed with corrupt archive content, so no browser runtime acceptance was completed. `npm run desktop:build` actually failed at Cargo metadata because Cargo was unavailable. Remote local tests passed 47/47; final root source/database results remain pending. No current container/native build success or physical platform performance is claimed.
