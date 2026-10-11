"""Abstract persistence contract + default Mongo implementation.

Media storage is intentionally hidden behind a protocol so Locat can
swap Mongo for SQLite / Postgres / an in-memory store (for tests) later
without touching Cinema, Music, or the router packages.
"""
from __future__ import annotations

from typing import Protocol, List, Optional, Dict, Any, runtime_checkable

from .models import (
    MediaLibrary,
    MediaItem,
    MusicTrack,
    Playlist,
    EqPreset,
)


@runtime_checkable
class MediaPersistence(Protocol):
    # Libraries
    async def upsert_library(self, lib: MediaLibrary) -> MediaLibrary: ...
    async def get_library(self, library_id: str) -> Optional[MediaLibrary]: ...
    async def list_libraries(self) -> List[MediaLibrary]: ...
    async def delete_library(self, library_id: str) -> bool: ...

    # Media items (movies / episodes)
    async def upsert_item(self, item: MediaItem) -> MediaItem: ...
    async def get_item(self, item_id: str) -> Optional[MediaItem]: ...
    async def list_items(
        self,
        *,
        library_id: Optional[str] = None,
        media_type: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 500,
        offset: int = 0,
    ) -> List[MediaItem]: ...
    async def delete_items_for_library(self, library_id: str) -> int: ...
    async def update_item_play_state(
        self, item_id: str, *, position_seconds: Optional[float] = None,
        increment_play_count: bool = False, favorite: Optional[bool] = None,
    ) -> Optional[MediaItem]: ...

    # Music
    async def upsert_track(self, track: MusicTrack) -> MusicTrack: ...
    async def get_track(self, track_id: str) -> Optional[MusicTrack]: ...
    async def list_tracks(
        self,
        *,
        library_id: Optional[str] = None,
        album: Optional[str] = None,
        artist: Optional[str] = None,
        query: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[MusicTrack]: ...
    async def list_albums(self) -> List[Dict[str, Any]]: ...
    async def list_artists(self) -> List[Dict[str, Any]]: ...
    async def delete_tracks_for_library(self, library_id: str) -> int: ...
    async def update_track_play_state(
        self, track_id: str, *, increment_play_count: bool = False,
        favorite: Optional[bool] = None,
    ) -> Optional[MusicTrack]: ...

    # Playlists
    async def upsert_playlist(self, pl: Playlist) -> Playlist: ...
    async def get_playlist(self, pl_id: str) -> Optional[Playlist]: ...
    async def list_playlists(self) -> List[Playlist]: ...
    async def delete_playlist(self, pl_id: str) -> bool: ...

    # EQ presets
    async def upsert_eq_preset(self, preset: EqPreset) -> EqPreset: ...
    async def get_eq_preset(self, preset_id: str) -> Optional[EqPreset]: ...
    async def list_eq_presets(self) -> List[EqPreset]: ...
    async def delete_eq_preset(self, preset_id: str) -> bool: ...

    # User prefs (audio mode per device, etc)
    async def get_pref(self, key: str) -> Optional[Any]: ...
    async def set_pref(self, key: str, value: Any) -> None: ...


# -------- Mongo implementation --------

class MongoMediaPersistence:
    """Mongo-backed MediaPersistence used by the default Locat server.

    All documents are stored with the model's `id` field as `_id` so the
    persistence layer stays agnostic of Mongo's ObjectId.
    """

    def __init__(self, db) -> None:
        self.db = db
        self.libraries = db["media_libraries"]
        self.items = db["media_items"]
        self.tracks = db["media_tracks"]
        self.playlists = db["media_playlists"]
        self.eq_presets = db["media_eq_presets"]
        self.prefs = db["media_prefs"]

    # helpers
    @staticmethod
    def _to_doc(model) -> dict:
        doc = model.model_dump(mode="json")
        doc["_id"] = doc["id"]
        return doc

    @staticmethod
    def _from_doc(cls, doc):
        if doc is None:
            return None
        doc = {k: v for k, v in doc.items() if k != "_id"}
        return cls.model_validate(doc)

    # libraries
    async def upsert_library(self, lib):
        doc = self._to_doc(lib)
        await self.libraries.replace_one({"_id": lib.id}, doc, upsert=True)
        return lib

    async def get_library(self, library_id):
        doc = await self.libraries.find_one({"_id": library_id})
        return self._from_doc(MediaLibrary, doc)

    async def list_libraries(self):
        cur = self.libraries.find({})
        return [self._from_doc(MediaLibrary, d) async for d in cur]

    async def delete_library(self, library_id):
        r = await self.libraries.delete_one({"_id": library_id})
        return r.deleted_count > 0

    # items
    async def upsert_item(self, item):
        doc = self._to_doc(item)
        await self.items.replace_one({"_id": item.id}, doc, upsert=True)
        return item

    async def get_item(self, item_id):
        doc = await self.items.find_one({"_id": item_id})
        return self._from_doc(MediaItem, doc)

    async def list_items(self, *, library_id=None, media_type=None, query=None,
                         limit=500, offset=0):
        q: Dict[str, Any] = {}
        if library_id:
            q["library_id"] = library_id
        if media_type:
            q["media_type"] = media_type
        if query:
            q["title"] = {"$regex": query, "$options": "i"}
        cur = self.items.find(q).skip(offset).limit(limit).sort("title", 1)
        return [self._from_doc(MediaItem, d) async for d in cur]

    async def delete_items_for_library(self, library_id):
        r = await self.items.delete_many({"library_id": library_id})
        return r.deleted_count

    async def update_item_play_state(self, item_id, *, position_seconds=None,
                                     increment_play_count=False, favorite=None):
        upd: Dict[str, Any] = {}
        if position_seconds is not None:
            upd.setdefault("$set", {})["last_position_seconds"] = position_seconds
        if favorite is not None:
            upd.setdefault("$set", {})["favorite"] = favorite
        if increment_play_count:
            upd.setdefault("$inc", {})["play_count"] = 1
        if not upd:
            return await self.get_item(item_id)
        await self.items.update_one({"_id": item_id}, upd)
        return await self.get_item(item_id)

    # tracks
    async def upsert_track(self, track):
        doc = self._to_doc(track)
        await self.tracks.replace_one({"_id": track.id}, doc, upsert=True)
        return track

    async def get_track(self, track_id):
        doc = await self.tracks.find_one({"_id": track_id})
        return self._from_doc(MusicTrack, doc)

    async def list_tracks(self, *, library_id=None, album=None, artist=None,
                          query=None, limit=1000, offset=0):
        q: Dict[str, Any] = {}
        if library_id:
            q["library_id"] = library_id
        if album:
            q["album"] = album
        if artist:
            q["$or"] = [{"artist": artist}, {"album_artist": artist}]
        if query:
            q["title"] = {"$regex": query, "$options": "i"}
        cur = self.tracks.find(q).skip(offset).limit(limit).sort(
            [("album", 1), ("disc_number", 1), ("track_number", 1)]
        )
        return [self._from_doc(MusicTrack, d) async for d in cur]

    async def list_albums(self):
        pipeline = [
            {"$group": {
                "_id": {"album": "$album", "album_artist": "$album_artist"},
                "track_count": {"$sum": 1},
                "year": {"$max": "$year"},
                "cover_track_id": {"$first": "$_id"},
                "has_cover": {"$max": "$has_embedded_cover"},
            }},
            {"$sort": {"_id.album_artist": 1, "_id.album": 1}},
        ]
        out = []
        async for d in self.tracks.aggregate(pipeline):
            out.append({
                "album": d["_id"].get("album", ""),
                "album_artist": d["_id"].get("album_artist", ""),
                "track_count": d["track_count"],
                "year": d.get("year"),
                "cover_track_id": d.get("cover_track_id"),
                "has_cover": bool(d.get("has_cover")),
            })
        return out

    async def list_artists(self):
        pipeline = [
            {"$group": {
                "_id": {"$ifNull": ["$album_artist", "$artist"]},
                "track_count": {"$sum": 1},
                "albums": {"$addToSet": "$album"},
            }},
            {"$sort": {"_id": 1}},
        ]
        out = []
        async for d in self.tracks.aggregate(pipeline):
            name = d["_id"] or ""
            out.append({
                "name": name,
                "track_count": d["track_count"],
                "album_count": len([a for a in d.get("albums", []) if a]),
            })
        return out

    async def delete_tracks_for_library(self, library_id):
        r = await self.tracks.delete_many({"library_id": library_id})
        return r.deleted_count

    async def update_track_play_state(self, track_id, *, increment_play_count=False,
                                      favorite=None):
        upd: Dict[str, Any] = {}
        if favorite is not None:
            upd.setdefault("$set", {})["favorite"] = favorite
        if increment_play_count:
            upd.setdefault("$inc", {})["play_count"] = 1
        if not upd:
            return await self.get_track(track_id)
        await self.tracks.update_one({"_id": track_id}, upd)
        return await self.get_track(track_id)

    # playlists
    async def upsert_playlist(self, pl):
        doc = self._to_doc(pl)
        await self.playlists.replace_one({"_id": pl.id}, doc, upsert=True)
        return pl

    async def get_playlist(self, pl_id):
        doc = await self.playlists.find_one({"_id": pl_id})
        return self._from_doc(Playlist, doc)

    async def list_playlists(self):
        cur = self.playlists.find({}).sort("name", 1)
        return [self._from_doc(Playlist, d) async for d in cur]

    async def delete_playlist(self, pl_id):
        r = await self.playlists.delete_one({"_id": pl_id})
        return r.deleted_count > 0

    # EQ presets
    async def upsert_eq_preset(self, preset):
        doc = self._to_doc(preset)
        await self.eq_presets.replace_one({"_id": preset.id}, doc, upsert=True)
        return preset

    async def get_eq_preset(self, preset_id):
        doc = await self.eq_presets.find_one({"_id": preset_id})
        return self._from_doc(EqPreset, doc)

    async def list_eq_presets(self):
        cur = self.eq_presets.find({}).sort("name", 1)
        return [self._from_doc(EqPreset, d) async for d in cur]

    async def delete_eq_preset(self, preset_id):
        r = await self.eq_presets.delete_one({"_id": preset_id})
        return r.deleted_count > 0

    # prefs
    async def get_pref(self, key):
        doc = await self.prefs.find_one({"_id": key})
        return doc["value"] if doc else None

    async def set_pref(self, key, value):
        await self.prefs.replace_one(
            {"_id": key}, {"_id": key, "value": value}, upsert=True
        )
