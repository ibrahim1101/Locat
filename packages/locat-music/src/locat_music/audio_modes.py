"""Dual audio-mode engine: Pure Audio vs Enhanced DSP.

Backend responsibilities:
 * Report HONEST capability info for the active runtime (web / windows /
   android). The browser preview can NEVER report Verified bit-perfect.
 * Persist the user's selected audio mode (per device).
 * Serve built-in EQ presets as a seed.

Real DSP (ReplayGain, limiter, parametric filters) runs where audio is
produced:
 * Browser preview → Web Audio API (``AudioContext`` + ``BiquadFilterNode``)
 * Windows host    → WASAPI exclusive output + native DSP
 * Android client  → AAudio/ExoPlayer renderers

Pure Audio means "bypass every DSP stage listed above". The backend
service never silently applies DSP to Pure Audio.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from locat_media_core import (
    AudioModeKind,
    AudioOutputCapabilities,
    BitPerfectStatus,
    EqBand,
    EqPreset,
)
from locat_media_core.persistence import MediaPersistence
from locat_media_adapters.host import HostAdapter

logger = logging.getLogger("locat_music.audio_modes")

PREF_AUDIO_MODE = "music.audio_mode"           # global default
PREF_ACTIVE_PRESET = "music.active_eq_preset"  # id or None
PREF_PER_DEVICE_MODE = "music.audio_mode.by_device"


# --- Built-in EQ seed ------------------------------------------------

_FREQS_10 = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
_FREQS_15 = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000]
_FREQS_31 = [20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
             1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000]


def _preset(name: str, gains: Dict[int, float], bands_mode: str = "10") -> EqPreset:
    freqs = {"10": _FREQS_10, "15": _FREQS_15, "31": _FREQS_31}[bands_mode]
    bands = [EqBand(frequency_hz=float(f), gain_db=float(gains.get(f, 0.0))) for f in freqs]
    return EqPreset(name=name, bands_mode=bands_mode, bands=bands, is_builtin=True)


def builtin_eq_presets() -> List[EqPreset]:
    return [
        _preset("Flat", {}),
        _preset("Bass Boost", {31: 6, 62: 5, 125: 3, 250: 1}),
        _preset("Treble Boost", {4000: 3, 8000: 5, 16000: 6}),
        _preset("Vocal Focus", {250: 1, 500: 2, 1000: 3, 2000: 3, 4000: 2}),
        _preset("Loudness", {31: 5, 62: 4, 8000: 3, 16000: 4}),
        _preset("Classical", {31: 2, 62: 2, 4000: -2, 8000: -3, 16000: -3}),
        _preset("Rock", {31: 4, 62: 3, 125: 2, 2000: -1, 4000: 2, 8000: 3}),
        _preset("Electronic", {31: 5, 62: 4, 1000: -2, 4000: 2, 8000: 3, 16000: 4}),
    ]


class AudioModeService:
    def __init__(self, persistence: MediaPersistence, host: HostAdapter) -> None:
        self.persistence = persistence
        self.host = host

    async def seed_builtins(self) -> None:
        existing = await self.persistence.list_eq_presets()
        existing_names = {p.name for p in existing}
        for p in builtin_eq_presets():
            if p.name not in existing_names:
                await self.persistence.upsert_eq_preset(p)

    async def capabilities(self, runtime: Optional[str] = None, device_id: Optional[str] = None) -> AudioOutputCapabilities:
        runtime = runtime or self.host.runtime_name
        active_mode = await self.get_active_mode(device_id=device_id)

        # Browser dev preview: WebAudio ALWAYS resamples to the AudioContext
        # rate and routes through a shared mixer. Bit-perfect verification
        # is not possible from pure JS; report UNAVAILABLE honestly.
        if runtime == "web":
            return AudioOutputCapabilities(
                runtime="web",
                device_name="Browser audio output",
                output_sample_rate=None,
                output_bit_depth=None,
                supports_exclusive=False,
                supports_bit_perfect=False,
                bit_perfect=BitPerfectStatus.UNAVAILABLE,
                reason=(
                    "Web preview routes audio through the browser's AudioContext mixer, "
                    "which may resample. Bit-perfect output requires the native Windows "
                    "(WASAPI exclusive) or Android (AAudio) adapter."
                ),
                active_mode=active_mode,
                dsp_enabled=(active_mode == AudioModeKind.ENHANCED_DSP),
                resampling_detected=True,
            )

        # Native hosts: ask the adapter what it can really do.
        info = await self.host.native_audio_capabilities()
        supports_bp = bool(info.get("supports_bit_perfect"))
        reason = info.get("reason", "")
        if active_mode == AudioModeKind.PURE_AUDIO and supports_bp:
            # UNVERIFIED by default — the native adapter must positively
            # confirm the active output rate / depth match the source to
            # upgrade to VERIFIED. The backend will not fabricate that.
            status = BitPerfectStatus.UNVERIFIED
        elif active_mode == AudioModeKind.PURE_AUDIO:
            status = BitPerfectStatus.UNAVAILABLE
        else:
            status = BitPerfectStatus.UNAVAILABLE
        return AudioOutputCapabilities(
            runtime=runtime,
            device_name=str(info.get("device_name") or ""),
            output_sample_rate=info.get("output_sample_rate"),
            output_bit_depth=info.get("output_bit_depth"),
            supports_exclusive=bool(info.get("supports_exclusive")),
            supports_bit_perfect=supports_bp,
            bit_perfect=status,
            reason=reason,
            active_mode=active_mode,
            dsp_enabled=(active_mode == AudioModeKind.ENHANCED_DSP),
            resampling_detected=info.get("resampling_detected"),
        )

    async def report_verified_bitperfect(self, device_id: str, verified: bool,
                                         evidence: Dict) -> None:
        """Called ONLY by trusted native adapters when they can prove the
        output path preserves source samples. Browser clients must not call
        this."""
        key = f"music.bitperfect_verified.{device_id}"
        await self.persistence.set_pref(key, {"verified": verified, "evidence": evidence})

    async def get_active_mode(self, device_id: Optional[str] = None) -> AudioModeKind:
        if device_id:
            by_dev = await self.persistence.get_pref(PREF_PER_DEVICE_MODE) or {}
            if device_id in by_dev:
                try:
                    return AudioModeKind(by_dev[device_id])
                except ValueError:
                    pass
        v = await self.persistence.get_pref(PREF_AUDIO_MODE)
        try:
            return AudioModeKind(v) if v else AudioModeKind.ENHANCED_DSP
        except ValueError:
            return AudioModeKind.ENHANCED_DSP

    async def set_active_mode(self, mode: AudioModeKind, device_id: Optional[str] = None) -> AudioModeKind:
        if device_id:
            by_dev = await self.persistence.get_pref(PREF_PER_DEVICE_MODE) or {}
            by_dev[device_id] = mode.value
            await self.persistence.set_pref(PREF_PER_DEVICE_MODE, by_dev)
        else:
            await self.persistence.set_pref(PREF_AUDIO_MODE, mode.value)
        return mode
