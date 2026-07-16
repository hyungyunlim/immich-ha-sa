from __future__ import annotations

from typing import Any

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameAlbumsText(coordinator),
            ImmichFramePeopleText(coordinator),
            ImmichFrameStateText(coordinator, "filter_date", "Date Filter", "filterDate", 128),
            ImmichFrameStateText(
                coordinator,
                "custom_css_class",
                "Custom CSS Class",
                "customCssClass",
                128,
            ),
            ImmichFrameStateText(coordinator, "weather_location", "Weather Location", "weatherLocation", 80),
            ImmichFrameStateText(coordinator, "date_format", "Date Format", "dateFormat", 64),
            ImmichFrameStateText(coordinator, "image_date_format", "Image Date Format", "imageDateFormat", 64),
            ImmichFrameStateText(coordinator, "sleep_start", "Sleep Start", "sleepStart", 4),
            ImmichFrameStateText(coordinator, "sleep_end", "Sleep End", "sleepEnd", 4),
            ImmichFrameProfileDraftText(coordinator, "profile_name", "Profile Name", "profile_name_draft", 80),
            ImmichFrameProfileDraftText(coordinator, "profile_id", "Profile ID", "profile_id_draft", 128),
        ]
    )


class ImmichFrameAlbumsText(CoordinatorEntity[ImmichFrameCoordinator], TextEntity):
    _attr_native_max = 2048

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Albums"
        self._attr_unique_id = frame_unique_id(device_id, "albums")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def native_value(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if not active:
            return ""
        return ", ".join(self._label_for_album_id(album_id) for album_id in active)

    async def async_set_value(self, value: str) -> None:
        album_ids = self._parse_album_ids(value)
        await self.coordinator.client.update_frame_state({"activeAlbumIds": album_ids})
        await self.coordinator.async_request_refresh()

    @property
    def _albums(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("albums", {}).get("items", [])

    def _label_for_album_id(self, album_id: str) -> str:
        album = next((album for album in self._albums if album["id"] == album_id), None)
        return album["albumName"] if album else album_id

    def _parse_album_ids(self, value: str) -> list[str]:
        if value.strip().casefold() in {"none", "no filter", "no album filter", "all photos"}:
            return []

        parts = [part.strip() for part in value.replace("\n", ",").split(",") if part.strip()]
        if not parts:
            return []

        album_ids: list[str] = []
        unknown: list[str] = []
        for part in parts:
            album = self._find_album(part)
            if album:
                album_ids.append(album["id"])
            elif self._albums:
                unknown.append(part)
            else:
                album_ids.append(part)

        if unknown:
            raise HomeAssistantError(f"Unknown Immich album: {', '.join(unknown)}")

        return list(dict.fromkeys(album_ids))

    def _find_album(self, value: str) -> dict[str, Any] | None:
        normalized = value.casefold()
        return next(
            (
                album
                for album in self._albums
                if album["id"] == value or album["albumName"].casefold() == normalized
            ),
            None,
        )


class ImmichFramePeopleText(CoordinatorEntity[ImmichFrameCoordinator], TextEntity):
    _attr_native_max = 2048

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame People"
        self._attr_unique_id = frame_unique_id(device_id, "people")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def native_value(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activePersonIds", [])
        if not active:
            return ""
        return ", ".join(self._label_for_person_id(person_id) for person_id in active)

    async def async_set_value(self, value: str) -> None:
        person_ids = self._parse_person_ids(value)
        await self.coordinator.client.update_frame_state({"activePersonIds": person_ids})
        await self.coordinator.async_request_refresh()

    @property
    def _people(self) -> list[dict[str, Any]]:
        return self.coordinator.data.get("people", {}).get("items", [])

    def _label_for_person_id(self, person_id: str) -> str:
        if person_id == "all":
            return "all"
        person = next((person for person in self._people if person["id"] == person_id), None)
        return self._label_for_person(person) if person else person_id

    def _parse_person_ids(self, value: str) -> list[str]:
        parts = [part.strip() for part in value.replace("\n", ",").split(",") if part.strip()]
        if not parts:
            return []

        person_ids: list[str] = []
        unknown: list[str] = []
        for part in parts:
            if part == "all":
                person_ids.append(part)
                continue
            person = self._find_person(part)
            if person:
                person_ids.append(person["id"])
            elif self._people:
                unknown.append(part)
            else:
                person_ids.append(part)

        if unknown:
            raise HomeAssistantError(f"Unknown Immich person: {', '.join(unknown)}")

        return list(dict.fromkeys(person_ids))

    def _find_person(self, value: str) -> dict[str, Any] | None:
        normalized = value.casefold()
        by_id = next((person for person in self._people if person["id"] == value), None)
        if by_id:
            return by_id

        by_label = next(
            (person for person in self._people if self._label_for_person(person).casefold() == normalized),
            None,
        )
        if by_label:
            return by_label

        by_name = [
            person
            for person in self._people
            if str(person.get("name") or "").strip().casefold() == normalized
        ]
        if len(by_name) == 1:
            return by_name[0]
        if len(by_name) > 1:
            raise HomeAssistantError(
                f"Ambiguous Immich person name: {value}. Use the displayed label or person ID."
            )
        return None

    def _label_for_person(self, person: dict[str, Any]) -> str:
        name = str(person.get("name") or "").strip()
        person_id = str(person.get("id") or "")
        short_id = person_id[:8]
        if not name:
            return f"Unnamed person ({short_id})"
        duplicate_name = sum(1 for candidate in self._people if candidate.get("name") == name) > 1
        return f"{name} ({short_id})" if duplicate_name else name


class ImmichFrameStateText(CoordinatorEntity[ImmichFrameCoordinator], TextEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        patch_key: str,
        native_max: int,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._patch_key = patch_key
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_native_max = native_max

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get(self._patch_key, "")

    async def async_set_value(self, value: str) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: value.strip()})
        await self.coordinator.async_request_refresh()


class ImmichFrameProfileDraftText(CoordinatorEntity[ImmichFrameCoordinator], TextEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        draft_attr: str,
        native_max: int,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._draft_attr = draft_attr
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_native_max = native_max

    @property
    def native_value(self) -> str | None:
        return str(getattr(self.coordinator, self._draft_attr, ""))

    async def async_set_value(self, value: str) -> None:
        setattr(self.coordinator, self._draft_attr, value.strip())
        self.async_write_ha_state()
