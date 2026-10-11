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
