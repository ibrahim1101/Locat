"""Subtitle extraction + delivery.

Serves text subtitles (SRT / ASS / SSA) as WebVTT for browser <track>
elements, and reports PGS/VobSub tracks as "image-based: native
rendering required" — we do NOT fake OCR conversion.
"""
from __future__ import annotations

import asyncio
import logging
import re
import shutil
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("locat_cinema.subtitles")

_FFMPEG = shutil.which("ffmpeg") or "ffmpeg"

# Codec classification
TEXT_SUB_CODECS = {"subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"}
IMAGE_SUB_CODECS = {"hdmv_pgs_subtitle", "pgs", "dvd_subtitle", "dvb_subtitle", "vobsub"}


def classify_subtitle(codec: str) -> str:
    """Return 'text' | 'image' | 'unknown'."""
    c = (codec or "").lower()
    if c in TEXT_SUB_CODECS:
        return "text"
    if c in IMAGE_SUB_CODECS:
        return "image"
    return "unknown"


def _srt_to_vtt(srt_body: str) -> str:
    """Convert an SRT body to WebVTT. Preserves cue text verbatim; only
    the header and comma→period timestamp separators are changed."""
    body = srt_body.replace("\r\n", "\n").replace("\r", "\n")
    # SRT timestamps use `,` for ms; VTT requires `.`
    body = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{3})", r"\1.\2", body)
    return "WEBVTT\n\n" + body.lstrip("\n")


async def extract_subtitle_as_webvtt(source: Path, stream_index: int, codec: str) -> Optional[str]:
    """Extract a text subtitle track and return it as WebVTT.

    Returns None for image-based subtitles (caller must fall back to the
    native-adapter rendering path or decline the request).
    """
    kind = classify_subtitle(codec)
    if kind != "text":
        return None

    # Ask ffmpeg to transcode to webvtt directly. Works for srt/ass/mov_text.
    cmd = [
        _FFMPEG, "-hide_banner", "-loglevel", "error",
        "-i", str(source),
        "-map", f"0:{stream_index}",
        "-c:s", "webvtt",
        "-f", "webvtt",
        "pipe:1",
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=20)
        if proc.returncode == 0 and out:
            txt = out.decode("utf-8", errors="ignore")
            if txt.strip().startswith("WEBVTT"):
                return txt
            return _srt_to_vtt(txt)
    except (asyncio.TimeoutError, FileNotFoundError) as e:
        logger.warning("subtitle extract failed: %s", e)
    return None
