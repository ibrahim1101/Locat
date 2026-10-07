# Locat 1.0 — single release development plan

Approved 2026-10-06. All 41 items belong to one development cycle; phases are internal and do not create intermediate releases. Development branch: `feat/locat-1.0`, based on `fix/locat-install-mobile-foundation`. Preserve main and the deployed Pi while developing.

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

- [x] 01. Profile picture selection
- [ ] 02. Read receipt on/off
- [x] 03. Delete for all
- [ ] 04. Hidden messages
- [ ] 05. Voice messages
- [x] 06. Bio/description
- [x] 07. Unique searchable user ID/code
- [ ] 08. Passkey logins
- [ ] 09. Voice/video calling
- [ ] 10. Webhooks
- [ ] 11. Selected hidden messages and hidden messages tab
- [ ] 12. Hide chats
- [ ] 13. Permanent deletion with documented storage/backup limitations
- [ ] 14. Account closure
- [ ] 15. Online/offline pinging
- [ ] 16. Server online/offline notifications
- [x] 17. Edit sent messages
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
- [x] 41. Avatar-triggered profile panel with picture, nickname, username, LC code and bio

## Progress

- 2026-10-06: authoritative backlog read; repository and latest foundation branch retrieved; isolated 1.0 branch created; initial schema/relay audit completed. No new feature marked complete. Hourly continuation scheduled from 19:00 IST.
- 2026-10-06 baseline: `npm ci` succeeded; `npm test` passed 15 tests, with 12 database integration tests skipped because the integration database was not configured. `npm run check` and `npm run build` passed. Build warns about the main client chunk exceeding 500 kB. Database integration remains unverified.
- User explicitly approved pushing the development plan and subsequent updates to this public development branch on 2026-10-06.
- Next: define versioned encrypted message-control events and migration strategy before editing chat behavior; provision an isolated integration database for full permission/relay verification.

- 2026-10-06 foundation increment: client decryption now rejects unsupported envelope versions, malformed envelopes/nonces and authenticated malformed plaintext before local persistence/relay ACK. Existing v1 text/image formats remain supported. Added regression cases for future versions, invalid nonces, wrong field types, unknown payload kinds and invalid image encoding. This is protocol hardening, not completion of a backlog feature.
- Verification of this increment: `npm test` 17 passed, 12 database integration tests skipped (TEST_DATABASE_URL absent); `npm run check` and `npm run build` passed. Existing bundle-size warning persists.

- 2026-10-06 directory increment: shareable server-scoped LC-{account ID} codes displayed beside your username and directory results. Exact code lookup preserves disabled-account/self exclusions; numeric usernames retain name-search behavior. No migration or key changes. Codes are public identifiers, not credentials, and only unique within the current server. Parser regression tests added; database-backed directory integration and browser acceptance remain pending, so item 07 is not yet marked complete. CI already provisions MariaDB; local runtime has neither MariaDB nor Docker.
- Directory increment verification: 19 unit tests passed; 12 database tests skipped. Typecheck and production build passed; existing bundle warning remains.
- 2026-10-06 profile increment: added a backward-compatible nullable 280-character bio migration, authenticated display-name/bio updates, profile controls, and bio display in direct/group directory results. Public auth and conversation member shapes now carry the bio consistently. A database integration case covers profile persistence plus exact LC-code lookup; it remains pending until CI runs with MariaDB, so backlog items 06 and 07 are not marked complete yet.
- Profile increment verification: 19 local tests passed; 13 database tests skipped because this runtime has no MariaDB. Typecheck and production build passed. Existing bundle-size warning remains.

- 2026-10-06 database verification fix: traced CI registration failure to missing `users.bio` in the additive installer. Bootstrap now adds the nullable column for both fresh and upgraded databases; readiness and doctor checks include it. Encrypted metadata restore preserves bios, while older backups default to no bio. Upgrade regression removes the column and reruns setup twice, preserving existing accounts and delivery data.
- Fresh isolated MariaDB verification: all 32 tests passed (19 unit and 13 integration), including profile update/directory lookup, original-schema upgrades, and bio backup/restore. Database integration is now verified locally; real-browser acceptance for items 06/07 is still pending. No backlog feature is marked fully accepted by this change.

