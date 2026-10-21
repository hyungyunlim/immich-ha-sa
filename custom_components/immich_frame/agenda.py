"""Calendar agenda for the frames: upcoming events from chosen Home Assistant calendars.

Any calendar entity works (Google Calendar, Remote Calendar, local calendars). Each frame has its own
calendars, number of days and widget choice. Every 15 minutes, and whenever the settings change in the
Frames panel, the integration reads the upcoming events and pushes each frame's list to the controller.
A frame shows them between family notices, or, with the widget on, in a card with this month's calendar.
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
    """Keeps each frame's agenda settings and pushes its upcoming events to the controller."""

    def __init__(self, hass: HomeAssistant, client: Any) -> None:
        self.hass = hass
        self._client = client  # () -> ImmichFrameClient | None
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.agenda")
        # {"frames": {device_id: {"calendars": [...], "days": 3, "widget": False}}}
        self.settings: dict[str, Any] = {"frames": {}}
        self.items: dict[str, list[dict[str, Any]]] = {}  # device_id -> events shown there
        self.error: str | None = None

    async def async_start(self) -> None:
        stored = await self._store.async_load() or {}
        if "device_ids" in stored:  # before 0.1.108 the chosen frames shared one setting
            shared = {key: stored.get(key, default) for key, default in (("calendars", []), ("days", 3), ("widget", False))}
            stored = {"frames": {device_id: dict(shared) for device_id in stored["device_ids"]}}
        self.settings.update(stored)
        async_track_time_interval(self.hass, self._async_tick, REFRESH_INTERVAL)
        async_at_started(self.hass, self._async_tick)  # calendars set up after this integration

    async def _async_tick(self, *_: Any) -> None:
        await self.async_refresh()

    async def async_update(self, device_id: str, calendars: list[str], days: int, widget: bool) -> None:
        frames = self.settings["frames"]
        if calendars or widget:
            frames[device_id] = {"calendars": calendars, "days": days, "widget": widget}
        else:
            frames.pop(device_id, None)
        await self._store.async_save(self.settings)
        await self.async_refresh()

    async def async_refresh(self) -> None:
        client: ImmichFrameClient | None = self._client()
        if client is None:
            return
        frames: dict[str, dict[str, Any]] = self.settings["frames"]
        try:
            calendars = sorted({c for frame in frames.values() for c in frame["calendars"]})
            days = max((frame["days"] for frame in frames.values() if frame["calendars"]), default=1)
            events = await self._async_events(calendars, days) if calendars else {}
            self.items = {
                device_id: _frame_items(events, frame["calendars"], frame["days"]) for device_id, frame in frames.items()
            }
            # The widget shows the month and notices even without calendars, so such frames go along too
            await client.set_agenda(
                {device_id: {"items": self.items[device_id], "widget": frame["widget"]} for device_id, frame in frames.items()},
                self.hass.config.language,
            )
            self.error = None
        except (HomeAssistantError, ImmichFrameApiError, ClientError, TimeoutError) as err:
            self.error = str(getattr(err, "message", err))
            _LOGGER.warning("Could not update the frame agenda: %s", self.error)

    async def _async_events(self, calendars: list[str], days: int) -> dict[str, list[dict[str, Any]]]:
        """Events per calendar, from the start of today for `days` days."""
        start = dt_util.start_of_local_day()  # keeps today's all-day and ongoing events
        response = await self.hass.services.async_call(
            "calendar",
            "get_events",
            {"entity_id": calendars, "start_date_time": start, "end_date_time": start + timedelta(days=days)},
            blocking=True,
            return_response=True,
        )
        events: dict[str, list[dict[str, Any]]] = {}
        for entity_id, result in (response or {}).items():
            for event in result.get("events", []):
                title = str(event.get("summary") or "").strip()[:140]
                if not title:
                    continue
                item = {"title": title, "start": event["start"], "allDay": "T" not in event["start"]}
                if event.get("end"):
                    item["end"] = event["end"]
                events.setdefault(entity_id, []).append(item)
        return events


def _frame_items(events: dict[str, list[dict[str, Any]]], calendars: list[str], days: int) -> list[dict[str, Any]]:
    """One frame's events: from its calendars and within its days, sorted, without duplicates."""
    cutoff = (dt_util.start_of_local_day() + timedelta(days=days)).date().isoformat()
    items: dict[tuple[str, str], dict[str, Any]] = {}
    for calendar in calendars:
        for item in events.get(calendar, []):
            # Starts are local, so their dates compare as text
            if item["start"][:10] < cutoff:
                # The same calendar subscribed from two accounts would show every event twice
                items.setdefault((item["title"], item["start"]), item)
    # On each day all-day events come first
    ordered = sorted(items.values(), key=lambda i: (i["start"][:10], not i["allDay"], i["start"]))
    return ordered[:MAX_ITEMS]
