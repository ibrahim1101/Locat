# Locat Media Hub — integration status

Locat's Node/Hono host provides session-authenticated media indexing and direct HTTP byte-range streaming. The Emergent Python prototype is **not** mounted into the shipping server.

## Implemented (CI does not substitute for real-device testing)

- `media.libraries` and `media.items` index only explicitly authorized host roots.
- `GET/HEAD /api/media/stream?library=<index>&id=<base64url>` serves eligible media with HTTP Range support.
- `media.probe` uses FFprobe to inspect codecs and recommend direct playback, stream-copy remuxing or transcoding.
- `mode=remux` launches FFmpeg to stream-copy eligible video/audio into fragmented MP4; it is authenticated and limited to two concurrent sessions.
- Cinema shows codec inspection and playback errors and offers a direct-play retry after remux failure.
- Music retains local-file playback and its browser EQ; advanced native audio remains future work.

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

Install FFmpeg and FFprobe on the host PATH or set `LOCAT_FFMPEG_PATH` and `LOCAT_FFPROBE_PATH` to executable paths. Restart Locat after changing environment variables.

## Known limitations

- Stream-copy remuxing is progressive and does **not** implement seeking or Range requests.
- Stream-copy does not make unsupported codecs playable; compatibility still depends on the browser.
- FFmpeg process errors can occur after HTTP headers have been sent; the browser may report a generic media failure.
- Android native origins and authentication for streaming require separate device verification.
- Automatic transcoding, subtitles, metadata caching, artwork and NVENC are not implemented.
- Browser audio EQ is not verified bit-perfect.
- Current media-root containment uses resolved paths and should receive additional race-condition hardening before untrusted multi-user deployment.

## Validation checklist

1. Run `npm run check`, `npm run lint`, and `npm test` in CI.
2. Configure an authorized folder with a known-good H.264/AAC MP4 and H.264/AAC MKV.
3. Sign in on the host; confirm direct MP4 playback and seeking.
4. Select MKV; confirm FFprobe recommends remux and FFmpeg starts, plays and stops when canceled.
5. Test FFmpeg missing from PATH, a corrupt media file, browser codec rejection, and three simultaneous remux requests.
6. Verify Android and Windows clients separately before claiming cross-device compatibility.

External Plex/Jellyfin/SMB sources remain intentionally out of scope until Locat's own Media Hub is stable.
