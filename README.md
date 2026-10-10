# Locat Media Hub

**Reusable module for Locat 2.0.** NOT a standalone application.

- `packages/locat-media-core/` — shared types, pydantic models, persistence contract
- `packages/locat-media-adapters/` — Auth, Storage, Device, Host adapters (dev mocks included)
- `packages/locat-cinema/` — ffprobe indexer + Direct Play decider + HTTP range streamer
- `packages/locat-music/` — mutagen indexer + dual audio mode (Pure Audio / Enhanced DSP) + EQ
- `packages/locat-media-server/` — FastAPI router factory you mount into Locat's host
- `packages/locat-media-ui/` — TypeScript component contracts for Locat 2.0's UI

See [`docs/INTEGRATION.md`](docs/INTEGRATION.md) and
[`docs/DEV_JOURNEY.md`](docs/DEV_JOURNEY.md) for the integration guide
and milestone status.

The dev preview under `/app/frontend` is for testing the module; the
real product is the integration into Locat.

## Quick start (dev preview)

```bash
# Backend already running under supervisor
/app/scripts/generate_sample_media.sh   # generate royalty-free samples
cd /app && python -m pytest tests/test_media_hub.py -v
```

Then open the preview URL to tour the Cinema and Music UIs against a
real indexed library.
