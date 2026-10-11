"""locat_media_core — shared types, models, and persistence contracts.

This package is the single source of truth for data shapes used by
Locat Cinema, Locat Music, and the Locat media server. It intentionally
has NO FastAPI, NO Mongo client, and NO filesystem dependency so it can
be reused inside the Locat Windows host, Android bridge, or future
runtimes without pulling the whole server in.
"""
from .types import MediaType, PlaybackPathType, AudioModeKind, ScanStatus, BitPerfectStatus
from .models import (
    MediaLibrary,
    MediaItem,
    VideoStreamInfo,
    AudioStreamInfo,
    SubtitleStreamInfo,
    MusicTrack,
    Playlist,
    EqPreset,
    EqBand,
    ParametricFilter,
    PlaybackDecision,
    PlaybackSession,
    DiagnosticsSnapshot,
    AudioOutputCapabilities,
    LibraryScanReport,
)
from .persistence import MediaPersistence

__all__ = [
    "MediaType",
    "PlaybackPathType",
    "AudioModeKind",
    "ScanStatus",
    "BitPerfectStatus",
    "MediaLibrary",
    "MediaItem",
    "VideoStreamInfo",
    "AudioStreamInfo",
    "SubtitleStreamInfo",
    "MusicTrack",
    "Playlist",
    "EqPreset",
    "EqBand",
    "ParametricFilter",
    "PlaybackDecision",
    "PlaybackSession",
    "DiagnosticsSnapshot",
    "AudioOutputCapabilities",
    "LibraryScanReport",
    "MediaPersistence",
]
