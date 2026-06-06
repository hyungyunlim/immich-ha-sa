from __future__ import annotations

from homeassistant.components.light import ATTR_BRIGHTNESS, ColorMode, LightEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .remote_status import remote_status_bool, remote_status_value


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities([ImmichFrameDisplayLight(coordinator)])


class ImmichFrameDisplayLight(CoordinatorEntity[ImmichFrameCoordinator], LightEntity):
    _attr_color_mode = ColorMode.BRIGHTNESS
    _attr_supported_color_modes = {ColorMode.BRIGHTNESS}
    _attr_icon = "mdi:monitor"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Display"
        self._attr_unique_id = frame_unique_id(device_id, "remote_display_light")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return remote_status_bool(self.coordinator.data, ["screen", "on"])

    @property
    def brightness(self) -> int | None:
        value = remote_status_value(self.coordinator.data, ["screen", "brightness"])
        if not isinstance(value, (int, float)):
            return None
        percent = max(0, min(100, float(value)))
        return round(percent * 255 / 100)

    async def async_turn_on(self, **kwargs) -> None:
        if self.is_on is not True:
            await self.coordinator.client.send_command("screen-on")

        brightness = kwargs.get(ATTR_BRIGHTNESS)
        if isinstance(brightness, (int, float)):
            percent = round(max(0, min(255, float(brightness))) * 100 / 255)
            await self.coordinator.client.set_remote_brightness(percent)

        await self.coordinator.async_request_refresh()

    async def async_turn_off(self, **kwargs) -> None:
        if self.is_on is not False:
            await self.coordinator.client.send_command("screen-off")
            await self.coordinator.async_request_refresh()
