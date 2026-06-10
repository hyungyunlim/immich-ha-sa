#!/bin/sh
set -eu

OPTIONS_PATH="/data/options.json"

read_option() {
  node -e '
const fs = require("node:fs");
const path = process.argv[1];
const key = process.argv[2];
if (!fs.existsSync(path)) process.exit(0);
const options = JSON.parse(fs.readFileSync(path, "utf8"));
const value = options[key];
if (value === undefined || value === null || value === "") process.exit(0);
process.stdout.write(String(value));
' "$OPTIONS_PATH" "$1"
}

set_env_default() {
  name="$1"
  value="$2"
  eval "current=\${$name:-}"
  if [ -z "$current" ]; then
    export "$name=$value"
  fi
}

set_env_from_option() {
  name="$1"
  key="$2"
  value="$(read_option "$key")"
  if [ -n "$value" ]; then
    export "$name=$value"
  fi
}

if [ -f "$OPTIONS_PATH" ]; then
  set_env_default PORT 8080
  set_env_default DATA_DIR /data/controller

  set_env_from_option IMMICH_INTERNAL_URL immich_internal_url
  set_env_from_option IMMICH_API_KEY immich_api_key
  set_env_from_option KIOSK_INTERNAL_URL kiosk_internal_url
  set_env_from_option KIOSK_PASSWORD kiosk_password
  set_env_from_option LOCAL_PUBLIC_CONTROLLER_URL local_public_controller_url
  set_env_from_option LOCAL_PUBLIC_KIOSK_URL local_public_kiosk_url
  set_env_from_option EXTERNAL_PUBLIC_CONTROLLER_URL external_public_controller_url
  set_env_from_option EXTERNAL_PUBLIC_KIOSK_URL external_public_kiosk_url
  set_env_from_option DEFAULT_FRAME_ID default_frame_id
  set_env_from_option DEFAULT_FRAME_NAME default_frame_name
  set_env_from_option DEFAULT_NETWORK_MODE default_network_mode
  set_env_from_option POLL_INTERVAL_SECONDS poll_interval_seconds
  set_env_from_option ALBUM_REFRESH_INTERVAL_SECONDS album_refresh_interval_seconds
  set_env_from_option CONTROLLER_API_TOKEN controller_api_token
  set_env_from_option MQTT_BROKER_URL mqtt_broker_url
  set_env_from_option MQTT_USERNAME mqtt_username
  set_env_from_option MQTT_PASSWORD mqtt_password
  set_env_from_option MQTT_BASE_TOPIC mqtt_base_topic
fi

# With no manual broker URL, ask the Supervisor for the shared MQTT service
# (provided by the Mosquitto add-on when `services: mqtt:want` is declared).
if [ -z "${MQTT_BROKER_URL:-}" ] && [ -n "${SUPERVISOR_TOKEN:-}" ]; then
  mqtt_service="$(node -e '
const token = process.env.SUPERVISOR_TOKEN;
fetch("http://supervisor/services/mqtt", {
  headers: { Authorization: "Bearer " + token },
})
  .then(async (response) => {
    if (!response.ok) return;
    const payload = await response.json();
    const data = payload && payload.data;
    if (!data || !data.host) return;
    const protocol = data.ssl ? "mqtts" : "mqtt";
    const port = data.port || 1883;
    process.stdout.write([
      protocol + "://" + data.host + ":" + port,
      data.username || "",
      data.password || "",
    ].join("\n"));
  })
  .catch(() => {});
' 2>/dev/null || true)"
  if [ -n "$mqtt_service" ]; then
    MQTT_BROKER_URL="$(printf '%s\n' "$mqtt_service" | sed -n '1p')"
    export MQTT_BROKER_URL
    if [ -z "${MQTT_USERNAME:-}" ]; then
      mqtt_service_username="$(printf '%s\n' "$mqtt_service" | sed -n '2p')"
      if [ -n "$mqtt_service_username" ]; then
        export MQTT_USERNAME="$mqtt_service_username"
      fi
    fi
    if [ -z "${MQTT_PASSWORD:-}" ]; then
      mqtt_service_password="$(printf '%s\n' "$mqtt_service" | sed -n '3p')"
      if [ -n "$mqtt_service_password" ]; then
        export MQTT_PASSWORD="$mqtt_service_password"
      fi
    fi
    echo "MQTT broker auto-detected from Supervisor: $MQTT_BROKER_URL"
  fi
fi

exec "$@"
