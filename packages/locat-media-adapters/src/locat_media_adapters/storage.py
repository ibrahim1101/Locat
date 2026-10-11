"""Storage adapter contract.

Guards filesystem access from the media server so that:
 - canonical paths are enforced (no .. traversal),
 - only user-authorized library roots are readable,
 - media files are NEVER writable/deletable through this adapter.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable, List, Protocol, runtime_checkable


@runtime_checkable
class StorageAdapter(Protocol):
    def authorized_roots(self) -> List[Path]: ...
    def is_authorized_path(self, path: str) -> bool: ...
    def canonicalize(self, path: str) -> Path: ...
    def iter_files(self, root: Path, extensions: Iterable[str]) -> Iterable[Path]: ...


class MockLocalStorageAdapter:
    """DEV-ONLY local filesystem storage adapter.

    Keeps a mutable set of authorized roots. Real Locat deployment should
    use the Windows host adapter's authorized library directories and
    OS-level ACLs.
    """

    def __init__(self, authorized_roots: Iterable[str]) -> None:
        self._roots: List[Path] = []
        for r in authorized_roots:
            try:
                self._roots.append(Path(r).resolve(strict=False))
            except OSError:
                continue

    def add_root(self, root: str) -> Path:
        p = Path(root).resolve(strict=False)
        if p not in self._roots:
            self._roots.append(p)
        return p

    def remove_root(self, root: str) -> bool:
        p = Path(root).resolve(strict=False)
        if p in self._roots:
            self._roots.remove(p)
            return True
        return False

    def authorized_roots(self) -> List[Path]:
        return list(self._roots)

    def canonicalize(self, path: str) -> Path:
        return Path(path).resolve(strict=False)

    def is_authorized_path(self, path: str) -> bool:
        try:
            target = Path(path).resolve(strict=False)
        except OSError:
            return False
        for r in self._roots:
            try:
                target.relative_to(r)
                return True
            except ValueError:
                continue
        return False

    def iter_files(self, root: Path, extensions):
        exts = tuple(e.lower().lstrip(".") for e in extensions)
        if not root.exists() or not root.is_dir():
            return []
        results: List[Path] = []
        for dirpath, _dirnames, filenames in os.walk(root):
            for fn in filenames:
                if fn.lower().rsplit(".", 1)[-1] in exts:
                    results.append(Path(dirpath) / fn)
        return results
