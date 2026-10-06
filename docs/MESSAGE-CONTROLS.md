# Encrypted message controls

## Implemented stable references

New text/image payloads include an optional `messageRef` UUID inside the AES-GCM ciphertext. The sender uses its original durable client retry UUID. Encryption, decryption, local storage and archive import/export preserve it. Retrying and re-encrypting after a group-key change preserve the reference. Existing v1 payloads without references remain valid.

A reference is scoped by conversation and original author; a UUID alone does not authorize modifying content. Server message IDs remain delivery/ACK identifiers, not stable control authorizations. Existing messages will need an explicit legacy reference based on conversation, original author and server message ID when control support is added.

## Next implementation requirements

Controls need a distinct versioned encrypted event contract, rather than pretending to be text messages. Every event must retain the relay-authenticated sender and conversation; clients must check an edit/delete sender against the original message author. Group shared-key possession alone does not authorize changing another member's message.

Apply controls and save their deduplication state atomically before acknowledging delivery. Persist pending controls for out-of-order arrival; deletion tombstones must prevent a late original or archive merge resurrecting deleted content. Define deterministic ordering for multiple edits; deletion must win over subsequent edits. Keep ACK (received) separate from opt-in read receipts. Membership changes limit future relay access and cannot remove previously downloaded copies.

Edits, delete-for-all, read receipts and disappearing messages are not implemented by the reference increment. No universal forensic erasure or screenshot prevention is promised.
