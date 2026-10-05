#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'TEXT'
Locat installer for Raspberry Pi OS Lite/Desktop (64-bit, Debian 12 or newer).
Run from a cloned Locat checkout: sudo bash scripts/install-pi.sh

Installs /opt/locat, creates the locat system user and local MariaDB database,
builds the app, and enables locat.service. Re-run from an updated checkout to
update. Existing /opt/locat/.env and database contents are preserved.

If upgrading an earlier manual install, first copy its .env to /opt/locat/.env.
The installer will then use that database instead of creating a replacement.
HTTPS setup is a separate step; see docs/RASPBERRY_PI.md.
TEXT
}
if [[ "${1:-}" == "--help" ]]; then usage; exit 0; fi
if [[ $# -ne 0 ]]; then usage >&2; exit 1; fi
if [[ "$EUID" -ne 0 ]]; then echo "Run: sudo bash scripts/install-pi.sh" >&2; exit 1; fi
if [[ "$(uname -m)" != "aarch64" ]]; then
  echo "This installer needs 64-bit Raspberry Pi OS (aarch64). Install the 64-bit OS first." >&2; exit 1
fi
if [[ ! -f /etc/os-release ]]; then echo "Cannot identify the operating system." >&2; exit 1; fi
. /etc/os-release
if [[ "${ID:-}" != "debian" && "${ID:-}" != "raspbian" ]]; then
  echo "Supported OS: 64-bit Raspberry Pi OS based on Debian 12 or newer." >&2; exit 1
fi
if [[ "${VERSION_ID:-0}" == "" || "${VERSION_ID%%.*}" -lt 12 ]]; then echo "Debian 12 or newer is required." >&2; exit 1; fi
if ! command -v systemctl >/dev/null || [[ ! -d /run/systemd/system ]]; then
  echo "Run on your Pi's normal systemd boot, not inside a container." >&2; exit 1
fi

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR=/opt/locat
if [[ ! -f "$SOURCE_DIR/package-lock.json" || ! -f "$SOURCE_DIR/scripts/setup-db.mjs" ]]; then
  echo "Run the installer from a complete Locat checkout." >&2; exit 1
fi
# A manual checkout's .env is important: never silently replace its database.
if [[ ! -e "$APP_DIR/.env" && -f "$SOURCE_DIR/.env" ]]; then
  install -d -m 755 "$APP_DIR"
  install -m 600 "$SOURCE_DIR/.env" "$APP_DIR/.env"
fi

echo "Installing system dependencies…"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg rsync mariadb-server python3
if [[ ! -x /usr/bin/node ]] || ! /usr/bin/node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a===22&&b>=12)||a>=24?0:1)' ; then
  # Install Node 22 from its signed APT repository without piping a script to a shell.
  install -d -m 755 /etc/apt/keyrings
  NODE_KEY_FILE="$(mktemp)"
  curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key -o "$NODE_KEY_FILE"
  gpg --batch --yes --dearmor -o /etc/apt/keyrings/locat-nodesource.gpg "$NODE_KEY_FILE"
  rm -f "$NODE_KEY_FILE"
  echo 'deb [arch=arm64 signed-by=/etc/apt/keyrings/locat-nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' > /etc/apt/sources.list.d/locat-node.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
if [[ ! -x /usr/bin/npm ]]; then echo "Node is installed but npm is missing. Install npm and rerun." >&2; exit 1; fi
systemctl enable --now mariadb
if ! id locat >/dev/null 2>&1; then
  useradd --system --user-group --create-home --home-dir /var/lib/locat --shell /usr/sbin/nologin locat
fi
install -d -o locat -g locat -m 750 "$APP_DIR"

if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "Creating the local Locat database and a random database password…"
  DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  # Do not reset a database user's password on a reinstall with a lost env file.
  if [[ "$(mariadb --batch --skip-column-names -e "SELECT COUNT(*) FROM mysql.user WHERE User = 'locat' AND Host = 'localhost'")" != "0" ]]; then
    echo "A locat database user already exists. Restore your .env to /opt/locat/.env before rerunning." >&2; exit 1
  fi
  mariadb <<SQL
CREATE DATABASE IF NOT EXISTS locat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'locat'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON locat.* TO 'locat'@'localhost';
SQL
  umask 077
  cat > "$APP_DIR/.env" <<ENV
DATABASE_URL=mysql://locat:$DB_PASSWORD@127.0.0.1:3306/locat
PORT=3000
HOST=127.0.0.1
COOKIE_SECURE=true
ENV
  unset DB_PASSWORD
fi
chown locat:locat "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
# Build separately. A dependency/build failure leaves the running release intact.
BUILD_DIR="$(mktemp -d /opt/.locat-build.XXXXXX)"
PREVIOUS_DIR=""
SWITCHED=false
cleanup() {
  code=$?
  if [[ "$code" -ne 0 && "$SWITCHED" == true && -n "$PREVIOUS_DIR" && -d "$PREVIOUS_DIR" ]]; then
    echo "Deployment failed; restoring the previous release…" >&2
    rm -rf -- "$APP_DIR"
    mv -- "$PREVIOUS_DIR" "$APP_DIR"
    systemctl restart locat || true
  fi
  if [[ -n "$BUILD_DIR" && -d "$BUILD_DIR" ]]; then rm -rf -- "$BUILD_DIR"; fi
  exit "$code"
}
trap cleanup EXIT
rsync -a --exclude=.git --exclude=node_modules --exclude=dist --exclude='.env*' "$SOURCE_DIR/" "$BUILD_DIR/"
install -o locat -g locat -m 600 "$APP_DIR/.env" "$BUILD_DIR/.env"
chown -R locat:locat "$BUILD_DIR"
chmod 750 "$BUILD_DIR"
cd "$BUILD_DIR"
echo "Installing dependencies, upgrading the schema, and building Locat…"
runuser -u locat -- /usr/bin/npm ci
runuser -u locat -- /usr/bin/npm run db:setup
runuser -u locat -- /usr/bin/npm run build
runuser -u locat -- /usr/bin/npm prune --omit=dev

NODE_BIN=/usr/bin/node
PREVIOUS_DIR="$(mktemp -d /opt/.locat-previous.XXXXXX)"
rmdir "$PREVIOUS_DIR"
mv -- "$APP_DIR" "$PREVIOUS_DIR"
mv -- "$BUILD_DIR" "$APP_DIR"
BUILD_DIR=""
SWITCHED=true
cd "$APP_DIR"
cat > /etc/systemd/system/locat.service <<UNIT
[Unit]
Description=Locat mobile messenger
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=locat
Group=locat
WorkingDirectory=/opt/locat
ExecStart=$NODE_BIN /opt/locat/dist/boot.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/locat
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable locat
systemctl restart locat
echo "Locat installed. Checking the configured port…"
LOCAT_PORT="$(runuser -u locat -- /usr/bin/node --input-type=module -e 'import "dotenv/config"; console.log(process.env.PORT || "3000")')"
for attempt in {1..15}; do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:$LOCAT_PORT/api/ready" >/dev/null; then
    echo "Locat is ready. Next: configure HTTPS using docs/RASPBERRY_PI.md."
    echo "Logs: sudo journalctl -u locat -n 100 --no-pager"
    rm -rf -- "$PREVIOUS_DIR"
    PREVIOUS_DIR=""
    exit 0
  fi
  sleep 1
done
echo "Locat did not become ready. Check: sudo journalctl -u locat -n 100 --no-pager" >&2
exit 1
