from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][DATA_COORDINATOR]
    async_add_entities([ImmichFrameDurationNumber(coordinator)])


class ImmichFrameDurationNumber(CoordinatorEntity[ImmichFrameCoordinator], NumberEntity):
    _attr_name = "Lenovo Frame Duration"
    _attr_unique_id = "immich_frame_lenovo_duration"
    _attr_native_min_value = 5
    _attr_native_max_value = 3600
    _attr_native_step = 5
    _attr_native_unit_of_measurement = "s"

    @property
    def native_value(self) -> int | None:
        return self.coordinator.data.get("state", {}).get("durationSeconds")

    async def async_set_native_value(self, value: float) -> None:
        await self.coordinator.client.update_frame_state({"durationSeconds": int(value)})
        await self.coordinator.async_request_refresh()

