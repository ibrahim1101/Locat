# Locat 2.0 — Android emulator HTTPS preview (isolated Windows PC)

Updated 2026-10-10. This is a **local-only**, opt-in testing recipe. It does not affect Raspberry Pi production, the original Android APK or stable branches.

## Why the Connect Locat screen appears
The Capacitor shell uses `https://localhost` but the API is on the Windows PC at `http://127.0.0.1:3000`. Android cannot use that host loopback and the onboarding screen explicitly requires HTTPS. Do **not** allow cleartext traffic, disable certificate validation, put credentials in URLs, or redirect to the production server.

## Preferred path: host-only HTTPS reverse proxy + Android emulator host bridge
1. Verify your local checkout and preserve any uncommitted Android work before pulling or rebuilding:
   ```powershell
   cd "$HOME\Locat-2-Preview"
   git status --short
   git branch --show-current
   ```
   The local `android/` project might not be tracked on GitHub. Its preview `applicationId` must stay **com.shaikibrahim.locat.preview**, never `com.shaikibrahim.locat`. Don't uninstall the original app.
2. Start ONLY the existing isolated MariaDB preview container and the preview server with `HOST=127.0.0.1`, `PORT=3000`, and the separate `locat_preview` schema; verify `http://127.0.0.1:3000/api/health` returns `{"app":"Locat","status":"ok"}`. Do not use production credentials or modify the Pi.
3. Install [Caddy](https://caddyserver.com/docs/install) on Windows for a development-only reverse proxy. In `C:\Users\<you>\Locat-2-Preview\Caddyfile.preview` (ignored/local file), place:
   ```caddyfile
   https://localhost:8443 {
       tls internal
       bind 127.0.0.1
       reverse_proxy 127.0.0.1:3000
   }
   ```
   Start in a separate PowerShell console with `caddy run --config .\Caddyfile.preview --adapter caddyfile`. Caddy creates a **local development CA**. Do not expose port 8443 to the network, and never publish Caddy private keys.
4. Verify from Windows with `curl.exe --fail --cacert "<CADDY_ROOT_CA_PATH>" https://localhost:8443/api/health`. Locate the root CA certificate with `caddy environ` / Caddy's configured data directory; do not guess its location. Confirm it's the same CA used by your Caddy instance and validate its fingerprint.
5. Android emulator networking: first try `https://10.0.2.2:8443/api/health` in the emulator browser **only if** the certificate has a matching IP Subject Alternative Name. The sample `localhost` certificate does not, so do **not** use it with `10.0.2.2`; TLS hostname validation would fail. Instead, create an emulator ADB reverse mapping and use the exact certified hostname:
   ```powershell
   & "C:\platform-tools\adb.exe" -s emulator-5554 reverse tcp:8443 tcp:8443
   & "C:\platform-tools\adb.exe" -s emulator-5554 reverse --list
   ```
   The requested backend address in the native onboarding screen is **`https://localhost:8443`**. ADB reverse is device-scoped and must be re-established after emulator restarts.
6. A native WebView does **not automatically trust** Caddy's private CA. For emulator testing, install a *separately scoped debug-only Android Network Security Config* that trusts an explicitly bundled preview CA certificate, **never** a blanket trust-all/ignore-SSL implementation. The certificate should be installed only in the separate preview app build; never in release or original Locat. Avoid committing developer-specific CA files, keys, or release-affecting manifest changes. The CA public cert may be copied into `android/app/src/debug/res/raw/locat_preview_ca.crt` in your local generated project; `android/app/src/debug/res/xml/network_security_config.xml` can contain:
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <network-security-config>
       <domain-config cleartextTrafficPermitted="false">
           <domain includeSubdomains="false">localhost</domain>
           <trust-anchors>
               <certificates src="@raw/locat_preview_ca"/>
           </trust-anchors>
       </domain-config>
   </network-security-config>
   ```
   Make the preview's **debug manifest overlay** reference this config on its `<application android:networkSecurityConfig="@xml/network_security_config"` attribute. Android's merged manifest must be inspected to confirm it applies only to the preview debug build. Do not replace production network policy or trust all user CAs.
7. Rebuild only the separate preview app (debug variant). Confirm the **final applicationId**, **versionCode**, and **network security config** in merged manifest / APK before installation. Existing original installed application versionCode 194 caused a version downgrade failure; never solve it by uninstalling the original app.
8. In the preview APK onboarding, enter `https://localhost:8443`, confirm the Locat health response, and then test registration/login/logout with **local preview accounts only**. If the app reports a network error, inspect Android logcat for `SSLHandshakeException` (trust), hostname mismatch, failed reverse mapping, or backend reachability. Never bypass HTTPS to hide these failures.

## Acceptance / regression checklist
- Correct app ID: `com.shaikibrahim.locat.preview`; original app and data unchanged.
- Production Pi is untouched; separate `locat_preview` MariaDB is used.
- Certificate hostname matches exact onboarding URL; trust is debug-only and pinned to the preview CA.
- `/api/health` succeeds from Android WebView, not just Windows browser.
- Invalid certificate, incorrect hostname, HTTP, and wrong Locat health responses are rejected.
- Login, key restore where appropriate, logout, app restart, and backend-offline error paths tested.
- UI: safe areas, scrolling, keyboard overlay, orientation, bottom navigation and responsive pages.
- Link security remains **unverified** until proof-of-possession tests pass.

## Native auth follow-up
The native tRPC batch link attaches bearer tokens; `httpSubscriptionLink` uses browser EventSource and cannot reliably attach those headers. The Android documentation says subscriptions should be disabled in native with polling fallback, **but the current `src/providers/trpc.tsx` contains an unconditional subscription link**. Audit actual subscription use before marking realtime transport supported. Do not send credentials in query strings.

## Troubleshooting observations
- `INSTALL_FAILED_VERSION_DOWNGRADE` means package ID / version collide; inspect installed packages and preserve originals.
- Trusting a root CA in a browser is not proof that WebView trusts it.
- Caddy's default `tls internal` certificate includes `localhost`, not necessarily the emulator special address `10.0.2.2`.
- Avoid exposing a local backend through a public HTTPS tunnel unless separately authorized, even when its database is isolated.
