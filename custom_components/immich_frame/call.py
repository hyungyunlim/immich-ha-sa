"""Frame Call: a sidebar panel for two-way audio with frames running Frame Mic 0.6+.

The browser sends a WebRTC offer through this authenticated view; the controller passes it to the frame,
which answers automatically. Audio then flows directly between the browser and the frame, so the caller
must reach the frame's network (home LAN or VPN).
"""

from __future__ import annotations

from pathlib import Path

from aiohttp import web

from homeassistant.components import panel_custom
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.http import KEY_HASS
from homeassistant.loader import async_get_integration

from .api import ImmichFrameApiError
from .const import DOMAIN
from .media_source import coordinators, frame_name

CALL_PATH = "/api/immich_frame/call"
STATIC_PATH = "/immich_frame_static"


async def async_register_call_panel(hass: HomeAssistant) -> None:
    hass.http.register_view(ImmichFrameCallView())
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_PATH, str(Path(__file__).parent / "frontend"), cache_headers=False)]
    )
    version = (await async_get_integration(hass, DOMAIN)).version
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path="immich-frame-call",
        webcomponent_name="immich-frame-call-panel",
        sidebar_title="Frame Call",
        sidebar_icon="mdi:phone-in-talk",
        module_url=f"{STATIC_PATH}/call-panel.js?v={version}",
        require_admin=False,
    )


class ImmichFrameCallView(HomeAssistantView):
    """GET lists frames with a Frame Mic; POST {sdp} starts a call; DELETE hangs up."""

    url = CALL_PATH
    extra_urls = [f"{CALL_PATH}/{{entry_id}}"]
    name = "api:immich_frame:call"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str | None = None) -> web.Response:
        hass = request.app[KEY_HASS]
        devices = dr.async_get(hass)
        frames = []
        for frame_entry_id, coordinator in coordinators(hass).items():
            mic = (coordinator.data or {}).get("mic")
            if not isinstance(mic, dict):
                continue  # no Frame Mic key for this frame
            frames.append(
                {
                    "entry_id": frame_entry_id,
                    "name": frame_name(devices, coordinator.client.device_id),
                    "enabled": bool(mic.get("enabled")),
                    "supported": "call" in mic,  # Frame Mic 0.6+
                    "call": mic.get("call"),
                }
            )
        frames.sort(key=lambda frame: frame["name"].casefold())
        return self.json(frames)

    async def post(self, request: web.Request, entry_id: str) -> web.Response:
        coordinator = coordinators(request.app[KEY_HASS]).get(entry_id)
        if coordinator is None:
            return self.json_message("Unknown frame", 404)
        try:
            sdp = (await request.json())["sdp"]
        except (ValueError, KeyError, TypeError):
            return self.json_message("Send the WebRTC offer as {\"sdp\": ...}", 400)
        try:
            return self.json({"sdp": await coordinator.client.start_call(sdp)})
        except ImmichFrameApiError as err:
            return self.json_message(err.message, 423 if err.code == "MIC_DISABLED" else 502)

    async def delete(self, request: web.Request, entry_id: str) -> web.Response:
        coordinator = coordinators(request.app[KEY_HASS]).get(entry_id)
        if coordinator is None:
            return self.json_message("Unknown frame", 404)
        try:
            await coordinator.client.end_call()
        except ImmichFrameApiError as err:
            return self.json_message(err.message, 502)
        return self.json({"ok": True})
