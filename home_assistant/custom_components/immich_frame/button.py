from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][DATA_COORDINATOR]
    async_add_entities([ImmichFrameRefreshAlbumsButton(coordinator)])


class ImmichFrameRefreshAlbumsButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    _attr_name = "Lenovo Frame Refresh Albums"
    _attr_unique_id = "immich_frame_lenovo_refresh_albums"

    async def async_press(self) -> None:
        await self.coordinator.client.refresh_albums()
        await self.coordinator.async_request_refresh()

