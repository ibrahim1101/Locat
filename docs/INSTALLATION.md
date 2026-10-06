# Locat installation: a beginner's walkthrough

One person hosts the server; everyone else opens its HTTPS address on their phone or computer. Friends do **not** install MariaDB, Docker or another Locat server. The host must stay powered on and connected for remote messaging. Local saved history can remain available offline.

This guide describes the development branch `feat/locat-1.0`, not a finished 1.0 release. Existing deployments should back up first and deliberately choose when to update. Do not switch branches or replace a working server just to read this guide.

## 1. Choose one installation method

| Your equipment | Method |
|---|---|
| Pi 4/5 with 64-bit Raspberry Pi OS, Debian 12+ | Section 2: automatic Pi installer |
| Ubuntu/Debian PC or server with systemd | Section 3: native Linux |
| Another Linux distribution, Windows or macOS | Section 4: Docker |
| Only a phone, joining someone else's server | Start at section 6: friend setup |

The native commands below are for Ubuntu/Debian. Fedora, Arch, openSUSE and other distributions have different package managers; use Docker with your distribution's official Docker Engine installation instructions. The Pi script is not a universal Linux installer. Allow several GB of free disk space for packages/builds and additional space for queued media. A graphical server desktop is optional.

Commands go in a terminal. Run each block in order and stop if it reports an error. `sudo` may ask for your Linux password; characters do not appear while typing it. A `.env` file contains configuration and secrets: never post it publicly. Example hostnames must be replaced with your own.

## 2. Raspberry Pi: install the server

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your computer. Select your Pi and **64-bit Raspberry Pi OS** (Lite is fine), choose your SD card/SSD, and configure your username, password and Wi-Fi. Enable SSH if you want remote terminal access. Writing the OS erases the selected drive; check it carefully.
2. Boot the Pi and connect it to the internet. Open Terminal on the Pi, or SSH from your computer using the username and hostname you configured, for example `ssh YOUR_USER@raspberrypi.local`.
3. Check the operating system and architecture:

```bash
uname -m
cat /etc/os-release
```

The architecture must say `aarch64`; the Debian version must be 12 or newer. A 32-bit OS needs replacement before this installer can run.

4. Download the development source and run the installer:

```bash
sudo apt update
sudo apt install -y git
git clone --branch feat/locat-1.0 --single-branch https://github.com/ibrahim1101/Locat.git
cd Locat
sudo bash scripts/install-pi.sh
```

The installer creates `/opt/locat`, installs Node/MariaDB, generates database credentials, builds Locat and enables startup after reboot. Wait for the ready message. The AI HAT is not required.

5. Verify:

```bash
sudo systemctl status locat --no-pager
curl --fail http://127.0.0.1:3000/api/ready
cd /opt/locat
sudo -u locat npm run doctor
```

Expect an active service and a `ready` response. Continue at section 5 to enable HTTPS. An HTTP LAN address is not a substitute.