- 2026-10-06 active session: user requested pausing hourly Locat runs; automation disabled successfully. Development continues interactively in the Locat chat.
- Shared plaintext contract increment: live encrypt/decrypt and archive validation use one bounded schema. Unsupported active image formats, malformed base64 padding, oversized text and undeclared fields are rejected before local persistence/ACK; outgoing payloads are validated too. Existing supported v1 text/raster-image messages remain compatible. 32 unit/MariaDB tests, TypeScript and production build pass. This is foundation work; encrypted control events, stable reference IDs and edit/delete/receipt/expiry UI remain to implement.

- Stable reference increment: outgoing text/images bind encrypted `messageRef` to the original durable client UUID. Shared validation and archives preserve references; old v1 messages remain readable. Documented authorization, offline ordering, deduplication/tombstone and legacy requirements in docs/MESSAGE-CONTROLS.md. This is a prerequisite; edit/delete/receipt/expiry controls are not yet implemented.

- Edit/delete implementation increment (items 03 and 17): versioned encrypted controls use relay-authenticated sender/conversation scope, sender-only UI actions, durable outbox and atomic control projection before ACK. Latest event IDs order edits, deletion is absorbing, pending states handle controls before originals and prevent stale imports/replays on the same device. Legacy messages use scoped server IDs. Archive projections preserve edited/deleted flags. Updated clients are required; former members/external copies and older backups cannot be recalled. See docs/MESSAGE-CONTROLS.md for recovery limits and acceptance steps.
- Verification: 37 tests passed against fresh MariaDB, including live relay controls after original queue purge and a forged author attempt, plus ordering, deletion replay/import and pending retirement. TypeScript/build/lint passed. Items 03/17 are implemented awaiting final workflow and physical-browser acceptance.
- Progress markers requested by user: report X/40 fully accepted, identify item numbers, and keep implementation/verification distinct from acceptance. Current accepted count: 0/40. Items 03, 06, 07, 17 have implementation and automated checks; device acceptance remains pending.

- User device acceptance: user reported all profile/code/edit/delete acceptance tests working. Items 03,06,07,17 accepted: 4/40, expanded to 4/41 after adding item 41. Earlier zero-acceptance entries are historical.
- Item 41 UI increment: clickable, keyboard-accessible top-left avatar opens a dedicated profile dialog with nickname editing, fixed login username, server-scoped LC code/copy and bio. Profile editing removed from Settings; theme/install/notification/storage controls remain there. Picture selection (item 01 and part of 41) remains pending; do not mark 41 complete. TypeScript and production build pass.

- Items 01/41 picture increment: authenticated thumbnail selection/removal in the avatar-triggered profile panel. Browser crops and re-encodes to 128px JPEG, rejects input above 10 MB, discards original metadata and uploads only a bounded 30 KB thumbnail. Thumbnails are public profile data on the server, not message-encrypted content. Directory, auth, conversation members and avatar stacks expose/render the thumbnail; unsafe URI formats are rejected. Additive schema upgrade, formal migration, readiness/doctor and metadata backup restore include pictures. Old backups default to no picture.
- Automated validation: 38 tests passed against fresh MariaDB, including unauthenticated rejection, account isolation, directory/conversation visibility, removal and backup/restore. TypeScript/lint/build passed. Items 01/41 are implemented pending GitHub workflow and device acceptance. Completed/device-tested count remains 4/41.

- User confirmed profile pictures and the dedicated profile panel work: items 01/41 accepted, bringing completed/device-tested progress to 6/41.
- LC refinement: randomly allocated fixed 16-digit strings replace sequential account-ID codes. Unique database index enforces uniqueness within this server; registration retries code collisions. Additive installation assigns codes to existing accounts once and preserves them on subsequent upgrades. Codes cannot be changed through profile settings. Metadata backups preserve them; legacy backups receive codes. Exact numeric/prefixed lookup is supported. Existing users should reconnect and share their new code. Codes are public identifiers, not secrets.
- LC validation: 39 tests passed against fresh MariaDB; typecheck, lint and production build passed. GitHub workflow pending. Progress remains 6/41; this refines item 07.

- User confirmed friend installation and all functions work remotely via Tailscale. Requested shorter LC codes: fixed eight-digit random codes now replace the 16-digit format. Upgrade regenerates long codes once, preserves eight-digit codes thereafter, and keeps the unique index. Older metadata backups with long codes receive new short codes when restored. Progress remains 6/41.

- Final user preference: fixed four-digit LC numbers (1000–9999), unique within this server and noneditable. Capacity is 9000 accounts; allocation scans unused numbers and handles collision races instead of relying on a small random retry limit. Installer converts longer numbers once, preserving existing four-digit numbers; restore reserves preserved numbers before assigning older accounts.

