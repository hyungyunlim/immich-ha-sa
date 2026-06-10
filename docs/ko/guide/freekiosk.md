# FreeKiosk 원격 제어

액자가 FreeKiosk를 실행한다면 컨트롤러가 FreeKiosk REST API를 통해 디스플레이와 오디오 하드웨어를 제어할 수 있습니다: 밝기, 볼륨, 화면 전원, 슬라이드쇼 내비게이션.

## 1. 액자에서 REST API 활성화

액자 기기의 FreeKiosk 앱에서 **Remote API**(REST)를 활성화합니다. 기기의 LAN IP와 API 포트(기본 `8080`)를 확인하고, 원한다면 API 키를 설정하세요.

## 2. 컨트롤러에서 디바이스 설정

[컨트롤러 콘솔](./controller-setup)의 디바이스 설정에서 다음을 입력합니다:

- **Remote Control**: `freekiosk`
- **Remote API URL**: FreeKiosk REST 기본 URL, 예: `http://192.168.1.160:8080`
- **Remote API Key**: 선택, FreeKiosk에서 활성화한 경우에만

::: warning 원격 액자는 같은 네트워크가 필요합니다
컨트롤러가 Remote API URL에 직접 도달할 수 있어야 합니다. LAN 밖의 액자는 Cloudflare Tunnel이 이 트래픽을 처리하지 않으므로 — WireGuard나 Tailscale로 컨트롤러 호스트와 액자를 연결하고, 액자의 VPN 주소를 Remote API URL로 사용하세요. [원격 프레임](./remote-frames#remote-hardware-control)을 참고하세요.
:::

## Home Assistant에 생기는 것

Number 엔티티:

- **Display Brightness** — `/api/brightness`를 통한 수동 밝기
- **Media Volume**

상태 엔티티 (FreeKiosk 상태를 읽을 수 있을 때):

- **Light Level**
- **Auto Brightness Active**

버튼:

- **Next**, **Previous**, **Play/Pause**, **Reload**
- **Screen On**, **Screen Off**
- **Volume Up**, **Volume Down**, **Device Mute Toggle**

## 명령 전달 방식

Next, Previous, Play/Pause, Reload는 컨트롤러 이벤트 스트림으로 고정 프레임 페이지에 전달된 뒤 same-origin immich-kiosk iframe으로 브리지됩니다. 프레임 브라우저가 연결되어 있지 않으면 FreeKiosk REST로 폴백합니다.

화면, 볼륨, 기기 음소거 제어는 항상 FreeKiosk REST 엔드포인트가 필요합니다 (`/api/screen/on`, `/api/screen/off`, `/api/remote/keyboard/volumeup`, `/api/remote/keyboard/volumedown`, `/api/remote/keyboard/mute`).

::: warning 내비게이션을 켜두세요
Next/Previous 버튼을 쓰려면 프레임의 `disableNavigation` 렌더러 옵션을 **꺼두세요**. immich-kiosk의 `disable_navigation`은 터치, 키보드, 메뉴 내비게이션을 모두 차단하므로, 켜져 있으면 브리지된 명령이 무시됩니다.
:::

## 오디오: 기기 음소거 vs 비디오 음소거

- **Device Mute Toggle**, **Volume Up/Down** — FreeKiosk를 통해 키 이벤트로 전달되는 안드로이드 기기 오디오. 액자 전체 오디오 상태를 신뢰성 있게 제어하려면 이쪽을 사용하세요.
- **Kiosk Video Mute** — immich-kiosk 자체 비디오 음소거를 제어하는 press 버튼. kiosk의 `.navigation--mute` 컨트롤을 먼저 클릭하고, 실패하면 비디오 요소의 muted 상태를 직접 토글합니다. immich-kiosk가 신뢰할 수 있는 음소거 상태를 노출하지 않기 때문에 스위치가 아닌 press 버튼입니다.

## 알려진 FreeKiosk 제약

FreeKiosk 1.2.16은 `/api/status`에서 자동 밝기 상태를 보고하지만, 문서에 있는 `/api/autoBrightness/enable` / `/api/autoBrightness/disable` 엔드포인트는 제공하지 않습니다. 수동 제어는 **Display Brightness**를 사용하세요. 필요 시 FreeKiosk가 `/api/brightness` 경유로 자동 밝기를 비활성화합니다.
