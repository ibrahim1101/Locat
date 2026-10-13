# Final historical branch cleanup manifest — 2026-10-13

Verified on GitHub: 30 branches (15 originals, 15 `archive/2026-10-13/*` refs); only PR #8 `release/locat-v1.0` → `main` remains open. All **13 historical non-main/non-release branch tips** have matching archive refs pointing to exactly the same SHA.

## Historical original branches eligible for ref cleanup after reviewing feature parity

```text
chore/locat-2.0-quality
chore/locat-2.0-stabilization-handoff
feat/locat-1.0
feat/locat-2.0
feat/locat-cinema-complete
feat/locat-complete-ecosystem
feat/locat-media-hub
feat/locat-music-equalizer
feat/locat-remote-prototype
feat/locat-unified-platforms
fix/locat-2.0-app-lock-biometric-guard
fix/locat-install-mobile-foundation
fix/locat-link-security-review
```

Every listed original branch's exact tip is retained under `archive/2026-10-13/<original name>`. This preserves reachable Git history but **does not establish complete feature parity** for the isolated Media Hub and Cinema prototype branches. Prefer keeping those two originals until their behavior has been tested against release, even though archives exist.

## Suggested immediate safe subset

Delete the following **11** original refs, retaining both `feat/locat-media-hub` and `feat/locat-cinema-complete` pending parity validation:

```bash
git push origin --delete \
  chore/locat-2.0-quality \
  chore/locat-2.0-stabilization-handoff \
  feat/locat-1.0 \
  feat/locat-2.0 \
  feat/locat-complete-ecosystem \
  feat/locat-music-equalizer \
  feat/locat-remote-prototype \
  feat/locat-unified-platforms \
  fix/locat-2.0-app-lock-biometric-guard \
  fix/locat-install-mobile-foundation \
  fix/locat-link-security-review
```

For Windows PowerShell, use the one-line equivalent:

```powershell
git push origin --delete chore/locat-2.0-quality chore/locat-2.0-stabilization-handoff feat/locat-1.0 feat/locat-2.0 feat/locat-complete-ecosystem feat/locat-music-equalizer feat/locat-remote-prototype feat/locat-unified-platforms fix/locat-2.0-app-lock-biometric-guard fix/locat-install-mobile-foundation fix/locat-link-security-review
```

**Do not delete** `main`, `release/locat-v1.0`, any `archive/2026-10-13/*` refs, or the two experimental original refs pending parity review. Re-check the remote branch list immediately before execution; the matching SHA guarantee is a point-in-time check. Deleting a branch does not merge its code.

This manifest is an instruction for user-side Git CLI cleanup. No branches were deleted by the GitHub connector.
