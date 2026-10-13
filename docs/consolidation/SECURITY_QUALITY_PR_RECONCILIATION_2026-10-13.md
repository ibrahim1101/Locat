# Security and quality PR reconciliation — 2026-10-13

Compared `chore/locat-2.0-quality` (PR #2) and `fix/locat-link-security-review` (PR #3) to current `release/locat-v1.0`.

## Quality branch

Four commits ahead of release, but three changed paths in comparison:
- `docs/LOCAT_2_QUALITY_JOURNAL.md`: identical blob in release.
- `src/lib/cryptoIsolation.test.ts`: identical blob in release.
- `.github/workflows/ci.yml`: release has a different, longer workflow (115 lines versus 87). Do not replace it with the historical workflow.

## Link security branch

Eight commits ahead of release, six changed paths:
- `api/sentinel/readBody.ts` and `api/sentinel/readBody.test.ts`: identical blobs in release.
- `api/sentinel/webhook.ts`: different; release retains body reader and adds a `sentinel-alert` event type absent from old branch.
- `src/pages/Link.tsx`: different; release retains device ID, pairing and verification references, and includes challenge/proof references absent from old branch. This is a code-surface check, not a complete security audit.
- `compose.yaml`: different; inspect newer database image/version policy before any replacement.
- `.github/workflows/ci.yml`: different; release workflow is longer (115 lines versus 98).

## Cleanup recommendation

The distinct old commit histories are preserved by `archive/2026-10-13/chore/locat-2.0-quality` and `archive/2026-10-13/fix/locat-link-security-review`. The essential standalone test files are already in release. Treat both PRs as candidates for **closure as superseded**, not merging, while retaining archives. Do not delete `feat/locat-2.0` before closing or retargeting these PRs because it is their base.

This audit does not establish functional equivalence for all changed code, and does not certify authentication or webhook security. No branches are deleted or merged by this report.
