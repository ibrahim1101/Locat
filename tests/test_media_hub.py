"""End-to-end pytest suite for Locat Media Hub.

Hits the live backend running under supervisor. Covers:
 * module health + feature flag
 * library create/scan/delete (sample folder)
 * media listing + metadata (ffprobe fields present)
 * playback decision engine (direct_play / direct_stream / transcode)
 * HTTP Range streaming — 200 (HEAD), 206 (bytes=0-999), 416 (invalid)
 * music endpoints — tracks, albums, favorites
 * dual audio modes — Pure Audio vs Enhanced DSP, honest bit-perfect reporting
 * EQ preset CRUD
"""
from __future__ import annotations

import os
import pytest
import requests


API = os.environ.get(
    "LOCAT_API",
    "http://localhost:8001/api/media",
)


def _get(path: str, **kw):
    return requests.get(f"{API}{path}", timeout=15, **kw)


def _post(path: str, **kw):
    return requests.post(f"{API}{path}", timeout=15, **kw)


def _delete(path: str, **kw):
    return requests.delete(f"{API}{path}", timeout=15, **kw)


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def health():
    r = _get("/health")
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def libraries(health):
    r = _get("/libraries")
    r.raise_for_status()
    libs = r.json()
    if not libs:
        pytest.skip("No libraries indexed")
    return libs


@pytest.fixture(scope="module")
def cinema_lib(libraries):
    for l in libraries:
        if l["kind"] == "movie":
            return l
    pytest.skip("No cinema library")


@pytest.fixture(scope="module")
def music_lib(libraries):
    for l in libraries:
        if l["kind"] == "music":
            return l
    pytest.skip("No music library")


@pytest.fixture(scope="module")
def scanned_cinema(cinema_lib):
    r = _post(f"/libraries/{cinema_lib['id']}/scan")
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def scanned_music(music_lib):
    r = _post(f"/libraries/{music_lib['id']}/scan")
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="module")
def cinema_item(scanned_cinema):
    r = _get("/items", params={"limit": 1, "media_type": "movie"})
    r.raise_for_status()
    items = r.json()
    assert items, "Expected at least one cinema item after scan"
    return items[0]


@pytest.fixture(scope="module")
def music_track(scanned_music):
    r = _get("/music/tracks", params={"limit": 1})
    r.raise_for_status()
    tracks = r.json()
    assert tracks, "Expected at least one music track after scan"
    return tracks[0]


# ---------- Service meta ----------

class TestHealth:
    def test_health_ok(self, health):
        assert health["status"] == "ok"
        assert health["enabled"] is True
        assert isinstance(health["authorized_roots"], list)

    def test_config_exposes_feature_flag(self):
        r = _get("/config")
        assert r.status_code == 200
        c = r.json()
        assert c["LOCAT_MEDIA_ENABLED"] is True
        assert c["user"]["id"]

    def test_capability_matrix(self):
        r = _get("/capabilities/matrix")
        assert r.status_code == 200
        m = r.json()
        assert "decoders" in m
        assert isinstance(m["decoders"], list)


# ---------- Libraries ----------

class TestLibraries:
    def test_lists_sample_libraries(self, libraries):
        kinds = {l["kind"] for l in libraries}
        assert "movie" in kinds
        assert "music" in kinds

    def test_scan_is_idempotent(self, cinema_lib):
        r1 = _post(f"/libraries/{cinema_lib['id']}/scan").json()
        r2 = _post(f"/libraries/{cinema_lib['id']}/scan").json()
        # Deterministic ids: scanning the same files produces the same count.
        assert r1["indexed_items"] == r2["indexed_items"]

    def test_reject_unauthorized_root(self):
        r = _post("/libraries", json={"name": "X", "root_path": "/etc", "kind": "movie"})
        assert r.status_code in (400, 403)


# ---------- Cinema metadata + decision engine ----------

class TestCinema:
    def test_item_has_real_ffprobe_metadata(self, cinema_item):
        assert cinema_item["video_streams"], "Expected ffprobe-populated video streams"
        v = cinema_item["video_streams"][0]
        assert v["codec"], "codec must be set"
        assert v["width"] > 0 and v["height"] > 0

    def test_direct_play_for_native_client(self, cinema_item):
        caps = {
            "containers": ["mp4", "mov", "webm"],
            "video_codecs": ["h264", "vp9", "av1"],
            "audio_codecs": ["aac", "mp3", "opus"],
            "hdr": [],
            "max_video_height": 2160,
        }
        r = _post(f"/items/{cinema_item['id']}/playback-decision", json=caps)
        assert r.status_code == 200
        d = r.json()
        assert d["path_type"] in ("direct_play", "direct_stream"), d
        if d["path_type"] == "direct_play":
            assert d["selected_video_stream"] == 0

    def test_remux_for_mkv_only_client(self, cinema_item):
        if cinema_item["container"] == "matroska":
            # Already MKV — use mp4-only client instead
            caps = {"containers": ["mp4"], "video_codecs": ["h264"], "audio_codecs": ["aac", "ac3"]}
        else:
            caps = {"containers": ["mkv"], "video_codecs": ["h264"], "audio_codecs": ["aac", "ac3"]}
        r = _post(f"/items/{cinema_item['id']}/playback-decision", json=caps)
        assert r.status_code == 200
        d = r.json()
        assert d["path_type"] == "direct_stream", d

    def test_transcode_when_video_codec_missing(self, cinema_item):
        caps = {"containers": ["mp4"], "video_codecs": ["av1"], "audio_codecs": ["aac"]}
        r = _post(f"/items/{cinema_item['id']}/playback-decision", json=caps)
        d = r.json()
        assert d["path_type"] == "transcode", d


