# 문제 해결

## 새 Immich 앨범이 Home Assistant에 안 보여요

앨범 선택지는 컨트롤러 캐시에서 나옵니다. 통합은 캐시를 30초마다 읽고, 컨트롤러는 `album_refresh_interval_seconds`(기본 900초)마다 Immich에서 캐시를 갱신합니다. 즉시 반영하려면 **Refresh Albums** 버튼을 누르거나 `immich_frame.refresh_albums` 서비스를 호출하세요.

## 비디오가 포스터만 보이고 재생되지 않아요

- 프레임의 **Show Videos** 스위치를 켜세요 (`show_videos=true`).
- immich-kiosk는 비디오 재생에 서버 측 `kiosk.prefetch` / `KIOSK_PREFETCH` 활성화도 요구합니다. 이 설정은 URL로 오버라이드할 수 없습니다.
- 컨트롤러 프록시는 WebView 비디오 재생에 필요한 HTTP range 헤더를 보존합니다. 그래도 재생되지 않으면 컨트롤러가 `0.1.13` 이상인지 확인하세요.

## 앨범에서 "Error Retrieving asset"이 떠요

선택한 앨범이 아카이브된 자산만 담고 있을 가능성이 큽니다. immich-kiosk는 기본적으로 아카이브 자산을 제외합니다 — 프레임의 **Show Archived** 스위치를 켜세요 (`show_archived=true`).

## Next / Previous 버튼이 동작하지 않아요

프레임의 `disableNavigation` 렌더러 옵션을 **꺼두세요**. immich-kiosk의 `disable_navigation`은 터치, 키보드, 메뉴 내비게이션을 차단하므로, 켜져 있는 동안 브리지된 명령과 물리 키 이벤트가 무시됩니다.

Previous는 이전 사진 히스토리가 있어야 동작합니다. 프레임을 막 열었거나 슬라이드쇼의 첫 사진이면 실패 응답이 정상입니다. 연결된 프레임이 명령을 적용하지 못하면 컨트롤러도 성공으로 표시하지 않으므로, Home Assistant 오류와 컨트롤러 로그에서 원인을 확인할 수 있습니다.

## 화면을 껐는데 NAS 디스크가 계속 동작해요

컨트롤러와 Home Assistant 통합을 **0.1.86 이상**으로 함께 업데이트하세요. 이 버전부터 Screen Off가 물리 화면을 끄기 전에 immich-kiosk iframe을 완전히 분리해 이미지 요청과 슬라이드쇼 타이머를 멈춥니다. FreeKiosk 자체의 Screen Off나 절전 기능만 단독으로 사용하면 WebView의 자바스크립트는 계속 실행될 수 있으므로, 자동화에서도 이 통합의 **Screen** 스위치나 **Screen Off** 버튼을 사용하세요.

## 날씨 위치가 이상하거나 원치 않게 표시돼요

날씨 API 키와 위치는 컨트롤러가 아니라 immich-kiosk의 `config.yaml`에 있습니다. 프레임의 **Weather Location** text 엔티티에 설정된 위치 이름을 넣거나, 비워서 kiosk 기본값을 쓰거나, `rotate`로 설정된 위치들을 순환하세요. **Show Weather**를 끄면 `weather=none`이 전송되어 immich-kiosk가 기본 위치를 자동 선택하지 않습니다. 날씨 상세 select(`Use Kiosk Config` / `Show` / `Hide`)로 프레임별 상속/오버라이드를 정합니다.

## 원격 액자가 변경에 느리게 반응해요

터널에서는 SSE가 불안정할 수 있고, 그 경우 프레임은 `poll_interval_seconds`(기본 20초) 주기 폴링으로 폴백합니다. 정상 동작입니다 — 더 빠른 반응이 필요하면 주기를 줄이세요.

## MQTT Bridge가 Disconnected로 떠요

