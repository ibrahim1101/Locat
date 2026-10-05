# Locat review

## Product direction

Mobile-first messaging with device-local archives, browser-side encryption, and
a self-hosted server for identity, conversation membership, realtime connections,
and temporary encrypted delivery. The current implementation is a responsive web
app with an installable offline PWA; native mobile packages remain future work.

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
directory, direct and owner-managed group conversations, encrypted text/image
envelopes, SSE subscriptions and presence, queued offline delivery, acknowledgements,
IndexedDB history, password-encrypted identity backup, and contact fingerprints
are present in code. Database integration is tested; full real-browser end-to-end behavior remains unverified here.

## Prioritized remaining work

1. **Device data safety:** browser history is plaintext at rest. Add optional local encryption and larger/portable archives. Keep encrypted backups before clearing browser data.
2. **Independent devices:** one active session is enforced and the outbox is durable. Add device identities and per-device encrypted delivery before supporting simultaneous logins.
3. **Device acceptance:** test mobile keyboards, installation, offline reopening, background notifications and group controls on real Android/iOS devices.
4. **Operations:** improve formal migration tracking, recovery drills, storage alerts and automated backup scheduling. Validate native Windows/macOS installations on those systems.
5. **Richer messaging:** file/audio payloads and calls require separate size, storage and encryption design.

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
release: physical-device acceptance and independent-device delivery remain follow-up work.

## October mobile and administration batch

Implemented: account-local durable outbox with atomic confirmation, build-versioned static PWA cache that excludes APIs, cached offline conversations/account bootstrap, theme and installation settings, chat/message search, quoted replies/copy/local deletion, accessible full-screen media dialog, first-use contact-key pinning with explicit changed-key verification, single-active-session policy, account disable/session revocation CLI, metadata backup command, authentication throttling/origin checks, encrypted sender queue limit, portable Docker deployment and CI smoke job. Lodash updated; the production dependency audit currently reports zero vulnerabilities.

Validation: TypeScript/build/lint and MariaDB integration pass locally. Phone keyboard/install/offline service-worker behavior still requires physical-device QA after this update. Container smoke verification runs in CI; Windows/macOS and phone-server hosting have not been physically tested. No claim of finished public-release readiness: durable per-device delivery, richer encrypted payloads, and calls/native distribution remain separate work. Group key versions and optional Web Push were added in the subsequent batch below.


## Browser administration batch

Added explicit server-granted admin roles, fresh authorization checks on every admin operation, paginated public-safe account/audit lists, password-confirmed account actions/cleanup/backups, host/database statistics, encrypted metadata export, and transactional empty-database restoration. Roles cannot be granted from the GUI; administrator accounts cannot be disabled through GUI controls. Private network access remains an operator responsibility. Action history is not tamper-proof. Browser visual QA is still required on actual devices.

## Push and group management batch

Implemented opt-in session-bound Web Push, generic alerts, provider destination allowlisting, local account checks in the service worker, key setup without printing secrets, and subscription revocation/cleanup. Push delivery still needs real-device testing with configured VAPID keys.

Implemented group-owner member/name controls, ownership transfer, leave, encrypted key versions with wrapper public-key snapshots, historical key access scoped to current members, fresh keys for membership changes, and sending pauses after voluntary departure. Transactions lock group state against sends; removed queued deliveries are deleted. Archived local metadata preserves readable departed histories. Metadata backups/restores include key versions. These controls cannot revoke previously downloaded copies or provide forward secrecy.

Validation for this batch: 27 unit/MariaDB integration tests pass, including actual group-key wrapping/decryption across membership changes, historical key restrictions, archived metadata, and encrypted metadata recovery. Service-worker checks verify generic notifications and suppression after sign-out/account mismatch. Production dependency audit reports zero vulnerabilities. Pi push-key setup writes protected configuration and refuses accidental key replacement. Physical phone notification delivery and group UI layout remain unverified.

## Portable startup and installation diagnostics

`npm start` now uses a Node launcher instead of Unix shell environment assignment, enabling native Windows startup. `npm run doctor` checks runtime, built files, port/origin settings, optional push consistency and database/schema readiness without modifying the database or printing credentials. The admin route loads separately from the initial chat bundle. Native Windows/macOS execution still needs platform acceptance testing.
