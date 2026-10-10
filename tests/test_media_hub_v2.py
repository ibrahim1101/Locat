"""Pytest suite for Milestones C/D/E additions: remux, series, next-episode,
playback info, telemetry, parametric EQ, universal format support.
"""
from __future__ import annotations

import os
import pytest
import requests

API = os.environ.get("LOCAT_API", "http://localhost:8001/api/media")


def _get(path, **kw): return requests.get(f"{API}{path}", timeout=20, **kw)
def _post(path, **kw): return requests.post(f"{API}{path}", timeout=20, **kw)


@pytest.fixture(scope="module")
def mkv_item():
    r = _post("/libraries", json={})  # noop
    items = _get("/items", params={"media_type": "episode"}).json()
    assert items, "need an episode in the sample library"
    return items[0]


# ---------- Server-side remux ----------

class TestRemux:
    def test_remux_streams_lossless_mp4(self, mkv_item):
        r = requests.get(f"{API}/items/{mkv_item['id']}/remux.mp4",
                         timeout=30, stream=True)
        assert r.status_code == 200
        assert r.headers.get("Content-Type", "").startswith("video/mp4")
        assert r.headers.get("X-Locat-Playback-Path") == "remux-stream-copy"
        payload = r.content
        assert len(payload) > 2000, "expected real remuxed bytes"
        # First box must be ftyp (MP4 marker)
        assert payload[4:8] == b"ftyp", "output does not look like MP4"

    def test_remux_preserves_video_bitrate_order_of_magnitude(self, mkv_item):
        """Stream-copy should produce a file comparable in size to the source
        (minor container overhead). If it halves/doubles something is wrong
        and the server fell back to transcoding."""
        src_size = mkv_item["size_bytes"]
        r = requests.get(f"{API}/items/{mkv_item['id']}/remux.mp4", timeout=30)
        ratio = len(r.content) / src_size
        assert 0.7 < ratio < 1.5, f"size ratio {ratio:.2f} suggests re-encoding"


# ---------- Series rollups ----------

class TestSeries:
    def test_series_endpoint_groups_episodes(self):
        r = _get("/series")
        assert r.status_code == 200
        series = r.json()
        assert series, "no series rolled up"
        s = series[0]
        assert "series_name" in s
        assert "seasons" in s and s["seasons"]
        season = s["seasons"][0]
        assert "episodes" in season and season["episodes"]

    def test_series_detail(self):
        series = _get("/series").json()
        name = series[0]["series_name"]
        r = _get(f"/series/{name}")
        assert r.status_code == 200
        assert r.json()["series_name"] == name

    def test_next_episode_endpoint(self):
        series = _get("/series").json()
        first = series[0]["seasons"][0]["episodes"][0]
        r = _get(f"/items/{first['id']}/next-episode")
        assert r.status_code == 200
        # Only one sample episode in the dev library → next is null
        assert r.json() is None


# ---------- Playback info panel ----------

class TestPlaybackInfo:
    def test_item_info_reports_hdr_and_ffmpeg(self, mkv_item):
        r = _get(f"/items/{mkv_item['id']}/info")
        assert r.status_code == 200
        info = r.json()
        assert info["filename"]
        assert info["container"]
        assert info["video"]
        assert info["ffmpeg"]
        assert isinstance(info["ffmpeg"]["hwaccels"], list)
        # HDR block is present even when source is SDR
        assert "format" in info["hdr"]
        assert info["audio_tracks"] is not None


# ---------- Telemetry ----------

class TestTelemetry:
    def test_overview_is_real_psutil(self):
        r = _get("/telemetry/overview")
        assert r.status_code == 200
        d = r.json()
        assert d["psutil_available"] is True
        assert isinstance(d["cpu_percent"], (int, float))
        assert d["memory"]["total"] > 0

    def test_cinema_telemetry_structure(self):
        r = _get("/telemetry/cinema")
        assert r.status_code == 200
        assert "sessions" in r.json()

    def test_server_telemetry_reports_ffmpeg(self):
        r = _get("/telemetry/server")
        assert r.status_code == 200
        d = r.json()
        assert d["ffmpeg_version"], "ffmpeg_version missing"
        assert isinstance(d["hwaccels"], list)

    def test_network_telemetry_counters(self):
        r = _get("/telemetry/network")
        d = r.json()
        assert d["available"] is True
        assert d["bytes_sent"] >= 0 and d["bytes_recv"] >= 0

    def test_gpu_unavailable_is_honest(self):
        d = _get("/telemetry/overview").json()
        gpu = d.get("gpu", {})
        # Container test env has no GPU → must say unavailable, never
        # fabricate a utilization number.
        if not gpu.get("available"):
            assert "reason" in gpu
            assert gpu.get("devices") is None or gpu.get("devices") == []


# ---------- Universal format compatibility ----------

class TestUniversalFormat:
    def test_capability_matrix_lists_many_containers(self):
        r = _get("/capabilities/matrix")
        assert r.status_code == 200
        matrix = r.json()
        containers = {m["container"] for m in matrix["container_matrix"]}
        for c in ("mp4", "mkv", "webm", "mov", "avi", "ts/m2ts"):
            assert c in containers, f"container {c} missing from matrix"
        assert matrix["ffmpeg"]["version"]

    def test_ffmpeg_capabilities_exposed(self):
        r = _get("/capabilities/ffmpeg")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["hwaccels"], list)
        # NVENC is compiled into Debian's ffmpeg (even without a GPU present)
        # but we only assert the flag exists; its value depends on build.
        assert isinstance(d["nvenc_available"], bool)


# ---------- Parametric EQ CRUD ----------

class TestParametricEq:
    def test_save_preset_with_parametric_filters(self):
        preset = {
            "name": "Test Parametric",
            "bands_mode": "10",
            "preamp_db": 0.0,
            "bands": [
                {"frequency_hz": f, "gain_db": 0.0}
                for f in [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
            ],
            "parametric": [
                {"kind": "peaking", "frequency_hz": 2500, "gain_db": 3.0, "q": 2.0, "enabled": True},
                {"kind": "highshelf", "frequency_hz": 10000, "gain_db": -4.0, "q": 0.707, "enabled": True},
                {"kind": "notch", "frequency_hz": 60, "gain_db": 0.0, "q": 5.0, "enabled": True},
            ],
            "replaygain_mode": "off",
            "limiter_enabled": False,
            "balance": 0.0,
            "bypass": False,
        }
        r = _post("/music/eq/presets", json=preset)
        assert r.status_code == 200
        saved = r.json()
        assert len(saved["parametric"]) == 3
        assert saved["parametric"][0]["kind"] == "peaking"
        # Clean up
        requests.delete(f"{API}/music/eq/presets/{saved['id']}", timeout=10)
