# Complete-ecosystem engineering history

## 2026-10-11 — isolated development branch

The dedicated local branch `feat/locat-complete-ecosystem` starts at
`b8497742062b1708f10c262d14291f66f6184626`. The previous application preview
is `af63b2c`; its successful installers and CI runs remain historical evidence,
not validation of the changes below. Earlier work is retained in
`UNIFIED_ENGINEERING_HISTORY.md`, `PROJECT-HISTORY-AND-HANDOFF.md` and the
module engineering histories.

Recovered all 49 numbered original requirements from repository history and
recorded their evidence and gaps in `LOCAT_COMPLETE_FEATURE_MATRIX.md`.
Milestones M0–M11 were recovered. M12/M13 identities remain unresolved; no
module was invented to repair inconsistent historical counters. Original
physical acceptance is supported only for numbered 01/03/06/07/17/41. The
later 13/44 counter is preserved as an unaudited historical statement.

Implemented increments include encrypted static GPS/location sharing,
identity-derived durable encrypted drafts, the Obsidian Ember default,
graphic/parametric Web Audio EQ and local music queue/presets/favorites,
bounded client-encrypted Vault and Secrets stores, scoped local search,
live Dashboard metrics and an administrator-only Hub using existing
server authorization. The official cat logo is unchanged.

Private stores use random AES-256-GCM master keys wrapped using a separate
PBKDF2-SHA-256 passphrase, 600,000 iterations and authenticated scope binding.
Account-row locks serialize initial writes, quota enforcement and revision
checks. Security review found and corrected credential-edit stale revision
handling and the oversized wrapped-key configuration bound. Encrypted backup
restore authenticates all records before writing, preserves existing entries
and supports recovery to an empty store on the same account/server/module.
See `PRIVATE_STORES.md` for limitations and physical acceptance steps.

Link private-key proof enforcement is integrated with the client and tested
for revocation, session binding, canonical historical key aliases and actor
authorization. Historical pairings require both devices to confirm again.
Revocation purges pending ciphertext. Proof state is in-process and fails
closed after restart; multi-worker shared state, transfer/sequence-bound
ciphertext replay protection and genuine LAN discovery are not implemented.

Generating current Drizzle snapshots exposed another historical gap: Link,
Sentinel and recovery tables existed only in additive bootstrap, so a fresh
canonical migration would lack the table changed by migration 0014.
Migration 0013 now reconciles those missing tables with dependency-ordered
`CREATE TABLE IF NOT EXISTS` statements and inline keys, preserving existing
tables. Both new snapshots were generated with the official Drizzle tool;
newer generations no longer treat the bootstrap tables as missing.

Docker source now installs FFmpeg/FFprobe and has an optional read-only media
mount override. Current-branch filters are added to native preview workflows.
A real Chromium OfflineAudioContext signal test is prepared for CI. It has
not run locally: official Chromium downloads returned truncated archives.

### Verification observations

- Dependency installation succeeded with `npm ci --ignore-scripts`.
- Disposable MariaDB 10.11.14 runs execute the test suite against a fresh
  `*_test` database; no user or production database is used. Fresh setup runs
  twice to check idempotency. Private-store API tests exercise ownership,
  encryption roundtrip, concurrent first writes, stale revisions and the
  128-entry quota race.
- Intermediate full suite: 325 passed, two source-contract checks failed
  because they still expected the former in-memory draft calls. All 27
  database integration tests passed. Final results will supersede this entry.
- Remote Python suite: 47 tests passed.
- Intermediate typecheck exposed the expected incomplete migration of Link
  client callers to proof-required inputs. Final results are recorded below.
- `npm run desktop:build` stops at `cargo metadata`: Cargo is absent.
  Docker, Java and Android SDK are also unavailable locally. No current
  native installer or Docker image is claimed to have built.

### Publication boundary

Two GitHub push attempts were rejected by automatic approval review.
The second rejection stated that authorization in the attached assignment
was untrusted evidence and did not establish user authorization to publish
the source and internal audit documents to GitHub. No alternate transport
was used. The branch remains unpublished and no draft PR or new workflow
run has been created. Direct user approval is required before retrying that
publication step. No main merge, production deployment or live migration
occurred.

This is an implemented development increment, not a complete ecosystem
release. Calling, MFA/passkeys, scheduling/expiry/view limits, account closure,
several planned modules and native physical acceptance remain open. Consult
the canonical feature matrix and release-readiness register rather than
inferring completion from routes or package compilation.

### Final local verification

Final source checks on 2026-10-11 supersede the intermediate failures:
application changes are committed locally as `c55f290` and `3b031a9`;
the initial recovery register is `5c0da67`. Subsequent delivery/documentation
changes do not imply execution of blocked platform workflows.

