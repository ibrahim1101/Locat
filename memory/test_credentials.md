# Locat 2.0 — local disposable test credentials

> Local development only. Disposable MariaDB `locat_dev` (never the Pi / production).
> The first registered account is NOT an admin by default; promote via `npm run admin` if needed.

## Database
- DATABASE_URL: mysql://locat_dev:dev-only-disposable@127.0.0.1:3306/locat_dev
- Dev server: http://localhost:3000 (`npm run dev`)

## Test accounts (created via UI registration)
| Display name | Username | Password | LC code |
|---|---|---|---|
| Sentinel Admin | sentinel_admin | ember-matte-2026 | (assigned at register) |
| Ember User | ember_user | ember-matte-2026 | (assigned at register) |

Registration password policy: ≥ 8 chars, not the username, no common passwords.
Accounts are local to this disposable DB and are recreated as needed.
