"""Runtime settings loader for Locat Media Hub."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import List


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip().lower() in ("1", "true", "yes", "on")


def _env_list(name: str) -> List[str]:
    raw = os.environ.get(name, "")
    return [p.strip() for p in raw.split(os.pathsep) if p.strip()]


@dataclass
class MediaServerSettings:
    enabled: bool = True
    dev_mode: bool = True
    auth_required: bool = False
    authorized_roots: List[str] = field(default_factory=list)
    sample_root: str = "/app/media_samples"
    chunk_size_bytes: int = 1024 * 512

    @classmethod
    def from_env(cls) -> "MediaServerSettings":
        return cls(
            enabled=_env_bool("LOCAT_MEDIA_ENABLED", True),
            dev_mode=_env_bool("LOCAT_DEV_MODE", True),
            auth_required=_env_bool("LOCAT_MEDIA_AUTH_REQUIRED", False),
            authorized_roots=_env_list("LOCAT_MEDIA_AUTHORIZED_ROOTS")
                             or ["/app/media_samples"],
            sample_root=os.environ.get("LOCAT_MEDIA_SAMPLE_ROOT", "/app/media_samples"),
        )
