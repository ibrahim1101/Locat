# Media Hub branch consolidation audit

Source: `feat/locat-media-hub` (independent Git history). Target: `release/locat-v1.0`, ultimately `main`.

## Architecture mismatch

The Media Hub branch is a standalone reusable Python/FastAPI module with `packages/locat-media-core`, `locat-media-adapters`, `locat-cinema`, `locat-music`, `locat-media-server`, and `locat-media-ui`. Its `README.md` and `docs/INTEGRATION.md` explicitly state the frontend is a development preview and mock adapters are not production-safe.

The current Locat release is a TypeScript/React application with an existing media API. Copying FastAPI files or replacing the existing server is not a valid feature integration.

## Preservation and next implementation

1. Keep `feat/locat-media-hub` intact until every required module is inventoried and integrated or explicitly archived.
2. Inventory capabilities from `docs/DEV_JOURNEY.md` against the current Cinema, Music, and server routes: HTTP Range, remux/transcode, HDR metadata, series grouping, playback resume, codec diagnostics, parametric EQ, favorites and playlists.
3. Choose an explicit architecture: port reusable logic to the current server or run the Python module as an authenticated sidecar. Do not ship mock Auth/Storage/Device adapters.
4. Enforce authorized roots, device consent and revocation, trusted device identity, and session-scoped access before exposing cross-device media.
5. Add integration tests, native playback tests, CI checks, and rollback instructions.
6. Only after verification, merge the consolidated release into `main` and remove obsolete branches.

This document is an audit, **not** a claim that the Media Hub module is integrated or that builds pass.
