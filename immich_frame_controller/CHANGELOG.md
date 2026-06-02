# Changelog

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
