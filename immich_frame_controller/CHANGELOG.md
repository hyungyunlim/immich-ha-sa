# Changelog

## 0.1.81

- Add stateful Home Assistant control for immich-kiosk video mute using the browser video API exposed by current immich-kiosk releases. The existing mute button remains available as a quick toggle, while the new switch can explicitly turn kiosk video mute on or off.

## 0.1.80

- Show whether the real-time telemetry push is active: the setup console MQTT Bridge section now reports a "Real-time push" pill plus a per-frame `push` badge, and `/api/mqtt/status` exposes `telemetrySubscribers` counts. This lets you confirm at a glance that the Home Assistant integration is consuming the live stream rather than falling back to polling.

## 0.1.79

- Push FreeKiosk telemetry to Home Assistant in real time over a new controller SSE stream (`/api/frames/<id>/telemetry/events`): motion, screen state, and online/offline now reach Home Assistant in about a second instead of waiting for the 30-second poll, making camera-based presence automations practical. The integration keeps polling as a fallback and reconnects automatically; older controllers without the stream degrade gracefully to polling.

## 0.1.78

- Fix device management (add/edit/delete, MQTT bind/unbind) failing from the Home Assistant ingress panel: the console now builds API request URLs from the `X-Ingress-Path` header the Supervisor provides, so they route back to the add-on instead of resolving against the panel URL and never arriving. Direct LAN access is unchanged.

## 0.1.77

- Prefer the FreeKiosk REST API for hardware commands (screen, brightness, volume) whenever the controller can reach the device; MQTT now carries commands only for broker-only remote frames or as a safe retry. REST confirms real execution and keeps local frames working even when a FreeKiosk release regresses an MQTT command (e.g. screen power). Telemetry, presence, and motion still come over MQTT.
- Reject binding the same MQTT topic to more than one frame (409 `MQTT_TOPIC_BOUND`) so two frames can no longer mirror one device's telemetry and fight over commands.
- Send `Cache-Control: no-store` on the setup console and frame-claim pages so the Home Assistant ingress iframe always reflects live state after bind/unbind/save instead of serving a cached copy.

## 0.1.76

- Add an optional FreeKiosk MQTT bridge: the controller subscribes to `freekiosk/<topic>/availability` and `/state` on a user-provided broker for push telemetry and device online/offline tracking, and publishes `set/*` hardware commands (screen, brightness, volume, reload) with REST fallback in both directions.
- Auto-detect the Mosquitto add-on broker through the Supervisor MQTT service (`mqtt_broker_url` stays blank), with manual `mqtt_*` add-on options and `MQTT_*` env vars for standalone Docker.
- Add an MQTT Bridge section to the setup console that lists FreeKiosk devices seen on the broker and binds them to frames in one click (IP-based suggestions included); MQTT state also keeps the REST auto-discovery IP fresh after DHCP changes.
- Add Home Assistant entities for frame device online/offline (connectivity), camera motion, battery level, battery charging, and WiFi signal, sourced from FreeKiosk telemetry over MQTT or REST.
- Serve `remote/status` from the MQTT cache when the FreeKiosk REST API is unreachable, and shorten REST timeouts while MQTT reports the device offline.

## 0.1.75

- Add Home Assistant weather detail override selects for immich-kiosk weather forecast, humidity, wind, wind direction, visibility, temperature range, and rounded temperature URL queries.
- Preserve existing immich-kiosk `config.yaml` weather location behavior with an explicit `Use Kiosk Config` inherit state for each weather detail override.

## 0.1.74

- Add a Home Assistant Album Order select for immich-kiosk `album_order` values.
- Add Home Assistant profile save and delete controls and services.

## 0.1.73

- Hide the immich-kiosk text metadata icon for image descriptions while preserving date and location metadata icons.

## 0.1.72

- Add a configurable image description scroll speed and calculate long-description animation duration from measured overflow distance.
- Treat image description scroll duration as the maximum cycle duration for very long descriptions.

## 0.1.71

