import 'dotenv/config';
import { open, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const path = process.argv[2];
if (!path || !process.env.DATABASE_URL) throw new Error('Usage: npm run backup:server -- /secure/path/locat-metadata.sql (DATABASE_URL required)');
const url = new URL(process.env.DATABASE_URL);
const database = url.pathname.slice(1);
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
const file = await open(path, 'wx', 0o600);
try {
  const args = ['--single-transaction', '--skip-lock-tables', '--protocol=TCP',
    `--host=${url.hostname}`, `--port=${url.port || 3306}`, `--user=${decodeURIComponent(url.username)}`,
    ...['sessions', 'messages', 'message_deliveries', 'send_receipts', 'push_subscriptions'].map(table => `--ignore-table=${database}.${table}`), database];
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.MARIADB_DUMP || 'mariadb-dump', args, {
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ['ignore', file.fd, 'inherit'],
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Database backup failed (${code})`)));
  });
  console.log(`Metadata backup written to ${path}. Protect this file: it contains password hashes and encrypted identity backups.`);
} catch (error) { await file.close(); await unlink(path); throw error; }
finally { await file.close().catch(() => {}); }
