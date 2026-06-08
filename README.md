# Immich HA Smart Frame Controller

This project controls a Lenovo Smart Frame running Fully Kiosk Browser from Home Assistant while preserving the existing `immich-kiosk` rendering experience.

The frame keeps one fixed URL:

```text
http://<rpi-lan-ip>:<controller-host-port>/frame/lenovo
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

If your existing `immich-kiosk` instance uses `KIOSK_PASSWORD`, set the same value as `KIOSK_PASSWORD` for the controller. The controller appends the required `password` query parameter when it generates the iframe URL.

For code-change, validation, and production rollout workflow, see [Development and Production Deployment Guide](docs/development-guide.md).

## Controller Setup

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
LOCAL_PUBLIC_CONTROLLER_URL=http://<rpi-lan-ip>:<controller-host-port>
LOCAL_PUBLIC_KIOSK_URL=http://<rpi-lan-ip>:3000
EXTERNAL_PUBLIC_CONTROLLER_URL=https://frame.example.com
EXTERNAL_PUBLIC_KIOSK_URL=https://frame.example.com/kiosk
ALBUM_REFRESH_INTERVAL_SECONDS=900
CONTROLLER_API_TOKEN=
```

`PORT` is the internal app port. `CONTROLLER_HOST_PORT` is the Docker host port exposed on the RPi or server. If `8082` is already in use, choose another host port and update `LOCAL_PUBLIC_CONTROLLER_URL`, the Home Assistant controller URL, and the Lenovo/Fully Kiosk fixed URL to match.

`CONTROLLER_API_TOKEN` is an optional static fallback. Most users should leave it blank and use the pairing flow from Home Assistant instead. Complete pairing before exposing the controller through an external tunnel.

3. Run locally without Docker:

```bash
npm install
npm run dev
```

4. Open:

```text
http://localhost:8080/api/health
http://localhost:8080/frame/lenovo
http://localhost:8080/setup
```

## Docker

Use `docker-compose.example.yml` as a starting point. The `/data` volume stores frame state, profiles, and album cache.

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

## Home Assistant Add-on

Home Assistant OS and Home Assistant Supervised users can run the controller as an add-on. This is the preferred installation path when Home Assistant should manage the controller container, logs, startup, port mapping, and setup UI.

1. Open Settings -> Add-ons -> Add-on Store.
2. Open repositories from the top-right menu.
3. Add this repository URL:

```text
https://github.com/hyungyunlim/immich-ha-sa
```

4. Install `Immich Frame Controller`.
5. Configure the add-on:
   - `immich_internal_url`: Immich API URL reachable from the add-on
   - `immich_api_key`: Immich API key
   - `kiosk_internal_url`: immich-kiosk URL reachable from the add-on
   - `local_public_controller_url`: usually `http://<home-assistant-host>:8082`
   - `local_public_kiosk_url`: browser-facing immich-kiosk URL
   - `album_refresh_interval_seconds`: how often the controller refreshes Immich albums in the background; `0` disables automatic refresh
6. Start the add-on.
7. Open the add-on Web UI or:

```text
http://<home-assistant-host>:8082/setup
```

The add-on exposes container port `8080` as host port `8082` by default. If you change the add-on network port, update `local_public_controller_url`, the Home Assistant integration controller URL, and the Lenovo/Fully Kiosk fixed URL to match.

The add-on does not replace the Home Assistant integration. Use the integration for entities, album selection, profiles, services, and automations.

## Home Assistant Integration

Install with HACS as a custom repository:

1. Open HACS in Home Assistant.
2. Go to custom repositories.
3. Add this repository URL:

```text
https://github.com/hyungyunlim/immich-ha-sa
```

4. Select category `Integration`.
5. Download `Immich Frame Controller`.
6. Restart Home Assistant.
7. Go to Settings -> Devices & services -> Add integration -> `Immich Frame Controller`.
8. Enter:
   - Controller URL: keep the prefilled `http://homeassistant.local:8082` for the add-on, or change it to `http://<rpi-lan-ip>:<controller-host-port>` for standalone Docker
   - Device ID: `lenovo`
9. On the pairing step, open the setup page link shown by Home Assistant, or copy the prefilled Setup URL, and enter the short code displayed there.

```text
http://<rpi-lan-ip>:<controller-host-port>/setup
```

The Controller API token field is an optional fallback. Leave it blank unless you configured `CONTROLLER_API_TOKEN`.

HACS custom repositories are intended for public GitHub repositories. If this repository stays private, HACS may not be able to add it from the Home Assistant UI unless the HACS GitHub connection has access to the private repository.

YAML import remains supported for controlled deployments:

```yaml
immich_frame:
  controller_url: http://<rpi-lan-ip>:<controller-host-port>
  api_token: !secret immich_frame_controller_token
  device_id: lenovo
```

When the pairing flow succeeds, Home Assistant stores the issued controller API token in the config entry. Users do not need to SSH into the RPi or copy `CONTROLLER_API_TOKEN` from `.env`.

Album options shown in Home Assistant come from the controller cache. The integration reads that cache every 30 seconds, while the controller refreshes it from Immich every `album_refresh_interval_seconds` seconds. Use the `Refresh Albums` button or `immich_frame.refresh_albums` service when a newly created Immich album needs to appear immediately. When no album filter is active, the Album select shows `No Album Filter`; choose it before selecting a person when you want person-only source selection. For multiple selected albums, use the Albums text entity or service fields.

For physical frame pairing, open the controller Pair URL on the frame:

```text
http://<home-assistant-host>:8082/pair
```

The add-on root URL opens the setup console. After claiming a frame code in the console, use the generated stable frame path such as `/f/kitchen-frame-8k2p` as the durable URL for that device.

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

For frame display and audio hardware control, configure the FreeKiosk Remote API URL in the add-on device settings. The integration then exposes direct `Display Brightness` and `Media Volume` number entities, plus `Light Level` and `Auto Brightness Active` status entities. FreeKiosk 1.2.16 reports auto-brightness state but does not expose the documented REST toggle endpoints; setting display brightness through `/api/brightness` is the supported manual override path and FreeKiosk disables auto-brightness if needed.

For frame audio buttons, use the `Device Mute Toggle`, `Volume Up`, and `Volume Down` entities when FreeKiosk Remote API is configured. The immich-kiosk video mute control is exposed as a `Kiosk Video Mute` press button because immich-kiosk does not expose a reliable readable mute state to Home Assistant.

For date-based photo selection, use `Date Filter Preset` for common ranges, or `Filter Start Date` / `Filter End Date` for a custom date picker range. The raw `Date Filter` text entity remains available for advanced immich-kiosk values such as `last-30-days` or `2021-01-01_to_today`. Use `Newest Filter` to limit the current album/source to the newest N assets; `0` disables it. Use `Album Order` to choose the immich-kiosk album order: `random`, `newest`, or `oldest`.

For frame display, the integration exposes immich-kiosk URL overrides for clock, date, weather selection, font size, background blur amount, and image metadata such as image date/time, album, person, camera, EXIF, location, rating, owner, and user. Weather API keys and detailed weather fields such as humidity, wind, visibility, and temperature range remain immich-kiosk `config.yaml` location settings.

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

## Verification Checklist

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
