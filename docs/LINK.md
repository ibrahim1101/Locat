# Locat Link (M2)

Secure device pairing and encrypted transfer between an account's own devices.
Part of Locat 2.0 on `feat/locat-2.0`. Additive only — no change to the
messenger's encryption, auth or existing schema.

## Transport model (be clear about this)
Locat Link is **server-relayed, not direct peer-to-peer.** File chunks and
clipboard payloads are encrypted on the sending device and uploaded to the
existing self-hosted Locat server, which stores them as **opaque ciphertext**
and relays them to the receiving device, deleting chunks once the transfer
completes. The server never sees plaintext or the transfer key.

**Not implemented in M2 (documented as future):** true direct P2P (WebRTC
data channels), LAN/mDNS device discovery, Bluetooth / Wi-Fi Direct / mesh.
Devices discover each other only by being registered under the same account.

## Security design / threat model
- **Device identity**: each device generates its own ECDH P-256 keypair
  (separate from the messaging identity), stored in account-scoped IndexedDB.
  Only the public key is sent to the server.
- **Pairing + MITM protection**: pairing derives a 6-digit **Short
  Authentication String (SAS)** from a SHA-256 over the *sorted pair of public
  keys*. Both devices display it; the user confirms they match on **both**
  sides (`pair.confirm` from each device → `verified`). A malicious server (or
  any MITM) that swaps a public key produces a different SAS on each side, so
  verification fails. No custom crypto — WebCrypto ECDH/HKDF/AES-GCM only.
- **Transfer/clipboard key**: `AES-GCM-256` derived via
  `HKDF(ECDH(myDevicePriv, peerDevicePub), salt="locat-link", info="device-transfer-key")`.
  Both paired devices derive the same key; a third device cannot (verified by
  test).
- **Authorization**: every device/pairing/transfer/message row is scoped to the
  owning account; cross-account access returns `NOT_FOUND`/`FORBIDDEN` (verified
  by live E2E). Transfers and clipboard require a **verified** pairing between
  the two devices. Rate limits on register/transfer/chunk/message.
- **Lifecycle**: chunked upload → recipient downloads sequentially (missing
  seqs re-requestable for recovery) → `complete` purges ciphertext chunks;
  either side can `cancel` (also purges). Completed/cancelled transfers remain
  as metadata for history.

## Flows
1. Each device auto-registers on first open of Link (`link.devices.register`,
   deduped by public key).
2. Pair two devices (`pair.start`) → each verifies the SAS (`pair.get` returns
   both public keys; client computes SAS) → `pair.confirm` from both → verified.
3. Send file: client chunks (256 KB), encrypts each chunk, `transfers.create`
   then `transfers.uploadChunk`. Recipient `transfers.chunk` + decrypt +
   reassemble + `transfers.complete`.
4. Clipboard / send-to-device: `messages.push` (clipboard|text|url) to a
   verified device; recipient `messages.inbox` + decrypt + `messages.ack`.

## Files
- `db/schema.ts` — `link_devices`, `link_pairings`, `link_transfers`,
  `link_transfer_chunks`, `link_messages` (+ `scripts/setup-db.mjs`)
- `src/lib/link.ts` — device crypto (SAS, shared key, chunking) — unit-tested
- `api/linkRouter.ts` — authed tRPC (devices, pair, transfers, messages)
- `src/pages/Link.tsx` — Devices / Transfers / Clipboard UI
- Tests: `src/lib/link.test.ts` (SAS MITM, shared-key round-trip, chunk
  reassembly, clipboard). Live E2E in verification covers pairing, transfer,
  purge, authorization and cross-account isolation.

## Limitations
- Pairing is scoped to one account's devices (cross-account device transfer is
  future work).
- In-memory per-process rate limiting (same as the existing relay).
- Transfer ceiling 200 MB; 256 KB chunks; clipboard entries are latest-N per
  device.
