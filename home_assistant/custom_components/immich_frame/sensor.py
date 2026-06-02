from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][DATA_COORDINATOR]
    async_add_entities([
        ImmichFrameCurrentAlbumSensor(coordinator),
        ImmichFrameRendererUrlSensor(coordinator),
        ImmichFrameResolvedNetworkModeSensor(coordinator),
    ])


class ImmichFrameCurrentAlbumSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    _attr_name = "Lenovo Frame Current Album"
    _attr_unique_id = "immich_frame_lenovo_current_album"

    @property
    def native_value(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if not active:
            return None
        albums = self.coordinator.data.get("albums", {}).get("items", [])
        album = next((album for album in albums if album["id"] == active[0]), None)
        return album["albumName"] if album else active[0]


class ImmichFrameRendererUrlSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    _attr_name = "Lenovo Frame Renderer URL"
    _attr_unique_id = "immich_frame_lenovo_renderer_url"

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("rendererUrl")


class ImmichFrameResolvedNetworkModeSensor(CoordinatorEntity[ImmichFrameCoordinator], SensorEntity):
    _attr_name = "Lenovo Frame Resolved Network Mode"
    _attr_unique_id = "immich_frame_lenovo_resolved_network_mode"

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("resolvedNetworkMode")

