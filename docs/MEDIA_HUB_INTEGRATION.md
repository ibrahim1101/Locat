# Locat Media Hub — Node/Hono integration progress

This document tracks integration of the Emergent prototype into the existing Locat application. The prototype's Python FastAPI routes are **not** mounted into the shipping Node/Hono host.

## Current slice: authenticated read-only indexing

- The existing `api/router.ts` mounts `mediaRouter` using Locat's session-authenticated tRPC middleware.
- `media.libraries` lists explicitly configured host media roots.
- `media.items` scans configured roots for common video and audio extensions, capped per root and media type.
- `src/pages/MediaLocal.tsx` displays server-indexed entries for signed-in users, while preserving local file playback and Locat's Obsidian Ember styling.
- This slice **does not stream indexed files yet**. No Plex, Jellyfin, SMB or arbitrary network-source discovery is included.

## Host setup

On the machine running the Locat server, set `LOCAT_MEDIA_AUTHORIZED_ROOTS` to an OS path-delimiter-separated list of directories the server operator explicitly permits sharing.

Windows PowerShell example:

```powershell
$env:LOCAT_MEDIA_AUTHORIZED_ROOTS = 'D:\\Movies;D:\\Music'
```

Linux example:

```bash
export LOCAT_MEDIA_AUTHORIZED_ROOTS='/srv/movies:/srv/music'
```

Restart the Locat server after configuring the variable. Users must be signed in to see the index. Paths are never submitted from the browser for scanning. Symlink entries are skipped, and recursion and file counts are bounded.

## Remaining integration

1. Build secure, authenticated HTTP Range streaming with explicit root containment and media IDs; test 200/206/416, HEAD, cancellation, and access controls.
2. Add server playback controls to Cinema/Music, compatible codec checks and playback errors.
3. Integrate metadata indexing, artwork, subtitles, progress and playback decision logic.
4. Bring playlists, advanced EQ and diagnostics from Emergent's media prototype into the Locat host.
5. Implement native Android/Windows playback capability bridges where web codecs are insufficient.

Do not advertise bit-perfect audio or universal MKV/HDR support until native capability checks verify it.
