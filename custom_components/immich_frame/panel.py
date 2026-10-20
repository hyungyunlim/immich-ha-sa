"""Frames: one sidebar panel for everything you do with the frames themselves.

- Calls: two-way audio with frames running Frame Mic 0.6+. The browser's WebRTC offer goes through
  this integration and the controller; the frame answers automatically and audio then flows directly
  between the browser and the frame, so the caller must reach the frame's network (home LAN or VPN).
- Notices: short family notices the frames show as a pill over the slideshow.
- Agenda: upcoming events from chosen Home Assistant calendars, shown between the notices.
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

from .agenda import AgendaManager
from .api import ImmichFrameApiError, ImmichFrameClient
from .const import DATA_AGENDA, DOMAIN
from .media_source import coordinators, frame_name

API_PATH = "/api/immich_frame"
STATIC_PATH = "/immich_frame_static"


async def async_register_panel(hass: HomeAssistant) -> None:
    hass.http.register_view(ImmichFrameFramesView())
    hass.http.register_view(ImmichFrameCallView())
    hass.http.register_view(ImmichFrameNoticeView())
    hass.http.register_view(ImmichFrameAgendaView())
    agenda = hass.data[DATA_AGENDA] = AgendaManager(hass, lambda: controller_client(hass))
    await agenda.async_start()
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_PATH, str(Path(__file__).parent / "frontend"), cache_headers=False)]
    )
    version = (await async_get_integration(hass, DOMAIN)).version
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path="immich-frame",
        webcomponent_name="immich-frame-panel",
        sidebar_title="Frames",
        sidebar_icon="mdi:image-frame",
        module_url=f"{STATIC_PATH}/panel.js?v={version}",
        require_admin=False,
    )


def controller_client(hass: HomeAssistant) -> ImmichFrameClient | None:
    """Any frame's client: notices live on the controller, not on one frame.

    ponytail: assumes every frame entry talks to the same controller; pick per controller URL if that changes.
    """
    return next((coordinator.client for coordinator in coordinators(hass).values()), None)


def _error(view: HomeAssistantView, err: ImmichFrameApiError) -> web.Response:
    status = {"MIC_DISABLED": 423, "VALIDATION_ERROR": 400, "FRAME_NOT_FOUND": 404, "NOTICE_NOT_FOUND": 404}
    return view.json_message(err.message, status.get(err.code, 502))


class ImmichFrameFramesView(HomeAssistantView):
    """Every frame, with what its Frame Mic supports."""

    url = f"{API_PATH}/frames"
    name = "api:immich_frame:frames"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        devices = dr.async_get(hass)
        frames = []
        for entry_id, coordinator in coordinators(hass).items():
            mic = (coordinator.data or {}).get("mic")
            mic = mic if isinstance(mic, dict) else None  # None: no Frame Mic key
            frames.append(
                {
                    "entry_id": entry_id,
                    "device_id": coordinator.client.device_id,
                    "name": frame_name(devices, coordinator.client.device_id),
                    "mic": mic is not None,
                    "enabled": bool(mic and mic.get("enabled")),
                    "supported": bool(mic and "call" in mic),  # Frame Mic 0.6+
                    "call": mic.get("call") if mic else None,
                }
            )
        frames.sort(key=lambda frame: frame["name"].casefold())
        return self.json(frames)


class ImmichFrameCallView(HomeAssistantView):
    """GET returns the ICE servers for a call, POST {sdp} starts it, DELETE hangs up."""

    url = f"{API_PATH}/call/{{entry_id}}"
    name = "api:immich_frame:call"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str) -> web.Response:
        coordinator = coordinators(request.app[KEY_HASS]).get(entry_id)
        if coordinator is None:
            return self.json_message("Unknown frame", 404)
        try:
            return self.json({"iceServers": await coordinator.client.ice_servers()})
        except ImmichFrameApiError:
            return self.json({"iceServers": []})  # controller before 0.1.95: direct connections only

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
            return _error(self, err)

    async def delete(self, request: web.Request, entry_id: str) -> web.Response:
        coordinator = coordinators(request.app[KEY_HASS]).get(entry_id)
        if coordinator is None:
            return self.json_message("Unknown frame", 404)
        try:
            await coordinator.client.end_call()
        except ImmichFrameApiError as err:
            return _error(self, err)
        return self.json({"ok": True})


class ImmichFrameNoticeView(HomeAssistantView):
    """GET lists notices, POST {text, device_ids?, until?} adds one, DELETE /{id} removes it."""

    url = f"{API_PATH}/notices"
    extra_urls = [f"{API_PATH}/notices/{{notice_id}}"]
    name = "api:immich_frame:notices"
    requires_auth = True

    async def get(self, request: web.Request, notice_id: str | None = None) -> web.Response:
        client = controller_client(request.app[KEY_HASS])
        if client is None:
            return self.json([])
        try:
            return self.json(await client.notices())
        except ImmichFrameApiError as err:
            return _error(self, err)

    async def post(self, request: web.Request, notice_id: str | None = None) -> web.Response:
        client = controller_client(request.app[KEY_HASS])
        if client is None:
            return self.json_message("No frames are set up", 404)
        try:
            body = await request.json()
            text = str(body["text"])
        except (ValueError, KeyError, TypeError):
            return self.json_message("Send the notice as {\"text\": ...}", 400)
        try:
            return self.json(await client.add_notice(text, body.get("device_ids"), body.get("until")))
        except ImmichFrameApiError as err:
            return _error(self, err)

    async def delete(self, request: web.Request, notice_id: str | None = None) -> web.Response:
        client = controller_client(request.app[KEY_HASS])
        if client is None or not notice_id:
            return self.json_message("Unknown notice", 404)
        try:
            await client.delete_notice(notice_id)
        except ImmichFrameApiError as err:
            return _error(self, err)
        return self.json({"ok": True})


class ImmichFrameAgendaView(HomeAssistantView):
    """GET returns the agenda settings and upcoming events; POST {calendars, device_ids, days} saves them."""

    url = f"{API_PATH}/agenda"
    name = "api:immich_frame:agenda"
    requires_auth = True

    def _state(self, agenda: AgendaManager) -> web.Response:
        return self.json({"settings": agenda.settings, "items": agenda.items, "error": agenda.error})

    async def get(self, request: web.Request) -> web.Response:
        return self._state(request.app[KEY_HASS].data[DATA_AGENDA])

    async def post(self, request: web.Request) -> web.Response:
        agenda: AgendaManager = request.app[KEY_HASS].data[DATA_AGENDA]
        try:
            body = await request.json()
            calendars = [str(c) for c in body["calendars"] if str(c).startswith("calendar.")]
            device_ids = [str(d) for d in body["device_ids"]]
            days = int(body["days"])
        except (ValueError, KeyError, TypeError):
            return self.json_message("Send {calendars: [...], device_ids: [...], days: N}", 400)
        if not 1 <= days <= 14:
            return self.json_message("days must be between 1 and 14", 400)
        await agenda.async_update(calendars, device_ids, days)
        return self._state(agenda)
