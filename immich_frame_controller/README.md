# Immich Frame Controller

Runs the Immich Frame Controller as a Home Assistant add-on.

Use this add-on when Home Assistant OS or Home Assistant Supervised should manage the controller container. The Home Assistant integration is still required for entities, services, album selection, and automations.

After the add-on starts, open the Web UI or visit:

```text
http://<home-assistant-host>:8082/
```

The Web UI shows the pairing code, configured devices, fixed frame URLs, resolved renderer URLs, active immich-kiosk URL override state, and local device management controls.

Then add the `Immich Frame Controller` integration and use the same controller URL:

```text
http://<home-assistant-host>:8082
```

After pairing, the integration loads the controller's configured frame devices and lets you choose the device to add. Create or edit devices in the add-on Web UI first when you need a new frame ID or per-device FreeKiosk settings.

Album, person, renderer, network mode, archived asset display, date/newest asset filters, date picker ranges, sleep cycle, layout, transition, image effect, frame UI, progress bar, and burn-in changes are controlled through the Home Assistant integration entities and services. Each configured frame device gets its own Home Assistant device page, and multi-album or multi-person selection is available through the frame Albums/People text entities or the `album_ids` / `album_names` and `person_ids` / `person_names` service fields.

The controller refreshes the Immich album and person caches in the background using `album_refresh_interval_seconds`, while the Home Assistant integration keeps reading those caches every 30 seconds. Use Refresh Albums or Refresh People for an immediate manual update.

The fixed frame page proxies immich-kiosk through the controller origin, so Home Assistant next, previous, play/pause, reload, and kiosk video mute buttons can be bridged into the renderer iframe. For frames running FreeKiosk, set the device remote-control type to `freekiosk` and enter the FreeKiosk REST API URL, for example `http://192.168.1.160:8080`, to enable screen on, screen off, direct display brightness, direct media volume, Android device mute toggle, ambient light status, auto-brightness status, and iframe-command fallback when no frame browser is connected. immich-kiosk video mute is a press button, not a stateful switch; use Android device mute for reliable frame-wide audio state.