# ---------- HTTP Range streaming ----------

class TestRangeStreaming:
    def test_head_returns_content_length_and_accept_ranges(self, cinema_item):
        r = requests.head(f"{API}/items/{cinema_item['id']}/stream", timeout=10)
        assert r.status_code == 200
        assert r.headers.get("Accept-Ranges") == "bytes"
        assert int(r.headers.get("Content-Length", 0)) == cinema_item["size_bytes"]
        assert r.headers.get("X-Locat-Session-Id")

    def test_range_returns_206(self, cinema_item):
        r = requests.get(
            f"{API}/items/{cinema_item['id']}/stream",
            headers={"Range": "bytes=0-999"}, timeout=10, stream=True,
        )
        assert r.status_code == 206
        assert r.headers["Content-Length"] == "1000"
        assert r.headers["Content-Range"].startswith("bytes 0-999/")
        data = r.content
        assert len(data) == 1000

    def test_suffix_range_returns_last_bytes(self, cinema_item):
        r = requests.get(
            f"{API}/items/{cinema_item['id']}/stream",
            headers={"Range": "bytes=-500"}, timeout=10,
        )
        assert r.status_code == 206
        assert len(r.content) == 500

    def test_invalid_range_returns_416(self, cinema_item):
        r = requests.get(
            f"{API}/items/{cinema_item['id']}/stream",
            headers={"Range": "bytes=999999999999-"}, timeout=10,
        )
        assert r.status_code == 416


# ---------- Music ----------

class TestMusic:
    def test_tracks_have_metadata(self, music_track):
        assert music_track["title"]
        assert music_track["artist"] or music_track["album_artist"]
        assert music_track["audio"] is not None
        assert music_track["audio"]["sample_rate"] > 0

    def test_albums_aggregation(self, scanned_music):
        r = _get("/music/albums")
        assert r.status_code == 200
        albums = r.json()
        assert albums, "Expected at least one aggregated album"
        a = albums[0]
        assert "album" in a and "track_count" in a

    def test_favorite_round_trip(self, music_track):
        r = _post(f"/music/tracks/{music_track['id']}/favorite", params={"value": "true"})
        assert r.status_code == 200
        assert r.json()["favorite"] is True
        r = _post(f"/music/tracks/{music_track['id']}/favorite", params={"value": "false"})
        assert r.json()["favorite"] is False

    def test_music_stream_supports_range(self, music_track):
        r = requests.get(
            f"{API}/music/tracks/{music_track['id']}/stream",
            headers={"Range": "bytes=0-99"}, timeout=10,
        )
        assert r.status_code == 206
        assert r.headers["Content-Length"] == "100"


# ---------- Dual audio mode + EQ ----------

class TestAudioModes:
    def test_web_runtime_reports_unavailable_bitperfect(self):
        r = _get("/music/audio-mode", params={"runtime": "web", "device_id": "test"})
        assert r.status_code == 200
        caps = r.json()
        assert caps["runtime"] == "web"
        assert caps["bit_perfect"] == "unavailable", caps
        assert caps["supports_bit_perfect"] is False

    def test_mode_switch_persists_per_device(self):
        for mode in ("pure_audio", "enhanced_dsp"):
            r = _post("/music/audio-mode", json={"mode": mode, "device_id": "test"})
            assert r.status_code == 200
            r2 = _get("/music/audio-mode", params={"runtime": "web", "device_id": "test"})
            assert r2.json()["active_mode"] == mode
            assert r2.json()["dsp_enabled"] == (mode == "enhanced_dsp")

    def test_pure_audio_never_reports_verified_from_web(self):
        _post("/music/audio-mode", json={"mode": "pure_audio", "device_id": "test"})
        r = _get("/music/audio-mode", params={"runtime": "web", "device_id": "test"})
        assert r.json()["bit_perfect"] != "verified"


class TestEqPresets:
    def test_builtins_seeded(self):
        r = _get("/eq/presets" if False else "/music/eq/presets")
        assert r.status_code == 200
        presets = r.json()
        names = {p["name"] for p in presets}
        assert {"Flat", "Bass Boost", "Rock"}.issubset(names)
        for p in presets:
            if p["bands_mode"] == "10":
                assert len(p["bands"]) == 10

    def test_user_preset_crud(self):
        preset = {
            "name": "Test Loud",
            "bands_mode": "10",
            "preamp_db": -3.0,
            "bands": [
                {"frequency_hz": f, "gain_db": g}
                for f, g in zip([31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
                                [5, 4, 2, 0, 0, 0, 0, 2, 4, 5])
            ],
            "replaygain_mode": "track",
            "limiter_enabled": True,
            "balance": 0.0,
            "bypass": False,
        }
        r = _post("/music/eq/presets", json=preset)
        assert r.status_code == 200
        saved = r.json()
        assert saved["name"] == "Test Loud"
        assert saved["is_builtin"] is False
        r = _delete(f"/music/eq/presets/{saved['id']}")
        assert r.status_code == 200
