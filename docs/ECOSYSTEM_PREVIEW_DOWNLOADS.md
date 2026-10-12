# Ecosystem preview downloads and testing

Development branch: `feat/locat-complete-ecosystem`. Review:
[draft PR #7](https://github.com/ibrahim1101/Locat/pull/7), stacked on the unified
preview. This is an incomplete test preview, not a production release.

Current packaged source **5bb2eca** adds login-first unauthenticated entry,
the section dashboard after authentication, visible disabled server/permission/
planned options, and a bottom-left HTTPS server-address control. It also adds
picture attachment crop, zoom, position, rotation, preview and original/edited
send. Login now also offers **Use non-server mode** for local Cinema,
Music/EQ and diagnostics without a server account, plus optional device-local
passphrase protection. Account/server features stay disabled in this mode.
See [login and sections](LOGIN_AND_SECTIONS.md).

Scheduled encrypted text/reply composition, exact recovery requests, LAN plus
optional private Tailscale access and native server/account storage isolation
remain included. Direct schedules bind encryption-key context at acceptance
and recheck it before release; changed identities, unbound legacy jobs and
disabled accounts fail closed. Update server/clients together and apply
migration 0016 through the normal isolated deployment workflow.

Both [PR core](https://github.com/ibrahim1101/Locat/actions/runs/38225758881)
and [push core](https://github.com/ibrahim1101/Locat/actions/runs/38225753217)
passed 392 tests across 68 files, real MariaDB/migrations/bootstrap,
Docker/media readiness and Chromium registration, offline section gates, local WAV/WebM decoding,
wrong/correct device passphrase and zero-account-RPC checks,
image pixels/JPEG export and audio checks. Signed Android and all three
desktop packaging jobs passed for the same source. Native
packaging results do not establish physical device acceptance.

## Find the actual installer

Open a successful matching workflow run, sign in to GitHub, and scroll below
the job list to **Artifacts**. Download and extract the artifact ZIP. Pick the
installer inside the ZIP, rather than the repository source ZIP.

| Platform | Workflow | Artifact | File inside |
|---|---|---|---|
| Windows | [Desktop run](https://github.com/ibrahim1101/Locat/actions/runs/38225753347) | [locat-windows-preview](https://github.com/ibrahim1101/Locat/actions/runs/38225753347/artifacts/11736387768) | NSIS `.exe` |
| Android | [Signed APK run](https://github.com/ibrahim1101/Locat/actions/runs/38225753224) | [locat-2-preview-apk](https://github.com/ibrahim1101/Locat/actions/runs/38225753224/artifacts/11737006538) | `locat-2-preview.apk`, checksum, build info and signing certificate |
| Linux | Desktop run | [locat-linux-preview](https://github.com/ibrahim1101/Locat/actions/runs/38225753347/artifacts/11736472627) | `.deb` / `.AppImage` |
| macOS | Desktop run | [locat-macos-preview](https://github.com/ibrahim1101/Locat/actions/runs/38225753347/artifacts/11736071989) | `.app` / `.dmg` |

Verified 2026-10-12: all four artifact records are unexpired and identify the
exact source SHA `5bb2ecaf31a8b47325d03de0ab8db300cdd44349`.
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
