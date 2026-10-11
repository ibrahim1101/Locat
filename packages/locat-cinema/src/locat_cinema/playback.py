"""Direct Play decision engine.

Rules (highest priority wins):
 1. If the client declares it can decode the item's container, video codec,
    and audio codec AND the item has no incompatible HDR for that client,
    return DIRECT_PLAY.
 2. If the client can decode the video + audio codecs but not the
    container, return DIRECT_STREAM (remux only).
 3. If only the video is unsupported (or HDR is unsupported), return
    TRANSCODE.
 4. Else UNSUPPORTED.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from locat_media_core import MediaItem, PlaybackDecision, PlaybackPathType


@dataclass
class ClientCapabilities:
    """What the client reports it can decode natively.

    Values are lowercase short codec names (``h264``, ``hevc``, ``av1``,
    ``vp9``) and lowercase container names (``mp4``, ``mkv``).
    """

    containers: List[str] = field(default_factory=list)
    video_codecs: List[str] = field(default_factory=list)
    audio_codecs: List[str] = field(default_factory=list)
    subtitle_codecs: List[str] = field(default_factory=list)
    hdr: List[str] = field(default_factory=list)   # "hdr10", "dovi", "hlg"
    max_video_height: Optional[int] = None
    hw_decoded: List[str] = field(default_factory=list)  # client-reported HW decoders

    @classmethod
    def web_safe_default(cls) -> "ClientCapabilities":
        """Conservative browser profile. Browsers reliably play H.264 + AAC
        in MP4; MKV + HEVC + E-AC3 is NOT reliable, hence remux/transcode."""
        return cls(
            containers=["mp4", "webm"],
            video_codecs=["h264", "vp9", "av1"],
            audio_codecs=["aac", "mp3", "opus", "vorbis"],
            subtitle_codecs=["webvtt"],
            hdr=[],
            max_video_height=2160,
        )


class PlaybackDecider:
    def decide(self, item: MediaItem, caps: ClientCapabilities) -> PlaybackDecision:
        warnings: List[str] = []

        if not item.video_streams:
            return PlaybackDecision(
                item_id=item.id,
                path_type=PlaybackPathType.UNSUPPORTED,
                reason="No video streams detected in media file.",
                warnings=warnings,
            )

        v = item.video_streams[0]
        a = item.audio_streams[0] if item.audio_streams else None
        container = (item.container or "").lower().split(",")[0]

        container_ok = container in [c.lower() for c in caps.containers]
        video_ok = v.codec.lower() in [c.lower() for c in caps.video_codecs]
        audio_ok = True if a is None else a.codec.lower() in [c.lower() for c in caps.audio_codecs]
        hdr_ok = v.hdr is None or v.hdr.lower() in [h.lower() for h in caps.hdr]
        height_ok = (caps.max_video_height is None) or (v.height <= caps.max_video_height)

        if not hdr_ok:
            warnings.append(f"Client does not advertise {v.hdr!r} HDR support; tone-mapping may be required.")
        if not height_ok:
            warnings.append(f"Source height {v.height}p exceeds client max {caps.max_video_height}p.")

        if container_ok and video_ok and audio_ok and hdr_ok and height_ok:
            return PlaybackDecision(
                item_id=item.id,
                path_type=PlaybackPathType.DIRECT_PLAY,
                reason="Container, video codec, audio codec, HDR and resolution all supported — original streams preserved.",
                selected_video_stream=0,
                selected_audio_stream=0 if a else None,
                warnings=warnings,
            )

        if video_ok and audio_ok and hdr_ok and height_ok and not container_ok:
            return PlaybackDecision(
                item_id=item.id,
                path_type=PlaybackPathType.DIRECT_STREAM,
                reason=f"Container {container!r} unsupported — remuxing streams only, no re-encode.",
                selected_video_stream=0,
                selected_audio_stream=0 if a else None,
                warnings=warnings,
            )

        if not video_ok or not hdr_ok or not height_ok:
            return PlaybackDecision(
                item_id=item.id,
                path_type=PlaybackPathType.TRANSCODE,
                reason=(
                    f"Video codec {v.codec!r} / HDR {v.hdr!r} / resolution {v.height}p "
                    "exceeds client capabilities — transcoding required."
                ),
                transcode_profile="h264-aac-mp4" if 1080 >= v.height else "h264-aac-mp4-4k",
                warnings=warnings,
            )

        return PlaybackDecision(
            item_id=item.id,
            path_type=PlaybackPathType.TRANSCODE,
            reason="Audio codec not supported — audio-only transcode required.",
            transcode_profile="passthrough-video-aac-audio",
            warnings=warnings,
        )