- Add a configurable image description start delay and extra top padding for the slide-up description area.

## 0.1.70

- Stabilize image description slide-up rendering by avoiding visible re-measure toggles, clipping long text before the helper runs, and scrolling only the overflow distance instead of moving the whole caption off-screen.

## 0.1.69

- Scroll image descriptions only when the text exceeds the configured visible area and long-text threshold.
- Make the image description scroll duration, visible area height, overlay opacity, and long-text threshold configurable from the Home Assistant integration and `set_renderer_options`.
- Reduce the default description overlay opacity and keep long descriptions clipped inside their own metadata row so date and location metadata remain separate.

## 0.1.68

- Add a controller-side immich-kiosk description overlay treatment that widens image descriptions and scrolls long text upward inside the lower overlay.

## 0.1.51

- Add mute and volume support to the Home Assistant Slideshow media player entity.

## 0.1.50

- Add a Home Assistant Slideshow media player entity that groups previous, play/pause, and next controls for each frame.

## 0.1.49

- Add a Home Assistant Display light entity for FreeKiosk frames, combining screen on/off and display brightness control.

## 0.1.48

- Add a Home Assistant Current People sensor that mirrors the active Immich person filter and exposes the selected person IDs as attributes.

## 0.1.47

- Add Home Assistant FreeKiosk screen and device-mute status binary sensors.
- Add Home Assistant Screen and Device Mute switches backed by FreeKiosk remote status and commands.
- Keep Media Volume as a stateful number entity while reporting device mute from `audio.muted` when available, falling back to `audio.volume == 0`.

## 0.1.46

- Stream proxied immich-kiosk video range responses instead of buffering each byte-range response in the controller.
- Preserve upstream `Content-Length` for binary and HEAD proxy responses to improve Android WebView media playback stability.

## 0.1.45

- Rename the Home Assistant Album select's no-album state from `All Photos` to `No Album Filter` so person-only filtering is explicit.
- Allow the Albums text entity to clear album selection with `none`, `no filter`, `no album filter`, or `all photos`.

## 0.1.44

- Keep unnamed Immich face groups out of the Home Assistant Person select while still allowing direct person IDs through the People text entity and services.

## 0.1.43

- Add Immich person cache refresh alongside albums, including controller health/setup status.
- Add Home Assistant person filtering with a single-person select, comma-separated People text entity, Refresh People button, and `immich_frame.set_people` / `immich_frame.refresh_people` services.
- Add `require_all_people` support through the renderer URL and a Home Assistant Require All People switch for multi-person filters.

## 0.1.42

- Add Home Assistant media content and orientation selects that map to immich-kiosk `show_videos` and `layout` URL overrides.
- Add a Max Video Length number entity backed by the immich-kiosk `exclude_videos_over` URL override.

## 0.1.41

- Add a dedicated Home Assistant D-pad Up button backed by the FreeKiosk `/api/remote/up` REST endpoint, separate from the diagnostic kiosk mute command.

## 0.1.40

- Add controller-version cache busting and no-store headers for proxied immich-kiosk CSS/JS so fixed-URL Android WebView frames pick up controller-side rendering patches after an add-on update.

## 0.1.39

- Add a proxied immich-kiosk CSS compatibility patch so legacy Android WebView devices keep the blurred background layer filling the whole frame when `image_fit=contain`.

## 0.1.38

- Add a Home Assistant Image Fit select so each frame can switch immich-kiosk between `contain`, `cover`, and `none` from the device UI.

## 0.1.37

- Show `All Photos` in the Home Assistant Album select when no album filter is active instead of leaving the entity as unknown.
- Show `Multiple Albums` in the Album select when the frame is controlled by the multi-album text entity or service.
- Clarify that physical frame pairing uses the controller `/pair` URL, while the add-on root URL opens the setup console.

## 0.1.36

- Show configured frame cards as a vertical list instead of auto-fitting them into horizontal columns.
- Keep the frame pairing code and instructions centered in portrait frame browsers.
- Show `Saved` after device setting updates and clear the message automatically instead of immediately reloading the console.

