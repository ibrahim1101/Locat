# Locat 1.0 — single release development plan

Approved 2026-10-06, expanded to 49 items on 2026-10-07. All items belong to one development cycle; phases are internal and do not create intermediate releases. Development branch: `feat/locat-1.0`, based on `fix/locat-install-mobile-foundation`. Preserve main and the deployed Pi while developing.

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
- [ ] 45. General encrypted file/document sharing (PDF, Office/text/archive and arbitrary files) with safe download handling
- [ ] 46. Full-resolution encrypted photo sharing with preview/download and optional compression
- [ ] 47. Encrypted video sharing with preview/playback, configured limits and download
- [ ] 48. Encrypted GPS location sharing (current/static location card, coordinates and map-link handoff; explicit permission only)
- [ ] 49. OS/PWA share integration: receive supported files/photos/videos/links from the device share sheet where the platform supports Web Share Target

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

## Contact-request interface — 2026-10-07

- 42 implemented, awaiting physical acceptance: the sidebar action now opens a responsive People/Requests/Group workspace. People can search by fixed LC number, username or nickname, send a request, see pending state, accept an incoming request from search, chat with accepted contacts, and remove a contact with a clear local-history warning. Requests separates actionable incoming Accept/Decline controls from outgoing Cancel. Crossed requests continue to become accepted server-side.
- Direct-chat buttons are shown only for accepted contacts and server enforcement remains authoritative. The interface includes loading, empty, failure and disabled/busy states with labelled tabs and form fields. Existing group creation remains available and encrypted as before.
- Local validation: 30 tests passed; 22 MariaDB tests skipped because no local database is available. Typecheck, lint (0 errors/11 existing warnings), production build and whitespace checks passed. GitHub Actions run 37565147180 passed all 52 tests with MariaDB and the Docker smoke job at checkpoint 89a5b398ce1eff664c1b3275f9a574bbaaf89ec4. Item 42 still needs two-device acceptance before it can be counted complete. Test request discovery by reopening the People dialog, accept/decline/cancel, crossed requests, direct chat after acceptance, removal with retained history, and block interaction. Accepted remains 6/44.

## Username privacy controls — 2026-10-07

- 38 (partial): the avatar-triggered profile panel now offers Everyone, Accepted contacts or Nobody visibility for the fixed login username. Enforcement is server-side across directory search/results, request previews, contact lists, conversation member lists, blocked-user views and public-key/fingerprint lookups. Hidden usernames are returned as null rather than merely concealed with CSS. Nicknames and LC numbers remain visible for friend discovery.
- Existing accounts default to Everyone for compatibility. Additive setup and formal migration 0010 preserve account/message data; encrypted metadata backups retain the choice and older backups default to Everyone. Old clients may continue profile edits without resetting the setting. Administrators retain username access in authenticated admin tools for account moderation and recovery; this boundary is stated in the profile UI.
- Locat currently collects no email or phone number, so no unnecessary contact fields were introduced. Future contact fields must use server-enforced policy before release. Broader privacy controls remain, so item 38 is not complete.
- Local validation: 30 tests passed; 23 MariaDB cases skipped because this runtime has no database. Typecheck, lint (0 errors/11 existing warnings), production build and whitespace checks passed. GitHub Actions run 37569671007 passed all 53 tests with MariaDB plus Docker smoke checks at checkpoint c121ca6c5361d8e30f8e6d45606ac585eaae0293, including the Everyone/contacts/Nobody matrix across directory, requests, conversations, keys and recovery. Physical acceptance should confirm hidden usernames never render while LC search, nickname display, encryption and messaging continue working. Accepted remains 6/44.

## Profile and presence privacy — 2026-10-07