- 2026-10-07 item 02 increment: encrypted read-receipt controls use stable message references, relay-authenticated reader identity, durable offline outbox delivery and deduplicated on-device projections. Settings provides a per-device on/off privacy switch (default on); disabling prevents future sends but cannot retract prior receipts. Direct chats show Read and groups show reader counts. Automated unit coverage validates encrypted receipt format and projection; MariaDB integration covers relay identity/delivery but awaits CI. Item 02 is implemented, pending workflow and physical-device acceptance. Progress remains 6/41 accepted.

- 2026-10-07 item 23 increment: authenticated block/unblock relationships are stored server-side with a unique directed pair. Either direction hides both accounts from directory search and prevents creating or sending in a direct conversation; group membership and group messages are unchanged. The direct-chat header exposes the control and disables composition when this device initiated the block. Existing device-local history is retained. Already delivered or in-flight content is not recalled, and the server does not reveal whether the other account blocked you. Additive migration, installer/readiness/doctor coverage and MariaDB integration tests are included. Item 23 is implemented pending GitHub workflow and two-device acceptance; progress remains 6/41 accepted.

## Approved scope additions — 2026-10-07

These extend the single Locat 1.0 release; they are requirements, not completed features.

- [ ] 42. Friend/contact requests: search or enter a fixed LC number, Add friend/user, incoming/outgoing request lists, accept/decline/cancel, remove friend. Only accepted contacts can create or submit new direct chats. Server enforcement must cover retries, block interactions, duplicate/crossed requests, offline use and abuse rate limits. Existing direct relationships must migrate compatibly without losing accounts, keys or device-local history. Declines must not expose private activity.
- [ ] 43. Strong password policy and clear registration guidance: at least 15 Unicode characters for new passwords; permit long passphrases, spaces, paste and password managers; reject common/compromised and account-derived passwords, with client guidance and authoritative server enforcement. Keep existing password login/key recovery working. Password changes must safely rewrap the encrypted private-key backup; never change a login hash alone. Show actionable requirements, confirmation and accessible validation. Document the coverage/source of any password blocklist.
- Expand 38: server-enforced visibility for login username and any future email/phone/contact fields, with Everyone/accepted contacts/Nobody choices as appropriate. Keep nickname and an explicitly shared LC number available for friend requests. Apply policies to directory, conversation/member lists, profile/key APIs and request previews rather than merely hiding UI text. Current accounts do not collect an email or phone; do not introduce those fields just for this feature. Account ownership/admin safety boundaries must be documented.
- Expand 25/34/24: complete coherent mobile-first UI overhaul covering authentication/password help, chat navigation, friend requests, profile and privacy, groups, notifications and admin. Keep profile settings in the top-left avatar panel. Include responsive layouts, readable contrast, keyboard/screen-reader controls, loading/error/empty states and clear disabled actions; retain working local chat storage.
- Expand 33: generic Linux/systemd installation plus documented VPS, managed app/container hosting, home mini-PC/NAS and dedicated-server deployment paths. Test persistent MariaDB, HTTPS/SSE, backups/recovery and restart behavior; no infrastructure purchase or live migration without a chosen host.
- Dependency order: password guidance/policy and API privacy audit; contact-request schema/enforcement and compatible migration; privacy controls; integrated UI overhaul; portable hosting acceptance. Progress denominator is now 43; accepted remains 6/43 (01,03,06,07,17,41). Previously recorded 6/41 counts are historical.


## Beginner documentation and Android addition — 2026-10-07

- Beginner guide covers Pi OS, native Ubuntu/Debian/systemd, Docker Desktop/Engine/Compose, Tailscale HTTPS, friend machine sharing/acceptance, phone setup, backup/update safety and troubleshooting. Generic Linux and Desktop Docker recipes remain pending fresh-host acceptance. README replaces contradictory historical installation/mobile limitations with current behavior.
- [ ] 44. Android APK: first-run Paste server HTTPS address, URL validation/connection check, saved server selection, login and safe server switching with isolated history/keys. Signed APK builds, installation/upgrade checks and encrypted archives required. Audit native bridge/navigation and reject HTTP/certificate bypass. Choose embedded/native-shell design after a storage/crypto/notification feasibility spike; do not mark a simple remote-page wrapper complete. Private servers still require Tailscale. Native notifications, background execution/calls and lock behavior need device tests; browser Web Push must not be assumed available in WebView. Plan browser-to-APK history/origin migration and preserve one-active-login limitations. Sideloadable signed APK initially; store publication separately.
- APK belongs to the approved single 1.0 cycle. Accepted remains 6/44 (01,03,06,07,17,41); no new feature is marked accepted.


