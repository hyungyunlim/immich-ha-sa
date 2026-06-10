# What is Immich Frame Controller?

Immich Frame Controller drives an Android photo frame — such as a Lenovo Smart Frame running Fully Kiosk Browser or FreeKiosk — from Home Assistant, while your existing [immich-kiosk](https://github.com/damongolding/immich-kiosk) instance keeps rendering the photos.

The core idea: the frame browser keeps **one fixed URL** forever.

```text
http://<controller-host>:8082/frame/lenovo
```

Everything else — which albums or people are shown, transitions, clock and weather overlays, sleep schedules — is decided by the controller and changed from Home Assistant. You never have to touch the frame again.

## Architecture

```text
Home Assistant integration (HACS)
        |
        v
Frame Controller
  - Home Assistant add-on, or
  - standalone Docker container
        |
        v
Frame browser  /frame/<device-id>
        |
        v
immich-kiosk renderer
        |
        v
Immich
```

| Component | Role |
| --- | --- |
| **Controller** | Owns desired state per frame, generates the browser-facing immich-kiosk URL, proxies it, and exposes a setup console and REST API. Runs as a Home Assistant add-on or a standalone Docker container. |
| **Home Assistant integration** | Exposes entities (selects, switches, numbers, buttons, …) and services for albums, people, profiles, filters, and renderer options. Installed via HACS. |
| **immich-kiosk** | Renders the actual slideshow. The controller appends URL query overrides; your kiosk config stays untouched. |
| **Immich** | Your photo library. API credentials stay server-side in the controller — the frame browser never sees them. |

## What you can control from Home Assistant

- Album and person selection, with multi-select and refresh services
- Saved profiles (e.g. a "morning" look) switched manually or by automation
- Date filters, newest-N filters, album ordering
- Renderer options: transitions, layout, image fit, clock, date, weather, image metadata, font size, background blur, progress bar, burn-in protection, sleep schedule
- Video playback and archived-asset visibility
- Display brightness, volume, and screen power through the [FreeKiosk REST API](./freekiosk)

## Security model

The controller keeps the Immich API key and kiosk password server-side and separates **internal** service URLs (controller → Immich/kiosk) from **public** URLs the frame browser can reach. Home Assistant authenticates to the controller with a token issued through a one-time [pairing flow](./pairing) — no manual token copying.

## Next steps

- [Getting Started](./getting-started) — prerequisites and the three-step install
- [Add-on installation](./addon-install) — Home Assistant OS / Supervised
- [Standalone Docker](./standalone-docker) — Home Assistant Container / Core
