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
    Platform.BINARY_SENSOR,
    Platform.SELECT,
    Platform.NUMBER,
    Platform.BUTTON,
    Platform.DATE,
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
        album_names = call.data.get("album_names")
        album_name = call.data.get("album_name")
        if album_names or album_name:
            selected_album_ids = _album_ids_for_names(
                coordinator.data.get("albums", {}).get("items", []),
                album_names or [album_name],
            )
        elif album_ids or album_id:
            selected_album_ids = album_ids or [album_id]
        else:
            raise HomeAssistantError("album_id, album_ids, album_name, or album_names is required")
        await client.update_frame_state({"activeAlbumIds": selected_album_ids})
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
                vol.Optional("album_name"): cv.string,
                vol.Optional("album_names"): vol.All(cv.ensure_list, [cv.string]),
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
                vol.Optional("timeFormat"): vol.In(["24", "12"]),
                vol.Optional("showAmPm"): cv.boolean,
                vol.Optional("showSeconds"): cv.boolean,
                vol.Optional("showDate"): cv.boolean,
                vol.Optional("dateFormat"): cv.string,
                vol.Optional("clockSource"): vol.In(["client", "server"]),
                vol.Optional("showWeather"): cv.boolean,
                vol.Optional("weatherLocation"): cv.string,
                vol.Optional("weatherRotationInterval"): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
                vol.Optional("showVideos"): cv.boolean,
                vol.Optional("filterDate"): cv.string,
                vol.Optional("filterNewest"): vol.All(vol.Coerce(int), vol.Range(min=0, max=50000)),
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
                vol.Optional("backgroundBlurAmount"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
                vol.Optional("fontSize"): vol.All(vol.Coerce(int), vol.Range(min=50, max=250)),
                vol.Optional("frameless"): cv.boolean,
                vol.Optional("disableNavigation"): cv.boolean,
                vol.Optional("hideCursor"): cv.boolean,
                vol.Optional("showProgressBar"): cv.boolean,
                vol.Optional("progressBarPosition"): vol.In(["top", "bottom"]),
                vol.Optional("showImageRating"): cv.boolean,
                vol.Optional("showOwner"): cv.boolean,
                vol.Optional("showAlbumName"): cv.boolean,
                vol.Optional("showPersonName"): cv.boolean,
                vol.Optional("showPersonAge"): cv.boolean,
                vol.Optional("showImageTime"): cv.boolean,
                vol.Optional("imageTimeFormat"): vol.In(["24", "12"]),
                vol.Optional("showImageDate"): cv.boolean,
                vol.Optional("imageDateFormat"): cv.string,
                vol.Optional("showImageDescription"): cv.boolean,
                vol.Optional("showImageCamera"): cv.boolean,
                vol.Optional("showImageExif"): cv.boolean,
                vol.Optional("showImageLocation"): cv.boolean,
                vol.Optional("showImageQr"): cv.boolean,
                vol.Optional("showImageId"): cv.boolean,
                vol.Optional("showUser"): cv.boolean,
                vol.Optional("showMoreInfo"): cv.boolean,
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


def _album_ids_for_names(albums: list[dict], names: list[str]) -> list[str]:
    selected: list[str] = []
    unknown: list[str] = []
    for name in names:
        normalized = str(name).strip().casefold()
        album = next(
            (
                album
                for album in albums
                if album.get("albumName", "").casefold() == normalized or album.get("id") == name
            ),
            None,
        )
        if album:
            selected.append(album["id"])
        else:
            unknown.append(str(name))

    if unknown:
        raise HomeAssistantError(f"Unknown Immich album: {', '.join(unknown)}")

    return list(dict.fromkeys(selected))
