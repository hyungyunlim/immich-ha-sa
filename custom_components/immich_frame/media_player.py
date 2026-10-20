from __future__ import annotations

from homeassistant.components import media_source
from homeassistant.components.media_player import (
    BrowseMedia,
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
    async_process_play_media_url,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .entity_helpers import frame_device_info, frame_label, frame_unique_id
from .remote_status import remote_effective_muted, remote_status_bool, remote_status_value


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameSlideshowMediaPlayer(coordinator),
            ImmichFrameSpeakerMediaPlayer(coordinator),
        ]
    )


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
        frame_state = self.coordinator.data.get("state", {})
        if frame_state.get("rendererSuspended") is True:
            return MediaPlayerState.OFF
        screen_on = remote_status_bool(self.coordinator.data, ["screen", "on"])
        if screen_on is False:
            return MediaPlayerState.OFF
        playback_state = frame_state.get("playbackState")
        if playback_state == "paused":
            return MediaPlayerState.PAUSED
        if playback_state == "unknown":
            return MediaPlayerState.IDLE
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
        await self._send_command("play")

    async def async_media_pause(self) -> None:
        await self._send_command("pause")

    async def async_media_play_pause(self) -> None:
        await self._send_command(
            "pause" if self.state == MediaPlayerState.PLAYING else "play"
        )

    async def async_set_volume_level(self, volume: float) -> None:
        percent = round(max(0, min(1, volume)) * 100)
        await self.coordinator.client.set_remote_volume(percent)
        await self.coordinator.async_request_refresh()

    async def async_mute_volume(self, mute: bool) -> None:
        device_muted = remote_effective_muted(self.coordinator.data)
        if device_muted is not None and device_muted is not mute:
            await self.coordinator.client.send_command("device-mute-toggle")
        await self.coordinator.async_request_refresh()

    async def _send_command(self, command: str) -> None:
        await self.coordinator.client.send_command(command)
        await self.coordinator.async_request_refresh()


class ImmichFrameSpeakerMediaPlayer(
    CoordinatorEntity[ImmichFrameCoordinator],
    MediaPlayerEntity,
):
    """Plays audio (voice notes, music, TTS) on the frame speaker through FreeKiosk."""

    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY_MEDIA
        | MediaPlayerEntityFeature.BROWSE_MEDIA
        | MediaPlayerEntityFeature.STOP
        | MediaPlayerEntityFeature.VOLUME_SET
    )
    _attr_icon = "mdi:speaker"
    # ponytail: FreeKiosk does not report when a clip ends, so the state stays idle; track playback when it does.
    _attr_state = MediaPlayerState.IDLE

    def __init__(self, coordinator: ImmichFrameCoordinator) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._attr_name = f"{frame_label(device_id)} Frame Speaker"
        self._attr_unique_id = frame_unique_id(device_id, "speaker_media_player")
        self._attr_device_info = frame_device_info(device_id)

    @property
    def available(self) -> bool:
        return super().available and self.coordinator.data.get("remote_status") is not None

    @property
    def volume_level(self) -> float | None:
        volume = remote_status_value(self.coordinator.data, ["audio", "volume"])
        if not isinstance(volume, (int, float)):
            return None
        return max(0, min(100, float(volume))) / 100

    async def async_play_media(self, media_type: str, media_id: str, **kwargs) -> None:
        if media_source.is_media_source_id(media_id):
            play_item = await media_source.async_resolve_media(self.hass, media_id, self.entity_id)
            media_id = play_item.url
        # Relative HA URLs (TTS, local media) become signed absolute URLs the frame can fetch
        url = async_process_play_media_url(self.hass, media_id)
        await self.coordinator.client.play_audio(url)

    async def async_browse_media(
        self,
        media_content_type: str | None = None,
        media_content_id: str | None = None,
    ) -> BrowseMedia:
        return await media_source.async_browse_media(
            self.hass,
            media_content_id,
            content_filter=lambda item: item.media_content_type.startswith("audio/"),
        )

    async def async_media_stop(self) -> None:
        await self.coordinator.client.stop_audio()

    async def async_set_volume_level(self, volume: float) -> None:
        await self.coordinator.client.set_remote_volume(round(max(0, min(1, volume)) * 100))
        await self.coordinator.async_request_refresh()
