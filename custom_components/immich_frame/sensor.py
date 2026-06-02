from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id


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
        return self.coordinator.data.get("state", {}).get("rendererUrl")


class ImmichFrameResolvedNetworkModeSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Resolved Network Mode"
        self._attr_unique_id = frame_unique_id(device_id, "resolved_network_mode")

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("resolvedNetworkMode")
