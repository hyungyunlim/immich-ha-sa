from __future__ import annotations

from typing import Any

from homeassistant.components.number import NumberEntity, NumberMode
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
                "background_blur_amount",
                "Background Blur Amount",
                "backgroundBlurAmount",
                0,
                100,
                1,
                None,
            ),
            ImmichFrameNumber(
                coordinator,
                "font_size",
                "Font Size",
                "fontSize",
                50,
                250,
                1,
                "%",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_description_scroll_duration",
                "Image Description Scroll Duration",
                "imageDescriptionScrollDuration",
                10,
                240,
                1,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_description_area_height",
                "Image Description Area Height",
                "imageDescriptionAreaHeight",
                3,
                12,
                0.25,
                "rem",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_description_start_delay",
                "Image Description Start Delay",
                "imageDescriptionStartDelay",
                0,
                60,
                0.5,
                "s",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_description_overlay_opacity",
                "Image Description Overlay Opacity",
                "imageDescriptionOverlayOpacity",
                0,
                60,
                1,
                "%",
            ),
            ImmichFrameNumber(
                coordinator,
                "image_description_long_threshold_lines",
                "Image Description Long Threshold Lines",
                "imageDescriptionLongThresholdLines",
                2,
                10,
                0.25,
                "lines",
            ),
            ImmichFrameNumber(
                coordinator,
                "weather_rotation_interval",
                "Weather Rotation Interval",
                "weatherRotationInterval",
                10,
                3600,
                1,
                "s",
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
                "max_video_length",
                "Max Video Length",
                "excludeVideosOver",
                0,
                86400,
                5,
                "s",
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
            ImmichFrameRemoteNumber(
                coordinator,
                "remote_brightness",
                "Display Brightness",
                ["screen", "brightness"],
                "brightness",
                "mdi:brightness-6",
            ),
            ImmichFrameRemoteNumber(
                coordinator,
                "remote_volume",
                "Media Volume",
                ["audio", "volume"],
                "volume",
                "mdi:volume-high",
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


class ImmichFrameRemoteNumber(CoordinatorEntity[ImmichFrameCoordinator], NumberEntity):
    _attr_native_min_value = 0
    _attr_native_max_value = 100
    _attr_native_step = 1
    _attr_native_unit_of_measurement = "%"
    _attr_mode = NumberMode.SLIDER

    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        value_path: list[str],
        remote_property: str,
        icon: str,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._value_path = value_path
        self._remote_property = remote_property
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = icon

    @property
    def available(self) -> bool:
        return super().available and self._remote_value is not None

    @property
    def native_value(self) -> float | None:
        value = self._remote_value
        return float(value) if isinstance(value, (int, float)) else None

    async def async_set_native_value(self, value: float) -> None:
        rounded = int(max(0, min(100, round(value))))
        if self._remote_property == "brightness":
            await self.coordinator.client.set_remote_brightness(rounded)
        elif self._remote_property == "volume":
            await self.coordinator.client.set_remote_volume(rounded)
        await self.coordinator.async_request_refresh()

    @property
    def _remote_value(self) -> Any:
        remote_status = self.coordinator.data.get("remote_status") or {}
        cursor: Any = remote_status.get("status")
        for segment in self._value_path:
            if not isinstance(cursor, dict) or segment not in cursor:
                return None
            cursor = cursor[segment]
        return cursor
