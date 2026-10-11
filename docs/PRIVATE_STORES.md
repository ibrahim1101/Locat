# Vault and Secrets — encrypted-store preview

These are sections of Locat, using its account and backend. They do not replace messaging keys or its account password.

## Encryption and lifecycle

Each module creates a random 256-bit master key on the client. A separate passphrase (15–1024 characters) derives the wrapping key using PBKDF2-SHA256 with a random 16-byte salt and 600,000 rounds. AES-256-GCM authenticates each ciphertext with the module, server origin, account ID, random store ID and random record ID. Nonces are random 12-byte values. Master keys are nonextractable WebCrypto keys while unlocked; neither passphrase nor key is sent to the API or saved to browser storage.

Names, folder labels, MIME information and contents are inside ciphertext. The host sees account/module ownership, opaque record IDs, ciphertext sizes, revisions and write timing. It can still delete/withhold/roll back ciphertext; this protocol does not promise freshness against a malicious server. Vault/Secrets metadata must not be searched server-side in plaintext.

The screen locks on hidden/pagehide or after five minutes without pointer/keyboard activity. Lock/unmount removes rendered decrypted entries, credential drafts and active key references. Asynchronous results use a generation guard to prevent reappearance after locking. JavaScript cannot guarantee forensic RAM erasure. An unlocked compromised device or malicious script can access plaintext; this feature is not an OS secure-storage implementation.

## Use

1. Sign in, open **Vault** or **Secrets**, enter and confirm a separate strong passphrase, and create the store. Later devices use the same passphrase to unlock it.
2. Vault: set a folder label (for example `Projects/Locat`) and choose a file. This preview supports **2 MiB per file**, **128 entries** and **64 MiB of ciphertext per module**. Upload happens only after client encryption. Downloads use an inert binary blob and sanitized filename through the existing user-consented save adapter.
3. Secrets: create a named credential or secure note, optional folder/username/URL, masked password and note. Generate a 24-character password if needed. Edit retains the original revision: another device's later change is a conflict, rather than silently overwritten.
4. Search names/folders after unlocking. Search runs over decrypted data on the current device. Lock clears the index.
5. Choose **Encrypted backup**. The backup contains only key-wrapping configuration and ciphertext. Protect both that file and the passphrase separately.
6. To recover, enter the original passphrase and select **Restore encrypted backup** from the locked screen, or restore missing entries while unlocked. An empty store can be initialized from that backup after every ciphertext is authenticated. It must be the same account ID, module and exact server origin. Existing store keys and existing record IDs are not overwritten. Restore uses per-record transactions: a concurrent quota/conflict/network failure can leave some entries restored; retry restores the remainder safely.
7. Delete asks for confirmation and enforces the record revision on the server. Active server ciphertext is deleted; backups, recipient/download copies and filesystem remnants may persist.

The passphrase is not recoverable by Locat. Changing a server hostname/port changes authenticated scope; restore the original origin and account identity before importing backups. Store passphrase changes, large-file/chunk upload, file previews, folder move/rename trees, biometric unlock, native clipboard expiry and sharing remain unfinished. File/folder labels are organization within entries, not a server-visible filesystem hierarchy.

## Backend / security tests

`privateStore.status/get/initialize/put/remove` require an account session. Every lookup includes account and module. Writes and initialization take the account row lock, so concurrent insertions cannot race count or byte quotas. Updates/deletes require the caller's expected revision. The API never offers arbitrary filesystem paths. Audit records contain only actor ID, module operation and timing.

Migration `0013_private_stores.sql` is additive, and `npm run db:setup` applies it idempotently. Readiness/doctor check both new tables. The terminal SQL server backup includes them; the older GUI metadata archive does not, so export module ciphertext backups explicitly. Existing accounts/messages are retained. No production migration was performed.

Automated coverage: real encryption/unlock, wrong-passphrase/ciphertext tampering, account/origin/module/record substitution, nonextractable keys, wrapped-key bounds, malformed file lengths, API unauthorized/cross-account access, initialization conflict/idempotency, stale revisions, concurrent first writes and last-slot count enforcement. See the engineering history for actual command outcomes.

## Device acceptance still required

On Windows, Android, Linux/macOS and browser clients: create/unlock, cross-device read, masked editing, stale-revision conflict, delete confirmation, hide/return and idle lock, original-passphrase encrypted backup recovery, corrupt backup failure before writes, file picker lifecycle and native save. Native pickers/background transitions may lock the store; record actual behavior rather than claiming browser tests establish Android parity.
