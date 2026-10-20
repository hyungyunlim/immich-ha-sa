"""Frame microphones in the Home Assistant media browser.

Each frame with the Frame Mic app shows up under Media > Immich Frame Mic. Playing it streams the
frame's live AAC through Home Assistant, so browsers on HTTPS dashboards and media players reach it
with Home Assistant's own auth instead of the frame's LAN address. Listening still needs the
Frame Mic Stream switch to be on.
"""

from __future__ import annotations

import base64

from aiohttp import ClientError, ClientTimeout, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.components.media_player import MediaClass
from homeassistant.components.media_source import (
    BrowseMediaSource,
    MediaSource,
    MediaSourceItem,
    PlayMedia,
    Unresolvable,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.http import KEY_HASS

from .api import ImmichFrameApiError
from .const import DATA_COORDINATOR, DOMAIN
from .entity_helpers import frame_label

MIC_STREAM_PATH = "/api/immich_frame/mic/{entry_id}"
MDI_MICROPHONE = (
    "M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,"
    "17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"
)


def _tile(state: str) -> str:
    """Square tile for the media browser: off (switch off), ready, or live (someone is listening)."""
    off = state == "off"
    colors = ("#4b5563", "#6b7280") if off else ("#0e4558", "#17707f")  # brand teal from logo.png
    waves = "" if off else (
        '<path d="M42 74A40 40 0 0 0 42 126M158 74A40 40 0 0 1 158 126'
        + ("M26 62A56 56 0 0 0 26 138M174 62A56 56 0 0 1 174 138" if state == "live" else "")
        + '" fill="none" stroke="#3cc1c1" stroke-width="7" stroke-linecap="round"/>'
    )
    mark = {
        "off": '<path d="M64 64L136 136" stroke="#5b6370" stroke-width="18" stroke-linecap="round"/>'
        '<path d="M64 64L136 136" stroke="#fff" stroke-width="8" stroke-linecap="round"/>',
        "live": '<rect x="14" y="14" width="66" height="26" rx="13" fill="#e5484d"/>'
        '<circle cx="29" cy="27" r="5" fill="#fff"/><text x="40" y="32" fill="#fff" '
        'font-family="sans-serif" font-size="14" font-weight="700">LIVE</text>',
    }.get(state, "")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" '
        f'x2="1" y2="1"><stop stop-color="{colors[0]}"/><stop offset="1" stop-color="{colors[1]}"/>'
        '</linearGradient></defs><rect width="200" height="200" fill="url(#g)"/>'
        f'<circle cx="100" cy="100" r="50" fill="#fff" fill-opacity=".12"/>{waves}'
        f'<path transform="translate(64 64) scale(3)" fill="#fff" fill-opacity="{".6" if off else "1"}" '
        f'd="{MDI_MICROPHONE}"/>{mark}</svg>'
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


TILES = {state: _tile(state) for state in ("off", "ready", "live")}


async def async_get_media_source(hass: HomeAssistant) -> ImmichFrameMicSource:
    return ImmichFrameMicSource(hass)


def _coordinators(hass: HomeAssistant) -> dict:
    return {
        entry_id: data[DATA_COORDINATOR]
        for entry_id, data in hass.data.get(DOMAIN, {}).items()
        if isinstance(data, dict) and DATA_COORDINATOR in data
    }


class ImmichFrameMicSource(MediaSource):
    name = "Immich Frame Mic"

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(DOMAIN)
        self.hass = hass

    async def async_resolve_media(self, item: MediaSourceItem) -> PlayMedia:
        if item.identifier not in _coordinators(self.hass):
            raise Unresolvable(f"Unknown frame: {item.identifier}")
        # Relative /api path: Home Assistant signs it for the browser or media player that plays it
        return PlayMedia(MIC_STREAM_PATH.format(entry_id=item.identifier), "audio/aac")

    async def async_browse_media(self, item: MediaSourceItem) -> BrowseMediaSource:
        if item.identifier:
            raise Unresolvable("Frame mics have no children")
        devices = dr.async_get(self.hass)
        children = []
        for entry_id, coordinator in _coordinators(self.hass).items():
            mic = (coordinator.data or {}).get("mic")
            if not isinstance(mic, dict):
                continue  # no Frame Mic key for this frame
            device_id = coordinator.client.device_id
            device = devices.async_get_device(identifiers={(DOMAIN, device_id)})
            name = (device and (device.name_by_user or device.name)) or f"{frame_label(device_id)} Frame"
            enabled = bool(mic.get("enabled"))
            state = "live" if enabled and mic.get("streaming") else "ready" if enabled else "off"
            children.append(
                BrowseMediaSource(
                    domain=DOMAIN,
                    identifier=entry_id,
                    media_class=MediaClass.PODCAST,
                    media_content_type="audio/aac",
                    title=name if enabled else f"{name} (off)",
                    can_play=enabled,
                    can_expand=False,
                    thumbnail=TILES[state],
                )
            )
        children.sort(key=lambda child: child.title.casefold())
        return BrowseMediaSource(
            domain=DOMAIN,
            identifier=None,
            media_class=MediaClass.DIRECTORY,
            media_content_type="",
            title=self.name,
            can_play=False,
            can_expand=True,
            children=children,
            children_media_class=MediaClass.PODCAST,  # grid of tiles
        )


class ImmichFrameMicStreamView(HomeAssistantView):
    """Relays the frame's live AAC stream to an authenticated Home Assistant client."""

    url = MIC_STREAM_PATH
    name = "api:immich_frame:mic"
    requires_auth = True

    async def get(self, request: web.Request, entry_id: str) -> web.StreamResponse:
        hass = request.app[KEY_HASS]
        coordinator = _coordinators(hass).get(entry_id)
        if coordinator is None:
            return web.Response(status=404, text="Unknown frame")
        try:
            mic = await coordinator.client.mic_status()
        except ImmichFrameApiError as err:
            return web.Response(status=502, text=err.message)
        if not mic.get("enabled"):
            return web.Response(status=423, text="Turn on Frame Mic Stream first")

        session = async_get_clientsession(hass)
        response: web.StreamResponse | None = None
        try:
            async with session.get(
                mic["streamUrl"], timeout=ClientTimeout(total=None, sock_connect=10, sock_read=15)
            ) as upstream:
                if upstream.status != 200:
                    return web.Response(status=502, text=f"Frame Mic returned {upstream.status}")
                response = web.StreamResponse(
                    headers={"Content-Type": "audio/aac", "Cache-Control": "no-cache"}
                )
                await response.prepare(request)
                # Ends when the listener goes away (write fails) or the switch is turned off (upstream closes)
                async for chunk in upstream.content.iter_chunked(4096):
                    await response.write(chunk)
        except (ClientError, TimeoutError, ConnectionResetError) as err:
            if response is None:
                return web.Response(status=502, text=f"Frame Mic stream failed: {err}")
        return response
