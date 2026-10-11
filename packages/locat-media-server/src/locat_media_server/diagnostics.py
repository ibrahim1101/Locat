"""Playback session + diagnostics registry (in-memory)."""
from __future__ import annotations

import time
from typing import Dict, Optional

from locat_media_core import DiagnosticsSnapshot, PlaybackPathType, PlaybackSession


class DiagnosticsRegistry:
    def __init__(self) -> None:
        self._sessions: Dict[str, PlaybackSession] = {}
        self._diagnostics: Dict[str, DiagnosticsSnapshot] = {}
        self._byte_history: Dict[str, list] = {}

    def start_session(self, session: PlaybackSession) -> PlaybackSession:
        self._sessions[session.id] = session
        self._byte_history[session.id] = []
        return session

    def end_session(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if s:
            s.is_active = False

    def record_bytes(self, session_id: str, nbytes: int) -> None:
        s = self._sessions.get(session_id)
        if not s:
            return
        s.bytes_served += nbytes
        hist = self._byte_history.setdefault(session_id, [])
        now = time.monotonic()
        hist.append((now, nbytes))
        # keep last 5 seconds for throughput estimation
        cutoff = now - 5.0
        while hist and hist[0][0] < cutoff:
            hist.pop(0)

    def record_range(self, session_id: str, start: int, end: int) -> None:
        s = self._sessions.get(session_id)
        if s:
            s.last_range_start = start
            s.last_range_end = end

    def estimated_bps(self, session_id: str) -> Optional[int]:
        hist = self._byte_history.get(session_id)
        if not hist or len(hist) < 2:
            return None
        total = sum(nb for _, nb in hist)
        span = hist[-1][0] - hist[0][0]
        if span <= 0:
            return None
        return int((total * 8) / span)

    def get_session(self, session_id: str) -> Optional[PlaybackSession]:
        return self._sessions.get(session_id)

    def set_diagnostics(self, snapshot: DiagnosticsSnapshot) -> None:
        self._diagnostics[snapshot.session_id] = snapshot

    def get_diagnostics(self, session_id: str) -> Optional[DiagnosticsSnapshot]:
        snap = self._diagnostics.get(session_id)
        if not snap:
            return None
        snap.estimated_network_bps = self.estimated_bps(session_id)
        session = self.get_session(session_id)
        if session:
            snap.stalls = session.stalls
        return snap

    def active_count(self) -> int:
        return sum(1 for s in self._sessions.values() if s.is_active)
