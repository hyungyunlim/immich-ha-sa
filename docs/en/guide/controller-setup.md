# Controller Console

The controller root URL (or the add-on Web UI / ingress panel) opens the setup console — the operational home of the controller.

```text
http://<controller-host>:8082/
```

## What the console shows

- Pairing code and controller URL for Home Assistant
- Device IDs and fixed frame URLs (local and external per device)
- Resolved immich-kiosk renderer URLs, with sensitive query values redacted
- Kiosk password source and connection status for each device
- Current sleep, display, motion, UI, progress, and burn-in override state

## Device management

Device creation and editing happen in the console, so URLs, kiosk passwords, and FreeKiosk settings stay centralized in the controller. Device management is only available from the local console.

For each new device the controller creates:

- A fixed URL at `/frame/<device_id>`
- A separate frame state record for album, renderer, sleep, and display settings
- Optional local and external controller/kiosk URL overrides
- Optional per-device immich-kiosk password override — leave blank to inherit the add-on `kiosk_password`
- Optional [FreeKiosk REST remote-control settings](./freekiosk)

Add the Home Assistant integration once per device ID; the config flow reads the controller's device list after pairing and offers the devices as choices.

## URLs and network modes

The controller separates URLs the **services** can reach from URLs the **frame browser** can reach:

| Setting | Meaning |
| --- | --- |
| `immich_internal_url`, `kiosk_internal_url` | Server-side URLs the controller uses to call Immich and immich-kiosk |
| `local_public_controller_url`, `local_public_kiosk_url` | URLs the frame browser uses on the LAN |
| `external_public_controller_url`, `external_public_kiosk_url` | URLs the frame browser uses through a [tunnel](./remote-frames) |

Each frame has a network mode — set from Home Assistant (`Network Mode` select or the `immich_frame.set_network_mode` service):

- **`local`** — emit LAN controller proxy URLs
- **`external`** — emit public (tunnel) controller proxy URLs
- **`auto`** — let the controller decide

## Album and people cache

Album and person options shown in Home Assistant come from the controller cache:

- The integration reads the cache every 30 seconds.
- The controller refreshes it from Immich every `album_refresh_interval_seconds` (default 900; `0` disables automatic refresh).
- Use the **Refresh Albums** / **Refresh People** buttons or the `immich_frame.refresh_albums` / `immich_frame.refresh_people` services to force an immediate refresh — for example right after creating a new album in Immich.

## Sleep and display care

Sleep settings are exposed as `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, and `disableSleep`, applied to immich-kiosk as URL query overrides. Burn-in protection (`burnInInterval`, `burnInDuration`, `burnInOpacity`) is available the same way. Control them through Home Assistant entities or the `immich_frame.set_renderer_options` service.
