# Changelog

## 0.1.21

- Add Home Assistant controls for immich-kiosk `filter_date` and `filter_newest` renderer filters.
- Include date/newest filters in frame state, renderer URL generation, profiles, services, and the add-on console diagnostics.

## 0.1.20

- Add a one-time Home Assistant entity registry migration that disables existing legacy Kiosk Mute Toggle entities after the diagnostic demotion.

## 0.1.19

- Demote Kiosk Mute Toggle to a diagnostic, default-disabled Home Assistant entity because Android Device Mute Toggle is the reliable frame-wide audio control path.

## 0.1.18

- Add a Home Assistant Device Mute Toggle button that sends Android `KEYCODE_VOLUME_MUTE` through FreeKiosk.
- Keep Kiosk Mute Toggle separate from Android device audio mute because browser video unmute may be blocked without a real user gesture.

## 0.1.17

- Make Kiosk Mute Toggle click immich-kiosk's real `.navigation--mute` control before falling back to direct video mute state updates.
- Stop relying on the Up Arrow keyboard shortcut as the primary mute path.

## 0.1.16

- Show live frame event connection counts in the add-on console and health/device APIs.
- Fall back to the configured FreeKiosk REST remote endpoint when iframe event commands, including Kiosk Mute Toggle, have no connected frame browser.

## 0.1.15

- Add kiosk password diagnostics and optional per-device kiosk password overrides in the add-on console.
- Add a Home Assistant Kiosk Mute Toggle button and Up/Down Arrow Action selects for immich-kiosk.

## 0.1.14

- Show separate Local Frame URL and External Frame URL values in the add-on console.
- Clarify that remote frames should use a controller tunnel hostname, not the Immich server or direct immich-kiosk hostname.

## 0.1.13

- Preserve `Accept-Ranges` and `Content-Range` headers for proxied immich-kiosk video playback.

## 0.1.12

- Add Home Assistant volume up and volume down buttons for FreeKiosk frame devices.
- Route volume commands through FreeKiosk keyboard media key endpoints.
- Add a Show Videos switch that passes `show_videos` to immich-kiosk renderer URLs.

## 0.1.11

- Handle `text/javascript` kiosk assets with the JavaScript-safe proxy rewriter.
- Make frame commands try the proxied kiosk API and navigation controls before falling back to keyboard events.

## 0.1.10

- Fix kiosk proxy rewriting so JavaScript regular expressions are not modified.

## 0.1.9

- Proxy immich-kiosk through the controller origin for frame pages.
- Bridge Home Assistant next, previous, play/pause, and reload commands into the renderer iframe instead of relying on FreeKiosk key events.
- Keep FreeKiosk REST control for screen on and screen off.

## 0.1.5

- Add FreeKiosk REST remote-control support per frame device.
- Add Home Assistant buttons for next, previous, play/pause, reload, screen on, and screen off.
- Add remote-control settings to the add-on console device editor.

## 0.1.4

- Add local-console device management for multiple frame endpoints.
- Group Home Assistant entities under one Home Assistant device per frame device ID.
- Add a writable Albums text entity and album-name service fields for multi-album frame selection.

## 0.1.3

- Redesign the add-on Web UI into a denser operations console.
- Add Home Assistant controls and URL overrides for immich-kiosk transitions, layouts, image effects, frame UI, progress bar, and burn-in protection.
- Keep offline mode out of frame profiles because it requires persistent assets and has URL override limitations.

## 0.1.2

- Handle the Home Assistant ingress root path when it is forwarded as `//`.

## 0.1.1

- Fix add-on Web UI routing for `/`, `/setup`, and `//setup`.
- Expand the Web UI into an operational console with frame URLs, renderer diagnostics, and sleep override state.
- Add Home Assistant sleep controls for immich-kiosk URL overrides.

## 0.1.0

- Initial Home Assistant add-on packaging.
- Runs the existing Immich Frame Controller Docker image.
- Adds add-on configuration UI, Web UI link, Ingress entry, health watchdog, and default port mapping.
