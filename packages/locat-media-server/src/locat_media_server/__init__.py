"""locat_media_server — mountable FastAPI router for Locat Media Hub."""
from .settings import MediaServerSettings
from .router import create_media_router
from .diagnostics import DiagnosticsRegistry

__all__ = [
    "MediaServerSettings",
    "create_media_router",
    "DiagnosticsRegistry",
]
