# Locat complete ecosystem — cross-platform acceptance

Updated 2026-10-11. This runbook covers the current complete-ecosystem development source. Current-session test/build results are recorded in `docs/LOCAT_UNIFIED_ENGINEERING_HISTORY.md`; unrecorded results below remain pending. No physical device testing is inferred from automated tests.

## Identify the exact build first

Historical unified application revision `af63b2c` was packaged successfully. Documentation follow-up `b849774` leaves that application tree unchanged. These artifacts contain the earlier unified preview, **not** later complete-ecosystem source changes:

| Target | Verified historical workflow | Artifact / output |
|---|---|---|
| Windows | [38157585088](https://github.com/ibrahim1101/Locat/actions/runs/38157585088) | `locat-windows-preview`; NSIS EXE |
| Linux | Same desktop workflow | `locat-linux-preview`; DEB/AppImage |
| macOS | Same desktop workflow | `locat-macos-preview`; APP/DMG for runner architecture |
| Android | [38157585251](https://github.com/ibrahim1101/Locat/actions/runs/38157585251) | `locat-2-preview-apk`; persistent-key signed `locat-2-preview.apk` |

Artifacts have 14-day retention and require an available successful run/artifact. Compare run head commit and packaged metadata before installing. A draft PR does not distribute an APK by itself. Desktop previews are unsigned; macOS notarization, Windows signing and signed updates are not configured. Do not bypass OS trust protections.

Use separate preview application identities. Android `com.shaikibrahim.locat.preview` must remain separate from original `com.shaikibrahim.locat`; desktop identity is `com.shaikibrahim.locat.desktop.preview`. Never uninstall the original to solve a downgrade or signature mismatch. Preserve the user's existing keys/history and obtain separately authorized migration before changing original app data.

## Isolated test prerequisites

Use two or three disposable accounts and non-sensitive fixture data on an isolated HTTPS Locat backend. Native clients require a trusted certificate, a healthy `/api/health`, the exact allowed client origin and current session transport. MariaDB belongs on the host, not each client. HTTP or invalid certificates must be rejected; use the debug-only trusted preview certificate runbook if testing emulator loopback.

For hosted media, install/verify FFmpeg and FFprobe on the backend, configure explicitly authorized folders and check that the backend process can read them. Docker media tools and mounts must be present in the tested image/configuration; a host installation alone does not install tools inside a container. Use known-good H.264/AAC MP4, remuxable MKV, unsupported video, corrupt media, a 4K remux and a FLAC track. Record source codecs/frame rate/bitrate, host CPU/GPU/encoder and client runtime/device.

## Automated verification before installation

| Layer | Required checks | Evidence limitation |
|---|---|---|
| Shared source | `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run build` | Source-string or mocked-adapter tests do not establish native behavior |
| Database | Fresh disposable MariaDB; setup twice, original-schema upgrade, integration tests and backup/restore | Without TEST_DATABASE_URL, skipped DB cases are not verified |
| Native desktop | `npm run desktop:build` on Windows/Linux/macOS or successful current-revision OS matrix | Packaging proves compilation, not UI/media/device behavior |
| Android | Capacitor web build/sync, installed storage plugin, isolated package check, Gradle release build, persistent-key signing verification | Signing needs approved CI secrets; generated native project must include actual plugin implementation |
| Remote | Python session/capture/HTTP/input permission tests and allowed-origin preflight | Mocked capture/input cannot establish Windows hardware/runtime functionality |
| Media | Authorized root/path/range/ticket/probe/remux tests, measured audio DSP; FFmpeg process lifecycle | Actual HLS throughput, codec output, GPU availability and physical 4K decode remain separate |

Native workflow branch filters now include the actual development branch in local source; publication/CI verification remains pending. A push to a branch excluded by `.github/workflows/*preview.yml` will not build installers automatically. Workflow dispatch is an alternative when allowed and explicitly targeting the right revision. Registry/network/toolchain failures must be distinguished from application failures.

## Shared functional acceptance on every target

1. Launch without a configured server. Check local mode, coherent Obsidian Ember navigation, correct logo, loading/error/empty states, resize/orientation, keyboard focus, screen reader labels, reduced motion and safe areas.
2. Connect to trusted HTTPS server. Reject HTTP, credential/path/query/fragment origins, invalid certificates and malformed health responses. Test login/logout, disabled accounts, server switching, account isolation and expired sessions.
3. Exchange direct/group encrypted text, image, file, voice and location messages. Confirm recipient isolation, optional receipts, retry/ACK recovery, refresh/process restart, offline queue/reconnect and rotated group keys. Recover identity from encrypted backup using a disposable account.
4. Test edit/delete-for-all before and after original queue deletion; offline/out-of-order replay; stale archive merge; wrong author. Test hiding, blocking, contact request/removal, privacy visibility and retained old history. Deletion never guarantees external copy/backup/SSD erasure.
5. Save attachments through the actual native destination. Cancel a dialog, deny permissions and test invalid filename/MIME/size. Assert no false success and compare downloaded bytes. Existing general messaging file limit is 2.9 MB; the desktop save bridge's 128 MiB limit does not enlarge messaging limits.
6. Test passcode/autolock and switch accounts/servers. UI lock must not be described as device encryption. Native biometrics remain disabled until verified signed/hardware-backed integration; do not count a credentials prompt as cryptographic authentication.
7. Test quiet hours/mute/categories, foreground toast, permission denial, push account switching and real background delivery. Browser Web Push tests do not prove Android native push.

## New complete-ecosystem acceptance

### Explicit encrypted location (#48)

Open location sharing from a user action. Verify no geolocation call occurs before explicit request. Deny permission, time out, enter invalid/nonfinite/out-of-range coordinates and use valid manual/current position. Cancel without sending. Send through both direct and group chat; inspect transport/server metadata to confirm coordinates remain in the encrypted envelope. Reconnect offline recipient, export/import history, hide/delete and ensure precise coordinates never appear in notification logs. Open a map only from an explicit action and acknowledge that the external map provider receives the coordinates at that handoff.

### Encrypted durable drafts

Type, change conversation and return; reload/restart after encryption completes. Verify plaintext is absent from persistent draft records. Change user/server/conversation and identity; wrong scope/key and tampered records must fail decryption. Empty/send clears the draft; a newer edit must not be overwritten by an older pending write. Check legacy plaintext cleanup and denied/failed IndexedDB feedback. Draft encryption depends on current messaging identity; it does not imply all local history/key storage is hardware protected.

### Vault and Secrets limited previews

Create a store using a separate strong passphrase; confirm names, folder labels, file/credential contents and master key never upload in plaintext. Log out, return and unlock; wrong passphrase/server/account/module/object or tampered ciphertext must fail. Test Vault safe file save and Secrets generator/note/edit. Search is on decrypted device data. Hide/background and five-minute idle must lock, clear decrypted UI state and stop in-flight plaintext restoration; refresh after concurrent edits must preserve revision conflicts.

Verify 2 MiB per-file limit, 128 entries and 64 MiB serialized-ciphertext quota; simultaneous writes may not overrun quota. Export encrypted backup, then restore **missing IDs into the same unlocked store**, or from the locked screen initialize an empty store using the original backup/passphrase. The account ID, exact server origin and module must match. Every record must authenticate and quota preflight must pass before the first write; existing entries must be preserved and mismatched/tampered/duplicate backups rejected. Restore is per-record, not atomic; inject a network/conflict failure midway and retry safely. This does not support different-account/origin migration or forgotten-passphrase recovery. Test authorized deletion without promising backup/forensic erasure. Native secure storage/biometric unlock, sharing, large files and richer folder operations remain incomplete.

### Music EQ, presets and local queue

Use local and server-hosted source separately. Test graphic 5/10/15/31 bands; parametric peaking/shelves/high-pass/low-pass; bounded frequency/gain/Q and filter-point limits; reset and Pure bypass. Compare actual output response with a known test signal or listening test; use boost/preamp/headroom and check peak/clipping behavior. Pure bypass is not verified bit-perfect. Save/rename/delete/reload custom presets, malformed persistent settings and storage-denied feedback.

Load several local files. Test queue selection, previous/next, end-of-track advance, shuffle avoiding immediate repeats, repeat-one and repeat-queue, favorites/reload and object URL cleanup on source change/close. Local file handles must be reselected after process restart; queue/favorites do not imply cloud playlists or hosted queue support. Test format decode, pause/resume, Android background/headset/audio focus and lock-screen controls separately; those native capabilities remain unverified.

## Read-only Hub and scoped dashboard/search acceptance

As an administrator, open Hub and compare user/session/queue/database statistics with an isolated test database. Sign in as a nonadministrator: the card/route must not grant access and direct API calls must return permission denial. Refresh/lose the server and verify honest error/loading states. CPU/RAM/host agent/transcoding alerts/update and backup monitoring are not part of this limited stats view.

Search only permitted local decrypted messages and authorized module metadata. Test hidden chats/messages, locked private stores, account/server switching, blocked/noncontact profiles and another account's Sentinel/Link objects. Dashboard counts/recent items must come from real scoped data rather than fabricated fixtures; unavailable modules stay honestly planned.

## Cinema physical performance acceptance

1. Play compatible 4K original through direct HTTP streaming. Confirm no FFmpeg process starts unnecessarily. Record startup seconds, actual render FPS, buffer/stalls, seek responsiveness and sustained network throughput.
2. Play container-only-incompatible MKV via stream-copy remux. Confirm unchanged codec/content quality and process cancellation. Remux is progressive and does not promise arbitrary seek/Range.
3. For unsupported codecs use experimental HLS at 1080p and 4K. Record FFmpeg `fps`/`speed` and CPU/GPU load. Software CPU encoding may be slower than realtime; optional NVENC must be verified against available hardware/driver.
4. Switch 4K →1080p →4K while playing and paused. Verify elapsed/total duration, pause/volume state and actual position continuity; quantify switch delay. Watch beyond initial four seconds for startup stalls and test repeated seeks/reconnect.
5. Start enough simultaneous sessions to exercise capacity/eviction, release/unmount, idle/runtime cleanup and disk usage. Do not describe the current event-playlist transport as full adaptive master-playlist HLS.
6. Test stream tickets after logout, disable/revoke/session expiry and wrong item/account. Redact capability query parameters in reverse-proxy logs.

Subtitles/audio-track selection, series/artwork/history/continue-watching/playlists remain incomplete and need separate acceptance once ported.

## Remote and platform-specific acceptance

Remote host is a separate manually launched approved service. Use private HTTPS, exact permitted client origin and explicit host approval. Reject unknown origins/unapproved input. Verify view-only state, revoke while connected, immediate input stop, disconnect/cleanup, capture bounds and reconnect. Windows native input/capture is the initial scope; Linux/macOS host input/capture and Remote Play audio/controller/hardware encoding are not complete. Record actual negotiated codec/FPS/RTT and Android touch behavior.

| Platform | Additional physical checks |
|---|---|
| Windows | WebView2 installed; native save/notification/opener; window resize and startup/shutdown; separate preview identity; no hidden backend/database requirement |
| Android | Trusted HTTPS onboarding, emulator then physical device; SAF cancel/write/reopen grants; safe areas/back/orientation/keyboard; process death/network/background/audio lifecycle; preserve original package/data |
| Linux | WebKitGTK prerequisites, DEB and AppImage install/runtime, notification/save permissions and desktop integration |
| macOS | Architecture match, APP/DMG mount/install, Gatekeeper/signing status, native dialogs/permissions and media codecs |
| Web/PWA | Firefox/Chromium HTTPS, installed versus normal tab, push lifecycle, denied APIs, mobile attachment decode; share target supported only when actually implemented |

## Acceptance log template

For every result record date, commit, artifact checksum/run, platform/runtime/device, backend version, account fixtures, steps, expected/actual behavior, pass/fail, screenshots/logs with secrets redacted, and next issue. No unified native physical PASS has been recorded at this document's initial creation. Latest baseline packaging proves only compilation/signature output.

Current environment note: Cargo/Java/Docker are absent and Chromium download failed as corrupt. This session has not executed native/container/browser-runtime acceptance. Push automatic review rejected twice, so current-revision remote branch/PR/build artifact evidence is unavailable; historical links above remain baseline-only.
