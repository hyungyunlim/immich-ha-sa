# Entities & Services

Each frame device gets a Home Assistant device page with entities for everything the controller can change, plus a set of `immich_frame.*` services for automations.

## Entity highlights

| Area | Entities |
| --- | --- |
| Source selection | **Album** select, **Albums** text (multi, comma-separated), **Person** select, **People** text, **Require All People** switch |
| Filters | **Date Filter Preset** select, **Filter Start Date** / **Filter End Date** date pickers, **Date Filter** text (raw values like `last-30-days`), **Newest Filter** number, **Album Order** select |
| Profiles | Profile selection and the profile services below |
| Display | Renderer option entities — clock, date, weather, font size, background blur, image metadata (date/time, album, person, camera, EXIF, location, rating, owner, user), progress bar |
| Media | **Show Videos** switch, **Show Archived** switch, **Kiosk Video Mute** button |
| Hardware ([FreeKiosk](./freekiosk)) | **Display Brightness**, **Media Volume** numbers; **Light Level**, **Auto Brightness Active** status; navigation, screen, and volume buttons |
| Maintenance | **Refresh Albums**, **Refresh People** buttons, **Network Mode** select |

Notes:

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

### `set_renderer_options`

One service covers all renderer overrides. Field groups:

- **Slideshow**: `durationSeconds`, `transition`, `fadeTransitionDuration`, `crossFadeTransitionDuration`, `imageEffect`, `imageEffectAmount`, `albumOrder`
- **Layout**: `layout`, `imageFit`, `backgroundBlur`, `backgroundBlurAmount`, `fontSize`, `frameless`
- **Clock & weather**: `showTime`, `timeFormat`, `showAmPm`, `showSeconds`, `showDate`, `dateFormat`, `clockSource`, `showWeather`, `weatherLocation`, `weatherRotationInterval`, `weatherShowForecast`, `weatherShowHumidity`, `weatherShowWind`, `weatherShowWindDirection`, `weatherShowVisibility`, `weatherShowTemperatureRange`, `weatherRoundTemperature`
- **Image metadata**: `showImageDate`, `imageDateFormat`, `showImageTime`, `imageTimeFormat`, `showAlbumName`, `showPersonName`, `showPersonAge`, `showImageLocation`, `showImageCamera`, `showImageExif`, `showImageDescription` (plus description scroll tuning), `showImageRating`, `showOwner`, `showUser`, `showImageQr`, `showImageId`, `showMoreInfo`
- **Sources & filters**: `activePersonIds`, `requireAllPeople`, `filterDate`, `filterNewest`, `showVideos`, `excludeVideosOver`, `showArchived`
- **Kiosk UI**: `disableNavigation`, `hideCursor`, `showProgressBar`, `progressBarPosition`
- **Display care**: `burnInInterval`, `burnInDuration`, `burnInOpacity`, `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, `disableSleep`

The full field list with selectors lives in [`services.yaml`](https://github.com/hyungyunlim/immich-ha-sa/blob/main/custom_components/immich_frame/services.yaml).

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