| Check | Result |
|---|---|
| Full Vitest suite with real disposable MariaDB | 55 files / 334 tests passed; 28 database integration tests included |
| Fresh canonical Drizzle migrations | Passed; all 24 application tables plus migration tracking created, including Link proof schema |
| Full suite after fresh canonical migrations | Same 55 files / 334 tests passed; verifies CI migration-before-test ordering |
| Repeated additive bootstrap and metadata restore rehearsal | Passed within database integration suite |
| TypeScript | Passed |
| ESLint | Zero errors; 12 existing warnings |
| Production web/offline/backend build | Passed; existing large-bundle warnings remain |
| Remote Python suite | 47 / 47 passed |
| Drizzle snapshot regeneration | No schema changes; nothing to generate |
| Whitespace checks | Passed |

These checks do not establish native physical acceptance, Docker execution,
actual browser-rendered audio output or a complete production release.


## 2026-10-12 — authorized publication and LAN compatibility

The user directly authorized publication with “Proceed”. Shell Git push had
no credentials, so the connected GitHub account published the four reviewed
commits. Every created Git tree matched its local counterpart exactly:
local 5c0da67/c55f290/3b031a9/d6f0edb correspond to published
06bcb44/16ccf7e/db6b013/87a7c9b. Commit metadata differs; source bytes do not.
Draft PR #7 targets feat/locat-unified-platforms, stacked on draft PR #6.
No main merge or production deployment occurred.

The unified branch advanced independently to 7b50db7 with an opt-in Caddy
LAN HTTPS overlay and acceptance documentation. These four files were
merged into the ecosystem branch without conflict; no existing source or
production configuration was replaced. Android trust of the private LAN CA
and physical Windows/Raspberry Pi acceptance remain open.

Initial published revision 87a7c9b passed core/database/Docker CI runs
38174264658 and 38174290188. Both include real Chromium audio signal checks.
Signed Android preview run 38174264681 succeeded. Desktop run 38174264666
was still running when this entry was prepared. These results apply to
87a7c9b and cannot be assumed for subsequent changes.

Additional review found that Web Audio interprets highpass/lowpass node Q
in decibels, while the UI and headroom model use conventional linear Q.
The graph now converts pass-filter Q with 20*log10(Q), leaving peaking Q
unchanged. Focused graph tests pass; the real Chromium regression now also
measures Butterworth -3 dB cutoff and Q=20 resonance/headroom. Reference:
https://www.w3.org/TR/webaudio-1.0/#dom-biquadfilternode-q .
CI now validates combined LAN/media overlays with isolated synthetic
settings. Final builds after this correction remain pending at this entry.


### Corrected-source CI and packaging observations

At 723647f both current core CI runs (38174523675 / 38174520002) passed,
including 334 tests, fresh canonical migrations, repeated bootstrap, Docker
readiness/tools/admin checks and combined LAN/media Compose validation.
Actual Chromium RMS measurements: Pure 0.707107; -12 dB cut 0.177617;
headroom-compensated boost 0.707107; Butterworth cutoff 0.500000;
Q=20 compensated pass-filter cutoff 0.706886. These verify generated test
signals, not audible device behavior or arbitrary signal clipping guarantees.
Android run 38174520046 passed signing/package checks. Corrected-source
desktop run 38174519996 is still running at this documentation point.

An extra two-database local repeat passed its first 334-test suite, but the
second fresh-migration suite failed after its destructive contact-table
recreation fixture: MariaDB returned errno 1932, table does not exist in
engine, followed by 16 cascading failures (318 passed). The cause is not
established. Earlier local repeats and both corrected-source CI runs passed
this ordering; retain this observation for fixture/environment investigation
rather than discarding it as proof of an application defect or hiding it.

The preview APK workflow had used github.run_number as versionCode, which
can reset with a recreated workflow. It now uses UTC seconds with Android's
signed-integer bounds, checks the resulting signed manifest and records the
version in build-info. A generated Gradle fixture preserving preview isolation
and increasing the earlier 194 code passed locally. A new signed APK run is
required to verify that workflow change. The persistent key and original
application ID are preserved.


### Final published artifact verification — 2026-10-12

Source 4f2d594 passed both core CI runs 38174993485 / 38174990264,
including real MariaDB, fresh/repeated schema setup, Docker tools/readiness,
LAN/media configuration and actual Chromium audio tests. Signed Android
run 38174990286 passed; manifest package is com.shaikibrahim.locat.preview,
versionCode 1791752828, APK v2/v3 signatures verified. Artifact 11715377855
contains APK, checksum, build-info and public signing-certificate metadata.

Corrected application source 723647f passed desktop run 38174519996 for
Windows NSIS EXE (artifact 11715099834), Linux DEB/AppImage (11716030238)
and macOS APP/DMG (11715805824). Runtime application, web and desktop sources
are unchanged between 723647f and 4f2d594; only Android build numbering and
documentation changed. These are preview packaging results; physical native
acceptance, LAN private-CA/Android WebView trust and Raspberry Pi deployment
remain open. Main and live environments were not modified. This documentation
follow-up does not alter the verified application or platform workflows.


