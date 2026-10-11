"""locat_media_adapters — pluggable integration points for Locat 2.0.

Every adapter here is a protocol + a documented MOCK implementation. The
mock implementations are explicitly marked and MUST be replaced by Locat
runtime wiring before production use. They exist so the module runs end
to end in a dev preview without a real Locat host.

MOCK IMPLEMENTATIONS LIVE HERE — DO NOT SHIP TO PRODUCTION AS-IS.
"""
from .auth import AuthAdapter, UserContext, MockLocatAuthAdapter
from .storage import StorageAdapter, MockLocalStorageAdapter
from .device import DevicePairingAdapter, PairedDevice, MockDevicePairingAdapter
from .host import HostAdapter, MockWindowsHostAdapter, MockAndroidCapacitorAdapter

__all__ = [
    "AuthAdapter",
    "UserContext",
    "MockLocatAuthAdapter",
    "StorageAdapter",
    "MockLocalStorageAdapter",
    "DevicePairingAdapter",
    "PairedDevice",
    "MockDevicePairingAdapter",
    "HostAdapter",
    "MockWindowsHostAdapter",
    "MockAndroidCapacitorAdapter",
]
