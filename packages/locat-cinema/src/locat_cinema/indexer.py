"""Cinema media indexer. Uses ffprobe to extract codec, resolution, duration."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

from locat_media_core import (
    MediaItem,
    MediaType,
    VideoStreamInfo,
    AudioStreamInfo,
    SubtitleStreamInfo,
)
from locat_media_adapters.storage import StorageAdapter

logger = logging.getLogger("locat_cinema.indexer")

VIDEO_EXTENSIONS = (
    "mkv", "mp4", "mov", "webm", "avi", "m4v", "ts", "m2ts",
)

_FFPROBE = shutil.which("ffprobe") or "ffprobe"

# Loose patterns to pull "Title (Year)" and SxxEyy from filenames.
_RE_YEAR = re.compile(r"[\(\.\s](19|20)\d{2}[\)\.\s]")
_RE_EPISODE = re.compile(r"[Ss](\d{1,2})[Ee](\d{1,3})")
_RE_CLEAN = re.compile(r"[._]+")


def _parse_title(path: Path) -> Tuple[str, Optional[int], Optional[int], Optional[int], Optional[str]]:
    """Return (title, year, season, episode, series_name).

    Metadata is best-effort and offline — Locat's optional metadata
    provider can enrich later via a background job.
    """
    stem = path.stem
    stem_clean = _RE_CLEAN.sub(" ", stem).strip()

    year = None
    m = _RE_YEAR.search(f" {stem_clean} ")
    if m:
        year = int(m.group(0).strip("() .\t"))
        stem_clean = _RE_CLEAN.sub(" ", stem_clean[: m.start()]).strip(" .-_()") or stem_clean

    season = episode = None
    series_name = None
    m2 = _RE_EPISODE.search(stem_clean)
    if m2:
        season = int(m2.group(1))
        episode = int(m2.group(2))
        series_name = stem_clean[: m2.start()].strip(" -_.") or path.parent.name
        title = stem_clean[m2.end():].strip(" -_.") or f"Episode {episode}"
    else:
        title = stem_clean.strip(" -_.()[]{}")

    return (title or path.stem), year, season, episode, series_name


async def _run_ffprobe(path: Path) -> Optional[dict]:
    cmd = [
        _FFPROBE,
        "-v", "error",
        "-show_entries", "format=duration,bit_rate,size,format_name:stream=index,codec_type,codec_name,width,height,bit_rate,r_frame_rate,pix_fmt,profile,level,channels,channel_layout,sample_rate,bits_per_raw_sample,bits_per_sample,disposition,tags",
        "-of", "json",
        str(path),
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            logger.warning("ffprobe failed for %s: %s", path, err.decode(errors="ignore")[:200])
            return None
        return json.loads(out.decode("utf-8", errors="ignore") or "{}")
    except FileNotFoundError:
        logger.error("ffprobe not available on PATH")
        return None
    except asyncio.TimeoutError:
        logger.warning("ffprobe timeout for %s", path)
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning("ffprobe error for %s: %s", path, e)
        return None


def _fps_from_rate(rate: str) -> Optional[float]:
    if not rate or rate == "0/0":
        return None
    try:
        if "/" in rate:
            n, d = rate.split("/", 1)
            n, d = float(n), float(d)
            return n / d if d else None
        return float(rate)
    except (TypeError, ValueError):
        return None


def _hdr_from_pixfmt(pix_fmt: Optional[str]) -> Optional[str]:
    if not pix_fmt:
        return None
    pf = pix_fmt.lower()
    if "p10" in pf or "yuv420p10" in pf:
        return "hdr10"
    return None


class CinemaIndexer:
    """Index a filesystem library root into MediaItem records."""

    def __init__(self, storage: StorageAdapter) -> None:
        self.storage = storage

    async def index_library(self, library_id: str, root: Path) -> List[MediaItem]:
        if not self.storage.is_authorized_path(str(root)):
            raise PermissionError(f"Library root {root} is not authorized")
        files = list(self.storage.iter_files(root, VIDEO_EXTENSIONS))
        items: List[MediaItem] = []
        # ffprobe calls are I/O-bound; run with a modest concurrency cap.
        sem = asyncio.Semaphore(4)

        async def _probe_one(fp: Path) -> Optional[MediaItem]:
            async with sem:
                return await self._index_file(library_id, fp)

        results = await asyncio.gather(*[_probe_one(fp) for fp in files])
        for r in results:
            if r:
                items.append(r)
        return items

    async def _index_file(self, library_id: str, fp: Path) -> Optional[MediaItem]:
        try:
            st = fp.stat()
        except OSError:
            return None
        probe = await _run_ffprobe(fp)
        container = (probe or {}).get("format", {}).get("format_name", "") or ""
        ext = fp.suffix.lower().lstrip(".")
        # ffprobe reports format_name as a comma-list for multi-format
        # containers (e.g. "mov,mp4,m4a,3gp,3g2,mj2"). Prefer the extension
        # when it appears in that list so Direct Play decisions line up
        # with what the client sees.
        if container:
            parts = [p.strip() for p in container.split(",") if p.strip()]
            container = ext if ext in parts else parts[0]
        else:
            container = ext
        duration = None
        bit_rate = None
        if probe and "format" in probe:
            try:
                duration = float(probe["format"].get("duration")) if probe["format"].get("duration") else None
            except (TypeError, ValueError):
                duration = None
            try:
                bit_rate = int(probe["format"].get("bit_rate")) if probe["format"].get("bit_rate") else None
            except (TypeError, ValueError):
                bit_rate = None

        v_streams, a_streams, s_streams = [], [], []
        for s in (probe or {}).get("streams", []):
            ctype = s.get("codec_type")
            if ctype == "video":
                v_streams.append(VideoStreamInfo(
                    codec=s.get("codec_name", "") or "",
                    width=int(s.get("width") or 0),
                    height=int(s.get("height") or 0),
                    bit_rate=int(s["bit_rate"]) if s.get("bit_rate") else bit_rate,
                    fps=_fps_from_rate(s.get("r_frame_rate")),
                    pixel_format=s.get("pix_fmt"),
                    hdr=_hdr_from_pixfmt(s.get("pix_fmt")),
                    profile=str(s.get("profile")) if s.get("profile") else None,
                    level=str(s.get("level")) if s.get("level") else None,
                ))
            elif ctype == "audio":
                a_streams.append(AudioStreamInfo(
                    codec=s.get("codec_name", "") or "",
                    channels=int(s.get("channels") or 0),
                    channel_layout=s.get("channel_layout"),
                    sample_rate=int(s.get("sample_rate") or 0),
                    bit_depth=int(s["bits_per_raw_sample"]) if s.get("bits_per_raw_sample") else (
                        int(s["bits_per_sample"]) if s.get("bits_per_sample") else None),
                    bit_rate=int(s["bit_rate"]) if s.get("bit_rate") else None,
                    language=(s.get("tags") or {}).get("language"),
                    default=bool((s.get("disposition") or {}).get("default")),
                ))
            elif ctype == "subtitle":
                s_streams.append(SubtitleStreamInfo(
                    codec=s.get("codec_name", "") or "",
                    language=(s.get("tags") or {}).get("language"),
                    forced=bool((s.get("disposition") or {}).get("forced")),
                    default=bool((s.get("disposition") or {}).get("default")),
                    index=int(s.get("index") or 0),
                ))

        title, year, season, episode, series_name = _parse_title(fp)
        media_type = MediaType.EPISODE if season is not None else MediaType.MOVIE

        return MediaItem(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"locat-media:{library_id}:{fp.resolve()}")),
            library_id=library_id,
            media_type=media_type,
            path=str(fp.resolve()),
            size_bytes=st.st_size,
            container=container,
            duration_seconds=duration,
            mtime=st.st_mtime,
            title=title,
            year=year,
            series_name=series_name,
            season_number=season,
            episode_number=episode,
            video_streams=v_streams,
            audio_streams=a_streams,
            subtitle_streams=s_streams,
        )
