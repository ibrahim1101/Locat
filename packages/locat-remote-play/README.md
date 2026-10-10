# Locat Remote Play — Architecture plan (NOT YET IMPLEMENTED)

> Status: **planning only**. No code lives in this package yet. Scope
> is PC-game streaming from the Locat Windows host to an authorized
> Locat Android client (or web client as a secondary target).

## Scope

Low-latency streaming of a Windows game session with hardware video
encoding, synchronized audio, controller input, and performance
telemetry — reusing Locat 2.0's auth, device pairing, Windows host,
and the shared Performance monitoring tab.

## Core user flows

1. User launches a game on the Locat Windows host.
2. Locat Android client pairs with the host and starts a "Play"
   session.
3. Low-latency encoded video + audio stream to the Android client;
   controller input is sent back.
4. User can tune bitrate, resolution, and codec; stream recovers
   gracefully from Wi-Fi fluctuations.
5. Session statistics feed the Locat Performance tab.

## Suggested package layout

```
packages/locat-remote-play/
├── core/                        # TypeScript types + session protocol
├── server/                      # FastAPI router mounted into Locat host
├── windows-capture-game/        # Per-process window capture (DXGI/WGC)
│   └── nvenc-encoder/           # NVENC encode worker, b-frames=0
├── transport-webrtc/            # WebRTC data+media channels
├── android-player/              # Capacitor plugin wrapping MediaCodec
├── adapter-locat/               # Reuses Locat auth/device/host adapters
└── ui/                          # Session picker + overlay telemetry
```

## Technical dependencies (research, not decisions)

| Area | Candidate | Notes |
|---|---|---|
| Capture | **Windows.Graphics.Capture** (WinRT) for per-game window + **DXGI Desktop Duplication** fallback | WGC avoids desktop capture overhead and respects HDR properly. |
| Encode  | **NVENC** H.264 + HEVC; low-latency preset (`-tune ll` / NVENC `-preset p1 -tune ull -zerolatency 1`); 0 B-frames | NVENC on RTX 5080 class delivers 4K60 with <2 ms encode latency. |
| Transport | **WebRTC** (SRTP + congestion-aware feedback) | Mature on Android MediaCodec; latency compares well to custom QUIC for the first implementation. |
| Audio   | WASAPI loopback → Opus @ 48 kHz / 128 kbps | Keeps audio latency < 30 ms. |
| Input   | **XInput** / Raw Input on Windows for controller injection | ViGEmBus for virtual gamepads if Steam Input requires it. |
| Decode  | **Android MediaCodec** hardware HEVC/H.264 (`low-latency` key when API >= 30) | Browser fallback uses WebRTC's hardware decoder path. |

### Open-source references to study

- **Sunshine** (GPLv3) — complete capture + NVENC + WebRTC stack. Study
  the pipeline; cannot be linked directly due to license.
- **Moonlight** (Android client, GPLv3) — reference for the Android
  decode + input path.
- **Parsec** / **Steam Remote Play** — proprietary; architecture-only
  reference.
- **Nvidia Video Codec SDK samples** (MIT-ish) — direct reuse feasible
  for the NVENC worker.

**License posture:** no GPL code ships inside Locat. Clean-room
implementations only.

## Performance targets (initial, to validate)

| Target | Value |
|---|---|
| Glass-to-glass latency (LAN, Wi-Fi 6, HEVC) | **< 35 ms** typical |
| 4K60 HEVC bitrate | 25–45 Mbps adaptive |
| 1080p60 HEVC bitrate | 10–20 Mbps adaptive |
| Dropped-frame budget | < 1 % under normal LAN |
| Reconnect window | < 2 s on brief Wi-Fi loss |
| CPU on host | < 5 % overhead above the game itself |
| GPU encoder utilization | < 15 % on RTX 5080 for 4K60 |

Numbers are **goals, not claims**. Reported only after measurement.

## Honest feasibility assessment

- **Capture + NVENC** path: proven art, low risk on NVIDIA hosts.
  Non-NVIDIA hosts must use Intel QSV (`qsv`) or AMF; initial release
  targets NVIDIA only.
- **Game capture correctness** depends on Windows version and the
  game's rendering API. DX11/12 OK; some anti-cheat software blocks
  injection — WGC is passive and should be compatible.
- **HDR passthrough** requires HDR-aware encode (HEVC Main10) and HDR
  metadata preservation; feasible but not in first milestone.
- **Controller latency** depends on Bluetooth stack on Android; USB-C
  controllers will be the recommended path.
- **Full-screen exclusive games** sometimes defeat WGC; fallback to
  DXGI Desktop Duplication on the correct monitor.
- **Browser viewer** is a stretch goal; MediaCodec on Android gives us
  much lower latency.

## Milestones (future)

- RP-A — Host NVENC encode worker + benchmarks (no network).
- RP-B — WebRTC signaling via Locat's authenticated channel, bare
  video + audio delivery to the Android client.
- RP-C — Controller input injection + feedback loop.
- RP-D — Adaptive bitrate, loss recovery, perf telemetry integration.
- RP-E — HDR passthrough, additional codecs (AV1 when hardware allows),
  multi-controller.

## Non-goals (explicit)

- No fake / simulated game-streaming demo. If a frame cannot really
  be captured and decoded, the UI shows the error, not a placeholder.
- No bundled anti-cheat bypasses or driver patches. If a title blocks
  streaming we document it, not work around it.
- No separate consumer "Locat Play" app.
- No cloud relay for the first release — LAN only.
