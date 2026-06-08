from __future__ import annotations

from hashlib import sha1
import re
from typing import Any

from homeassistant.exceptions import HomeAssistantError

PROFILE_SAME_STATE_KEYS = [
    "requireAllPeople",
    "durationSeconds",
    "imageFit",
    "showTime",
    "timeFormat",
    "showAmPm",
    "showSeconds",
    "showDate",
    "dateFormat",
    "clockSource",
    "showWeather",
    "weatherLocation",
    "weatherRotationInterval",
    "weatherShowForecast",
    "weatherShowHumidity",
    "weatherShowWind",
    "weatherShowWindDirection",
    "weatherShowVisibility",
    "weatherShowTemperatureRange",
    "weatherRoundTemperature",
    "showVideos",
    "excludeVideosOver",
    "showArchived",
    "filterDate",
    "filterNewest",
    "albumOrder",
    "transition",
    "fadeTransitionDuration",
    "crossFadeTransitionDuration",
    "layout",
    "imageEffect",
    "imageEffectAmount",
    "backgroundBlur",
    "backgroundBlurAmount",
    "fontSize",
    "frameless",
    "disableNavigation",
    "hideCursor",
    "showProgressBar",
    "progressBarPosition",
    "showImageRating",
    "showOwner",
    "showAlbumName",
    "showPersonName",
    "showPersonAge",
    "showImageTime",
    "imageTimeFormat",
    "showImageDate",
    "imageDateFormat",
    "showImageDescription",
    "imageDescriptionScrollDuration",
    "imageDescriptionScrollSpeed",
    "imageDescriptionStartDelay",
    "imageDescriptionAreaHeight",
    "imageDescriptionOverlayOpacity",
    "imageDescriptionLongThresholdLines",
    "showImageCamera",
    "showImageExif",
    "showImageLocation",
    "showImageQr",
    "showImageId",
    "showUser",
    "showMoreInfo",
    "burnInInterval",
    "burnInDuration",
    "burnInOpacity",
    "sleepStart",
    "sleepEnd",
    "sleepIcon",
    "sleepDimScreen",
    "disableSleep",
]


def profile_id_from_name(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")
    if normalized:
        return normalized
    digest = sha1(name.strip().encode("utf-8")).hexdigest()[:8]
    return f"profile_{digest}"


def existing_profile_for_id(profiles: dict[str, Any], profile_id: str) -> dict[str, Any] | None:
    items = profiles.get("items", [])
    if not isinstance(items, list):
        return None
    return next(
        (profile for profile in items if isinstance(profile, dict) and profile.get("id") == profile_id),
        None,
    )


def profile_from_frame_state(state: dict[str, Any], profile_id: str, name: str) -> dict[str, Any]:
    profile: dict[str, Any] = {
        "id": profile_id,
        "name": name,
        "albumIds": state.get("activeAlbumIds", []),
        "personIds": state.get("activePersonIds", []),
        "preferredNetworkMode": state.get("networkMode", "auto"),
    }
    for key in PROFILE_SAME_STATE_KEYS:
        if key in state:
            profile[key] = state[key]
    return profile


def profile_name_for_save(
    profiles: dict[str, Any],
    state: dict[str, Any],
    requested_name: str | None,
    profile_id: str | None,
) -> str:
    name = (requested_name or "").strip()
    if name:
        return name

    if profile_id:
        existing = existing_profile_for_id(profiles, profile_id)
        if existing and str(existing.get("name") or "").strip():
            return str(existing["name"]).strip()

    active_profile_id = state.get("activeProfileId")
    if isinstance(active_profile_id, str):
        existing = existing_profile_for_id(profiles, active_profile_id)
        if existing and str(existing.get("name") or "").strip():
            return str(existing["name"]).strip()

    raise HomeAssistantError("Profile name is required")


def profile_id_for_save(
    name: str,
    requested_profile_id: str | None,
    state: dict[str, Any],
    requested_name: str | None,
) -> str:
    profile_id = (requested_profile_id or "").strip()
    if profile_id:
        return profile_id

    if (requested_name or "").strip():
        return profile_id_from_name(name)

    active_profile_id = state.get("activeProfileId")
    if isinstance(active_profile_id, str) and active_profile_id:
        return active_profile_id

    return profile_id_from_name(name)


def profile_id_for_delete(requested_profile_id: str | None, state: dict[str, Any]) -> str:
    profile_id = (requested_profile_id or "").strip()
    if profile_id:
        return profile_id

    active_profile_id = state.get("activeProfileId")
    if isinstance(active_profile_id, str) and active_profile_id:
        return active_profile_id

    raise HomeAssistantError("Profile ID is required when no active profile is selected")
