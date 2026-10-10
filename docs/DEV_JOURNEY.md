# Locat Media Hub — Development Journey

## Milestone A — Foundation ✅

Decisions and outcomes:

- **Monorepo of Python packages** rather than one FastAPI module. Each
  concern (core types, adapters, cinema, music, media server) can be
  tested and swapped independently. The parent Locat application only
  mounts `locat_media_server.create_media_router(...)`.
- **MongoDB persistence hidden behind a protocol** (`MediaPersistence`)
  so SQLite / Postgres can replace it without touching Cinema or Music.
- **Mock adapters are explicit** (`MockLocatAuthAdapter`, etc.) and
  marked DEV-ONLY. Real Locat wiring must replace them.
- **Automatic sample-library seeding** in dev mode so the preview isn't
  empty on first run. Guarded by `LOCAT_MEDIA_AUTHORIZED_ROOTS`.
- **Deterministic item IDs** (`uuid.uuid5(NAMESPACE_URL, library_id+path)`)
  so re-scanning the same files is idempotent.

Failures & fixes:

| Issue | Fix |
|---|---|
| Create-library endpoint auto-added arbitrary roots to the authorized set | Removed `storage.add_root(...)` from the API; roots must be pre-authorized via env |
| `EqPreset()` default construction failed (missing `name`) when generating IDs | Use `uuid.uuid4().hex` for new preset IDs instead |
| ffprobe reported container as `mov,mp4,m4a,3gp,...` → Direct Play mismatched | Prefer the file extension when it appears in the ffprobe comma list |
| Filename parser left trailing `(` on titles like "Sample Movie (" | Expanded strip chars to include parens |
| Default playback-decision empty-body request transcoded everything | Fallback to the web-safe default when the body contains no video codecs |

## Milestone B — Cinema Direct Play ✅

- **HTTP 206 Partial Content** with correct `Content-Range`,
  `Accept-Ranges`, `Content-Length` headers.
- **Suffix ranges** (`bytes=-500`) and **invalid ranges** (`416`) handled.
- **Backpressure-aware streaming**: `os.read` in an executor with 512 KiB
  chunks, cancellation when the client disconnects. No full-file RAM
  buffering, so 100 GB Blu-ray remuxes are safe.
- **Playback decision engine** classifies each item into
  `direct_play / direct_stream / transcode / unsupported` based on the
  client's declared container/codec/HDR capability.
- **Diagnostics registry** records bytes served, stall count, last range,
  and a 5-second rolling throughput estimate per session. The client
  polls `/items/{id}/diagnostics?session_id=...` to render a Plex-style
  diagnostics panel.
- **HEAD requests** return `Content-Length` + `Accept-Ranges` so the
  browser video element and native players can plan buffering.

Known limitations (deferred to later milestones):

- Server-side **remux and transcode** are not yet implemented. The
  decider reports when they are needed; actually re-containerizing with
  ffmpeg is Milestone C.
- Server-side **subtitle rendering** for PGS/ASS is not implemented.
- **HDR tone mapping** reports capability only; no software or hardware
  tone mapper yet.
- **NVENC hardware transcoding** requires the Locat Windows host adapter.

## Milestone D (partial) — Music Foundation

- **Mutagen-based indexer** parses FLAC, MP3, M4A/AAC, Ogg Vorbis, and
  Opus. Tags, cover art presence, ReplayGain fields, duration, sample
  rate, bit depth are all extracted.
- **Album & artist aggregation** done at the persistence layer via a
  Mongo aggregation pipeline (easily swappable).
- **Playlists & favorites** have persistence contracts and CRUD
  endpoints.
- **Background Android playback** needs the Locat Capacitor plugin
  (adapter signature exists, implementation deferred).

## Milestone E (partial) — Dual Audio Mode

**This is the critical honest-reporting feature.**

- The backend `AudioModeService` separates Pure Audio and Enhanced DSP
  state (per-device-persisted).
- The web dev preview reports `bit_perfect=unavailable` with a clear
  reason: Web Audio routes through the browser mixer and can resample.
  **The server never falsely reports verified bit-perfect.**
- `POST /music/audio-mode/report-verified` is only accepted from
  `is_admin=True` adapters — i.e. the native Windows / Android host.
- The dev preview's Pure Audio mode disconnects the Web Audio biquad
  chain and routes `MediaElementSource → destination` straight through.
  Enhanced DSP builds the full biquad chain + preamp (+ optional
  `DynamicsCompressorNode` limiter).
- 8 built-in EQ presets are seeded on first run (Flat, Bass Boost, Rock,
  …). User presets are CRUD-able.

## Milestone F (partial) — Integration

- `locat-media-ui/src/types/index.ts` is the TypeScript contract that
  Locat 2.0 consumes.
- `locat-media-ui/src/components/index.d.ts` declares the React
  component signatures (`MediaHub`, `CinemaLibrary`, `CinemaPlayer`,
  `MusicLibrary`, `MusicPlayer`, `EqualizerPanel`, `AudioModeSwitch`).
- JSX implementations live in `/app/frontend/src/locat-media-hub` for
  the dev preview and must be ported to `.tsx` under
  `packages/locat-media-ui/src/components/` when integrating into Locat.
- `docs/INTEGRATION.md` is the end-to-end integration guide.

## Native work still required

- **Windows WASAPI exclusive-mode output** for verified bit-perfect
  Pure Audio.
- **NVENC / NVDEC transcoding** path for 4K remuxing on RTX-class GPUs.
- **Android MediaCodec + AAudio adapter** for HEVC/HDR Direct Play and
  background playback.
- **Advanced subtitle rendering** (PGS/ASS/SSA) beyond browser native.
- **Server-side ffmpeg remux pipeline** for Direct Stream path.
- **Dolby Vision / HDR10 tone mapping** server fallback.
