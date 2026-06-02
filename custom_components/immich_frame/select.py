from __future__ import annotations

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameAlbumSelect(coordinator),
            ImmichFrameProfileSelect(coordinator),
            ImmichFrameNetworkModeSelect(coordinator),
        ]
    )


class ImmichFrameAlbumSelect(CoordinatorEntity[ImmichFrameCoordinator], SelectEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Album"
        self._attr_unique_id = frame_unique_id(device_id, "album")

    @property
    def options(self) -> list[str]:
        return [album["albumName"] for album in self._albums]

    @property
    def current_option(self) -> str | None:
        active = self.coordinator.data.get("state", {}).get("activeAlbumIds", [])
        if not active:
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

    @property
    def current_option(self) -> str | None:
        return self.coordinator.data.get("state", {}).get("networkMode")

    async def async_select_option(self, option: str) -> None:
        await self.coordinator.client.update_frame_state({"networkMode": option})
        await self.coordinator.async_request_refresh()
