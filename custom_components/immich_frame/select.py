from __future__ import annotations

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .date_filter import (
    DATE_FILTER_CUSTOM,
    DATE_FILTER_PRESET_OPTIONS,
    DATE_FILTER_PRESETS,
    date_filter_preset_for_value,
)
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameAlbumSelect(coordinator),
            ImmichFrameProfileSelect(coordinator),
            ImmichFrameNetworkModeSelect(coordinator),
            ImmichFrameDateFilterPresetSelect(coordinator),
            ImmichFrameStateSelect(
                coordinator,
                "transition",
                "Transition",
                "transition",
                ["none", "fade", "cross-fade"],
            ),
            ImmichFrameStateSelect(
                coordinator,
                "layout",
                "Layout",
                "layout",
                ["single", "portrait", "landscape", "splitview", "splitview-landscape"],
            ),
            ImmichFrameStateSelect(
                coordinator,
                "image_effect",
                "Image Effect",
                "imageEffect",
                ["none", "zoom", "smart-zoom"],
            ),
            ImmichFrameStateSelect(
                coordinator,
                "progress_bar_position",
                "Progress Bar Position",
                "progressBarPosition",
                ["top", "bottom"],
            ),
            ImmichFrameArrowActionSelect(
                coordinator,
                "up_arrow_action",
                "Up Arrow Action",
                "upArrowAction",
            ),
            ImmichFrameArrowActionSelect(
                coordinator,
                "down_arrow_action",
                "Down Arrow Action",
                "downArrowAction",
            ),
        ]
    )


class ImmichFrameAlbumSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Album"
        self._attr_unique_id = frame_unique_id(device_id, "album")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def options(self) -> list[str]:
        return [album["albumName"] for album in self._albums]

    @property
    def current_option(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if len(active) != 1:
            return None
        album = next((album for album in self._albums if album["id"] == active[0]), None)
        return album["albumName"] if album else active[0]

    async def async_select_option(self, option: str) -> None:
        album = next(album for album in self._albums if album["albumName"] == option)
        await self.coordinator.client.update_frame_state({"activeAlbumIds": [album["id"]]})
        await self.coordinator.async_request_refresh()

    @property
    def _albums(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("albums", {}).get("items", [])


class ImmichFrameProfileSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Profile"
        self._attr_unique_id = frame_unique_id(device_id, "profile")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def options(self) -> list[str]:
        return [profile["name"] for profile in self._profiles]

    @property
    def current_option(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeProfileId")
        if not active:
            return None
        profile = next((profile for profile in self._profiles if profile["id"] == active), None)
        return profile["name"] if profile else active

    async def async_select_option(self, option: str) -> None:
        profile = next(profile for profile in self._profiles if profile["name"] == option)
        await self.coordinator.client.apply_profile(profile["id"])
        await self.coordinator.async_request_refresh()

    @property
    def _profiles(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("profiles", {}).get("items", [])


class ImmichFrameNetworkModeSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    _attr_options = ["auto", "local", "external"]

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Network Mode"
        self._attr_unique_id = frame_unique_id(device_id, "network_mode")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def current_option(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("networkMode")

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({"networkMode": option})
        await self.coordinator.async_request_refresh()


class ImmichFrameDateFilterPresetSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    _attr_options = DATE_FILTER_PRESET_OPTIONS

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Date Filter Preset"
        self._attr_unique_id = frame_unique_id(device_id, "date_filter_preset")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def current_option(self) -> str | None:
        return date_filter_preset_for_value(
            self.coordinator.data.get("state", {}).get("filterDate", "")
        )

    async def async_select_option(self, option: str) -> None:
        if option == DATE_FILTER_CUSTOM:
            return
        await self.coordinator.client.update_frame_state({"filterDate": DATE_FILTER_PRESETS[option]})
        await self.coordinator.async_request_refresh()


class ImmichFrameStateSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        patch_key: str,
        options: list[str],
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._patch_key = patch_key
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_options = options

    @property
    def current_option(self) -> str | None:
        return self.coordinator.data.get("state", {}).get(self._patch_key)

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: option})
        await self.coordinator.async_request_refresh()


class ImmichFrameArrowActionSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    _attr_options = ["none", "mute", "redirects", "pause", "more-info", "fullscreen"]

    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        patch_key: str,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._patch_key = patch_key
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)

    @property
    def current_option(self) -> str | None:
        value = self.coordinator.data.get("state", {}).get(self._patch_key)
        return value or "none"

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: option})
        await self.coordinator.async_request_refresh()
