from __future__ import annotations

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import aiohttp_client, config_validation as cv, discovery

from .api import ImmichFrameClient
from .const import (
    CONF_API_TOKEN,
    CONF_CONTROLLER_URL,
    CONF_DEVICE_ID,
    DATA_CLIENT,
    DATA_COORDINATOR,
    DEFAULT_DEVICE_ID,
    DOMAIN,
    SERVICE_REFRESH_ALBUMS,
    SERVICE_SET_ALBUM,
    SERVICE_SET_NETWORK_MODE,
    SERVICE_SET_PROFILE,
    SERVICE_SET_RENDERER_OPTIONS,
)
from .coordinator import ImmichFrameCoordinator

CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Required(CONF_CONTROLLER_URL): cv.url,
                vol.Optional(CONF_API_TOKEN): cv.string,
                vol.Optional(CONF_DEVICE_ID, default=DEFAULT_DEVICE_ID): cv.string,
            }
        )
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    conf = config.get(DOMAIN)
    if not conf:
        return True

    controller_url = conf[CONF_CONTROLLER_URL]
    device_id = conf[CONF_DEVICE_ID]
    session = aiohttp_client.async_get_clientsession(hass)
    client = ImmichFrameClient(session, controller_url, device_id, conf.get(CONF_API_TOKEN))
    coordinator = ImmichFrameCoordinator(hass, client)
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN] = {
        DATA_CLIENT: client,
        DATA_COORDINATOR: coordinator,
    }

    for platform in ("select", "number", "button", "sensor"):
        hass.async_create_task(discovery.async_load_platform(hass, platform, DOMAIN, {}, config))

    async def set_album(call: ServiceCall) -> None:
        album_ids = call.data.get("album_ids")
        album_id = call.data.get("album_id")
        await client.update_frame_state({"activeAlbumIds": album_ids or [album_id]})
        await coordinator.async_request_refresh()

    async def set_profile(call: ServiceCall) -> None:
        await client.apply_profile(call.data["profile_id"])
        await coordinator.async_request_refresh()

    async def refresh_albums(call: ServiceCall) -> None:
        await client.refresh_albums()
        await coordinator.async_request_refresh()

    async def set_renderer_options(call: ServiceCall) -> None:
        patch = {key: value for key, value in call.data.items() if value is not None}
        await client.update_frame_state(patch)
        await coordinator.async_request_refresh()

    async def set_network_mode(call: ServiceCall) -> None:
        await client.update_frame_state({"networkMode": call.data["network_mode"]})
        await coordinator.async_request_refresh()

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_ALBUM,
        set_album,
        schema=vol.Schema(
            {
                vol.Optional("album_id"): cv.string,
                vol.Optional("album_ids"): vol.All(cv.ensure_list, [cv.string]),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_PROFILE,
        set_profile,
        schema=vol.Schema({"profile_id": cv.string}),
    )
    hass.services.async_register(DOMAIN, SERVICE_REFRESH_ALBUMS, refresh_albums)
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_RENDERER_OPTIONS,
        set_renderer_options,
        schema=vol.Schema(
            {
                vol.Optional("durationSeconds"): cv.positive_int,
                vol.Optional("imageFit"): vol.In(["contain", "cover", "none"]),
                vol.Optional("showTime"): cv.boolean,
                vol.Optional("showDate"): cv.boolean,
                vol.Optional("showWeather"): cv.boolean,
                vol.Optional("albumOrder"): vol.In(["random", "newest", "oldest"]),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_NETWORK_MODE,
        set_network_mode,
        schema=vol.Schema({"network_mode": vol.In(["auto", "local", "external"])}),
    )
    return True
