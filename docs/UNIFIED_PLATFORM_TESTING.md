# Unified Locat: platform test and download guide

Use `feat/locat-unified-platforms` for this preview; core/Cinema chats can continue
on their existing branches. Main is not automatically changed. Draft PR #6 is
for review, not deployment. All shells share React client source and require a
separate existing HTTPS Locat backend for messaging, Sentinel, Link and hosted
media. No database is installed on client machines.

## Downloads

GitHub Actions → **Locat desktop preview** → select a successful run for this
branch and inspect its head commit. Download the matching artifact:

| Target | Artifact | Package |
|---|---|---|
| Windows | locat-windows-preview | NSIS `.exe` installer |
| Linux | locat-linux-preview | `.deb`, `.AppImage` |
| macOS | locat-macos-preview | `.app`, `.dmg` for the runner architecture |
| Android | Locat 2.0 Preview APK → locat-2-preview-apk | Signed `locat-2-preview.apk` |

A successful build does not prove runtime compatibility. Desktop previews are
unsigned; no macOS notarization or signed-updater feed is configured. Windows
requires WebView2; Linux needs compatible WebKitGTK. If OS trust protections
block a preview, do not disable them; use local developer builds or wait for a
signed release. Android signing uses the existing persistent preview key and
preview application ID, preserving separation from the production APK.

## Android emulator installation (PowerShell)

Download/extract the successful APK artifact first, then replace the path below:

```powershell
C:\platform-tools\adb.exe devices
C:\platform-tools\adb.exe -s emulator-5554 install -r "C:\Users\ibrah\Downloads\locat-2-preview.apk"
```

Do not uninstall to force a downgrade: that removes application data. Compare
`build-info.txt` and the installed version instead. Windows/Linux/macOS previews
use `com.shaikibrahim.locat.desktop.preview`; Android uses
`com.shaikibrahim.locat.preview`.

## Local developer builds

Use a clean checkout, separate from core development:

```powershell
git clone --single-branch --branch feat/locat-unified-platforms https://github.com/ibrahim1101/Locat.git Locat-Unified
cd Locat-Unified
npm ci
npm run check
npm test
npm run desktop:build
```

Desktop prerequisites: supported Node, Rust/Cargo and platform C/C++/WebKit build
tools. They must already be installed or installed with your authorization.
See the native CI workflow for the Linux dependencies. This environment lacks
Cargo, so local native compilation was not performed here.

## Acceptance on each OS

1. Start client. Confirm no-server Local Mode and UI fits without duplicate
   menus. Choose a local video and audio track (including FLAC if supported).
   Test all 5/10/15/31 EQ modes, bypass, boosts/headroom and source switching.
2. Connect to your trusted HTTPS Locat server. Test valid/invalid health endpoint,
   invalid certificate, HTTP rejection, account login and logout.
3. With a second test account/device, test encrypted direct/group delivery,
   key restore, recipient isolation, unread state, reconnect and disabled-account
   rejection. Native sync polling is the existing fallback for SSE without headers.
4. Test file save. Android uses its existing native storage plugin; desktop must
   show an OS Save dialog and actually write the selected attachment. Canceling
   must never show successful saving. Desktop attachment limit: 128 MiB.
5. Test Sentinel scoped webhooks and Link pairing/transfers/revocation using
   non-sensitive fixtures. No new trust claims are inferred from branch merging.
6. Configure an authorized host media root. Test direct audio/video, byte-range
   seek, FFprobe, remux and HLS quality switches. Native playback uses scoped
   item tickets; repeat after logout, disabled-account changes and expiration.
7. Open Remote; use a private HTTPS Remote host and explicitly configured client
   origin. Follow `remote/README.md`. Windows hosts may opt into native capture
   and input; macOS/Linux native host capture/input is not implemented. Viewing
   depends on WebRTC support of each platform WebView and needs real testing.
8. Test close/reopen, background/foreground, passcode lock, notification permissions,
   offline/network loss, local media cleanup and session restoration.

## Remaining feature gaps

Python Media Hub engines are preserved, not mounted. Advanced parametric/native
DSP, WASAPI/AAudio exclusive audio, series/subtitles, native Remote host capture
on macOS/Linux, controller XInput, Remote audio/NVENC, secure OS credential
storage, tray/deep links/updater and roadmap-only modules are not complete.
Browser/Android/native codec support differs: source sharing is not proof of
identical format support or 4K playback performance.