### Android launch report and Link file-context protection

The user reports that the preview app opened on Android. This verifies the reported launch only; login, LAN trust, transfers, Cinema, Music and other device acceptance are not inferred.

File chunks now use AES-GCM additional authenticated data covering the versioned file domain, account ID, transfer ID, sender/receiver direction, filename, MIME, total size, chunk count and sequence. Expected plaintext chunk lengths are checked, including zero-byte files. Download completes only after every chunk authenticates. Upload and download failures are visible, and oversized files are rejected before buffering. No database migration is needed.

Compatibility: both file-transfer devices must update. Unbound older file ciphertext deliberately fails verification in the updated receiver; cancel and resend these transfers. No legacy unauthenticated fallback is used. Clipboard payloads remain unchanged and still need contextual replay protection; proof state remains process-local. This does not authenticate the relay/server identity or provide LAN peer discovery.

Validation: targeted Link/ownership-proof tests passed 12/12, including changed transfer IDs, accounts, device directions, metadata, sequence substitution, ciphertext corruption, legacy ciphertext, invalid contexts and zero-byte files. TypeScript passed; lint had no errors and the same 12 existing warnings. Production build passed. The full local suite passed 308 tests; 28 real-database tests were skipped because this run had no TEST_DATABASE_URL. Fresh remote database and native checks are pending. New native packages require fresh CI; the existing artifact links refer to the prior revision.


### Durable clipboard context and transfer lifecycle locking

Clipboard/text/URL sending reserves a durable server message ID, then encrypts with AES-GCM AAD binding that ID, account, sender, receiver and kind. Empty reservations are hidden from the inbox, capped at 100 per account and expire after 15 minutes. SQL uses the database clock for expiry/cleanup: the initial real-DB run exposed a timezone discrepancy in application-clock comparisons; corrected runs passed. Publication is immutable; exact retries preserve acknowledged state. Empty reservations cannot be acknowledged. Old clients must update with the server and resend older unbound payloads; there is no insecure compatibility fallback. Failed authentication is now visible.

Clipboard copy now completes before acknowledgement; denied/unavailable clipboard access leaves the message available. File upload, completion, cancellation and device revocation share the account lock order. Transfer/chunk rows are locked while writing/purging; exact chunk retries are allowed, differing replacements conflict, and closed transfers cannot reopen or regain ciphertext. This uses existing tables with no schema migration. Device-proof state is still process-local; LAN discovery and physical acceptance remain open.

Final local checks: 337/337 tests passed twice against disposable MariaDB, including 28 integration cases, once after fresh canonical migrations (25 tables). Regression coverage exercises hidden/expired reservations, sender authorization, immutable publication, retry after acknowledgement, unchanged chunk retries, replacement conflicts and concurrent upload/cancellation with zero remaining chunks. TypeScript and production build passed; lint had no errors and 12 existing warnings. The previous file-context revision fd8a91a passed both core CI runs and all native packages. Fresh CI/native packaging for this clipboard/lifecycle batch is pending at publication.


### Bounded Link file buffering and cancelled saves

Upload now reads one 256 KiB Blob slice per chunk instead of buffering the whole file. Receive validates metadata before allocation and writes authenticated chunks directly into one bounded assembly buffer rather than retaining all chunks plus a second merged copy. Zero-byte files still authenticate their one empty chunk. Download cancellation leaves ciphertext/transfer available instead of marking delivery complete. Saving and native bridge serialization can still allocate additional memory; this is not a streaming-to-disk implementation or a measured Android performance claim.

Validation: 311 non-database tests passed; 28 DB cases skipped in this client-only run (previous server batch passed all 337 twice). New tests verify exact slice ranges, empty/final chunks, size/position bounds, short reads and validation before allocation. TypeScript/build passed; lint has no errors and the same 12 warnings. New native packaging is required before the memory changes appear in installers.


### Raspberry Pi installer media runtime

The Linux/Pi installer now installs Debian's FFmpeg package and checks both FFmpeg and FFprobe before setup, addressing the missing media dependency outside Docker. `bash -n` and `--help` passed. No privileged installation or physical Pi testing was run in this workspace; ARM64 availability, native decoding and transcoding performance remain acceptance items.


### Verified overnight builds and browser download memory

Revision be44d4d passed both core/database/Docker checks and Android/Windows/Linux/macOS packaging. Download guide now links those verified artifacts. Browser download no longer reads/encodes the entire Blob before discovering that no Android folder is selected. Selected-folder writes still require base64 for the native bridge. Regression verifies Blob.arrayBuffer and folder write are never called on the browser path; targeted tests 12/12, TypeScript, targeted ESLint and production build passed. New revision packaging is pending.


### Complete-ecosystem build consolidation, 2026-10-12 morning

