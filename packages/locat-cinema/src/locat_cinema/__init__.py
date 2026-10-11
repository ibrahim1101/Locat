"""locat_cinema — movie/show indexing, Direct Play decision, HTTP range streaming."""
from .indexer import CinemaIndexer, VIDEO_EXTENSIONS
from .playback import ClientCapabilities, PlaybackDecider
from .streaming import RangeStreamer, parse_range_header
from .remux import FfmpegRemuxWorker, FfmpegRemuxError
from .transcode import FfmpegTranscodeWorker, TranscodeProfile, TranscodeError, select_profile
from .subtitles import classify_subtitle, extract_subtitle_as_webvtt

__all__ = [
    "CinemaIndexer",
    "VIDEO_EXTENSIONS",
    "ClientCapabilities",
    "PlaybackDecider",
    "RangeStreamer",
    "parse_range_header",
    "FfmpegRemuxWorker",
    "FfmpegRemuxError",
    "FfmpegTranscodeWorker",
    "TranscodeProfile",
    "TranscodeError",
    "select_profile",
    "classify_subtitle",
    "extract_subtitle_as_webvtt",
]
