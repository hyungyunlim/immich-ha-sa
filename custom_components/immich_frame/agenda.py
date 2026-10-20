"""Calendar agenda for the frames: upcoming events from chosen Home Assistant calendars.

Any calendar entity works (Google Calendar, Remote Calendar, local calendars). Every 15 minutes, and
whenever the settings change in the Frames panel, the integration reads the next few days and pushes
them to the controller, which shows them on the chosen frames between family notices.
"""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from aiohttp import ClientError

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .api import ImmichFrameApiError, ImmichFrameClient
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

REFRESH_INTERVAL = timedelta(minutes=15)
MAX_ITEMS = 100  # the controller's limit


class AgendaManager:
    """Keeps the agenda settings and pushes upcoming events to the controller."""

    def __init__(self, hass: HomeAssistant, client: Any) -> None:
        self.hass = hass
        self._client = client  # () -> ImmichFrameClient | None
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.agenda")
        self.settings: dict[str, Any] = {"calendars": [], "device_ids": [], "days": 3}
        self.items: list[dict[str, Any]] = []
        self.error: str | None = None

    async def async_start(self) -> None:
        self.settings.update(await self._store.async_load() or {})
        async_track_time_interval(self.hass, self._async_tick, REFRESH_INTERVAL)
        async_at_started(self.hass, self._async_tick)  # calendars set up after this integration

    async def _async_tick(self, *_: Any) -> None:
        await self.async_refresh()

    async def async_update(self, calendars: list[str], device_ids: list[str], days: int) -> None:
        self.settings = {"calendars": calendars, "device_ids": device_ids, "days": days}
        await self._store.async_save(self.settings)
        await self.async_refresh()

    async def async_refresh(self) -> None:
        client: ImmichFrameClient | None = self._client()
        if client is None:
            return
        calendars, device_ids = self.settings["calendars"], self.settings["device_ids"]
        try:
            self.items = await self._async_events(calendars) if calendars and device_ids else []
            await client.set_agenda(self.items, device_ids if self.items else [], self.hass.config.language)
            self.error = None
        except (HomeAssistantError, ImmichFrameApiError, ClientError, TimeoutError) as err:
            self.error = str(getattr(err, "message", err))
            _LOGGER.warning("Could not update the frame agenda: %s", self.error)

    async def _async_events(self, calendars: list[str]) -> list[dict[str, Any]]:
        start = dt_util.start_of_local_day()  # keeps today's all-day and ongoing events
        response = await self.hass.services.async_call(
            "calendar",
            "get_events",
            {
                "entity_id": calendars,
                "start_date_time": start,
                "end_date_time": start + timedelta(days=self.settings["days"]),
            },
            blocking=True,
            return_response=True,
        )
        items: dict[tuple[str, str], dict[str, Any]] = {}
        for result in (response or {}).values():
            for event in result.get("events", []):
                title = str(event.get("summary") or "").strip()[:140]
                if not title:
                    continue
                item = {"title": title, "start": event["start"], "allDay": "T" not in event["start"]}
                if event.get("end"):
                    item["end"] = event["end"]
                # The same calendar subscribed from two accounts would show every event twice
                items.setdefault((title, event["start"]), item)
        # Local dates sort as text; on each day all-day events come first
        ordered = sorted(items.values(), key=lambda i: (i["start"][:10], not i["allDay"], i["start"]))
        return ordered[:MAX_ITEMS]
