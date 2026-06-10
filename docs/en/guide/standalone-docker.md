# Standalone Docker

For Home Assistant Container/Core, or when Home Assistant should not manage the controller, run the controller as a plain Docker container. The integration and all entities work the same way.

## 1. Configure the environment

Clone the repository (or copy the example files), then:

```bash
cp .env.example .env
```

Edit `.env`:

```text
IMMICH_INTERNAL_URL=http://127.0.0.1:2283
IMMICH_API_KEY=...
KIOSK_INTERNAL_URL=http://127.0.0.1:3000
KIOSK_PASSWORD=...
PORT=8080
CONTROLLER_HOST_PORT=8082
LOCAL_PUBLIC_CONTROLLER_URL=http://<controller-host>:8082
LOCAL_PUBLIC_KIOSK_URL=http://<controller-host>:3000
EXTERNAL_PUBLIC_CONTROLLER_URL=https://frame.example.com
EXTERNAL_PUBLIC_KIOSK_URL=https://frame.example.com/kiosk
ALBUM_REFRESH_INTERVAL_SECONDS=900
CONTROLLER_API_TOKEN=
MQTT_BROKER_URL=
MQTT_USERNAME=
MQTT_PASSWORD=
```

- `PORT` is the internal app port; `CONTROLLER_HOST_PORT` is the Docker host port. If `8082` is taken, pick another and update `LOCAL_PUBLIC_CONTROLLER_URL`, the integration's controller URL, and the frame URL to match.
- `CONTROLLER_API_TOKEN` is an optional static fallback — leave it blank and use the [pairing flow](./pairing) instead.
- `MQTT_BROKER_URL` is optional and enables [FreeKiosk MQTT push control](./freekiosk#_3-optional-mqtt-push-control). Accepts a bare host (`192.168.1.10`) or `mqtt://host:1883`; blank keeps MQTT off.

## 2. Start the container

Use `docker-compose.example.yml` from the repository as a starting point. The `/data` volume stores frame state, profiles, and the album cache.

```bash
docker compose --env-file .env -f docker-compose.example.yml up -d --build
```

If the controller joins the Immich Docker network, `IMMICH_INTERNAL_URL` and `KIOSK_INTERNAL_URL` can use container names. Browser-facing URLs must still be reachable from the frame.

## 3. Verify

```text
http://<controller-host>:8082/api/health
http://<controller-host>:8082/setup
http://<controller-host>:8082/frame/lenovo
```

Then continue with the [integration installation](./integration-install) — enter `http://<controller-host>:8082` as the controller URL in the config flow.
