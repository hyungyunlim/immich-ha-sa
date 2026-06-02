# Changelog

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
