from __future__ import annotations

import re

from homeassistant.helpers.device_registry import DeviceInfo

from .const import DOMAIN


def frame_label(device_id: str) -> str:
    return device_id.replace("_", " ").replace("-", " ").title()


def frame_unique_id(device_id: str, suffix: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", device_id).strip("_").lower()
    return f"immich_frame_{slug}_{suffix}"


def frame_device_info(device_id: str) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, device_id)},
        name=f"{frame_label(device_id)} Frame",
        manufacturer="Immich Frame Controller",
        model="Immich Kiosk Frame",
    )
