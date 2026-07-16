# 엔티티와 서비스

프레임 디바이스마다 Home Assistant 디바이스 페이지가 생기고, 컨트롤러가 바꿀 수 있는 모든 것이 엔티티로, 자동화용으로는 `immich_frame.*` 서비스가 제공됩니다.

## 주요 엔티티

| 영역 | 엔티티 |
| --- | --- |
| 소스 선택 | **Album** select, **Albums** text (쉼표 구분 다중 선택), **Person** select, **People** text, **Require All People** switch |
| 필터 | **Date Filter Preset** select, **Filter Start Date** / **Filter End Date** 날짜 선택, **Date Filter** text (`last-30-days` 같은 raw 값), **Newest Filter** number, **Album Order** select |
| 프로필 | 프로필 선택과 아래 프로필 서비스 |
| 디스플레이 | 렌더러 옵션 엔티티 — 시계, 날짜, 날씨, 폰트 크기, 배경 블러, **Custom CSS Class**, 이미지 메타데이터(촬영 일시, 앨범, 인물, 카메라, EXIF, 위치, 평점, 소유자, 사용자), 진행 바 |
| 미디어 | **Show Videos** switch, **Show Archived** switch, **Kiosk Video Mute** 스위치/버튼 |
| 하드웨어 ([FreeKiosk](./freekiosk)) | **Display Brightness**, **Media Volume** number; 내비게이션·화면·볼륨 버튼 |
| 텔레메트리 ([FreeKiosk](./freekiosk)) | **Device Online**(연결), **Motion**(카메라 기기), **Screen On**, **Device Muted**, **Battery**, **Battery Charging**, **WiFi Signal**, **Light Level**, **Auto Brightness Active**, **X-Axis Dominant** |
| 유지보수 | **Refresh Albums**, **Refresh People** 버튼, **Network Mode** select |

참고:

- 텔레메트리 엔티티는 [FreeKiosk](./freekiosk#home-assistant에-생기는-것)에서 MQTT 또는 REST로 옵니다. [MQTT 바인딩](./freekiosk#_3-선택-mqtt-push-제어)이 있으면 **Device Online**과 **Motion**이 약 1초 안에 갱신되고(실시간 푸시), 없으면 통합이 30초마다 폴링합니다. **Motion**은 카메라가 있는 기기에서만 동작합니다.
- 앨범 필터가 없을 때 **Album** select는 `No Album Filter`를 표시합니다. 인물 단독 소스 선택을 원하면 인물을 고르기 전에 이것을 먼저 선택하세요.
- **Albums** / **People** text 엔티티는 이름 또는 ID를 쉼표로 구분해 받습니다. `all`은 이름이 있는 모든 인물을 선택하고, 빈 값 또는 `none`은 필터를 지웁니다.
- immich-kiosk 문서상 `require_all_people`은 앨범·날짜 범위 같은 다른 소스 버킷과 호환되지 않습니다 — 결정적인 결과가 필요하면 함께 쓰지 마세요.

## 서비스

모든 서비스는 선택적 `device_id`를 받습니다 (기본값은 설정된 디바이스).

| 서비스 | 주요 필드 |
| --- | --- |
| `immich_frame.set_album` | `album_id`, `album_ids`, `album_name`, `album_names` |
| `immich_frame.set_people` | `person_id`, `person_ids`, `person_name`, `person_names` |
| `immich_frame.set_profile` | `profile_id` (필수) |
| `immich_frame.save_profile` | `name`, `profile_id`, `overwrite` (기본 `true`) |
| `immich_frame.delete_profile` | `profile_id` |
| `immich_frame.refresh_albums` | — |
| `immich_frame.refresh_people` | — |
| `immich_frame.set_renderer_options` | 아래 참고 |
| `immich_frame.set_network_mode` | `network_mode`: `auto` / `local` / `external` (필수) |

### 프로필 저장

프로필은 현재 프레임 상태의 스냅샷입니다. 먼저 Home Assistant 엔티티나 서비스로 프레임 설정을 바꾼 뒤, 그 상태를 프로필로 저장합니다.

저장되는 항목:

- 소스 필터: 활성 앨범, 활성 인물, 날짜/최신순 필터, `requireAllPeople`
- 슬라이드쇼와 레이아웃 옵션: duration, transition, layout, image fit, background blur, font size, image effect, custom CSS class
- 표시 오버레이: 시계, 날짜, 날씨, 이미지 메타데이터, progress bar, sleep, burn-in 옵션
- 미디어와 네트워크 선호값: 영상 표시, 보관 항목 표시, 영상 길이 제한, preferred network mode

현재 기기 밝기, 볼륨, 화면 전원, 배터리, 모션 상태처럼 하드웨어 상태에 가까운 값은 저장하지 않습니다.

현재 설정으로 새 프로필을 만들려면 `immich_frame.save_profile`을 `name`과 함께 호출합니다:

```yaml
service: immich_frame.save_profile
data:
  name: Morning
  profile_id: morning
  overwrite: true
```

`profile_id`는 선택사항이지만, 자동화에서 계속 참조할 값이므로 명시하는 것을 권장합니다. 생략하면 통합이 `name`에서 ID를 만들어 씁니다.

디바이스 페이지에서도 만들 수 있습니다:

1. 디바이스 페이지의 엔티티로 프레임 설정을 바꿉니다.
2. **Profile Name**에 새 프로필 이름을 입력합니다.
3. 필요하면 **Profile ID**에 자동화에서 쓸 ID를 입력합니다.
4. **Save Profile** 버튼을 누릅니다.

**Save Profile** 버튼은 누르는 순간 이름을 입력받을 수 없습니다. **Profile Name**이 비어 있고 재사용할 기존 active profile 이름도 없으면 Home Assistant에 `Profile name is required` 오류가 표시됩니다.

기존 프로필을 업데이트하려면 먼저 해당 프로필을 로드하고, 설정을 바꾼 뒤 같은 `profile_id`로 다시 저장합니다:

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

프로필이 이미 active 상태라면 엔티티로 설정을 바꾼 뒤 **Save Profile** 버튼을 눌러도 그 active profile이 업데이트됩니다. 자동화에서는 대상이 모호하지 않도록 `profile_id`를 명시하는 편이 안전합니다.

### `set_renderer_options`

렌더러 오버라이드 전체를 하나의 서비스로 제어합니다. 필드 그룹:

- **슬라이드쇼**: `durationSeconds`, `transition`, `fadeTransitionDuration`, `crossFadeTransitionDuration`, `imageEffect`, `imageEffectAmount`, `albumOrder`
- **레이아웃**: `layout`, `imageFit`, `backgroundBlur`, `backgroundBlurAmount`, `fontSize`, `frameless`, `customCssClass`
- **시계·날씨**: `showTime`, `timeFormat`, `showAmPm`, `showSeconds`, `showDate`, `dateFormat`, `clockSource`, `showWeather`, `weatherLocation`, `weatherRotationInterval`, `weatherShowForecast`, `weatherShowHumidity`, `weatherShowWind`, `weatherShowWindDirection`, `weatherShowVisibility`, `weatherShowTemperatureRange`, `weatherRoundTemperature`
- **이미지 메타데이터**: `showImageDate`, `imageDateFormat`, `showImageTime`, `imageTimeFormat`, `showAlbumName`, `showPersonName`, `showPersonAge`, `showImageLocation`, `showImageCamera`, `showImageExif`, `showImageDescription` (및 설명 스크롤 튜닝), `showImageRating`, `showOwner`, `showUser`, `showImageQr`, `showImageId`, `showMoreInfo`
- **소스·필터**: `activePersonIds`, `requireAllPeople`, `filterDate`, `filterNewest`, `showVideos`, `excludeVideosOver`, `showArchived`
- **Kiosk UI**: `disableNavigation`, `hideCursor`, `showProgressBar`, `progressBarPosition`
- **디스플레이 보호**: `burnInInterval`, `burnInDuration`, `burnInOpacity`, `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, `disableSleep`

셀렉터를 포함한 전체 필드 목록은 [`services.yaml`](https://github.com/hyungyunlim/immich-ha-sa/blob/main/custom_components/immich_frame/services.yaml)에 있습니다.

## 예제

매일 아침 저장된 프로필로 전환:

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

주말에는 특정 앨범의 최근 30일 사진만:

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

그림 프로필을 저장하거나 표시하기 전에 immich-kiosk CSS class 적용:

```yaml
service: immich_frame.set_renderer_options
data:
  customCssClass: art-gallery
```

액자의 실제 방향에 맞춰 표시할 사진 방향도 변경 (아래 예제는 X축 우세를 가로로 봅니다. 기기에서 반대로 나온다면 두 option을 서로 바꾸세요):

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

카메라가 있는 액자 앞에 사람이 다가오면 화면 켜기 ([FreeKiosk MQTT](./freekiosk#mqtt-실시간-업데이트) + Always-on Motion Detection 필요):

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

밤에 화면 끄고 아침에 켜기:

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
