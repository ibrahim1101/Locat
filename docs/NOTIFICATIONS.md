# Optional background notifications

Locat supports Web Push through the browser's push provider. Notifications are opt-in and show only "New messages on Locat": no message text, contact name, image, or conversation name is sent as a preview. The provider handles push delivery; the Pi needs outbound internet access. Notifications are best effort and do not replace the encrypted message queue.

Subscriptions are bound to the current login session. New login/sign-out disables prior subscriptions. Expired or revoked sessions and disabled accounts are excluded from new pushes. The service worker checks the locally enabled account before displaying a received push. Already transmitted pushes may be delayed by the provider; alerts are generic. Valid pushes display notifications even with a visible Locat window. Firefox limits pushes that do not display notifications; see https://developer.mozilla.org/en-US/docs/Web/API/Push_API.

## Pi setup

After updating, generate keys once, using your contact email:

```bash
cd /opt/locat
sudo -u locat npm run push:setup -- mailto:YOUR_EMAIL_ADDRESS
sudo systemctl restart locat
```

The command saves VAPID keys in `.env` without printing them. Preserve these keys in your secure deployment configuration backup. Regenerating them invalidates browser subscriptions. No registration with a third-party push dashboard is required.

Close all Locat windows and reopen to activate the updated service worker. In Settings, use Background notifications → Enable. Permission must be granted by the browser. Try Send test, then put Locat in the background. If updating an existing Firefox mobile subscription, disable notifications and enable them again before testing. Check both Firefox's site permission and Android's notification permission for Firefox. OS force-stop and battery restrictions can prevent delivery; test background use and closing the app separately.

Android uses a supported HTTPS browser/PWA. On iPhone/iPad (iOS/iPadOS 16.4+), install the app through Safari → Share → Add to Home Screen, then enable notifications from the installed app. Browser support, operating-system power policies, and notification settings affect delivery. See https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/.

For a private Tailscale deployment, an alert can arrive through the browser's internet push service, but opening Locat still requires Tailscale connectivity to your server.

## Docker setup

Compose passes `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY` from your existing `.env`. Generate keys into that file using the built image (Bash example):

```bash
docker compose run --rm --no-deps --user root -v "$PWD/.env:/app/.env" app npm run push:setup -- mailto:YOUR_EMAIL_ADDRESS
docker compose up -d
```

The `.env` must already exist. Keep it private. On Windows, use an absolute host file path for the volume mapping. Native Node.js installations use the same `npm run push:setup` command from the deployment directory.

Current provider allowlist: Chrome/Chromium FCM, Mozilla Firefox, Apple Web Push, and Microsoft WNS. Other push destinations are rejected so subscription URLs cannot make the server send requests to arbitrary or internal addresses. Full end-to-end delivery requires real-browser testing after setup.
