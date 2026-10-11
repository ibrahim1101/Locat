"""Music indexer. Reads tags with mutagen (pure Python, no ffmpeg needed)."""
from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path
from typing import List, Optional

import mutagen
from mutagen.flac import FLAC, Picture
from mutagen.id3 import ID3
from mutagen.mp4 import MP4
from mutagen.oggvorbis import OggVorbis
from mutagen.oggopus import OggOpus

from locat_media_core import MusicTrack, AudioStreamInfo
from locat_media_adapters.storage import StorageAdapter

logger = logging.getLogger("locat_music.indexer")

AUDIO_EXTENSIONS = (
    "flac", "wav", "alac", "m4a", "mp3", "aac", "ogg", "opus",
    "aiff", "aif", "wma", "ape", "wv", "dsf", "dff",
)

_CODEC_BY_EXT = {
    "flac": "flac",
    "wav": "pcm",
    "alac": "alac",
    "m4a": "aac",
    "mp3": "mp3",
    "aac": "aac",
    "ogg": "vorbis",
    "opus": "opus",
    "aiff": "pcm",
    "aif": "pcm",
}


def _first(tag):
    if not tag:
        return ""
    if isinstance(tag, (list, tuple)):
        return str(tag[0]) if tag else ""
    return str(tag)


def _parse_int(value) -> Optional[int]:
    try:
        s = _first(value)
        if "/" in s:
            s = s.split("/", 1)[0]
        return int(s) if s else None
    except (TypeError, ValueError):
        return None


class MusicIndexer:
    def __init__(self, storage: StorageAdapter) -> None:
        self.storage = storage

    async def index_library(self, library_id: str, root: Path) -> List[MusicTrack]:
        if not self.storage.is_authorized_path(str(root)):
            raise PermissionError(f"Library root {root} is not authorized")
        files = list(self.storage.iter_files(root, AUDIO_EXTENSIONS))
        out: List[MusicTrack] = []
        for fp in files:
            track = await asyncio.to_thread(self._index_one, library_id, fp)
            if track is not None:
                out.append(track)
        return out

    def _index_one(self, library_id: str, fp: Path) -> Optional[MusicTrack]:
        try:
            st = fp.stat()
        except OSError:
            return None
        container = fp.suffix.lower().lstrip(".")
        try:
            mf = mutagen.File(fp, easy=False)
        except Exception as e:  # noqa: BLE001
            logger.warning("mutagen failed for %s: %s", fp, e)
            mf = None

        audio = None
        duration = None
        has_cover = False
        cover_mime = None
        rg_track = rg_album = None
        title = fp.stem
        artist = album = album_artist = composer = genre = ""
        year = disc_number = track_number = None

        if mf is not None:
            try:
                info = mf.info
                duration = float(getattr(info, "length", 0.0)) or None
                audio = AudioStreamInfo(
                    codec=_CODEC_BY_EXT.get(container, container),
                    channels=int(getattr(info, "channels", 2) or 2),
                    sample_rate=int(getattr(info, "sample_rate", 0) or 0),
                    bit_depth=int(getattr(info, "bits_per_sample", 0) or 0) or None,
                    bit_rate=int(getattr(info, "bitrate", 0) or 0) or None,
                )
            except Exception:  # noqa: BLE001
                audio = None

            try:
                if isinstance(mf, FLAC):
                    tags = mf.tags or {}
                    title = _first(tags.get("title")) or title
                    artist = _first(tags.get("artist"))
                    album_artist = _first(tags.get("albumartist")) or artist
                    album = _first(tags.get("album"))
                    composer = _first(tags.get("composer"))
                    genre = _first(tags.get("genre"))
                    year = _parse_int(tags.get("date") or tags.get("year"))
                    track_number = _parse_int(tags.get("tracknumber"))
                    disc_number = _parse_int(tags.get("discnumber"))
                    rg_track = _parse_rg(_first(tags.get("replaygain_track_gain")))
                    rg_album = _parse_rg(_first(tags.get("replaygain_album_gain")))
                    if mf.pictures:
                        has_cover = True
                        cover_mime = mf.pictures[0].mime
                elif isinstance(mf, MP4):
                    tags = mf.tags or {}
                    title = _first(tags.get("\xa9nam")) or title
                    artist = _first(tags.get("\xa9ART"))
                    album_artist = _first(tags.get("aART")) or artist
                    album = _first(tags.get("\xa9alb"))
                    composer = _first(tags.get("\xa9wrt"))
                    genre = _first(tags.get("\xa9gen"))
                    year = _parse_int(tags.get("\xa9day"))
                    trkn = tags.get("trkn")
                    if trkn:
                        track_number = int(trkn[0][0]) if trkn[0] else None
                    disk = tags.get("disk")
                    if disk:
                        disc_number = int(disk[0][0]) if disk[0] else None
                    covr = tags.get("covr")
                    if covr:
                        has_cover = True
                        cover_mime = "image/jpeg"
                elif isinstance(mf, (OggVorbis, OggOpus)):
                    tags = mf.tags or {}
                    title = _first(tags.get("title")) or title
                    artist = _first(tags.get("artist"))
                    album_artist = _first(tags.get("albumartist")) or artist
                    album = _first(tags.get("album"))
                    composer = _first(tags.get("composer"))
                    genre = _first(tags.get("genre"))
                    year = _parse_int(tags.get("date"))
                    track_number = _parse_int(tags.get("tracknumber"))
                    disc_number = _parse_int(tags.get("discnumber"))
                elif isinstance(mf.tags, ID3):
                    tags = mf.tags
                    title = _first(tags.get("TIT2").text if tags.get("TIT2") else "") or title
                    artist = _first(tags.get("TPE1").text if tags.get("TPE1") else "")
                    album_artist = _first(tags.get("TPE2").text if tags.get("TPE2") else "") or artist
                    album = _first(tags.get("TALB").text if tags.get("TALB") else "")
                    composer = _first(tags.get("TCOM").text if tags.get("TCOM") else "")
                    genre = _first(tags.get("TCON").text if tags.get("TCON") else "")
                    year = _parse_int(tags.get("TDRC").text if tags.get("TDRC") else "")
                    trk = tags.get("TRCK")
                    if trk:
                        track_number = _parse_int(trk.text)
                    disc = tags.get("TPOS")
                    if disc:
                        disc_number = _parse_int(disc.text)
                    for frame in tags.values():
                        if frame.FrameID == "APIC":
                            has_cover = True
                            cover_mime = frame.mime
                            break
            except Exception as e:  # noqa: BLE001
                logger.debug("tag parse soft-fail %s: %s", fp, e)

        return MusicTrack(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, f"locat-music:{library_id}:{fp.resolve()}")),
            library_id=library_id,
            path=str(fp.resolve()),
            size_bytes=st.st_size,
            container=container,
            mtime=st.st_mtime,
            title=title,
            artist=artist,
            album_artist=album_artist or artist,
            album=album,
            composer=composer,
            genre=genre,
            year=year,
            track_number=track_number,
            disc_number=disc_number,
            duration_seconds=duration,
            audio=audio,
            has_embedded_cover=has_cover,
            cover_art_mime=cover_mime,
            replaygain_track_gain_db=rg_track,
            replaygain_album_gain_db=rg_album,
        )


def _parse_rg(value: str) -> Optional[float]:
    if not value:
        return None
    v = value.strip().lower().replace("db", "").strip()
    try:
        return float(v)
    except ValueError:
        return None
