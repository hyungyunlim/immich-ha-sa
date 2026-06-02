from __future__ import annotations

from typing import Any

from aiohttp import ClientError
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.core import HomeAssistant
from homeassistant.helpers import aiohttp_client

from .api import ImmichFrameApiError, ImmichFrameClient
from .const import (
    CONF_API_TOKEN,
    CONF_CONTROLLER_URL,
    CONF_DEVICE_ID,
    CONF_PAIRING_CODE,
    DEFAULT_DEVICE_ID,
    DOMAIN,
)


class CannotConnect(Exception):
    """Raised when the controller cannot be reached."""


class InvalidAuth(Exception):
    """Raised when the controller API token is invalid."""


class InvalidPairingCode(Exception):
    """Raised when the pairing code is invalid or expired."""


DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_CONTROLLER_URL): str,
        vol.Optional(CONF_PAIRING_CODE): str,
        vol.Optional(CONF_DEVICE_ID, default=DEFAULT_DEVICE_ID): str,
        vol.Optional(CONF_API_TOKEN): str,
    }
)


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, str | None]:
    device_id = data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)
    session = aiohttp_client.async_get_clientsession(hass)
    api_token = data.get(CONF_API_TOKEN) or None
    pairing_code = data.get(CONF_PAIRING_CODE) or None

    try:
        if not api_token and pairing_code:
            pairing_client = ImmichFrameClient(
                session,
                data[CONF_CONTROLLER_URL],
                device_id,
            )
            paired = await pairing_client.pair(
                pairing_code,
                f"Home Assistant {device_id}",
            )
            api_token = paired["apiToken"]

        client = ImmichFrameClient(
            session,
            data[CONF_CONTROLLER_URL],
            device_id,
            api_token,
        )
        await client.health()
        await client.frame_state()
        await client.refresh_albums()
    except ImmichFrameApiError as err:
        if err.code == "PAIRING_FAILED":
            raise InvalidPairingCode from err
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise InvalidAuth from err
        raise CannotConnect from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise CannotConnect from err

    return {"title": f"Immich Frame {device_id}", CONF_API_TOKEN: api_token}


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
                except InvalidPairingCode:
                    errors["base"] = "invalid_pairing_code"
                except InvalidAuth:
                    errors["base"] = "invalid_auth"
                except Exception:
                    errors["base"] = "unknown"
                else:
                    entry_data = {
                        CONF_CONTROLLER_URL: data[CONF_CONTROLLER_URL],
                        CONF_DEVICE_ID: data[CONF_DEVICE_ID],
                    }
                    if info.get(CONF_API_TOKEN):
                        entry_data[CONF_API_TOKEN] = info[CONF_API_TOKEN]

                    await self.async_set_unique_id(
                        f"{entry_data[CONF_CONTROLLER_URL]}:{entry_data[CONF_DEVICE_ID]}"
                    )
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(title=info["title"], data=entry_data)

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
