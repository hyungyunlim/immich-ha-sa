"""Frame microphones in the Home Assistant media browser.

Each frame with the Frame Mic app shows up under Media > Immich Frame Mic. Playing it streams the
frame's live AAC through Home Assistant, so browsers on HTTPS dashboards and media players reach it
with Home Assistant's own auth instead of the frame's LAN address. Listening still needs the
Frame Mic Stream switch to be on.
"""

from __future__ import annotations

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
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.http import KEY_HASS

from .api import ImmichFrameApiError
from .const import DATA_COORDINATOR, DOMAIN
from .entity_helpers import frame_label

MIC_STREAM_PATH = "/api/immich_frame/mic/{entry_id}"


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
        children = []
        for entry_id, coordinator in _coordinators(self.hass).items():
            mic = (coordinator.data or {}).get("mic")
            if not isinstance(mic, dict):
                continue  # no Frame Mic key for this frame
            enabled = bool(mic.get("enabled"))
            children.append(
                BrowseMediaSource(
                    domain=DOMAIN,
                    identifier=entry_id,
                    media_class=MediaClass.MUSIC,
                    media_content_type="audio/aac",
                    title=f"{frame_label(coordinator.client.device_id)} Frame Mic"
                    + ("" if enabled else " (switch off)"),
                    can_play=enabled,
                    can_expand=False,
                )
            )
        return BrowseMediaSource(
            domain=DOMAIN,
            identifier=None,
            media_class=MediaClass.DIRECTORY,
            media_content_type="",
            title=self.name,
            can_play=False,
            can_expand=True,
            children=children,
            children_media_class=MediaClass.MUSIC,
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
