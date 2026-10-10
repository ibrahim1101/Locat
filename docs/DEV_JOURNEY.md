# Locat Media Hub — Development Journey (updated)

## Milestones completed

### Milestone A — Foundation ✅
Monorepo of packages, Mongo persistence behind `MediaPersistence`, mock
adapters (Auth / Storage / Device / Host), deterministic UUIDv5 item
IDs, auto-seeding + stale-library cleanup, pytest harness.

### Milestone B — Cinema Direct Play ✅
`CinemaIndexer` (ffprobe), `PlaybackDecider`
(`direct_play / direct_stream / transcode / unsupported`),
`RangeStreamer` (HTTP 206/416, bounded 512 KiB chunks, backpressure,
cancellation on client disconnect), `DiagnosticsRegistry` with live
throughput + stalls + last-range tracking.

### Milestone C — Cinema Advanced ✅ (this iteration)
- **Server-side remux worker** (`FfmpegRemuxWorker`). Spawns
  `ffmpeg -c copy -f mp4 -movflags frag_keyframe+empty_moov+default_base_moof+delay_moov`
  for lossless MKV→MP4 Direct Stream. Falls back to `aac` audio only
  when the source audio codec cannot live in MP4 (DTS/TrueHD).
  Cancellation terminates the ffmpeg process on client disconnect.
  New endpoint: `GET /api/media/items/{id}/remux.mp4`.
- **Universal container/codec support.** Extended indexer extensions
  to MKV/MP4/MOV/AVI/WebM/M4V/TS/M2TS/MPG/MPEG/WMV/FLV/3GP/OGV/VOB/
  DIVX/ASF/RM/F4V/MXF for video and FLAC/WAV/ALAC/M4A/MP3/AAC/OGG/
  Opus/AIFF/WMA/APE/WV/DSF/DFF for audio. Added hardware-accel
  detection via `ffmpeg -hwaccels` + encoder scan, exposed through
  `GET /api/media/capabilities/{matrix,ffmpeg}`.
- **HDR metadata extraction.** `ffprobe` side_data now feeds
  `VideoStreamInfo.color_space / color_transfer / color_primaries /
  mastering_display`; HDR label upgraded to detect `hdr10 / hdr10+ /
  hlg / dovi` from the real color-transfer + side-data table.
- **Series rollups.** `GET /api/media/series` groups episodes by name
  and season. `GET /api/media/items/{id}/next-episode` returns the
  next episode in-series. Frontend `/cinema/series` page renders
  seasons + resume progress + play button; Cinema player auto-navigates
  to the next episode on `onEnded`.
- **Playback info panel.** `GET /api/media/items/{id}/info` returns
  filename, container, HDR block (format + color metadata + mastering
  display string), full audio-track list, subtitle-track list, and
  ffmpeg capability summary. Frontend adds an expandable "Technical
  information" section on the Cinema player.
- **Playback progress & resume.** `onTimeUpdate` posts every 5 s to
  `/items/{id}/progress`; `onLoadedMetadata` seeks to the saved
  position (if not near the end).

### Milestone D — Music Foundation ✅
Mutagen indexer, album/artist aggregation, favorites, playlist CRUD,
built-in EQ seed presets, dual-mode persistence.

### Milestone E — Advanced Audio ✅ (this iteration)
- **Parametric EQ.** `EqPreset.parametric: ParametricFilter[]` with
  peaking / lowshelf / highshelf / lowpass / highpass / notch, each
  with frequency / gain / Q / enabled. Backend accepts and persists;
  frontend EQ page has a "Parametric filters" section with
  add / remove / toggle / type / freq / gain / Q controls per row.
- **Live frequency response graph.** Pure SVG, computed with real
  `BiquadFilterNode.getFrequencyResponse` through an
  `OfflineAudioContext`. Chains graphic + parametric filters, applies
  preamp. 128 log-spaced bins between 20 Hz and 20 kHz.
