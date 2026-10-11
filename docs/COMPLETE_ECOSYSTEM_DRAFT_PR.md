# Draft PR: expand encrypted messaging, private stores and ecosystem previews

The unified preview left historical requirements unaudited and several module
routes without working behavior. This development increment restores a
source-backed 49-item acceptance register and adds encrypted location sharing,
persistent encrypted drafts, scoped local search, real Dashboard/Hub readings,
bounded client-encrypted Vault/Secrets previews, Link private-key proof
enforcement and practical local music EQ/queue controls.

The official logo is retained. Obsidian Ember becomes the default appearance;
explicit valid existing accent choices remain supported. New registrations
again require 15 characters under the current assignment; existing account
login and identity-key wrapping are not changed.

Private-store migration/bootstrap is additive and ownership-scoped. Writes
use revision checks, account-row locks and quota enforcement. Backup recovery
is limited to the same account/server/module and original passphrase. Link
proofs are session/device bound, expire and fail closed after process restart;
legacy pairings need confirmation again. These constraints are described in
the engineering history and private-store documentation.

Docker source includes FFmpeg/FFprobe and an optional read-only media mount.
The dedicated branch is included in core and native-preview workflow filters.
A Chromium signal test measures real Web Audio filter output in CI.

## Validation

Final current-source automated results are recorded in
`docs/LOCAT_UNIFIED_ENGINEERING_HISTORY.md`: 334 tests across 55 files,
including 28 real MariaDB integrations, passed. Fresh canonical migrations
and the suite against the migrated database passed. TypeScript and the
web/offline/backend build passed; lint has zero errors and 12 existing
warnings. Remote tests passed 47/47.
Local native packaging cannot run because Cargo/Java/Android SDK and Docker
are absent; Chromium download returned truncated archives. No new native
artifact, real-audio browser result or physical acceptance is claimed.

## Scope still open

This PR is a development increment, not completion of the complete ecosystem.
Calling, MFA/passkeys, scheduling/expiry/view limits, account closure,
remaining planned modules, native security integration and physical runtime
acceptance remain open in `LOCAT_COMPLETE_FEATURE_MATRIX.md` and
`LOCAT_RELEASE_READINESS.md`. M12/M13 identities remain unresolved.

Keep this PR in draft. No main merge, production deployment, live database
migration, original app replacement or new production signing identity is
included. The branch and PR are not yet published: automatic approval review
rejected publication and requires direct user authorization.
