# Consolidation semantic review — 2026-10-13

Target: `release/locat-v1.0`. This report records read-only comparisons; it does **not** authorize branch deletion or certify functional equivalence.

## Findings

- **Sentinel webhook:** the old security branch calls `notifyUsers([record.userId])`; current release calls `notifyUsers([record.userId], "sentinel-alert")` and documents that sensitive incident details must not enter the notification. Keep the current version.
- **Docker:** old security branch uses `image: ${LOCAT_DB_IMAGE:-mariadb:11.4}`; current release pins `mariadb:11.4`. Preserve current configuration unless there is an independently demonstrated need for image override.
- **CI:** current release has additional migration, app-lock, browser signal, Music DSP, login entry, image-edit, LAN overlay, and media-tool checks. Do not overwrite its workflow with either historical branch. Review branch filters when old branches are retired.
- **Remote server:** current release adds `client_origins`, explicit allowed Origin checks, CORS headers and OPTIONS handling. Keep current implementation pending authentication/consent/remote-input security tests.
- **Link UI:** current `src/pages/Link.tsx` is substantially longer than the old security branch version (28,884 vs. 22,716 characters). The old version has pair/verify/revoke and encrypted message/file operations; simple line differences are largely formatting and refactoring. **Not yet proof of semantic parity**. Verify pairing SAS, identity pinning, revocation, device selection, message encryption and chunk encryption in runtime tests before closing PR #3.

## Code review disposition

| Historical branch | Disposition |
| --- | --- |
| `fix/locat-link-security-review` | Keep archived and open PR until Link parity/security tests and CI reconciliation complete |
| `chore/locat-2.0-quality` | Current crypto test and journal blobs match; current CI is broader; preserve archive and review PR #2 before closure |
| `feat/locat-remote-prototype` | Remote session blob matches; current server adds origin handling; run authorization/consent/input tests before claiming integration |

## Next actions

1. Add or run regression tests for Link pairing, key authentication, revocation and encrypted transfers.
2. Compare Remote tests and run Python + browser checks.
3. Review the unrelated `feat/locat-media-hub` tree separately.
4. Validate CI before changing PR relationships.
5. Keep all original and archive branches until approval for cleanup.