The user re-confirmed Android launch and authorized continued work without waiting for manual testing. CI caught the browser-folder preference check invoking localStorage without a browser window in the image-download regression. Added the browser guard; targeted image/download regressions passed 15/15. This corrects the prior partial-suite verification; failed push/PR core runs were 38192329612/38192332500, while APK packaging passed.

Merged unified branch 2845da6 (without changing that branch): chat-first route/navigation, LAN diagnostic CLI and tests, trusted-certificate proxy overlay and strict database-ready native onboarding. The complete ecosystem keeps encrypted private stores, Link context/lifecycle and media work. Merge had no conflicts. LAN private-CA acceptance, certificate issuance/renewal and physical performance are still unresolved; the trusted overlay requires an operator-supplied valid certificate.

Consolidated local validation: 348/348 tests across 58 files passed twice with disposable MariaDB, including after fresh canonical migrations (25 tables); LAN CLI tests also passed. TypeScript/build passed, lint has no errors and 12 existing warnings. Packaging/core CI for this consolidated revision must pass before its downloads are advertised as verified. This remains an incomplete ecosystem preview; the canonical feature matrix lists remaining features and release gates. No main merge, production deployment or device-testing claims were made.


### Consolidated preview verification and artifacts

Application revision 13d87ed passed core PR run 38192834956 and push run 38192831712, including full MariaDB tests, fresh migrations/bootstrap, Docker/media readiness and Chromium audio signals. Android run 38192831774 passed and produced signed artifact 11722735364. Desktop run 38192831708 produced Windows 11722047544, Linux 11721819857 and macOS 11722281819. Download/readiness docs now reference this consolidated revision. Documentation-only follow-up does not change runtime source.

The build milestone is complete for this partial preview. It does not complete the 49-feature ecosystem or establish physical performance, native secure storage, LAN certificate trust on devices, release signing/notarization or production readiness. Main, production and the unified source branch were not modified by this session.


### Continued original messaging implementation: reactions, references, pins and forwarding

Added bounded encrypted reaction/pin control contracts, persistent relay-ordered local projection and encrypted archive metadata. Reactions are actor-scoped (one of six emojis or removal); any current member can change shared pins. Targets bind original author plus stable reference within the relay conversation. Controls survive delayed target arrival, retries and backup/restore. Membership/actor identity uses existing trusted relay metadata, not independent message signatures.

Replies now carry encrypted stable references instead of text quotes. Preview follows edits, excludes hidden/deleted targets and can jump to the current original. All original payload kinds can receive text replies. Forwarding uses explicit current-member destination selection, hidden/archived/stale-key/blocked-direct exclusions, source recheck and destination-key resealing; it strips source/reply references and generates a new message identity. Failed queueing leaves the dialog available; location forwarding warns about coordinates. Forwarded copies cannot be withdrawn by original deletion.

Validation: 365/365 tests across 62 files passed twice with disposable MariaDB, including 29 integration cases and fresh canonical migrations; five LAN CLI tests passed each run. TypeScript/build passed. Initial lint found two unused destructuring variables in forwarding; replaced with explicit deletion from a clone, targeted forwarding tests passed 3/3, and lint now has zero errors and the same 12 existing warnings. Native/browser physical interaction is not claimed. No migration is needed. New protocol fields require updated peers; no capability negotiation or separate threaded viewer exists yet. Remaining ecosystem work stays in the canonical matrix.


### Messaging batch packaged and continuation aligned

Runtime cb1785d passed core PR run 38195261112 and push run 38195258093, including real MariaDB/fresh schema checks, Docker and Chromium audio validation. Android run 38195258094 produced signed artifact 11722648628. Desktop run 38195258114 passed all three OS jobs: Windows 11723291595, Linux 11723451199 and macOS 11722673625. All artifact metadata identifies cb1785d, and none was expired at verification. Download/readiness guides now reference this messaging build.

The existing enabled hourly Locat development task was aligned with feat/locat-complete-ecosystem/PR #7 and the current matrix. It preserves the existing cadence and continues feasible implementation without waiting for manual test feedback, while retaining production/main/identity/data boundaries and honest physical acceptance. No duplicate task was created or unrelated task modified. Remaining features are still unimplemented; native packaging success does not complete the full ecosystem.


### Restart-safe scheduled encrypted delivery backend

Added a persisted scheduled-message relay protocol without changing the encrypted payload format. Authenticated senders may reserve an immutable encrypted envelope 30 seconds to 30 days ahead; exact retries return the same schedule and changed retries conflict. Scheduling and release recheck current membership, direct accepted-contact/block state and group key epoch. Per-account locking bounds pending work to 100 messages and 100 MB. Due rows are locked and atomically converted into the normal message/delivery/retry-receipt queue, allowing multiple workers or a restarted server to converge on one release. Owner-only cancellation works only while pending. Ciphertext is cleared after delivery, cancellation or failure; terminal metadata is retained seven days. A generated additive migration, idempotent bootstrap, readiness and doctor checks were added.

