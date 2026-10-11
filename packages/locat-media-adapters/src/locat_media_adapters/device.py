"""Device-pairing adapter contract.

Locat's existing device pairing / messaging trust model is the source of
truth. The media server only asks: "is this device allowed to stream?".
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Protocol, runtime_checkable


@dataclass
class PairedDevice:
    device_id: str
    display_name: str
    user_id: str
    platform: str                # "windows" | "android" | "web" | ...
    trusted: bool = True


@runtime_checkable
class DevicePairingAdapter(Protocol):
    async def list_devices(self, user_id: str) -> List[PairedDevice]: ...
    async def is_trusted(self, user_id: str, device_id: Optional[str]) -> bool: ...


class MockDevicePairingAdapter:
    """DEV-ONLY mock: trusts every device. Replace in production."""

    async def list_devices(self, user_id):
        return [
            PairedDevice(
                device_id="dev-device",
                display_name="Dev Preview Browser",
                user_id=user_id,
                platform="web",
                trusted=True,
            ),
        ]

    async def is_trusted(self, user_id, device_id):
        return True
