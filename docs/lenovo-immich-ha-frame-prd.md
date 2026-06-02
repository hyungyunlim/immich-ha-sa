# Lenovo Immich HA Frame Controller PRD

## 1. Summary

Build a local frame-control service for an old Lenovo Smart Frame running Fully Kiosk Browser. The frame must keep a single fixed URL, while Home Assistant controls which Immich album/profile is shown in near real time.

The first implementation should keep the existing `immich-kiosk` container as the visual renderer because its current slideshow, clock, weather, layout, image-fit, transition, and metadata rendering are already good. This project should add a controller layer in front of `immich-kiosk` rather than forking it immediately.

## 2. Context

Current environment:

- Immich runs on the Raspberry Pi at port `2283`.
- `immich-kiosk` runs on the Raspberry Pi at port `3000`.
- `immich-kiosk` currently uses `/root/immich-kiosk/config/config.yaml` and environment variables.
- The local project at `/Users/hyungyunlim/Documents/immich-ha-sa` is currently an empty Git repo.
- Social Archiver lives at `/Users/hyungyunlim/obsidian-social-archiver` and already contains Immich upload/album logic.
- Home Assistant is running locally and should become the user-facing control surface for frame behavior.

Important architectural decision:

- Do not fork `immich-kiosk` for MVP.
- Keep `immich-kiosk` as a renderer.
- Build a small local controller service that maps HA state to an `immich-kiosk` URL.
- Fork or patch `immich-kiosk` only if URL overrides, iframe embedding, refresh behavior, or old-browser compatibility are insufficient.

## 3. Goals

1. Let Home Assistant list and select Immich albums.
2. Keep only one static URL configured on the Lenovo Smart Frame.
3. Allow HA changes to update the frame without touching the frame settings.
4. Preserve existing `immich-kiosk` rendering quality.
5. Support time-based HA automations that switch albums or display profiles.
6. Leave Social Archiver loosely coupled as an optional source that can populate Immich albums.
7. Support both local LAN frames and remote frames reached through a public domain such as Cloudflare Tunnel.

## 3.1 MVP Quality Bar

The MVP should be small, but not disposable. It should be treated as a production-quality local service with a narrow scope.

Required qualities:

- The frame must never be left on a blank page during normal controller, Immich, `immich-kiosk`, or network restarts.
- The Lenovo frame URL must remain stable after setup.
- HA state changes must be reflected by the frame predictably, with clear fallback behavior.
- State must be durable across controller restarts.
- Immich API keys must never be sent to the browser or HA frontend.
- Local frames should use LAN URLs for lower latency when possible.
- Remote frames should use the configured public domain and must not depend on private LAN hostnames.
- The controller must expose enough health and diagnostics to debug failures from HA or logs.
- Browser compatibility must be verified on the real Lenovo/Fully Kiosk environment before considering MVP complete.
- MVP code should have tests for state transitions, renderer URL generation, network-mode selection, and HA-facing API contracts.

Quality tradeoff:

- MVP may reload the `immich-kiosk` iframe on album/profile changes instead of doing seamless transitions.
- MVP may use polling fallback instead of perfect real-time updates on old browsers.
- MVP may store profiles locally instead of building a full HA config UI.
- MVP may support one frame device first, but the data model should not prevent adding more devices later.

## 4. Non-Goals

- Do not replace Immich.
- Do not rewrite `immich-kiosk` rendering in the MVP.
- Do not build a cloud service.
- Do not require the Lenovo frame to expose an API.
- Do not require the frame URL to change after initial setup.
- Do not couple Social Archiver directly into the frame runtime path.

## 5. Users and Use Cases

Primary user:

- Home operator who wants a reliable digital photo frame controlled from Home Assistant.

Use cases:

- Select "Family" album from HA and see the frame update.
- Schedule "Morning" profile from 07:00 to 10:00.
- Schedule "Travel" or "Instagram Archive" album in the evening.
- Switch image fit, duration, or display metadata from HA.
- Keep the old Lenovo frame simple: open one URL forever.
- Run the frame on the home LAN using local URLs for fast loading.
- Move or gift the frame outside the home network and keep it working through a Cloudflare Tunnel domain.

## 6. Proposed Architecture

