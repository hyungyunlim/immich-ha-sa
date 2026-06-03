from __future__ import annotations

from dataclasses import dataclass
from datetime import date

DATE_FILTER_OFF = "Off"
DATE_FILTER_TODAY = "Today"
DATE_FILTER_LAST_7_DAYS = "Last 7 days"
DATE_FILTER_LAST_30_DAYS = "Last 30 days"
DATE_FILTER_LAST_90_DAYS = "Last 90 days"
DATE_FILTER_LAST_365_DAYS = "Last 365 days"
DATE_FILTER_CUSTOM = "Custom"

DATE_FILTER_PRESETS = {
    DATE_FILTER_OFF: "",
    DATE_FILTER_TODAY: "today",
    DATE_FILTER_LAST_7_DAYS: "last-7-days",
    DATE_FILTER_LAST_30_DAYS: "last-30-days",
    DATE_FILTER_LAST_90_DAYS: "last-90-days",
    DATE_FILTER_LAST_365_DAYS: "last-365-days",
}
DATE_FILTER_PRESET_OPTIONS = [*DATE_FILTER_PRESETS.keys(), DATE_FILTER_CUSTOM]


@dataclass(frozen=True)
class DateFilterRange:
    start: date | None
    end: date | None
    end_is_today: bool = False


def date_filter_preset_for_value(value: str | None) -> str:
    normalized = (value or "").strip()
    for option, preset_value in DATE_FILTER_PRESETS.items():
        if preset_value == normalized:
            return option
    return DATE_FILTER_CUSTOM


def parse_date_filter_range(value: str | None) -> DateFilterRange:
    normalized = (value or "").strip()
    if not normalized or "_to_" not in normalized:
        return DateFilterRange(None, None)

    start_value, end_value = normalized.split("_to_", 1)
    start = _parse_iso_date(start_value)
    if not start:
        return DateFilterRange(None, None)

    if end_value == "today":
        return DateFilterRange(start, None, True)

    end = _parse_iso_date(end_value)
    if not end:
        return DateFilterRange(None, None)

    return DateFilterRange(start, end)


def date_filter_with_start(value: str | None, start: date) -> str:
    current = parse_date_filter_range(value)
    if current.end:
        end = max(current.end, start)
        return f"{start.isoformat()}_to_{end.isoformat()}"
    return f"{start.isoformat()}_to_today"


def date_filter_with_end(value: str | None, end: date) -> str:
    current = parse_date_filter_range(value)
    start = current.start or end
    if start > end:
        start = end
    return f"{start.isoformat()}_to_{end.isoformat()}"


def _parse_iso_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
