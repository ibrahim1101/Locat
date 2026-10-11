# Locat 2.0 preview APK

Workflow: `.github/workflows/android-preview.yml`
Branch: `fix/locat-2.0-app-lock-biometric-guard`

The preview uses Android application ID `com.shaikibrahim.locat.preview` and a debug signing key. It is separate from the original `com.shaikibrahim.locat` installation. Debug signing keys on hosted CI are ephemeral; **updates over a previously installed preview may fail with INSTALL_FAILED_UPDATE_INCOMPATIBLE**. Never uninstall the original Locat application. For durable preview upgrades, configure a stable dedicated preview signing key in a later milestone.

## Download latest successful preview build (PowerShell)

```powershell
gh run list -R ibrahim1101/Locat -w android-preview.yml -b fix/locat-2.0-app-lock-biometric-guard -L 5
$run = gh run list -R ibrahim1101/Locat -w android-preview.yml -b fix/locat-2.0-app-lock-biometric-guard --status success -L 1 --json databaseId --jq '.[0].databaseId'
if (-not $run) { throw "No successful preview APK run yet." }
gh run download $run -R ibrahim1101/Locat -n locat-2-preview-apk -D "$HOME/Locat-Preview-APK"
Get-Content "$HOME/Locat-Preview-APK/build-info.txt"
```

Verify the commit in build-info.txt matches the expected code before installing. Verify SHA-256 with `Get-FileHash` against the checksum file. Install to the emulator explicitly:

```powershell
& "C:\platform-tools\adb.exe" -s emulator-5554 install -r "$HOME/Locat-Preview-APK/locat-2-preview.apk"
```

If signature mismatch occurs, stop and preserve user data. Do not uninstall without first verifying preview-only app identity and obtaining user permission. The preview server still requires a trusted HTTPS endpoint; an APK build does not establish connectivity or validate Cinema playback.

CI build success and emulator installation are unverified until workflow results and physical tests are inspected.