```text
Home Assistant HACS integration
        |
        | REST API
        v
Frame Controller on RPi
        |
        | Generates active renderer URL
        v
Lenovo frame fixed URL: /frame/lenovo
        |
        | iframe or controlled redirect
        v
immich-kiosk on RPi:3000
        |
        | Immich API
        v
Immich on RPi:2283
```

The frame should load:

```text
http://<rpi-host>:<controller-port>/frame/lenovo
```

The controller page should internally load a generated `immich-kiosk` URL, for example:

```text
http://<rpi-host>:3000/?album=<album-id>&duration=60&show_time=false&image_fit=contain
```

Exact query parameter names must be verified against the installed `immich-kiosk` version before implementation.

## 6.1 Architecture Principles

1. Keep rendering and control separate.
   - `immich-kiosk` owns visual presentation.
   - Frame Controller owns state, HA API, URL generation, network-mode selection, and browser update orchestration.

2. Keep the frame dumb.
   - The Lenovo frame should only load one controller URL.
   - The frame page should contain minimal JS and no secrets.

3. Make HA declarative.
   - HA should set desired state, not micromanage browser actions.
   - Controller should translate desired state into the active renderer URL.

4. Prefer observable fallback over hidden cleverness.
   - If SSE fails, polling should take over.
   - If Immich album refresh fails, cached albums should remain visible and HA should show stale/unavailable diagnostics.

5. Avoid unnecessary forks.
   - Keep `immich-kiosk` upstream-compatible unless a verified blocker requires a fork.
   - Any future fork must be isolated behind the same controller interface so the HA integration does not change.

6. Separate private service URLs from browser-facing URLs.
   - The controller may talk to Immich and `immich-kiosk` through internal Docker or LAN URLs.
   - The frame browser must receive URLs that are reachable from its current network location.
   - Local and external public base URLs must be configured separately.

## 6.2 Critical Design Decisions

### Keep `immich-kiosk` as Renderer

Decision:

- MVP uses the existing `immich-kiosk` container as the renderer.

Rationale:

- It already provides high-quality slideshow rendering, clock/weather options, image fit, background blur, sleep settings, metadata display, caching, and prefetching.
- Rebuilding those features would expand MVP scope and increase compatibility risk.

Validation required:

- Confirm album selection can be controlled by URL query or another non-invasive runtime mechanism.
- Confirm iframe embedding works on the Lenovo frame.
- Confirm iframe reload is acceptable visually.

### Controller Owns Desired State

Decision:

- The controller stores the active frame state and profile definitions.

Rationale:

- HA automations should remain simple.
- Frame recovery after restart needs a durable source of truth.
- The browser should not be responsible for deriving state.

### HA Uses Controller API, Not Immich Directly

Decision:

- The HA integration talks only to Frame Controller.

Rationale:

- Avoid duplicate Immich API handling in HA.
- Keep credentials and query parameter mapping in one place.
- Allow the controller to cache albums and hide renderer quirks from HA.

### Local and Remote Frame Modes

Decision:

- Each frame has a configured network mode: `auto`, `local`, or `external`.
- `local` mode generates renderer/controller URLs using LAN addresses.
- `external` mode generates renderer/controller URLs using the public tunnel domain.
- `auto` mode may infer mode from request host or configured device preference, but must be deterministic and observable.

Rationale:

- A frame on the LAN should not route image traffic through Cloudflare if local URLs are available.
- A remote frame cannot use private hostnames like `rpi`, `192.168.x.x`, or Docker service names.
- The same controller API should support both deployment modes.

## 7. Components

### 7.1 Frame Controller Service

Responsibilities:

- Store frame device configuration.
- Store active display state per frame.
- Query Immich for album metadata.
- Generate the current `immich-kiosk` URL.
- Serve the fixed frame page.
- Notify connected frame pages when active state changes.
- Provide an API for the HA integration.
- Validate incoming state before applying it.
- Keep the last known good renderer URL.
- Choose local or external browser-facing URLs based on frame network mode.
- Return explicit error codes for HA integration handling.

Suggested tech:

- Node.js + TypeScript, or Python + FastAPI.
- SQLite or JSON file storage for MVP.
- Docker deployable on Raspberry Pi.