- **AudioEngine wiring.** Enhanced DSP mode now chains graphic bands +
  parametric filters + preamp + optional limiter. Pure Audio still
  bypasses the entire chain (`MediaElementSource → destination`), and
  the server still reports `bit_perfect=unavailable` from `runtime=web`.

### Milestone F — Integration ✅ (this iteration)
- **Capacitor audio bridge scaffold** at
  `packages/locat-media-capacitor-audio-bridge/` (TypeScript facade +
  Kotlin plugin + README). Honest capability reporting; actual
  bit-perfect verification is listed as the single remaining TODO
  (open AAudio stream in EXCLUSIVE sharing mode and compare rate +
  format against the source track).

### Performance Monitor ✅ (this iteration)
- Real `psutil` CPU / RAM / disk I/O / network throughput.
- `pynvml` NVIDIA GPU + VRAM + encoder/decoder utilization — **honestly
  reports "Unavailable" when no driver is present**, never fabricates
  numbers.
- Live Recharts time-series graphs (configurable 1/2/5 s cadence,
  pause/resume), server-session table with Direct Play / Remux / codec
  labels, FFmpeg version + hwaccels + NVENC/NVDEC availability.
- Client telemetry postback (`POST /telemetry/client`) accepts
  `buffered_seconds` and `dropped_frames` reported by the player.

### Remote Desktop & Remote Play — architecture plans only
`packages/locat-remote-desktop/README.md` and
`packages/locat-remote-play/README.md` contain full milestone plans,
dependency research with license posture, performance targets
(explicitly marked "goals, not claims"), and honest feasibility
assessment. No code — the user asked us to plan first.

## Honest status of each "mandatory" rule from the brief

| Rule | Status |
|---|---|
| Preserve Direct Play; remux only when needed | ✅ decider + player auto-selects Direct Play; remux only when path_type=direct_stream |
| Never confuse remuxing with transcoding | ✅ remux worker is `-c:v copy`; audio is `copy` unless source cannot live in MP4 (DTS/TrueHD); UI badge "stream-copy remux (lossless)" is only shown on the remux path |
| EQ must have an actual DSP backend before claiming functional | ✅ Enhanced DSP builds a real Web Audio biquad chain in-browser; Windows/Android host adapters are documented stubs |
| Pure Audio bypasses all EQ / ReplayGain / normalization | ✅ `rewireChain()` connects `MediaElementSource` straight to `destination` in Pure Audio mode |
| Never report bit-perfect as verified without native evidence | ✅ `/music/audio-mode?runtime=web` returns `unavailable`; `/report-verified` requires admin + is only called by the Capacitor plugin when AAudio exclusive-mode open succeeds |
| Keep modular + integration-ready | ✅ 7 packages, mountable router factory, feature flag `LOCAT_MEDIA_ENABLED`, no changes to Locat Chat / Desktop / Play |
| Not another standalone consumer app | ✅ dev preview at `/app/frontend` is explicitly labeled as such, not shipped as the product |
| Automated tests + docs + clear "implemented vs incomplete" | ✅ 37 pytest cases pass, `docs/INTEGRATION.md`, `docs/DEV_JOURNEY.md`, each adapter README lists TODOs |
| Keep existing Locat repo untouched | ✅ not touched |
| Incremental implementation, playback over decorations | ✅ remux worker + decider accuracy prioritized before adding Performance tab |

## Native work still outstanding (unchanged)

- Windows **WASAPI exclusive-mode** output for verified bit-perfect Pure Audio.
- Windows **NVENC/NVDEC** real hardware transcode (encoder worker scaffold is on the roadmap for Milestone C-2).
- Android **AAudio exclusive-mode** stream opening + verification (listed as TODO in the Capacitor plugin).
- **Server-side transcode worker** for codec-level incompatibilities (currently the decider flags the need; transcoding itself is not yet implemented).
- **Advanced subtitle rendering** (PGS/ASS/SSA).
- **Dolby Vision / HDR tone mapping** server fallback.
