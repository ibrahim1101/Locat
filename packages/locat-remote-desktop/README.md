# Locat Remote Desktop — Architecture plan (NOT YET IMPLEMENTED)

> Status: **planning only**. No code lives in this package yet. Do not
> start implementing until the Cinema and Music milestones are closed.
> This document is the integration-ready design the next phase will
> build against.

## Scope

Low-latency, secure remote control of the user's Windows PC from any
authorized Locat client (Android app, web client). Uses Locat 2.0's
existing authentication, device pairing, Windows host, and shared
navigation. Does NOT create a parallel user system.

## Core user flows

1. Pair device → already handled by Locat's `DevicePairingAdapter`.
2. Pick a Locat Windows host from the authorized list.
3. Receive the host screen (optionally per-monitor); send mouse,
   keyboard, scroll, clipboard events.
4. Adjust quality (bitrate / resolution / frame cap) on the fly.
5. Reconnect gracefully across network interruptions.

## Suggested package layout

```
packages/locat-remote-desktop/
├── core/                        # TypeScript types + signaling protocol
├── server/                      # FastAPI router mounted into Locat host
├── windows-capture/             # Native Windows capture + input engine
│   ├── capture-dxgi/            # Desktop Duplication (per-monitor)
│   └── input-sendinput/         # SendInput for mouse/keyboard
├── transport/                   # WebRTC or QUIC-over-TLS session layer
├── adapter-locat/               # Wraps Locat auth/device/host adapters
└── ui/                          # React screen viewer + input overlay
```

## Technical dependencies (research, not decisions)

| Area | Candidate | Notes |
|---|---|---|
| Screen capture | **Windows Desktop Duplication API (DXGI)** | Modern, GPU-friendly, multi-monitor out of the box. Alternative: `Graphics.Capture` (WinRT) for per-window capture. |
| Video encode   | **NVENC** (NVIDIA RTX 5080-class) with x264 CPU fallback | Already compiled into the ffmpeg available on Locat Windows hosts. |
| Transport      | **WebRTC** (RTCPeerConnection) or **QUIC** via `aioquic` / `msquic` | WebRTC gives built-in congestion control + mobile/web support. QUIC gives finer control + less NAT fiddling on LAN. |
| Signaling      | Reuse Locat's existing authenticated channel. No separate signaling server. | Keeps the LAN-first promise. |
| Input          | `SendInput` on Windows for keyboard/mouse; `GetCursorPos` for feedback. | |
| Clipboard sync | Windows clipboard API + size cap, user-opt-in. | |
| Audio          | WASAPI loopback → shared Opus stream over same transport. | Reuses the Locat Music audio bridge know-how. |

### Open-source references to study

- **Moonlight-common-c** + **Sunshine host** — mature NVENC-based remote
  play on NVIDIA GPUs (GPLv3). Can be studied for the capture + encode
  pipeline; direct reuse would require relicensing considerations.
- **Chrome Remote Desktop** protocol docs — not reusable code but a
  good reference for the control plane.
- **Parsec** — proprietary, do NOT copy.
- **noVNC / websockify** — reference for a browser-side viewer, but
  VNC's frame-buffer protocol is not latency-competitive for our needs.

**License posture:** we will NOT ship GPL-licensed capture or encode
code inside Locat. Any GPL reference is for architecture only; shipping
code must be MIT/Apache/BSD or Microsoft-licensed Windows SDK calls.

## Performance targets (initial)

| Target | Value |
|---|---|
| Glass-to-glass latency (LAN) | **< 60 ms** typical, < 120 ms max |
| Encode CPU usage (NVENC path) | < 10 % on a single P-core |
| Pixel-perfect capture rate | 30 fps default, 60 fps opt-in |
| Dropped-frame budget | < 2 % under normal LAN conditions |
| Reconnect window | < 3 s on single transient failure |

These numbers are *goals to validate against measurements*, never to
be reported as "achieved" until a benchmarked session confirms them.

## Honest feasibility assessment

- **Capture pipeline:** DXGI Desktop Duplication is a solved problem;
  low risk.
- **NVENC + WebRTC on Android:** moderate complexity (hardware
  decoder path), but Android MediaCodec HEVC is widely supported.
- **Input injection** on modern Windows requires foreground / UIAccess
  work for secure-desktop scenarios (UAC prompts, lock screen). Must
  be documented as a limitation.
- **Multi-monitor dynamic hot-plug** — DXGI handles it; UI side needs
  work.
- **Clipboard sync** has security surface — opt-in, size-capped, no
  file paths cross the boundary.
- **Browser-only viewer** limited by WebRTC video decoder path; a
  Capacitor-native viewer will outperform it.

## Milestones (future)

- RD-A — Host capture + encode worker (no network). Benchmarks.
- RD-B — Signaling + transport over Locat's existing authenticated
  channel. Single-monitor viewer.
- RD-C — Input injection + clipboard + multi-monitor.
- RD-D — Reconnection, adaptive bitrate, performance telemetry
  integration with the Locat Performance tab.
- RD-E — Mobile viewer (Capacitor native) with hardware HEVC decode.

## Non-goals (explicit)

- No fake / simulated remote desktop demos. The initial preview must
  show a REAL frame from the user's host or no frame at all.
- No separate consumer "Locat Remote" app. This is a module.
- No cloud relay by default; everything stays on the LAN unless the
  user explicitly enables a relay later.
