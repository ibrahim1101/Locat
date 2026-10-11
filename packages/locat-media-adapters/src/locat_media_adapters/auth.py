"""Authentication adapter contract.

Locat 2.0 already has its own authentication system. The media module
MUST NOT create a parallel user system. This adapter wraps whatever
Locat already provides.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol, runtime_checkable


@dataclass
class UserContext:
    user_id: str
    display_name: str
    device_id: Optional[str] = None
    is_admin: bool = False


@runtime_checkable
class AuthAdapter(Protocol):
    """Verify a request against Locat's own identity source."""

    async def verify(self, authorization_header: Optional[str]) -> Optional[UserContext]:
        """Return the authenticated UserContext, or None if invalid."""
        ...


class MockLocatAuthAdapter:
    """DEV-ONLY mock. Replace with the real Locat auth adapter.

    Honors a shared static token read from the environment variable
    ``LOCAT_DEV_TOKEN``. When that token matches the bearer value, a
    deterministic dev user context is produced. When ``LOCAT_DEV_MODE`` is
    enabled, requests without any Authorization header are accepted so
    the dev preview can run without a login screen (Locat owns the real
    login). This adapter must never be used in production.
    """

    def __init__(self, dev_token: str = "locat-dev-token", dev_mode: bool = True) -> None:
        self.dev_token = dev_token
        self.dev_mode = dev_mode

    async def verify(self, authorization_header):
        if authorization_header:
            scheme, _, value = authorization_header.partition(" ")
            if scheme.lower() == "bearer" and value == self.dev_token:
                return UserContext(
                    user_id="dev-user",
                    display_name="Locat Dev User",
                    device_id="dev-device",
                    is_admin=True,
                )
            return None
        if self.dev_mode:
            return UserContext(
                user_id="dev-user",
                display_name="Locat Dev User",
                device_id="dev-device",
                is_admin=True,
            )
        return None
