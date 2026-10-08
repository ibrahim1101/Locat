# GitHub → Raspberry Pi manual deployment

Use the reviewed script at `scripts/deploy-pi.sh` to deploy branch `feat/locat-1.0` to an existing `/opt/locat` installation. **Manual only**; no automatic deployment on GitHub push.

## First-time use

On the Pi, inspect the script before running it:

```bash
curl -fL https://raw.githubusercontent.com/ibrahim1101/Locat/feat/locat-1.0/scripts/deploy-pi.sh -o /tmp/locat-deploy.sh
less /tmp/locat-deploy.sh
sudo bash /tmp/locat-deploy.sh
```

Future releases: run the same commands after reviewing changes. Optionally supply a commit SHA as the script argument instead of a branch name for reproducibility.

The script checks prerequisites, downloads a GitHub source archive (no `.git` needed), runs `npm ci`, TypeScript checks and build in a temporary directory, snapshots application files, copies the new build without deleting existing runtime files, runs the read-only `npm run doctor`, restarts `locat.service`, and checks `/api/ready`. If validation or health fails, it restores application files.

**Important limits:** The rollback snapshot is temporary and removed when the command exits; keep independent backups. The script intentionally does **not** run schema migrations, update `.env`, or back up/restore MariaDB. For schema-changing releases, back up the database separately and follow a migration plan before deploying. Existing app files are not deleted; obsolete files may remain. A deployment that requires changed secrets or schema must be handled separately. Run as root only on your own trusted Pi and review repository changes before executing.

This script assumes the existing service account is `locat`, the service is `locat.service`, and its health endpoint is `http://127.0.0.1:3000/api/ready`.
