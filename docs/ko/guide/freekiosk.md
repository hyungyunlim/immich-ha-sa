# FreeKiosk 원격 제어

액자가 FreeKiosk를 실행한다면 컨트롤러가 FreeKiosk REST API를 통해 디스플레이와 오디오 하드웨어를 제어할 수 있습니다: 밝기, 볼륨, 화면 전원, 슬라이드쇼 내비게이션. 선택적으로 같은 제어를 [MQTT](#_3-선택-mqtt-push-제어)로도 돌릴 수 있어 push 텔레메트리와 IP 없는 명령 전달이 가능합니다.

## 1. 액자에서 REST API 활성화

액자 기기의 FreeKiosk 앱에서 **Remote API**(REST)를 활성화합니다. 기기의 LAN IP와 API 포트(기본 `8080`)를 확인하고, 원한다면 API 키를 설정하세요.

## 2. 컨트롤러에서 디바이스 설정

[컨트롤러 콘솔](./controller-setup)의 디바이스 설정에서 다음을 입력합니다:

- **Remote Control**: `freekiosk`
- **Remote API URL**: FreeKiosk REST 기본 URL, 예: `http://192.168.1.160:8080`
- **Remote API Key**: 선택, FreeKiosk에서 활성화한 경우에만

::: warning 원격 액자는 같은 네트워크가 필요합니다
컨트롤러가 Remote API URL에 직접 도달할 수 있어야 합니다. LAN 밖의 액자는 Cloudflare Tunnel이 이 트래픽을 처리하지 않으므로 — WireGuard나 Tailscale로 컨트롤러 호스트와 액자를 연결하고, 액자의 VPN 주소를 Remote API URL로 사용하세요. [원격 프레임](./remote-frames#remote-hardware-control)을 참고하세요. 아래의 MQTT를 쓰면 이 제약이 아예 사라집니다.
:::

## 3. 선택: MQTT push 제어

FreeKiosk는 MQTT로도 텔레메트리를 publish하고 명령을 받을 수 있습니다. 컨트롤러와 액자가 같은 broker에 연결되면, 컨트롤러는 FreeKiosk의 `set/*` 토픽으로 하드웨어 명령을 publish하고 availability/state 토픽을 구독합니다 — 양방향 모두 REST 자동 폴백이 있습니다.

REST 단독 대비 추가되는 것:

- **온라인/오프라인 추적** — FreeKiosk MQTT의 Last Will이 액자가 네트워크에서 떨어지는 순간 offline으로 표시합니다. Home Assistant에 connectivity 센서로 노출됩니다.
- **Push 텔레메트리** — 배터리, 화면 상태, WiFi 신호, 조도 센서, 카메라 모션이 REST 폴링 대신 broker push로 들어옵니다.
- **IP 발견 불필요** — 액자가 broker로 아웃바운드 접속하므로 DHCP 변경이나 절전 때문에 하드웨어 제어가 깨지지 않습니다. MQTT state가 컨트롤러의 REST 폴백 IP도 최신으로 유지합니다.

### 활성화 방법

1. **Broker** — Home Assistant OS에서는 Mosquitto broker add-on을 설치하면 컨트롤러 add-on이 Supervisor를 통해 자동 감지합니다 (`mqtt_*` add-on 옵션으로 수동 지정 가능). standalone Docker는 컨트롤러 컨테이너에 `MQTT_BROKER_URL`(필요 시 `MQTT_USERNAME` / `MQTT_PASSWORD`)을 설정합니다.
2. **액자** — FreeKiosk 앱에서 **Advanced → MQTT**를 열고 같은 broker를 지정한 뒤 **Device Name**(예: `lobby`)을 설정하고 **Connect**를 누릅니다.
3. **바인딩** — 컨트롤러 콘솔을 열면 **MQTT Bridge** 섹션에 액자가 나타납니다. 옆의 **Bind** 버튼을 누르세요. 액자 IP가 알려진 프레임과 일치하면 콘솔이 해당 프레임을 미리 선택해 줍니다.

MQTT와 REST API는 동시에 켜둘 수 있으며, 컨트롤러가 살아 있는 경로를 알아서 사용합니다. 상태 조회는 REST가 도달 가능하면 REST를 우선합니다 (MQTT state에 없는 auto-brightness 같은 필드가 REST에 있기 때문). REST가 죽으면 MQTT 캐시가 응답합니다.

::: tip VPN 없는 원격 액자
액자가 broker로 아웃바운드 접속하므로, 액자가 broker에 도달할 수만 있다면 LAN 밖의 액자도 WireGuard/Tailscale 없이 MQTT 하드웨어 제어가 동작합니다.
:::

### FreeKiosk HA 자동 발견

이 통합과 별개로, FreeKiosk의 MQTT 클라이언트는 Home Assistant discovery 엔티티(40개 이상의 센서와 컨트롤)를 직접 publish할 수 있습니다. 컨트롤러와 병행해도 문제없으며, 양쪽 엔티티가 모두 Home Assistant에 나타납니다.

## Home Assistant에 생기는 것

Number 엔티티:

- **Display Brightness** — `/api/brightness`를 통한 수동 밝기
- **Media Volume**

상태 엔티티 (REST 또는 MQTT로 FreeKiosk 텔레메트리를 읽을 수 있을 때):

- **Light Level**
- **Auto Brightness Active**
- **Device Online** — connectivity. MQTT Last Will 또는 REST 상태 조회 성공 기준. MQTT 없이는 on 또는 unavailable만 표시되며, 명시적 off 상태는 MQTT 바인딩이 필요합니다
- **Motion** — FreeKiosk 카메라 모션 (`webview.motionDetected`). 상시 보고가 필요하면 FreeKiosk의 *Always-on Motion Detection*을 켜세요
- **X-Axis Dominant** — 가속도계 방향 힌트. ON이면 X축 우세, OFF이면 Y축 우세이며 raw `x`, `y`, `z` 값은 엔티티 속성에서 볼 수 있습니다
- **Battery**, **Battery Charging**, **WiFi Signal** — 진단 센서

> [!NOTE]
> **Motion** 센서는 카메라가 있는 기기에서만 동작합니다. 카메라 없는 액자(대부분의 디지털 액자)는 모션이 보고되지 않으니, 쓰지 않으면 엔티티를 비활성화하세요.

축 센서는 어느 상태를 “가로” 또는 “세로”라고 단정하지 않습니다. Android 센서 축은 기기의 기본 방향을 따르며 태블릿은 가로가 기본인 경우가 많으므로, 실제 기기를 돌려 보고 ON/OFF 중 어느 쪽이 가로인지 자동화에서 정하면 됩니다. 기기가 평평하게 놓였거나 가속도계 값이 없거나 45도 부근에서 X와 Y가 비슷할 때는 잘못된 전환과 상태 떨림을 막기 위해 unavailable이 됩니다.

[방향 자동화 예제](./automations#예제)를 사용하면 ON/OFF를 **Landscape only**와 **Portrait only**에 연결할 수 있습니다. 기기에서 결과가 반대로 나오면 두 option을 서로 바꾸세요. Android 스마트폰, 태블릿, 디지털 액자는 기본 방향이 서로 다를 수 있으므로 정상적인 차이입니다.

### MQTT 실시간 업데이트

프레임이 MQTT로 바인딩되면, 기기가 변화를 publish하는 즉시 컨트롤러가 텔레메트리를 Home Assistant로 스트리밍합니다. 그래서 모션·화면 상태·online/offline이 통합의 30초 폴링을 기다리지 않고 약 1초 안에 반영돼요. "사람이 다가오면 화면 켜기" 같은 presence 자동화가 쓸만해지는 게 이 덕분입니다.

카메라 기기에서 모션 지연을 최소화하려면:

- FreeKiosk MQTT 설정에서 **Always-on Motion Detection**을 켜세요 (안 켜면 모션은 screensaver 중에만 동작). 켜두면 모션 변화가 발생 즉시 publish됩니다.
- 주기적 **Status Interval**(기본 30초)은 배터리/WiFi/조도 같은 정기 텔레메트리만 좌우합니다. 모션은 별도로 즉시 푸시되므로 보통 낮출 필요 없어요.

MQTT 없이(REST 전용 프레임)는 통합이 계속 30초 폴링합니다 — 푸시 스트림의 소스가 없을 뿐이에요. 30초 폴링은 항상 폴백으로 돌기 때문에 스트림이 끊겨도 자동 복구됩니다.

버튼:

- **Next**, **Previous**, **Play/Pause**, **Reload**
- **Screen On**, **Screen Off**
- **Volume Up**, **Volume Down**, **Device Mute Toggle**

## 명령 전달 방식

Next, Previous, Play/Pause, Reload는 컨트롤러 이벤트 스트림으로 고정 프레임 페이지에 전달된 뒤 same-origin immich-kiosk iframe으로 브리지됩니다. 프레임 브라우저가 연결되어 있지 않으면 FreeKiosk 디바이스 경로로 폴백합니다.

화면, 밝기, 볼륨 제어는 FreeKiosk 디바이스로 직접 갑니다. **컨트롤러는 디바이스에 도달 가능하면 항상 REST API를 우선합니다** (수동 Remote API URL, 또는 프레임 텔레메트리에서 검증된 FreeKiosk IP). REST는 명령이 실제로 실행됐음을 확인해 주고, 디바이스 측 MQTT 명령 결함을 피할 수 있기 때문입니다. MQTT로 명령을 보내는 경우는 컨트롤러가 도달 가능한 REST 엔드포인트가 없을 때 — broker를 통해서만 닿는 원격 프레임 — 또는 REST 시도가 재시도해도 안전한 방식으로 실패했을 때(화면 on/off와 reload는 MQTT로 재시도, 상대 볼륨 스텝과 음소거 토글은 이중 적용 방지를 위해 재시도 안 함)뿐입니다. 자동 밝기 제어는 REST 전용입니다.

> [!NOTE]
> 그래서 MQTT 바인딩은 로컬 프레임의 신뢰성을 절대 떨어뜨리지 않습니다: 액추에이션은 여전히 REST로 흐르고, MQTT는 presence(online/offline)·모션·텔레메트리를 더해줍니다. FreeKiosk 릴리스가 특정 MQTT 명령(예: 화면 전원)을 망가뜨려도 로컬 프레임은 REST로 계속 동작합니다.

::: warning 내비게이션을 켜두세요
Next/Previous 버튼을 쓰려면 프레임의 `disableNavigation` 렌더러 옵션을 **꺼두세요**. immich-kiosk의 `disable_navigation`은 터치, 키보드, 메뉴 내비게이션을 모두 차단하므로, 켜져 있으면 브리지된 명령이 무시됩니다.
:::

## 오디오: 기기 음소거 vs 비디오 음소거

- **Device Mute Toggle**, **Volume Up/Down** — FreeKiosk를 통해 키 이벤트로 전달되는 안드로이드 기기 오디오. 액자 전체 오디오 상태를 신뢰성 있게 제어하려면 이쪽을 사용하세요.
- **Kiosk Video Mute** — immich-kiosk 자체 비디오 음소거 상태를 제어하는 스위치와 빠른 토글용 press 버튼입니다. 스위치는 controller bridge를 통해 명시적인 mute/unmute 명령을 보내고, 가능하면 immich-kiosk의 browser video API를 사용합니다. Android device volume은 바꾸지 않습니다.

## 알려진 FreeKiosk 제약

FreeKiosk 1.2.16은 `/api/status`에서 자동 밝기 상태를 보고하지만, 문서에 있는 `/api/autoBrightness/enable` / `/api/autoBrightness/disable` 엔드포인트는 제공하지 않습니다. 수동 제어는 **Display Brightness**를 사용하세요. 필요 시 FreeKiosk가 `/api/brightness` 경유로 자동 밝기를 비활성화합니다.
