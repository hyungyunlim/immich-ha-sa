# FreeKiosk Remote Control

If the frame runs FreeKiosk, the controller can drive display and audio hardware through the FreeKiosk REST API: brightness, volume, screen power, and slideshow navigation. Optionally, the same control can run over [MQTT](#_3-optional-mqtt-push-control) for push telemetry and IP-free delivery.

## 1. Enable the REST API on the frame

In the FreeKiosk app on the frame device, enable the **Remote API** (REST). Note the device's LAN IP and the API port — `8080` by default — and set an API key if you want one.

## 2. Configure the device in the controller

Open the device settings in the [controller console](./controller-setup) and set:

- **Remote Control**: `freekiosk`
- **Remote API URL**: the FreeKiosk REST base URL, for example `http://192.168.1.160:8080`
- **Remote API Key**: optional, only if enabled in FreeKiosk

::: warning Remote frames need a shared network
The controller must be able to reach the Remote API URL directly. For a frame outside the LAN, the Cloudflare Tunnel does not carry this traffic — connect the controller host and the frame with WireGuard or Tailscale and use the frame's VPN address as the Remote API URL. See [Remote Frames](./remote-frames#remote-hardware-control). MQTT (below) avoids this constraint entirely.
:::

## 3. Optional: MQTT push control

FreeKiosk can also publish telemetry and accept commands over MQTT. When the controller and the frame share a broker, the controller publishes hardware commands to FreeKiosk's `set/*` topics and consumes its availability and state topics — with REST as an automatic fallback in both directions.

What this adds over REST alone:

- **Online/offline tracking** — FreeKiosk's MQTT Last Will marks the frame offline the moment it drops off the network. The controller exposes this to Home Assistant as a connectivity sensor.
- **Push telemetry** — battery, screen state, WiFi signal, light sensor, and camera motion arrive as broker pushes instead of REST polls.
- **No IP discovery** — the frame connects out to the broker, so DHCP changes and sleeping devices stop breaking hardware control. MQTT state also keeps the controller's REST fallback IP fresh.

### Enable it

1. **Broker** — on Home Assistant OS, install the Mosquitto broker add-on; the controller add-on auto-detects it through the Supervisor (override with the `mqtt_*` add-on options if needed). For standalone Docker, set `MQTT_BROKER_URL` (plus `MQTT_USERNAME` / `MQTT_PASSWORD`) on the controller container.
2. **Frame** — in the FreeKiosk app open **Advanced → MQTT**, point it at the same broker, set a **Device Name** (for example `lobby`), and press **Connect**.
3. **Bind** — open the controller console. The frame appears in the **MQTT Bridge** section; click **Bind** next to it. When the frame's IP matches a known frame, the console preselects it.

MQTT and the REST API can stay enabled together; the controller uses whichever path is healthy. Status reads still prefer REST when it is reachable (REST includes fields like auto-brightness that the MQTT state omits); the MQTT cache answers when REST is down.

::: tip Remote frames without a VPN
The frame opens an outbound connection to the broker, so MQTT hardware control also works for frames outside the LAN — no WireGuard/Tailscale needed, as long as the frame can reach your broker.
:::

### FreeKiosk HA auto-discovery

Independently of this integration, FreeKiosk's MQTT client can publish Home Assistant discovery entities (40+ sensors and controls) directly. That runs fine alongside the controller — entities from both will appear in Home Assistant.

## What you get in Home Assistant

Number entities:

- **Display Brightness** — manual brightness via `/api/brightness`
- **Media Volume**

Status entities (when FreeKiosk telemetry is available over REST or MQTT):

- **Light Level**
- **Auto Brightness Active**
- **Device Online** — connectivity, from the MQTT Last Will or a successful REST status read. Without MQTT it can only show on or unavailable; an explicit off state needs the MQTT binding
- **Motion** — FreeKiosk camera motion (`webview.motionDetected`); enable *Always-on Motion Detection* in FreeKiosk for continuous reporting
- **Battery**, **Battery Charging**, **WiFi Signal** — diagnostic sensors

Buttons:

- **Next**, **Previous**, **Play/Pause**, **Reload**
- **Screen On**, **Screen Off**
- **Volume Up**, **Volume Down**, **Device Mute Toggle**

## How commands are delivered

Next, previous, play/pause, and reload are sent to the fixed frame page over the controller event stream, then bridged into the same-origin immich-kiosk iframe. If no frame browser is connected, these commands fall back to the FreeKiosk device path.

Screen, brightness, and volume controls go to the FreeKiosk device directly. When the frame is bound over MQTT and online, the controller publishes to FreeKiosk's command topics (`set/screen`, `set/brightness`, `set/volume`, `set/reload`) first; otherwise it calls the REST endpoints (`/api/screen/on`, `/api/screen/off`, `/api/brightness`, `/api/volume`). Volume step and device mute keep their REST key-event semantics (`/api/remote/keyboard/*`) while REST is reachable and fall back to MQTT volume emulation when it is not. Auto-brightness control is REST-only — FreeKiosk exposes no MQTT topic for it.

::: warning Keep navigation enabled
Keep the frame's `disableNavigation` renderer option **off** when using the next/previous buttons. immich-kiosk's `disable_navigation` blocks touch, keyboard, and menu navigation, so bridged commands are ignored when it is enabled.
:::

## Audio: device mute vs. video mute

- **Device Mute Toggle**, **Volume Up/Down** — Android device audio, sent as key events through FreeKiosk. Use these for reliable frame-wide audio state.
- **Kiosk Video Mute** — a press button that controls immich-kiosk's own video mute. It clicks the kiosk's `.navigation--mute` control first, then falls back to toggling the video element's muted state. It is a press button (not a switch) because immich-kiosk does not expose a reliable readable mute state.

## Known FreeKiosk limitations

FreeKiosk 1.2.16 reports auto-brightness state in `/api/status` but does not expose the documented `/api/autoBrightness/enable` / `/api/autoBrightness/disable` endpoints. Use **Display Brightness** for manual control; FreeKiosk disables auto-brightness when needed via `/api/brightness`.
