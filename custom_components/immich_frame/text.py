from __future__ import annotations

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameSleepTimeText(coordinator, "sleep_start", "Sleep Start", "sleepStart"),
            ImmichFrameSleepTimeText(coordinator, "sleep_end", "Sleep End", "sleepEnd"),
        ]
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

    @property
    def native_value(self) -> str | None:
        return self.coordinator.data.get("state", {}).get(self._patch_key, "")

    async def async_set_value(self, value: str) -> None:
        await self.coordinator.client.update_frame_state({self._patch_key: value.strip()})
        await self.coordinator.async_request_refresh()
