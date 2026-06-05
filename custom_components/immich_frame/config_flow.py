from __future__ import annotations

from typing import Any

from aiohttp import ClientError
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.core import HomeAssistant
from homeassistant.helpers import selector
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


def device_select_schema(devices: list[dict[str, Any]]) -> vol.Schema:
    options = [
        selector.SelectOptionDict(
            value=str(device["id"]),
            label=device_label(device),
        )
        for device in devices
    ]
    default = str(devices[0]["id"]) if devices else DEFAULT_DEVICE_ID
    return vol.Schema(
        {
            vol.Required(CONF_DEVICE_ID, default=default): selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=options,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            )
        }
    )


def device_manual_schema(default: str = DEFAULT_DEVICE_ID) -> vol.Schema:
    return vol.Schema({vol.Required(CONF_DEVICE_ID, default=default): str})


def device_label(device: dict[str, Any]) -> str:
    name = str(device.get("name") or device.get("id") or DEFAULT_DEVICE_ID)
    device_id = str(device.get("id") or DEFAULT_DEVICE_ID)
    if name == device_id:
        return device_id
    return f"{name} ({device_id})"


async def pair_controller(
    hass: HomeAssistant,
    controller_url: str,
    user_input: dict[str, Any],
) -> str | None:
    session = aiohttp_client.async_get_clientsession(hass)
    api_token = str(user_input[CONF_API_TOKEN]).strip() if user_input.get(CONF_API_TOKEN) else None
    pairing_code = (
        str(user_input[CONF_PAIRING_CODE]).strip() if user_input.get(CONF_PAIRING_CODE) else None
    )

    try:
        if not api_token and pairing_code:
            pairing_client = ImmichFrameClient(
                session,
                controller_url,
                DEFAULT_DEVICE_ID,
            )
            paired = await pairing_client.pair(
                pairing_code,
                "Home Assistant",
            )
            api_token = paired["apiToken"]

        client = ImmichFrameClient(
            session,
            controller_url,
            DEFAULT_DEVICE_ID,
            api_token,
        )
        await client.health()
    except ImmichFrameApiError as err:
        if err.code == "PAIRING_FAILED":
            raise InvalidPairingCode from err
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise InvalidAuth from err
        raise CannotConnect from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise CannotConnect from err

    return api_token


async def fetch_devices(
    hass: HomeAssistant,
    controller_url: str,
    api_token: str | None,
) -> list[dict[str, Any]]:
    session = aiohttp_client.async_get_clientsession(hass)
    try:
        client = ImmichFrameClient(
            session,
            controller_url,
            DEFAULT_DEVICE_ID,
            api_token,
        )
        response = await client.devices()
    except ImmichFrameApiError as err:
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise InvalidAuth from err
        raise CannotConnect from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise CannotConnect from err

    devices = response.get("items", [])
    if not isinstance(devices, list):
        raise CannotConnect
    return devices


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, str | None]:
    device_id = str(data.get(CONF_DEVICE_ID, DEFAULT_DEVICE_ID)).strip()
    session = aiohttp_client.async_get_clientsession(hass)
    api_token = str(data[CONF_API_TOKEN]).strip() if data.get(CONF_API_TOKEN) else None
    if not api_token and data.get(CONF_PAIRING_CODE):
        api_token = await pair_controller(hass, data[CONF_CONTROLLER_URL], data)

    try:
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
        if err.code in {"401", "403", "UNAUTHORIZED"}:
            raise InvalidAuth from err
        raise CannotConnect from err
    except (ClientError, TimeoutError, ValueError) as err:
        raise CannotConnect from err

    return {"title": f"Immich Frame {device_id}", CONF_API_TOKEN: api_token}


class ImmichFrameConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    _connection_data: dict[str, str] | None = None
    _api_token: str | None = None
    _devices: list[dict[str, Any]]
    _device_manual_reason: str | None

    def __init__(self) -> None:
        self._connection_data = None
        self._api_token = None
        self._devices = []
        self._device_manual_reason = None

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            data = normalize_connection_data(user_input)

            if not data[CONF_CONTROLLER_URL].startswith(("http://", "https://")):
                errors[CONF_CONTROLLER_URL] = "invalid_url"
            else:
                self._connection_data = {CONF_CONTROLLER_URL: data[CONF_CONTROLLER_URL]}
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
            if not user_input.get(CONF_API_TOKEN) and not user_input.get(CONF_PAIRING_CODE):
                errors["base"] = "required"
            else:
                try:
                    self._api_token = await pair_controller(
                        self.hass,
                        self._connection_data[CONF_CONTROLLER_URL],
                        user_input,
                    )
                except CannotConnect:
                    errors["base"] = "cannot_connect"
                except InvalidPairingCode:
                    errors["base"] = "invalid_pairing_code"
                except InvalidAuth:
                    errors["base"] = "invalid_auth"
                except Exception:
                    errors["base"] = "unknown"
                else:
                    try:
                        self._devices = await fetch_devices(
                            self.hass,
                            self._connection_data[CONF_CONTROLLER_URL],
                            self._api_token,
                        )
                    except InvalidAuth:
                        errors["base"] = "invalid_auth"
                    except Exception:
                        self._device_manual_reason = "cannot_load_devices"
                        return await self.async_step_device_manual()
                    else:
                        if self._devices:
                            return await self.async_step_device()
                        self._device_manual_reason = "no_devices"
                        return await self.async_step_device_manual()

        return self.async_show_form(
            step_id="pair",
            data_schema=pair_schema(self._connection_data[CONF_CONTROLLER_URL]),
            errors=errors,
            description_placeholders={
                "setup_url": setup_url(self._connection_data[CONF_CONTROLLER_URL]),
            },
        )

    async def async_step_device(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if self._connection_data is None:
            return await self.async_step_user()
        if not self._devices:
            return await self.async_step_device_manual()

        if user_input is not None:
            data: dict[str, Any] = {
                CONF_CONTROLLER_URL: self._connection_data[CONF_CONTROLLER_URL],
                CONF_DEVICE_ID: str(user_input.get(CONF_DEVICE_ID, "")).strip(),
            }
            if self._api_token:
                data[CONF_API_TOKEN] = self._api_token

            if not data[CONF_DEVICE_ID]:
                errors[CONF_DEVICE_ID] = "required"
            else:
                result, errors = await self._async_create_entry_from_data(data)
                if result is not None:
                    return result

        return self.async_show_form(
            step_id="device",
            data_schema=device_select_schema(self._devices),
            errors=errors,
        )

    async def async_step_device_manual(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if self._connection_data is None:
            return await self.async_step_user()

        if user_input is not None:
            data: dict[str, Any] = {
                CONF_CONTROLLER_URL: self._connection_data[CONF_CONTROLLER_URL],
                CONF_DEVICE_ID: str(user_input.get(CONF_DEVICE_ID, "")).strip(),
            }
            if self._api_token:
                data[CONF_API_TOKEN] = self._api_token

            if not data[CONF_DEVICE_ID]:
                errors[CONF_DEVICE_ID] = "required"
            else:
                result, errors = await self._async_create_entry_from_data(data)
                if result is not None:
                    return result

        if user_input is None and self._device_manual_reason:
            errors["base"] = self._device_manual_reason

        return self.async_show_form(
            step_id="device_manual",
            data_schema=device_manual_schema(),
            errors=errors,
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