Recommended MVP stack:

- Node.js + TypeScript + Fastify.
- SQLite via `better-sqlite3` or a simple JSON store for early MVP.
- Server-Sent Events with polling fallback.

Production-quality MVP requirements:

- Typed configuration with startup validation.
- Structured logs.
- Graceful shutdown.
- Health endpoint with dependency status.
- Unit tests for URL generation, network-mode selection, and state validation.
- Integration tests for core HTTP endpoints.
- Data file mounted on persistent storage in Docker.

### 7.2 Fixed Frame Page

Route:

```text
GET /frame/:deviceId
```

Responsibilities:

- Render a fullscreen page suitable for Fully Kiosk Browser.
- Load the current `immich-kiosk` URL in an iframe.
- Subscribe to controller state updates.
- Reload or replace iframe when album/profile changes.
- Fall back to periodic polling if SSE fails.
- Avoid visible controls on the frame.
- Show a minimal non-disruptive fallback screen only when no renderer URL has ever been available.
- Keep the last working iframe visible while trying to apply a new state.

Compatibility requirements:

- Must work on the Lenovo Smart Frame's old browser.
- Avoid heavy JS dependencies.
- Avoid modern-only browser APIs unless fallback exists.
- Use plain HTML/CSS/JS for the frame page if possible.
- Do not rely on module scripts, build-time hydration, or framework runtime on the frame page.
- Avoid layout that can expose scrollbars or browser chrome.

Frame page quality requirements:

- Full viewport, black background, no visible margins.
- Iframe must fill the screen.
- If update fails, keep the current image/slideshow visible.
- Polling interval should be configurable.
- State version should prevent duplicate reloads.
- Remote frame pages must not receive LAN-only renderer URLs.

### 7.3 Controller API

Initial endpoints:

```text
GET  /api/health
GET  /api/frames
GET  /api/frames/:deviceId
PUT  /api/frames/:deviceId/state
GET  /api/frames/:deviceId/events
GET  /api/immich/albums
POST /api/immich/albums/refresh
GET  /api/profiles
PUT  /api/profiles/:profileId
POST /api/frames/:deviceId/apply-profile
```

MVP can start smaller:

```text
GET /api/immich/albums
GET /api/frame/lenovo/state
PUT /api/frame/lenovo/state
GET /api/frame/lenovo/events
GET /frame/lenovo
```

API quality requirements:

- All mutating endpoints validate payloads.
- All responses use a consistent envelope.
- Errors include machine-readable codes for HA.
- State responses include `version`, `updatedAt`, `networkMode`, and `rendererUrl`.
- Album list responses include a cache timestamp and refresh status.
- API must be stable enough that HA integration does not need to know renderer query details.

Example response envelope:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "version": 12,
    "updatedAt": "2026-06-02T00:00:00.000Z"
  }
}
```

Example error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ALBUM_NOT_FOUND",
    "message": "Album does not exist in the current Immich album cache."
  }
}
```

### 7.4 Home Assistant HACS Integration

Responsibilities:

- Install from a GitHub repository through HACS custom repositories.
- Provide a Home Assistant config flow for GUI setup.
- Support a pairing flow so users can enter a short setup code instead of manually copying controller API tokens from the server.
- Show a setup-page shortcut inside the pairing step after the user enters the controller URL.
- Discover/connect to Frame Controller.
- Expose album list as HA select entity.
- Expose frame profile as HA select entity.
- Expose key renderer options as HA entities.
- Provide services for automations.

Initial entities:

- `select.lenovo_frame_album`
- `select.lenovo_frame_profile`
- `number.lenovo_frame_duration`
- `select.lenovo_frame_image_fit`
- `button.lenovo_frame_next` if feasible
- `button.lenovo_frame_refresh_albums`
- `sensor.lenovo_frame_current_album`
- `sensor.lenovo_frame_current_renderer_url`

Initial services:

```yaml
immich_frame.set_album
immich_frame.set_profile
immich_frame.refresh_albums
immich_frame.set_renderer_options
immich_frame.set_network_mode
```

Example automation:

```yaml
alias: Lenovo frame morning album
trigger:
  - platform: time
    at: "07:00:00"
action:
  - service: immich_frame.set_profile
    data:
      device_id: lenovo
      profile_id: morning
```

HA quality requirements:

- The integration should not require editing the Lenovo frame URL after setup.
- Entities should restore sensible state after HA restart.
- Album select options should update after `refresh_albums`.
- If controller is unavailable, entities should become unavailable rather than stale-but-clickable.
- Service calls should return clear errors when the controller rejects state.
- Time-based automations should call high-level services like `set_profile`, not construct renderer URLs.
- Network mode should be visible and configurable for each frame where useful.

### 7.5 Social Archiver Integration

Social Archiver is not in the critical display path.

Recommended role:

- Social Archiver uploads archived Instagram/social photos to Immich.
- The uploaded content lands in one or more Immich albums.
- The frame controller sees those albums like any other Immich album.

Future optional enhancement:

- Add a local sync job that maps specific Social Archiver archive folders into Immich albums.
- Add a profile like `instagram_archive_evening`.

## 8. State Model

Frame state:

```json
{
  "deviceId": "lenovo",
  "activeAlbumIds": ["album-id-1"],
  "activeProfileId": "family",
  "durationSeconds": 60,
  "imageFit": "contain",
  "showTime": false,
  "showDate": false,
  "showWeather": true,
  "albumOrder": "random",
  "networkMode": "auto",
  "resolvedNetworkMode": "local",
  "rendererUrl": "http://rpi:3000/?albums=album-id-1&duration=60",
  "version": 12,
  "updatedAt": "2026-06-02T00:00:00.000Z"
}
```

State transition rules:

- Every accepted state mutation increments `version`.
- Invalid album IDs are rejected unless `allowUnknownAlbumIds` is explicitly enabled for testing.
- Applying a profile expands to a concrete frame state.
- The previous good renderer URL is retained until a new state validates successfully.
- The controller should persist state before notifying frame clients.
- Frame clients should reload only when `rendererUrl` or relevant renderer options change.
- Changes to network mode must regenerate browser-facing URLs without changing album/profile state.

Profile model:

```json
{
  "id": "morning",
  "name": "Morning",
  "albumIds": ["album-family"],
  "durationSeconds": 45,
  "imageFit": "contain",
  "showTime": false,
  "showWeather": true,
  "albumOrder": "random",
  "preferredNetworkMode": "auto"
}
```

Frame device model:

```json
{
  "id": "lenovo",
  "name": "Lenovo Smart Frame",
  "networkMode": "auto",
  "localControllerBaseUrl": "http://<rpi-lan-ip>:<controller-host-port>",
  "externalControllerBaseUrl": "https://frame.example.com",
  "localKioskBaseUrl": "http://<rpi-lan-ip>:3000",
  "externalKioskBaseUrl": "https://kiosk.example.com",
  "pollIntervalSeconds": 20
}
```

Album cache:

```json
{
  "id": "album-id",
  "albumName": "Family",
  "assetCount": 1234,
  "thumbnailAssetId": "asset-id",
  "updatedAt": "2026-06-02T00:00:00.000Z"
}
```

## 9. Immich Integration

The controller needs an Immich API key with read access to albums and assets.

Initial API needs:

- Verify connection with `/api/users/me`.
- List albums with `/api/albums`.
- Optionally read album details/assets if needed for validation or preview.

Security:

- Never expose Immich API key to the frame page.
- Never include API key in generated renderer URLs.
- Store API key in local env or controller config.
- Keep controller accessible only on trusted LAN unless authentication is added.

Album cache behavior:

- Refresh albums on startup.
- Allow manual refresh from HA.
- Cache successful album results with timestamp.
- If refresh fails, keep previous cache and mark it stale.
- HA should show stale status where feasible.
- Controller should reject state changes to unknown albums when cache exists.

Immich failure behavior:

- Existing frame state should continue using the last good renderer URL.
- Album refresh should fail without disrupting active display.
- Health endpoint should report Immich connectivity separately from controller liveness.

## 9.1 Local and External Network Routing

The system must support two placement modes:

- Local frame: the frame is on the same LAN as the Raspberry Pi.
- Remote frame: the frame is outside the LAN and reaches the service through a domain, likely via Cloudflare Tunnel.