- 38/15 partial: the avatar profile panel now independently controls picture/bio visibility and approximate online-status visibility using Everyone, Accepted contacts or Nobody. Profile fields are server-redacted across directory, request, contact, conversation/member and key APIs. Nickname and LC number remain discoverable. Existing profile content is preserved; only its disclosure changes.
- Realtime presence is now calculated separately for each viewer for both initial SSE state and subsequent connect/disconnect broadcasts. It no longer publishes the complete online-account set to every signed-in user. Presence defaults to Accepted contacts on upgraded and new accounts; changing the setting immediately refreshes connected viewers. Online status remains approximate and ephemeral, not a durable activity log.
- Additive setup/formal migration 0011, readiness/doctor checks and encrypted metadata backup/restore include both policies. Older backups default profile visibility to Everyone and presence to Accepted contacts. Admin account access remains unchanged; Locat still stores no email/phone fields.
- Local validation: 30 tests passed; 24 MariaDB cases skipped because no local database is available. Typecheck, lint (0 errors/11 existing warnings), production build and whitespace checks passed. GitHub Actions run 37574936344 passed all 54 tests with MariaDB and Docker smoke checks at checkpoint d8a82eca7d153572077a4d4674c6666ddc542adf, including the profile/presence privacy matrix, migration and recovery. Physical acceptance should use three accounts (contact and non-contact), all three settings, live connect/disconnect, LC search and message delivery. Neither item 15 nor 38 is complete yet; accepted remains 6/44.

## Preserve contact and block decisions during recovery — 2026-10-07

- 42/23/33 hardening: fixed repeated database setup recreating removed friends from retained direct conversations. Legacy direct-chat backfill now runs only when the contact table is first introduced and excludes blocked pairs. Existing contact tables remain authoritative on updates; local history and conversations remain intact.
- Encrypted dashboard backups now include directed blocked-user choices. Restore distinguishes an absent legacy contacts field from an explicit list (including an empty list), preserving removals instead of backfilling every direct chat. Recovery refuses a nonempty block table and restores blocks transactionally with accounts/contacts. Older backups cannot recover block choices they never recorded; administration documentation states this limitation.
- Regression coverage exercises legacy backfill, removal followed by repeated setup, retained conversations, encrypted block metadata, restored contact counts and enforcement after recovery. Local validation: 30 tests passed; 24 MariaDB cases skipped because no database is installed here. Typecheck, lint (0 errors/11 existing warnings), production build and whitespace checks passed. GitHub Actions run 37579508000 passed MariaDB verification and Docker Compose smoke checks at code checkpoint c64cc4c9055e7cd476f9e2d94c63095422431b4a: https://github.com/ibrahim1101/Locat/actions/runs/37579508000 .
- Device acceptance remains 6/44. Next: remove a friend, restart/update and confirm a new request is required while old history remains; block a user, make an encrypted dashboard backup and restore it on a separate disposable server, then confirm the block and profile privacy choices survive. Never use the live Pi as the restore target.

## Mobile Firefox and friend profile increment — 2026-10-07

- Added image-element decoding fallback when ImageBitmap is absent or rejects an image; attached download links retain their URL for 60 seconds for mobile saving. Fresh friend profiles open from direct-chat avatars or group member rows. Avatar downloads default off and recheck current visibility, blocks and permission on the server. Additive migration 0012, doctor/readiness and metadata recovery preserve this setting. Visible valid push events now show generic notifications, and enabling notifications waits for durable service-worker account acknowledgement before server registration.
- All 59 tests passed against fresh MariaDB, plus typecheck, lint and production build. Published tree was verified against the local tree; GitHub run 37596782403 passed verification and Docker smoke checks at 542494c5eefbf420d7d96daacc0d9db3a87909ad. Firefox desktop is reported working; Firefox mobile acceptance is deferred by the user. No newly accepted item; progress remains 6/44.

## Hide chats increment — 2026-10-07

- Item 12 implemented: direct/group chats can be hidden and restored through a separate Hidden chats sidebar view. Regular-list search excludes hidden chats. Account-scoped local settings survive reopening, incoming deliveries and history imports without deleting messages. Hidden chats remain accessible in the unlocked session; hiding does not silence push notifications, lock content or sync to other devices. Exported backups do not include hidden choices. See docs/HIDDEN-CHATS.md.
- All 60 tests passed against fresh MariaDB, including account isolation and delivery/import persistence of hidden choices. Typecheck, lint (0 errors, existing warnings), build and whitespace checks passed. GitHub workflow and physical acceptance pending at publication. Accepted remains 6/44; item 12 is awaiting device testing.

## Individual hidden messages — 2026-10-07

