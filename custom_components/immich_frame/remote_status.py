from __future__ import annotations

from typing import Any

REMOTE_MUTED_SOURCE_PATH = "audio.muted"
REMOTE_MUTED_SOURCE_VOLUME_ZERO = "audio.volume_zero"


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
