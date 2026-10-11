# Locat Media Hub — integration status

Locat's Node/Hono host provides session-authenticated media indexing and direct HTTP byte-range streaming. The Emergent Python prototype is **not** mounted into the shipping server.

Updated 2026-10-11 for complete-ecosystem development. Historical unified packaging is application `af63b2c` / docs `b849774`; current source changes need their own verification.

## Implemented (CI does not substitute for real-device testing)

- `media.libraries` and `media.items` index only explicitly authorized host roots.
- `GET/HEAD /api/media/stream?library=<index>&id=<base64url>` serves eligible media with HTTP Range support.
- `media.probe` uses FFprobe to inspect codecs and recommend direct playback, stream-copy remuxing or transcoding.
- `mode=remux` launches FFmpeg to stream-copy eligible video/audio into fragmented MP4; it is authenticated and limited to two concurrent sessions.
- Cinema shows codec inspection and playback errors and offers a direct-play retry after remux failure.
- `GET /api/media/hls` implements experimental authenticated FFmpeg event-playlist transcoding with selectable 1080p/4K output, authorized realpath roots, session/idle/runtime cleanup and item-scoped playback authentication. The player attempts position/duration state preservation during quality changes; this is not measured seamless switching or 4K performance acceptance.
- Encoding defaults to software libx264; optional `LOCAT_TRANSCODE_ENCODER=h264_nvenc` selects NVIDIA encoding when the host driver/hardware supports it. No actual GPU availability or realtime speed is inferred from setting an environment variable.
- Music routes local and server-hosted playback through the shared Web Audio EQ. Current development adds 5/10/15/31 graphic bands, bounded parametric filters, headroom/preamp, custom presets and local queue/shuffle/repeat/favorites. Native focus/background/headset controls, gapless and verified bit-perfect remain future work; hosted queue/album/artist metadata is incomplete.

## Host configuration

Windows PowerShell:

```powershell
$env:LOCAT_MEDIA_AUTHORIZED_ROOTS = 'D:\Movies;D:\Music'
ffmpeg -version
ffprobe -version
```

Linux:

```bash
export LOCAT_MEDIA_AUTHORIZED_ROOTS='/srv/movies:/srv/music'
ffmpeg -version
ffprobe -version
```

Current development Dockerfile installs FFmpeg/FFprobe in the runtime image and `compose.media.yaml` provides an optional read-only media mount. The updated image is not locally executed because Docker is unavailable; verify it in CI or an isolated host. Run the optional overlay with a chosen fixture directory, never an unapproved personal-data mount.

Install FFmpeg and FFprobe on the host PATH or set `LOCAT_FFMPEG_PATH` and `LOCAT_FFPROBE_PATH` to executable paths. Restart Locat after changing environment variables.

## Known limitations

- Stream-copy remuxing is progressive and does **not** implement seeking or Range requests.
- Stream-copy does not make unsupported codecs playable; compatibility still depends on the browser.
- FFmpeg process errors can occur after HTTP headers have been sent; the browser may report a generic media failure.
- Android native origins and authentication for streaming require separate device verification.
- Experimental codec-recommended HLS transcoding and optional NVENC selection **are implemented**. They are not a complete adaptive streaming platform: only 1080p/4K variants are exposed, no adaptive master ladder is produced, and subtitles/audio-track selection, metadata caching, artwork and series/history features are not integrated.
- HLS currently uses event playlists, fixed 120-frame GOP with four-second segment target, near-realtime input throttling and two-session capacity. It may evict the oldest session during a quality change/capacity pressure. Input frame rate, encoding speed, pause behavior, session contention and disk usage need actual benchmarks. Software 4K may be slower than realtime; there is no verified automatic fallback after hardware encoder failure.
- Browser audio EQ is not verified bit-perfect.
- Current media-root containment uses resolved paths and should receive additional race-condition hardening before untrusted multi-user deployment.

## Validation checklist

1. Run `npm run check`, `npm run lint`, and `npm test` in CI.
2. Configure an authorized folder with a known-good H.264/AAC MP4 and H.264/AAC MKV.
3. Sign in on the host; confirm direct MP4 playback and seeking.
4. Select MKV; confirm FFprobe recommends remux and FFmpeg starts, plays and stops when canceled.
5. Test FFmpeg missing from PATH, a corrupt media file, browser codec rejection, and three simultaneous remux requests.
6. For HLS, measure FFmpeg fps/speed, buffer/stalls and client render FPS. Switch 4K/1080p while paused/playing; assert preserved position, valid duration and bounded switch delay. Exercise capacity/eviction/cancel/idle cleanup and missing/failed hardware encoder.
7. Verify Android, Windows, Linux and macOS clients separately before claiming cross-device compatibility; use `docs/LOCAT_CROSS_PLATFORM_TESTING.md`.
8. Verify native playback tickets after logout/revocation/disable/expiry and wrong-item access. Redact capability query parameters in reverse-proxy logs.

External Plex/Jellyfin/SMB sources remain intentionally out of scope until Locat's own Media Hub is stable.

Current-session publication/native-build limits are recorded in `docs/LOCAT_RELEASE_READINESS.md`. Original prototype engines under `packages/` remain reusable code, not authenticated runtime feature parity.
