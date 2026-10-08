#!/usr/bin/env bash
# Locat manual GitHub -> Raspberry Pi deployment. Run as root.
set -Eeuo pipefail
umask 077
REPO="https://github.com/ibrahim1101/Locat"
REF="${1:-feat/locat-1.0}"
LIVE="/opt/locat"
SERVICE="locat.service"
LOCK="/run/lock/locat-deploy.lock"
exec 9>"$LOCK"
flock -n 9 || { echo "Another deployment is running."; exit 1; }
[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }
[[ -f "$LIVE/.env" && -f "$LIVE/package.json" ]] || { echo "Existing installation missing; aborting."; exit 1; }
for tool in curl tar rsync npm systemctl; do command -v "$tool" >/dev/null || { echo "Missing $tool"; exit 1; }; done
WORK="$(mktemp -d /opt/locat-deploy.XXXXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src" "$WORK/backup"
echo "Downloading $REF..."
curl --fail --location --retry 3 --silent --show-error "$REPO/archive/$REF.tar.gz" -o "$WORK/source.tar.gz"
tar -xzf "$WORK/source.tar.gz" --strip-components=1 -C "$WORK/src"
[[ -f "$WORK/src/package-lock.json" && -f "$WORK/src/api/boot.ts" ]] || { echo "Incomplete source archive."; exit 1; }
echo "Building isolated release..."
(cd "$WORK/src" && npm ci && npm run check && npm run build)
echo "Saving rollback snapshot (excluding secrets and runtime database)..."
rsync -a --exclude='.env' --exclude='.git/' --exclude='node_modules/' --exclude='dist.backup-*/' --exclude='*.sqlite*' --exclude='*.db' "$LIVE/" "$WORK/backup/"
# Preserve existing deployment and runtime data; no --delete, no database migrations.
echo "Installing built release..."
rsync -a --exclude='.env' --exclude='.git/' --exclude='dist.backup-*/' --exclude='*.sqlite*' --exclude='*.db' "$WORK/src/" "$LIVE/"
chown -R locat:locat "$LIVE"
if ! (cd "$LIVE" && npm run doctor); then
  echo "Doctor failed; restoring previous application files..."
  rsync -a "$WORK/backup/" "$LIVE/"
  chown -R locat:locat "$LIVE"
  exit 1
fi
echo "Restarting service..."
systemctl restart "$SERVICE"
sleep 3
if ! systemctl is-active --quiet "$SERVICE" || ! curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/ready >/dev/null; then
  echo "Health check failed; rolling back application files..."
  rsync -a "$WORK/backup/" "$LIVE/"
  chown -R locat:locat "$LIVE"
  systemctl restart "$SERVICE" || true
  exit 1
fi
echo "Deployment successful. Service is active; database and .env untouched."