## Password registration increment — 2026-10-07

- Item 43 partial implementation: registration requires 15 Unicode code points, with the existing 1024 UTF-16-unit input bound. Shared client/server validation rejects repeated characters, a small bundled predictable-password starter list (including simple punctuation/digit variants), and username-containing choices. The registration UI explains passphrases/spaces/password managers and requires confirmation. Password text is not trimmed, normalized or otherwise changed before hashing or encrypted-key wrapping. Login and key restore retain existing password compatibility; no forced password reset or identity rewrap is performed.
- The starter list is maintained in contracts/password.ts, authored locally from representative obvious choices; it is NOT a comprehensive breached-password corpus. Broader common/compromised-password coverage and safe authenticated password changes remain outstanding, so item 43 is not complete.
- Verification: npm run check, npm run lint (0 errors, 11 existing Fast Refresh warnings), npm run build and git diff --check passed. npm test: 29 passed, 20 MariaDB integration tests skipped because MariaDB/Docker are absent and TEST_DATABASE_URL is unset. Added regression coverage for Unicode length, passphrases, repetition, common/account-derived passwords and bounds; a MariaDB case verifies server rejection without account creation and legacy short-password login, pending execution. Available workflow lookup filters to PR-triggered runs and returned none; push CI success is not established.
- Next device acceptance: check registration guidance/confirmation and weak-password errors; create a long-passphrase account, sign out/in and restore keys on a fresh client; verify an existing account still logs in. Accepted remains 6/44.

## Password pattern hardening — 2026-10-07

- 43 (partial): reject repeated one-to-four-character motifs and consecutive numeric/alphabet/keyboard runs, including simple separator variants. Unique long passphrases and mixed nonsequential numbers remain supported. Added shared-policy regressions and authoritative registration rejection cases. This bounded heuristic does not replace the outstanding compromised-password corpus or safe password changes.
- Prior checkpoint a2dcd2745c5dd8a8b6f8736f119f6a1ec97e2f92 now verified through public Actions run 37530953235: verify and docker-smoke succeeded, including MariaDB-backed npm test, build, installer syntax/help, Compose startup, doctor, readiness and admin stats. https://github.com/ibrahim1101/Locat/actions/runs/37530953235 . This supersedes the prior inability to observe push CI.
- Local checks: 30 tests passed; 20 MariaDB tests skipped (no local database). Typecheck, lint (11 existing warnings), production build and diff whitespace checks passed. CI must run the extended server cases after publication. Device acceptance remains 6/44; test weak patterns, a unique passphrase account and existing-account login/key restore next.

## Contact-request server foundation — 2026-10-07

- 42 (partial): added one server-side relationship per unordered account pair with incoming/outgoing request lists, idempotent send, crossed-request auto-accept, accept, decline, cancel and remove operations. Only accepted contacts may create or send new direct chats. Blocking removes any relationship; acceptance rechecks blocks; request creation has an account-scoped abuse limit. Declines delete the row and expose no recipient activity state.
- Existing direct conversations are backfilled as accepted contacts by the additive, idempotent database setup. Removing a contact leaves both devices' existing local history and the server conversation intact, but prevents new direct messages until a new request is accepted. Pending and accepted relationships are included in encrypted metadata backup/restore; older backups reconstruct accepted contacts from restored direct chats.
- Added formal migration 0009 plus setup, readiness and doctor coverage. MariaDB cases cover retry/crossed requests, accept/decline/cancel/remove, direct-chat enforcement, block interaction, legacy-direct backfill, and contact metadata recovery. The user-facing friend-request screens and physical two-device acceptance are still outstanding, so item 42 is not complete.
- Local validation: 30 tests passed and 22 MariaDB cases skipped because this runtime has no database; typecheck, lint (0 errors/11 existing warnings), production build and whitespace checks passed. GitHub Actions run 37560683220 passed both jobs at checkpoint b303802e841e3f27d9d4962c623f83875abc09a3, executing 52 tests with MariaDB plus Docker Compose startup, doctor, readiness and admin checks. Accepted remains 6/44.
