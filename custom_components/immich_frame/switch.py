from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .remote_status import remote_effective_muted, remote_effective_muted_source, remote_status_bool


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameSleepSwitch(
                coordinator,
                "show_time",
                "Show Time",
                "showTime",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_am_pm",
                "Show AM/PM",
                "showAmPm",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_seconds",
                "Show Seconds",
                "showSeconds",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_date",
                "Show Date",
                "showDate",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_weather",
                "Show Weather",
                "showWeather",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "disable_sleep",
                "Disable Sleep",
                "disableSleep",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "sleep_icon",
                "Sleep Icon",
                "sleepIcon",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "sleep_dim_screen",
                "Sleep Dim Screen",
                "sleepDimScreen",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "background_blur",
                "Background Blur",
                "backgroundBlur",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "frameless",
                "Frameless",
                "frameless",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "disable_navigation",
                "Disable Navigation",
                "disableNavigation",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "hide_cursor",
                "Hide Cursor",
                "hideCursor",
                True,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_progress_bar",
                "Show Progress Bar",
                "showProgressBar",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_videos",
                "Show Videos",
                "showVideos",
                False,
            ),
            ImmichFrameKioskVideoMuteSwitch(coordinator),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_archived",
                "Show Archived",
                "showArchived",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "require_all_people",
                "Require All People",
                "requireAllPeople",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_rating",
                "Show Image Rating",
                "showImageRating",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_owner",
                "Show Owner",
                "showOwner",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_album_name",
                "Show Album Name",
                "showAlbumName",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_person_name",
                "Show Person Name",
                "showPersonName",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_person_age",
                "Show Person Age",
                "showPersonAge",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_time",
                "Show Image Time",
                "showImageTime",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_date",
                "Show Image Date",
                "showImageDate",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_description",
                "Show Image Description",
                "showImageDescription",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_camera",
                "Show Image Camera",
                "showImageCamera",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_exif",
                "Show Image EXIF",
                "showImageExif",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_location",
                "Show Image Location",
                "showImageLocation",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_qr",
                "Show Image QR",
                "showImageQr",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_image_id",
                "Show Image ID",
                "showImageId",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_user",
                "Show User",
                "showUser",
                False,
            ),
            ImmichFrameSleepSwitch(
                coordinator,
                "show_more_info",
                "Show More Info",
                "showMoreInfo",
                True,
            ),
            ImmichFrameRemoteCommandSwitch(
                coordinator,
                "remote_screen",
                "Screen",
                "screen-on",
                "screen-off",
                "mdi:monitor",
                lambda data: remote_status_bool(data, ["screen", "on"]),
            ),
            ImmichFrameRemoteCommandSwitch(
                coordinator,
                "remote_device_mute",
                "Device Mute",
                "device-mute-toggle",
                "device-mute-toggle",
                "mdi:volume-mute",
                remote_effective_muted,
                remote_effective_muted_source,
            ),
        ]
    )


class ImmichFrameSleepSwitch(CoordinatorEntity[ImmichFrameCoordinator], SwitchEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        patch_key: str,
        default: bool,
        icon: str | None = None,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._key = key
        self._patch_key = patch_key
        self._default = default
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        if icon is not None:
            self._attr_icon = icon

    @property
    def is_on(self) -> bool:
        return bool(self.coordinator.data.get("state", {}).get(self._patch_key, self._default))

    async def async_turn_on(self, **kwargs) -> None:
        await self._set_enabled(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._set_enabled(False)

    async def _set_enabled(self, enabled: bool) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: enabled})
        await self.coordinator.async_request_refresh()


class ImmichFrameKioskVideoMuteSwitch(CoordinatorEntity[ImmichFrameCoordinator], SwitchEntity):
    _attr_icon = "mdi:volume-mute"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Kiosk Video Mute"
        self._attr_unique_id = frame_unique_id(device_id, "kiosk_video_mute")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def is_on(self) -> bool:
        return bool(self.coordinator.data.get("state", {}).get("kioskVideoMuted", True))

    async def async_turn_on(self, **kwargs) -> None:
        await self._set_muted(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._set_muted(False)

    async def _set_muted(self, muted: bool) -> None:
        await self.coordinator.client.send_command("mute-on" if muted else "mute-off")
        await self.coordinator.async_request_refresh()


class ImmichFrameRemoteCommandSwitch(CoordinatorEntity[ImmichFrameCoordinator], SwitchEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        turn_on_command: str,
        turn_off_command: str,
        icon: str,
        state_getter,
        source_getter=None,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._turn_on_command = turn_on_command
        self._turn_off_command = turn_off_command
        self._state_getter = state_getter
        self._source_getter = source_getter
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = icon

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return self._state_getter(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, str] | None:
        if not self._source_getter:
            return None
        source = self._source_getter(self.coordinator.data)
        return {"source": source} if source else None

    async def async_turn_on(self, **kwargs) -> None:
        await self._set_target(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._set_target(False)

    async def _set_target(self, target: bool) -> None:
        if self.is_on is target:
            return
        command = self._turn_on_command if target else self._turn_off_command
        await self.coordinator.client.send_command(command)
        await self.coordinator.async_request_refresh()
