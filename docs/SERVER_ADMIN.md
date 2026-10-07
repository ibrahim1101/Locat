# Locat server administration

Locat uses MariaDB. Accounts contain a salted scrypt password hash, a public encryption key, and a password-encrypted private-key backup. Sessions, conversation membership, and retry receipts are also server metadata. Messages are encrypted envelopes in a delivery queue, removed when acknowledged. Decrypted chat history is stored on each user's device.

Do not edit password hashes manually. Resetting an authentication password alone will not unlock a private-key backup encrypted with the old password. There is no admin ability to read decrypted conversations or recover a forgotten encryption password.

## Raspberry Pi commands

Run these from `/opt/locat` as the service user so the protected `.env` can be read:

```bash
cd /opt/locat
sudo -u locat npm run admin -- users
sudo -u locat npm run admin -- stats
sudo -u locat npm run admin -- disable username
sudo -u locat npm run admin -- enable username
sudo -u locat npm run admin -- revoke-sessions username
sudo -u locat npm run admin -- cleanup
```

Disable blocks login and invalidates sessions. Enabling does not restore old sessions. Active streams recheck session validity every 30 seconds. Cleanup expires sessions, seven-day retry receipts, and encrypted messages still undelivered after 30 days. Run cleanup regularly; expiration deliberately means recipients offline longer than 30 days can miss queued messages.

One active login per account is enforced until per-device delivery queues are implemented. Signing in elsewhere ends the old session. Locally saved history remains on the old device. This prevents one device acknowledging and deleting a message before another device receives it.

Terminal tools require access to the installation's database credentials. The browser dashboard uses authenticated administrator-only API routes; regular accounts cannot use them. Account deletion is intentionally excluded because conversation ownership and identity recovery need a separate, reviewed workflow.

## Metadata backup

Create a restricted directory, then make a backup. The host needs `mariadb-dump` (`mariadb-client` on Debian).

```bash
sudo install -d -m 700 -o locat -g locat /var/lib/locat/backups
cd /opt/locat
sudo -u locat npm run backup:server -- /var/lib/locat/backups/locat-metadata.sql
```

The command creates a new file with mode 600 and refuses to overwrite an existing file. It excludes sessions, retry receipts, and message queues. It includes accounts and group metadata, including password hashes and encrypted key backups. Store it securely, preferably encrypted on an offline backup drive. Keep a separate secure copy of your deployment configuration. Never post `.env`, SQL backups, session tokens, or password hashes in support messages.

For recovery on a fresh Pi: install Locat, stop the service, restore into the fresh `locat` database, then run the additive setup and restart:

```bash
sudo systemctl stop locat
sudo mariadb locat < /secure/path/locat-metadata.sql
cd /opt/locat
sudo -u locat npm run db:setup
sudo systemctl start locat
```

Test recovery on a disposable database first. Restoring a dump replaces included tables; never run it against a working database without a separate current backup. Users must log in again. Their local chat archives are not restored by a server backup; those need `.locat` backups from their own devices.


## Browser dashboard

After updating Locat, grant your existing account administrator access on the server:

```bash
cd /opt/locat
sudo -u locat npm run admin -- grant-admin YOUR_USERNAME
```

Refresh Locat and open `/admin` on the same HTTPS address. A Server administration link also appears after your account profile reloads. The dashboard provides searchable/paginated account controls, session revocation, server/database/queue statistics, encrypted metadata backup downloads, cleanup, and an administrator action log. Mutations require your administrator login password again. It does not display password hashes, session tokens, private-key backups, or chat contents. Administrator accounts and role grants are managed only from the terminal, preventing accidental self-lockout in the dashboard.

Keep the deployment on your private Tailscale network. Administrator roles protect API access, but they are not a network access restriction. If you later expose the chat service publicly, restrict both `/admin` and `/api/trpc/admin.*` at the reverse proxy or place administration on a private listener; hiding only the page does not hide its API.

To revoke administrator access and sessions:

```bash
sudo -u locat npm run admin -- revoke-admin YOUR_USERNAME
```

The action log records successful dashboard mutations and terminal account/role changes. It is a database log, not a tamper-proof audit service; the database owner can modify it. Host storage/memory metrics may reflect the container or its underlying host.

## Restore an encrypted dashboard backup

Dashboard downloads use the `.locat-server` extension and a separate backup password of at least 12 characters. They include account credentials as password hashes, encrypted identity backups, group membership/key versions, profile/privacy settings, pending/accepted friend relationships and blocked-user choices inside authenticated encryption. They exclude sessions, push subscriptions, queued messages, retry receipts, and action logs. Keep the backup password separately; Locat cannot recover it.

New backups preserve removed friends even when their old conversation remains. Older backups without friend metadata reconstruct accepted friendships from direct conversations; older backups without blocked-user metadata cannot restore those choices, so reapply blocks after recovery. Repeating database setup does not recreate removed friendships. Server backups cannot restore device chat history.

On a fresh installation with no accounts, stop the application and run database setup before restore. Restore refuses any nonempty account/conversation/message/session database and runs in one transaction. The current working deployment must never be the restore target.

```bash
sudo systemctl stop locat
cd /opt/locat
sudo -u locat npm run db:setup
sudo -u locat bash
read -s -r -p "Backup password: " LOCAT_BACKUP_PASSWORD
export LOCAT_BACKUP_PASSWORD
npm run restore:server -- /secure/path/Locat-server.locat-server
unset LOCAT_BACKUP_PASSWORD
exit
sudo systemctl start locat
```

Use the exact downloaded filename. Restore expects a backup from this metadata format; `.locat` device-history files and SQL dumps use their own restore workflows. Restored administrator roles are retained, but all users must log in again. Device chat histories still require their own backups.
