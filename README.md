# Locat — local-first encrypted messenger

A self-hosted chat app where **your devices are the database** and the server is a
dumb relay. Built to run on a Raspberry Pi.

## How it works

| | Device (browser) | Server (your Pi) |
|---|---|---|
| Private keys | Generated here, never leave (IndexedDB; restored keys are non-extractable) | Only a password-encrypted backup blob it cannot open |
| Chat history & media | Stored decrypted in IndexedDB | **Nothing permanent** — transient encrypted queue, deleted on delivery |
| Messages | Encrypted with AES-GCM before sending | Sees only opaque `{iv, data}` envelopes |
| Identity | ECDH P-256 key pair per account | Public-key directory + auth |

- **1:1 chats** — pairwise key from `ECDH(myPrivate, theirPublic)` + HKDF. Both sides
  derive the same key independently.
- **Group chats** — a random AES group key, wrapped individually for each member with
  an ECDH-derived key at creation time.
- **Offline delivery** — envelopes wait in the queue (encrypted), are pushed instantly
  to online devices (SSE), and each row is **deleted the moment a recipient acks it**.
- **Identity restore** — log in on a new device with your password; the encrypted
  key backup is unwrapped locally. History remains on the original device. Queue
  acknowledgements are per account, so reliable delivery to every device is not
  implemented yet.
- **Verify contacts** — the shield icon shows key fingerprints ("safety numbers") to
  compare out-of-band.

## Run it on a Raspberry Pi

### 1. Prerequisites (Raspberry Pi OS 64-bit)

```bash
# Node.js 22.12+ (64-bit)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs mariadb-server git

# database
sudo mysql -e "CREATE DATABASE locat; CREATE USER 'locat'@'localhost' IDENTIFIED BY 'pick-a-strong-password'; GRANT ALL ON locat.* TO 'locat'@'localhost';"
```

### 2. Deploy the code

Clone the project on the Pi:

```bash
git clone https://github.com/ibrahim1101/Locat.git
cd Locat
npm ci

cat > .env <<EOF
DATABASE_URL=mysql://locat:pick-a-strong-password@localhost:3306/locat
NODE_ENV=production
PORT=3000
EOF

npm run db:push   # create tables
npm run build
npm start         # serves UI + API on :3000
```

### 3. Run as a service

```bash
sudo tee /etc/systemd/system/locat.service <<EOF
[Unit]
Description=Locat
After=network-online.target mariadb.service

[Service]
# Replace pi with your actual Raspberry Pi username and path.
User=pi
WorkingDirectory=/home/pi/Locat
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now locat
```

### 4. HTTPS — **required, not optional**

WebCrypto (the browser encryption API) only works in a **secure context**.
`http://pi.local:3000` will not work outside localhost. Pick one:

- **Tailscale (easiest, free):** `sudo apt install tailscale && sudo tailscale up`,
  then `sudo tailscale serve --bg 3000` → you get `https://<pi>.<tailnet>.ts.net`,
  reachable from your phone/laptop anywhere, end-to-end encrypted by WireGuard.
- **Caddy + a domain:** point a DNS record at your home IP, forward ports 80/443,
  `caddy reverse-proxy --from chat.example.com --to localhost:3000` — automatic
  Let's Encrypt certificates.

### 5. Invite people

Share the HTTPS URL. Everyone creates an account (username + password) — the user
directory lets them find each other by name.

## Honest limitations (v1)

- No forward secrecy / double-ratchet (Signal protocol) — keys are long-lived per
  account. Rotating your identity is supported (new-device screen → "fresh identity").
- Group membership is fixed at creation; adding/removing members requires key
  rotation, which is not implemented yet.
- Delivery acknowledgements are trusted (a malicious client could skip acking and
  leave envelopes in the queue). An admin can purge with a cron `DELETE` if desired.
- Media: images only, downscaled to 1600px before encryption (~4MB cap).
- The relay operator can see metadata (who talks to whom, when, message sizes) —
  the design encrypts content in the browser. A malicious host could still change
  the JavaScript or substitute directory keys; verify fingerprints independently.

## Installation troubleshooting

- Use 64-bit Raspberry Pi OS Lite and Node 22.12 or newer. The CLI-only OS is fine:
  access Locat from a browser on your phone.
- Copy `.env.example` to `.env` and set the real database credentials. No APP_ID or
  APP_SECRET is needed; authentication uses database-backed opaque sessions.
- Run `npm run db:push` before starting. `db:migrate` is only for generated migrations;
  this repository does not ship an initial migration history.
- URL-encode special characters in the password in DATABASE_URL.
- Check `curl http://localhost:3000/api/health`, then `journalctl -u locat -n 100`.
  The health endpoint checks the HTTP process, not database readiness.
- An HTTP Pi LAN address cannot use browser encryption. Use HTTPS on the phone.
- If upgrading from an earlier deployment, keep your existing database URL. Do not
  create an empty replacement database or clear browser storage just for a rename.
  Internal legacy crypto salts and IndexedDB identifiers are retained for compatibility.

## Mobile behavior and next work

Locat is currently a responsive browser app. It is not yet an installable offline
PWA or a native app. Receiving messages requires the page to be open; there are no
background push notifications. Clearing site data removes local history. IndexedDB
is local storage, not an encrypted-at-rest archive.

Before a wider release: implement archive export/import, account-scoped local
storage, persistent-storage requests, device-specific acknowledgements, bounded
queue retention, authentication rate limits, transactional conversation/message
creation, pinned contact keys and key-change handling, and group-key rotation.
