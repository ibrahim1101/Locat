# Ecosystem preview downloads and testing

Development branch: `feat/locat-complete-ecosystem`. Review:
[draft PR #7](https://github.com/ibrahim1101/Locat/pull/7), stacked on the unified
preview. This is an incomplete test preview, not a production release.

Current packaged source **f7dd480** gives local Cinema, Music, Photos,
diagnostics and device protection their own pages. Local media adds bounded
queues, Music advancement/repeat and Cinema resume, speed, fit/fill,
fullscreen/PiP and WebVTT subtitles. Photos opens raster images and provides
crop/rotation/flips, color adjustments, brush/text annotations, undo/redo,
reset and export of a separate JPEG (1600 pixels/2.9 MB maximum).
Original files remain untouched. Device libraries now discover indexed Android
media after per-section permission, with original folder grouping, Music
album/artist groups, on-demand thumbnails, search and name/date/size/duration
sorting. Selected-photo/video grants are labeled accurately. Browser/desktop
use explicit directory selection. See [device libraries](DEVICE_MEDIA_LIBRARY.md)
and [login and sections](LOGIN_AND_SECTIONS.md).

Login-first entry, the post-login section dashboard, visible disabled
server/permission/planned options and bottom-left HTTPS server connection
remain included. **Use non-server mode** opens local tools without an
account; optional device passphrase protection is independent of the server.
Account/server features remain disabled in that mode. The user confirmed
the prior non-server Android preview opens and works; the new media/photo
controls still need physical acceptance.

Scheduled encrypted text/reply composition, exact recovery requests, LAN plus
optional private Tailscale access and native server/account storage isolation
remain included. Direct schedules bind encryption-key context at acceptance
and recheck it before release; changed identities, unbound legacy jobs and
disabled accounts fail closed. Update server/clients together and apply
migration 0016 through the normal isolated deployment workflow.

[Push core](https://github.com/ibrahim1101/Locat/actions/runs/38250585758) and
[PR core](https://github.com/ibrahim1101/Locat/actions/runs/38250592253) both
passed 404 tests across 71 files, real MariaDB/migrations/bootstrap,
Docker/media readiness and Chromium registration, offline section gates, local WAV/WebM decoding,
wrong/correct device passphrase and zero-account-RPC checks, separate pages,
queue advance, movie seek/resume, photo filter/flip/undo/drawing pixels,
rejected-image clearing and real JPEG download,
image pixels/JPEG export and audio checks, plus paged device-library bridge contracts,
permission states, original folders, Music albums, search/sorting and playback.
The Android workflow passed 14 JVM byte-range cases, including >4GB offsets. Signed Android and all three
desktop packaging jobs passed for the same source. Native
packaging results do not establish physical device acceptance.

## Find the actual installer

Open a successful matching workflow run, sign in to GitHub, and scroll below
the job list to **Artifacts**. Download and extract the artifact ZIP. Pick the
installer inside the ZIP, rather than the repository source ZIP.

| Platform | Workflow | Artifact | File inside |
|---|---|---|---|
| Windows | [Desktop run](https://github.com/ibrahim1101/Locat/actions/runs/38250585704) | [locat-windows-preview](https://github.com/ibrahim1101/Locat/actions/runs/38250585704/artifacts/11747104199) | NSIS `.exe` |
| Android | [Signed APK run](https://github.com/ibrahim1101/Locat/actions/runs/38250585769) | [locat-2-preview-apk](https://github.com/ibrahim1101/Locat/actions/runs/38250585769/artifacts/11747098707) | `locat-2-preview.apk`, checksum, build info and signing certificate |
| Linux | Desktop run | [locat-linux-preview](https://github.com/ibrahim1101/Locat/actions/runs/38250585704/artifacts/11746819332) | `.deb` / `.AppImage` |
| macOS | Desktop run | [locat-macos-preview](https://github.com/ibrahim1101/Locat/actions/runs/38250585704/artifacts/11747769414) | `.app` / `.dmg` |

Verified 2026-10-12: all four artifact records are unexpired and identify the
exact source SHA `f7dd4806b6c1fc71a0af10fc59a493447f859aef`.
The previews also include clipboard/lifecycle protection, bounded file buffering,
login-first section navigation, reactions, shared pins, reply references and explicit
forwarding. See [scheduled text](SCHEDULED_MESSAGES.md),
[native storage upgrade behavior](NATIVE_SERVER_STORAGE.md) and
[LAN plus Tailscale](LAN_AND_TAILSCALE.md).
Update every communicating client before using the
new message/control fields; older clients may reject them.
Read build info
for the packaged revision and Android version code.
Artifacts expire after 14 days. Sign in to GitHub if a direct artifact link
requires authentication. No device behavior or release signing is inferred
from these packaging results.

## Preserve existing installations

The APK uses `com.shaikibrahim.locat.preview` and a persistent preview key;
the original app ID is unchanged. Compare package, certificate and versionCode
before updating. Native chat data is now scoped to the actual server; old
unassigned native archives remain untouched and are not imported automatically.
Password-backed key restore may be required; legacy archive migration/export
remains open. `adb install -r` preserves compatible preview data; an
`INSTALL_FAILED_VERSION_DOWNGRADE` or certificate mismatch requires diagnosis,
not uninstalling the app or weakening signing. Desktop artifacts are unsigned
previews; release signing/notarization and native secure storage remain open.

For device testing follow [cross-platform acceptance](LOCAT_CROSS_PLATFORM_TESTING.md).
For isolated server setup use [installation](INSTALLATION.md), optional
[LAN HTTPS](LAN_DOCKER_PREVIEW.md), and `compose.media.yaml` for a read-only
media directory. LAN private-CA trust, Android WebView trust and Raspberry Pi
ARM64 physical deployment remain unverified. No production migration is implied.

Read the [feature matrix](LOCAT_COMPLETE_FEATURE_MATRIX.md),
[readiness gates](LOCAT_RELEASE_READINESS.md) and
[engineering evidence](LOCAT_UNIFIED_ENGINEERING_HISTORY.md) before testing.
