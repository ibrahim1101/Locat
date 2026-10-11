"""Transcode worker (NVENC-first, CPU fallback).

Used when the Direct Play decider says ``path_type == 'transcode'`` —
i.e. the client cannot decode the source video codec AND remux cannot
save us. We pick an encoder based on the real ffmpeg capability probe:

* NVENC H.264 (``h264_nvenc``) when available and the hardware pipeline
  can actually accept the source pixel format. We DO NOT force NVENC
  for 10-bit HDR inputs with 8-bit output — that would silently kill HDR
  metadata.
* ``libx264 -preset veryfast`` CPU fallback otherwise.

Audio is stream-copied when the client accepts the source codec in MP4;
otherwise re-encoded to AAC 192 kbps.

The worker streams fragmented MP4 to the HTTP client, so playback starts
before the full encode completes. Transcode speed and progress are read
from ffmpeg's ``-progress pipe:2`` output and surfaced via the
diagnostics registry so the Performance tab shows real numbers (no
fabrication).
"""
from __future__ import annotations

import asyncio
import logging
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import AsyncIterator, List, Optional

from .hwaccel import probe_ffmpeg_capabilities

logger = logging.getLogger("locat_cinema.transcode")

_FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


@dataclass
class TranscodeProfile:
    name: str
    video_codec: str                    # h264_nvenc | libx264 | ...
    audio_codec: str                    # aac | copy | ...
    audio_bitrate: str = "192k"
    preset: str = "veryfast"
    hwaccel: Optional[str] = None       # cuda | None
    max_height: Optional[int] = None
    reason: str = ""


class TranscodeError(RuntimeError):
    pass


async def select_profile(
    *,
    source_codec: str,
    source_pix_fmt: Optional[str] = None,
    want_video_codecs: Optional[List[str]] = None,
    max_height: Optional[int] = None,
) -> TranscodeProfile:
    """Pick NVENC first when available AND safe for this source."""
    hw = await probe_ffmpeg_capabilities()
    want = {c.lower() for c in (want_video_codecs or ["h264"])}
    # Only consider NVENC for a target the client supports.
    nvenc_ok = (
        hw.nvenc_available
        and "h264" in want
        and "h264_nvenc" in (hw.encoders or ["h264_nvenc"])  # defensive
    )
    # NVENC supports 10-bit via -profile:v high10 only on recent gens.
    # Keep safety: if source is p10 HDR, fall back to CPU to avoid silently
    # dropping HDR metadata.
    is_10bit = source_pix_fmt and "p10" in source_pix_fmt.lower()
    if nvenc_ok and not is_10bit:
        return TranscodeProfile(
            name="h264-nvenc-mp4",
            video_codec="h264_nvenc",
            audio_codec="aac",
            preset="p4",
            hwaccel="cuda",
            max_height=max_height,
            reason="NVENC H.264 encoder selected — hardware accelerated.",
        )
    return TranscodeProfile(
        name="h264-cpu-mp4",
        video_codec="libx264",
        audio_codec="aac",
        preset="veryfast",
        max_height=max_height,
        reason=(
            "CPU libx264 selected — "
            + ("NVENC not available" if not hw.nvenc_available else
               "source is 10-bit; NVENC avoided to preserve bit depth")
            + "."
        ),
    )


class FfmpegTranscodeWorker:
    def __init__(self, chunk_size: int = 1024 * 128) -> None:
        self.chunk_size = chunk_size

    async def stream(
        self,
        path: Path,
        profile: TranscodeProfile,
        *,
        start_seconds: float = 0.0,
        on_bytes=None,
        on_progress=None,                # callable(dict) with "fps", "speed", ...
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        if not path.exists() or not path.is_file():
            raise TranscodeError(f"Source not found: {path}")

        pre_input: List[str] = []
        if profile.hwaccel:
            pre_input += ["-hwaccel", profile.hwaccel]
        if start_seconds and start_seconds > 0:
            pre_input += ["-ss", f"{start_seconds:.3f}"]

        scale_filter: List[str] = []
        if profile.max_height:
            scale_filter = ["-vf", f"scale=-2:{profile.max_height}"]

        cmd = [
            _FFMPEG,
            "-hide_banner", "-loglevel", "error",
            "-progress", "pipe:2",
            *pre_input,
            "-i", str(path),
            "-map", "0:v:0?",
            "-map", "0:a?",
            *scale_filter,
            "-c:v", profile.video_codec,
            "-preset", profile.preset,
            "-c:a", profile.audio_codec,
            "-b:a", profile.audio_bitrate,
            "-sn",
            "-movflags", "frag_keyframe+empty_moov+default_base_moof+delay_moov",
            "-f", "mp4",
            "pipe:1",
        ]
        logger.debug("transcode: %s", " ".join(cmd))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        progress: dict = {}

        async def _drain_progress() -> None:
            try:
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break
                    s = line.decode("utf-8", errors="ignore").strip()
                    if "=" in s:
                        k, v = s.split("=", 1)
                        progress[k.strip()] = v.strip()
                        if k.strip() == "progress" and on_progress:
                            try:
                                on_progress(dict(progress))
                            except Exception:  # noqa: BLE001
                                pass
            except Exception:  # noqa: BLE001
                pass

        progress_task = asyncio.create_task(_drain_progress())

        try:
            while True:
                if cancel_event is not None and cancel_event.is_set():
                    break
                chunk = await proc.stdout.read(self.chunk_size)
                if not chunk:
                    break
                if on_bytes:
                    try:
                        on_bytes(len(chunk))
                    except Exception:  # noqa: BLE001
                        pass
                yield chunk
        finally:
            if proc.returncode is None:
                try: proc.terminate()
                except ProcessLookupError: pass
                try:
                    await asyncio.wait_for(proc.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    try: proc.kill()
                    except ProcessLookupError: pass
            progress_task.cancel()
