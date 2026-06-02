from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities([ImmichFrameRefreshAlbumsButton(coordinator)])


class ImmichFrameRefreshAlbumsButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Refresh Albums"
        self._attr_unique_id = frame_unique_id(device_id, "refresh_albums")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        await self.coordinator.client.refresh_albums()
        await self.coordinator.async_request_refresh()
