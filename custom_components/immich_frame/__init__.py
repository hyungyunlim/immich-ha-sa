from __future__ import annotations

from aiohttp import ClientError
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ConfigEntryAuthFailed, ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers import aiohttp_client, config_validation as cv

from .api import ImmichFrameApiError, ImmichFrameClient
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

PLATFORMS = [
    Platform.SELECT,
    Platform.NUMBER,
    Platform.BUTTON,
    Platform.SENSOR,
    Platform.SWITCH,
    Platform.TEXT,
]

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
    hass.data.setdefault(DOMAIN, {})
    _register_services(hass)

    conf = config.get(DOMAIN)
    if conf:
        hass.async_create_task(
            hass.config_entries.flow.async_init(
                DOMAIN,
                context={"source": config_entries.SOURCE_IMPORT},
                data={
                    CONF_CONTROLLER_URL: conf[CONF_CONTROLLER_URL],
                    CONF_API_TOKEN: conf.get(CONF_API_TOKEN),
                    CONF_DEVICE_ID: conf[CONF_DEVICE_ID],
                },
            )
        )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    session = aiohttp_client.async_get_clientsession(hass)
    client = ImmichFrameClient(
        session,
        entry.data[CONF_CONTROLLER_URL],
        entry.data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID),
        entry.data.get(CONF_API_TOKEN),
    )
    coordinator = ImmichFrameCoordinator(hass, client)

    try:
        await coordinator.async_config_entry_first_refresh()
    except ImmichFrameApiError as err:
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise ConfigEntryAuthFailed(err.message) from err
        raise ConfigEntryNotReady(err.message) from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise ConfigEntryNotReady("Unable to connect to Immich frame controller") from err

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = {
        DATA_CLIENT: client,
        DATA_COORDINATOR: coordinator,
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


def _register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_SET_ALBUM):
        return

    async def set_album(call: ServiceCall) -> None:
        client, coordinator = _runtime_for_call(hass, call)
        album_ids = call.data.get("album_ids")
        album_id = call.data.get("album_id")
        if not album_ids and not album_id:
            raise HomeAssistantError("album_id or album_ids is required")
        await client.update_frame_state({"activeAlbumIds": album_ids or [album_id]})
        await coordinator.async_request_refresh()

    async def set_profile(call: ServiceCall) -> None:
        client, coordinator = _runtime_for_call(hass, call)
        await client.apply_profile(call.data["profile_id"])
        await coordinator.async_request_refresh()

    async def refresh_albums(call: ServiceCall) -> None:
        client, coordinator = _runtime_for_call(hass, call)
        await client.refresh_albums()
        await coordinator.async_request_refresh()

    async def set_renderer_options(call: ServiceCall) -> None:
        client, coordinator = _runtime_for_call(hass, call)
        patch = {
            key: value
            for key, value in call.data.items()
            if key != CONF_DEVICE_ID and value is not None
        }
        await client.update_frame_state(patch)
        await coordinator.async_request_refresh()

    async def set_network_mode(call: ServiceCall) -> None:
        client, coordinator = _runtime_for_call(hass, call)
        await client.update_frame_state({"networkMode": call.data["network_mode"]})
        await coordinator.async_request_refresh()

    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_ALBUM,
        set_album,
        schema=vol.Schema(
            {
                vol.Optional(CONF_DEVICE_ID): cv.string,
                vol.Optional("album_id"): cv.string,
                vol.Optional("album_ids"): vol.All(cv.ensure_list, [cv.string]),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_PROFILE,
        set_profile,
        schema=vol.Schema({vol.Optional(CONF_DEVICE_ID): cv.string, "profile_id": cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_REFRESH_ALBUMS,
        refresh_albums,
        schema=vol.Schema({vol.Optional(CONF_DEVICE_ID): cv.string}),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_RENDERER_OPTIONS,
        set_renderer_options,
        schema=vol.Schema(
            {
                vol.Optional(CONF_DEVICE_ID): cv.string,
                vol.Optional("durationSeconds"): cv.positive_int,
                vol.Optional("imageFit"): vol.In(["contain", "cover", "none"]),
                vol.Optional("showTime"): cv.boolean,
                vol.Optional("showDate"): cv.boolean,
                vol.Optional("showWeather"): cv.boolean,
                vol.Optional("albumOrder"): vol.In(["random", "newest", "oldest"]),
                vol.Optional("transition"): vol.In(["none", "fade", "cross-fade"]),
                vol.Optional("fadeTransitionDuration"): vol.Coerce(float),
                vol.Optional("crossFadeTransitionDuration"): vol.Coerce(float),
                vol.Optional("layout"): vol.In(
                    ["single", "portrait", "landscape", "splitview", "splitview-landscape"]
                ),
                vol.Optional("imageEffect"): vol.In(["none", "zoom", "smart-zoom"]),
                vol.Optional("imageEffectAmount"): cv.positive_int,
                vol.Optional("backgroundBlur"): cv.boolean,
                vol.Optional("frameless"): cv.boolean,
                vol.Optional("disableNavigation"): cv.boolean,
                vol.Optional("hideCursor"): cv.boolean,
                vol.Optional("showProgressBar"): cv.boolean,
                vol.Optional("progressBarPosition"): vol.In(["top", "bottom"]),
                vol.Optional("burnInInterval"): vol.All(vol.Coerce(int), vol.Range(min=0, max=1440)),
                vol.Optional("burnInDuration"): vol.All(vol.Coerce(int), vol.Range(min=1, max=3600)),
                vol.Optional("burnInOpacity"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
                vol.Optional("sleepStart"): cv.string,
                vol.Optional("sleepEnd"): cv.string,
                vol.Optional("sleepIcon"): cv.boolean,
                vol.Optional("sleepDimScreen"): cv.boolean,
                vol.Optional("disableSleep"): cv.boolean,
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SET_NETWORK_MODE,
        set_network_mode,
        schema=vol.Schema(
            {
                vol.Optional(CONF_DEVICE_ID): cv.string,
                "network_mode": vol.In(["auto", "local", "external"]),
            }
        ),
    )


def _runtime_for_call(
    hass: HomeAssistant,
    call: ServiceCall,
) -> tuple[ImmichFrameClient, ImmichFrameCoordinator]:
    device_id = call.data.get(CONF_DEVICE_ID)
    runtimes = hass.data.get(DOMAIN, {})
    if not runtimes:
        raise HomeAssistantError("No Immich frame controller is configured")

    if device_id:
        for runtime in runtimes.values():
            client = runtime[DATA_CLIENT]
            if client.device_id == device_id:
                return client, runtime[DATA_COORDINATOR]
        raise HomeAssistantError(f"No Immich frame controller configured for {device_id}")

    if len(runtimes) > 1:
        raise HomeAssistantError("device_id is required when multiple frames are configured")

    runtime = next(iter(runtimes.values()))
    return runtime[DATA_CLIENT], runtime[DATA_COORDINATOR]
