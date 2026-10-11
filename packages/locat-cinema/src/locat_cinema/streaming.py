"""HTTP byte-range streaming for Cinema and Music.

Implements RFC 7233 Range handling with correct 206/416, Content-Range
headers, HEAD support, and async file reads with bounded memory. Never
loads the entire file into RAM.
"""
from __future__ import annotations

import asyncio
import mimetypes
import os
from pathlib import Path
from typing import AsyncIterator, Optional, Tuple

from fastapi import HTTPException, Request
from starlette.responses import Response, StreamingResponse


CHUNK_SIZE = 1024 * 512  # 512 KiB — plenty for 4K remux playback, bounded RAM


def parse_range_header(value: str, file_size: int) -> Optional[Tuple[int, int]]:
    """Parse an HTTP Range header. Returns (start, end) inclusive or None.

    Raises HTTPException(416) if the range is syntactically invalid or
    unsatisfiable.
    """
    if not value:
        return None
    if not value.startswith("bytes="):
        raise HTTPException(status_code=416, detail="Only bytes range units are supported")
    spec = value[len("bytes="):].split(",")[0].strip()
    if "-" not in spec:
        raise HTTPException(status_code=416, detail="Malformed range")
    s, e = spec.split("-", 1)
    try:
        if s == "":
            # suffix range: last N bytes
            suffix = int(e)
            if suffix <= 0:
                raise HTTPException(status_code=416, detail="Invalid suffix range")
            start = max(0, file_size - suffix)
            end = file_size - 1
        else:
            start = int(s)
            end = int(e) if e else file_size - 1
    except ValueError:
        raise HTTPException(status_code=416, detail="Malformed range")

    if start < 0 or start >= file_size or end < start:
        raise HTTPException(status_code=416, detail="Range not satisfiable",
                            headers={"Content-Range": f"bytes */{file_size}"})
    end = min(end, file_size - 1)
    return start, end


def _guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    # Reasonable fallbacks for media we commonly serve.
    ext = path.suffix.lower().lstrip(".")
    return {
        "mkv": "video/x-matroska",
        "flac": "audio/flac",
        "m4a": "audio/mp4",
        "ts":  "video/mp2t",
        "m2ts": "video/mp2t",
    }.get(ext, "application/octet-stream")


class RangeStreamer:
    """Async file streamer with HEAD + 206/416 semantics."""

    def __init__(self, chunk_size: int = CHUNK_SIZE) -> None:
        self.chunk_size = chunk_size

    async def respond(self, request: Request, path: Path, *,
                      on_bytes=None, on_disconnect=None) -> Response:
        if not path.exists() or not path.is_file():
            raise HTTPException(status_code=404, detail="Media file not found")

        file_size = path.stat().st_size
        mime = _guess_mime(path)

        range_header = request.headers.get("range")
        range_tuple = parse_range_header(range_header, file_size) if range_header else None

        base_headers = {
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "Content-Type": mime,
        }

        if request.method == "HEAD":
            base_headers["Content-Length"] = str(file_size)
            return Response(status_code=200, headers=base_headers)

        if range_tuple is None:
            # Full response (clients that ignore range support)
            base_headers["Content-Length"] = str(file_size)
            return StreamingResponse(
                self._iter_file(path, 0, file_size - 1, request, on_bytes, on_disconnect),
                status_code=200,
                headers=base_headers,
                media_type=mime,
            )

        start, end = range_tuple
        length = end - start + 1
        headers = {
            **base_headers,
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(length),
        }
        return StreamingResponse(
            self._iter_file(path, start, end, request, on_bytes, on_disconnect),
            status_code=206,
            headers=headers,
            media_type=mime,
        )

    async def _iter_file(self, path: Path, start: int, end: int, request: Request,
                         on_bytes, on_disconnect) -> AsyncIterator[bytes]:
        remaining = end - start + 1
        loop = asyncio.get_running_loop()
        fd = await loop.run_in_executor(None, os.open, str(path), os.O_RDONLY)
        try:
            await loop.run_in_executor(None, os.lseek, fd, start, os.SEEK_SET)
            while remaining > 0:
                if await request.is_disconnected():
                    if on_disconnect:
                        try:
                            on_disconnect()
                        except Exception:  # noqa: BLE001
                            pass
                    break
                read_size = min(self.chunk_size, remaining)
                chunk = await loop.run_in_executor(None, os.read, fd, read_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                if on_bytes:
                    try:
                        on_bytes(len(chunk))
                    except Exception:  # noqa: BLE001
                        pass
                yield chunk
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