**Existing Pi installation:** keep your existing database and `/opt/locat/.env`. If moving an older manual installation, follow [the preservation instructions](RASPBERRY_PI.md#existing-installation-preserve-your-database) before running the installer. Do not create a replacement database or clear browser storage.

## 3. Ubuntu/Debian without a Pi or Docker

These steps are for a fresh installation on a systemd machine. They create a dedicated account and database; if either already exists, stop and inspect the existing configuration instead of overwriting it.

1. Install system tools and MariaDB:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates gnupg mariadb-server openssl
sudo systemctl enable --now mariadb
```

2. Install Node.js 22 from the NodeSource APT repository:

```bash
sudo install -d -m 755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o /tmp/locat-node-key.asc
sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/locat-nodesource.gpg /tmp/locat-node-key.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/locat-nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" | sudo tee /etc/apt/sources.list.d/locat-node.list
sudo apt update
sudo apt install -y nodejs
node --version
npm --version
```

Node must be 22.12+ or a supported version 24+. This adds a third-party package repository. Supported architectures/package availability depend on NodeSource; use Docker if your distribution is not supported. [NodeSource instructions](https://github.com/nodesource/distributions).

3. Create the service account and download Locat:

```bash
sudo useradd --system --user-group --create-home --home-dir /var/lib/locat --shell /usr/sbin/nologin locat
sudo git clone --branch feat/locat-1.0 --single-branch https://github.com/ibrahim1101/Locat.git /opt/locat
sudo chown -R locat:locat /opt/locat
sudo chmod 750 /opt/locat
```

4. Generate a database password. Copy the output privately; it is different from your Locat account password:

```bash
openssl rand -hex 32
sudo mariadb
```

At the MariaDB prompt, paste these statements **after replacing `PASTE_GENERATED_HEX_PASSWORD`** with that output:

```sql
CREATE DATABASE locat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'locat'@'localhost' IDENTIFIED BY 'PASTE_GENERATED_HEX_PASSWORD';
GRANT ALL PRIVILEGES ON locat.* TO 'locat'@'localhost';
EXIT;
```

5. Create the configuration file:

```bash
sudo cp /opt/locat/.env.example /opt/locat/.env
sudo chown locat:locat /opt/locat/.env
sudo chmod 600 /opt/locat/.env
sudo nano /opt/locat/.env
```

Change only the password in `DATABASE_URL` to the generated hex password. Keep `HOST=127.0.0.1`, `PORT=3000`, and `COOKIE_SECURE=true`. Nano saves with Ctrl+O, Enter, then exits with Ctrl+X. If Nano is unavailable, install it with `sudo apt install nano`.

6. Install dependencies, prepare the database and build:

```bash
cd /opt/locat
sudo -u locat npm ci
sudo -u locat npm run db:setup
sudo -u locat npm run build
sudo -u locat npm run doctor
```

7. Create the background service:

```bash
sudo nano /etc/systemd/system/locat.service
```

Paste and save:

```ini
[Unit]
Description=Locat messenger
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=locat
Group=locat
WorkingDirectory=/opt/locat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/locat/dist/boot.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

8. Start and verify:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now locat
sudo systemctl status locat --no-pager
curl --fail http://127.0.0.1:3000/api/ready
```

Continue with section 5. This generic native recipe needs installation acceptance on each target distribution; it is not claimed to have been tested everywhere.

## 4. Docker: app and database together

Docker runs Locat and MariaDB in separate containers. A persistent volume stores the server database across container restarts. Install Tailscale on the **host computer**, outside the containers.

1. Install Docker:
   - Windows/macOS: install [Docker Desktop](https://www.docker.com/products/docker-desktop/), complete its setup and start it. On Windows enable the WSL 2 backend when prompted; restart if requested.
   - Linux: use [Docker's distribution-specific Engine instructions](https://docs.docker.com/engine/install/), then [install the Compose plugin](https://docs.docker.com/compose/install/linux/). For example Ubuntu uses [this complete official recipe](https://docs.docker.com/engine/install/ubuntu/). Do not substitute Ubuntu repository commands on Fedora/Arch.
2. Install Git if absent ([Git downloads](https://git-scm.com/downloads)). Open Terminal or PowerShell and check:

```bash
git --version
docker --version
docker compose version
docker info
```

If Linux says permission denied for Docker, prefix every `docker` command below with `sudo`. If it cannot connect, start Docker Desktop or run `sudo systemctl enable --now docker` on Linux.

3. Download the source:

```bash
git clone --branch feat/locat-1.0 --single-branch https://github.com/ibrahim1101/Locat.git
cd Locat
```

4. Generate **two different** random hex passwords, at least 32 characters each. Linux/macOS:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Windows PowerShell alternative (run twice):

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
$rng.Dispose()
```

5. Create a file named **`.env`** in the Locat folder. Linux/macOS: `nano .env`; Windows: `notepad .env` (save as All Files so it is not `.env.txt`). Paste the following and replace both placeholders with your generated passwords:

```dotenv
LOCAT_DB_PASSWORD=FIRST_GENERATED_HEX_PASSWORD
LOCAT_DB_ROOT_PASSWORD=SECOND_GENERATED_HEX_PASSWORD
```

Do not copy the native `.env.example` for this method. Never change these passwords on an existing database just by editing `.env`; existing database credentials do not automatically change.

6. Validate and start from the Locat folder:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app
docker compose exec app npm run doctor
```

Wait until app and db are healthy. `config --quiet` checks configuration without printing passwords. The repository's file is `compose.yaml`; Compose finds it automatically. Locat listens on host `127.0.0.1:3000` and MariaDB is not published on the host network.

7. Continue with section 5. After obtaining your HTTPS URL, add `PUBLIC_ORIGIN=https://YOUR_FULL_HOSTNAME.ts.net` to `.env` (no trailing slash) and run `docker compose up -d` again. On Docker Desktop, Tailscale Serve runs on Windows/macOS and proxies its local published port; verify this on your actual host.

8. Useful controls, always from this folder:

```bash
docker compose stop
docker compose start
docker compose restart app
docker compose logs --tail=100 app db
```

`stop` pauses messaging. Docker restart policies only work while Docker itself is running; on Desktop arrange startup/login and prevent host sleep. **Never run `docker compose down -v` on a server whose accounts you want to retain**: it deletes the database volume. Keep the checkout/project folder name stable to avoid accidentally using a different Compose volume. Windows/macOS installation remains pending physical-host acceptance.

## 5. Host: make a private HTTPS address with Tailscale

Tailscale provides private network access. Locat provides separate chat accounts. You do not need a purchased domain or router port forwarding for this method.

1. Create your own [Tailscale account](https://login.tailscale.com/start). Check [current plan limits](https://tailscale.com/pricing) for your intended use; do not assume unlimited free users.
2. Install Tailscale on the server. On supported Linux hosts, download the official installation script, inspect it, then execute:

```bash
curl -fsSL https://tailscale.com/install.sh -o /tmp/locat-tailscale-install.sh
less /tmp/locat-tailscale-install.sh
sudo sh /tmp/locat-tailscale-install.sh
sudo tailscale up
```

Press `q` to exit `less`. Open the login link printed by `tailscale up` on any browser and sign in to your own account. Windows/macOS hosts use the [Tailscale installer](https://tailscale.com/download), then sign in from its app.

3. Confirm the server appears online in [Machines](https://login.tailscale.com/admin/machines). Review device approval if your network requires it. Enable MagicDNS in [DNS settings](https://login.tailscale.com/admin/dns) if disabled.
4. On the host, expose the local Locat port through Serve. Linux:

```bash
sudo tailscale serve --bg 3000
sudo tailscale serve status
```

On Windows/macOS, run `tailscale serve --bg 3000` and `tailscale serve status` in a terminal with Tailscale's CLI available; use an administrator terminal if requested. If HTTPS needs enabling, open the authorization link displayed by Serve and follow the prompts. Tailscale explains the certificate hostname disclosure before enabling HTTPS.

5. Copy the **exact HTTPS URL** printed by Serve, such as `https://locat-server.example-tailnet.ts.net`. This is an example, not your address. Do not use `localhost`, a `192.168...` address, a plain `100...` IP, or HTTP on the phone.
6. For native installations, set `PUBLIC_ORIGIN` in `/opt/locat/.env` to this exact URL, without a trailing slash, then restart:

```bash
sudo nano /opt/locat/.env
sudo systemctl restart locat
```

Docker users complete section 4 step 7 instead. Keep `COOKIE_SECURE=true`. Serve is private; **Funnel is a different feature that exposes a service publicly**. This guide does not enable Funnel.
7. Install Tailscale on your own phone and sign in to the same account. Turn on its connection, then open the copied URL in your browser. Create your Locat account. Verify the profile panel shows your fixed four-digit LC number.

## 6. Host and friend: share access from another house

**Host steps:**

1. In [Tailscale Machines](https://login.tailscale.com/admin/machines), find the machine running Locat. Open its three-dot menu and choose **Share** or **Sharing settings** (wording may vary).
2. Generate a share invitation for that machine and send the invitation link privately to your friend. Prefer a one-time link; create a separate invitation for each friend.
3. Also send the complete Locat HTTPS URL from `tailscale serve status`.
4. Share the server machine, not your Tailscale login credentials. Device sharing can grant access to other allowed services on that machine; review Tailscale access policy/firewall permissions if it also hosts sensitive services. Giving a friend a Locat account does not grant them server administration.

**Friend steps:**

1. Install Tailscale on Android/iPhone/Windows/macOS/Linux from its official store/download page.
2. Sign in with **your own** Tailscale account; do not use the host's password.
3. Open the host's invitation link and accept while signed in to that same account. Confirm the shared server appears in your Tailscale network. If your organization restricts external shares, its administrator may need to approve it.
4. Turn on Tailscale on the phone/computer you will use for Locat; allow the VPN permission when prompted. Keep it connected while accessing the private server.
5. Open the **complete HTTPS URL** the host sent, including the full `.ts.net` hostname. A short machine name may not resolve for shared machines.
6. Select **Create account** in Locat and choose your own username and password. Tailscale sign-in does not create this account. Until the stronger-password upgrade lands, the current registration minimum is eight characters; use a long unique passphrase even now.
7. Open the top-left profile avatar and copy your LC number. Send it to the host through your existing trusted channel. Both people must use the **same server URL**; separate Locat servers do not exchange messages.
8. Current UI: use the new-chat button and search the LC number to start chatting. **Add friend / Accept / Decline is planned and must not be expected in the current build.** Once implemented, request acceptance will replace starting a direct chat immediately.
9. Exchange a test message in both directions. Then switch the friend to mobile data and repeat with Tailscale connected. The host must remain online.

To remove access, the host can revoke the machine share in Tailscale Sharing settings. Blocking inside Locat is separate and does not revoke network access. Never share your Tailscale identity, SSH password, database password or `.env`.

## 7. Install the phone shortcut and optional notifications

- Android: open the HTTPS address in Chrome, open its menu, and choose **Install app** or **Add to Home screen** if offered.
- iPhone: open in Safari, tap Share, then **Add to Home Screen**. For supported iOS Web Push, use the installed Home Screen app.
- Open Locat online once before relying on cached offline history. Tailscale must still be connected for sending/receiving.
- Optional notifications require server VAPID setup plus browser permission: follow [the exact native/Docker commands](NOTIFICATIONS.md). Notifications are best effort and show generic alerts rather than message content.

## 8. Backups, updates and stopping the server

There are two separate backups: **browser chat history** and **server accounts/metadata**. A server backup does not contain everyone's device-local message history.

1. Each user: Settings → History & backups → export with a separate backup password. Save it outside browser storage. Export before clearing site data, changing phones or changing server addresses. Current history archives are bound to the account and server origin; a hostname migration needs recovery planning, not just copying the server database.
2. Host: preserve `.env` privately and follow [server backup/recovery](SERVER_ADMIN.md). Verify a recovery copy before updating. Never run the integration tests against your real database.
3. Pi: from the original source checkout (not `/opt/locat`), run `git pull --ff-only` then `sudo bash scripts/install-pi.sh`. Keep your existing deployed `.env` and database.
4. Native Linux: back up, stop Locat, update the checkout, then run `npm ci`, `npm run db:setup`, `npm run build` as the `locat` user from `/opt/locat`, and restart the service. Check `/api/ready` and `npm run doctor`. Native manual updates do not provide the Pi installer's staged rollback.
5. Docker: back up and retain `.env`/the database volume, then `git pull --ff-only` and `docker compose up -d --build`. Check `docker compose ps` and `docker compose exec app npm run doctor`.
6. After updates, close all Locat windows and reopen so the updated service worker can activate. Recheck messaging before inviting more users.

## 9. If something does not work

| Symptom | What to check |
|---|---|
| Friend cannot open Locat | Host powered on; both Tailscale connections online; invitation accepted by the account used on the friend's device; full HTTPS hostname; access policies permit HTTPS |
| HTTPS setup prints an authorization link | Open it with the host's Tailscale account and complete the HTTPS prompt |
| Browser encryption/sign-in fails | Use the exact HTTPS Serve address; check PUBLIC_ORIGIN matches; do not bypass certificate warnings |
| Readiness fails | Native: `sudo journalctl -u locat -n 100 --no-pager`; Docker: `docker compose logs --tail=100 app db` |
| Port 3000 already occupied | Stop the conflicting app or configure a different Locat port and matching Serve target; do not kill unrelated processes blindly |
| Database authentication fails | Check your existing credentials privately; restore the correct `.env`; do not reset/drop the database |
| Docker shows a fresh empty account list after moving folders | Check Compose project name/volume selection; recover the original volume rather than registering replacements |
| Saved history missing on a new phone | History stays on the original device; restore its encrypted archive using the documented account/origin requirements |
| Another login logs out the first device | Current delivery is account-scoped with one active login; reliable independent multi-device delivery is not implemented |

## Sources and verification

Checked against repository installer, Compose, environment, start and notification scripts on 2026-10-07. Pi and friend Tailscale access have user-reported device acceptance. These expanded written recipes have not all been executed on fresh physical hosts; generic Linux and Windows/macOS Docker acceptance remain pending.

- [Tailscale installation](https://tailscale.com/download/linux)
- [Tailscale Serve](https://tailscale.com/kb/1312/serve)
- [Sharing machines](https://tailscale.com/kb/1084/sharing)
- [Sharing vs inviting a whole-network member](https://tailscale.com/docs/reference/inviting-vs-sharing)
- [Docker Engine by distribution](https://docs.docker.com/engine/install/)
- [Docker Compose installation](https://docs.docker.com/compose/install/)
