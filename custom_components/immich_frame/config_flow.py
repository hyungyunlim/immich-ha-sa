from __future__ import annotations

from typing import Any

from aiohttp import ClientError
import voluptuous as vol

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


DEFAULT_ADDON_CONTROLLER_URL = "http://homeassistant.local:8082"
CONF_SETUP_URL = "setup_url"

CONNECT_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_CONTROLLER_URL, default=DEFAULT_ADDON_CONTROLLER_URL): str,
        vol.Optional(CONF_DEVICE_ID, default=DEFAULT_DEVICE_ID): str,
    }
)


def normalize_connection_data(data: dict[str, Any]) -> dict[str, str]:
    controller_url = str(data.get(CONF_CONTROLLER_URL, "")).strip().rstrip("/")
    device_id = str(data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)).strip()

    return {
        CONF_CONTROLLER_URL: controller_url,
        CONF_DEVICE_ID: device_id,
    }


def setup_url(controller_url: str) -> str:
    return f"{controller_url.rstrip('/')}/setup"


def pair_schema(controller_url: str) -> vol.Schema:
    return vol.Schema(
        {
            vol.Optional(CONF_SETUP_URL, default=setup_url(controller_url)): str,
            vol.Optional(CONF_PAIRING_CODE): str,
            vol.Optional(CONF_API_TOKEN): str,
        }
    )


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, str | None]:
    device_id = str(data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)).strip()
    session = aiohttp_client.async_get_clientsession(hass)
    api_token = str(data[CONF_API_TOKEN]).strip() if data.get(CONF_API_TOKEN) else None
    pairing_code = (
        str(data[CONF_PAIRING_CODE]).strip() if data.get(CONF_PAIRING_CODE) else None
    )

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

    _connection_data: dict[str, str] | None = None

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            data = normalize_connection_data(user_input)

            if not data[CONF_CONTROLLER_URL].startswith(("http://", "https://")):
                errors[CONF_CONTROLLER_URL] = "invalid_url"
            elif not data[CONF_DEVICE_ID]:
                errors[CONF_DEVICE_ID] = "required"
            else:
                self._connection_data = data
                return await self.async_step_pair()

        return self.async_show_form(
            step_id="user",
            data_schema=CONNECT_SCHEMA,
            errors=errors,
        )

    async def async_step_pair(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if self._connection_data is None:
            return await self.async_step_user()

        if user_input is not None:
            data: dict[str, Any] = dict(self._connection_data)

            api_token = (
                str(user_input[CONF_API_TOKEN]).strip()
                if user_input.get(CONF_API_TOKEN)
                else None
            )
            pairing_code = (
                str(user_input[CONF_PAIRING_CODE]).strip()
                if user_input.get(CONF_PAIRING_CODE)
                else None
            )

            if api_token:
                data[CONF_API_TOKEN] = api_token
            if pairing_code:
                data[CONF_PAIRING_CODE] = pairing_code

            result, errors = await self._async_create_entry_from_data(data)
            if result is not None:
                return result

        return self.async_show_form(
            step_id="pair",
            data_schema=pair_schema(self._connection_data[CONF_CONTROLLER_URL]),
            errors=errors,
            description_placeholders={
                "setup_url": setup_url(self._connection_data[CONF_CONTROLLER_URL]),
                "device_id": self._connection_data[CONF_DEVICE_ID],
            },
        )

    async def async_step_import(
        self,
        import_data: dict[str, Any],
    ) -> ConfigFlowResult:
        data: dict[str, Any] = normalize_connection_data(import_data)
        if import_data.get(CONF_API_TOKEN):
            data[CONF_API_TOKEN] = str(import_data[CONF_API_TOKEN]).strip()
        if import_data.get(CONF_PAIRING_CODE):
            data[CONF_PAIRING_CODE] = str(import_data[CONF_PAIRING_CODE]).strip()

        if not data[CONF_CONTROLLER_URL].startswith(("http://", "https://")):
            return self.async_abort(reason="invalid_url")
        if not data[CONF_DEVICE_ID]:
            return self.async_abort(reason="required")

        result, errors = await self._async_create_entry_from_data(data)
        if result is None:
            return self.async_abort(reason=errors.get("base", "unknown"))
        return result

    async def _async_create_entry_from_data(
        self,
        data: dict[str, Any],
    ) -> tuple[ConfigFlowResult | None, dict[str, str]]:
        errors: dict[str, str] = {}

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
            return self.async_create_entry(title=info["title"], data=entry_data), {}

        return None, errors
