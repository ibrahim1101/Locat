# Ecosystem preview historical evidence — 2026-10-13

This record preserves documentation-only evidence unique to the historical `feat/locat-complete-ecosystem` branch. It is **not** a current release certification or a claim that physical-device testing passed.

## Historical application revision

Commit `f7dd4806b6c1fc71a0af10fc59a493447f859aef` was the recorded packaged ecosystem preview. Its documentation reported:

- Core CI runs [38250585758](https://github.com/ibrahim1101/Locat/actions/runs/38250585758) and [38250592253](https://github.com/ibrahim1101/Locat/actions/runs/38250592253): 404 tests across 71 files, migrations/bootstrap, Docker and Chromium device-library/media checks.
- Signed Android run [38250585769](https://github.com/ibrahim1101/Locat/actions/runs/38250585769), artifact ID `11747098707`, including 14 JVM byte-range parser tests (covering offsets beyond 4 GB). Parser tests are **not** proof of >4 GB physical-device playback.
- Desktop packaging run [38250585704](https://github.com/ibrahim1101/Locat/actions/runs/38250585704): Windows artifact `11747104199`, Linux `11746819332`, macOS `11747769414`. Historical artifact IDs may have expired.
- Android library permission states, folder grouping, album/artist metadata, sorting, pagination and selected-photo behavior were exercised in Chromium bridge-contract fixtures; actual Android MediaStore/permissions/content-streaming still required physical acceptance.

## Unique documentation notes retained

- `docs/DEVICE_MEDIA_LIBRARY.md`: native Java range parser's 14 test cases included >4 GB offsets, suffixes, overflow and invalid/multiple ranges; not actual large-file playback evidence.
- `docs/ECOSYSTEM_PREVIEW_DOWNLOADS.md`: exact old revision, CI runs, and preview artifact IDs.
- `docs/LOCAT_COMPLETE_FEATURE_MATRIX.md`: earlier feature matrix descriptions for Cinema, Music and Photos; not a replacement for the newer release matrix.
- `docs/LOCAT_RELEASE_READINESS.md`: historical automated pass and still-open physical playback, codec and native lifecycle gates.
- `docs/LOCAT_UNIFIED_ENGINEERING_HISTORY.md`: intermediate run `38249809758`, Android run `38249809735`, revision `d1cfced0689f87384f6dd524dbd42f0ffb1b05fb`, and the final `f7dd480` packaged preview.

## Reconciliation conclusion

The PR #7 branch is one commit ahead of release, with only these five documentation files changed. Its distinctive historical evidence is now recorded here without overwriting more recent guidance. Preserve `archive/2026-10-13/feat/locat-complete-ecosystem` and the closed PR discussion as additional recovery sources. This does not certify release readiness or authorize deletion of archival refs.
