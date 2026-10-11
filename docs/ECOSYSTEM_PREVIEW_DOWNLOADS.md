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
| Windows | [Desktop preview](https://github.com/ibrahim1101/Locat/actions/workflows/desktop-preview.yml?query=branch%3Afeat%2Flocat-complete-ecosystem) | `locat-windows-preview` | NSIS `.exe` |
| Android | [Preview APK](https://github.com/ibrahim1101/Locat/actions/workflows/android-preview.yml?query=branch%3Afeat%2Flocat-complete-ecosystem) | `locat-2-preview-apk` | `locat-2-preview.apk`, checksum, build info and signing certificate |
| Linux | Desktop preview | `locat-linux-preview` | `.deb` / `.AppImage` |
| macOS | Desktop preview | `locat-macos-preview` | `.app` / `.dmg` |

Desktop packaging for `723647f` runs in
[38174519996](https://github.com/ibrahim1101/Locat/actions/runs/38174519996).
The previous `87a7c9b` desktop run passed all three OS jobs, but its audio graph
predates the Q conversion. Prefer the corrected revision.

Android run `38174520046` successfully packaged the corrected audio source.
A follow-up workflow correction replaces resetting run-counter version codes
with bounded UTC-second codes and verifies the code in the signed manifest.
Use the newer successful APK run containing that correction; its build-info
file records the actual commit, run, package and versionCode. PR #7 records
the final verified links. Do not assume a queued/failed run contains an APK.

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
