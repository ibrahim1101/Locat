# Locat Android

Locat Android is the native-container edition of the existing Locat React client. The server, account model and encrypted message protocol remain shared with the web/PWA client.

## Current alpha

The first milestone uses stable Capacitor 8 and Android's native WebView container. GitHub Actions builds an unsigned/debug installable APK artifact named `locat-android-debug`.

The alpha intentionally keeps the PWA available. Android is a parallel client, not a replacement for the web build.

## Security and connectivity

The APK does not contain the Locat Node/MariaDB server. It connects to the same HTTPS Locat server as the web client. Do not enable cleartext HTTP for production. Private Tailscale-hosted servers still require the Android device to have network access to that private endpoint.

Existing client-side encryption remains in the React application. Native plugins must never send plaintext message content, attachment contents, private keys or GPS coordinates to third parties.

## Build

CI builds the web-only bundle, creates/synchronizes the Capacitor Android shell and runs Gradle `assembleDebug`. The debug APK is for development/device acceptance, not Play Store distribution.

A later release milestone will commit the Android project, add native permissions/plugins for files, media, GPS, notifications, share-target and biometric app lock, then introduce a protected release keystore and signed APK/AAB workflow. Signing secrets must never be committed to Git.

## Acceptance

Before calling the Android client supported, test login, direct/group text, images, voice notes, offline/reconnect, local history, profiles, themes, blocking, notification behavior, app background/foreground, process restart and server connectivity on a physical Android device.


## Native server connection checkpoint

The Android shell is origin-separated from the self-hosted server, so relative web API URLs and browser-cookie-only authentication are not sufficient. First launch now requires the user to enter the server's HTTPS origin. Locat stores that origin locally and refuses plaintext HTTP.

Registration/login already return the same random server session token used by cookie sessions. Android stores that token locally and sends it as the existing Authorization bearer credential on tRPC requests; the server context already supports bearer authentication. CORS is restricted to Capacitor's `https://localhost` origin rather than opened globally.

The current native alpha disables the EventSource subscription transport because browser EventSource cannot attach the bearer Authorization header reliably. Durable polling/reconnect remains active every 20 seconds, so message delivery continues to use the existing encrypted relay/outbox/ACK path. A later native notification/realtime transport will replace this fallback without putting session tokens in URLs.

The PWA/web client continues using same-origin relative APIs, cookies, service workers and SSE exactly as before.
