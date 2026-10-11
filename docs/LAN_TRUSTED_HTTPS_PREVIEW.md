# Trusted HTTPS LAN deployment (preview, 2026-10-12)

The default LAN overlay uses a private CA. Signed Android WebViews may reject
it even when the user installs that CA. Never disable TLS verification.

For Windows and Android use an **already issued, publicly trusted** TLS
certificate for a DNS hostname you control (e.g. locat.example.com).
Use split-horizon DNS so the name resolves to the Windows/Pi host's reserved
LAN IP from all clients. ACME DNS-01 can issue certificates without exposing
the LAN server to the public Internet, but this project does not automate
certificate issuance or renewal.

Place `fullchain.pem` and `privkey.pem` in a host-owned directory outside
the repository. Restrict access to the private key. In the private .env set:

- `LOCAT_LAN_HOST=locat.example.com`
- `PUBLIC_ORIGIN=https://locat.example.com`
- `LOCAT_CERT_DIR` to an absolute certificate directory path; e.g.
  `C:/locat-certs` (Windows Docker Desktop) or `/srv/locat-certs` (Pi).

Do not overwrite existing database credentials. In an isolated checkout run:

```bash
docker compose -f compose.yaml -f compose.lan.yaml -f compose.lan.trusted.yaml config --quiet
docker compose -f compose.yaml -f compose.lan.yaml -f compose.lan.trusted.yaml up -d --build
docker compose -f compose.yaml -f compose.lan.yaml -f compose.lan.trusted.yaml ps
```

The third Compose file overrides the proxy Caddyfile and adds read-only
certificate mounts. The original persistent MariaDB volume is retained and
backend port 3000 stays loopback-only. Do not start a second stack against
the same database. Supplied certificates require **operator-managed renewal**
and proxy reload/restart.

Check `https://locat.example.com/api/ready` on Windows and Android with
normal certificate validation before logging in. No HTTP fallback or `curl -k`.
Restrict inbound TCP 443 to the trusted LAN. Android, Windows and Raspberry Pi 5
runtime acceptance remain NOT TESTED. For Pi 5, verify 64-bit `aarch64`,
Docker Compose availability and actual application/image ARM64 compatibility;
a multi-arch Node base alone is not proof.
