# Install Locat on Raspberry Pi

## Requirements

- Raspberry Pi 5 (or Pi 4) running **64-bit Raspberry Pi OS**, Debian 12 or newer.
  Lite/CLI is supported; Locat's UI runs on your phone, not on the Pi desktop.
- Internet access for installation, at least 2 GB RAM, and room for Node packages
  and the database. Allow roughly 2 GB free for installation and updates.
- HTTPS for browser encryption and production session cookies.
- The AI HAT is not needed for Locat's messaging server.

## Fresh installation

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/ibrahim1101/Locat.git
cd Locat
sudo bash scripts/install-pi.sh
```

The installer checks architecture/OS, installs Node 22 when needed, starts MariaDB,
generates a database password, performs an additive schema setup, builds the app,
and enables `locat.service`. It runs the app as a dedicated `locat` system user,
keeps credentials in `/opt/locat/.env` with restrictive permissions, and defaults
to listening on `127.0.0.1:3000` for an HTTPS proxy. No database password copying
or manual SQL is needed for a fresh install.

## Existing installation: preserve your database

Before running the installer, copy your existing `.env` into place. Replace the
example path with the actual path to your old installation:

```bash
sudo mkdir -p /opt/locat
sudo install -m 600 /path/to/your/existing/Locat/.env /opt/locat/.env
sudo bash scripts/install-pi.sh
```

It keeps that DATABASE_URL and does not recreate accounts or reset passwords. If
the old database username exists but its .env is missing, the installer stops
instead of changing its password. Back up the existing database before upgrades.
If an old manually configured service is already listening on port 3000, stop
that old service before starting the new `locat.service`.

## HTTPS access from phones

Choose one of the following. HTTPS is needed before creating accounts on a phone.

### Private access with Tailscale

Install Tailscale on the Pi using its [official Linux instructions](https://tailscale.com/download/linux),
then:

```bash
sudo tailscale up
sudo tailscale serve --bg 3000
```

Open the HTTPS URL printed by the command on your phone. Phones must be connected
to the same tailnet (or have access through tailnet sharing/policy). Tailscale Serve
is private access; it does not make Locat a public website. Do not forward port 3000.

### Public access with a domain and Caddy

Point a domain at your public IP, make ports 80/443 reachable on the Pi, and install
Caddy. This requires a reachable public IP; a connection behind CGNAT needs a
separate tunnel/VPS approach.

```bash
sudo apt install -y caddy
```

Add a site to `/etc/caddy/Caddyfile`, replacing the domain:

```caddyfile
chat.example.com {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open `https://chat.example.com` on the phone. Caddy handles TLS certificates;
`flush_interval -1` avoids buffering realtime events. Keep `COOKIE_SECURE=true`.
Public deployment still needs the remaining security/abuse controls in REVIEW.md
before inviting a wide audience. Use a private deployment for early testing.

## Update and diagnose

From your separate source checkout:

```bash
git pull --ff-only
sudo bash scripts/install-pi.sh
```

Updates build in a staging folder. Failed builds leave the previous running release
in place. After switching, a failed readiness check restores the previous release.
Schema changes are additive and remain applied if code rollback occurs.

```bash
sudo systemctl status locat --no-pager
sudo journalctl -u locat -n 100 --no-pager
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/ready
sudo systemctl restart locat
```

`health` checks the HTTP process; `ready` checks database connectivity and required
schema tables. Edit `/opt/locat/.env` if changing PORT/HOST/database credentials,
and restart the service. If using a custom port, change the HTTPS proxy target too.

## Local history and backups

Use the gear button in Locat → **History & backups** → export an encrypted `.locat`
file with a separate password. Import on the same account and HTTPS origin merges
messages without replacing existing history. Backups contain text/images, not
identity keys. Sign in with your account password to restore encryption identity.
Export before changing phones or clearing browser data. The browser can still clear
storage; the persistent-storage request is not a substitute for backups.

## Verification limits

Builds, browser-storage tests and MariaDB integration tests run on x86 Linux.
The installer checks ARM64 and uses ARM64 Node packages, but has not been executed
on physical Raspberry Pi hardware. Android/iOS behavior and HTTPS setup need a
real-device acceptance check after installation.
