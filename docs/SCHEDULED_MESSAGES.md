# Scheduled encrypted text preview

Write text in a current chat and choose **Schedule text**. Select a local
date/time from one minute to 30 days ahead. The displayed timezone is the
device timezone; the request stores an absolute instant. Replies retain an
encrypted structural reference, not a plaintext quoted source.

Open **Scheduled messages** from the chat composer or navigation drawer to
review jobs, cancel pending requests, recover text and retry an unconfirmed
request. Released means inserted into the normal relay queue, not received
or read. The host must be online; overdue jobs wait for processing and queue
space. The host holds at most 100 pending envelopes / 100 MB per account.

Before contacting the host, the client durably saves an encrypted recovery
copy containing the exact ciphertext, UUID and requested time. A failed or
lost response retains the composer and copy; check the manager before making
a new schedule. **Retry exact saved request** reuses those original fields,
including after restart. It never enters the immediate-send outbox. Existing
jobs can be retried after their due time; new jobs with past times are rejected.

Local copies use an identity-derived AES-GCM key with server-origin/account
and request-ID authenticated context, a fresh nonce, strict schemas and an
atomic 200-copy device bound. They survive navigation/restart with the same
identity but are not copied to another device automatically. Corrupt/unlockable
copies are reported. Hidden conversations redact previews and disable recovery
copy/retry actions. Forgetting a copy does not cancel a host job; unconfirmed
copies require explicit acknowledgment of that distinction. Use cancellation
on the host while a job is pending. Copying recovery text intentionally places
plaintext in the device clipboard.

The relay rechecks enabled account, membership, accepted direct contact,
blocks and group key epoch under transaction locks before release. It respects
the normal 100 MB relay queue, retains blocked jobs and rotates their batch
priority so they do not starve other senders. Conflicting legacy retry receipts
fail that job while healthy jobs proceed. Concurrent workers converge on one
message/delivery/receipt transaction. Pending jobs appear before terminal history.
Cancellation and release race atomically: a job already released cannot be
cancelled. Both immediate sends and schedules reserve the same sender/client
retry-ID namespace.

Terminal ciphertext is cleared immediately. Metadata/tombstones are retained
until seven days after both the terminal update and requested send time. This
prevents a cancelled future request from being recreated by a delayed retry
following early tombstone cleanup. Local recovery copies remain until forgotten.

Limitations: text-only scheduling UI; no reschedule-in-place or scheduled
attachment composer. Direct identity changes after host acceptance now fail closed. New jobs bind
the client-provided key snapshot against the locked current identities; stale
client keys are rejected before acceptance. Legacy direct jobs without a snapshot fail
closed. Update the server and clients together; old clients without the new
context field cannot create new direct schedules. Refresh before creating a
new schedule after a key change. Group key changes fail closed. Native UI, clock changes,
notifications, physical host restart and device network-switch acceptance remain
pending. Use one canonical HTTPS origin on LAN and invited Tailscale routes.
