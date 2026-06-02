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
CONTROLLER_API_TOKEN=...
```

`PORT` is the internal app port. `CONTROLLER_HOST_PORT` is the Docker host port exposed on the RPi or server. If `8082` is already in use, choose another host port and update `LOCAL_PUBLIC_CONTROLLER_URL`, the Home Assistant controller URL, and the Lenovo/Fully Kiosk fixed URL to match.

3. Run locally without Docker:

```bash
npm install
npm run dev
```

4. Open:

```text
http://localhost:8080/api/health
http://localhost:8080/frame/lenovo
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

`cloudflared.example.yml` routes `/kiosk/*` to `immich-kiosk` and everything else to the controller. Point the controller service at the host port you chose, for example `http://localhost:8082`. Remote mode should use polling fallback if SSE is unreliable through the tunnel.

## Home Assistant

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
   - Controller URL: `http://<rpi-lan-ip>:<controller-host-port>`
   - Controller API token: the value of `CONTROLLER_API_TOKEN`
   - Device ID: `lenovo`

HACS custom repositories are intended for public GitHub repositories. If this repository stays private, HACS may not be able to add it from the Home Assistant UI unless the HACS GitHub connection has access to the private repository.

YAML import remains supported for controlled deployments:

```yaml
immich_frame:
  controller_url: http://<rpi-lan-ip>:<controller-host-port>
  api_token: !secret immich_frame_controller_token
  device_id: lenovo
```

Provided services:

```yaml
immich_frame.set_album
immich_frame.set_profile
immich_frame.refresh_albums
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
- Local mode emits LAN URLs.
- External mode emits Cloudflare domain URLs.
- Lenovo/Fully Kiosk renders the page.
- Polling fallback works when SSE is unavailable.