This increment exposes schedule/list/cancel APIs but does not yet add composer or schedule-manager UI. Exact delivery while the host is offline, native background notification/timezone behavior and physical Docker/Pi restart acceptance remain open. The server necessarily observes schedule metadata and ciphertext size. Local verification passed TypeScript, production build, 336 non-database tests, five LAN CLI tests and lint with zero errors/12 existing warnings. The 31 MariaDB cases, including two new schedule authorization/concurrency cases, were skipped because this workspace has no disposable MariaDB; current migration/bootstrap/database/Docker and native packaging therefore require CI evidence before this revision is advertised as verified.

The first published CI run exposed a genuine retry mismatch: MariaDB `TIMESTAMP` stores whole seconds while the API compared the caller's millisecond timestamp. The initial schedule was correct, but an exact client retry could conflict after database round-trip. Delivery times are now canonicalized to whole seconds before validation, storage, comparison and response. This preserves idempotency and accurately reflects the database/worker scheduling precision. The failed push run was 38196775062; its Docker job and fresh migration step had already passed before the integration regression stopped verification.

Corrected revision fa27df4 passed push core run 38196943842 and PR core run 38196947506. Both completed all 367 tests, including 31 real MariaDB integration cases and the two new schedule cases, plus fresh canonical migration, repeated additive bootstrap, Docker/media readiness, real Chromium audio, TypeScript, lint (zero errors/12 existing warnings), production build and Pi installer syntax/help. Signed Android run 38196943742 passed and produced artifact 11723349489 with commit/version/checksum metadata. The final server/docs-only fix did not trigger desktop packaging; existing desktop cb1785d packages remain the current preview artifacts because their application paths were unchanged. No physical runtime, exact offline delivery, Pi deployment or production readiness is inferred.

### 2026-10-12 — LAN first with optional outside Tailscale invitations

The user explicitly requires all features on the same network without
Tailscale, with optional Tailscale invitations for outside devices. Current
application source has no Tailscale feature gate. Added a configurable
`LOCAT_LAN_BIND_IP` Docker HTTPS binding to permit LAN proxy/Tailscale Serve
coexistence, preserving the existing LAN-only default, loopback backend and
single persistent database. Documented one canonical trusted HTTPS hostname,
LAN DNS override, certificate renewal, private Serve and independent Locat
permissions. The architecture is a deployment recipe, not automatic LAN
DNS/discovery or verified physical coexistence.

Extended the read-only readiness CLI with an explicit `--tailscale` IPv4
route check. LAN mode remains default and rejects tailnet/mixed addresses;
both validate normal TLS and the same backend without redirects. Route
address validation is not Tailscale identity or invitation verification.
Eight CLI tests and three LAN proxy contract tests passed; `git diff --check`
passed. Docker is unavailable in this workspace, so actual Compose runtime,
LAN DNS, trusted certificates and outside invitations are not claimed tested.
The existing hourly continuation prompt now carries the same networking
requirement without changing its cadence or creating another task.

Scheduling retry/quota/worker hardening and encrypted local schedule-copy
helpers remain separate uncommitted work; this networking publication does
not claim a finished scheduling composer or the full ecosystem.

### 2026-10-12 — Scheduled text composer, manager and recovery

Connected text/reply scheduling to the existing encrypted relay backend.
The composer selects local device time, preserves edits while a request is
in flight, and keeps the draft after failure. The manager shows pending-first
host status, owner cancellation, exact saved-request retries, recovery text
and local-copy deletion, with hidden-chat previews redacted. Requests are
saved before RPC as identity-derived AES-GCM encrypted copies scoped to
origin/account/UUID; local writes are atomically capped at 200. Unconfirmed
requests never enter the normal outbox. Released is explicitly distinguished
from received/read. The original matte-black/burnt-orange UI tokens remain.

Review corrected expired-time exact retries, concurrent retry result state,
normal-send/scheduled retry-ID collisions, sender queue backpressure, batch
starvation, conflicting legacy receipt isolation and authorization lock
ordering. Cancellation tombstones survive through the original future date
plus seven days so delayed retries cannot recreate cancelled jobs after early
cleanup. Terminal ciphertext is still cleared immediately.

Verified final source: 378/378 tests across 64 files, including 35 real
MariaDB integration cases, twice including after fresh canonical migrations
(26 tables). Eight LAN/Tailscale CLI cases passed each run. Regressions include
concurrent scheduled creation/workers, owner cancellation, retries after due
time, receipt conflicts, a real >100 MB relay backlog, bounded batch fairness,
pending-first listing, future cancellation tombstones, encrypted recovery
context/tamper/isolation and atomic local write bounds. TypeScript passed;
lint has zero errors and 12 existing warnings. Production build verified
before publication; browser/native packaging CI follows this source commit.

