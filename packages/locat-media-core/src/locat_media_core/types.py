"""Enum and string constant types used across Locat Media Hub."""
from __future__ import annotations

from enum import Enum


class MediaType(str, Enum):
    MOVIE = "movie"
    EPISODE = "episode"
    MUSIC = "music"
    UNKNOWN = "unknown"


class PlaybackPathType(str, Enum):
    DIRECT_PLAY = "direct_play"
    DIRECT_STREAM = "direct_stream"  # remux only, no re-encode
    TRANSCODE = "transcode"
    UNSUPPORTED = "unsupported"


class AudioModeKind(str, Enum):
    """User-facing audio playback mode selector for Locat Music."""

    PURE_AUDIO = "pure_audio"      # Bypass all DSP
    ENHANCED_DSP = "enhanced_dsp"  # EQ, ReplayGain, limiter, etc.


class ScanStatus(str, Enum):
    IDLE = "idle"
    SCANNING = "scanning"
    FAILED = "failed"
    DONE = "done"


class BitPerfectStatus(str, Enum):
    """Honest reporting of Pure Audio verification state.

    - VERIFIED is only reported when we have direct evidence the OS/driver
      exposes an exclusive / bypass path AND the active host/adapter
      confirmed the output rate and bit depth match the source.
    - UNVERIFIED means Pure Audio mode is engaged (DSP bypassed) but the
      runtime cannot prove the output path is sample-accurate (e.g. web
      preview, shared mixer, Bluetooth transport).
    - UNAVAILABLE means the runtime cannot deliver bit-perfect output
      (e.g. browser WebAudio, A2DP Bluetooth).
    """

    VERIFIED = "verified"
    UNVERIFIED = "unverified"
    UNAVAILABLE = "unavailable"
