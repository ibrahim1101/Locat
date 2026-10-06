# Locat 1.0 — single release development plan

Approved 2026-10-06. All 40 items belong to one development cycle; phases are internal and do not create intermediate releases. Development branch: `feat/locat-1.0`, based on `fix/locat-install-mobile-foundation`. Preserve main and the deployed Pi while developing.

## Initial source audit

- Existing server: Node/Hono/tRPC, MySQL/Drizzle; React/Vite client.
- Users currently have numeric IDs, username, display name and encrypted private-key backups. No profile, passkey or MFA schema exists in the audited users table.
- Messages are opaque encrypted envelopes in a transient relay queue. Delivery ACK deletes the envelope after all recipients acknowledge it; ACK is not a read receipt.
- Durable history is device-local. Edit/delete/reply/expiry protocols must work after server queue deletion and across offline devices; adding columns only to transient messages will not solve this.
- Existing installation/admin/Web Push/group rotation foundation must be retained. Current checks must be rerun; prior test counts are not fresh validation.

## Internal sequence

1. Baseline tests and permission audit; versioned encrypted event protocol, stable identifiers, backward-compatible migrations and local storage upgrades.
2. Profiles, directory identifiers, privacy/blocking and account lifecycle; key recovery design before passkeys/MFA/app lock.
3. Message controls: receipts, edits, deletions, hidden chats/messages, nested replies, expiry/view limits and scheduling.
4. Encrypted media, voice messages, editing, doodles, GIF/sticker support, configured video storage; WebRTC calling and deployment prerequisites.
5. Admin, presence/privacy-aware logs, server health notifications, webhooks and portable deployment.
6. UI rebuild, themes, logo, notifications, control states and feasible browser/PWA widgets.
7. Regression/security/performance checks, mobile/browser testing, fresh install and upgrade/recovery rehearsal, documentation and release candidate.

## Acceptance rules

Each item needs real end-to-end behavior, permission checks, persistence/offline semantics where applicable and documented limits. Do not mark placeholders complete. Preserve encrypted content and existing accounts/messages. Read latest remote state before every run; never overwrite concurrent work. Commit small verified increments and record exact commands/results below.

Universal forensic deletion cannot be guaranteed for SSDs, snapshots, backups or recipient copies. Multi-view/expiry cannot prevent external screenshots or modified clients. Passkey authentication must include a workable encrypted-key unlock/recovery design. Calling needs HTTPS, permissions and ICE/TURN planning. Browser/PWA app lock and widgets have platform limits; document the supported behavior before implementing.

## Backlog

- [ ] 01. Profile picture selection
- [ ] 02. Read receipt on/off
- [ ] 03. Delete for all
- [ ] 04. Hidden messages
- [ ] 05. Voice messages
- [ ] 06. Bio/description
- [ ] 07. Unique searchable user ID/code
- [ ] 08. Passkey logins
- [ ] 09. Voice/video calling
- [ ] 10. Webhooks
- [ ] 11. Selected hidden messages and hidden messages tab
- [ ] 12. Hide chats
- [ ] 13. Permanent deletion with documented storage/backup limitations
- [ ] 14. Account closure
- [ ] 15. Online/offline pinging
- [ ] 16. Server online/offline notifications
- [ ] 17. Edit sent messages
- [ ] 18. Single/multi-view messages
- [ ] 19. Basic picture editing
- [ ] 20. Theme selection
- [ ] 21. MFA
- [ ] 22. App lock
- [ ] 23. Block/unblock contacts
- [ ] 24. Enabled/disabled control states
- [ ] 25. Complete UI overhaul
- [ ] 26. Notification sounds/ringtones/settings
- [ ] 27. Logo
- [ ] 28. GIFs/emojis/stickers
- [ ] 29. Admin user creation and expanded controls
- [ ] 30. Disappearing messages
- [ ] 31. Scheduled messages
- [ ] 32. Timed deletion
- [ ] 33. Portable/optimized server installation
- [ ] 34. Frontend smoothing
- [ ] 35. Doodles
- [ ] 36. Nested replies
- [ ] 37. Widgets
- [ ] 38. Privacy controls
- [ ] 39. Server presence logs
- [ ] 40. Configurable video sharing

## Progress

- 2026-10-06: authoritative backlog read; repository and latest foundation branch retrieved; isolated 1.0 branch created; initial schema/relay audit completed. No new feature marked complete. Hourly continuation scheduled from 19:00 IST.
- 2026-10-06 baseline: `npm ci` succeeded; `npm test` passed 15 tests, with 12 database integration tests skipped because the integration database was not configured. `npm run check` and `npm run build` passed. Build warns about the main client chunk exceeding 500 kB. Database integration remains unverified.
- User explicitly approved pushing the development plan and subsequent updates to this public development branch on 2026-10-06.
- Next: define versioned encrypted message-control events and migration strategy before editing chat behavior; provision an isolated integration database for full permission/relay verification.

- 2026-10-06 foundation increment: client decryption now rejects unsupported envelope versions, malformed envelopes/nonces and authenticated malformed plaintext before local persistence/relay ACK. Existing v1 text/image formats remain supported. Added regression cases for future versions, invalid nonces, wrong field types, unknown payload kinds and invalid image encoding. This is protocol hardening, not completion of a backlog feature.
- Verification of this increment: `npm test` 17 passed, 12 database integration tests skipped (TEST_DATABASE_URL absent); `npm run check` and `npm run build` passed. Existing bundle-size warning persists.
