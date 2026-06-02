from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.core import HomeAssistant

from .api import ImmichFrameClient
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

    async def _async_update_data(self) -> dict[str, Any]:
        state = await self.client.frame_state()
        albums = await self.client.albums()
        profiles = await self.client.profiles()
        return {
            "state": state,
            "albums": albums,
            "profiles": profiles,
        }