- Items 04/11 implemented: saved messages expose local hide/restore actions, and each conversation has a separate searchable Hidden messages view. Regular message search and sidebar previews exclude hidden content. Flags are stored separately per account and message ID, retaining original content and surviving edits, deletion controls and imports. Pending messages cannot be hidden. Sending returns to the regular view; opening a chat does not automatically emit new read receipts for hidden messages. Prior receipts cannot be withdrawn.
- Hiding provides organization, not a lock or encryption at rest. Hidden content remains in encrypted chat exports; the hiding choices are device-only and excluded from backups. See docs/HIDDEN-MESSAGES.md. All 61 tests passed with fresh MariaDB, including hidden-message projection, account isolation, edits, imports, preview exclusion and restoration. Typecheck, lint and production build passed; final publication workflow and device acceptance pending. Accepted remains 6/44.
- Previous hidden-chat publication verified: GitHub run 37597696651 passed verification and Docker smoke checks at 2fedcd2a34f7b75a2004d6d3c9fa98cf8ccc6ffb. Item 12 remains awaiting physical acceptance.

## Firefox notification setup hardening — 2026-10-07

- Preserved latest branch work at 2fedcd2a34f7b75a2004d6d3c9fa98cf8ccc6ffb. Its GitHub Actions run 37597696651 completed successfully, superseding the hidden-chats checkpoint's pending CI note.
- Notifications now explain untrusted/nonsecure contexts, missing service-worker/push APIs and denied site permission separately. Capability detection does not require Firefox Android PWA installation. Enable continues requesting permission directly from the user action before waiting for subscription setup. Worker readiness is bounded to 10 seconds and rejects incomplete active/push registrations with recovery guidance. No HTTPS or certificate bypass was introduced.
- Friend profiles and owner-controlled picture downloads were already implemented in the newer branch (migration 0012, public/auth/member shapes, server visibility/block/download enforcement, additive setup and encrypted metadata recovery); retained those changes and reran their MariaDB acceptance regressions. Hidden usernames/bios remain subject to owner privacy, rather than being exposed by the profile view. Physical Firefox mobile checks remain deferred and no new feature is counted accepted.
- Local validation: all 63 tests passed using a fresh disposable MariaDB database; typecheck, lint (0 errors/11 existing Fast Refresh warnings), production build and whitespace checks passed. Added capability-matrix and worker readiness/timeout/rejection tests. GitHub Actions run 37598357433 passed verification and Docker smoke checks at checkpoint 598464b6133093e67fec24d32d4c92e3b9977555: https://github.com/ibrahim1101/Locat/actions/runs/37598357433 . Device acceptance remains 6/44.
- Next device checks: Firefox Android regular HTTPS tab, Enable/Send test in foreground and background, deny permission and verify instructions, close all tabs/reopen after worker update, and messaging/image upload/offline reopening. Compare Chrome. From direct-chat avatar and group members, view a friend's profile; toggle picture-download permission in the owner's top-left profile editor, reopen the friend's profile and verify the download control and server refusal when permission is off. Downloads cannot prevent screenshots or copies of already viewable images.

## Appearance refinement — 2026-10-07

- Item 20 implemented awaiting device acceptance: Light/Dark/System modes now run through an app-lifetime controller, so system changes apply outside Settings and at login. Added Teal, Blue, Violet and Rose accents with separate light/dark primary values. Theme also updates the root dark class, browser theme color and sidebar/focus variables. Choices synchronize across browser tabs and remain browser-local; invalid saved values fall back safely, and denied persistence applies a session choice with feedback. See docs/APPEARANCE.md.
- All 66 tests passed with fresh MariaDB, including system changes, fixed-theme behavior, persistence, cross-tab changes, denied storage and listener cleanup. Typecheck, lint (existing warnings only), build and whitespace checks passed. GitHub publication checks and physical color/contrast/browser acceptance pending. Accepted remains 6/44; #20 is implemented and automatically verified.
- Hidden-message workflow 37598729543 passed verification and Docker smoke checks; #04/#11 still await device acceptance.

## Dependency security review — 2026-10-07

