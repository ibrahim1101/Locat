# Locat — Development handoff (2026-10-08)

This document is a living handoff for continuing Locat development in a new chat. Update it as implementation and testing progress.

## Project and environments

- Repository: https://github.com/ibrahim1101/Locat
- Working branch: `feat/locat-1.0`
- Locat: self-hosted encrypted messenger, React web app, Capacitor Android app, Node backend, MariaDB.
- Raspberry Pi deployment: `/opt/locat`, systemd service `locat.service`, HTTPS through Tailscale Serve at `https://ibrahimshaik-1.tail0abf6e.ts.net`.
- Raspberry Pi deployment preserves `.env` and DB; private configuration must never be committed or pasted into chats.
- Windows development machine: Android Studio Pixel emulator `emulator-5554`, ADB at `C:\platform-tools\adb.exe`; physical phone also appears in ADB, so always specify `-s emulator-5554`.
- Emulator has Tailscale installed and connected. Locat APK installed and user confirmed successful login.

## Confirmed achievements

1. Pi presence handling: heartbeat expiry and periodic sweeper introduced; user previously confirmed Android appeared offline within ~40 seconds. Recent faster timing adjustments have not yet been measured by user.
2. GitHub-to-Pi deployment script: `scripts/deploy-pi.sh`, documentation `docs/PI-GITHUB-DEPLOY.md`. User ran it successfully; build, doctor, service and health check passed.
3. Firefox background notifications: buttons disappeared because VAPID configuration was absent. User ran `npm run push:setup -- mailto:<owner-contact>`, restarted server, and confirmed Enable/Disable/Send test controls visible and notifications delivered. Never expose VAPID keys.
4. Accepted-friends search was added to the existing People/conversations dialog. User confirmed controls visible in Android emulator. A *dedicated* Friends tab is still planned.
5. Android emulator: user installed Android Studio emulator, ADB detected `emulator-5554`, installed signed Locat APK, and logged in after installing Tailscale inside emulator. Emulator initially had internet but could not resolve the private Tailscale hostname until Tailscale setup.
6. Automated emulator updater: `scripts/update-android-emulator.ps1` fetches latest successful `android-apk.yml` artifact (`locat-android-release`), verifies SHA256, and installs via `adb -s emulator-5554 install -r`. User confirmed latest updater worked after commit `1835fa90c67c4eec3c0c49e11e132f77507386d7`.

## Relevant GitHub changes

- `f658d8e`: Pi deployment script.
- `5550831`: Pi deployment documentation.
- `ac4bf2e`: accepted-friends search.
- `241fb60`: heartbeat expiry 12 seconds, sweep every 2 seconds.
- `64a68cb`: web presence refresh every 8 seconds; Android stays 3 seconds.
- `1deab59`: initial emulator updater.
- `10f4a49`: clear stale temporary artifact directory.
- `48092f0`: attempted JSON-array run selection fix; still broken.
- `1835fa9`: final fix, get scalar run ID directly with `gh --jq '.[0].databaseId'`; user reported success.

## Troubleshooting history and lessons

- GitHub CLI was initially missing; installed using `winget install --id GitHub.cli -e --source winget`, authenticated via `gh auth login`.
- APK download initially failed with `accepts at most 1 arg(s), received 10`. The PowerShell JSON pipeline unexpectedly passed all ten successful workflow IDs. The final solution requests a single scalar ID from `gh run list ... -L 1 --json databaseId --jq '.[0].databaseId'`.
- Direct `gh run download <run-id> -R ibrahim1101/Locat -n locat-android-release -D <directory>` succeeded, confirming permissions and artifact validity. Artifacts had not expired.
- Do not claim a GitHub commit was deployed until Pi deployment or emulator installation is confirmed. Android APK workflow is separate from Pi deployment.
- `npm ci` reported vulnerabilities during Pi deploy; investigate carefully, do not run blind forced dependency upgrades.

## Commands

Pi deployment:
```bash
curl -fL https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh -o /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
```

Pi health:
```bash
cd /opt/locat
npm run doctor
systemctl status locat.service --no-pager
```

Windows: update emulator from GitHub:
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/update-android-emulator.ps1" -OutFile "C:\platform-tools\update-locat.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\platform-tools\update-locat.ps1"
```

Manual install (only if needed):
```powershell
C:\platform-tools\adb.exe -s emulator-5554 install -r "C:\platform-tools\locat-release.apk"
```

## 2026-10-08 — In-app version footer

- Commit `aadf4ff`: added package-version display beside the chat sidebar connection status (`Locat · Connected · v0.1.0`). Reads `package.json` at build time, avoiding a hardcoded version string.
- GitHub write succeeded. Build, Raspberry Pi deployment, and Android emulator installation have **not yet been verified**.
- Limitation: package version is not a unique build identifier; future work should expose a short commit SHA or build ID for precise APK identification.

## Build identification (2026-10-08)

- `a3238df`: Vite injects `__LOCAT_BUILD_ID__` using `GITHUB_RUN_NUMBER` on GitHub Actions, otherwise the local short Git SHA (`local` fallback).
- `5569564`: chat footer displays `v<package version> · Build <build identifier>` beside connection status.
- Android release workflow already sets native Android `versionCode` from `github.run_number`; its web build receives the same run number.
- Pi deploy builds outside GitHub Actions and therefore displays a Git SHA instead of a numeric build number.
- Changes committed; CI success, Pi deployment and emulator testing are not yet confirmed.

## Next priorities

1. Measure real offline detection latency after recent presence changes; check false offline/flicker while clients remain open, and distinguish normal close, background, and force-stop. Target ~12–20 seconds, not yet verified.
2. Build dedicated Friends tab/interface with accepted contacts, search, profile viewing and quick chat; preserve contact-request workflow and privacy controls.
3. Test Android notification permissions, push delivery, foreground/background behavior on emulator; confirm real-phone behavior separately.
4. Improve Android storage/backup export destinations and permissions UI; plan zero-knowledge encrypted backup vault and MFA before implementing.
5. Maintain ongoing engineering history with failures, tests and outcomes; keep this handoff updated.

## New-chat kickoff

"Continue Locat development from `docs/DEVELOPMENT_HANDOFF_2026-10-08.md` in `ibrahim1101/Locat` branch `feat/locat-1.0`. Emulator updater works, Pi deployment works, Firefox push works, accepted-friends search visible. Start with dedicated Friends tab and verify faster presence timing. Make incremental GitHub commits and give exact Pi/emulator testing commands."
