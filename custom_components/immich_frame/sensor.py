from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id

SENSITIVE_QUERY_PARAMS = {"api_key", "apikey", "key", "password", "secret", "token"}
MAX_STATE_LENGTH = 255


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameCurrentAlbumSensor(coordinator),
            ImmichFrameRendererUrlSensor(coordinator),
            ImmichFrameResolvedNetworkModeSensor(coordinator),
        ]
    )


class ImmichFrameCurrentAlbumSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Current Album"
        self._attr_unique_id = frame_unique_id(device_id, "current_album")

    @property
    def native_value(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if not active:
            return None
        albums = self.coordinator.data.get("albums", {}).get("items", [])
        album = next((album for album in albums if album["id"] == active[0]), None)
        return album["albumName"] if album else active[0]


class ImmichFrameRendererUrlSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Renderer URL"
        self._attr_unique_id = frame_unique_id(device_id, "renderer_url")

    @property
    def native_value(self) -> str | None:
        redacted_url = self._redacted_renderer_url
        if not redacted_url:
            return None
        if len(redacted_url) >= MAX_STATE_LENGTH:
            return "available"
        return redacted_url

    @property
    def extra_state_attributes(self) -> dict[str, str] | None:
        redacted_url = self._redacted_renderer_url
        if not redacted_url:
            return None
        return {"url": redacted_url}

    @property
    def _redacted_renderer_url(self) -> str | None:
        renderer_url = self.coordinator.data.get("state", {}).get("rendererUrl")
        if not renderer_url:
            return None
        return redact_sensitive_query_params(renderer_url)


class ImmichFrameResolvedNetworkModeSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Resolved Network Mode"
        self._attr_unique_id = frame_unique_id(device_id, "resolved_network_mode")

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("resolvedNetworkMode")


def redact_sensitive_query_params(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url

    query = [
        (key, "[redacted]" if key.lower() in SENSITIVE_QUERY_PARAMS else value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