No physical device, notification, timezone-change, LAN DNS or real host
restart acceptance is inferred. Scheduling UI is text-only; direct identity
key changes are not yet detected and can make prepared envelopes unreadable.
Group rekeying fails closed. See SCHEDULED_MESSAGES.md and the feature matrix;
the full 49-feature ecosystem remains incomplete. Prior networking revision
c1c768f passed both core checks and signed Android/Windows/Linux/macOS package
workflows (38199692626, 38199689307, 38199689218, 38199689280).

### 2026-10-12 — Native chat server/account storage isolation

The native audit found account-only IndexedDB names and an unscoped offline
account pointer shared across server hosts. Different servers can reuse the
same numeric IDs. Added canonical HTTPS origin/account native database names
for the complete chat store (identity, Link device keys, messages, controls,
privacy, metadata, cached conversations, drafts/recovery copies and outbox).
The runtime binds its first origin and rejects hot changes pending reload,
preventing delayed work from crossing into another host's store. Offline
bootstrap also checks public identity agreement. Native backup account origin
now names the actual server instead of the common shell origin.

Browser names and browser legacy migration stay unchanged. Old native
account/relaychat archives remain untouched and quarantined from automatic
identity/history migration because their server ownership is unknown. Old
unscoped offline pointers are ignored. This may require password-backed key
restore and leaves legacy native history migration/export unresolved; no
app-data deletion, destructive uninstall or inferred ownership is performed.
Device-wide theme/app-lock/some notification preferences remain device-wide.

Final local verification: 382/382 tests across 65 files, including 35 real
MariaDB integration cases, twice including fresh migrations (26 tables);
eight LAN/Tailscale CLI cases passed each time. Four new IndexedDB regression
cases cover cross-server overlapping IDs, identity/device/history/privacy/
outbox isolation, canonical restart recovery, hot-change rejection,
quarantined archives and unchanged browser names. TypeScript and production
build passed; lint has zero errors and the same 12 existing warnings.
Physical native upgrade/offline/user-archive recovery remains unverified.
See NATIVE_SERVER_STORAGE.md. The previous scheduled-text source 85c4d20
passed push core run 38213817491 and signed Android run 38213817326,
artifact 11731150284; remaining desktop/PR checks were still running when
this source increment was prepared.

### 2026-10-12 — Verified scheduling/isolation package evidence

Packaged runtime 8382a59bf3296bd97e1da08cf1304014abaf6aba passed both core
workflows 38214438381 / 38214432772: 382 tests across 65 files, database fresh
migration/bootstrap, Docker/media readiness and real Chromium audio checks.
Signed Android workflow 38214432639 passed; artifact 11732115081 is unexpired
and matches this runtime SHA. Desktop workflow 38214432675 passed all three
jobs, with matching unexpired artifacts: Windows 11732175682 (NSIS EXE),
Linux 11731401517 (DEB/AppImage), macOS 11731296335 (APP/DMG). Exact links are
recorded in ECOSYSTEM_PREVIEW_DOWNLOADS.md and draft PR #7.

Remote Python regressions additionally passed 47/47 in the current checkout.
No physical upgrade/host restart/notifications/network switch or complete
49-feature acceptance is claimed. Legacy native archive migration/export,
direct scheduled-message key-change detection, calls, MFA/passkeys, expiry/
view limits and incomplete ecosystem modules remain explicit open work.
This evidence/download documentation follow-up changes no runtime source.

### 2026-10-12 — Scheduled direct identity-change protection

Added nullable scheduled-message direct key-context metadata and canonical
migration 0016_scheduled_key_context, additive/idempotent bootstrap support,
and readiness/doctor column checks. Acceptance records a SHA-256 context over
the conversation and ordered current member public keys; delivery revalidates
it under ordered participant row locks. Sender or recipient identity changes
after acceptance fail that job with direct_key_changed and clear terminal
ciphertext. Legacy direct jobs without context fail closed instead of guessing
which keys sealed the envelope; group epoch behavior remains unchanged.
Exact retries retain the original job/context rather than recapturing keys.

Local verification: 383 tests across 65 files, including 36 real MariaDB cases,
passed twice including after fresh migrations; eight route CLI cases passed
per run. The new regression rotates each direct identity independently and
checks unbound legacy jobs. TypeScript/build passed; lint has zero errors and
12 existing warnings. New schema readiness must be applied through the normal
isolated deployment workflow; no live database migration was performed.

This snapshot protects changes AFTER server acceptance. A client that was
already encrypting with stale keys before acceptance is not yet detected;
refresh before scheduling after a key change. Recovery copies remain encrypted
under their original identity; replacing that identity can prevent unlocking
them. Installed-device/clock/notification acceptance remains pending. This is
an incremental scheduling protection, not completion of the ecosystem.

### 2026-10-12 — Client-bound scheduled key context