Configuration should distinguish four URLs:

```text
IMMICH_INTERNAL_URL          # controller -> Immich, private/internal
KIOSK_INTERNAL_URL           # controller -> immich-kiosk, private/internal when proxying/checking
LOCAL_PUBLIC_CONTROLLER_URL  # frame browser -> controller on LAN
LOCAL_PUBLIC_KIOSK_URL       # frame browser -> immich-kiosk on LAN
EXTERNAL_PUBLIC_CONTROLLER_URL
EXTERNAL_PUBLIC_KIOSK_URL
```

MVP may simplify this to:

```text
CONTROLLER_PUBLIC_LOCAL_URL
CONTROLLER_PUBLIC_EXTERNAL_URL
KIOSK_PUBLIC_LOCAL_URL
KIOSK_PUBLIC_EXTERNAL_URL
```

Routing rules:

- If `networkMode` is `local`, generated frame and renderer URLs use local public URLs.
- If `networkMode` is `external`, generated frame and renderer URLs use external public URLs.
- If `networkMode` is `auto`, the controller resolves mode from request host or device config and exposes `resolvedNetworkMode` in state.
- Docker service names may be used only for server-to-server calls, never in browser-facing URLs.

Recommended external topology:

```text
https://frame.example.com/frame/lenovo      -> controller /frame/lenovo
https://frame.example.com/kiosk/...         -> reverse proxy to immich-kiosk
https://frame.example.com/api/...           -> controller API, protected where needed
```

This single-domain topology is preferred for remote frames because it avoids mixed host/CORS/iframe issues and keeps the Lenovo frame configured with one durable public URL. The controller can still use local URLs when the frame is on the LAN.

Cloudflare Tunnel requirements:

- Public frame route must not expose Immich API keys.
- Public API mutation routes should require a paired controller token or a configured static fallback token.
- Pairing code display should be available from the LAN setup URL and blocked from the configured external controller host.
- Frame read routes may use a per-device secret path or token if the domain is public.
- Cache headers should not cache state/event responses incorrectly.
- WebSocket/SSE support through the tunnel must be tested; polling fallback is required.

## 10. Renderer Strategy

MVP strategy:

- Use `immich-kiosk` as-is.
- Generate renderer URLs based on current state.
- Embed renderer URL in a fullscreen iframe from `/frame/lenovo`.
- On state change, update iframe `src`.

Renderer URL generation requirements:

- Renderer base URL must be configured separately for local and external reachability.
- Internal Immich URL must not leak into browser-facing renderer URL unless it is actually reachable by the frame.
- Query generation must be covered by tests.
- Unsupported or unverified query options must not be exposed in HA until validated.
- If using a single public controller domain, the renderer URL may be a controller proxy path like `/kiosk?...` rather than the raw `immich-kiosk` origin.

Fallback strategy:

- If iframe is blocked or unreliable, use controlled full-page redirect.
- If redirect is used, include a small loader page that returns to controller state on a timer.

Fork strategy:

- Fork `immich-kiosk` only if all are true:
  - URL query overrides cannot cover required album/profile behavior.
  - Runtime reload behavior is too disruptive or unstable.
  - Required UI elements cannot be controlled via existing config.
  - The maintenance cost and AGPL obligations are acceptable.

## 11. Real-Time Update Behavior

Preferred:

- Frame page opens SSE connection to `/api/frame/lenovo/events`.
- Controller emits event when frame state version changes.
- Frame page updates iframe URL when version changes.

Fallback:

- Frame page polls `/api/frame/lenovo/state` every 10-30 seconds.
- If state version changes, update iframe URL.

Expected user experience:

- HA album/profile change should appear on frame within 1-5 seconds with SSE.
- Polling fallback should update within 30 seconds.

Update safety:

- The frame page should compare state versions before changing iframe `src`.
- Controller should send a heartbeat event so the browser can detect stale SSE.
- If SSE disconnects, the frame page should reconnect and continue polling until reconnected.
- HA state mutation should not wait for the physical frame to acknowledge display, because the Lenovo frame may not provide reliable browser telemetry.
- Remote frames must work with polling even if Cloudflare Tunnel or the old browser breaks SSE.

