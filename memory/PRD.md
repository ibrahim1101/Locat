# PRD — Locat Media Hub

## Original problem statement

Build **Locat Media Hub**, a reusable, integration-ready module for the
existing Locat 2.0 application. Deliverable is a set of packages
(`locat-media-core`, `locat-cinema`, `locat-music`, `locat-media-ui`,
`locat-media-server`, `locat-media-adapters`) that drop into the Locat
GitHub repository — NOT a standalone consumer app.

Must support real 4K Direct Play with HTTP range streaming, large
MKV/MP4 Blu-ray remuxes, device-codec compatibility checks; and the
mandatory dual audio playback modes: Pure Audio (bit-perfect, bypasses
all DSP) + Enhanced DSP (10/15/31-band graphic EQ, parametric EQ,
preamp, ReplayGain, limiter, presets).

## User personas

1. **Locat power user** — streams their own 4K movie collection and
   lossless music library across the LAN to any paired device. Will
   never install Plex / Jellyfin / Poweramp.
2. **Locat developer** — pulls this module into the Locat repo and
   wires their Auth / Storage / Device / Host adapters.

## Architecture (as implemented)

- Monorepo under `packages/` with 6 packages.
- FastAPI router factory, mountable via `create_media_router(...)`,
  prefixed `/api/media`.
- Pluggable `MediaPersistence` protocol; default Mongo implementation.
- ffprobe-based cinema indexer, mutagen-based music indexer.
- `RangeStreamer` with HTTP 206 + 416 semantics, backpressure-aware
  async file reads, no full-file RAM.
- `PlaybackDecider` returning `direct_play / direct_stream / transcode
  / unsupported` from the client capability profile.
- `AudioModeService` with honest bit-perfect reporting
  (`verified / unverified / unavailable`).
- Dev preview under `/app/frontend` using a Web Audio biquad chain for
  Enhanced DSP and raw `<audio>` for Pure Audio.

## Core requirements (static)

- Must stay a module — no parallel user system, no replacement for
  Locat auth/messaging/storage.
- 4K Direct Play priority: never transcode when the client can play
  the original streams.
- Pure Audio must bypass every DSP stage and must NEVER falsely report
  verified bit-perfect from the browser.
- LAN-first, no mandatory cloud dependency.
- Mongo must be behind a replaceable persistence interface.
- `LOCAT_MEDIA_ENABLED` feature flag gates the entire module.

## What's been implemented (dates)

### 2026-02 — Milestones A + B + partial D/E/F

- Package skeleton + Python module wiring into FastAPI host.
- `MediaPersistence` protocol + Mongo implementation + prefs store.
- Mock Auth/Storage/Device/Host adapters (clearly marked DEV-ONLY).
- Cinema indexer (ffprobe), music indexer (mutagen), real metadata.
- HTTP 206 range streaming with session tracking + diagnostics
  (bytes/sec throughput, stalls, buffered seconds).
- Direct Play / Direct Stream / Transcode decider.
- `/items/{id}/playback-decision` + `/stream` + `/diagnostics` +
  `/progress`.
- Music tracks + albums + artists + favorites endpoints.
- Dual audio mode service with honest `bit_perfect` reporting (web
  runtime always `unavailable`; verification only from trusted
  native adapters via `/report-verified`).
- 8 built-in EQ presets seeded; preset CRUD.
- React dev preview: Hub home, Cinema library/player (with real
  diagnostics panel), Music library (albums + tracks + favorites),
  Equalizer + Audio Mode page (biquad chain, Pure Audio bypass),
  Integration guide. Dark cinematic palette; Outfit + JetBrains Mono.
- 23 pytest cases, all passing (health, library CRUD, Direct Play
  decider, 206/416, music metadata, audio-mode honesty, EQ CRUD).
- Documentation: `docs/INTEGRATION.md`, `docs/DEV_JOURNEY.md`.

## Prioritized backlog

### P0 (next session)

- **Server-side remux (Direct Stream)** via `ffmpeg -c copy` for cases
  where only the container is unsupported.
- **Deterministic Mongo index** on `media_items.library_id + path` to
  dedupe at the DB level (currently handled by deterministic UUIDv5).
- **Streaming throughput backoff**: when `estimated_network_bps` drops
  below source bitrate, flag the warning for the client.

### P1

- **Milestone C** — Series/season rollups, subtitle extraction & delivery
  (SRT/VTT first, PGS/ASS deferred to native host), HDR capability
  advertising, optional ffmpeg transcode worker.
- **Milestone D (rest)** — Smart playlists, gapless FLAC playback
  verification, listening history endpoint.
- **Milestone E (rest)** — Parametric EQ UI, per-output-device presets,
  frequency-response graph.
- **Milestone F** — Port the JSX dev preview components into
  `locat-media-ui/src/components/*.tsx`, add a Capacitor plugin skeleton
  for Android MediaSession bridging.

### P2

- Native WASAPI exclusive adapter stubs + sample Windows plugin.
- NVENC transcoding profile for 4K Blu-ray remuxes.
- Dolby Vision / HDR10 metadata preservation.
- Subtitle styling + delay adjustment UI.
