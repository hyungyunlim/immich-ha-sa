from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id

SENSITIVE_QUERY_PARAMS = {"api_key", "apikey", "key", "password", "secret", "token"}
MAX_STATE_LENGTH = 255


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameCurrentAlbumSensor(coordinator),
            ImmichFrameRendererUrlSensor(coordinator),
            ImmichFrameResolvedNetworkModeSensor(coordinator),
            ImmichFrameRemoteLightSensor(coordinator),
        ]
    )


class ImmichFrameCurrentAlbumSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Current Albums"
        self._attr_unique_id = frame_unique_id(device_id, "current_album")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def native_value(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if not active:
            return None
        albums = self.coordinator.data.get("albums", {}).get("items", [])
        labels = []
        for album_id in active:
            album = next((album for album in albums if album["id"] == album_id), None)
            labels.append(album["albumName"] if album else album_id)
        return ", ".join(labels)

    @property
    def extra_state_attributes(self) -> dict[str, list[str]] | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        return {"album_ids": active}


class ImmichFrameRendererUrlSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Renderer URL"
        self._attr_unique_id = frame_unique_id(device_id, "renderer_url")
        self._attr_device_info = frame_device_info(device_id)

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
        self._attr_device_info = frame_device_info(device_id)

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("resolvedNetworkMode")


class ImmichFrameRemoteLightSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    _attr_device_class = SensorDeviceClass.ILLUMINANCE
    _attr_native_unit_of_measurement = "lx"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Light Level"
        self._attr_unique_id = frame_unique_id(device_id, "remote_light_level")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and self.native_value is not None

    @property
    def native_value(self) -> float | None:
        remote_status = self.coordinator.data.get("remote_status") or {}
        cursor: Any = remote_status.get("status")
        if not isinstance(cursor, dict):
            return None
        sensors = cursor.get("sensors")
        if not isinstance(sensors, dict):
            return None
        value = sensors.get("light")
        return float(value) if isinstance(value, (int, float)) else None


def redact_sensitive_query_params(url: str) -> str:
    parts = urlsplit(url)
    if not parts.query:
        return url

    query = [
        (key, "[redacted]" if key.lower() in SENSITIVE_QUERY_PARAMS else value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
