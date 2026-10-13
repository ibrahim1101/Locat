# Open PR dependency resolution — 2026-10-13

Branch list rechecked: 30 refs (15 originals + 15 archives); 8 open PRs. No original branches have been deleted.

## Dependencies

- PR #2 quality: head `chore/locat-2.0-quality`, base `feat/locat-2.0`; 4 commits and 3 changed files in its own comparison.
- PR #3 Link security: head `fix/locat-link-security-review`, base `feat/locat-2.0`; 8 commits and 6 changed files.
- PR #4 Music EQ: head `feat/locat-music-equalizer`, base `fix/locat-2.0-app-lock-biometric-guard`; 3 commits and 2 changed files.
- PR #6 unified platforms: head `feat/locat-unified-platforms`, base `fix/locat-2.0-app-lock-biometric-guard`; 33 commits and 117 changed files.
- PR #7 ecosystem: head `feat/locat-complete-ecosystem`, base `feat/locat-unified-platforms`; 43 commits and 154 changed files.
- PR #1 install foundation: head `fix/locat-install-mobile-foundation`, base `main`; non-draft.
- PR #5 Remote: head `feat/locat-remote-prototype`, base `main`.
- PR #8 release: head `release/locat-v1.0`, base `main`.

## Safe handling

1. Delete `chore/locat-2.0-stabilization-handoff` and `feat/locat-1.0` first if desired: both have zero unique commits and no open PR references.
2. Do not delete `feat/locat-2.0`, `fix/locat-2.0-app-lock-biometric-guard`, or `feat/locat-unified-platforms` while PRs use them as bases.
3. PR #2 and #3 carry divergent branch histories; changing their base to the release branch would change the displayed diff. Do not retarget blindly.
4. PR #4 and #6 heads have zero commits ahead of release, but the historical PR discussions are valuable. Close as superseded only after confirming their features and documenting the outcome.
5. PR #7's head contains unique documentation history; retain until those files are reconciled.
6. PR #1 is non-draft: require explicit closure decision.
7. Keep PR #5 Remote and PR #8 release open. Keep original and archived branches until checks pass.

**No PR was retargeted or closed, no branch deleted, no code merged.**
