from __future__ import annotations

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .remote_status import remote_effective_muted, remote_status_bool, remote_status_value


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities([ImmichFrameSlideshowMediaPlayer(coordinator)])


class ImmichFrameSlideshowMediaPlayer(
    CoordinatorEntity[ImmichFrameCoordinator],
    MediaPlayerEntity,
):
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY
        | MediaPlayerEntityFeature.PAUSE
        | MediaPlayerEntityFeature.NEXT_TRACK
        | MediaPlayerEntityFeature.PREVIOUS_TRACK
        | MediaPlayerEntityFeature.VOLUME_MUTE
        | MediaPlayerEntityFeature.VOLUME_SET
    )
    _attr_icon = "mdi:image-multiple"
    _attr_media_content_type = "image"
    _attr_media_title = "Immich Slideshow"

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Slideshow"
        self._attr_unique_id = frame_unique_id(device_id, "slideshow_media_player")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def state(self) -> MediaPlayerState:
        screen_on = remote_status_bool(self.coordinator.data, ["screen", "on"])
        if screen_on is False:
            return MediaPlayerState.OFF
        return MediaPlayerState.PLAYING

    @property
    def volume_level(self) -> float | None:
        volume = remote_status_value(self.coordinator.data, ["audio", "volume"])
        if not isinstance(volume, (int, float)):
            return None
        return max(0, min(100, float(volume))) / 100

    @property
    def is_volume_muted(self) -> bool | None:
        return remote_effective_muted(self.coordinator.data)

    async def async_media_next_track(self) -> None:
        await self._send_command("next")

    async def async_media_previous_track(self) -> None:
        await self._send_command("previous")

    async def async_media_play(self) -> None:
        await self._send_command("play-pause")

    async def async_media_pause(self) -> None:
        await self._send_command("play-pause")

    async def async_media_play_pause(self) -> None:
        await self._send_command("play-pause")

    async def async_set_volume_level(self, volume: float) -> None:
        percent = round(max(0, min(1, volume)) * 100)
        await self.coordinator.client.set_remote_volume(percent)
        await self.coordinator.async_request_refresh()

    async def async_mute_volume(self, mute: bool) -> None:
        current = self.is_volume_muted
        if current is mute:
            return
        await self._send_command("device-mute-toggle")

    async def _send_command(self, command: str) -> None:
        await self.coordinator.client.send_command(command)
        await self.coordinator.async_request_refresh()