Closed the pre-acceptance stale-key window left by the prior relay-only
snapshot. Shared key-context serialization now agrees between WebCrypto
clients and server SHA-256. Direct schedule creation requires the client's
context to match current locked identities. Encrypted recovery copies persist
that context and exact retries reuse it; changed context is rejected for an
existing request. Refreshed identities produce a new scheduling attempt, and
its copy is durably saved before every RPC. Legacy clients missing context
cannot create new direct schedules; update client and server together.

Final verification: 385/385 tests across 66 files, including 36 real MariaDB
cases, passed twice including fresh canonical migrations; eight LAN/Tailscale
CLI cases passed per run. Tests include stale-context rejection, either member
rotating, legacy unbound jobs, client/server digest agreement, member ordering,
conversation/identity binding and encrypted context persistence. TypeScript
and production build passed; lint has zero errors and 12 existing warnings.
This supersedes the prior pre-acceptance limitation; physical native/clock/
notification acceptance and the other ecosystem work remain open.

### 2026-10-12 — Current account-state check after scheduling lock waits

Review found that the participant enumeration establishes an InnoDB snapshot
before waiting for identity locks. The sender-disabled query now uses a
locking current read, so an account disabled while the worker waits is not
released using its older enabled snapshot. A real MariaDB regression holds
an uncommitted disable, observes the worker's SQL lock wait through its own
process list, commits the disable and verifies failed/account_disabled with
cleared ciphertext and no release.

Final local verification: 386/386 tests across 66 files, including 37 MariaDB
cases, passed twice including fresh migrations; eight route CLI cases passed
per run. TypeScript/build passed and lint has zero errors/12 existing warnings.
The previous client-context runtime 9d9b29e passed both core workflows
38217577398 / 38217571750, signed APK 38217571748 and all three desktop jobs
38217571780. This follow-up tightens authorization while preserving the same
client key-context protocol. No live database or production change occurred.

### 2026-10-12 — Verified direct-scheduling protection installers

Runtime 438f2d26ca35b0657b3afca6d88520f4404c0110 passed both core workflows
38218538591 / 38218532957, including the real authorization lock-wait case,
386 tests across 66 files, fresh migrations/bootstrap, Docker/media readiness
and Chromium audio checks. Signed APK workflow 38218532975 passed, artifact
11733232808. Desktop workflow 38218532953 passed all jobs: Windows artifact
11733011893, Linux 11733631984, macOS 11733208112. All artifact records are
unexpired and identify this exact source SHA. The download guide is updated.

Client and server must be updated together for new direct scheduling context;
0016 adds the server metadata column and readiness rejects missing schema.
Legacy unbound jobs fail closed. No physical acceptance or production release
is inferred. This documentation update changes no runtime source.

## 2026-10-12 — login-first sections and attachment picture editor

The latest user requirement replaces chat-first entry with login-first unauthenticated entry and a section dashboard at `/` after session restoration/login. New native installations show login rather than the unauthenticated local tool homepage. Bottom-left server connection accepts a strict HTTPS origin and checks schema readiness before persisting; browser changes navigate to that origin. A global gate protects deep links. All registered modules, including planned and administrator modules, remain visible with disabled reasons. Implemented server sections require a successful readiness check; local media/search/diagnostics and the separate approved-host Remote prototype remain available within an existing authenticated session. New offline password login is not implemented; previously established offline identity rules remain. See `LOGIN_AND_SECTIONS.md`.

Picture attachments now open a local crop/zoom/position/quarter-turn editor with preview, reset, original send or edited JPEG send. Output is capped at 1600 pixels and 2.9 MB before the existing attachment pipeline. Original files remain untouched. Animation/transparency and unsupported native codecs are explicitly limited. No physical image-codec or memory acceptance is inferred.

Local validation: TypeScript and production build passed; lint has zero errors and 13 warnings (12 existing plus the new context fast-refresh warning). All 392 tests across 68 files passed against disposable MariaDB both before and after fresh canonical migrations; CLI LAN checks passed in both runs. CI adds actual Chromium crop/rotation/JPEG pixel tests and browser/native login-entry checks; those newly added checks require CI execution before being marked verified. Physical Android layout/keyboard, server switching and lifecycle acceptance remain pending.

Final runtime `89d650848ff633bc8a881bb7fd0140c6fe9ca742` also disables hosted media queries/playback controls while disconnected and keeps local Search refresh independent of the server. Core workflows 38223223591 / 38223216661 passed, including 392 tests/68 files, fresh migrations/bootstrap, Docker/media readiness and actual Chromium picture pixels. The browser entry test now performs mocked registration with real browser identity generation/storage, verifies navigation to sections, planned/admin restrictions, then disconnects and verifies server sections disabled while Music remains enabled. This is automated browser acceptance, not physical native acceptance. Signed Android workflow 38223216665 passed; artifact 11734997880 is unexpired and identifies this exact source. Desktop workflow 38223216683 passed all three jobs: Windows artifact 11735432798, Linux 11735098178 and macOS 11734853666. All records are unexpired and identify this exact runtime SHA. The download guide and readiness register now point to the verified login/picture build. The local Playwright package had no Chromium executable, so rendered checks were executed by CI rather than claimed locally.

