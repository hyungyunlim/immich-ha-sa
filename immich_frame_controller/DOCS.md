# Immich Frame Controller Add-on

## What This Add-on Does

This add-on runs the controller service that sits between Home Assistant, Immich, immich-kiosk, and the fixed URL loaded by the Lenovo Smart Frame.

The add-on is the runtime. The Home Assistant integration remains the control surface for entities, services, album selection, profiles, sleep cycles, and automations.

## Required Configuration

- `immich_internal_url`: Immich API URL reachable from this add-on container.
- `immich_api_key`: Immich API key.
- `kiosk_internal_url`: immich-kiosk URL reachable from this add-on container.
- `local_public_controller_url`: URL that Home Assistant and the frame can reach on the LAN.
- `local_public_kiosk_url`: Browser-facing immich-kiosk URL for local frames.

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
- Current sleep, display, motion, UI, progress, and burn-in override state.

Use Home Assistant entities and services for actual control. Sleep settings are exposed as `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, and `disableSleep`, and are applied to immich-kiosk as URL query overrides.

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

Set `external_public_controller_url` and `external_public_kiosk_url` only after local pairing works. The setup page is intended for LAN or authenticated add-on access, not public unauthenticated setup.
