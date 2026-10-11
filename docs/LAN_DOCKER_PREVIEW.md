# Locat LAN preview

Run `docker compose -f compose.yaml -f compose.lan.yaml config --quiet` to validate the optional LAN HTTPS overlay. The overlay uses Caddy's internal CA, which requires explicit client trust. Android release compatibility and Raspberry Pi ARM64 deployment remain unverified.

## Host requirements

Use a separate checkout. Windows requires Docker Desktop with Linux containers. Raspberry Pi 5 requires 64-bit Linux, Docker Engine and Compose. ARM64 container compatibility has not yet been tested. Preserve any existing server installation and its database.

Create a private .env with the database passwords described in docs/INSTALLATION.md. Set LOCAT_LAN_HOST to the stable LAN IP or hostname and PUBLIC_ORIGIN to the matching https:// origin.

## Start the preview

Run these commands from the isolated checkout after configuring .env:

```bash
docker compose -f compose.yaml -f compose.lan.yaml config --quiet
docker compose -f compose.yaml -f compose.lan.yaml up -d --build
docker compose -f compose.yaml -f compose.lan.yaml ps
docker compose -f compose.yaml -f compose.lan.yaml logs --tail=80 app lan-proxy
docker compose -f compose.yaml -f compose.lan.yaml exec app npm run doctor
```

Keep TCP 443 restricted to your trusted LAN. Port 3000 stays loopback-only and MariaDB is not published.
