from __future__ import annotations

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
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
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._key = key
        self._patch_key = patch_key
        self._default = default
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)

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
