# Immich HA Smart Frame Controller

This project controls an Android photo frame, such as a Lenovo Smart Frame running Fully Kiosk Browser or FreeKiosk, from Home Assistant while preserving the existing `immich-kiosk` rendering experience.

Documentation: [immich-frame.junlim.org](https://immich-frame.junlim.org/) ([English](https://immich-frame.junlim.org/en/guide/) / [한국어](https://immich-frame.junlim.org/ko/guide/))

The frame keeps one fixed URL:

```text
http://<controller-host>:<controller-host-port>/frame/lenovo
```

For remote frames, the same route can be exposed through Cloudflare Tunnel:

```text
https://frame.example.com/frame/lenovo
```

## Architecture

```text
Home Assistant HACS integration
        |
        v
Frame Controller
  - Home Assistant add-on, or
  - standalone Docker container
        |
        v
Lenovo frame /frame/lenovo
        |
        v
immich-kiosk renderer
        |
        v
Immich
```

The controller owns desired state and generates the browser-facing `immich-kiosk` URL. It keeps Immich credentials server-side and separates internal service URLs from URLs that the frame browser can reach.

## Installation

The controller and the Home Assistant integration are installed separately. The add-on (or standalone container) runs the controller; the integration provides entities, album selection, profiles, services, and automations. Install both.

### Prerequisites

- A running Immich server and an Immich API key
- A running `immich-kiosk` instance
- Home Assistant 2026.3.0 or newer
- Home Assistant OS or Supervised for the add-on; Home Assistant Container/Core users run the controller as a [standalone Docker container](#standalone-docker) instead

If your existing `immich-kiosk` instance uses `KIOSK_PASSWORD`, set the same value for the controller (`kiosk_password` add-on option, or `KIOSK_PASSWORD` env for standalone Docker). The controller appends the required `password` query parameter when it generates the iframe URL.

### Step 1 - Install the add-on (controller)

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)
[![Open add-on in my Home Assistant](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=e2ffcf58_immich_frame_controller&repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)

1. Click the first badge above, or add the repository manually: open Settings -> Add-ons -> Add-on Store, open repositories from the top-right menu, and add:

```text
https://github.com/hyungyunlim/immich-ha-sa
```

2. Install `Immich Frame Controller`.
3. Configure the add-on:
   - `immich_internal_url`: Immich API URL reachable from the add-on
   - `immich_api_key`: Immich API key
   - `kiosk_internal_url`: immich-kiosk URL reachable from the add-on
   - `local_public_controller_url`: usually `http://<home-assistant-host>:8082`
   - `local_public_kiosk_url`: browser-facing immich-kiosk URL
   - `album_refresh_interval_seconds`: how often the controller refreshes Immich albums in the background; `0` disables automatic refresh
4. Start the add-on.
5. Open the add-on Web UI or:

```text
http://<home-assistant-host>:8082/setup
```

The add-on exposes container port `8080` as host port `8082` by default. If you change the add-on network port, update `local_public_controller_url`, the Home Assistant integration controller URL, and the Lenovo/Fully Kiosk fixed URL to match.

### Step 2 - Install the integration (HACS)

[![Open repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=hyungyunlim&repository=immich-ha-sa&category=integration)

1. Click the badge above, or add the repository manually: open HACS, go to custom repositories, add `https://github.com/hyungyunlim/immich-ha-sa` with category `Integration`.
2. Download `Immich Frame Controller`.
3. Restart Home Assistant.
4. Add the integration:

   [![Add integration to my Home Assistant](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=immich_frame)

   Or go to Settings -> Devices & services -> Add integration -> `Immich Frame Controller`.
5. Enter:
   - Controller URL: keep the prefilled `http://homeassistant.local:8082` for the add-on, or change it to `http://<controller-host>:<controller-host-port>` for standalone Docker
   - Device ID: `lenovo`
6. On the pairing step, open the setup page link shown by Home Assistant, or copy the prefilled Setup URL, and enter the short code displayed there.

```text
http://<controller-host>:<controller-host-port>/setup
```

The Controller API token field is an optional fallback. Leave it blank unless you configured `CONTROLLER_API_TOKEN`.

HACS installs from the latest commit on `main` until a GitHub release is published.

### Step 3 - Point the frame at the controller

Set the frame browser (Fully Kiosk / FreeKiosk) start page to the fixed frame URL:

```text
http://<home-assistant-host>:8082/frame/lenovo
```

For physical frame pairing, open the controller Pair URL on the frame instead:

```text
http://<home-assistant-host>:8082/pair
```

The add-on root URL opens the setup console. After claiming a frame code in the console, use the generated stable frame path such as `/f/kitchen-frame-8k2p` as the durable URL for that device.

## Standalone Docker

For Home Assistant Container/Core, or when Home Assistant should not manage the controller, run the controller as a plain Docker container.

1. Copy the env template:

```bash
cp .env.example .env
```

2. Edit `.env`:

```text
IMMICH_INTERNAL_URL=http://127.0.0.1:2283
IMMICH_API_KEY=...
KIOSK_INTERNAL_URL=http://127.0.0.1:3000
KIOSK_PASSWORD=...
PORT=8080
CONTROLLER_HOST_PORT=8082
LOCAL_PUBLIC_CONTROLLER_URL=http://<controller-host>:<controller-host-port>
LOCAL_PUBLIC_KIOSK_URL=http://<controller-host>:3000
EXTERNAL_PUBLIC_CONTROLLER_URL=https://frame.example.com
EXTERNAL_PUBLIC_KIOSK_URL=https://frame.example.com/kiosk
ALBUM_REFRESH_INTERVAL_SECONDS=900
CONTROLLER_API_TOKEN=
```

`PORT` is the internal app port. `CONTROLLER_HOST_PORT` is the Docker host port exposed on the RPi or server. If `8082` is already in use, choose another host port and update `LOCAL_PUBLIC_CONTROLLER_URL`, the Home Assistant integration controller URL, and the Lenovo/Fully Kiosk fixed URL to match.

`CONTROLLER_API_TOKEN` is an optional static fallback. Most users should leave it blank and use the pairing flow from Home Assistant instead. Complete pairing before exposing the controller through an external tunnel.

3. Start with Docker Compose. Use `docker-compose.example.yml` as a starting point. The `/data` volume stores frame state, profiles, and album cache.

```bash
docker compose --env-file .env -f docker-compose.example.yml up -d --build
```

If the controller joins the Immich Docker network, `IMMICH_INTERNAL_URL` and `KIOSK_INTERNAL_URL` can use container names. Browser-facing URLs must still be reachable from the frame.

The Docker example exposes `${CONTROLLER_HOST_PORT:-8082}` on the host and forwards it to `${PORT:-8080}` in the container. `8082` is only a default example; use any free host port.

## Cloudflare Tunnel

For remote frames, prefer a single public domain:

```text
https://frame.example.com/frame/lenovo
https://frame.example.com/kiosk/...
```

`cloudflared.example.yml` routes `/kiosk/*` to `immich-kiosk` and everything else to the controller. Point the controller service at the host port you chose, for example `http://localhost:8082`. The setup page blocks requests that arrive on the configured external controller host. Remote mode should use polling fallback if SSE is unreliable through the tunnel.

## Using the Integration

Album options shown in Home Assistant come from the controller cache. The integration reads that cache every 30 seconds, while the controller refreshes it from Immich every `album_refresh_interval_seconds` seconds. Use the `Refresh Albums` button or `immich_frame.refresh_albums` service when a newly created Immich album needs to appear immediately. When no album filter is active, the Album select shows `No Album Filter`; choose it before selecting a person when you want person-only source selection. For multiple selected albums, use the Albums text entity or service fields.

For date-based photo selection, use `Date Filter Preset` for common ranges, or `Filter Start Date` / `Filter End Date` for a custom date picker range. The raw `Date Filter` text entity remains available for advanced immich-kiosk values such as `last-30-days` or `2021-01-01_to_today`. Use `Newest Filter` to limit the current album/source to the newest N assets; `0` disables it. Use `Album Order` to choose the immich-kiosk album order: `random`, `newest`, or `oldest`.

For frame display, the integration exposes immich-kiosk URL overrides for clock, date, weather selection, weather detail display, font size, background blur amount, and image metadata such as image date/time, album, person, camera, EXIF, location, rating, owner, and user. Set **Custom CSS Class** to a class such as `art-gallery` to append `custom_css_class=art-gallery` to the renderer URL; the value is also saved in profiles, so different albums or use cases can activate different rules in immich-kiosk's `custom.css`. Weather API keys and weather locations still live in immich-kiosk `config.yaml`; the weather detail selects use `Use Kiosk Config`, `Show`, or `Hide` so each frame can inherit or override the configured location behavior.

For frame display and audio hardware control, configure the FreeKiosk Remote API URL in the add-on device settings. The integration then exposes direct `Display Brightness` and `Media Volume` number entities, plus `Light Level`, `Auto Brightness Active`, and accelerometer-backed `X-Axis Dominant` status entities. The orientation sensor is ON when the device is upright with X dominant, OFF when Y is dominant, and unavailable while flat or near 45 degrees; use whichever state matches landscape on your device. FreeKiosk 1.2.16 reports auto-brightness state but does not expose the documented REST toggle endpoints; setting display brightness through `/api/brightness` is the supported manual override path and FreeKiosk disables auto-brightness if needed.

For frame-wide audio buttons, use the `Device Mute Toggle`, `Volume Up`, and `Volume Down` entities when FreeKiosk Remote API is configured. The immich-kiosk video mute control is exposed as a stateful `Kiosk Video Mute` switch backed by the controller's desired state, plus a press button for quick toggles.

Provided services:

```yaml
immich_frame.set_album
immich_frame.set_people
immich_frame.set_profile
immich_frame.save_profile
immich_frame.delete_profile
immich_frame.refresh_albums
immich_frame.refresh_people
immich_frame.set_renderer_options
immich_frame.set_network_mode
```

Example automation:

```yaml
alias: Lenovo frame morning profile
trigger:
  - platform: time
    at: "07:00:00"
action:
  - service: immich_frame.set_profile
    data:
      profile_id: morning
```

## Advanced Configuration

When the pairing flow succeeds, Home Assistant stores the issued controller API token in the config entry. Users do not need to SSH into the controller host or copy `CONTROLLER_API_TOKEN` from `.env`.

YAML import remains supported for controlled deployments:

```yaml
immich_frame:
  controller_url: http://<controller-host>:<controller-host-port>
  api_token: !secret immich_frame_controller_token
  device_id: lenovo
```

## API

Read state:

```bash
curl http://localhost:8080/api/frame/lenovo/state
```

Update state:

```bash
curl -X PUT http://localhost:8080/api/frame/lenovo/state \
  -H "Authorization: Bearer $CONTROLLER_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activeAlbumIds":["album-id"],"networkMode":"local"}'
```

Refresh albums:

```bash
curl -X POST http://localhost:8080/api/immich/albums/refresh \
  -H "Authorization: Bearer $CONTROLLER_API_TOKEN"
```

## Development

Run the controller locally without Docker. Copy and edit `.env` as described in [Standalone Docker](#standalone-docker), then:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:8080/api/health
http://localhost:8080/frame/lenovo
http://localhost:8080/setup
```

For code-change, validation, and production rollout workflow, see [Development and Production Deployment Guide](docs/internal/development-guide.md).

### Verification Checklist

- `npm run typecheck`
- `npm test`
- `npm run build`
- `GET /api/health` returns controller status.
- `GET /api/immich/albums` returns cached album data.
- `PUT /api/frame/lenovo/state` rejects unknown albums when album cache exists.
- `/frame/lenovo` fills the viewport and keeps the last renderer visible.
- Local mode emits LAN controller proxy URLs.
- External mode emits Cloudflare controller proxy URLs.
- Lenovo/Fully Kiosk renders the page.
- Polling fallback works when SSE is unavailable.
