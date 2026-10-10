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
from locat_cinema import FfmpegRemuxWorker, FfmpegTranscodeWorker, select_profile
from locat_cinema import classify_subtitle, extract_subtitle_as_webvtt
from locat_cinema.hwaccel import probe_ffmpeg_capabilities, common_container_matrix
from locat_music import MusicIndexer, AudioModeService, builtin_eq_presets

from .diagnostics import DiagnosticsRegistry
from .settings import MediaServerSettings
from .telemetry import TelemetryService

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


class ParametricFilterBody(BaseModel):
    kind: str = "peaking"
    frequency_hz: float = 1000.0
    gain_db: float = 0.0
    q: float = 1.0
    enabled: bool = True


class SaveEqPresetBody(BaseModel):
    id: Optional[str] = None
    name: str
    bands_mode: str = "10"
    preamp_db: float = 0.0
    bands: List[EqBandBody] = Field(default_factory=list)
    parametric: List[ParametricFilterBody] = Field(default_factory=list)
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
    remuxer = FfmpegRemuxWorker()
    transcoder = FfmpegTranscodeWorker()
    telemetry = TelemetryService(diagnostics)

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
        hw = await probe_ffmpeg_capabilities()
        return {
            "runtime": host.runtime_name,
            "decoders": [d.__dict__ for d in decoders],
            "ffmpeg": {
                "version": hw.ffmpeg_version,
                "hwaccels": hw.hwaccels,
                "nvenc_available": hw.nvenc_available,
                "nvdec_available": hw.nvdec_available,
                "vaapi_available": hw.vaapi_available,
                "qsv_available": hw.qsv_available,
                "videotoolbox_available": hw.videotoolbox_available,
            },
            "container_matrix": common_container_matrix(),
            "notes": (
                "Browsers reliably Direct Play H.264+AAC in MP4. Everything else is served "
                "via server-side stream-copy remux to fragmented MP4 (lossless) unless the "
                "video codec itself is incompatible, in which case transcoding is required."
            ),
        }

    @router.get("/capabilities/ffmpeg")
    async def ffmpeg_caps(user: UserContext = Depends(_require_user)):
        hw = await probe_ffmpeg_capabilities()
        return hw.__dict__

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
        response.headers["X-Locat-Session-Id"] = session.id
        return response

    @router.get("/items/{item_id}/remux.mp4")
    async def remux_item(
        item_id: str,
        request: Request,
        start: float = Query(0.0, ge=0),
        session_id: Optional[str] = Query(default=None),
        user: UserContext = Depends(_require_user),
    ):
        """Server-side STREAM-COPY remux to fragmented MP4.

        No re-encoding. Original video and (where possible) audio are
        preserved byte-for-byte. Used when the client cannot handle the
        source container but can decode the elementary streams.
        """
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        if not storage.is_authorized_path(it.path):
            raise HTTPException(status_code=403, detail="Media path is not within an authorized library")

        session = diagnostics.get_session(session_id) if session_id else None
        if session is None:
            session = diagnostics.start_session(PlaybackSession(
                item_id=item_id,
                client_id=user.device_id,
                client_info={"user_id": user.user_id, "mode": "remux"},
            ))

        import asyncio as _asyncio
        cancel = _asyncio.Event()

        async def _iter():
            try:
                async for chunk in remuxer.stream(
                    Path(it.path),
                    start_seconds=start,
                    preserve_dovi=(v is not None and v.hdr == "dovi"),
                    on_bytes=lambda n: diagnostics.record_bytes(session.id, n),
                    cancel_event=cancel,
                ):
                    if await request.is_disconnected():
                        cancel.set()
                        break
                    yield chunk
            finally:
                diagnostics.end_session(session.id)

        from starlette.responses import StreamingResponse
        v = it.video_streams[0] if it.video_streams else None
        dovi_header = "preserved" if (v and v.hdr == "dovi") else "not-applicable"
        return StreamingResponse(
            _iter(),
            media_type="video/mp4",
            headers={
                "X-Locat-Session-Id": session.id,
                "X-Locat-Playback-Path": "remux-stream-copy",
                "X-Locat-HDR-Format": (v.hdr or "sdr") if v else "sdr",
                "X-Locat-DolbyVision": dovi_header,
                "Cache-Control": "no-cache",
            },
        )

    @router.get("/items/{item_id}/transcode.mp4")
    async def transcode_item(
        item_id: str,
        request: Request,
        start: float = Query(0.0, ge=0),
        max_height: Optional[int] = Query(None),
        user: UserContext = Depends(_require_user),
    ):
        """Server-side TRANSCODE to H.264/AAC MP4. NVENC-first with CPU
        fallback. Used only when neither Direct Play nor Direct Stream
        can serve the client."""
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        if not storage.is_authorized_path(it.path):
            raise HTTPException(status_code=403, detail="Media path not authorized")

        v = it.video_streams[0] if it.video_streams else None
        profile = await select_profile(
            source_codec=(v.codec if v else ""),
            source_pix_fmt=(v.pixel_format if v else None),
            want_video_codecs=["h264"],
            max_height=max_height,
        )
        session = diagnostics.start_session(PlaybackSession(
            item_id=item_id,
            client_id=user.device_id,
            client_info={"user_id": user.user_id, "mode": "transcode", "profile": profile.name},
        ))

        import asyncio as _asyncio
        cancel = _asyncio.Event()
        progress_state = {"progress": {}}

        def _on_progress(p: dict) -> None:
            progress_state["progress"] = p

        async def _iter():
            try:
                async for chunk in transcoder.stream(
                    Path(it.path), profile,
                    start_seconds=start,
                    on_bytes=lambda n: diagnostics.record_bytes(session.id, n),
                    on_progress=_on_progress,
                    cancel_event=cancel,
                ):
                    if await request.is_disconnected():
                        cancel.set()
                        break
                    yield chunk
            finally:
                diagnostics.end_session(session.id)

        from starlette.responses import StreamingResponse
        headers = {
            "X-Locat-Session-Id": session.id,
            "X-Locat-Playback-Path": "transcode",
            "X-Locat-Encoder": profile.video_codec,
            "X-Locat-Encoder-Reason": profile.reason,
            "Cache-Control": "no-cache",
        }
        return StreamingResponse(_iter(), media_type="video/mp4", headers=headers)

    @router.get("/items/{item_id}/transcode-profile")
    async def preview_transcode_profile(item_id: str,
                                        max_height: Optional[int] = None,
                                        user: UserContext = Depends(_require_user)):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        v = it.video_streams[0] if it.video_streams else None
        profile = await select_profile(
            source_codec=(v.codec if v else ""),
            source_pix_fmt=(v.pixel_format if v else None),
            want_video_codecs=["h264"],
            max_height=max_height,
        )
        return {
            "name": profile.name,
            "video_codec": profile.video_codec,
            "audio_codec": profile.audio_codec,
            "preset": profile.preset,
            "hwaccel": profile.hwaccel,
            "max_height": profile.max_height,
            "reason": profile.reason,
        }

    @router.get("/items/{item_id}/subtitles")
    async def list_subtitles(item_id: str, user: UserContext = Depends(_require_user)):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        tracks = []
        for s in it.subtitle_streams:
            kind = classify_subtitle(s.codec)
            tracks.append({
                "index": s.index,
                "codec": s.codec,
                "language": s.language,
                "default": s.default,
                "forced": s.forced,
                "kind": kind,
                "deliverable_as_webvtt": kind == "text",
                "notes": (
                    "Text subtitle — converted to WebVTT on request." if kind == "text" else
                    "Image-based subtitle (PGS/VobSub). WebVTT is a TEXT format; direct conversion is not possible without OCR. "
                    "Native Locat Windows/Android adapter must render these in a hardware subtitle overlay."
                    if kind == "image" else
                    "Unknown subtitle codec — browser-side rendering not supported."
                ),
            })
        return {"item_id": item_id, "tracks": tracks}

    @router.get("/items/{item_id}/subtitles/{index}.vtt")
    async def subtitle_vtt(item_id: str, index: int, user: UserContext = Depends(_require_user)):
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        if not storage.is_authorized_path(it.path):
            raise HTTPException(status_code=403, detail="Media path not authorized")
        stream = next((s for s in it.subtitle_streams if s.index == index), None)
        if stream is None:
            raise HTTPException(status_code=404, detail="Subtitle stream not found")
        kind = classify_subtitle(stream.codec)
        if kind == "image":
            raise HTTPException(
                status_code=415,
                detail=(
                    f"Subtitle stream {index} is image-based ({stream.codec}); WebVTT is a text format. "
                    "Direct conversion requires OCR and is intentionally not performed by this server. "
                    "Use a native Locat adapter that can overlay the original bitmaps instead."
                ),
            )
        vtt = await extract_subtitle_as_webvtt(Path(it.path), index, stream.codec)
        if vtt is None:
            raise HTTPException(status_code=500, detail="Failed to extract subtitle")
        from starlette.responses import Response as _Resp
        return _Resp(content=vtt, media_type="text/vtt; charset=utf-8")

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

    # ---------------- Series rollups ----------------

    @router.get("/series")
    async def list_series(user: UserContext = Depends(_require_user)):
        """Aggregate episodes by series name + season."""
        episodes = await persistence.list_items(media_type="episode", limit=5000)
        series_map: dict = {}
        for ep in episodes:
            name = ep.series_name or "(Unknown Series)"
            s = series_map.setdefault(name, {
                "series_name": name,
                "seasons": {},
                "episode_count": 0,
                "last_watched_at": None,
            })
            s["episode_count"] += 1
            season_key = ep.season_number or 1
            season = s["seasons"].setdefault(season_key, {
                "season_number": season_key,
                "episodes": [],
            })
            season["episodes"].append({
                "id": ep.id,
                "title": ep.title or f"Episode {ep.episode_number or len(season['episodes']) + 1}",
                "season_number": ep.season_number,
                "episode_number": ep.episode_number,
                "duration_seconds": ep.duration_seconds,
                "last_position_seconds": ep.last_position_seconds,
                "play_count": ep.play_count,
                "favorite": ep.favorite,
                "poster_url": ep.poster_url,
            })
            if ep.last_played_at and (s["last_watched_at"] is None or
                                       ep.last_played_at.isoformat() > s["last_watched_at"]):
                s["last_watched_at"] = ep.last_played_at.isoformat()

        series_out = []
        for s in series_map.values():
            seasons = sorted(s["seasons"].values(), key=lambda x: x["season_number"])
            for season in seasons:
                season["episodes"].sort(key=lambda e: (e["episode_number"] or 0))
            series_out.append({
                "series_name": s["series_name"],
                "episode_count": s["episode_count"],
                "season_count": len(seasons),
                "seasons": seasons,
                "last_watched_at": s["last_watched_at"],
            })
        series_out.sort(key=lambda x: x["series_name"].lower())
        return series_out

    @router.get("/series/{series_name}")
    async def get_series(series_name: str, user: UserContext = Depends(_require_user)):
        all_series = await list_series(user)  # type: ignore[arg-type]
        for s in all_series:
            if s["series_name"].lower() == series_name.lower():
                return s
        raise HTTPException(status_code=404, detail="Series not found")

    @router.get("/items/{item_id}/next-episode")
    async def next_episode(item_id: str, user: UserContext = Depends(_require_user)):
        current = await persistence.get_item(item_id)
        if not current or current.media_type != MediaType.EPISODE:
            raise HTTPException(status_code=404, detail="Item is not an episode")
        episodes = await persistence.list_items(media_type="episode", limit=5000)
        same_series = [
            e for e in episodes
            if (e.series_name or "").lower() == (current.series_name or "").lower()
        ]
        same_series.sort(key=lambda e: (e.season_number or 0, e.episode_number or 0))
        for i, ep in enumerate(same_series):
            if ep.id == current.id and i + 1 < len(same_series):
                nxt = same_series[i + 1]
                return nxt.model_dump(mode="json")
        return None

    # ---------------- Playback info panel ----------------

    @router.get("/items/{item_id}/info")
    async def item_info(item_id: str, user: UserContext = Depends(_require_user)):
        """Rich expandable info for the player panel.

        Everything is sourced from ffprobe/mutagen or the live diagnostics
        registry — no fabricated values.
        """
        it = await persistence.get_item(item_id)
        if not it:
            raise HTTPException(status_code=404, detail="Item not found")
        v = it.video_streams[0] if it.video_streams else None
        a = it.audio_streams[0] if it.audio_streams else None
        hw = await probe_ffmpeg_capabilities()
        info = {
            "filename": Path(it.path).name,
            "container": it.container,
            "file_size": it.size_bytes,
            "duration_seconds": it.duration_seconds,
            "video": v.model_dump(mode="json") if v else None,
            "audio_tracks": [s.model_dump(mode="json") for s in it.audio_streams],
            "subtitle_tracks": [s.model_dump(mode="json") for s in it.subtitle_streams],
            "hdr": {
                "format": v.hdr if v else None,
                "color_space": v.color_space if v else None,
                "color_transfer": v.color_transfer if v else None,
                "color_primaries": v.color_primaries if v else None,
                "mastering_display": v.mastering_display if v else None,
            } if v else None,
            "last_position_seconds": it.last_position_seconds,
            "ffmpeg": {
                "version": hw.ffmpeg_version,
                "nvenc_available": hw.nvenc_available,
                "nvdec_available": hw.nvdec_available,
                "hwaccels": hw.hwaccels,
            },
        }
        return info

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
        from locat_media_core import EqBand as _EqBand, ParametricFilter as _ParametricFilter
        import uuid as _uuid
        preset = EqPreset(
            id=body.id or _uuid.uuid4().hex,
            name=body.name,
            bands_mode=body.bands_mode,
            preamp_db=body.preamp_db,
            bands=[_EqBand(frequency_hz=b.frequency_hz, gain_db=b.gain_db) for b in body.bands],
            parametric=[_ParametricFilter(**p.model_dump()) for p in body.parametric],
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

    # ---------------- Telemetry / Performance Monitor ----------------

    @router.get("/telemetry/overview")
    async def telemetry_overview(user: UserContext = Depends(_require_user)):
        return telemetry.overview()

    @router.get("/telemetry/cinema")
    async def telemetry_cinema(user: UserContext = Depends(_require_user)):
        return telemetry.cinema()

    @router.get("/telemetry/music")
    async def telemetry_music(user: UserContext = Depends(_require_user)):
        caps = await audio_mode_service.capabilities(runtime=host.runtime_name)
        return {
            "capabilities": caps.model_dump(mode="json"),
            **telemetry.music(audio_mode_service),
        }

    @router.get("/telemetry/network")
    async def telemetry_network(user: UserContext = Depends(_require_user)):
        return telemetry.network()

    @router.get("/telemetry/server")
    async def telemetry_server(user: UserContext = Depends(_require_user)):
        hw = await probe_ffmpeg_capabilities()
        return {
            "ffmpeg_version": hw.ffmpeg_version,
            "hwaccels": hw.hwaccels,
            "nvenc_available": hw.nvenc_available,
            "nvdec_available": hw.nvdec_available,
            "active_sessions": diagnostics.active_count(),
        }

    @router.get("/telemetry/history")
    async def telemetry_history(user: UserContext = Depends(_require_user)):
        return telemetry.history()

    class ClientTelemetryBody(BaseModel):
        session_id: str
        buffered_seconds: Optional[float] = None
        dropped_frames: Optional[int] = None
        bytes_received_last_second: Optional[int] = None
        notes: Optional[str] = None

    @router.post("/telemetry/client")
    async def ingest_client_telemetry(
        body: ClientTelemetryBody,
        user: UserContext = Depends(_require_user),
    ):
        """The browser/native client POSTs its own measurements here.

        Server never fabricates FPS/latency/dropped frames; it accepts
        them from the real playing client.
        """
        session = diagnostics.get_session(body.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Unknown session")
        snap = diagnostics.get_diagnostics(body.session_id) or None
        from locat_media_core import DiagnosticsSnapshot
        if snap is None:
            snap = DiagnosticsSnapshot(session_id=body.session_id, item_id=session.item_id)
        if body.buffered_seconds is not None:
            snap.buffered_seconds = body.buffered_seconds
        if body.dropped_frames is not None:
            snap.dropped_frames = body.dropped_frames
        if body.notes:
            if body.notes not in snap.notes:
                snap.notes.append(body.notes)
        diagnostics.set_diagnostics(snap)
        return {"ok": True}

    return router