## 0.1.35

- Resolve add-on console API requests relative to the current page so device save/delete actions work under Home Assistant Ingress as well as direct controller URLs.
- Show the HTTP status when a console API request receives a non-JSON response instead of only showing a generic `Request failed` message.

## 0.1.34

- Replace preview orientation text toggles with visual frame-shape choices for landscape and portrait.
- Keep the same `previewOrientation` form values so existing device and claim flows continue to work unchanged.

## 0.1.33

- Add physical frame pairing from the controller root URL on external hosts and `/pair` on local hosts.
- Add short-code claim APIs and add-on console UI for creating a device from the code shown on the frame.
- Add stable `/f/:alias` frame paths with alias support on devices while keeping `/frame/:deviceId` compatibility.

## 0.1.32

- Clarify that External Frame URL is generated from External Controller URL, not External Kiosk Renderer URL.
- Add an inline copy action for mistaken renderer URLs so they can be moved into External Controller URL before saving.
- Move FreeKiosk remote-control documentation into a compact info tooltip to keep the device settings grid aligned.

## 0.1.31

- Add per-device preview orientation controls for landscape and portrait frame thumbnails.
- Make frame URL previews update immediately while editing local or external controller URLs.
- Collapse detailed frame diagnostics into a closed-by-default Frame Details section.
- Add FreeKiosk documentation and GitHub links near remote control settings.

## 0.1.30

- Simplify the add-on device creation form so only essential fields are visible by default.
- Move inherited URL, external URL, password override, and polling controls into an advanced section with explicit inherited defaults.
- Add lazy frame thumbnails to the device list using each frame's local controller URL.
- Automatically use FreeKiosk remote control when a Remote API URL is provided from the console form.

## 0.1.29

- Add an authenticated read-only integration device list endpoint.
- Update the Home Assistant config flow to choose a controller device from a dropdown after pairing.
- Keep manual device ID entry as a fallback when the controller device list cannot be loaded.

## 0.1.28

- Add a Home Assistant Show Archived switch that passes `show_archived` to immich-kiosk.
- Support archive-only Immich albums, such as direct-upload collections whose assets have `visibility=archive`.

## 0.1.27

- Add automatic Immich album cache refresh in the controller, configured by `album_refresh_interval_seconds`.
- Keep the Home Assistant Refresh Albums button and `immich_frame.refresh_albums` service as immediate manual refresh paths.
- Include the configured album refresh interval in controller health output.

## 0.1.26

- Add FreeKiosk REST proxy endpoints for remote device status, display brightness, and media volume.
- Add Home Assistant display brightness and media volume number entities backed by FreeKiosk's direct 0-100 APIs.
- Add a Home Assistant light level sensor and auto-brightness active diagnostic binary sensor from FreeKiosk status.
- Keep auto-brightness write control version-tolerant because FreeKiosk 1.2.16 reports auto-brightness state but does not expose the documented REST toggle endpoints.

## 0.1.25

- Fix binary kiosk proxy streaming so immich-kiosk static assets such as the loading spinner are delivered with their response body intact.
- Add regression coverage for non-range proxied binary assets.

## 0.1.24

- Fix proxied immich-kiosk slideshow polling by rewriting JavaScript `/asset/` route checks to the controller proxy path.
- Stream full binary kiosk proxy responses instead of buffering them behind the controller, while preserving buffered range responses for media seeking.

## 0.1.23

- Add Home Assistant controls for immich-kiosk clock, weather selection, font size, background blur amount, and image metadata URL overrides.
- Switch weather control to the current immich-kiosk `weather` query behavior while keeping `show_weather` for older kiosk compatibility.
- Document that weather detail fields such as humidity, wind, visibility, and temperature range are configured per immich-kiosk weather location.

## 0.1.22

- Add a Home Assistant Date Filter Preset select for common immich-kiosk date filters.
- Add Filter Start Date and Filter End Date picker entities that write custom `filter_date` ranges.

