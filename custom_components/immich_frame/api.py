from __future__ import annotations

from typing import Any

from aiohttp import ClientSession


class ImmichFrameApiError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ImmichFrameClient:
    def __init__(
        self,
        session: ClientSession,
        controller_url: str,
        device_id: str,
        api_token: str | None = None,
    ) -> None:
        self._session = session
        self._controller_url = controller_url.rstrip("/")
        self.device_id = device_id
        self._api_token = api_token

    async def health(self) -> dict[str, Any]:
        return await self._request("GET", "/api/health")

    async def albums(self) -> dict[str, Any]:
        return await self._request("GET", "/api/immich/albums")

    async def people(self) -> dict[str, Any]:
        return await self._request("GET", "/api/immich/people")

    async def devices(self) -> dict[str, Any]:
        return await self._request("GET", "/api/integration/devices", auth=True)

    async def refresh_albums(self) -> dict[str, Any]:
        return await self._request("POST", "/api/immich/albums/refresh", auth=True)

    async def refresh_people(self) -> dict[str, Any]:
        return await self._request("POST", "/api/immich/people/refresh", auth=True)

    async def pair(self, pairing_code: str, name: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            "/api/pairing/token",
            json={"pairingCode": pairing_code, "name": name},
        )

    async def frame_state(self) -> dict[str, Any]:
        return await self._request("GET", f"/api/frame/{self.device_id}/state")

    async def update_frame_state(self, patch: dict[str, Any]) -> dict[str, Any]:
        return await self._request(
            "PUT",
            f"/api/frame/{self.device_id}/state",
            json=patch,
            auth=True,
        )

    async def profiles(self) -> dict[str, Any]:
        return await self._request("GET", "/api/profiles")

    async def apply_profile(self, profile_id: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/frames/{self.device_id}/apply-profile",
            json={"profileId": profile_id},
            auth=True,
        )

    async def send_command(self, command: str) -> dict[str, Any]:
        return await self._request(
            "POST",
            f"/api/frames/{self.device_id}/command",
            json={"command": command},
            auth=True,
        )

    async def remote_status(self) -> dict[str, Any]:
        return await self._request(
            "GET",
            f"/api/frames/{self.device_id}/remote/status",
            auth=True,
        )

    async def set_remote_brightness(self, value: int) -> dict[str, Any]:
        return await self._request(
            "PUT",
            f"/api/frames/{self.device_id}/remote/brightness",
            json={"value": value},
            auth=True,
        )

    async def set_remote_volume(self, value: int) -> dict[str, Any]:
        return await self._request(
            "PUT",
            f"/api/frames/{self.device_id}/remote/volume",
            json={"value": value},
            auth=True,
        )

    async def _request(
        self,
        method: str,
        path: str,
        json: dict[str, Any] | None = None,
        auth: bool = False,
    ) -> dict[str, Any]:
        headers: dict[str, str] = {}
        if auth and self._api_token:
            headers["Authorization"] = f"Bearer {self._api_token}"
        if method in {"POST", "PUT", "PATCH"} and json is None:
            json = {}

        async with self._session.request(
            method,
            f"{self._controller_url}{path}",
            json=json,
            headers=headers,
            timeout=20,
        ) as response:
            payload = await response.json()
            if not payload.get("success"):
                error = payload.get("error") or {}
                raise ImmichFrameApiError(
                    str(error.get("code") or response.status),
                    str(error.get("message") or "Immich frame controller request failed"),
                )
            return payload["data"]