## 12. Reliability Requirements

- Controller should survive RPi restart.
- Frame should recover if controller restarts.
- Frame should recover if `immich-kiosk` restarts.
- HA should show unavailable state if controller cannot be reached.
- Album cache should remain usable if Immich is temporarily unavailable.
- Invalid album IDs should surface as HA errors and logs, not blank frame loops.
- Remote frame mode should not break local frame mode.
- Local mode should not route through Cloudflare when local public URLs are available.

Operational diagnostics:

- `GET /api/health` should include controller status, Immich status, `immich-kiosk` status, album cache status, active frame state version, and configured public URL modes.
- Logs should include state changes, rejected state changes, Immich refresh failures, network-mode resolution, and renderer URL generation errors.
- The frame page should expose a lightweight debug query mode for local troubleshooting, not visible during normal display.

Backup and recovery:

- State/profile storage should be a single persistent data directory.
- Recreating the controller container should not lose frame profiles.
- A bad profile should be removable/editable without touching the Lenovo frame.

## 12.1 Test and Verification Plan

Automated tests:

- Unit test renderer URL generation.
- Unit test local/external network-mode URL selection.
- Unit test profile-to-state expansion.
- Unit test state validation and version increment behavior.
- Unit test album cache stale behavior.
- HTTP integration test for health, album list, get state, update state, and events endpoint startup.
- HA integration tests where practical using mocked controller responses.

Manual verification:

- Verify `immich-kiosk` album override behavior using real album IDs.
- Verify iframe rendering on desktop browser.
- Verify iframe rendering on Lenovo Smart Frame/Fully Kiosk.
- Verify SSE update on desktop browser.
- Verify polling fallback by disabling SSE or simulating disconnect.
- Verify HA album select updates the frame.
- Verify HA time automation applies a profile.
- Restart controller and confirm frame recovers.
- Restart `immich-kiosk` and confirm frame recovers.
- Stop Immich and confirm active display is not blanked.
- Verify local frame mode uses LAN URL.
- Verify external frame mode works through Cloudflare Tunnel domain.
- Verify external frame mode does not leak private hostnames in browser-visible URLs.

MVP cannot be considered complete until the Lenovo/Fully Kiosk manual checks pass.

## 13. Deployment

Target:

- Raspberry Pi Docker Compose.

Likely services:

