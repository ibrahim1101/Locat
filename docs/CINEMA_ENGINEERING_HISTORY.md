# Locat Cinema engineering history

## 2026-10-11 — Initial isolated integration audit

Branch: `feat/locat-cinema-complete`, created from `fix/locat-2.0-app-lock-biometric-guard`. No merge or deployment.

### Inspected
- `src/components/media/CinemaHlsPlayer.tsx`: HLS.js player, buffered-ahead status, 4K startup threshold, manifest retry, decoder recovery, session release on unmount.
- `api/mediaHls.ts`: authenticated user context, realpath containment checks, FFmpeg subprocess, session cap, timed cleanup, generated HLS manifests, 1080p/4k variants.
- `docs/FEATURE_MATRIX.md`, `docs/PLATFORM_ROADMAP.md`, `docs/LOCAT_2_0_JOURNEY_AND_HANDOFF.md`.

### Findings requiring implementation and verification
1. FFmpeg encodes 4K using libx264 unless explicit NVENC is configured. This may exceed the capacity of CPU-only servers; no measured encoding speed has been supplied.
2. 4K startup waits for 12 seconds buffered or a 20-second timeout, potentially delaying playback.
3. Player recreation on URL/start changes needs robust seek, pause, volume, duration and subtitle preservation.
4. `recoverMediaError()` has no explicit maximum retry counter in inspected code.
5. HLS output uses an event playlist with 4-second segments, fixed 120-frame GOP, and no master adaptive playlist; GOP duration depends on actual input/output frame rate.
6. The stream handler limits sessions to two and may evict the oldest session when full; eviction behavior and concurrent access need testing.
7. Existing Android preview HTTPS setup is documented but real Android login/playback has not been verified in the reviewed handoff.

### Verification status
GitHub source inspection completed. No local FFmpeg benchmark, TypeScript build, automated test, GitHub Actions build, signed APK, physical Android test or Raspberry Pi test has yet been performed in this branch. Do not label 4K fixed or APK ready.

### Next implementation priorities
- Repair HLS lifecycle/state preservation and bounded recovery, with tests.
- Benchmark FFmpeg encoding speed and fix segment/GOP alignment.
- Validate authorization and concurrency lifecycle.
- Audit Docker and Android workflow before preparing preview APK.
