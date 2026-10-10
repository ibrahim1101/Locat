"""FastAPI router that mounts the full Locat Media Hub HTTP surface.

Every route is prefixed with ``/api/media``. The surrounding Locat
backend is expected to call ``create_media_router(...)`` and
``app.include_router(router)`` once auth/storage/host adapters are
wired up.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from locat_media_core import (
    MediaLibrary,
    MediaItem,
    MediaType,
    MusicTrack,
    Playlist,
    EqPreset,
    PlaybackSession,
    DiagnosticsSnapshot,
    AudioModeKind,
    ScanStatus,
)
from locat_media_core.persistence import MediaPersistence

from locat_media_adapters import (
    AuthAdapter,
    UserContext,
    StorageAdapter,
    DevicePairingAdapter,
    HostAdapter,
)

from locat_cinema import CinemaIndexer, ClientCapabilities, PlaybackDecider, RangeStreamer
from locat_music import MusicIndexer, AudioModeService, builtin_eq_presets

from .diagnostics import DiagnosticsRegistry
from .settings import MediaServerSettings

logger = logging.getLogger("locat_media_server.router")


# ---------------- Request / response schemas ----------------

class CreateLibraryBody(BaseModel):
    name: str
    root_path: str
    kind: MediaType = MediaType.MOVIE


class LibraryOut(BaseModel):
    id: str
    name: str
    root_path: str
    kind: MediaType
    scan_status: ScanStatus
    item_count: int
    last_scanned_at: Optional[str] = None


class PlaybackDecisionBody(BaseModel):
    containers: List[str] = Field(default_factory=list)
    video_codecs: List[str] = Field(default_factory=list)
    audio_codecs: List[str] = Field(default_factory=list)
    hdr: List[str] = Field(default_factory=list)
    max_video_height: Optional[int] = None
    subtitle_codecs: List[str] = Field(default_factory=list)


class SetAudioModeBody(BaseModel):
    mode: AudioModeKind
    device_id: Optional[str] = None


class EqBandBody(BaseModel):
    frequency_hz: float
    gain_db: float = 0.0


class SaveEqPresetBody(BaseModel):
    id: Optional[str] = None
    name: str
    bands_mode: str = "10"
    preamp_db: float = 0.0
    bands: List[EqBandBody] = Field(default_factory=list)
    replaygain_mode: str = "off"
    limiter_enabled: bool = False
    balance: float = 0.0
    bypass: bool = False
    output_device_id: Optional[str] = None


class PlaylistBody(BaseModel):
    id: Optional[str] = None
    name: str
    track_ids: List[str] = Field(default_factory=list)
    description: str = ""


class ReportBitPerfectBody(BaseModel):
    device_id: str
    verified: bool
    evidence: dict = Field(default_factory=dict)


# ---------------- Router factory ----------------

def create_media_router(
    *,
    persistence: MediaPersistence,
    auth: AuthAdapter,
    storage: StorageAdapter,
    device_pairing: DevicePairingAdapter,
    host: HostAdapter,
    settings: MediaServerSettings,
) -> APIRouter:
    router = APIRouter(prefix="/api/media", tags=["locat-media"])
    diagnostics = DiagnosticsRegistry()
    streamer = RangeStreamer(chunk_size=settings.chunk_size_bytes)
    audio_mode_service = AudioModeService(persistence=persistence, host=host)
    decider = PlaybackDecider()

    # ---------------- Dependencies ----------------

    async def _require_user(
        authorization: Optional[str] = Header(default=None),
    ) -> UserContext:
        if not settings.enabled:
            raise HTTPException(status_code=503, detail="Locat Media Hub is disabled (LOCAT_MEDIA_ENABLED=false).")
        if not settings.auth_required and settings.dev_mode:
            # Dev preview: skip verification, hand back a dev user.
            ctx = await auth.verify(authorization)
            return ctx or UserContext(user_id="dev-user", display_name="Locat Dev User",
                                      device_id="dev-device", is_admin=True)
        ctx = await auth.verify(authorization)
        if not ctx:
            raise HTTPException(status_code=401, detail="Not authenticated with Locat")
        return ctx

    def _library_out(lib: MediaLibrary) -> dict:
        return {
            "id": lib.id,
            "name": lib.name,
            "root_path": lib.root_path,
            "kind": lib.kind.value,
            "scan_status": lib.scan_status.value,
            "item_count": lib.item_count,
            "last_scanned_at": lib.last_scanned_at.isoformat() if lib.last_scanned_at else None,
        }

    # ---------------- Service meta ----------------

    @router.get("/health")
    async def health():
        return {
            "status": "ok",
            "enabled": settings.enabled,
            "runtime": host.runtime_name,
            "dev_mode": settings.dev_mode,
            "active_sessions": diagnostics.active_count(),
            "authorized_roots": [str(p) for p in storage.authorized_roots()],
        }

    @router.get("/config")
    async def config(user: UserContext = Depends(_require_user)):
        return {
            "LOCAT_MEDIA_ENABLED": settings.enabled,
            "LOCAT_DEV_MODE": settings.dev_mode,
            "runtime": host.runtime_name,
            "user": {"id": user.user_id, "display_name": user.display_name,
                     "is_admin": user.is_admin},
            "authorized_roots": [str(p) for p in storage.authorized_roots()],
            "feature_flags": {"LOCAT_MEDIA_ENABLED": settings.enabled},
        }

    @router.get("/capabilities/matrix")
    async def capability_matrix(user: UserContext = Depends(_require_user)):
        decoders = await host.native_decoder_matrix()
        return {
            "runtime": host.runtime_name,
            "decoders": [d.__dict__ for d in decoders],
            "notes": (
                "Browsers reliably Direct Play H.264+AAC in MP4. HEVC/MKV/EAC3 "
                "and HDR require either a native host adapter (Locat Windows "
                "WASAPI/NVENC or Locat Android MediaCodec) OR server-side "
                "remux/transcode."
            ),
        }

    # ---------------- Libraries ----------------

    @router.post("/libraries", status_code=201)
    async def create_library(
        body: CreateLibraryBody,
        user: UserContext = Depends(_require_user),
    ):
        root = Path(body.root_path).resolve(strict=False)
        if not storage.is_authorized_path(str(root)):
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Library path {root} is not within an authorized root. "
                    "Add it to LOCAT_MEDIA_AUTHORIZED_ROOTS in the Locat host first."
                ),
            )
        if not root.exists() or not root.is_dir():
            raise HTTPException(status_code=400, detail=f"Path does not exist or is not a directory: {root}")
        lib = MediaLibrary(name=body.name, root_path=str(root), kind=body.kind)
        await persistence.upsert_library(lib)
        return _library_out(lib)

    @router.get("/libraries")
    async def list_libraries(user: UserContext = Depends(_require_user)):
        libs = await persistence.list_libraries()
        return [_library_out(l) for l in libs]

    @router.delete("/libraries/{library_id}")
    async def delete_library(library_id: str, user: UserContext = Depends(_require_user)):
        lib = await persistence.get_library(library_id)
        if not lib:
            raise HTTPException(status_code=404, detail="Library not found")
        await persistence.delete_items_for_library(library_id)
        await persistence.delete_tracks_for_library(library_id)
        await persistence.delete_library(library_id)
        return {"deleted": True, "note": "Media files on disk are NOT touched."}

    @router.post("/libraries/{library_id}/scan")
    async def scan_library(library_id: str, user: UserContext = Depends(_require_user)):
        lib = await persistence.get_library(library_id)
        if not lib:
            raise HTTPException(status_code=404, detail="Library not found")
        if not storage.is_authorized_path(lib.root_path):
            raise HTTPException(status_code=403, detail="Library root is not authorized")

        lib.scan_status = ScanStatus.SCANNING
        await persistence.upsert_library(lib)
        try:
            root = Path(lib.root_path)
            indexed_items = indexed_tracks = 0
            if lib.kind in (MediaType.MOVIE, MediaType.EPISODE):
                items = await CinemaIndexer(storage).index_library(library_id, root)
                for it in items:
                    await persistence.upsert_item(it)
                indexed_items = len(items)
            if lib.kind == MediaType.MUSIC:
                tracks = await MusicIndexer(storage).index_library(library_id, root)
                for t in tracks:
                    await persistence.upsert_track(t)
                indexed_tracks = len(tracks)

            from datetime import datetime, timezone
            lib.scan_status = ScanStatus.DONE
            lib.last_scanned_at = datetime.now(timezone.utc)
            lib.item_count = indexed_items + indexed_tracks
            await persistence.upsert_library(lib)
            return {
                "library_id": library_id,
                "status": lib.scan_status.value,
                "indexed_items": indexed_items,
                "indexed_tracks": indexed_tracks,
            }
        except Exception as e:  # noqa: BLE001
            lib.scan_status = ScanStatus.FAILED
            await persistence.upsert_library(lib)
            logger.exception("library scan failed")
            raise HTTPException(status_code=500, detail=f"Scan failed: {e}")

    # ---------------- Cinema items ----------------

    @router.get("/items")
    async def list_items(
        library_id: Optional[str] = None,
        media_type: Optional[MediaType] = None,
        q: Optional[str] = None,
        limit: int = Query(500, le=2000),
        offset: int = 0,
        user: UserContext = Depends(_require_user),
    ):
        items = await persistence.list_items(
            library_id=library_id,
            media_type=media_type.value if media_type else None,
            query=q, limit=limit, offset=offset,
        )
        return [i.model_dump(mode="json") for i in items]

    @router.get("/items/{item_id}")
    async def get_item(item_id: str, user: UserContext = Depends(_require_user)):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        return it.model_dump(mode="json")

    @router.post("/items/{item_id}/playback-decision")
    async def playback_decision(
        item_id: str,
        body: Optional[PlaybackDecisionBody] = None,
        user: UserContext = Depends(_require_user),
    ):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        if body is None or not body.video_codecs:
            caps = ClientCapabilities.web_safe_default()
        else:
            caps = ClientCapabilities(
                containers=[c.lower() for c in body.containers],
                video_codecs=[c.lower() for c in body.video_codecs],
                audio_codecs=[c.lower() for c in body.audio_codecs],
                subtitle_codecs=[c.lower() for c in body.subtitle_codecs],
                hdr=[c.lower() for c in body.hdr],
                max_video_height=body.max_video_height,
            )
        decision = decider.decide(it, caps)
        return decision.model_dump(mode="json")

    @router.get("/items/{item_id}/stream")
    @router.head("/items/{item_id}/stream")
    async def stream_item(
        item_id: str,
        request: Request,
        session_id: Optional[str] = Query(default=None),
        user: UserContext = Depends(_require_user),
    ):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        if not storage.is_authorized_path(it.path):
            raise HTTPException(status_code=403, detail="Media path is not within an authorized library")

        session: Optional[PlaybackSession] = None
        if session_id:
            session = diagnostics.get_session(session_id)
        if session is None:
            session = diagnostics.start_session(PlaybackSession(
                item_id=item_id,
                client_id=user.device_id,
                client_info={"user_id": user.user_id},
            ))

        rng = request.headers.get("range")
        if rng:
            try:
                from locat_cinema.streaming import parse_range_header
                parsed = parse_range_header(rng, Path(it.path).stat().st_size)
                if parsed:
                    diagnostics.record_range(session.id, *parsed)
            except HTTPException:
                raise

        def _on_bytes(n: int) -> None:
            diagnostics.record_bytes(session.id, n)

        def _on_disconnect() -> None:
            session.stalls += 1

        response = await streamer.respond(
            request, Path(it.path),
            on_bytes=_on_bytes, on_disconnect=_on_disconnect,
        )
        # Expose the session id so the client can poll diagnostics.
        response.headers["X-Locat-Session-Id"] = session.id
        return response

    @router.get("/items/{item_id}/diagnostics")
    async def item_diagnostics(
        item_id: str,
        session_id: Optional[str] = None,
        user: UserContext = Depends(_require_user),
    ):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        v = it.video_streams[0] if it.video_streams else None
        a = it.audio_streams[0] if it.audio_streams else None

        snapshot = DiagnosticsSnapshot(
            session_id=session_id or "no-session",
            item_id=item_id,
            resolution=f"{v.width}x{v.height}" if v else None,
            video_codec=v.codec if v else None,
            audio_codec=a.codec if a else None,
            source_bitrate_bps=(v.bit_rate if v and v.bit_rate else None),
            notes=[
                "Diagnostics include real range-stream throughput once playback starts.",
            ],
        )
        if session_id:
            existing = diagnostics.get_diagnostics(session_id)
            if existing:
                existing.resolution = snapshot.resolution
                existing.video_codec = snapshot.video_codec
                existing.audio_codec = snapshot.audio_codec
                existing.source_bitrate_bps = snapshot.source_bitrate_bps
                return existing.model_dump(mode="json")
            diagnostics.set_diagnostics(snapshot)
            live = diagnostics.get_diagnostics(session_id)
            return (live or snapshot).model_dump(mode="json")
        return snapshot.model_dump(mode="json")

    @router.post("/items/{item_id}/progress")
    async def save_progress(
        item_id: str,
        position_seconds: float = Query(..., ge=0),
        user: UserContext = Depends(_require_user),
    ):
        updated = await persistence.update_item_play_state(
            item_id, position_seconds=position_seconds,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"ok": True, "last_position_seconds": updated.last_position_seconds}

    # ---------------- Music ----------------

    @router.get("/music/tracks")
    async def list_tracks(
        library_id: Optional[str] = None,
        album: Optional[str] = None,
        artist: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = Query(1000, le=5000),
        offset: int = 0,
        user: UserContext = Depends(_require_user),
    ):
        tracks = await persistence.list_tracks(
            library_id=library_id, album=album, artist=artist, query=q,
            limit=limit, offset=offset,
        )
        return [t.model_dump(mode="json") for t in tracks]

    @router.get("/music/tracks/{track_id}")
    async def get_track(track_id: str, user: UserContext = Depends(_require_user)):
        t = await persistence.get_track(track_id)
        if not t:
            raise HTTPException(status_code=404, detail="Track not found")
        return t.model_dump(mode="json")

    @router.get("/music/tracks/{track_id}/stream")
    @router.head("/music/tracks/{track_id}/stream")
    async def stream_track(
        track_id: str,
        request: Request,
        user: UserContext = Depends(_require_user),
    ):
        t = await persistence.get_track(track_id)
        if not t:
            raise HTTPException(status_code=404, detail="Track not found")
        if not storage.is_authorized_path(t.path):
            raise HTTPException(status_code=403, detail="Track path not authorized")
        return await streamer.respond(request, Path(t.path))

    @router.get("/music/albums")
    async def list_albums(user: UserContext = Depends(_require_user)):
        return await persistence.list_albums()

    @router.get("/music/artists")
    async def list_artists(user: UserContext = Depends(_require_user)):
        return await persistence.list_artists()

    @router.post("/music/tracks/{track_id}/favorite")
    async def favorite_track(
        track_id: str,
        value: bool = Query(True),
        user: UserContext = Depends(_require_user),
    ):
        t = await persistence.update_track_play_state(track_id, favorite=value)
        if not t:
            raise HTTPException(status_code=404, detail="Track not found")
        return {"ok": True, "favorite": t.favorite}

    # ---------- Audio modes ----------

    @router.get("/music/audio-mode")
    async def get_audio_mode(
        device_id: Optional[str] = None,
        runtime: Optional[str] = None,
        user: UserContext = Depends(_require_user),
    ):
        caps = await audio_mode_service.capabilities(runtime=runtime, device_id=device_id)
        return caps.model_dump(mode="json")

    @router.post("/music/audio-mode")
    async def set_audio_mode(body: SetAudioModeBody, user: UserContext = Depends(_require_user)):
        mode = await audio_mode_service.set_active_mode(body.mode, device_id=body.device_id)
        return {"ok": True, "mode": mode.value}

    @router.post("/music/audio-mode/report-verified")
    async def report_bit_perfect(
        body: ReportBitPerfectBody,
        user: UserContext = Depends(_require_user),
    ):
        # Only accept this from trusted (admin) native adapters.
        if not user.is_admin:
            raise HTTPException(status_code=403, detail="Only trusted native adapters may report bit-perfect verification")
        await audio_mode_service.report_verified_bitperfect(
            body.device_id, body.verified, body.evidence,
        )
        return {"ok": True}

    # ---------- EQ presets ----------

    @router.get("/music/eq/presets")
    async def list_eq_presets(user: UserContext = Depends(_require_user)):
        presets = await persistence.list_eq_presets()
        if not presets:
            await audio_mode_service.seed_builtins()
            presets = await persistence.list_eq_presets()
        return [p.model_dump(mode="json") for p in presets]

    @router.post("/music/eq/presets")
    async def save_eq_preset(body: SaveEqPresetBody, user: UserContext = Depends(_require_user)):
        from locat_media_core import EqBand as _EqBand
        import uuid as _uuid
        preset = EqPreset(
            id=body.id or _uuid.uuid4().hex,
            name=body.name,
            bands_mode=body.bands_mode,
            preamp_db=body.preamp_db,
            bands=[_EqBand(frequency_hz=b.frequency_hz, gain_db=b.gain_db) for b in body.bands],
            replaygain_mode=body.replaygain_mode,
            limiter_enabled=body.limiter_enabled,
            balance=body.balance,
            bypass=body.bypass,
            output_device_id=body.output_device_id,
            is_builtin=False,
        )
        await persistence.upsert_eq_preset(preset)
        return preset.model_dump(mode="json")

    @router.delete("/music/eq/presets/{preset_id}")
    async def delete_eq_preset(preset_id: str, user: UserContext = Depends(_require_user)):
        existing = await persistence.get_eq_preset(preset_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Preset not found")
        if existing.is_builtin:
            raise HTTPException(status_code=400, detail="Built-in presets cannot be deleted")
        await persistence.delete_eq_preset(preset_id)
        return {"deleted": True}

    # ---------- Playlists ----------

    @router.get("/music/playlists")
    async def list_playlists(user: UserContext = Depends(_require_user)):
        pls = await persistence.list_playlists()
        return [p.model_dump(mode="json") for p in pls]

    @router.post("/music/playlists")
    async def save_playlist(body: PlaylistBody, user: UserContext = Depends(_require_user)):
        import uuid as _uuid
        pl = Playlist(
            id=body.id or _uuid.uuid4().hex,
            name=body.name,
            track_ids=body.track_ids,
            description=body.description,
        )
        await persistence.upsert_playlist(pl)
        return pl.model_dump(mode="json")

    @router.delete("/music/playlists/{playlist_id}")
    async def delete_playlist(playlist_id: str, user: UserContext = Depends(_require_user)):
        await persistence.delete_playlist(playlist_id)
        return {"deleted": True}

    # ---------------- Devices ----------------

    @router.get("/devices")
    async def list_devices(user: UserContext = Depends(_require_user)):
        devs = await device_pairing.list_devices(user.user_id)
        return [d.__dict__ for d in devs]

    return router
