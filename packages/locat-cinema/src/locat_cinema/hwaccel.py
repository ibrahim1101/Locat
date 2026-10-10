"""Hardware acceleration + codec compatibility discovery.

Probes the installed ffmpeg once for ``-hwaccels`` and ``-encoders`` and
caches the result. All methods are safe to call before any media is
indexed.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
from dataclasses import dataclass, field
from functools import lru_cache
from typing import List, Optional, Set, Tuple

logger = logging.getLogger("locat_cinema.hwaccel")

_FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


@dataclass
class FfmpegCapabilities:
    ffmpeg_version: str = ""
    hwaccels: List[str] = field(default_factory=list)
    nvenc_available: bool = False
    nvdec_available: bool = False
    vaapi_available: bool = False
    qsv_available: bool = False
    videotoolbox_available: bool = False
    encoders: List[str] = field(default_factory=list)
    decoders: List[str] = field(default_factory=list)
    muxers: List[str] = field(default_factory=list)
    demuxers: List[str] = field(default_factory=list)


async def _run(cmd: List[str]) -> Tuple[int, str, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    return proc.returncode or 0, out.decode(errors="ignore"), err.decode(errors="ignore")


_cached: Optional[FfmpegCapabilities] = None


async def probe_ffmpeg_capabilities() -> FfmpegCapabilities:
    global _cached
    if _cached is not None:
        return _cached
    caps = FfmpegCapabilities()
    try:
        _, ver_out, _ = await _run([_FFMPEG, "-version"])
        first = ver_out.splitlines()[0] if ver_out else ""
        caps.ffmpeg_version = first.strip()
    except FileNotFoundError:
        logger.warning("ffmpeg not on PATH; hwaccel probe skipped")
        _cached = caps
        return caps

    try:
        _, hw_out, _ = await _run([_FFMPEG, "-hide_banner", "-hwaccels"])
        caps.hwaccels = [l.strip() for l in hw_out.splitlines() if l.strip() and ":" not in l]
    except Exception:  # noqa: BLE001
        caps.hwaccels = []

    caps.nvdec_available = "cuda" in caps.hwaccels or "nvdec" in caps.hwaccels
    caps.vaapi_available = "vaapi" in caps.hwaccels
    caps.qsv_available = "qsv" in caps.hwaccels
    caps.videotoolbox_available = "videotoolbox" in caps.hwaccels

    try:
        _, enc_out, _ = await _run([_FFMPEG, "-hide_banner", "-encoders"])
        encs: Set[str] = set()
        for line in enc_out.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[0].startswith(("V", "A", "S")):
                encs.add(parts[1])
        caps.encoders = sorted(encs)
        caps.nvenc_available = any(e for e in encs if "nvenc" in e)
    except Exception:  # noqa: BLE001
        caps.encoders = []

    _cached = caps
    return caps


@lru_cache(maxsize=1)
def common_container_matrix() -> List[dict]:
    """A static, well-known compatibility matrix used alongside the probe
    results. The server reports this verbatim; the client is expected to
    cross-check against its own `canPlayType` / MediaCodec table."""
    return [
        {"container": "mp4", "video": ["h264", "hevc", "av1"], "audio": ["aac", "ac3", "eac3", "alac", "mp3"], "notes": "Universal browser/mobile Direct Play when codecs match."},
        {"container": "mkv", "video": ["h264", "hevc", "av1", "vp9"], "audio": ["aac", "ac3", "eac3", "flac", "truehd", "dts"], "notes": "Browsers typically require remux to fragmented MP4."},
        {"container": "webm", "video": ["vp8", "vp9", "av1"], "audio": ["opus", "vorbis"], "notes": "Browser-friendly open container."},
        {"container": "mov", "video": ["h264", "hevc", "prores"], "audio": ["aac", "pcm", "alac"], "notes": "QuickTime; ProRes needs native host or transcode."},
        {"container": "avi", "video": ["mpeg4", "divx", "h264"], "audio": ["mp3", "ac3"], "notes": "Legacy; typically needs remux."},
        {"container": "ts/m2ts", "video": ["h264", "hevc"], "audio": ["ac3", "eac3", "aac"], "notes": "Broadcast/Blu-ray; remux to MP4 for browsers."},
        {"container": "wmv/asf", "video": ["wmv2", "wmv3", "vc1"], "audio": ["wmav2"], "notes": "Requires full transcode for most clients."},
        {"container": "flv", "video": ["h264", "flv1"], "audio": ["aac", "mp3"], "notes": "Remux for broader support."},
        {"container": "3gp", "video": ["h264", "mpeg4"], "audio": ["aac", "amr_nb"], "notes": "Mobile legacy."},
        {"container": "ogv", "video": ["theora"], "audio": ["vorbis", "opus"], "notes": "Needs transcode on most clients."},
    ]
