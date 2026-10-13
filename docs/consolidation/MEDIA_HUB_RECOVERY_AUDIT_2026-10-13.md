# Independent Media Hub recovery audit — 2026-10-13

Source branch: `feat/locat-media-hub` at `62cd389294d91fe796862d9b2ee9174989cf281b`.
Target: `release/locat-v1.0` at `76d9d5980ab8d4b6a844f3465270963267a7343c`.
The two branches have unrelated ancestry. Original and archive references remain in place.

## Tree comparison

Selected source directories: `packages/`, `frontend/src/locat-media-hub/`, `tests/`.

- 52 source-tree blobs selected
- 27 blobs identical at the same path in release
- 25 blobs absent at their original path in release
- 0 blobs different at a shared selected path

### Missing-path categories

- 14 React Media Hub files under `frontend/src/locat-media-hub/`: AppShell, AudioEngine, CinemaLibrary, CinemaPlayer, EqualizerPage, HubHome, IntegrationGuide, MusicLibrary, MusicPlayerBar, PerformancePage, SeriesLibrary, api, chips and freqResponse.
- 4 Android/TypeScript Capacitor audio-bridge files under `packages/locat-media-capacitor-audio-bridge/`.
- 4 UI package files under `packages/locat-media-ui/`.
- 3 Python test files under `tests/`.

These are **missing at matching paths**, not necessarily missing capabilities: the target app may use a different UI structure. Do not copy the entire independent frontend or overwrite the unified app.

## Integration strategy

1. Compare React Media Hub features with existing Locat Cinema/Music UI and media services.
2. Evaluate Android audio bridge compatibility with current Capacitor versions, lifecycle and audio routing.
3. Compare independent Python tests with current package tests; selectively port missing assertions.
4. Keep standalone Media Hub backend and frontend dependency trees isolated; avoid importing a second app architecture.
5. Run TypeScript, Python, Android build and media playback checks before asserting parity.
6. Preserve `archive/2026-10-13/feat/locat-media-hub` and original branch until signed off.

No feature code was merged in this audit.
