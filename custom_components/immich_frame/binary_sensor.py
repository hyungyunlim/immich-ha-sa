from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .remote_status import (
    remote_availability,
    remote_effective_muted,
    remote_effective_muted_source,
    remote_status_bool,
    remote_status_source,
)


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameRemoteScreenBinarySensor(coordinator),
            ImmichFrameRemoteDeviceMutedBinarySensor(coordinator),
            ImmichFrameAutoBrightnessBinarySensor(coordinator),
            ImmichFrameRemoteOnlineBinarySensor(coordinator),
            ImmichFrameRemoteMotionBinarySensor(coordinator),
            ImmichFrameRemoteChargingBinarySensor(coordinator),
        ]
    )


class ImmichFrameRemoteScreenBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Screen On"
        self._attr_unique_id = frame_unique_id(device_id, "remote_screen_on")
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = "mdi:monitor"

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return remote_status_bool(self.coordinator.data, ["screen", "on"])


class ImmichFrameRemoteDeviceMutedBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Device Muted"
        self._attr_unique_id = frame_unique_id(device_id, "remote_device_muted")
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = "mdi:volume-mute"

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return remote_effective_muted(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, str] | None:
        source = remote_effective_muted_source(self.coordinator.data)
        return {"source": source} if source else None


class ImmichFrameRemoteOnlineBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    """Device reachability reported by the controller (FreeKiosk MQTT LWT or REST)."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Device Online"
        self._attr_unique_id = frame_unique_id(device_id, "remote_online")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and remote_availability(self.coordinator.data) is not None

    @property
    def is_on(self) -> bool | None:
        availability = remote_availability(self.coordinator.data)
        if availability is None:
            return None
        return availability == "online"

    @property
    def extra_state_attributes(self) -> dict[str, str] | None:
        source = remote_status_source(self.coordinator.data)
        return {"source": source} if source else None


class ImmichFrameRemoteMotionBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    """Camera motion reported by FreeKiosk (webview.motionDetected)."""

    _attr_device_class = BinarySensorDeviceClass.MOTION

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Motion"
        self._attr_unique_id = frame_unique_id(device_id, "remote_motion")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return remote_status_bool(self.coordinator.data, ["webview", "motionDetected"])


class ImmichFrameRemoteChargingBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    _attr_device_class = BinarySensorDeviceClass.BATTERY_CHARGING
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Battery Charging"
        self._attr_unique_id = frame_unique_id(device_id, "remote_battery_charging")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        return remote_status_bool(self.coordinator.data, ["battery", "charging"])


class ImmichFrameAutoBrightnessBinarySensor(
    CoordinatorEntity[ImmichFrameCoordinator],
    BinarySensorEntity,
):
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Auto Brightness Active"
        self._attr_unique_id = frame_unique_id(device_id, "auto_brightness_active")
        self._attr_device_info = frame_device_info(device_id)
        self._attr_icon = "mdi:brightness-auto"

    @property
    def available(self) -> bool:
        return super().available and self.is_on is not None

    @property
    def is_on(self) -> bool | None:
        remote_status = self.coordinator.data.get("remote_status") or {}
        status = remote_status.get("status")
        if not isinstance(status, dict):
            return None
        auto_brightness = status.get("autoBrightness")
        if not isinstance(auto_brightness, dict):
            return None
        enabled = auto_brightness.get("enabled")
        return bool(enabled) if isinstance(enabled, bool) else None
