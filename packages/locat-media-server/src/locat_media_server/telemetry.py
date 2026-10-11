"""Real host + playback telemetry for the Locat Performance tab.

Uses :mod:`psutil` for CPU/RAM/disk/network and :mod:`pynvml` for NVIDIA
GPU/VRAM when the driver is available. **Never fabricates numbers**: any
metric that cannot be read is reported as ``None`` (which the frontend
renders as "Unavailable").
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

try:
    import psutil
    _HAVE_PSUTIL = True
except Exception:  # noqa: BLE001
    psutil = None  # type: ignore
    _HAVE_PSUTIL = False

try:
    import pynvml
    pynvml.nvmlInit()
    _HAVE_NVML = True
except Exception:  # noqa: BLE001
    _HAVE_NVML = False

logger = logging.getLogger("locat_media_server.telemetry")


def _snap_io() -> Dict[str, int]:
    if not _HAVE_PSUTIL:
        return {}
    net = psutil.net_io_counters()
    disk = psutil.disk_io_counters() if psutil.disk_io_counters() else None
    return {
        "net_bytes_sent": net.bytes_sent,
        "net_bytes_recv": net.bytes_recv,
        "disk_bytes_read": disk.read_bytes if disk else 0,
        "disk_bytes_write": disk.write_bytes if disk else 0,
        "ts": time.monotonic(),
    }


class TelemetryService:
    """Collects host + module telemetry on demand. No background thread.

    The dashboard polls at the user-selected interval (1/2/5 s), which
    keeps overhead minimal and avoids piling work onto the event loop.
    """

    def __init__(self, diagnostics_registry) -> None:
        self.diagnostics = diagnostics_registry
        self._last_io = _snap_io()
        self._history: List[dict] = []
        self._history_cap = 240  # ~4 min at 1 s cadence

    # ---- Overview ----
    def overview(self) -> dict:
        if not _HAVE_PSUTIL:
            return {
                "cpu_percent": None,
                "memory": None,
                "disk": None,
                "network": None,
                "psutil_available": False,
                "reason": "psutil not installed",
            }
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        try:
            disk_usage = psutil.disk_usage("/")
        except Exception:  # noqa: BLE001
            disk_usage = None

        now = _snap_io()
        prev = self._last_io or now
        span = max(0.001, now["ts"] - prev.get("ts", now["ts"]))
        net_up = (now["net_bytes_sent"] - prev.get("net_bytes_sent", now["net_bytes_sent"])) / span
        net_dn = (now["net_bytes_recv"] - prev.get("net_bytes_recv", now["net_bytes_recv"])) / span
        disk_r = (now["disk_bytes_read"] - prev.get("disk_bytes_read", now["disk_bytes_read"])) / span
        disk_w = (now["disk_bytes_write"] - prev.get("disk_bytes_write", now["disk_bytes_write"])) / span
        self._last_io = now

        gpu = self._gpu()

        snapshot = {
            "cpu_percent": cpu,
            "cpu_cores": psutil.cpu_count(logical=True),
            "memory": {
                "total": mem.total,
                "used": mem.used,
                "percent": mem.percent,
            },
            "disk": {
                "total": getattr(disk_usage, "total", None),
                "used": getattr(disk_usage, "used", None),
                "percent": getattr(disk_usage, "percent", None),
                "read_bps": disk_r,
                "write_bps": disk_w,
            },
            "network": {
                "upload_bps": net_up,
                "download_bps": net_dn,
            },
            "gpu": gpu,
            "active_streams": self.diagnostics.active_count(),
            "ts": time.time(),
            "psutil_available": True,
        }
        self._history.append(snapshot)
        if len(self._history) > self._history_cap:
            self._history = self._history[-self._history_cap:]
        return snapshot

    # ---- GPU (NVIDIA via NVML) ----
    def _gpu(self) -> Optional[dict]:
        if not _HAVE_NVML:
            return {
                "available": False,
                "reason": "No NVIDIA driver / NVML not available on this host",
            }
        try:
            count = pynvml.nvmlDeviceGetCount()
            devices = []
            for i in range(count):
                h = pynvml.nvmlDeviceGetHandleByIndex(i)
                name = pynvml.nvmlDeviceGetName(h)
                util = pynvml.nvmlDeviceGetUtilizationRates(h)
                mem = pynvml.nvmlDeviceGetMemoryInfo(h)
                try:
                    enc = pynvml.nvmlDeviceGetEncoderUtilization(h)
                    enc_util = enc[0]
                except Exception:  # noqa: BLE001
                    enc_util = None
                try:
                    dec = pynvml.nvmlDeviceGetDecoderUtilization(h)
                    dec_util = dec[0]
                except Exception:  # noqa: BLE001
                    dec_util = None
                devices.append({
                    "index": i,
                    "name": (name.decode() if isinstance(name, bytes) else name),
                    "utilization": util.gpu,
                    "memory_utilization": util.memory,
                    "memory_total": mem.total,
                    "memory_used": mem.used,
                    "encoder_percent": enc_util,
                    "decoder_percent": dec_util,
                })
            return {"available": True, "devices": devices}
        except Exception as e:  # noqa: BLE001
            return {"available": False, "reason": f"NVML error: {e}"}

    # ---- Module-specific slices ----
    def cinema(self) -> dict:
        sessions = []
        for s in list(self.diagnostics._sessions.values()):  # type: ignore[attr-defined]
            snap = self.diagnostics.get_diagnostics(s.id)
            sessions.append({
                "session_id": s.id,
                "item_id": s.item_id,
                "is_active": s.is_active,
                "bytes_served": s.bytes_served,
                "stalls": s.stalls,
                "resolution": snap.resolution if snap else None,
                "video_codec": snap.video_codec if snap else None,
                "audio_codec": snap.audio_codec if snap else None,
                "path_type": (snap.path_type.value if snap and snap.path_type else None),
                "source_bitrate_bps": snap.source_bitrate_bps if snap else None,
                "estimated_network_bps": self.diagnostics.estimated_bps(s.id),
            })
        return {"sessions": sessions, "count": len(sessions)}

    def music(self, audio_mode_service) -> dict:
        # Build without awaiting — this is a sync view the UI polls.
        return {
            "note": "Music runtime telemetry requires the active browser/native client to post /telemetry/music/report.",
            "builtin_presets": True,
            "pure_audio_requires_native_host_for_verified_bitperfect": True,
        }

    def network(self) -> dict:
        if not _HAVE_PSUTIL:
            return {"available": False, "reason": "psutil not installed"}
        counters = psutil.net_io_counters()
        return {
            "available": True,
            "bytes_sent": counters.bytes_sent,
            "bytes_recv": counters.bytes_recv,
            "errin": counters.errin,
            "errout": counters.errout,
            "dropin": counters.dropin,
            "dropout": counters.dropout,
        }

    def history(self) -> dict:
        return {"samples": self._history}

    def pause(self) -> None:
        self._history = []
