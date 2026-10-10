"""Pydantic models shared between Cinema, Music, and the media server."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid

from pydantic import BaseModel, Field, ConfigDict

from .types import MediaType, PlaybackPathType, ScanStatus, AudioModeKind, BitPerfectStatus


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class _MediaBase(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ---------- Library ----------

class MediaLibrary(_MediaBase):
    id: str = Field(default_factory=_uid)
    name: str
    root_path: str
    kind: MediaType = MediaType.UNKNOWN  # "movie" library, "music" library, etc.
    scan_status: ScanStatus = ScanStatus.IDLE
    last_scanned_at: Optional[datetime] = None
    item_count: int = 0
    created_at: datetime = Field(default_factory=_now)


class LibraryScanReport(_MediaBase):
    library_id: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    scanned_files: int = 0
    indexed_items: int = 0
    skipped_files: int = 0
    errors: List[str] = Field(default_factory=list)
    status: ScanStatus = ScanStatus.SCANNING


# ---------- Streams ----------

class VideoStreamInfo(_MediaBase):
    codec: str                   # h264, hevc, av1, vp9...
    width: int
    height: int
    bit_rate: Optional[int] = None  # bits/sec
    fps: Optional[float] = None
    pixel_format: Optional[str] = None
    hdr: Optional[str] = None    # None, "hdr10", "hlg", "dovi"
    profile: Optional[str] = None
    level: Optional[str] = None


class AudioStreamInfo(_MediaBase):
    codec: str                   # aac, ac3, eac3, flac, dts, truehd, mp3...
    channels: int
    channel_layout: Optional[str] = None
    sample_rate: int
    bit_depth: Optional[int] = None
    bit_rate: Optional[int] = None
    language: Optional[str] = None
    default: bool = False


class SubtitleStreamInfo(_MediaBase):
    codec: str                   # srt, ass, pgs, webvtt...
    language: Optional[str] = None
    forced: bool = False
    default: bool = False
    index: int = 0


# ---------- Media items ----------

class MediaItem(_MediaBase):
    id: str = Field(default_factory=_uid)
    library_id: str
    media_type: MediaType
    path: str                    # absolute canonical path
    size_bytes: int
    container: str               # mkv, mp4, flac...
    duration_seconds: Optional[float] = None
    mtime: float = 0.0

    # Movie / show metadata
    title: str = ""
    year: Optional[int] = None
    series_name: Optional[str] = None
    season_number: Optional[int] = None
    episode_number: Optional[int] = None
    overview: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    genres: List[str] = Field(default_factory=list)

    # Streams
    video_streams: List[VideoStreamInfo] = Field(default_factory=list)
    audio_streams: List[AudioStreamInfo] = Field(default_factory=list)
    subtitle_streams: List[SubtitleStreamInfo] = Field(default_factory=list)

    # Watch state
    favorite: bool = False
    play_count: int = 0
    last_position_seconds: float = 0.0
    last_played_at: Optional[datetime] = None

    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ---------- Music ----------

class MusicTrack(_MediaBase):
    id: str = Field(default_factory=_uid)
    library_id: str
    path: str
    size_bytes: int
    container: str
    mtime: float = 0.0

    title: str = ""
    artist: str = ""
    album_artist: str = ""
    album: str = ""
    composer: str = ""
    genre: str = ""
    year: Optional[int] = None
    track_number: Optional[int] = None
    disc_number: Optional[int] = None
    duration_seconds: Optional[float] = None

    audio: Optional[AudioStreamInfo] = None
    cover_art_mime: Optional[str] = None  # image/jpeg...
    has_embedded_cover: bool = False
    replaygain_track_gain_db: Optional[float] = None
    replaygain_album_gain_db: Optional[float] = None

    favorite: bool = False
    play_count: int = 0
    last_played_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class Playlist(_MediaBase):
    id: str = Field(default_factory=_uid)
    name: str
    track_ids: List[str] = Field(default_factory=list)
    description: str = ""
    smart: bool = False
    rules: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


# ---------- EQ ----------

class EqBand(_MediaBase):
    frequency_hz: float
    gain_db: float = 0.0


class ParametricFilter(_MediaBase):
    kind: str                    # peaking | lowshelf | highshelf | lowpass | highpass | notch
    frequency_hz: float
    gain_db: float = 0.0
    q: float = 1.0
    enabled: bool = True


class EqPreset(_MediaBase):
    id: str = Field(default_factory=_uid)
    name: str
    bands_mode: str = "10"       # "10" | "15" | "31"
    preamp_db: float = 0.0
    bands: List[EqBand] = Field(default_factory=list)
    parametric: List[ParametricFilter] = Field(default_factory=list)
    replaygain_mode: str = "off"  # off | track | album
    limiter_enabled: bool = False
    balance: float = 0.0         # -1..+1
    bypass: bool = False
    output_device_id: Optional[str] = None  # per-device presets
    is_builtin: bool = False
    created_at: datetime = Field(default_factory=_now)


# ---------- Playback engine outputs ----------

class PlaybackDecision(_MediaBase):
    item_id: str
    path_type: PlaybackPathType
    reason: str
    direct_play_url: Optional[str] = None
    direct_stream_url: Optional[str] = None
    transcode_profile: Optional[str] = None
    selected_video_stream: Optional[int] = None
    selected_audio_stream: Optional[int] = None
    selected_subtitle_stream: Optional[int] = None
    warnings: List[str] = Field(default_factory=list)


class PlaybackSession(_MediaBase):
    id: str = Field(default_factory=_uid)
    item_id: str
    started_at: datetime = Field(default_factory=_now)
    client_id: Optional[str] = None
    client_info: Dict[str, Any] = Field(default_factory=dict)
    bytes_served: int = 0
    stalls: int = 0
    last_range_start: int = 0
    last_range_end: int = 0
    is_active: bool = True


class DiagnosticsSnapshot(_MediaBase):
    session_id: str
    item_id: str
    resolution: Optional[str] = None
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    path_type: PlaybackPathType = PlaybackPathType.DIRECT_PLAY
    source_bitrate_bps: Optional[int] = None
    estimated_network_bps: Optional[int] = None
    buffered_seconds: Optional[float] = None
    stalls: int = 0
    dropped_frames: Optional[int] = None
    decoder: Optional[str] = None
    transcoding_speed: Optional[float] = None
    notes: List[str] = Field(default_factory=list)


class AudioOutputCapabilities(_MediaBase):
    """Honest reporting of the host audio output abilities.

    The web dev preview intentionally reports UNAVAILABLE for bit-perfect
    because WebAudio resamples to the AudioContext rate. A native Windows
    (WASAPI exclusive) or Android AAudio adapter is required to upgrade to
    UNVERIFIED or VERIFIED.
    """

    runtime: str                                # "web" | "windows" | "android"
    device_name: Optional[str] = None
    output_sample_rate: Optional[int] = None
    output_bit_depth: Optional[int] = None
    supports_exclusive: bool = False
    supports_bit_perfect: bool = False
    bit_perfect: BitPerfectStatus = BitPerfectStatus.UNAVAILABLE
    reason: str = ""
    active_mode: AudioModeKind = AudioModeKind.ENHANCED_DSP
    dsp_enabled: bool = True
    resampling_detected: Optional[bool] = None
