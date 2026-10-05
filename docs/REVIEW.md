# Locat review

## Product direction

Mobile-first messaging with device-local archives, browser-side encryption, and
a self-hosted server for identity, conversation membership, realtime connections,
and temporary encrypted delivery. The current implementation is a responsive web
app, not a native mobile app or an installable offline PWA.

## Implemented

- Installation: replace unavailable private mirror URLs in the lockfile; remove
  the template inspection plugin; declare a supported Node version.
- Build: restore the missing React entry point and stylesheet, and move client
  folders into src so imports resolve.
- Production: serve the built UI and SPA fallback from the actual output folder;
  externalize server dependencies to avoid bundling dependency runtime internals.
- Configuration: remove unused APP_ID and APP_SECRET requirements and correct
  Raspberry Pi instructions, naming, and service examples.
- Mobile basics: restore theme tokens, safe-area padding, touch targets, and avoid
  input zoom on iOS. Display Locat on login and in browser metadata.
- Messaging: serialize deduplication in an IndexedDB transaction and avoid storing
  optimistic pending state in confirmed messages.
- Reliability: commit envelope/deliveries/retry receipts in one transaction, serialize
  direct conversation creation, rollback incomplete groups, enforce owned acknowledgements,
  paginate backlog and limit media reads/responses, and serialize client delivery handling.
- Local history: account-specific databases and unread state, verified legacy migration,
  query-cache cleanup and cross-tab session-change reloads, encrypted history export/import,
  persistent-storage requests and usage feedback.
- Installation: add the ARM64 Pi OS installer, staged application updates with rollback,
  automatic systemd startup, additive database setup and readiness checks. Use explicit
  bigint IDs instead of serial declarations that generated invalid MariaDB DDL.
- Validation: add browser-storage, backup and MariaDB tests plus CI.

## Existing implementation

Username/password registration and login, database-backed sessions, public-key
directory, direct and fixed-membership group conversations, encrypted text/image
envelopes, SSE subscriptions and presence, queued offline delivery, acknowledgements,
IndexedDB history, password-encrypted identity backup, and contact fingerprints
are present in code. Full database and browser end-to-end behavior has not been
verified in this environment.

## Prioritized remaining work

1. **Local data safety:** IndexedDB archives are still plaintext at rest. Backup files
   are encrypted, but password recovery for them is impossible. Backups are currently
   limited to 50 MB and the same account/server origin; add larger/portable archives.
   Account scoping prevents accidental mixing, not access by someone who controls the
   browser profile. Legacy data remains in place for recovery.
2. **Device delivery and durable outbox:** acknowledgements are still per account;
   multiple devices may miss messages when another acknowledges first. Pending sends
   and their retry IDs currently live in memory, not a durable outbox. Explicit retries
   within a running page are deduplicated for seven days. Add device identities,
   per-device delivery or enforced single-active-device sessions, and a persistent outbox.
3. **Key lifecycle:** pin verified public keys, warn on changes, invalidate cached
   keys, and implement group-key rotation. The current identity-reset option can
   wrap a new key with a password different from the account's login password.
   Use authenticated password confirmation and an explicit coordinated rotation.
4. **Authentication and abuse:** add rate limits, input size limits for key bundles,
   origin checks, secure cookies over HTTPS, queue expiry/quotas, and bounded sync
   responses. Auth responses currently also expose the session token to JavaScript.
5. **Mobile experience:** PWA manifest/icons, offline app shell, network/reconnect
   states, visible send failures, archive management, and optional push notifications.
   SSE only receives messages while the app page runs; mobile background delivery
   requires a separate push design that does not expose message content.
6. **Operations:** physical Raspberry Pi/systemd testing, real Android/iOS QA,
   encrypted metadata backups, and formal migration tracking for future schema revisions.

## Encryption limits

There is no forward secrecy or double ratchet. The server sees membership, timing,
sizes and identity metadata. A malicious server can replace frontend JavaScript
or directory keys; the server-only-sees-ciphertext claim assumes honest app delivery
and independent fingerprint verification. Generated identity keys are extractable
for backup; restored private keys are non-extractable. Local archive encryption at
rest is not implemented.

Old crypto salts remain to preserve decryption compatibility. The old IndexedDB
archive is only read for a membership-filtered migration to account-specific databases;
it is not deleted. Renaming crypto salts blindly would break existing ciphertext.

## Validation

Production builds and TypeScript checks pass. ESLint has no errors, with development
fast-refresh warnings for shared exports. Unit tests cover direct/group encryption,
identity backups, encrypted history backups, account isolation, legacy migration,
concurrent IndexedDB deduplication, and import merging. MariaDB 10.11 integration
checks registration/login, concurrent direct-chat creation, encrypted delivery,
authorization, acknowledgement cleanup, retries after deletion, rollback on failed
delivery/group insertion, >500-message pagination, media response budgets, and
additive upgrade preservation.

The Pi installer passes Bash syntax/help checks; it has not run on physical ARM64
hardware or systemd here. Browser automation could not run here because the Chromium download was unavailable;
physical Android/iOS QA remains outstanding. This is the reliability/storage/deployment foundation, not a finished public
release: PWA/background delivery and abuse controls remain follow-up work.
