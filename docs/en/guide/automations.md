# Entities & Services

Each frame device gets a Home Assistant device page with entities for everything the controller can change, plus a set of `immich_frame.*` services for automations.

## Entity highlights

| Area | Entities |
| --- | --- |
| Source selection | **Album** select, **Albums** text (multi, comma-separated), **Person** select, **People** text, **Require All People** switch |
| Filters | **Date Filter Preset** select, **Filter Start Date** / **Filter End Date** date pickers, **Date Filter** text (raw values like `last-30-days`), **Newest Filter** number, **Album Order** select |
| Profiles | Profile selection and the profile services below |
| Display | Renderer option entities — clock, date, weather, font size, background blur, **Custom CSS Class**, image metadata (date/time, album, person, camera, EXIF, location, rating, owner, user), progress bar |
| Media | **Show Videos** switch, **Show Archived** switch, **Kiosk Video Mute** switch/button |
| Hardware ([FreeKiosk](./freekiosk)) | **Display Brightness**, **Media Volume** numbers; navigation, screen, and volume buttons |
| Telemetry ([FreeKiosk](./freekiosk)) | **Device Online** (connectivity), **Motion** (camera devices), **Screen On**, **Device Muted**, **Battery**, **Battery Charging**, **WiFi Signal**, **Light Level**, **Auto Brightness Active**, **X-Axis Dominant** |
| Maintenance | **Refresh Albums**, **Refresh People** buttons, **Network Mode** select |

Notes:

