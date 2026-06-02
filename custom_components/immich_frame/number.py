from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities([ImmichFrameDurationNumber(coordinator)])


class ImmichFrameDurationNumber(CoordinatorEntity[ImmichFrameCoordinator], NumberEntity):
    _attr_native_min_value = 5
    _attr_native_max_value = 3600
    _attr_native_step = 5
    _attr_native_unit_of_measurement = "s"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Duration"
        self._attr_unique_id = frame_unique_id(device_id, "duration")

    @property
    def native_value(self) -> int | None:
        return self.coordinator.data.get("state", {}).get("durationSeconds")

    async def async_set_native_value(self, value: float) -> None:
        await self.coordinator.client.update_frame_state({"durationSeconds": int(value)})
        await self.coordinator.async_request_refresh()