컨트롤러가 broker에 도달하지 못한 겁니다. Home Assistant OS에서는 Mosquitto 애드온을 자동 감지하니 설치·시작하세요. 다른 broker를 쓰려면 `mqtt_broker_url`(애드온 옵션) 또는 `MQTT_BROKER_URL`(standalone Docker)을 설정합니다. 애드온 로그에 연결된 broker가 찍히고, [MQTT Bridge](./controller-setup#mqtt-bridge) 섹션의 **Last connection error** 줄에 인증·연결 실패가 표시됩니다.

## FreeKiosk 액자가 MQTT Bridge에 안 나타나요

액자가 컨트롤러가 구독하는 토픽으로 publish하지 않는 겁니다. FreeKiosk 앱 **Advanced → MQTT**에서:

- **Base Topic**은 반드시 `freekiosk`여야 합니다 (컨트롤러는 `freekiosk/+/...`를 구독). `mykiosk` 같은 커스텀 base topic은 컨트롤러에 보이지 않습니다.
- **Broker URL**은 broker의 **LAN IP**(예: `192.168.1.10`)여야 합니다. `core-mosquitto`는 Home Assistant 내부에서만 풀리는 이름이라 안 됩니다.
- **사용자/비밀번호**: Mosquitto 애드온은 Home Assistant 사용자 계정을 만들어 그 자격증명을 쓰면 됩니다. 그다음 **Connect**를 누르세요.

**Device Name**(예: `lobby`)을 설정하세요 — 이게 바인딩할 토픽 ID가 됩니다.

## 애드온 패널에서 Bind/Unbind(또는 디바이스 추가·수정)가 동작하지 않아요

애드온을 **0.1.78 이상**으로 업데이트하세요. 그 이전 버전은 콘솔 API 요청을 ingress 패널 URL 기준으로 만들어서 컨트롤러에 도달하지 못했습니다. 업데이트하면 Home Assistant ingress 패널에서도 버튼이 동작합니다.

## MQTT Bridge에 "Real-time push: idle"이 떠요

컨트롤러 텔레메트리 스트림에 구독자가 없는 겁니다 — 통합이 소비하지 않고 있어요. **통합**(HACS)을 애드온과 같은 버전으로 업데이트하고 Home Assistant를 재시작하세요. 리스너는 시작 시 연결되며, 그러면 "active (N)"이 연결된 프레임 수를 보여줍니다. 푸시는 선택이고, 없어도 통합은 30초마다 폴링합니다.

## Motion 센서가 항상 off이거나 unavailable이에요

FreeKiosk 모션은 기기 카메라를 씁니다. 카메라 없는 액자(대부분의 디지털 액자)는 모션을 보고하지 않으니 **Motion** 엔티티를 비활성화하세요. 카메라 기기에서는 FreeKiosk MQTT 설정의 **Always-on Motion Detection**을 켜세요 (안 켜면 모션은 screensaver 중에만 동작).

## 배터리/WiFi/화면 상태가 ~30초 늦어요

FreeKiosk는 정기 텔레메트리를 **Status Interval**(기본 30초)에 맞춰 publish합니다. 컨트롤러는 받는 즉시 푸시하지만, 기기의 publish 주기가 바닥입니다. 진단값을 더 신선하게 원하면 FreeKiosk에서 Status Interval을 낮추세요. 가용성(online/offline)과 모션은 이벤트 기반이라 이 주기에 묶이지 않습니다.

## 화면 on/off가 REST로는 되는데 MQTT일 거라 기대한 상황에서 안 돼요

일부 FreeKiosk 릴리스는 MQTT 화면 명령을 회귀시킵니다. 컨트롤러는 디바이스에 도달 가능하면 하드웨어 명령에 REST를 우선하고, broker로만 닿는 프레임에만 MQTT를 쓰므로, 바인딩된 로컬 프레임은 그와 무관하게 REST로 계속 동작합니다. 설정할 것 없습니다.

## 컨트롤러 포트를 바꿨더니 동작이 깨졌어요

세 곳을 함께 수정해야 합니다: `local_public_controller_url`(애드온 옵션 / env), 통합의 컨트롤러 URL, 액자 브라우저의 고정 URL.

## 사진에 비밀번호가 걸려 있거나 인증 오류가 나요

immich-kiosk가 `KIOSK_PASSWORD`를 사용하면 컨트롤러에도 같은 값이 필요합니다 (애드온 옵션 `kiosk_password` 또는 `KIOSK_PASSWORD` env). 디바이스별 오버라이드는 [컨트롤러 콘솔](./controller-setup#디바이스-관리)에서 설정합니다.

## HACS가 통합 설치를 거부해요

통합은 Home Assistant **2026.3.0** 이상이 필요합니다. Home Assistant를 업데이트한 뒤 다시 시도하세요.

## 인물 + 앨범 선택 결과가 이상해요

immich-kiosk 문서상 `require_all_people`은 앨범·날짜 범위 같은 다른 소스 버킷과 호환되지 않습니다. **Require All People**은 인물 단독 선택에서만 사용하세요 (먼저 Album select를 `No Album Filter`로).

## 그래도 안 되면

컨트롤러 헬스 엔드포인트와 로그를 확인하세요:

```text
http://<controller-host>:8082/api/health
```

애드온 로그와 함께 [GitHub 이슈](https://github.com/hyungyunlim/immich-ha-sa/issues)를 열어주세요.
