"""Server-side remux worker.

Streams the ORIGINAL audio and video packets through ``ffmpeg -c copy``
into a fragmented MP4 container. No re-encoding happens — quality,
bitrate, HDR metadata, and (compatible) audio channels are preserved
byte-for-byte. The decider selects this path when the client cannot
handle the source *container* but can handle its elementary streams.
"""
from __future__ import annotations

import asyncio
import logging
import shutil
from pathlib import Path
from typing import AsyncIterator, Optional

logger = logging.getLogger("locat_cinema.remux")

_FFMPEG = shutil.which("ffmpeg") or "ffmpeg"


class FfmpegRemuxError(RuntimeError):
    pass


class FfmpegRemuxWorker:
    """Streams a stream-copy remux to the caller via chunked HTTP.

    - Uses fragmented MP4 (`-movflags frag_keyframe+empty_moov+default_base_moof`)
      so playback starts immediately without a moov seek.
    - Picks a compatible audio codec dynamically: audio is also `-c:a copy`
      unless the source codec cannot live inside MP4 (DTS, TrueHD, PGS, …),
      in which case the audio is transcoded to AAC *while the video stays
      a stream-copy*. The decider tells us which case we are in.
    - Server-side seeking: pass ``start_seconds`` which translates into
      ``-ss`` before ``-i`` for a fast keyframe seek.
    - Cancellation: killing the task awaits ``process.wait()`` after
      sending SIGTERM so no zombie ffmpeg lingers.
    """

    def __init__(self, chunk_size: int = 1024 * 128) -> None:
        self.chunk_size = chunk_size

    async def probe_audio_mp4_compat(self, path: Path) -> bool:
        """Return True if every audio stream can be stream-copied into MP4."""
        incompatible = {"dts", "truehd", "mlp", "pcm_bluray", "pgs"}
        # Lightweight probe via ffprobe
        import json as _json
        cmd = [shutil.which("ffprobe") or "ffprobe", "-v", "error",
               "-select_streams", "a", "-show_entries", "stream=codec_name",
               "-of", "json", str(path)]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, _ = await proc.communicate()
        try:
            data = _json.loads(out.decode("utf-8", errors="ignore") or "{}")
        except Exception:  # noqa: BLE001
            return True
        for s in data.get("streams", []):
            if (s.get("codec_name") or "").lower() in incompatible:
                return False
        return True

    async def stream(
        self,
        path: Path,
        *,
        start_seconds: float = 0.0,
        audio_codec_hint: Optional[str] = None,
        preserve_dovi: bool = False,
        on_bytes=None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncIterator[bytes]:
        if not path.exists() or not path.is_file():
            raise FfmpegRemuxError(f"Source not found: {path}")

        audio_copy = (audio_codec_hint == "copy") or await self.probe_audio_mp4_compat(path)
        audio_args = ["-c:a", "copy"] if audio_copy else ["-c:a", "aac", "-b:a", "192k"]

        pre_input = []
        if start_seconds and start_seconds > 0:
            pre_input = ["-ss", f"{start_seconds:.3f}"]

        # Dolby Vision preservation: when the source is a DoVi-tagged
        # HEVC track inside MKV, we tag the output video stream as hvc1
        # so a DoVi-capable player can still see the RPU payload. We do
        # NOT re-encode. For non-DoVi sources this flag is a no-op.
        extra_video_tags = ["-tag:v", "hvc1"] if preserve_dovi else []

        cmd = [
            _FFMPEG,
            "-hide_banner", "-loglevel", "warning",
            *pre_input,
            "-i", str(path),
            "-map", "0:v:0?",
            "-map", "0:a?",
            "-c:v", "copy",
            *extra_video_tags,
            *audio_args,
            "-sn",                             # drop subs; UI selects separately
            "-movflags", "frag_keyframe+empty_moov+default_base_moof+delay_moov",
            "-f", "mp4",
            "pipe:1",
        ]
        logger.debug("remux: %s", " ".join(cmd))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def _drain_stderr() -> None:
            # Keep ffmpeg from stalling on a full stderr pipe.
            try:
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break
                    msg = line.decode("utf-8", errors="ignore").strip()
                    if msg:
                        logger.debug("ffmpeg: %s", msg)
            except Exception:  # noqa: BLE001
                pass

        stderr_task = asyncio.create_task(_drain_stderr())

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
                try:
                    proc.terminate()
                except ProcessLookupError:
                    pass
                try:
                    await asyncio.wait_for(proc.wait(), timeout=4.0)
                except asyncio.TimeoutError:
                    try:
                        proc.kill()
                    except ProcessLookupError:
                        pass
            stderr_task.cancel()
