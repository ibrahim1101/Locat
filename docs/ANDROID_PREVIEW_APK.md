# Locat 2.0 preview APK

Workflow: `.github/workflows/android-preview.yml`
Branch: `fix/locat-2.0-app-lock-biometric-guard`

The preview uses Android application ID `com.shaikibrahim.locat.preview` and a dedicated persistent release signing key. It is separate from the original `com.shaikibrahim.locat` installation. The workflow requires four dedicated GitHub Actions secrets and fails closed if any is missing. Do not reuse the original Locat production signing key. Never uninstall the original Locat application. Existing previews signed by an earlier ephemeral debug key cannot be upgraded in place to the new certificate; preserve/backup local data before any preview-only reinstall.

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

## One-time preview signing setup (Windows PowerShell)

Install JDK 21 if needed, then generate and **back up** a new keystore in a secure private folder (not inside the repository):

```powershell
New-Item -ItemType Directory -Force "$HOME\\Locat-Signing" | Out-Null
keytool -genkeypair -v -keystore "$HOME\\Locat-Signing\\locat-preview.jks" -alias locat-preview -keyalg RSA -keysize 3072 -validity 10000
```

Enter strong passwords when prompted. Keep the keystore and passwords in a secure offline backup. Losing them means future in-place updates cannot be signed with the same identity.

In GitHub repository Settings → Secrets and variables → Actions, add:

- `LOCAT_PREVIEW_KEYSTORE_BASE64`: Base64 of the complete JKS file, generated locally with `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\\Locat-Signing\\locat-preview.jks"))`
- `LOCAT_PREVIEW_KEYSTORE_PASSWORD`: keystore password
- `LOCAT_PREVIEW_KEY_ALIAS`: `locat-preview`
- `LOCAT_PREVIEW_KEY_PASSWORD`: private-key password (often the same as the store password)

Do not paste the base64 keystore or passwords into chat, source files, CI logs, or screenshots. Re-run the workflow after configuring the secrets. Check the downloaded `signing-certificate.txt` SHA-256 fingerprint against future builds to ensure signing continuity.

The old preview APK signed by GitHub's temporary debug key cannot be upgraded with this new certificate. If its data is important, back it up and assess encryption-key recovery before uninstalling that preview package. The original Locat app is unaffected.
