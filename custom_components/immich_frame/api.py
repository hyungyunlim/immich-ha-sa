from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import quote

from aiohttp import ClientSession, ClientTimeout


class ImmichFrameApiError(RuntimeError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class TelemetryStreamUnsupported(RuntimeError):
    """Raised when the controller predates the telemetry push endpoint."""


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

    async def upsert_profile(self, profile_id: str, profile: dict[str, Any]) -> dict[str, Any]:
        return await self._request(
            "PUT",
            f"/api/profiles/{quote(profile_id, safe='')}",
            json=profile,
            auth=True,
        )

    async def delete_profile(self, profile_id: str) -> dict[str, Any]:
        return await self._request(
            "DELETE",
            f"/api/profiles/{quote(profile_id, safe='')}",
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

    async def stream_telemetry(self) -> AsyncIterator[dict[str, Any]]:
        """Yield normalized remote-status payloads as the controller pushes them.

        Raises TelemetryStreamUnsupported when the controller has no telemetry
        endpoint (older add-on), so the caller can fall back to polling.
        """
        headers = {"Accept": "text/event-stream"}
        if self._api_token:
            headers["Authorization"] = f"Bearer {self._api_token}"
        # No total timeout (long-lived stream); sock_read must exceed the server's
        # 25s heartbeat so a genuinely dead connection is what triggers a reconnect.
        timeout = ClientTimeout(total=None, sock_connect=20, sock_read=60)
        url = f"{self._controller_url}/api/frames/{self.device_id}/telemetry/events"
        async with self._session.get(url, headers=headers, timeout=timeout) as response:
            if response.status == 404:
                raise TelemetryStreamUnsupported
            response.raise_for_status()
            event = "message"
            pending = ""
            async for raw_line in response.content:
                chunk = raw_line.decode("utf-8")
                # StreamReader can split a long line (the full device-state blob)
                # across iterations; reassemble until the newline arrives.
                if not chunk.endswith("\n"):
                    pending += chunk
                    continue
                line = (pending + chunk).rstrip("\r\n")
                pending = ""
                if line == "":
                    event = "message"
                elif line.startswith("event:"):
                    event = line[6:].strip()
                elif line.startswith("data:"):
                    data = line[5:].strip()
                    if event == "telemetry" and data:
                        try:
                            yield json.loads(data)
                        except ValueError:
                            continue

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
