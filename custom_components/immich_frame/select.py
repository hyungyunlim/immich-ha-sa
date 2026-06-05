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

ALBUM_OPTION_ALL_PHOTOS = "All Photos"
ALBUM_OPTION_MULTIPLE_ALBUMS = "Multiple Albums"
PERSON_OPTION_NO_FILTER = "No Person Filter"
PERSON_OPTION_ALL_NAMED_PEOPLE = "All Named People"
PERSON_OPTION_MULTIPLE_PEOPLE = "Multiple People"


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameAlbumSelect(coordinator),
            ImmichFramePersonSelect(coordinator),
            ImmichFrameProfileSelect(coordinator),
            ImmichFrameNetworkModeSelect(coordinator),
            ImmichFrameMediaContentSelect(coordinator),
            ImmichFrameOrientationSelect(coordinator),
            ImmichFrameDateFilterPresetSelect(coordinator),
            ImmichFrameStateSelect(
                coordinator,
                "time_format",
                "Time Format",
                "timeFormat",
                ["24", "12"],
            ),
            ImmichFrameStateSelect(
                coordinator,
                "clock_source",
                "Clock Source",
                "clockSource",
                ["client", "server"],
            ),
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
                "image_fit",
                "Image Fit",
                "imageFit",
                ["contain", "cover", "none"],
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
            ImmichFrameStateSelect(
                coordinator,
                "image_time_format",
                "Image Time Format",
                "imageTimeFormat",
                ["24", "12"],
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
        active = self._active_album_ids
        options = [ALBUM_OPTION_ALL_PHOTOS]
        if len(active) > 1:
            options.append(ALBUM_OPTION_MULTIPLE_ALBUMS)
        options.extend(album["albumName"] for album in self._albums)
        if len(active) == 1 and not self._album_for_id(active[0]):
            options.append(active[0])
        return list(dict.fromkeys(options))

    @property
    def current_option(self) -> str | None:
        active = self._active_album_ids
        if not active:
            return ALBUM_OPTION_ALL_PHOTOS
        if len(active) > 1:
            return ALBUM_OPTION_MULTIPLE_ALBUMS
        album = self._album_for_id(active[0])
        return album["albumName"] if album else active[0]

    async def async_select_option(self, option: str) -> None:
        if option == ALBUM_OPTION_ALL_PHOTOS:
            await self.coordinator.client.update_frame_state({"activeAlbumIds": []})
            await self.coordinator.async_request_refresh()
            return
        if option == ALBUM_OPTION_MULTIPLE_ALBUMS:
            return
        album = next(album for album in self._albums if album["albumName"] == option)
        await self.coordinator.client.update_frame_state({"activeAlbumIds": [album["id"]]})
        await self.coordinator.async_request_refresh()

    @property
    def _albums(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("albums", {}).get("items", [])

    @property
    def _active_album_ids(self) -> list[str]:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        return active if isinstance(active, list) else []

    def _album_for_id(self, album_id: str) -> dict[str, Any] | None:
        return next((album for album in self._albums if album["id"] == album_id), None)


class ImmichFramePersonSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Person"
        self._attr_unique_id = frame_unique_id(device_id, "person")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def options(self) -> list[str]:
        active = self._active_person_ids
        options = [PERSON_OPTION_NO_FILTER, PERSON_OPTION_ALL_NAMED_PEOPLE]
        if len(active) > 1:
            options.append(PERSON_OPTION_MULTIPLE_PEOPLE)
        options.extend(self._label_for_person(person) for person in self._selectable_people)
        if len(active) == 1 and not self._person_for_id(active[0]):
            options.append(active[0])
        return list(dict.fromkeys(options))

    @property
    def current_option(self) -> str | None:
        active = self._active_person_ids
        if not active:
            return PERSON_OPTION_NO_FILTER
        if active == ["all"]:
            return PERSON_OPTION_ALL_NAMED_PEOPLE
        if len(active) > 1:
            return PERSON_OPTION_MULTIPLE_PEOPLE
        person = self._person_for_id(active[0])
        return self._label_for_person(person) if person else active[0]

    async def async_select_option(self, option: str) -> None:
        if option == PERSON_OPTION_NO_FILTER:
            await self.coordinator.client.update_frame_state({"activePersonIds": []})
            await self.coordinator.async_request_refresh()
            return
        if option == PERSON_OPTION_ALL_NAMED_PEOPLE:
            await self.coordinator.client.update_frame_state({"activePersonIds": ["all"]})
            await self.coordinator.async_request_refresh()
            return
        if option == PERSON_OPTION_MULTIPLE_PEOPLE:
            return
        person = self._person_for_label(option)
        if not person:
            person = self._person_for_id(option)
        if not person:
            return
        await self.coordinator.client.update_frame_state({"activePersonIds": [person["id"]]})
        await self.coordinator.async_request_refresh()

    @property
    def _people(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("people", {}).get("items", [])

    @property
    def _selectable_people(self) -> list[dict[str, Any]]:
        return [person for person in self._people if str(person.get("name") or "").strip()]

    @property
    def _active_person_ids(self) -> list[str]:
        active = self.coordinator.data.get("state", {}).get("activePersonIds", [])
        return active if isinstance(active, list) else []

    def _person_for_id(self, person_id: str) -> dict[str, Any] | None:
        return next((person for person in self._people if person["id"] == person_id), None)

    def _person_for_label(self, label: str) -> dict[str, Any] | None:
        return next(
            (person for person in self._people if self._label_for_person(person) == label),
            None,
        )

    def _label_for_person(self, person: dict[str, Any]) -> str:
        name = str(person.get("name") or "").strip()
        person_id = str(person.get("id") or "")
        short_id = person_id[:8]
        if not name:
            return f"Unnamed person ({short_id})"
        duplicate_name = sum(1 for candidate in self._people if candidate.get("name") == name) > 1
        return f"{name} ({short_id})" if duplicate_name else name


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


class ImmichFrameMediaContentSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    _attr_options = ["Images only", "Images + Videos"]

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Media Content"
        self._attr_unique_id = frame_unique_id(device_id, "media_content")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def current_option(self) -> str | None:
        return "Images + Videos" if self.coordinator.data.get("state", {}).get("showVideos") else "Images only"

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({"showVideos": option == "Images + Videos"})
        await self.coordinator.async_request_refresh()


class ImmichFrameOrientationSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    _OPTION_TO_LAYOUT = {
        "Any": "single",
        "Portrait only": "portrait",
        "Landscape only": "landscape",
        "Portrait pair": "splitview",
        "Landscape pair": "splitview-landscape",
    }
    _LAYOUT_TO_OPTION = {value: key for key, value in _OPTION_TO_LAYOUT.items()}
    _attr_options = list(_OPTION_TO_LAYOUT.keys())

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Orientation"
        self._attr_unique_id = frame_unique_id(device_id, "orientation")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def current_option(self) -> str | None:
        layout = self.coordinator.data.get("state", {}).get("layout")
        return self._LAYOUT_TO_OPTION.get(layout, "Any")

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({"layout": self._OPTION_TO_LAYOUT[option]})
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
