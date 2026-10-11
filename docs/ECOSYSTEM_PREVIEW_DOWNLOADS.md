# Ecosystem preview downloads and testing

Development branch: `feat/locat-complete-ecosystem`. Review:
[draft PR #7](https://github.com/ibrahim1101/Locat/pull/7), stacked on the unified
preview. This is an incomplete test preview, not a production release.

Application revision `723647f` passed core/MariaDB/Docker checks in
[38174523675](https://github.com/ibrahim1101/Locat/actions/runs/38174523675) and
[38174520002](https://github.com/ibrahim1101/Locat/actions/runs/38174520002).
These include real Chromium audio measurements, conventional Q conversion,
Butterworth cutoff, resonant headroom and LAN/media Compose validation.
Native packaging is separate from physical device acceptance.

## Find the actual installer

Open a successful matching workflow run, sign in to GitHub, and scroll below
the job list to **Artifacts**. Download and extract the artifact ZIP. Pick the
installer inside the ZIP, rather than the repository source ZIP.

| Platform | Workflow | Artifact | File inside |
|---|---|---|---|
| Windows | [Desktop run](https://github.com/ibrahim1101/Locat/actions/runs/38174519996) | [locat-windows-preview](https://github.com/ibrahim1101/Locat/actions/runs/38174519996/artifacts/11715099834) | NSIS `.exe` |
| Android | [Signed APK run](https://github.com/ibrahim1101/Locat/actions/runs/38174990286) | [locat-2-preview-apk](https://github.com/ibrahim1101/Locat/actions/runs/38174990286/artifacts/11715377855) | `locat-2-preview.apk`, checksum, build info and signing certificate |
| Linux | Desktop run | [locat-linux-preview](https://github.com/ibrahim1101/Locat/actions/runs/38174519996/artifacts/11716030238) | `.deb` / `.AppImage` |
| macOS | Desktop run | [locat-macos-preview](https://github.com/ibrahim1101/Locat/actions/runs/38174519996/artifacts/11715805824) | `.app` / `.dmg` |

Verified 2026-10-12: all three desktop OS jobs passed at application revision
`723647f`; signed Android passed at `4f2d594`, with versionCode `1791752828`
and v2/v3 signatures verified. Core/database/Docker/Chromium checks passed
at `4f2d594` in [38174993485](https://github.com/ibrahim1101/Locat/actions/runs/38174993485)
and [38174990264](https://github.com/ibrahim1101/Locat/actions/runs/38174990264).
The application, desktop and web sources did not change between those two
revisions; the latter changes Android build numbering and documentation.
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
