from __future__ import annotations

from datetime import date

from homeassistant.components.date import DateEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DATA_COORDINATOR, DOMAIN
from .coordinator import ImmichFrameCoordinator
from .date_filter import (
    date_filter_with_end,
    date_filter_with_start,
    parse_date_filter_range,
)
from .entity_helpers import frame_device_info, frame_label, frame_unique_id


async def async_setup_entry(hass, entry: ConfigEntry, async_add_entities) -> None:
    coordinator: ImmichFrameCoordinator = hass.data[DOMAIN][entry.entry_id][DATA_COORDINATOR]
    async_add_entities(
        [
            ImmichFrameDateFilterDate(coordinator, "filter_start_date", "Filter Start Date", "start"),
            ImmichFrameDateFilterDate(coordinator, "filter_end_date", "Filter End Date", "end"),
        ]
    )


class ImmichFrameDateFilterDate(CoordinatorEntity[ImmichFrameCoordinator], DateEntity):
    def __init__(
        self,
        coordinator: ImmichFrameCoordinator,
        key: str,
        label: str,
        boundary: str,
    ) -> None:
        super().__init__(coordinator)
        device_id = coordinator.client.device_id
        self._boundary = boundary
        self._attr_name = f"{frame_label(device_id)} Frame {label}"
        self._attr_unique_id = frame_unique_id(device_id, key)
        self._attr_device_info = frame_device_info(device_id)

    @property
    def native_value(self) -> date | None:
        current = parse_date_filter_range(self._filter_date)
        if self._boundary == "start":
            return current.start
        return current.end

    async def async_set_value(self, value: date) -> None:
        if self._boundary == "start":
            next_filter = date_filter_with_start(self._filter_date, value)
        else:
            next_filter = date_filter_with_end(self._filter_date, value)
        await self.coordinator.client.update_frame_state({"filterDate": next_filter})
        await self.coordinator.async_request_refresh()

    @property
    def _filter_date(self) -> str:
        return self.coordinator.data.get("state", {}).get("filterDate", "")
