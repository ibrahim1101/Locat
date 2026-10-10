"""Locat 2.0 backend host — loads the Locat Media Hub module and mounts it.

In the real Locat application this file would be Locat's own entry point;
here it demonstrates how a parent application wires the Locat Media Hub
module behind the LOCAT_MEDIA_ENABLED feature flag.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

# --- Load Locat Media Hub module packages onto sys.path --------------------
BACKEND_ROOT = Path(__file__).parent
APP_ROOT = BACKEND_ROOT.parent
load_dotenv(BACKEND_ROOT / ".env")

for pkg in (
    "locat-media-core",
    "locat-media-adapters",
    "locat-cinema",
    "locat-music",
    "locat-media-server",
):
    src = APP_ROOT / "packages" / pkg / "src"
    if str(src) not in sys.path:
        sys.path.insert(0, str(src))

from locat_media_core.persistence import MongoMediaPersistence  # noqa: E402
from locat_media_adapters import (                                # noqa: E402
    MockLocatAuthAdapter,
    MockLocalStorageAdapter,
    MockDevicePairingAdapter,
    MockWindowsHostAdapter,
    MockAndroidCapacitorAdapter,
)
from locat_media_server import create_media_router, MediaServerSettings  # noqa: E402


# --- Mongo ---------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
mongo = AsyncIOMotorClient(mongo_url)
db = mongo[os.environ["DB_NAME"]]


# --- FastAPI -------------------------------------------------------------
app = FastAPI(title="Locat 2.0 host (with Locat Media Hub)")

# Root/legacy /api router (keeps existing scaffold endpoints alive).
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: __import__("uuid").uuid4().hex)
    client_name: str


@api_router.get("/")
async def root():
    return {"service": "locat-host", "media_module": "locat-media-hub"}


@api_router.get("/status")
async def get_status_checks():
    return []


app.include_router(api_router)

# --- Locat Media Hub wiring ---------------------------------------------
settings = MediaServerSettings.from_env()

# Pick a host adapter based on env (web preview defaults to a "web" runtime
# that honestly reports it cannot do bit-perfect output).
_runtime = os.environ.get("LOCAT_HOST_RUNTIME", "web").lower()
if _runtime == "windows":
    host_adapter = MockWindowsHostAdapter()
elif _runtime == "android":
    host_adapter = MockAndroidCapacitorAdapter()
else:
    # Minimal web-runtime adapter (reports UNAVAILABLE bit-perfect honestly).
    class _WebHostAdapter:
        runtime_name = "web"
        async def start_services(self): return None
        async def stop_services(self): return None
        async def native_decoder_matrix(self):
            from locat_media_adapters.host import DecoderCapability
            return [DecoderCapability(container="mp4", video_codec="h264", audio_codec="aac",
                                       max_width=3840, max_height=2160)]
        async def native_audio_capabilities(self):
            return {"runtime": "web", "supports_exclusive": False,
                    "supports_bit_perfect": False,
                    "reason": "Browser dev preview — WebAudio resamples through a shared mixer."}
    host_adapter = _WebHostAdapter()

auth_adapter = MockLocatAuthAdapter(dev_mode=settings.dev_mode)
storage_adapter = MockLocalStorageAdapter(settings.authorized_roots)
device_adapter = MockDevicePairingAdapter()
persistence = MongoMediaPersistence(db)

media_router = create_media_router(
    persistence=persistence,
    auth=auth_adapter,
    storage=storage_adapter,
    device_pairing=device_adapter,
    host=host_adapter,
    settings=settings,
)
app.include_router(media_router)


@app.on_event("startup")
async def _on_startup():
    # Seed built-in EQ presets so the dev preview has something immediately.
    from locat_music import AudioModeService
    svc = AudioModeService(persistence=persistence, host=host_adapter)
    try:
        await svc.seed_builtins()
    except Exception as e:  # noqa: BLE001
        logging.getLogger("locat").warning("EQ preset seeding soft-fail: %s", e)

    # Drop stale libraries whose root is no longer authorized or no longer
    # exists on disk. Keeps the Hub view honest after env changes / failed
    # library create attempts in dev.
    try:
        existing = await persistence.list_libraries()
        for lib in existing:
            if not storage_adapter.is_authorized_path(lib.root_path) or not Path(lib.root_path).exists():
                await persistence.delete_items_for_library(lib.id)
                await persistence.delete_tracks_for_library(lib.id)
                await persistence.delete_library(lib.id)
    except Exception as e:  # noqa: BLE001
        logging.getLogger("locat").warning("stale-library cleanup soft-fail: %s", e)

    # Auto-register the dev sample library so first-run isn't empty.
    sample_root = Path(settings.sample_root)
    if sample_root.exists():
        for sub, kind in (("cinema", "movie"), ("music", "music")):
            sub_root = sample_root / sub
            if not sub_root.exists():
                continue
            storage_adapter.add_root(str(sub_root))
            libs = await persistence.list_libraries()
            if any(l.root_path == str(sub_root.resolve()) for l in libs):
                continue
            from locat_media_core import MediaLibrary, MediaType
            lib = MediaLibrary(
                name=f"Sample {sub.title()} Library",
                root_path=str(sub_root.resolve()),
                kind=MediaType.MOVIE if kind == "movie" else MediaType.MUSIC,
            )
            await persistence.upsert_library(lib)


@app.on_event("shutdown")
async def _on_shutdown():
    mongo.close()


# --- CORS ---------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length", "X-Locat-Session-Id"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