- The telemetry entities come from [FreeKiosk](./freekiosk#what-you-get-in-home-assistant), over MQTT or REST. With an [MQTT binding](./freekiosk#_3-optional-mqtt-push-control), **Device Online** and **Motion** update in about a second (real-time push); without it the integration polls every 30 seconds. **Motion** needs a device with a camera.
- When no album filter is active, the **Album** select shows `No Album Filter`. Choose it before selecting a person when you want person-only source selection.
- The **Albums** / **People** text entities accept names or IDs, comma-separated. `all` selects all named people; blank or `none` clears the filter.
- immich-kiosk documents `require_all_people` as incompatible with other source buckets (albums, date ranges) — avoid combining them when deterministic results matter.

## Services

All services accept an optional `device_id` (defaults to the configured device).

| Service | Key fields |
| --- | --- |
| `immich_frame.set_album` | `album_id`, `album_ids`, `album_name`, `album_names` |
| `immich_frame.set_people` | `person_id`, `person_ids`, `person_name`, `person_names` |
| `immich_frame.set_profile` | `profile_id` (required) |
| `immich_frame.save_profile` | `name`, `profile_id`, `overwrite` (default `true`) |
| `immich_frame.delete_profile` | `profile_id` |
| `immich_frame.refresh_albums` | — |
| `immich_frame.refresh_people` | — |
| `immich_frame.set_renderer_options` | See below |
| `immich_frame.set_network_mode` | `network_mode`: `auto` / `local` / `external` (required) |

### Saving profiles

A profile is a snapshot of the current frame state. To build one, first change the frame through the Home Assistant entities or services, then save the state as a profile.

The saved snapshot includes:

- Source filters: active albums, active people, date/newest filters, and `requireAllPeople`
- Slideshow and layout options: duration, transitions, layout, image fit, background blur, font size, image effects, and custom CSS class
- Display overlays: clock, date, weather, image metadata, progress bar, sleep, and burn-in options
- Media and network preferences: videos, archived media, video duration limit, and preferred network mode

It does not save hardware-only state such as the current device brightness, volume, screen power, battery, or motion status.

To create a new profile from the current settings, call `immich_frame.save_profile` with a name:

```yaml
service: immich_frame.save_profile
data:
  name: Morning
  profile_id: morning
  overwrite: true
```

`profile_id` is optional, but setting it explicitly makes automations stable. If you omit it, the integration derives an ID from `name`.

You can also use the device page:

1. Change the frame settings with the entities on the device page.
2. Set **Profile Name** to the new profile name.
3. Optionally set **Profile ID** to the ID you want automations to use.
4. Press **Save Profile**.

The **Save Profile** button cannot ask for a name at press time. If **Profile Name** is blank and no existing active profile name can be reused, Home Assistant shows `Profile name is required`.

To update an existing profile, load it first, change the settings, then save it again with the same `profile_id`:

```yaml
service: immich_frame.set_profile
data:
  profile_id: morning
```

```yaml
service: immich_frame.set_renderer_options
data:
  durationSeconds: 45
  showWeather: true
  albumOrder: newest
```

```yaml
service: immich_frame.save_profile
data:
  profile_id: morning
  overwrite: true
```

When a profile is already active, pressing **Save Profile** after changing entities updates that active profile. For automation flows, prefer passing `profile_id` explicitly so the target profile is unambiguous.

### `set_renderer_options`

One service covers all renderer overrides. Field groups:

- **Slideshow**: `durationSeconds`, `transition`, `fadeTransitionDuration`, `crossFadeTransitionDuration`, `imageEffect`, `imageEffectAmount`, `albumOrder`
- **Layout**: `layout`, `imageFit`, `backgroundBlur`, `backgroundBlurAmount`, `fontSize`, `frameless`, `customCssClass`
- **Clock & weather**: `showTime`, `timeFormat`, `showAmPm`, `showSeconds`, `showDate`, `dateFormat`, `clockSource`, `showWeather`, `weatherLocation`, `weatherRotationInterval`, `weatherShowForecast`, `weatherShowHumidity`, `weatherShowWind`, `weatherShowWindDirection`, `weatherShowVisibility`, `weatherShowTemperatureRange`, `weatherRoundTemperature`
- **Image metadata**: `showImageDate`, `imageDateFormat`, `showImageTime`, `imageTimeFormat`, `showAlbumName`, `showPersonName`, `showPersonAge`, `showImageLocation`, `showImageCamera`, `showImageExif`, `showImageDescription` (plus description scroll tuning), `showImageRating`, `showOwner`, `showUser`, `showImageQr`, `showImageId`, `showMoreInfo`
- **Sources & filters**: `activePersonIds`, `requireAllPeople`, `filterDate`, `filterNewest`, `showVideos`, `excludeVideosOver`, `showArchived`
- **Kiosk UI**: `disableNavigation`, `hideCursor`, `showProgressBar`, `progressBarPosition`
- **Display care**: `burnInInterval`, `burnInDuration`, `burnInOpacity`, `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, `disableSleep`

The full field list with selectors lives in [`services.yaml`](https://github.com/hyungyunlim/immich-ha-sa/blob/main/custom_components/immich_frame/services.yaml).

### Per-profile custom CSS

Enter one or more class names in the frame's **Custom CSS Class** text entity. Use `art-gallery` for one class or separate multiple classes with whitespace, for example `art-gallery night-mode`. Do not include leading dots or the `custom_css_class=` query name. The controller normalizes the whitespace and sends the value to immich-kiosk, which adds the classes to its renderer container.

Add a matching rule to the `custom.css` file mounted into immich-kiosk, then restart immich-kiosk after changing that file. This temporary badge makes the result obvious:

```css
.art-gallery::after {
  content: "ART GALLERY CSS ACTIVE";
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 99999;
  padding: 12px 18px;
  background: magenta;
  color: white;
  font-size: 24px;
  font-weight: bold;
}
```

You can set the same value from an automation or script:

```yaml
service: immich_frame.set_renderer_options
data:
  customCssClass: art-gallery night-mode
```

The badge should appear after the frame reloads. The **Frame Renderer URL** sensor's `url` attribute should also contain the URL-encoded value `custom_css_class=art-gallery+night-mode`. Clear the text entity, or send `customCssClass: ""`, to remove all custom classes and the query parameter.

The complete class list is stored with saved profiles, so an art profile can use `art-gallery night-mode` while ordinary photo profiles leave it empty. A selector such as `.art-gallery` applies when that class is present; `.art-gallery.night-mode` requires both classes on the same renderer container. Once the test badge works, replace it with the real profile-specific rules. For example:

```css
.art-gallery .asset--metadata--description .asset--metadata--icon {
  display: none !important;
}
```

The controller may already hide the description icon through its compatibility CSS, so use the badge for the first test rather than relying on that icon alone. See the [immich-kiosk custom CSS guide](https://docs.immichkiosk.app/configuration/custom-css/) for container mounting and other selectors.

## Examples

Switch to a saved profile every morning:

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

Show the last 30 days from a specific album on weekends:

```yaml
alias: Weekend recent photos
trigger:
  - platform: time
    at: "08:00:00"
condition:
  - condition: time
    weekday: [sat, sun]
action:
  - service: immich_frame.set_album
    data:
      album_names: ["Family"]
  - service: immich_frame.set_renderer_options
    data:
      filterDate: last-30-days
      albumOrder: newest
```

Follow the frame's physical orientation (this example treats X-dominant as landscape; swap the two options if your device reports the opposite):

```yaml
alias: Frame content follows rotation
trigger:
  - platform: state
    entity_id: binary_sensor.lenovo_frame_x_axis_dominant
    to: "on"
  - platform: state
    entity_id: binary_sensor.lenovo_frame_x_axis_dominant
    to: "off"
action:
  - service: select.select_option
    target:
      entity_id: select.lenovo_frame_orientation
    data:
      option: "{{ 'Landscape only' if trigger.to_state.state == 'on' else 'Portrait only' }}"
```

Wake the screen when someone approaches a camera-equipped frame (needs [FreeKiosk MQTT](./freekiosk#real-time-updates-over-mqtt) with Always-on Motion Detection):

```yaml
alias: Frame screen on motion
trigger:
  - platform: state
    entity_id: binary_sensor.lenovo_frame_motion
    to: "on"
action:
  - service: button.press
    target:
      entity_id: button.lenovo_frame_screen_on
```

Screen off at night, back on in the morning:

```yaml
alias: Frame screen schedule
trigger:
  - platform: time
    at: "23:00:00"
    id: "off"
  - platform: time
    at: "07:00:00"
    id: "on"
action:
  - service: button.press
    target:
      entity_id: "button.lenovo_frame_screen_{{ trigger.id }}"
```