## 0.1.21

- Add Home Assistant controls for immich-kiosk `filter_date` and `filter_newest` renderer filters.
- Include date/newest filters in frame state, renderer URL generation, profiles, services, and the add-on console diagnostics.

## 0.1.20

- Add a one-time Home Assistant entity registry migration that disables existing legacy Kiosk Mute Toggle entities after the diagnostic demotion.

## 0.1.19

- Demote Kiosk Mute Toggle to a diagnostic, default-disabled Home Assistant entity because Android Device Mute Toggle is the reliable frame-wide audio control path.

## 0.1.18

- Add a Home Assistant Device Mute Toggle button that sends Android `KEYCODE_VOLUME_MUTE` through FreeKiosk.
- Keep Kiosk Mute Toggle separate from Android device audio mute because browser video unmute may be blocked without a real user gesture.

## 0.1.17

- Make Kiosk Mute Toggle click immich-kiosk's real `.navigation--mute` control before falling back to direct video mute state updates.
- Stop relying on the Up Arrow keyboard shortcut as the primary mute path.

## 0.1.16

- Show live frame event connection counts in the add-on console and health/device APIs.
- Fall back to the configured FreeKiosk REST remote endpoint when iframe event commands, including Kiosk Mute Toggle, have no connected frame browser.

## 0.1.15

- Add kiosk password diagnostics and optional per-device kiosk password overrides in the add-on console.
- Add a Home Assistant Kiosk Mute Toggle button and Up/Down Arrow Action selects for immich-kiosk.

## 0.1.14

- Show separate Local Frame URL and External Frame URL values in the add-on console.
- Clarify that remote frames should use a controller tunnel hostname, not the Immich server or direct immich-kiosk hostname.

## 0.1.13

- Preserve `Accept-Ranges` and `Content-Range` headers for proxied immich-kiosk video playback.

## 0.1.12

- Add Home Assistant volume up and volume down buttons for FreeKiosk frame devices.
- Route volume commands through FreeKiosk keyboard media key endpoints.
- Add a Show Videos switch that passes `show_videos` to immich-kiosk renderer URLs.

## 0.1.11

- Handle `text/javascript` kiosk assets with the JavaScript-safe proxy rewriter.
- Make frame commands try the proxied kiosk API and navigation controls before falling back to keyboard events.

## 0.1.10

- Fix kiosk proxy rewriting so JavaScript regular expressions are not modified.

## 0.1.9

- Proxy immich-kiosk through the controller origin for frame pages.
- Bridge Home Assistant next, previous, play/pause, and reload commands into the renderer iframe instead of relying on FreeKiosk key events.
- Keep FreeKiosk REST control for screen on and screen off.

## 0.1.5

- Add FreeKiosk REST remote-control support per frame device.
- Add Home Assistant buttons for next, previous, play/pause, reload, screen on, and screen off.
- Add remote-control settings to the add-on console device editor.

## 0.1.4

- Add local-console device management for multiple frame endpoints.
- Group Home Assistant entities under one Home Assistant device per frame device ID.
- Add a writable Albums text entity and album-name service fields for multi-album frame selection.

## 0.1.3

- Redesign the add-on Web UI into a denser operations console.
- Add Home Assistant controls and URL overrides for immich-kiosk transitions, layouts, image effects, frame UI, progress bar, and burn-in protection.
- Keep offline mode out of frame profiles because it requires persistent assets and has URL override limitations.

## 0.1.2

- Handle the Home Assistant ingress root path when it is forwarded as `//`.

## 0.1.1

- Fix add-on Web UI routing for `/`, `/setup`, and `//setup`.
- Expand the Web UI into an operational console with frame URLs, renderer diagnostics, and sleep override state.
- Add Home Assistant sleep controls for immich-kiosk URL overrides.

## 0.1.0

- Initial Home Assistant add-on packaging.
- Runs the existing Immich Frame Controller Docker image.
- Adds add-on configuration UI, Web UI link, Ingress entry, health watchdog, and default port mapping.
