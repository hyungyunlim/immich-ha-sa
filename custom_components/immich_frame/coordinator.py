from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.core import HomeAssistant

from .api import ImmichFrameApiError, ImmichFrameClient
from .const import DOMAIN

LOGGER = logging.getLogger(__name__)


class ImmichFrameCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, client: ImmichFrameClient) -> None:
        super().__init__(
            hass,
            LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=30),
        )
        self.client = client
        self.profile_name_draft = ""
        self.profile_id_draft = ""

    async def _async_update_data(self) -> dict[str, Any]:
        state = await self.client.frame_state()
        albums = await self.client.albums()
        people = await self.client.people()
        profiles = await self.client.profiles()
        remote_status: dict[str, Any] | None = None
        try:
            remote_status = await self.client.remote_status()
        except ImmichFrameApiError as err:
            LOGGER.debug("Unable to update FreeKiosk remote status: %s", err.message)
        return {
            "state": state,
            "albums": albums,
            "people": people,
            "profiles": profiles,
            "remote_status": remote_status,
        }
