from __future__ import annotations

from typing import Any

REMOTE_MUTED_SOURCE_PATH = "audio.muted"
REMOTE_MUTED_SOURCE_VOLUME_ZERO = "audio.volume_zero"
ORIENTATION_MIN_UPRIGHT_AXIS = 3.0
ORIENTATION_DOMINANCE_MARGIN = 1.0


def remote_status_value(data: dict[str, Any], path: list[str]) -> Any:
    remote_status = data.get("remote_status") or {}
    cursor: Any = remote_status.get("status")
    for segment in path:
        if not isinstance(cursor, dict) or segment not in cursor:
            return None
        cursor = cursor[segment]
    return cursor


def remote_status_bool(data: dict[str, Any], path: list[str]) -> bool | None:
    value = remote_status_value(data, path)
    return value if isinstance(value, bool) else None


def frame_screen_on(data: dict[str, Any]) -> bool | None:
    suspended = (data.get("state") or {}).get("rendererSuspended")
    if suspended is True:
        return False
    remote = remote_status_bool(data, ["screen", "on"])
    if remote is not None:
        return remote
    return not suspended if isinstance(suspended, bool) else None


def remote_status_number(data: dict[str, Any], path: list[str]) -> float | None:
    value = remote_status_value(data, path)
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def remote_accelerometer_axes(data: dict[str, Any]) -> tuple[float, float, float] | None:
    x = remote_status_number(data, ["sensors", "accelerometer", "x"])
    y = remote_status_number(data, ["sensors", "accelerometer", "y"])
    z = remote_status_number(data, ["sensors", "accelerometer", "z"])
    if x is None or y is None or z is None:
        return None
    return x, y, z


def remote_orientation_x_axis_dominant(data: dict[str, Any]) -> bool | None:
    axes = remote_accelerometer_axes(data)
    if axes is None:
        return None

    x, y, z = axes
    absolute_x = abs(x)
    absolute_y = abs(y)
    dominant_axis = max(absolute_x, absolute_y)
    if dominant_axis < ORIENTATION_MIN_UPRIGHT_AXIS or abs(z) >= dominant_axis:
        return None
    if abs(absolute_x - absolute_y) < ORIENTATION_DOMINANCE_MARGIN:
        return None
    return absolute_x > absolute_y


def remote_availability(data: dict[str, Any]) -> str | None:
    remote_status = data.get("remote_status") or {}
    value = remote_status.get("availability")
    return value if value in ("online", "offline") else None


def remote_status_source(data: dict[str, Any]) -> str | None:
    remote_status = data.get("remote_status") or {}
    value = remote_status.get("source")
    return value if isinstance(value, str) else None


def remote_effective_muted(data: dict[str, Any]) -> bool | None:
    muted = remote_status_bool(data, ["audio", "muted"])
    if muted is not None:
        return muted

    volume = remote_status_value(data, ["audio", "volume"])
    if isinstance(volume, (int, float)):
        return volume <= 0
    return None


def remote_effective_muted_source(data: dict[str, Any]) -> str | None:
    if remote_status_bool(data, ["audio", "muted"]) is not None:
        return REMOTE_MUTED_SOURCE_PATH
    if isinstance(remote_status_value(data, ["audio", "volume"]), (int, float)):
        return REMOTE_MUTED_SOURCE_VOLUME_ZERO
    return None
