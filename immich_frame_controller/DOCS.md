# Immich Frame Controller Add-on

## What This Add-on Does

This add-on runs the controller service that sits between Home Assistant, Immich, immich-kiosk, and the fixed URL loaded by the Lenovo Smart Frame.

The add-on is the runtime. The Home Assistant integration remains the control surface for entities, services, album selection, profiles, sleep cycles, and automations.

## Required Configuration

- `immich_internal_url`: Immich API URL reachable from this add-on container.
- `immich_api_key`: Immich API key.
- `kiosk_internal_url`: immich-kiosk URL reachable from this add-on container.
- `local_public_controller_url`: URL that Home Assistant and the frame can reach on the LAN.
- `local_public_kiosk_url`: immich-kiosk URL used by the controller's same-origin frame proxy.

The default controller port is `8082`. If you change the add-on network port, update `local_public_controller_url` and the Home Assistant integration controller URL to match.

## Pairing With Home Assistant

1. Start the add-on.
2. Open the add-on Web UI or `http://<home-assistant-host>:8082/`.
3. Add the `Immich Frame Controller` integration.
4. Enter the controller URL, usually `http://<home-assistant-host>:8082`.
5. Enter the pairing code shown on the add-on console.

The integration stores the issued controller API token. You usually do not need to configure `controller_api_token`.

## Add-on Web UI

The Web UI is an operational console. It shows:

- Pairing code and controller URL for Home Assistant.
- Device IDs and fixed frame URLs.
- Resolved immich-kiosk renderer URLs with sensitive query values redacted.
- Kiosk password source and connection status for each device.
- Current sleep, display, motion, UI, progress, and burn-in override state.
- Local device management controls for creating, editing, and deleting non-default frame devices.

Device management is only available from the local console. For each new device, the controller creates:

- A fixed URL at `/frame/<device_id>`.
- A separate frame state record for album, renderer, sleep, and display settings.
- Optional local and external controller/kiosk URL overrides.
- Optional per-device immich-kiosk password override. Leave this blank to inherit the add-on `kiosk_password`.
- Optional FreeKiosk REST remote-control settings.

Add the Home Assistant integration once per frame device ID. Home Assistant entities for the same device ID are grouped under one Home Assistant device page, so `lenovo`, `kitchen`, and `office` can each be adjusted independently.

## FreeKiosk Remote Control

If the frame runs FreeKiosk, open the device settings in the add-on console and set:

- Remote Control: `freekiosk`
- Remote API URL: the FreeKiosk REST API base URL, for example `http://192.168.1.160:8080`
- Remote API Key: optional, only if enabled in FreeKiosk

The Home Assistant device page exposes buttons for next, previous, play/pause, reload, kiosk mute toggle, screen on, screen off, volume up, and volume down. Next, previous, play/pause, reload, and kiosk mute toggle are sent to the fixed frame page over the controller event stream, then bridged into the same-origin immich-kiosk iframe. Kiosk Mute Toggle clicks immich-kiosk's real `.navigation--mute` control first, then falls back to directly updating the current video element's muted state. If no frame browser is connected, these iframe commands fall back to FreeKiosk REST when the device has a FreeKiosk Remote API URL configured. Screen and volume controls always require FreeKiosk REST endpoints such as `/api/screen/on`, `/api/screen/off`, `/api/remote/keyboard/volumeup`, and `/api/remote/keyboard/volumedown`.

Keep the frame's `disableNavigation` setting off when using next/previous buttons. immich-kiosk's `disable_navigation` option blocks touch/click, keyboard, and menu navigation, so bridged commands and physical key events will be ignored by immich-kiosk if this is enabled.

## Kiosk Audio

The Home Assistant Kiosk Mute Toggle button controls immich-kiosk mute state, not Android device volume. The controller sets `up_arrow_action=mute` by default for compatibility, but the primary remote-control path is the proxied kiosk mute button, not a synthetic keyboard event. When the add-on console shows `Frame Connection: 0 live`, the controller falls back to FreeKiosk `/api/remote/up` if the frame has a Remote API URL. Use the Up Arrow Action and Down Arrow Action select entities if you want physical key actions to do something else.

The Volume Up and Volume Down buttons are FreeKiosk/Android device volume controls.

## Video Playback

Turn on the frame's Show Videos switch in Home Assistant to pass `show_videos=true` to immich-kiosk. immich-kiosk also requires server-side `kiosk.prefetch` / `KIOSK_PREFETCH` to be enabled for video playback; that setting cannot be overridden through the frame URL.

The controller proxy preserves HTTP range headers required by WebView video playback. If videos show a poster but do not start, confirm the add-on is running `0.1.13` or newer.

Use Home Assistant entities and services for actual control. Sleep settings are exposed as `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, and `disableSleep`, and are applied to immich-kiosk as URL query overrides.

For album control:

- Use the Album select entity for quick single-album selection.
- Use the Albums text entity for multiple albums, separated by commas. Values may be Immich album names or album IDs.
- Use the `set_album` service with `album_ids` or `album_names` for automations.

The controller also exposes common immich-kiosk URL override settings for frame-specific behavior:

- Motion: `transition`, `fadeTransitionDuration`, `crossFadeTransitionDuration`, `imageEffect`, `imageEffectAmount`.
- Layout and display: `layout`, `imageFit`, `backgroundBlur`, `frameless`.
- Kiosk UI: `disableNavigation`, `hideCursor`, `showProgressBar`, `progressBarPosition`.
- Display care: `burnInInterval`, `burnInDuration`, `burnInOpacity`.

Offline mode is not exposed as a frame profile toggle because it requires persistent offline assets and many URL overrides are intentionally unavailable while using offline mode.

## Remote Frames

For frames outside the LAN, expose the fixed frame URL with a tunnel such as Cloudflare Tunnel:

```text
https://frame.example.com/frame/lenovo
```

The tunnel hostname should point to this controller add-on, for example `http://<home-assistant-lan-ip>:8082`. Do not point the frame at the Immich server domain or the direct immich-kiosk domain. With the controller proxy, the public frame only needs the controller domain; a separate public immich-kiosk URL is optional.

Set `external_public_controller_url` after local pairing works. The add-on console shows both Local Frame URL and External Frame URL for each device. The setup page is intended for LAN or authenticated add-on access, not public unauthenticated setup.
