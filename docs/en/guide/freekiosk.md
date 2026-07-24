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
- **X-Axis Dominant** — accelerometer orientation hint. ON means X dominates, OFF means Y dominates; raw `x`, `y`, and `z` values are available as entity attributes
- **Battery**, **Battery Charging**, **WiFi Signal** — diagnostic sensors

> [!NOTE]
> The **Motion** sensor needs a device with a camera. Camera-less frames (most digital photo frames) report no motion — disable the entity if it is not useful.

The axis sensor intentionally does not label either state “portrait” or “landscape.” Android sensor axes follow the device's natural orientation, which is often landscape on tablets, so first rotate your own device and note which state represents landscape. The entity is unavailable while the device is flat, the accelerometer is missing, or X and Y are too close near a 45-degree transition. This avoids false orientation changes and rapid state flapping.

Use the [orientation automation example](./automations#examples) to map ON/OFF to **Landscape only** and **Portrait only**. Swap the two options if the result is reversed on your device; this is expected across Android phones, tablets, and digital frames with different natural orientations.

### Real-time updates over MQTT

When a frame is bound over MQTT, the controller streams its telemetry to Home Assistant the instant the device publishes a change, so motion, screen state, and online/offline reach Home Assistant in about a second instead of waiting for the integration's 30-second poll. This is what makes presence automations ("turn the screen on when someone approaches") usable.

For the lowest motion latency on a camera device:

- Enable **Always-on Motion Detection** in the FreeKiosk MQTT settings (otherwise motion only runs during the screensaver). With it on, FreeKiosk publishes motion changes as they happen.
- The periodic **Status Interval** (default 30s) only governs the routine battery/WiFi/light telemetry; motion is pushed out-of-band, so you usually do not need to lower it.

Without MQTT (REST-only frames), the integration keeps polling every 30 seconds — the push stream simply has no source. The 30-second poll always runs as a fallback, so a dropped stream self-heals.

Buttons:

- **Next**, **Previous**, **Play**, **Pause**, **Play/Pause**, **Reload**
- **Screen On**, **Screen Off**
- **Volume Up**, **Volume Down**, **Device Mute Toggle**

## How commands are delivered

Next, previous, play, pause, play/pause, and reload are sent to the fixed frame page over the controller event stream, then bridged into the same-origin immich-kiosk iframe. The frame page acknowledges whether it actually applied the command and reports its playback state. A connected browser that does not acknowledge or cannot apply the command is no longer reported as a success. If no frame browser is connected, these commands fall back to the FreeKiosk device path.

**Screen Off** does more than turn off the FreeKiosk display. The frame page first unmounts the entire immich-kiosk iframe to stop image fetching and slideshow timers, then the controller prepares brightness/mute state and turns off the physical display. **Screen On** turns on the display, mounts a fresh iframe, and starts the slideshow in the playing state. This prevents the frame from continuing to request the next images from Immich or a NAS while its display is off.

Screen, brightness, and volume controls go to the FreeKiosk device directly. **The controller prefers the REST API whenever it can reach the device** (a manual Remote API URL, or a FreeKiosk IP verified from the frame's own telemetry): REST confirms the command actually executed and avoids device-side MQTT command quirks. MQTT carries these commands only when the controller has no reachable REST endpoint — a remote frame reached through the broker — or as a fallback when a REST attempt fails in a way that is safe to retry (screen on/off and reload are retried over MQTT; relative volume steps and mute toggles are not, to avoid double-applying). Auto-brightness control is REST-only.

> [!NOTE]
> This is why MQTT binding never reduces reliability for local frames: actuation still flows over REST, while MQTT adds presence (online/offline), motion, and telemetry. If a FreeKiosk release regresses an MQTT command (for example screen power), local frames keep working over REST.

::: warning Keep navigation enabled
Keep the frame's `disableNavigation` renderer option **off** when using the next/previous buttons. immich-kiosk's `disable_navigation` blocks touch, keyboard, and menu navigation, so bridged commands are ignored when it is enabled.
:::

**Previous** succeeds only when immich-kiosk has an earlier asset in its history; immediately after the first slide there may be nothing to return to. **Play** and **Pause** inspect the current `polling-paused` state and apply only the needed transition instead of guessing a toggle state. The **Play/Pause** toggle remains available for backward compatibility with existing automations.

::: tip Immediately after updating to 0.1.86
An already-open frame page may still have the previous command bridge in memory. After updating the controller and integration, refresh the FreeKiosk page once or restart the app. You do not need to repeat this unless another release explicitly asks for it.
:::

## Audio: device mute vs. video mute

- **Device Mute Toggle**, **Volume Up/Down** — Android device audio, sent as key events through FreeKiosk. Use these for reliable frame-wide audio state.
- **Kiosk Video Mute** — a switch for immich-kiosk's own video mute state, plus a press button for quick toggles. The switch sends explicit mute/unmute commands through the controller bridge and uses immich-kiosk's browser video API when available; it does not change Android device volume.

## Known FreeKiosk limitations

FreeKiosk 1.2.16 reports auto-brightness state in `/api/status` but does not expose the documented `/api/autoBrightness/enable` / `/api/autoBrightness/disable` endpoints. Use **Display Brightness** for manual control; FreeKiosk disables auto-brightness when needed via `/api/brightness`.
