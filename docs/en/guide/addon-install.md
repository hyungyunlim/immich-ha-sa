# Add-on Installation

Home Assistant OS and Supervised users run the controller as an add-on. This is the preferred path when Home Assistant should manage the controller container, logs, startup, port mapping, and setup UI.

::: info Home Assistant Container / Core
The add-on requires the Supervisor. On Home Assistant Container or Core, run the controller as a [standalone Docker container](./standalone-docker) instead.
:::

## 1. Add the repository

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)

Or manually: open **Settings → Add-ons → Add-on Store**, open **Repositories** from the top-right menu, and add:

```text
https://github.com/hyungyunlim/immich-ha-sa
```

## 2. Install the add-on

[![Open add-on in my Home Assistant](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=e2ffcf58_immich_frame_controller&repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)

Find **Immich Frame Controller** in the store and install it.

## 3. Configure

| Option | Required | Description |
| --- | --- | --- |
| `immich_internal_url` | yes | Immich API URL reachable from the add-on container |
| `immich_api_key` | yes | Immich API key |
| `kiosk_internal_url` | yes | immich-kiosk URL reachable from the add-on container |
| `kiosk_password` | no | Set if your immich-kiosk uses `KIOSK_PASSWORD` |
| `local_public_controller_url` | yes | URL that Home Assistant and the frame can reach on the LAN, usually `http://<home-assistant-host>:8082` |
| `local_public_kiosk_url` | yes | Browser-facing immich-kiosk URL on the LAN |
| `external_public_controller_url` | no | Public controller URL for [remote frames](./remote-frames) |
| `external_public_kiosk_url` | no | Public immich-kiosk URL for remote frames |
| `default_frame_id` | yes | Device ID of the default frame (default `lenovo`) |
| `default_frame_name` | yes | Display name of the default frame |
| `default_network_mode` | yes | `auto`, `local`, or `external` |
| `poll_interval_seconds` | yes | Frame polling fallback interval (5–300) |
| `album_refresh_interval_seconds` | yes | How often the controller refreshes Immich albums in the background; `0` disables automatic refresh |
| `controller_api_token` | no | Optional static API token; most users should leave it blank and use [pairing](./pairing) |

## 4. Start and verify

Start the add-on, then open the add-on **Web UI** (ingress) or:

```text
http://<home-assistant-host>:8082/setup
```

You should see the controller setup console with the default device and a pairing code.

::: warning Changing the port
The add-on exposes container port `8080` as host port `8082` by default. If you change the add-on network port, update `local_public_controller_url`, the integration's controller URL, and the frame's fixed URL to match.
:::

## Next steps

- [Install the integration](./integration-install) via HACS
- [Pair Home Assistant and the frame](./pairing)