- Reviewed from a clean `npm ci` installation. `npm audit --omit=dev` reports 0 production/runtime advisories. Compatible updates reduced the full development-tree audit from 23 advisories (15 high, 7 moderate, 1 low) to 11 (5 high, 6 moderate, 0 critical). Updated Vite/PostCSS/Rollup/Babel/ESLint-related transitive tooling and moved the direct esbuild build dependency to the tested 0.28 line.
- The 11 remaining findings are development-only Tailwind 3 watcher/glob tooling and Drizzle Kit's deprecated loader. Locat does not expose these tools to application requests. npm proposes a breaking Tailwind 4 migration and a Drizzle Kit 0.18.1 downgrade; neither is safe as an automatic audit fix. No `--force`, Drizzle downgrade or untested Tailwind migration was used. See `docs/DEPENDENCY-SECURITY.md` for boundaries and follow-up.
- Local validation after the dependency changes: all 66 tests passed against a fresh disposable MariaDB database; typecheck, lint (0 errors/11 existing Fast Refresh warnings), production build and whitespace checks passed. GitHub Actions run 37634692081 passed MariaDB verification and Docker smoke checks at checkpoint 7685931fdc71ad130dcd56a8465f6b97644d422b: https://github.com/ibrahim1101/Locat/actions/runs/37634692081 . This is hardening, not a roadmap acceptance event; device-confirmed remains 6/44.


## Voice messages — 2026-10-07

- Item 05 implemented, awaiting workflow and physical acceptance: direct and group chats can record up to 60-second voice notes through the browser microphone. Locat selects a supported MediaRecorder format (Opus/WebM, Opus/Ogg or MP4), caps prepared audio at 2.9 MB, validates duration/type/encoded size, then places the recording inside the existing AES-GCM encrypted message envelope. The relay sees only opaque ciphertext.
- Voice notes use the existing durable outbox, retry receipts, offline delivery, local IndexedDB history, read receipts, hide/restore and sender delete-for-all behavior. No server media table or plaintext upload endpoint was introduced. Playback is generated locally from decrypted bytes with native browser audio controls. Conversation previews identify voice messages without exposing their content.
- Recording requires HTTPS/localhost and microphone permission. Unsupported recording codecs fail closed with an actionable message. External recording/screen capture cannot be prevented. Item 05 remains unaccepted until two-device testing confirms record/send/playback, denied permission, offline queue/reconnect, group delivery and delete/hide behavior. Accepted remains 6/44.


## Core attachment and location expansion — 2026-10-07

The user identified attachments and GPS sharing as primary Locat goals, so these are now first-class Locat 1.0 requirements rather than post-1.0 extras. Items 45-49 extend the encrypted messaging model.

Design constraints:
- Message attachments must be encrypted client-side before relay/storage. The relay must not receive plaintext attachment contents, filenames, captions or GPS coordinates except unavoidable transport metadata such as ciphertext size/timing.
- Do not use data URLs for arbitrary active content. Decrypted files must be rendered only through explicit safe viewers for allowlisted media types; all other document/file types download as inert blobs with sanitized filenames. PDFs should default to download/open-via-user-action rather than injecting document content into Locat's DOM.
- Add a shared attachment contract with bounded filename, MIME/type metadata, byte size and encrypted bytes. Keep backward compatibility with existing image and voice payloads.
- Large attachments must not simply expand the current ~6 MB JSON envelope indefinitely. Introduce configured limits and a chunked/encrypted attachment path before enabling large videos/general files; preserve offline/retry semantics and garbage-collect incomplete/acknowledged ciphertext safely.
- Photos get local thumbnail/preview plus original/full-resolution send where configured. Videos get local metadata/preview/playback and explicit size/duration limits.
- Static location sharing uses the browser Geolocation API only after an explicit user action and permission. Encrypt latitude/longitude (and optional accuracy/label) inside the message payload. Do not continuously track location for the static-location feature. Live location, if added later, requires a separate expiry/update protocol and privacy review.
- Installed-PWA share-target integration is progressive enhancement only; browser/platform support is not universal. The normal in-chat attachment picker remains the compatibility path.
- Acceptance must cover denied permissions, malformed/hostile files, unsupported MIME types, oversized attachments, offline/reconnect, receiver download/playback, delete/hide behavior, group delivery, and Firefox-mobile compatibility.
