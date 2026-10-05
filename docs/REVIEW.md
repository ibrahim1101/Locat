# Locat review

## Product direction

Mobile-first messaging with device-local archives, browser-side encryption, and
a self-hosted server for identity, conversation membership, realtime connections,
and temporary encrypted delivery. The current implementation is a responsive web
app, not a native mobile app or an installable offline PWA.

## Repaired in this change

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
- Validation: add direct/group encryption and identity restore tests plus CI.

## Existing implementation

Username/password registration and login, database-backed sessions, public-key
directory, direct and fixed-membership group conversations, encrypted text/image
envelopes, SSE subscriptions and presence, queued offline delivery, acknowledgements,
IndexedDB history, password-encrypted identity backup, and contact fingerprints
are present in code. Full database and browser end-to-end behavior has not been
verified in this environment.

## Prioritized remaining work

1. **Local data safety:** history is plaintext in IndexedDB and is shared across
   accounts on the same browser origin. Scope archives/unread state per account,
   implement export/import, request persistent storage, and expose storage status.
   Account changes must also reset React Query caches.
2. **Delivery integrity:** queue rows are per account, not per device. The first
   device to acknowledge can remove another device's backlog. Use device identities
   and acknowledgements or explicitly support one active device per account.
   Sending and conversation creation need database transactions. The 500-message
   sync limit can strand later messages behind undecryptable queued messages.
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
6. **Operations:** automated MariaDB integration tests, repeatable schema migrations,
   database readiness checks, encrypted metadata backups, and real Android/iOS QA.

## Encryption limits

There is no forward secrecy or double ratchet. The server sees membership, timing,
sizes and identity metadata. A malicious server can replace frontend JavaScript
or directory keys; the server-only-sees-ciphertext claim assumes honest app delivery
and independent fingerprint verification. Generated identity keys are extractable
for backup; restored private keys are non-extractable. Local archive encryption at
rest is not implemented.

The old internal crypto salts and IndexedDB name remain solely to preserve existing
data. Renaming these blindly would break decryption or hide previous history.

## Validation

Clean npm install, production build, TypeScript checks, and three encryption tests
pass. ESLint has no errors, with development fast-refresh warnings for shared exports.
HTTP smoke checks cover health, UI, SPA routes, and unknown API routes. MariaDB,
Raspberry Pi ARM execution, and physical phone/browser behavior were not tested.
