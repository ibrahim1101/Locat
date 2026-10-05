# Group membership and encryption

Open a group and use the Group details button in the chat header. The owner can change the name, add/remove members, save a freshly generated group key, and transfer ownership to another current active member. Groups support up to 51 accounts including the owner. Administrator status does not give access to group management or plaintext chats.

Every Save members & rotate key operation generates a new AES key on the owner's device and wraps it separately for each selected member. The server stores only wrapped keys, immutable wrapper public-key snapshots, and version metadata. Newly added members receive the current version's key, not keys from before they joined. Remaining members can fetch their own historical wrapped keys to decrypt older queued messages. Their local archives remain plaintext on their devices as before.

Removing a member revokes server membership and deletes that member's undelivered queued copies for this group. Future messages must use the new key version. Already delivered/downloaded messages and keys cannot be taken back from a former member. This is membership-change protection, not forward secrecy against later device/key compromise.

A non-owner can leave the group. Sending then pauses until the owner saves a fresh group key for the remaining members. A departing member cannot generate the replacement key because that would let them know a key for future messages. Owners must transfer ownership before leaving; the new owner performs the required rotation afterward. A group containing only its owner can be closed, preserving that owner's saved local history.

Membership/key updates are transactional and serialized against sends. Stale key versions are rejected before insertion. A durable pending message can be re-encrypted after an explicit stale-version rejection; its retry ID is retained. Already committed retries keep their original receipt, preventing duplicate messages.

Current memberships are refreshed through realtime changes and polling. A departed conversation remains in the local chat list as archived, with composing disabled, so saved history stays readable. Rejoining restores active status but does not download other people's local history.

## Deployment upgrade

Update the server and close/reopen all Locat windows to activate the new client/service worker. Existing groups start at version 1; setup copies their existing wrapped keys into version metadata. Existing ciphertext envelopes without a version are treated as version 1. Older clients cannot send after a group has rotated and must update.

If a legacy group's wrapper had already reset its identity before this upgrade, old wrapped keys may already be unrecoverable. Rotating creates a working new group key but cannot recover ciphertext encrypted under a lost key. Saved plaintext device history is unaffected.

Server metadata backups now include group key versions and membership-change state. Browser metadata restores preserve these; older metadata backups default to version 1 and reconstruct available current wrapped keys. Device `.locat` history backups continue to contain saved messages only.

## Phone test

Use three distinct accounts: create an owner/member group, send a message, add the third account, remove the original member, and send again. The removed member should keep saved history but receive no future messages. The added member should not receive pre-join history. Also test leaving, ownership transfer, and the owner clearing the key-rotation pause.
