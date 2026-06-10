# 애드온 설치

Home Assistant OS와 Supervised 사용자는 컨트롤러를 애드온으로 실행합니다. Home Assistant가 컨트롤러 컨테이너, 로그, 시작, 포트 매핑, 설정 UI를 관리하게 하려면 이 방식을 권장합니다.

::: info Home Assistant Container / Core
애드온은 Supervisor가 필요합니다. Home Assistant Container 또는 Core에서는 [독립 Docker](./standalone-docker)로 컨트롤러를 실행하세요.
:::

## 1. 저장소 추가

[![Add repository to my Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)

또는 수동으로: **설정 → 애드온 → 애드온 스토어**에서 우측 상단 메뉴의 **저장소**를 열고 다음 URL을 추가합니다:

```text
https://github.com/hyungyunlim/immich-ha-sa
```

## 2. 애드온 설치

[![Open add-on in my Home Assistant](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=e2ffcf58_immich_frame_controller&repository_url=https%3A%2F%2Fgithub.com%2Fhyungyunlim%2Fimmich-ha-sa)

스토어에서 **Immich Frame Controller**를 찾아 설치합니다.

## 3. 옵션 구성

| 옵션 | 필수 | 설명 |
| --- | --- | --- |
| `immich_internal_url` | 예 | 애드온 컨테이너에서 접근 가능한 Immich API URL |
| `immich_api_key` | 예 | Immich API 키 |
| `kiosk_internal_url` | 예 | 애드온 컨테이너에서 접근 가능한 immich-kiosk URL |
| `kiosk_password` | 아니오 | immich-kiosk가 `KIOSK_PASSWORD`를 사용하면 같은 값 |
| `local_public_controller_url` | 예 | Home Assistant와 액자가 LAN에서 접근하는 URL, 보통 `http://<home-assistant-host>:8082` |
| `local_public_kiosk_url` | 예 | LAN에서 브라우저가 접근하는 immich-kiosk URL |
| `external_public_controller_url` | 아니오 | [원격 프레임](./remote-frames)용 공개 컨트롤러 URL |
| `external_public_kiosk_url` | 아니오 | 원격 프레임용 공개 immich-kiosk URL |
| `default_frame_id` | 예 | 기본 프레임의 디바이스 ID (기본값 `lenovo`) |
| `default_frame_name` | 예 | 기본 프레임의 표시 이름 |
| `default_network_mode` | 예 | `auto`, `local`, `external` 중 하나 |
| `poll_interval_seconds` | 예 | 프레임 폴링 폴백 주기 (5–300초) |
| `album_refresh_interval_seconds` | 예 | 컨트롤러가 백그라운드에서 Immich 앨범을 새로고침하는 주기. `0`이면 자동 새로고침 비활성화 |
| `controller_api_token` | 아니오 | 선택적 고정 API 토큰. 대부분 비워두고 [페어링](./pairing)을 사용하세요 |

## 4. 시작 및 확인

애드온을 시작한 뒤, 애드온 **Web UI**(ingress)를 열거나 다음 주소로 접속합니다:

```text
http://<home-assistant-host>:8082/setup
```

기본 디바이스와 페어링 코드가 있는 컨트롤러 설정 콘솔이 보이면 정상입니다.

::: warning 포트 변경 시
애드온은 기본적으로 컨테이너 포트 `8080`을 호스트 포트 `8082`로 노출합니다. 애드온 네트워크 포트를 바꾸면 `local_public_controller_url`, 통합의 컨트롤러 URL, 액자의 고정 URL을 모두 함께 수정해야 합니다.
:::

## 다음 단계

- HACS로 [통합 설치](./integration-install)
- [Home Assistant와 액자 페어링](./pairing)
