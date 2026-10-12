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
