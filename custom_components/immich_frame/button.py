from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities,
) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameRefreshAlbumsButton(coordinator),
            ImmichFrameRefreshPeopleButton(coordinator),
            ImmichFrameCommandButton(coordinator, "previous", "Previous", "previous"),
            ImmichFrameCommandButton(coordinator, "next", "Next", "next"),
            ImmichFrameCommandButton(coordinator, "play_pause", "Play/Pause", "play-pause"),
            ImmichFrameCommandButton(coordinator, "reload", "Reload", "reload"),
            ImmichFrameCommandButton(coordinator, "kiosk_video_mute", "Kiosk Video Mute", "mute-toggle"),
            ImmichFrameCommandButton(coordinator, "screen_on", "Screen On", "screen-on"),
            ImmichFrameCommandButton(coordinator, "screen_off", "Screen Off", "screen-off"),
            ImmichFrameCommandButton(coordinator, "volume_up", "Volume Up", "volume-up"),
            ImmichFrameCommandButton(coordinator, "volume_down", "Volume Down", "volume-down"),
            ImmichFrameCommandButton(coordinator, "device_mute_toggle", "Device Mute Toggle", "device-mute-toggle"),
        ]
    )


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


class ImmichFrameRefreshPeopleButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Refresh People"
        self._attr_unique_id = frame_unique_id(device_id, "refresh_people")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        await self.coordinator.client.refresh_people()
        await self.coordinator.async_request_refresh()


class ImmichFrameCommandButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        command: str,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._command = command
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        await self.coordinator.client.send_command(self._command)
