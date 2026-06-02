from __future__ import annotations

from typing import Any

from aiohttp import ClientError
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.core import HomeAssistant
from homeassistant.helpers import aiohttp_client

from .api import ImmichFrameApiError, ImmichFrameClient
from .const import CONF_API_TOKEN, CONF_CONTROLLER_URL, CONF_DEVICE_ID, DEFAULT_DEVICE_ID, DOMAIN


class CannotConnect(Exception):
    """Raised when the controller cannot be reached."""


class InvalidAuth(Exception):
    """Raised when the controller API token is invalid."""


DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_CONTROLLER_URL): str,
        vol.Optional(CONF_API_TOKEN): str,
        vol.Optional(CONF_DEVICE_ID, default=DEFAULT_DEVICE_ID): str,
    }
)


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, str]:
    device_id = data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)
    session = aiohttp_client.async_get_clientsession(hass)
    client = ImmichFrameClient(
        session,
        data[CONF_CONTROLLER_URL],
        device_id,
        data.get(CONF_API_TOKEN),
    )

    try:
        await client.health()
        await client.frame_state()
        await client.refresh_albums()
    except ImmichFrameApiError as err:
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise InvalidAuth from err
        raise CannotConnect from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise CannotConnect from err

    return {"title": f"Immich Frame {device_id}"}


class ImmichFrameConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            data = dict(user_input)
            data[CONF_CONTROLLER_URL] = data[CONF_CONTROLLER_URL].rstrip("/")
            data[CONF_DEVICE_ID] = data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)

            if not data[CONF_CONTROLLER_URL].startswith(("http://", "https://")):
                errors[CONF_CONTROLLER_URL] = "invalid_url"
            elif not data[CONF_DEVICE_ID]:
                errors[CONF_DEVICE_ID] = "required"
            else:
                try:
                    info = await validate_input(self.hass, data)
                except CannotConnect:
                    errors["base"] = "cannot_connect"
                except InvalidAuth:
                    errors["base"] = "invalid_auth"
                except Exception:
                    errors["base"] = "unknown"
                else:
                    await self.async_set_unique_id(
                        f"{data[CONF_CONTROLLER_URL]}:{data[CONF_DEVICE_ID]}"
                    )
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(title=info["title"], data=data)

        return self.async_show_form(
            step_id="user",
            data_schema=DATA_SCHEMA,
            errors=errors,
        )

    async def async_step_import(
        self,
        import_data: dict[str, Any],
    ) -> ConfigFlowResult:
        return await self.async_step_user(import_data)
