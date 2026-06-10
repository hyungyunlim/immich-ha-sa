# Integration Installation (HACS)

The integration provides the Home Assistant entities and services. It is installed from this repository as a HACS custom repository.

## 1. Add the custom repository

[![Open repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=hyungyunlim&repository=immich-ha-sa&category=integration)

Or manually: open **HACS**, go to **Custom repositories**, and add `https://github.com/hyungyunlim/immich-ha-sa` with category **Integration**.

## 2. Download and restart

Download **Immich Frame Controller**, then restart Home Assistant.

::: info Versioning
HACS installs the latest tagged GitHub release.
:::

## 3. Add the integration

[![Add integration to my Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=immich_frame)

Or go to **Settings → Devices & services → Add integration → Immich Frame Controller**, then enter:

- **Controller URL** — keep the prefilled `http://homeassistant.local:8082` for the add-on, or your standalone Docker host URL
- **Device ID** — `lenovo` by default. After pairing, the config flow reads the controller's device list and shows the available devices as choices; if the list cannot be loaded, enter the ID manually.

The config flow then continues to the [pairing step](./pairing).

The **Controller API token** field is an optional fallback. Leave it blank unless you configured `controller_api_token` / `CONTROLLER_API_TOKEN` on the controller.

## Multiple frames

Add the integration once per frame device ID. Entities for the same device ID are grouped under one Home Assistant device page, so `lenovo`, `kitchen`, and `office` can each be adjusted independently. Devices themselves are created in the [controller console](./controller-setup#device-management).

## YAML import (advanced)

For controlled deployments, YAML configuration is also supported:

```yaml
immich_frame:
  controller_url: http://<controller-host>:8082
  api_token: !secret immich_frame_controller_token
  device_id: lenovo
```
