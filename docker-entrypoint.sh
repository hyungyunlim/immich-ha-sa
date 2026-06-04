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
fi

exec "$@"
