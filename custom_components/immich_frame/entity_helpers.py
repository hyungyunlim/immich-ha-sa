from __future__ import annotations

import re


def frame_label(device_id: str) -> str:
    return device_id.replace("_", " ").replace("-", " ").title()


def frame_unique_id(device_id: str, suffix: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", device_id).strip("_").lower()
    return f"immich_frame_{slug}_{suffix}"
