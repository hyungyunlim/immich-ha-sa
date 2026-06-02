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
            ImmichFrameSleepTimeText(coordinator, "sleep_start", "Sleep Start", "sleepStart"),
            ImmichFrameSleepTimeText(coordinator, "sleep_end", "Sleep End", "sleepEnd"),
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


class ImmichFrameSleepTimeText(CoordinatorEntity[ImmichFrameCoordinator], TextEntity):
    _attr_native_max = 4

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
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get(self._patch_key, "")

    async def async_set_value(self, value: str) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: value.strip()})
        await self.coordinator.async_request_refresh()
