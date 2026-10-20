# Troubleshooting

## A new Immich album does not appear in Home Assistant

Album options come from the controller cache. The integration reads the cache every 30 seconds and the controller refreshes it from Immich every `album_refresh_interval_seconds` (default 900). Press the **Refresh Albums** button (or call `immich_frame.refresh_albums`) to force an immediate refresh.

## Videos show a poster but do not play

- Turn on the frame's **Show Videos** switch (`show_videos=true`).
- immich-kiosk additionally requires server-side `kiosk.prefetch` / `KIOSK_PREFETCH` to be enabled for video playback; that setting cannot be overridden through the URL.
- The controller proxy preserves the HTTP range headers WebView needs for video. If videos still do not start, confirm the controller is running `0.1.13` or newer.

## "Error Retrieving asset" on an album

The selected album probably contains only archived assets. immich-kiosk excludes archived assets by default — turn on the frame's **Show Archived** switch (`show_archived=true`).

## Next / Previous buttons do nothing

Keep the frame's `disableNavigation` renderer option **off**. immich-kiosk's `disable_navigation` blocks touch, keyboard, and menu navigation, so bridged commands and physical key events are ignored while it is enabled.

Previous also needs an earlier asset in immich-kiosk's history. A failure is expected just after opening the frame or on the first slide. If a connected frame cannot apply a command, the controller no longer reports it as successful; check the Home Assistant error and controller log for the reason.

## The NAS is still active after turning off the screen

Update both the controller and Home Assistant integration to **0.1.86 or newer**. Starting with this version, Screen Off unmounts the entire immich-kiosk iframe before turning off the physical display, stopping image requests and slideshow timers. FreeKiosk's own Screen Off or sleep feature alone may leave WebView JavaScript running, so use this integration's **Screen** switch or **Screen Off** button in automations.

## Wrong or unwanted weather location

Weather API keys and locations live in immich-kiosk's `config.yaml`, not in the controller. Set the frame's **Weather Location** text entity to a configured location name, leave it empty for the kiosk default, or `rotate` to cycle through configured locations. Turning **Show Weather** off sends `weather=none` so immich-kiosk does not auto-select its default location. The weather detail selects (`Use Kiosk Config` / `Show` / `Hide`) inherit or override per frame.

## Remote frame reacts slowly to changes

Through a tunnel, SSE can be unreliable; the frame falls back to polling every `poll_interval_seconds` (default 20). This is expected — lower the interval if you need faster reaction.

## MQTT Bridge shows Disconnected

The controller could not reach the broker. On Home Assistant OS it auto-detects the Mosquitto add-on — install and start it. To use another broker, set `mqtt_broker_url` (add-on option) or `MQTT_BROKER_URL` (standalone Docker). The add-on log prints the broker it connected to; the **Last connection error** line in the [MQTT Bridge](./controller-setup#mqtt-bridge) section shows auth/connection failures.

## My FreeKiosk frame never appears in the MQTT Bridge

The frame is not publishing to the topic the controller watches. In the FreeKiosk app, **Advanced → MQTT**:

- **Base Topic** must be `freekiosk` (the controller subscribes to `freekiosk/+/...`). A custom base topic like `mykiosk` is invisible to the controller.
- **Broker URL** must be the broker's **LAN IP** (for example `192.168.1.10`), not `core-mosquitto` — that name only resolves inside Home Assistant.
- **Username / password**: with the Mosquitto add-on, create a Home Assistant user and use those credentials. Then press **Connect**.

Set a **Device Name** (for example `lobby`); it becomes the topic id you bind to.

## Bind / Unbind (or device add/edit) does nothing in the add-on panel

Update the add-on to **0.1.78 or newer**. Earlier versions built console API requests relative to the ingress panel URL, so they never reached the controller. After updating, the buttons work through the Home Assistant ingress panel.

## "Real-time push: idle" in the MQTT Bridge

The controller's telemetry stream has no subscriber — the integration is not consuming it. Update the **integration** (HACS) to match the add-on version and restart Home Assistant. The listener connects on startup; "active (N)" then shows the number of connected frames. Push is optional — without it the integration still polls every 30 seconds.

## Motion sensor is always off or unavailable

FreeKiosk motion uses the device camera. Camera-less frames (most digital photo frames) never report motion — disable the **Motion** entity. On a camera device, enable **Always-on Motion Detection** in the FreeKiosk MQTT settings (otherwise motion only runs during the screensaver).

## Battery / WiFi / screen state lags ~30 seconds

FreeKiosk publishes its routine telemetry on the **Status Interval** (default 30s). The controller pushes each update instantly, but the device's publish cadence is the floor. Lower the Status Interval in FreeKiosk for fresher diagnostics. Availability (online/offline) and motion are event-driven and not bound by this interval.

## Screen on/off works over REST but not when I expect MQTT

Some FreeKiosk releases regress MQTT screen commands. The controller prefers REST for hardware commands whenever it can reach the device and only uses MQTT for frames reachable solely through the broker, so a bound local frame keeps working over REST regardless. Nothing to configure.

## I changed the controller port and things broke

Update all three places together: `local_public_controller_url` (add-on option / env), the integration's controller URL, and the frame browser's fixed URL.

## Photos require a password / kiosk shows an auth error

If immich-kiosk uses `KIOSK_PASSWORD`, the controller needs the same value (`kiosk_password` add-on option or `KIOSK_PASSWORD` env). Per-device overrides are available in the [controller console](./controller-setup#device-management).

## HACS refuses to install the integration

The integration requires Home Assistant **2026.3.0** or newer. Update Home Assistant, then retry.

## Person + album selection gives unexpected results

immich-kiosk documents `require_all_people` as incompatible with other source buckets such as albums and date ranges. Use **Require All People** only with a person-only selection (set the Album select to `No Album Filter` first).

## The Frames panel or its Calendar tab is missing

Update the integration in HACS and restart Home Assistant; the panel loads at startup. Before 0.1.94 the panel was called **Frame Call**.

## Notices or the calendar do not show on a frame

- Tick the frame in the notice's target (or keep **All frames**) and in the **Calendar** tab.
- Frames load a new frame page only when they reload. After a controller update, press the frame's **Reload** button or reload FreeKiosk.
- Notices and events hide while the screen is off.

## The Calendar tab lists no calendars or no events

The tab lists Home Assistant calendar entities. Add the Google Calendar integration, or Remote Calendar with a calendar's iCal link. Events refresh every 15 minutes and whenever you save; an error under the form shows why the last refresh failed.

## A call does not connect or goes silent

- Open Home Assistant through its `https://` address; browsers block the microphone on `http://`.
- Turn on the frame's **Frame Mic Stream** switch, and use Frame Mic 0.6 or newer (0.7 or newer for calls from outside).
- From outside the home network, add a [Cloudflare TURN key](./speaker-mic#calls-from-outside).
- If sound fades with your phone next to the frame, the two echo cancellers are cancelling each other; test from another room, or mute yourself while listening.

## Frame Mic stopped after an app update

Android usually restarts the app after an update, but not always. Open **Frame Mic** once on the frame, or run `adb shell am start -n org.junlim.framemic/.MainActivity`.

## Still stuck?

Check the controller health endpoint and logs:

```text
http://<controller-host>:8082/api/health
```

Then open an issue on [GitHub](https://github.com/hyungyunlim/immich-ha-sa/issues) with the add-on log output.
