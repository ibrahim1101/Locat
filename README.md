# RelayChat — local-first encrypted messenger

A self-hosted chat app where **your devices are the database** and the server is a
dumb relay. Built to run on a Raspberry Pi.

## How it works

| | Device (browser) | Server (your Pi) |
|---|---|---|
| Private keys | Generated here, never leave (IndexedDB, non-extractable) | Only a password-encrypted backup blob it cannot open |
| Chat history & media | Stored decrypted in IndexedDB | **Nothing permanent** — transient encrypted queue, deleted on delivery |
| Messages | Encrypted with AES-GCM before sending | Sees only opaque `{iv, data}` envelopes |
| Identity | ECDH P-256 key pair per account | Public-key directory + auth |

- **1:1 chats** — pairwise key from `ECDH(myPrivate, theirPublic)` + HKDF. Both sides
  derive the same key independently.
- **Group chats** — a random AES group key, wrapped individually for each member with
  an ECDH-derived key at creation time.
- **Offline delivery** — envelopes wait in the queue (encrypted), are pushed instantly
  to online devices (SSE), and each row is **deleted the moment a recipient acks it**.
- **Multi-device** — log in on a new device with your password; the encrypted key
  backup is unwrapped locally. Your own messages echo to your other devices.
- **Verify contacts** — the shield icon shows key fingerprints ("safety numbers") to
  compare out-of-band.

## Run it on a Raspberry Pi

### 1. Prerequisites (Raspberry Pi OS 64-bit)

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs mariadb-server

# database
sudo mysql -e "CREATE DATABASE relaychat; CREATE USER 'relay'@'localhost' IDENTIFIED BY 'pick-a-strong-password'; GRANT ALL ON relaychat.* TO 'relay'@'localhost';"
```

### 2. Deploy the code

Download/export this project, copy it to the Pi, then:

```bash
cd relaychat
npm install

cat > .env <<EOF
DATABASE_URL=mysql://relay:pick-a-strong-password@localhost:3306/relaychat
APP_ID=selfhosted
APP_SECRET=selfhosted
NODE_ENV=production
PORT=3000
EOF

npm run db:push   # create tables
npm run build
npm start         # serves UI + API on :3000
```

### 3. Run as a service

```bash
sudo tee /etc/systemd/system/relaychat.service <<EOF
[Unit]
Description=RelayChat
After=network.target mariadb.service

[Service]
WorkingDirectory=/home/pi/relaychat
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now relaychat
```

### 4. HTTPS — **required, not optional**

WebCrypto (the browser encryption API) only works in a **secure context**.
`http://pi.local:3000` will not work outside localhost. Pick one:

- **Tailscale (easiest, free):** `sudo apt install tailscale && sudo tailscale up`,
  then `tailscale serve --bg 3000` → you get `https://<pi>.<tailnet>.ts.net`,
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
  but never content.
