from __future__ import annotations

from homeassistant.components.number import NumberEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameNumber(
                coordinator,
                "duration",
                "Duration",
                "durationSeconds",
                5,
                3600,
                5,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "fade_transition_duration",
                "Fade Transition Duration",
                "fadeTransitionDuration",
                0,
                20,
                0.5,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "cross_fade_transition_duration",
                "Cross Fade Transition Duration",
                "crossFadeTransitionDuration",
                0,
                20,
                0.5,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_effect_amount",
                "Image Effect Amount",
                "imageEffectAmount",
                100,
                1000,
                10,
                None,
            ),
            ImmichFrameNumber(
                coordinator,
                "filter_newest",
                "Newest Filter",
                "filterNewest",
                0,
                50000,
                1,
                None,
            ),
            ImmichFrameNumber(
                coordinator,
                "burn_in_interval",
                "Burn-in Interval",
                "burnInInterval",
                0,
                1440,
                1,
                "min",
            ),
            ImmichFrameNumber(
                coordinator,
                "burn_in_duration",
                "Burn-in Duration",
                "burnInDuration",
                1,
                3600,
                1,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "burn_in_opacity",
                "Burn-in Opacity",
                "burnInOpacity",
                0,
                100,
                1,
                "%",
            ),
        ]
    )


class ImmichFrameNumber(CoordinatorEntity[ImmichFrameCoordinator], NumberEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        patch_key: str,
        minimum: float,
        maximum: float,
        step: float,
        unit: str | None,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._patch_key = patch_key
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_native_min_value = minimum
        self._attr_native_max_value = maximum
        self._attr_native_step = step
        self._attr_native_unit_of_measurement = unit

    @property
    def native_value(self) -> float | None:
        return self.coordinator.data.get("state", {}).get(self._patch_key)

    async def async_set_native_value(self, value: float) -> None:
        patch_value = int(value) if float(value).is_integer() else value
        await self.coordinator.client.update_frame_state({self._patch_key: patch_value})
        await self.coordinator.async_request_refresh()
