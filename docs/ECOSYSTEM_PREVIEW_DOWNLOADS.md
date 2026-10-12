# Ecosystem preview downloads and testing

Development branch: `feat/locat-complete-ecosystem`. Review:
[draft PR #7](https://github.com/ibrahim1101/Locat/pull/7), stacked on the unified
preview. This is an incomplete test preview, not a production release.

Current server/Android revision `fa27df4` passed core/MariaDB/Docker checks in
[38196947506](https://github.com/ibrahim1101/Locat/actions/runs/38196947506) and
[38196943842](https://github.com/ibrahim1101/Locat/actions/runs/38196943842).
These include real Chromium audio measurements, conventional Q conversion,
Butterworth cutoff, resonant headroom and LAN/media Compose validation.
Native packaging is separate from physical device acceptance.

## Find the actual installer

Open a successful matching workflow run, sign in to GitHub, and scroll below
the job list to **Artifacts**. Download and extract the artifact ZIP. Pick the
installer inside the ZIP, rather than the repository source ZIP.

| Platform | Workflow | Artifact | File inside |
|---|---|---|---|
| Windows | [Desktop run](https://github.com/ibrahim1101/Locat/actions/runs/38195258114) | [locat-windows-preview](https://github.com/ibrahim1101/Locat/actions/runs/38195258114/artifacts/11723291595) | NSIS `.exe` |
| Android | [Signed APK run](https://github.com/ibrahim1101/Locat/actions/runs/38196943742) | [locat-2-preview-apk](https://github.com/ibrahim1101/Locat/actions/runs/38196943742/artifacts/11723349489) | `locat-2-preview.apk`, checksum, build info and signing certificate |
| Linux | Desktop run | [locat-linux-preview](https://github.com/ibrahim1101/Locat/actions/runs/38195258114/artifacts/11723451199) | `.deb` / `.AppImage` |
| macOS | Desktop run | [locat-macos-preview](https://github.com/ibrahim1101/Locat/actions/runs/38195258114/artifacts/11722673625) | `.app` / `.dmg` |

Verified 2026-10-12: Android passed at `fa27df4`; Windows/Linux/macOS remain the
successful `cb1785d` packages because the later server/docs-only change did not
match desktop workflow paths. Current core/database/Docker checks passed in
[38196947506](https://github.com/ibrahim1101/Locat/actions/runs/38196947506) and
[38196943842](https://github.com/ibrahim1101/Locat/actions/runs/38196943842).
The previews include clipboard/lifecycle protection, bounded file buffering,
chat-first navigation, LAN readiness, reactions, shared pins, reply references
and explicit forwarding. The current server additionally includes restart-safe
encrypted scheduling APIs, but the composer/schedule-manager UI is not yet built.
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
before updating. `adb install -r` preserves compatible preview data; an
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
