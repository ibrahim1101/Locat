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

## Install on Raspberry Pi (64-bit OS Lite supported)

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/ibrahim1101/Locat.git
cd Locat
sudo bash scripts/install-pi.sh
```

The installer handles Node, MariaDB, database credentials, schema setup, builds,
service installation, and safe application updates. For an existing installation,
copy your old `.env` to `/opt/locat/.env` first so your database is preserved.

**Next, configure HTTPS** using [the Raspberry Pi guide](docs/RASPBERRY_PI.md).
The server listens on loopback by default; use Tailscale Serve for private access
or Caddy with a domain for public access. Phone browsers require HTTPS to encrypt
messages. Share the resulting HTTPS URL with people who should use Locat.

## Development / manual deployment

Use Node 22.12+ (or Node 24+) and a MySQL/MariaDB database:

```bash
npm ci
cp .env.example .env
# Edit DATABASE_URL in .env to use your database and credentials.
npm run db:setup
npm run dev
```

For production: `npm run build && npm start`, with an HTTPS reverse proxy pointing
to the configured HOST/PORT. `npm run db:setup` is an additive, repeatable bootstrap
for new and original Locat databases; it does not drop or truncate tables.

## History and delivery

- Account-specific IndexedDB archives prevent history/unread state mixing when
  switching accounts on a shared browser. This is not encryption at rest.
- The gear button opens **History & backups**: export/import password-encrypted
  history files and request persistent browser storage. Backups are limited to
  50 MB and bound to the same account and server origin. Identity keys are restored
  separately by signing in. Keep regular backups before changing phones.
- Sending commits the envelope, recipient deliveries, and retry receipt together.
  Retrying the same send uses the same message ID, including after acknowledgement
  has removed the transient envelope. Metadata-only retry receipts last seven days
  and are cleaned up on subsequent sends; they contain no message plaintext.
- Offline sync uses cursor pages and a response-size budget. An unreadable envelope
  does not block fetching later pages. Reconnecting or foregrounding resumes sync.

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
- Run `npm run db:setup` before starting. Use the additive bootstrap for existing
  databases; do not apply the initial migration over tables created by db:push.
- URL-encode special characters in the password in DATABASE_URL.
- Check `curl http://localhost:3000/api/health`, then `journalctl -u locat -n 100`.
  `/api/ready` separately checks database connectivity and schema readiness.
- An HTTP Pi LAN address cannot use browser encryption. Use HTTPS on the phone.
- If upgrading from an earlier deployment, keep your existing database URL. Do not
  create an empty replacement database or clear browser storage just for a rename.
  Legacy crypto salts are retained, and legacy history is copied only for verified
  memberships into account-specific storage; the original archive is left intact.

## Mobile behavior and next work

Locat is currently a responsive browser app. It is not yet an installable offline
PWA or a native app. Receiving messages requires the page to be open; there are no
background push notifications. Clearing site data removes local history. IndexedDB
is local storage, not an encrypted-at-rest archive.

Before a wider release: implement device-specific acknowledgements, bounded queue
retention, authentication rate limits, pinned contact keys/key-change handling,
group-key rotation, offline installation, and push notifications. See
[the current review](docs/REVIEW.md) for limits and next work.

## Tests

`npm test`, `npm run check`, `npm run lint`, and `npm run build` run local checks.
Database integration tests are opt-in locally and run in CI with MariaDB 10.11:

```bash
TEST_DATABASE_URL=mysql://user:password@127.0.0.1:3306/locat_test npm test
```

**The integration suite drops tables in the specified database.** Use a disposable
schema whose name ends with `_test`, never your real Locat database.


## Mobile and administration update

Locat now includes a standalone web-app manifest, build-versioned static offline cache, account-local conversation metadata, and a durable encrypted outbox. Open it online once before testing offline history. Android uses the browser's Install app menu; iPhone uses Safari → Share → Add to Home Screen. Close all Locat windows after an update so the waiting service worker can activate.

Settings includes light/dark/system themes, installation instructions, and encrypted history backup/restore. Conversation search, saved-message search, copy/reply/local-delete actions, and a full-screen image viewer are available. Replies currently use a quoted-text format compatible with existing clients.

Contact public keys are pinned on first use; changed keys block encryption/decryption until accepted in Encryption details. Verify fingerprints over another trusted channel. Accounts allow one active login until per-device delivery is implemented. A retry older than seven days stops automatically rather than risk duplicate sending.

- [Server account administration and backups](docs/SERVER_ADMIN.md)
- [Windows/macOS/Linux hosting](docs/CROSS_PLATFORM.md)

Still planned: true background push, per-device queues, group membership changes with key rotation/history, encrypted voice/files, structured reactions, advanced media controls, native packages, and calling infrastructure. These are not claimed as shipped in this batch.


### Browser administration

Locat now has an administrator dashboard at `/admin`: account controls, session revocation, server statistics, encrypted metadata downloads, cleanup, and action history. Grant an existing account with `npm run admin -- grant-admin USERNAME` on the server. Admin roles are never granted through registration or the browser. See [server administration](docs/SERVER_ADMIN.md) for Pi commands and backup recovery.
