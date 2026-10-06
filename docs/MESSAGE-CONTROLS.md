# Encrypted message controls

## Implemented stable references

New text/image payloads include an optional `messageRef` UUID inside the AES-GCM ciphertext. The sender uses its original durable client retry UUID. Encryption, decryption, local storage and archive import/export preserve it. Retrying and re-encrypting after a group-key change preserve the reference. Existing v1 payloads without references remain valid.

A reference is scoped by conversation and original author; a UUID alone does not authorize modifying content. Server message IDs remain delivery/ACK identifiers, not stable control authorizations. Existing messages will need an explicit legacy reference based on conversation, original author and server message ID when control support is added.

## Implemented edit/delete events

Controls need a distinct versioned encrypted event contract, rather than pretending to be text messages. Every event must retain the relay-authenticated sender and conversation; clients must check an edit/delete sender against the original message author. Group shared-key possession alone does not authorize changing another member's message.

Apply controls and save their deduplication state atomically before acknowledging delivery. Persist pending controls for out-of-order arrival; deletion tombstones must prevent a late original or archive merge resurrecting deleted content. Define deterministic ordering for multiple edits; deletion must win over subsequent edits. Keep ACK (received) separate from opt-in read receipts. Membership changes limit future relay access and cannot remove previously downloaded copies.

Edit and delete-for-all controls are implemented as encrypted v1 control payloads. Confirmed outgoing text messages expose Edit; confirmed outgoing text/images expose Delete for all. Archived chats and groups awaiting key rotation do not expose these actions. Changes are queued durably and apply locally after relay confirmation. Recipients apply changes before ACK. Original relay sender and conversation scope authorize the target; latest server event ID orders edits, while delete always wins. Current members receive controls; former members and externally saved copies cannot be recalled.

Deletion replaces content with a tombstone and retains its stable reference. Account-local control state also blocks stale replay/import after local removal. Current archive files preserve edited/deleted message projections; they do not export pending control state for originals not yet received, or tombstones for rows explicitly removed locally. Restoring an older backup on a fresh browser can recover old content; deletion is not forensic erasure. Controls need updated clients: older versions cannot interpret them and must be upgraded before acceptance testing. Read receipts and disappearing messages remain unimplemented.

Acceptance test: two accounts exchange text and image messages; sender edits text and deletes both types. Put the recipient offline, queue another edit/delete, reconnect and verify the projection. Refresh/restart sender and recipient, verify changes persist and no control appears as a chat bubble. A third group member must not be able to edit another author's content. Native phone layout/browser prompts and full device acceptance are pending.