## 2026-10-12 — explicit non-server entry and optional device passphrase

The user confirmed the login-first preview works on Android, then requested local tools without server authentication. Added **Use non-server mode** on login/key-restoration entry. AppEntry chooses an account-independent local tool home, unmounts account authentication/RPC providers and pauses readiness polling. Local Cinema, Music/EQ and real device API diagnostics are available; every remaining registered section stays visible but disabled with account/host/planned reasons. No synthetic account, server login, archive ownership guess or private-store bypass is introduced. Return to login resumes the normal server-account flow.

The local home exposes existing device app-lock enrollment/change/removal and inactivity/background policy without requiring a SessionUser. Passphrase verification uses the existing salted PBKDF2 verifier on the device, never a plaintext saved passphrase or server request. The same root gate protects local mode and account UI; existing lock configuration is preserved. Biometric enrollment/unlock stays disabled. This gate protects the interface, not original media files, and has no server recovery. Blob URLs are revoked on replacement, section changes, closing, locking and exit.

Local validation: TypeScript and production build pass; lint has zero errors/13 warnings. All 392 tests across 68 files passed twice against disposable MariaDB, including fresh canonical migrations, with eight LAN CLI cases per run. Initial source-only device-protection fixtures expected the previous main.tsx nesting and obsolete biometric wording; those two guards were updated to verify the shared outer gate protecting both branches, with no protection weakened. Chromium coverage now exercises local WAV/WebM decoding, disabled account features, passphrase enrollment, wrong-passphrase rejection, correct offline unlock and return to login with zero account RPC requests; this new browser test must pass CI before rendered behavior is marked verified. Physical Android acceptance of this new mode is not inferred from the earlier preview confirmation.

Final non-server runtime `5bb2ecaf31a8b47325d03de0ab8db300cdd44349` passed both core workflows 38225758881 / 38225753217, including 392 tests/68 files, fresh migrations/bootstrap, Docker/media readiness and Chromium local WAV/WebM decoding, wrong-passphrase rejection/correct unlock, disabled account sections and zero account RPC calls on fresh native-shell local entry. Picture pixels/JPEG and real audio DSP checks also passed. Signed APK workflow 38225753224 passed, artifact 11737006538. Desktop workflow 38225753347 passed Windows artifact 11736387768, Linux 11736472627 and macOS 11736071989. All artifact records are unexpired and identify this exact runtime SHA. Download/readiness documents and draft PR are updated. No physical acceptance of the newly added mode, production release, live migration or original app replacement is inferred.

## 2026-10-12 — dedicated local pages, media queues/resume and Photos editor

The user confirmed the Android/non-server preview works and requested distinct tool pages plus local photo opening/editing. Added local Cinema/Music/Photos/diagnostics/protection routes with section navigation. Entering non-server mode resets to its launcher. Added Photos to the module registry and authenticated shell as a server-independent tool; standalone local mode keeps account providers unmounted. Original brand/theme and existing server-account routes remain.

Local file selections now support a bounded 256-item queue, previous/next and automatic Music advancement/repeat. Local Cinema uses shared controls in account and non-server pages: bounded device-local resume, restart, speed, fit/fill, capability-gated fullscreen/PiP and local WebVTT subtitle selection. Progress stores 200 metadata-hash keys with duration checks; it is not a content identity proof. No raw filenames/paths or media are uploaded/stored by the progress ledger. Queues and file handles are not persisted across launches.

Photos opens supported raster files, applies crop/position/zoom/quarter-turn rotation, flips, brightness/contrast/saturation/grayscale/blur, bounded brush/text annotations and a 30-step undo/redo/reset history, then exports a new still JPEG through the existing download flow. Inputs are limited to 20 MB, exports to 1600 pixels/2.9 MB; original files remain untouched. Animation/transparency/layers/RAW/full-resolution professional editing and native decode memory/codec acceptance remain open. Filters fail visibly where Canvas filtering is unavailable.

Local TypeScript/build passed, lint has zero errors/13 existing warnings. 399 tests across 70 files passed twice on a fresh isolated MariaDB port, including fresh canonical migrations, with eight LAN CLI cases per run. An earlier fresh-migration repeat reported three unrelated table-not-in-engine errors for send_receipts; clean isolation then passed both full runs without backend/schema changes. An initial separate run also passed both suites. Browser coverage now includes distinct page URLs, two-track advancement, actual FFmpeg WebM seeking/resume, speed/subtitle controls, photo grayscale/flip/undo/drawing pixels and real JPEG download. These newly extended checks require CI success before being marked verified. Physical acceptance of these new controls is not inferred from the prior Android confirmation.
