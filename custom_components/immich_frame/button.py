from __future__ import annotations

from homeassistant.components.button import DOMAIN as BUTTON_DOMAIN, ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id

KIOSK_MUTE_DIAGNOSTIC_MIGRATION = "kiosk_mute_diagnostic_migrated"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities,
) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    _async_disable_legacy_kiosk_mute_entity(hass, entry, coordinator.client.device_id)
    async_add_entities(
        [
            ImmichFrameRefreshAlbumsButton(coordinator),
            ImmichFrameRefreshPeopleButton(coordinator),
            ImmichFrameCommandButton(coordinator, "previous", "Previous", "previous"),
            ImmichFrameCommandButton(coordinator, "next", "Next", "next"),
            ImmichFrameCommandButton(coordinator, "play_pause", "Play/Pause", "play-pause"),
            ImmichFrameCommandButton(coordinator, "reload", "Reload", "reload"),
            ImmichFrameCommandButton(
                coordinator,
                "kiosk_mute_toggle",
                "Kiosk Video Mute Diagnostic",
                "mute-toggle",
                entity_category=EntityCategory.DIAGNOSTIC,
                enabled_default=False,
            ),
            ImmichFrameCommandButton(coordinator, "screen_on", "Screen On", "screen-on"),
            ImmichFrameCommandButton(coordinator, "screen_off", "Screen Off", "screen-off"),
            ImmichFrameCommandButton(coordinator, "volume_up", "Volume Up", "volume-up"),
            ImmichFrameCommandButton(coordinator, "volume_down", "Volume Down", "volume-down"),
            ImmichFrameCommandButton(coordinator, "device_mute_toggle", "Device Mute Toggle", "device-mute-toggle"),
            ImmichFrameCommandButton(coordinator, "dpad_up", "D-pad Up", "dpad-up"),
        ]
    )


class ImmichFrameRefreshAlbumsButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Refresh Albums"
        self._attr_unique_id = frame_unique_id(device_id, "refresh_albums")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        await self.coordinator.client.refresh_albums()
        await self.coordinator.async_request_refresh()


class ImmichFrameRefreshPeopleButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Refresh People"
        self._attr_unique_id = frame_unique_id(device_id, "refresh_people")
        self._attr_device_info = frame_device_info(device_id)

    async def async_press(self) -> None:
        await self.coordinator.client.refresh_people()
        await self.coordinator.async_request_refresh()


class ImmichFrameCommandButton(CoordinatorEntity[ImmichFrameCoordinator], ButtonEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        command: str,
        *,
        entity_category: EntityCategory | None = None,
        enabled_default: bool = True,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._command = command
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)
        self._attr_entity_registry_enabled_default = enabled_default
        if entity_category is not None:
            self._attr_entity_category = entity_category

    async def async_press(self) -> None:
        await self.coordinator.client.send_command(self._command)


def _async_disable_legacy_kiosk_mute_entity(
    hass: HomeAssistant,
    entry: ConfigEntry,
    device_id: str,
) -> None:
    if entry.data.get(KIOSK_MUTE_DIAGNOSTIC_MIGRATION):
        return

    registry = er.async_get(hass)
    entity_id = registry.async_get_entity_id(
        BUTTON_DOMAIN,
        DOMAIN,
        frame_unique_id(device_id, "kiosk_mute_toggle"),
    )
    if entity_id:
        registry_entry = registry.async_get(entity_id)
        if registry_entry and registry_entry.disabled_by is None:
            registry.async_update_entity(
                entity_id,
                disabled_by=er.RegistryEntryDisabler.INTEGRATION,
            )

    hass.config_entries.async_update_entry(
        entry,
        data={**entry.data, KIOSK_MUTE_DIAGNOSTIC_MIGRATION: True},
    )