```yaml
services:
  immich-frame-controller:
    image: local/immich-frame-controller:latest
    ports:
      - "${CONTROLLER_HOST_PORT:-8082}:${PORT:-8080}"
    environment:
      PORT: "${PORT:-8080}"
      IMMICH_INTERNAL_URL: "http://immich_server:2283"
      IMMICH_API_KEY: "${IMMICH_API_KEY}"
      KIOSK_INTERNAL_URL: "http://immich-kiosk:3000"
      LOCAL_PUBLIC_CONTROLLER_URL: "http://<rpi-lan-ip>:<controller-host-port>"
      LOCAL_PUBLIC_KIOSK_URL: "http://<rpi-lan-ip>:3000"
      EXTERNAL_PUBLIC_CONTROLLER_URL: "https://frame.example.com"
      EXTERNAL_PUBLIC_KIOSK_URL: "https://frame.example.com/kiosk"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

Networking note:

- If the controller runs in Docker, it can talk to Immich via Docker network name.
- The host-facing controller port must be configurable because `8082` may already be in use.
- The generated renderer URL must be reachable from the Lenovo frame, so it should use the LAN host/IP, not an internal Docker hostname.
- For remote frames, generated URLs should use the public Cloudflare Tunnel domain.
- A single-domain external setup should proxy `/kiosk` to `immich-kiosk` so the public frame page and renderer are same-origin where possible.

Deployment quality requirements:

- Provide `.env.example`.
- Provide Docker Compose example.
- Provide Cloudflare Tunnel example config.
- Provide a README with setup, HACS installation, frame URL instructions, and local/external mode guidance.
- Do not log API keys.
- Use `restart: unless-stopped` or equivalent.
- Include a simple upgrade path that preserves `/data`.

## 14. MVP Milestones

### Milestone 1: Controller Skeleton

- Create project structure.
- Add config loading.
- Add health endpoint.
- Add static frame page route.
- Add structured logging.
- Add persistent data directory.

Acceptance:

- `GET /api/health` returns OK.
- `GET /frame/lenovo` renders fullscreen shell.
- Restarting the controller preserves initial state.

### Milestone 2: Immich Album Listing

- Add Immich API client.
- Verify API key.
- List albums.
- Cache albums.
- Represent stale cache status.

Acceptance:

- `GET /api/immich/albums` returns album id, name, count.
- Immich outage does not clear the previous album cache.

### Milestone 3: Kiosk URL Generation

- Add frame state storage.
- Generate `immich-kiosk` URL from album and renderer options.
- Load it in the fixed frame page.
- Add tests for generated URLs.
- Support local and external renderer base URLs.

Acceptance:

- Updating state changes generated renderer URL.
- Frame displays selected Immich album through `immich-kiosk`.
- Invalid album update is rejected before the frame changes.
- Local mode emits LAN-reachable URLs.
- External mode emits domain-based URLs.

### Milestone 4: Real-Time Frame Updates

- Add SSE endpoint.
- Add polling fallback.
- Update iframe on state version change.
- Keep last visible renderer during failed update.

Acceptance:

- PUT state update changes frame without changing Lenovo settings.
- Controller restart does not require Lenovo URL changes.
- Polling fallback updates the frame when SSE is unavailable.

### Milestone 5: Home Assistant Integration

- Add HACS-compatible custom integration structure.
- Add config flow and YAML import compatibility.
- Add select entities for album/profile.
- Add services for automations.
- Add unavailable/stale states.
- Add network mode control where feasible.

Acceptance:

- HA can select an album and frame updates.
- HA automation can apply a profile by time.
- Controller errors surface clearly in HA logs/UI.

### Milestone 6: Hardening

- Add Docker Compose.
- Add logs.
- Add error UI/fallback for frame page.
- Add basic tests for URL generation and API responses.
- Verify on the real Lenovo/Fully Kiosk browser.
- Verify remote mode through Cloudflare Tunnel.
- Document rollback and recovery.

Acceptance:

- Controller restarts cleanly.
- HA recovers after controller restart.
- Frame recovers after network/controller interruption.
- MVP quality bar in Section 3.1 is satisfied.

## 15. Open Questions

1. What exact URL query parameters does the currently installed `immich-kiosk` version support for album override?
2. Does the Lenovo Smart Frame browser allow iframe embedding of `immich-kiosk` reliably?
3. Is Fully Kiosk on the Lenovo frame able to keep SSE connections stable?
4. What host/IP should be canonical for the frame URL on the LAN?
5. Should controller access support token revocation and re-pairing from the HA UI?
6. Should profiles live only in the controller, or be represented as HA helpers too?
7. Should external mode expose `immich-kiosk` as a separate tunnel hostname or proxy it under the controller domain?
8. What authentication model should protect public mutation APIs when using Cloudflare Tunnel?
9. Can the remote Lenovo/Fully Kiosk browser maintain SSE through Cloudflare, or should remote mode default to polling?

## 16. Risks

- `immich-kiosk` query override support may not match current assumptions.
- The old Lenovo browser may have iframe or SSE limitations.
- Generated renderer URLs must be reachable by the frame, not just by Docker containers.
- If `immich-kiosk` requires full page reload for album changes, transitions may be less smooth.
- Forking `immich-kiosk` introduces AGPL and maintenance obligations.
- Cloudflare Tunnel may interrupt or buffer SSE; polling fallback is mandatory.
- A public frame URL can expose the existence of the frame service if not protected.
- External mode may add latency compared with LAN mode.
- Mixed local/external URL generation bugs could cause blank frames if not tested.

## 17. Success Criteria

MVP is successful when:

- Lenovo frame keeps one fixed URL.
- HA can list Immich albums.
- HA can change the active album/profile.
- The frame updates without manual intervention.
- Existing `immich-kiosk` rendering remains intact.
- Time-based HA automation can drive different albums at different times.
- Local frames use LAN URLs.
- Remote frames can use a domain-based URL through Cloudflare Tunnel.
- API keys and private hostnames are not leaked to external frame pages.
