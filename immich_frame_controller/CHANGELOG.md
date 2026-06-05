# Changelog

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
