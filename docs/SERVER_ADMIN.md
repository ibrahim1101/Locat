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

The tools are local terminal commands, authorized by access to the installation's database credentials. There is no publicly exposed administrator API. Account deletion is intentionally excluded because conversation ownership and identity recovery need a separate, reviewed workflow.

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
