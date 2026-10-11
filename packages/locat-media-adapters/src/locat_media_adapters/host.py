"""Host runtime adapters (Windows host + Android Capacitor bridge).

The host adapter is the integration point for native capabilities the
Locat application already owns:

* lifecycle (start/stop media services from Locat's tray/UI),
* native audio output (WASAPI exclusive on Windows, AAudio on Android),
* native video decoder capability reporting (MediaCodec on Android).

The adapters here are PLACEHOLDERS that document the interface. Real
native implementations must live inside the Locat Windows host and
Locat Android Capacitor plugin and MUST replace these mocks.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Protocol, runtime_checkable


@dataclass
class DecoderCapability:
    container: str
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    max_width: Optional[int] = None
    max_height: Optional[int] = None
    hdr: List[str] = field(default_factory=list)
    passthrough: List[str] = field(default_factory=list)


@runtime_checkable
class HostAdapter(Protocol):
    runtime_name: str
    async def start_services(self) -> None: ...
    async def stop_services(self) -> None: ...
    async def native_decoder_matrix(self) -> List[DecoderCapability]: ...
    async def native_audio_capabilities(self) -> Dict[str, object]: ...


class MockWindowsHostAdapter:
    """Documents what the Locat Windows host must implement.

    Native WASAPI exclusive-mode output and NVENC-accelerated transcoding
    (RTX 5080 class hardware) belong here. This mock reports "unavailable".
    """

    runtime_name = "windows"

    async def start_services(self) -> None:  # pragma: no cover - stub
        return None

    async def stop_services(self) -> None:  # pragma: no cover - stub
        return None

    async def native_decoder_matrix(self) -> List[DecoderCapability]:
        # NOTE: The real Windows adapter should probe the actual GPU/CPU
        # decoder table (DXVA/NVDEC). This mock returns a conservative set.
        return [
            DecoderCapability(container="mp4", video_codec="h264", audio_codec="aac"),
            DecoderCapability(container="mkv", video_codec="hevc", audio_codec="eac3",
                               max_width=3840, max_height=2160, hdr=["hdr10"]),
        ]

    async def native_audio_capabilities(self) -> Dict[str, object]:
        return {
            "runtime": "windows",
            "supports_exclusive": False,
            "supports_bit_perfect": False,
            "reason": "MOCK adapter — real WASAPI exclusive-mode wiring required.",
        }


class MockAndroidCapacitorAdapter:
    """Documents what the Locat Android Capacitor plugin must implement."""

    runtime_name = "android"

    async def start_services(self) -> None:  # pragma: no cover - stub
        return None

    async def stop_services(self) -> None:  # pragma: no cover - stub
        return None

    async def native_decoder_matrix(self) -> List[DecoderCapability]:
        # NOTE: The real Android plugin must query MediaCodecList.
        return [
            DecoderCapability(container="mp4", video_codec="h264", audio_codec="aac"),
            DecoderCapability(container="mkv", video_codec="hevc", audio_codec="eac3",
                               max_width=3840, max_height=2160, hdr=["hdr10", "hlg"]),
        ]

    async def native_audio_capabilities(self) -> Dict[str, object]:
        return {
            "runtime": "android",
            "supports_exclusive": False,
            "supports_bit_perfect": False,
            "reason": "MOCK adapter — real AAudio/ExoPlayer wiring required.",
        }
