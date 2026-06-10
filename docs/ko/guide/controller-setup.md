# 컨트롤러 콘솔

컨트롤러 루트 URL(또는 애드온 Web UI / ingress 패널)을 열면 설정 콘솔이 나타납니다 — 컨트롤러 운영의 중심입니다.

```text
http://<controller-host>:8082/
```

## 콘솔에서 보여주는 것

- Home Assistant용 페어링 코드와 컨트롤러 URL
- 디바이스 ID와 고정 프레임 URL (디바이스별 로컬/외부)
- 해석된 immich-kiosk 렌더러 URL (민감한 쿼리 값은 마스킹)
- 디바이스별 kiosk 비밀번호 출처와 연결 상태
- 현재 슬립, 디스플레이, 모션, UI, 진행 바, 번인 오버라이드 상태

## 디바이스 관리

디바이스 생성과 편집은 콘솔에서 합니다. URL, kiosk 비밀번호, FreeKiosk 설정이 컨트롤러에 중앙화되어 유지됩니다. 디바이스 관리는 로컬 콘솔에서만 가능합니다.

새 디바이스를 만들면 컨트롤러가 다음을 생성합니다:

- `/frame/<device_id>` 고정 URL
- 앨범, 렌더러, 슬립, 디스플레이 설정을 담는 독립된 프레임 상태 레코드
- 선택적 로컬/외부 컨트롤러·kiosk URL 오버라이드
- 선택적 디바이스별 immich-kiosk 비밀번호 오버라이드 — 비워두면 애드온 `kiosk_password`를 상속
- 선택적 [FreeKiosk REST 원격 제어 설정](./freekiosk)

Home Assistant 통합은 디바이스 ID마다 한 번씩 추가합니다. 페어링 후 config flow가 컨트롤러의 디바이스 목록을 읽어 선택지로 제공합니다.

## MQTT bridge

MQTT broker가 설정되면 콘솔에 **MQTT Bridge** 섹션이 생깁니다. broker에 publish하는 모든 FreeKiosk 프레임을 가용성·IP·마지막 수신 시각과 함께 나열하고, 발견된 디바이스를 프레임에 연결하는 **Bind** 버튼을 제공합니다 (IP가 알려진 프레임과 일치하면 컨트롤러가 미리 선택해 줍니다). 바인딩하면 그 프레임은 IP 발견 없이 푸시 하드웨어 제어·online/offline presence·실시간 텔레메트리를 얻습니다 — [FreeKiosk](./freekiosk#_3-선택-mqtt-push-제어) 참고.

섹션 헤더에 필 두 개가 표시됩니다:

- **Connected / Disconnected** — 컨트롤러와 broker의 연결.
- **Real-time push: active (N) / idle** — 실시간 텔레메트리 스트림을 소비하는 Home Assistant 통합 리스너 수. `idle`은 통합이 폴링 중이라는 뜻이니, 애드온과 같은 버전으로 업데이트하고 Home Assistant를 재시작하세요.

MQTT 토픽 하나는 프레임 하나에만 바인딩되며, 이미 다른 곳에 쓰인 토픽을 바인딩하려 하면 거부됩니다.

## URL과 네트워크 모드

컨트롤러는 **서비스**가 접근하는 URL과 **액자 브라우저**가 접근하는 URL을 분리합니다:

| 설정 | 의미 |
| --- | --- |
| `immich_internal_url`, `kiosk_internal_url` | 컨트롤러가 Immich와 immich-kiosk를 호출할 때 쓰는 서버 측 URL |
| `local_public_controller_url`, `local_public_kiosk_url` | LAN에서 액자 브라우저가 쓰는 URL |
| `external_public_controller_url`, `external_public_kiosk_url` | [터널](./remote-frames)을 통해 액자 브라우저가 쓰는 URL |

프레임마다 네트워크 모드가 있으며 Home Assistant에서 설정합니다 (`Network Mode` select 또는 `immich_frame.set_network_mode` 서비스):

- **`local`** — LAN 컨트롤러 프록시 URL 사용
- **`external`** — 공개(터널) 컨트롤러 프록시 URL 사용
- **`auto`** — 컨트롤러가 자동 판단

## 앨범·인물 캐시

Home Assistant에 보이는 앨범과 인물 선택지는 컨트롤러 캐시에서 나옵니다:

- 통합은 캐시를 30초마다 읽습니다.
- 컨트롤러는 `album_refresh_interval_seconds`(기본 900초, `0`이면 자동 새로고침 끔)마다 Immich에서 캐시를 갱신합니다.
- Immich에서 앨범을 새로 만든 직후처럼 즉시 반영이 필요하면 **Refresh Albums** / **Refresh People** 버튼 또는 `immich_frame.refresh_albums` / `immich_frame.refresh_people` 서비스를 사용하세요.

## 슬립과 디스플레이 보호

슬립 설정은 `sleepStart`, `sleepEnd`, `sleepIcon`, `sleepDimScreen`, `disableSleep`로 노출되며 immich-kiosk URL 쿼리 오버라이드로 적용됩니다. 번인 방지(`burnInInterval`, `burnInDuration`, `burnInOpacity`)도 같은 방식입니다. Home Assistant 엔티티 또는 `immich_frame.set_renderer_options` 서비스로 제어하세요.
