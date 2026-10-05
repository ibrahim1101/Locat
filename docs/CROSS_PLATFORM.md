# Hosting Locat beyond Raspberry Pi

Clients use the HTTPS web app on Windows, Linux, macOS, Android, and iOS. A Raspberry Pi is only one hosting option; users do not need their own server.

## Docker Compose

This repository includes a Node.js application image and MariaDB Compose deployment for Linux servers and Docker Desktop on Windows/macOS. Docker Desktop includes Compose; Linux servers can use Docker Engine with the Compose plugin. See https://docs.docker.com/compose/install/.

1. Clone the repository and install Docker with Compose.
2. Create `.env` in the repository with two different random passwords, using only hexadecimal letters/numbers (at least 32 characters each) so the database URL is safe. Do not reuse your login password.

```dotenv
LOCAT_DB_PASSWORD=REPLACE_WITH_RANDOM_HEX_PASSWORD
LOCAT_DB_ROOT_PASSWORD=REPLACE_WITH_DIFFERENT_RANDOM_HEX_PASSWORD
# Set to your actual HTTPS address, with no trailing slash:
PUBLIC_ORIGIN=https://your-locat-host.example
```

3. Start the deployment:

```bash
docker compose up -d --build
docker compose logs --tail=50 app
docker compose ps
```

Locat is bound to host loopback port 3000. Put Tailscale Serve or an HTTPS reverse proxy in front of it. Secure cookies are enabled; use the HTTPS address for login. Do not expose MariaDB to the internet. Preserve the `locat-db` volume. `docker compose down` retains it; **never use `down -v` on an installation you want to keep**.

Administration:

```bash
docker compose exec app npm run admin -- users
docker compose exec app npm run admin -- stats
docker compose exec app npm run admin -- disable username
docker compose exec app npm run admin -- revoke-sessions username
docker compose exec app npm run admin -- cleanup
```

Update after making a database backup:

```bash
git pull
docker compose up -d --build
```

The container runs as an unprivileged user and waits for MariaDB readiness. Database setup is additive. The Docker path is provided but has not yet been runtime-tested on Windows/macOS in this development environment. The Pi installer remains the physically tested deployment path.

## Native Node.js deployment

Node.js 22.12+ (or supported Node.js 24+) and MariaDB can also run without Docker on Linux, Windows, or macOS. Configure `.env` using `.env.example`, then run:

```bash
npm ci
npm run db:setup
npm run build
```

For a cross-platform production launch, set `NODE_ENV=production` using your service manager and execute `node dist/boot.js`. The `npm start` shell assignment is Linux/macOS-specific. Use a service manager appropriate to the host and an HTTPS proxy; the Pi systemd installer is specifically for Debian-based ARM64 Raspberry Pi systems.

## Hosting on a phone

Android hosting through Termux is experimental: it needs Node.js, MariaDB, uninterrupted power/network, and protection from battery/background termination. It is not included as a supported one-click installer. iOS background execution restrictions make a persistent Node/MariaDB relay impractical. Both phone platforms are supported as clients; use an always-on Pi, PC, VPS, or other Linux server for dependable hosting.
