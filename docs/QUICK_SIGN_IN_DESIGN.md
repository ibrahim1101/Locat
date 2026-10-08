# Locat Quick Sign-In Key — security design and implementation record

Status: **Stage 1 implemented (cryptographic primitives only). NOT READY FOR USERS.**

## Goal
Allow users to sign in with one Locat-generated, 256-bit random secret and recover their existing ECDH private identity key on a new device without transmitting the secret or private key to the server.

## Implemented
- `src/lib/quickSignIn.ts` (commit `19a5e7b`) generates a random 256-bit key formatted `LQ1-XXXXXXXX-...` (eight groups of eight hexadecimal digits).
- Domain-separated SHA-256 verifier (server can index this, but the actual secret is never sent).
- Client-side PBKDF2-SHA256/AES-256-GCM encrypted PKCS#8 identity backup, with fresh random salt and nonce.
- Client-side decrypt and non-extractable import on a second device.
- No database migration, endpoint or UI has been activated. Existing username/password login is unchanged.

## Required before release
1. Database table keyed by unique verifier, user ID, version, encrypted backup, created/revoked timestamps. Ensure existing database upgrades are additive.
2. Authenticated create/rotate/revoke flow; require recent password reauthentication or other verified step before issuing a key, and return secret **only once**.
3. Public login endpoint with strict request size, global/IP/account-aware throttling and uniform error responses. Compare verifier safely, reject disabled/revoked accounts.
4. Apply the same single-active-session transaction as normal login and clear old push subscriptions.
5. UI for generate/show/copy/download key, explicit confirmation of safekeeping, one-field login, clear warnings, and emergency revocation.
6. Ensure the server never receives the raw key, decrypted private key, or plaintext password. Never log the key or place it in a URL.
7. Verify the returned identity public key matches the decrypted private key; test incorrect keys, revocation, lost key, device restore, stale sessions, backups, and Android/Web parity.
8. Add automated crypto/auth tests and run CI; only then offer APK/device acceptance testing.

## Security decisions
- Existing 4-digit LC contact codes are **not** login credentials.
- This is a **bearer recovery credential**: theft permits account takeover and identity recovery. Recommend storing it in a password manager; do not take screenshots or share it.
- SHA-256 is suitable as a verifier **only because** the secret is generated from 256 bits of secure randomness. Never accept user-chosen short PINs in this protocol.
- Password login remains available; loss of the Quick Sign-In Key does not require identity rotation while the password and encrypted backup are still available.
- A compromised server can still serve malicious web code; this mechanism does not eliminate that risk.
- This stage intentionally does not add incomplete authentication routes that might compromise accounts.

## Deployment
No Pi deployment or Android APK update is needed for this stage: the new cryptographic module is not imported by production screens yet.

### Windows verification
```powershell
gh run list -R ibrahim1101/Locat -b feat/locat-1.0 -L 8
```

### Raspberry Pi
```bash
cd /opt/locat
npm run doctor
```
