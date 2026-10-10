# Locat Media Hub — Integration Guide

> **Not a standalone app.** This repo contains the source for the Locat
> Media Hub module (Cinema + Music). It is designed to be dropped into
> the existing Locat 2.0 repository. The React page under `/app/frontend`
> is a dev preview only — it is NOT the shipping product.

## 1. Monorepo layout

```
packages/
├── locat-media-core/          # Pydantic models, enums, persistence contract
├── locat-media-adapters/      # AuthAdapter, StorageAdapter, DevicePairingAdapter, HostAdapter
├── locat-cinema/              # ffprobe indexer, Direct Play decision engine, HTTP range streamer
├── locat-music/               # mutagen indexer, dual audio-mode service, EQ seed presets
├── locat-media-server/        # FastAPI router factory + diagnostics registry + settings
└── locat-media-ui/            # TypeScript component contracts for Locat 2.0 UI
```

Every package is independently testable (`packages/*/src/<module>`). Python
packages are added to `sys.path` by the host application; TypeScript types
in `locat-media-ui/src/types/index.ts` are the integration contract for the
React side.

## 2. Feature flag

The module is activated by a single environment variable in the parent
Locat application:

```ini
LOCAT_MEDIA_ENABLED=true
LOCAT_DEV_MODE=false            # set true only in local dev
LOCAT_MEDIA_AUTH_REQUIRED=true  # enforce Locat auth adapter
LOCAT_HOST_RUNTIME=windows      # or "android" / "web"
LOCAT_MEDIA_AUTHORIZED_ROOTS=/media/library:/other/path
```

When `LOCAT_MEDIA_ENABLED=false` all endpoints return `503 Service
Unavailable` without touching the DB.

## 3. Mounting into Locat's FastAPI host

```python
from locat_media_core.persistence import MongoMediaPersistence
from locat_media_server import create_media_router, MediaServerSettings

# Replace the mocks with your real adapters. The mocks in
# locat_media_adapters are explicitly marked MOCK and MUST NOT be
# used in production.
from your_locat.adapters import (
    LocatAuthAdapter,
    LocatWindowsStorageAdapter,
    LocatDevicePairingAdapter,
    LocatWindowsHostAdapter,
)

settings = MediaServerSettings.from_env()
persistence = MongoMediaPersistence(locat_db)   # or your own impl

router = create_media_router(
    persistence=persistence,
    auth=LocatAuthAdapter(...),
    storage=LocatWindowsStorageAdapter(...),
    device_pairing=LocatDevicePairingAdapter(...),
    host=LocatWindowsHostAdapter(...),
    settings=settings,
)
app.include_router(router)        # mounts under /api/media
```

## 4. Adapters to implement

| Adapter | Purpose | Required native work |
|---|---|---|
| `AuthAdapter.verify(authorization_header)` | Hand off to Locat's existing identity system | None (Locat already has it) |
| `StorageAdapter.{authorized_roots,is_authorized_path,iter_files}` | Enforce canonical-path guards & Windows ACL | Windows ACL check |
| `DevicePairingAdapter.{list_devices,is_trusted}` | Reuse Locat's device trust model | None (Locat already has it) |
| `HostAdapter.{start_services,stop_services,native_decoder_matrix,native_audio_capabilities}` | Native lifecycle + capability bridge | **Yes** — WASAPI exclusive, NVENC, MediaCodec, AAudio |

## 5. HTTP API surface (`/api/media`)

```
GET    /health
GET    /config
GET    /capabilities/matrix

GET    /libraries
POST   /libraries                          { name, root_path, kind }
DELETE /libraries/{id}
POST   /libraries/{id}/scan

GET    /items?library_id&media_type&q&limit&offset
GET    /items/{id}
POST   /items/{id}/playback-decision       { containers, video_codecs, ... }
GET    /items/{id}/stream                  (HTTP 206 Partial Content + Range)
HEAD   /items/{id}/stream
GET    /items/{id}/diagnostics?session_id
POST   /items/{id}/progress?position_seconds

GET    /music/tracks?library_id&album&artist&q
GET    /music/tracks/{id}
GET    /music/tracks/{id}/stream           (HTTP 206 Partial Content + Range)
GET    /music/albums
GET    /music/artists
POST   /music/tracks/{id}/favorite?value=true

GET    /music/audio-mode?runtime=web&device_id=...
POST   /music/audio-mode                   { mode, device_id }
POST   /music/audio-mode/report-verified   # TRUSTED NATIVE ADAPTERS ONLY

GET    /music/eq/presets
POST   /music/eq/presets
DELETE /music/eq/presets/{id}

GET    /music/playlists
POST   /music/playlists
DELETE /music/playlists/{id}

GET    /devices
```

## 6. Compatibility matrix

| Container | Browser Direct Play | Android native | Windows native |
|---|---|---|---|
| MP4 (H.264 + AAC)         | ✅ | ✅ | ✅ |
| WebM (VP9 / Opus)         | ✅ | ✅ | ✅ |
| MKV (H.264/HEVC + E-AC3)  | ❌ (remux → MP4 fragmented) | ✅ (MediaCodec) | ✅ |
| HEVC HDR10                | ❌ (transcode or native)    | ✅ (MediaCodec, device-dependent) | ✅ (NVDEC) |
| Dolby Vision              | ❌                          | Device-dependent                   | Future |
| TrueHD / DTS-HD           | ❌ (passthrough only on native) | A2DP: no · USB: device-dependent | WASAPI pass-through |

## 7. Dual audio playback modes

- **Pure Audio** — bypasses the entire DSP graph. In the web preview the
  browser mixer may still resample, so the server honestly reports
  `bit_perfect=unavailable`. The Windows WASAPI exclusive adapter is the
  only path that can report `bit_perfect=verified`, and it does so by
  calling `POST /api/media/music/audio-mode/report-verified` with
  evidence of matching sample rate/bit depth.
- **Enhanced DSP** — engages the 10/15/31-band biquad EQ, preamp,
  optional soft limiter, ReplayGain, and (in future) parametric
  filters. The dev preview uses `BiquadFilterNode`s; native hosts should
  use their own DSP (`libavfilter` or platform APIs).

## 8. What is still mocked

The following remain stubs in `locat_media_adapters`:

- `MockLocatAuthAdapter` – replace with Locat's real auth.
- `MockDevicePairingAdapter` – trusts every device; replace with Locat's
  device trust system.
- `MockWindowsHostAdapter` / `MockAndroidCapacitorAdapter` –
  **native work required**: WASAPI exclusive output, NVENC/NVDEC
  hardware transcoding, Android MediaCodec, AAudio exclusive output.

## 9. Running tests

Backend end-to-end:

```bash
cd /app
python -m pytest tests/test_media_hub.py -v
```

All 23 tests cover: health & feature flag, library scan, Direct Play
decider, HTTP 206/416 range semantics, music metadata, audio-mode
switching, bit-perfect honesty, and EQ preset CRUD.
