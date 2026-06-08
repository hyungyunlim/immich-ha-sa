from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .profile_helpers import (
    profile_from_frame_state,
    profile_id_for_delete,
    profile_id_for_save,
    profile_name_for_save,
)


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
            ImmichFrameSaveProfileButton(coordinator),
            ImmichFrameDeleteProfileButton(coordinator),
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


class ImmichFrameSaveProfileButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    _attr_icon = "mdi:content-save"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Save Profile"
        self._attr_unique_id = frame_unique_id(device_id, "save_profile")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        state = await self.coordinator.client.frame_state()
        profiles = await self.coordinator.client.profiles()
        requested_name = self.coordinator.profile_name_draft
        requested_profile_id = self.coordinator.profile_id_draft
        name = profile_name_for_save(profiles, state, requested_name, requested_profile_id)
        profile_id = profile_id_for_save(name, requested_profile_id, state, requested_name)
        profile = profile_from_frame_state(state, profile_id, name)
        await self.coordinator.client.upsert_profile(profile_id, profile)
        await self.coordinator.client.update_frame_state({"activeProfileId": profile_id})
        self.coordinator.profile_name_draft = name
        self.coordinator.profile_id_draft = profile_id
        await self.coordinator.async_request_refresh()


class ImmichFrameDeleteProfileButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    _attr_icon = "mdi:delete"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Delete Profile"
        self._attr_unique_id = frame_unique_id(device_id, "delete_profile")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        state = await self.coordinator.client.frame_state()
        profile_id = profile_id_for_delete(self.coordinator.profile_id_draft, state)
        if profile_id == "default":
            raise HomeAssistantError("The default profile cannot be deleted")
        await self.coordinator.client.delete_profile(profile_id)
        if self.coordinator.profile_id_draft == profile_id:
            self.coordinator.profile_id_draft = ""
        await self.coordinator.async_request_refresh()
