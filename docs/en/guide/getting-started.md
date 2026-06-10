# Getting Started

## Prerequisites

- A running **Immich** server and an Immich API key
- A running **immich-kiosk** instance
- **Home Assistant 2026.3.0** or newer
- For the add-on: **Home Assistant OS** or **Supervised**. Home Assistant Container/Core users run the controller as a [standalone Docker container](./standalone-docker) instead.
- A frame device with a kiosk browser — Fully Kiosk Browser or FreeKiosk on Android works well

::: tip Kiosk password
If your immich-kiosk instance uses `KIOSK_PASSWORD`, give the controller the same value (`kiosk_password` add-on option, or `KIOSK_PASSWORD` env for standalone Docker). The controller appends the required `password` query parameter when it generates the renderer URL.
:::

## Installation overview

The controller and the Home Assistant integration are installed separately. The add-on (or standalone container) runs the controller; the integration provides the entities and services. Install both.

| Step | What | Where |
| --- | --- | --- |
| 1 | [Install the add-on](./addon-install) — runs the controller | Settings → Add-ons |
| 2 | [Install the integration](./integration-install) — entities and services | HACS |
| 3 | [Pair and point the frame](./pairing) at its fixed URL | Frame browser |

## What you end up with

- A controller console at `http://<home-assistant-host>:8082/setup` showing devices, URLs, and pairing codes
- A Home Assistant device per frame with entities for albums, people, profiles, filters, and display options
- A frame showing your Immich photos at a URL that never changes:

```text
http://<home-assistant-host>:8082/frame/lenovo
```

From here, change what the frame shows from Home Assistant — dashboards, automations, or voice assistants.
