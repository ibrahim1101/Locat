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
