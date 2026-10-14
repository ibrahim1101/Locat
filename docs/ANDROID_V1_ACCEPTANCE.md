# Locat v1.0 — Android physical-device acceptance worksheet

**Branch:** `release/locat-v1.0`  
**Status:** Not yet physically verified. CI success is not evidence of installed APK behavior.  
**Safety:** Use a test account, non-sensitive media, and a trusted LAN test server. Never uninstall the existing app to fix an upgrade failure; uninstalling can delete its data.

## 1. Record the candidate build

- Commit SHA: `________________`
- Android workflow run URL: `________________`
- Artifact filename and SHA-256: `________________`
- Phone model / Android version / free storage: `________________`
- APK application ID: `________________`
- Existing app version and candidate version: `________________`
- Test date, tester and LAN server URL (omit credentials): `________________`

Obtain the APK from a **successful Android packaging workflow** whose head SHA matches the candidate being tested. A passing web/test workflow alone does not prove an APK was produced.

On Windows PowerShell, with Android platform-tools installed and USB debugging authorized:

```powershell
adb devices -l
adb shell pm list packages | findstr locat
adb shell dumpsys package com.shaikibrahim.locat.preview | findstr /I "versionName versionCode"
adb install -r "C:\path\to\candidate.apk"
adb shell dumpsys package com.shaikibrahim.locat.preview | findstr /I "versionName versionCode"
```

Replace the APK path and package ID with the **actual** candidate metadata. If `INSTALL_FAILED_UPDATE_INCOMPATIBLE` or `INSTALL_FAILED_VERSION_DOWNGRADE` occurs, **stop** and document it; do not uninstall or wipe data.

## 2. Acceptance matrix

For every case, record **PASS / FAIL / BLOCKED**, device/OS, expected vs actual, reproducible steps and any screenshot or redacted log.

| ID | Test | Expected result |
| --- | --- | --- |
| AND-01 | Upgrade existing preview app using `adb install -r` | Installs without uninstall; existing settings and test data retained |
| AND-02 | Launch from cold start, then reopen | No blank screen, crash or unexpected logout |
| AND-03 | Navigate Dashboard → Cinema → Music → Photos, press system Back repeatedly | Returns through actual visited pages and stops safely at dashboard |
| AND-04 | Use gesture Back on each page | Same result as hardware/system Back |
| AND-05 | Open dialog, press Back | Dialog closes before page navigation |
| AND-06 | Focus search input, press Back | Keyboard/input loses focus before page navigation |
| AND-07 | Navigate to dashboard via Home, press Back | Does not reopen stale earlier pages |
| AND-08 | Rapid page changes and Back presses | No skipped pages, double Back handling or app exit |
| AND-09 | Rotate in Cinema, Photos and Music | UI remains usable; no lost permissions or crash |
| AND-10 | Background and foreground with local video/music playing | Appropriate playback/focus behavior; no crash or unauthorized access |
| AND-11 | Grant video, audio and photo permissions | Correct authorized local files indexed and grouped |
| AND-12 | Change Android Photos permission to selected items | Only authorized items visible; revoked active item closes |
| AND-13 | Revoke permission in system Settings and resume app | Unauthorized library entries disappear and active item closes |
| AND-14 | Refresh a large library, change tabs or reopen | No stale photo callback, duplicate items or indefinite loading |
| AND-15 | Open local video, seek, pause, resume and close | Playback controls work; no stuck audio after closing |
| AND-16 | Open local music, change tracks and use headphones | Playback works; verify audio focus and interruptions |
| AND-17 | Disconnect/reconnect Wi-Fi while browsing hosted media | Clear error/recovery behavior without crash |
| AND-18 | Log out and switch accounts/servers | Previous account's private data and media are not exposed |

## 3. Collect failure evidence safely

Capture a screenshot or screen recording of the issue and note the exact time. For Android logs:

```powershell
adb logcat -c
# Reproduce the issue on the phone, then:
adb logcat -d -v time > locat-android-logcat.txt
```

**Before sharing logs**, redact tokens, message contents, IPs/hostnames if private, file paths, personal identifiers and other secrets. Do not publish raw logcat or account credentials in a public GitHub issue.

## 4. Release gate

- [ ] Every AND-01 through AND-18 case has a recorded result.
- [ ] All critical navigation, authorization, data-retention and crash tests pass.
- [ ] Failed cases have a reproducible issue and linked fix/verification.
- [ ] Tested APK SHA, app version and workflow run match the release candidate.
- [ ] Remaining risks and unsupported codecs/devices are documented.

**Do not mark Android P0 complete based only on this worksheet or on CI.** Record actual physical-device results and retest fixes on a new APK.
