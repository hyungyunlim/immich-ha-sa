from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities([ImmichFrameAutoBrightnessBinarySensor(coordinator)])


class ImmichFrameAutoBrightnessBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Auto Brightness Active"
        self._attr_unique_id = frame_unique_id(device_id, "auto_brightness_active")
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = "mdi:brightness-auto"

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        remote_status = self.coordinator.data.get("remote_status") or {}
        status = remote_status.get("status")
        if not isinstance(status, dict):
            return None
        auto_brightness = status.get("autoBrightness")
        if not isinstance(auto_brightness, dict):
            return None
        enabled = auto_brightness.get("enabled")
        return bool(enabled) if isinstance(enabled, bool) else None
