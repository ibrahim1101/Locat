# Installation foundation and Remote PR reconciliation — 2026-10-13

## PR #1: install mobile foundation

Compared `fix/locat-install-mobile-foundation` to `release/locat-v1.0`: **0 commits ahead**, 813 behind at inspection. No unique files in the branch comparison. Original history is preserved in `archive/2026-10-13/fix/locat-install-mobile-foundation`.

## PR #5: isolated Remote prototype

Compared `feat/locat-remote-prototype` to release: **4 commits ahead**, 819 behind; 17 paths in historical comparison. Every inspected Remote file exists in the release branch. Verified identical blob hashes for:

- `remote/session.py`
- `remote/windows_capture.py`
- `remote/windows_input.py`
- `remote/ENGINEERING_HISTORY.md`
- `remote/style.css`
- `remote/tests/browser.cjs`
- `remote/tests/test_capture.py`
- `remote/tests/test_session.py`
- `remote/tests/test_windows_input.py`
- `remote/.gitignore`
- `.github/workflows/locat-remote-prototype.yml`

Different blob hashes on release, requiring care before replacing anything:

- `remote/README.md`
- `remote/server.py`
- `remote/app.js`
- `remote/index.html`
- `remote/tests/test_http.py`

The old prototype was intentionally isolated and experimental. The release branch contains newer revisions; do not overwrite them with old versions. This is a path/blob audit, not an end-to-end Remote security or functionality certification.

## Disposition

Both PRs are superseded by the release branch. Preserve `archive/2026-10-13/feat/locat-remote-prototype` to retain its unique four-commit history and PR discussion. Closing PRs is not merging; no branch deletion or source replacement is required. `release/locat-v1.0` -> `main` remains the active PR #8.
